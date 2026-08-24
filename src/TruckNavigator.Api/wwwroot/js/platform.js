/**
 * Lo que cambia entre correr en un navegador y correr dentro de la app Android.
 *
 * La misma aplicacion se sirve por HTTP y se empaqueta adentro de un WebView. Tres
 * cosas no se comportan igual en los dos lados, y las tres viven aca para que
 * ninguna vista tenga que preguntarse donde esta corriendo:
 *
 *   · la URL del backend  — servida por HTTP es el mismo origen; adentro del
 *     WebView la pagina se carga desde file://, donde no hay origen al que pegarle;
 *   · la ubicacion        — el WebView de Android no entrega `navigator.geolocation`
 *     sin que la cascara nativa resuelva el permiso, asi que la posicion la manda
 *     el GPS nativo por el puente;
 *   · llamar por telefono — un `tel:` adentro del WebView no abre el discador solo.
 */

/**
 * Hosts virtuales que usan los WebView embebidos para servir los assets.
 *
 * Sirven para reconocer que estamos adentro de la cascara aunque el puente no
 * haya cargado. Es una red de seguridad: sin ella, si falta
 * `_framework/hybridwebview.js` la app se cree en un navegador comun, le pega al
 * mismo origen —que aca no tiene API— y todos los pedidos vuelven 404 sin que
 * nada explique por que. Costo un rato entender ese sintoma.
 */
const EMBEDDED_HOSTS = ['0.0.0.0', 'appassets.androidplatform.net'];

/** Si estamos adentro de la cascara nativa. */
export const isNative =
  Boolean(window.HybridWebView?.SendRawMessage) ||
  EMBEDDED_HOSTS.includes(location.hostname);

/** El puente hace falta pero no esta. */
export const bridgeMissing = isNative && !window.HybridWebView?.SendRawMessage;

/* ---------------------------------------------------------------------------
   Puente hacia la cascara

   JS → C# por SendRawMessage, C# → JS llamando funciones que colgamos de window.
   Es el mismo canal oficial de HybridWebView que ya usaba el prototipo.
--------------------------------------------------------------------------- */

function send(payload) {
  window.HybridWebView?.SendRawMessage?.(JSON.stringify(payload));
}

/* ---------------------------------------------------------------------------
   Configuracion

   La cascara llama a window.TN_setConfig apenas la pagina termina de cargar. La
   aplicacion espera esa llamada antes de hacer el primer pedido: sin la URL del
   backend no hay nada que mostrar.
--------------------------------------------------------------------------- */

let resolveConfig;
let gaveUp = false;

const configArrived = new Promise((resolve) => { resolveConfig = resolve; });

/**
 * La cascara entrega la direccion del backend.
 *
 * Acepta un objeto o directamente la cadena: evaluar JavaScript desde el lado
 * nativo con llaves y comillas adentro es mas fragil que pasar un texto suelto,
 * y no vale la pena arriesgar la unica llamada de la que depende todo.
 */
window.TN_setConfig = (config) => {
  // Si ya nos habiamos dado por vencidos, la pantalla de error esta puesta y la
  // promesa no le sirve a nadie. Recargar es la forma mas simple de volver a
  // empezar bien.
  if (gaveUp) {
    location.reload();
    return;
  }

  resolveConfig(typeof config === 'string' ? { apiBase: config } : (config ?? {}));
};

/**
 * Espera la configuracion y devuelve la base de la API.
 *
 * En el navegador resuelve al instante contra el mismo origen. En la cascara
 * espera al puente, con un limite: si algo salio mal del lado nativo es mejor
 * decirlo que quedarse cargando para siempre.
 */
export async function initPlatform() {
  if (!isNative) return { apiBase: '' };

  // Sin puente no hay forma de recibir la direccion del backend. Se corta acá
  // con un motivo claro en vez de dejar que cada pedido falle por su cuenta.
  if (bridgeMissing) {
    return { apiBase: null, reason: 'El puente con la aplicación no cargó.' };
  }

  // Se avisa que la pagina esta lista y recien ahi la cascara contesta.
  //
  // Antes era al reves —la cascara empujaba la configuracion apenas aparecia la
  // pantalla— y habia una carrera que se perdia casi siempre: el chequeo de
  // conexion en la red local tarda milisegundos, menos que lo que tarda el
  // WebView en cargar la pagina, asi que la configuracion llegaba a una pagina
  // que todavia no existia y se perdia sin dejar rastro.
  //
  // Pidiendola desde acá no hay carrera posible: cuando se pide, la pagina ya
  // esta.
  send({ action: 'ready' });

  const timeout = new Promise((resolve) =>
    setTimeout(() => {
      gaveUp = true;
      resolve({
        apiBase: null,
        reason: 'La aplicación no informó la dirección del servidor.'
      });
    }, 12_000));

  return Promise.race([configArrived, timeout]);
}

/* ---------------------------------------------------------------------------
   Ubicacion
--------------------------------------------------------------------------- */

let positionWaiters = [];

/**
 * La cascara empuja cada posicion que lee del GPS nativo.
 *
 * Vienen tambien precision, velocidad y rumbo: el motor de guiado los necesita
 * para decidir si el camion se salio de la ruta —el umbral depende de cuanto
 * error informe el GPS— y cuanto pudo haber avanzado desde la posicion anterior.
 */
window.TN_setPosition = (lat, lng, accuracy, speed, heading) => {
  const coords = { lat, lng, accuracy, speed, heading, at: Date.now() };

  positionWaiters.forEach(({ resolve }) => resolve(coords));
  positionWaiters = [];

  watchers.forEach((fn) => fn(coords));
};

/** La cascara avisa cuando no pudo leer la ubicacion. */
window.TN_locationFailed = (reason) => {
  positionWaiters.forEach(({ reject }) => reject(new Error(reason || 'Sin ubicación')));
  positionWaiters = [];
};

/**
 * Ubicacion actual, una sola vez.
 *
 * @returns {Promise<{lat:number, lng:number}>}
 */
export function getPosition() {
  if (isNative) {
    return new Promise((resolve, reject) => {
      positionWaiters.push({ resolve, reject });
      send({ action: 'locate' });

      // El puente no garantiza respuesta: si el permiso quedo denegado, la
      // cascara puede no contestar nunca.
      setTimeout(() => reject(new Error('La ubicación tardó demasiado.')), 15_000);
    });
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este dispositivo no informa la ubicación.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      (error) => reject(new Error(describeGeolocationError(error))),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }
    );
  });
}

const watchers = new Set();

/**
 * Sigue la posicion mientras se navega.
 *
 * @returns {() => void} funcion para dejar de seguir
 */
export function watchPosition(onMove, destination) {
  watchers.add(onMove);

  if (isNative) {
    // El destino viaja para que la notificacion del sistema diga hacia donde va
    // el viaje, en vez de un "Navegando" pelado.
    send({ action: 'watchLocation', on: true, destination });

    return () => {
      watchers.delete(onMove);
      if (watchers.size === 0) send({ action: 'watchLocation', on: false });
    };
  }

  if (!navigator.geolocation) return () => watchers.delete(onMove);

  const id = navigator.geolocation.watchPosition(
    ({ coords }) => onMove({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      at: Date.now()
    }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5_000 }
  );

  return () => {
    watchers.delete(onMove);
    navigator.geolocation.clearWatch(id);
  };
}

function describeGeolocationError(error) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'No diste permiso de ubicación. Revisalo en los ajustes.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'No se pudo determinar tu ubicación.';
  }

  return 'La ubicación tardó demasiado.';
}

/* ---------------------------------------------------------------------------
   Voz

   Manejando, la voz no es un adorno: es la unica salida que no obliga a sacar
   los ojos del parabrisas.
--------------------------------------------------------------------------- */

/**
 * Dice una frase en voz alta.
 *
 * En la cascara lo resuelve el motor de sintesis nativo de Android. En el
 * navegador se usa la Web Speech API, que <b>no esta disponible en el WebView de
 * Android</b> —de ahi que el camino nativo no sea una optimizacion sino la unica
 * forma de que la app hable en el telefono—.
 */
export function speak(text) {
  if (!text) return;

  if (isNative) {
    send({ action: 'speak', text });
    return;
  }

  if (!('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-AR';
  utterance.rate = 1.05;

  // Una indicacion vieja que sigue sonando mientras aparece la siguiente es
  // peor que el silencio: se cancela lo anterior antes de hablar.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Si el dispositivo puede hablar. */
export const canSpeak = () => isNative || 'speechSynthesis' in window;

/* ---------------------------------------------------------------------------
   Pantalla

   Un GPS que deja apagar la pantalla a mitad de una maniobra no sirve.
--------------------------------------------------------------------------- */

let wakeLock = null;

export async function keepScreenAwake(on) {
  if (isNative) {
    send({ action: 'keepAwake', on });
    return;
  }

  if (!('wakeLock' in navigator)) return;

  try {
    if (on) {
      wakeLock ??= await navigator.wakeLock.request('screen');
    } else {
      await wakeLock?.release();
      wakeLock = null;
    }
  } catch {
    // El navegador puede negarlo; no es motivo para cortar la navegacion.
  }
}

/* ---------------------------------------------------------------------------
   Telefono
--------------------------------------------------------------------------- */

/**
 * Abre el discador.
 *
 * En el navegador alcanza con navegar a `tel:`. Adentro del WebView hay que
 * pedirselo a la cascara, porque el WebView no resuelve ese esquema solo.
 */
export function call(number) {
  if (isNative) {
    send({ action: 'call', number });
    return;
  }

  window.location.href = `tel:${number}`;
}
