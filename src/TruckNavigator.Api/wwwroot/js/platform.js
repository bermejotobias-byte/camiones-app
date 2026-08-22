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

/** Si estamos adentro de la cascara nativa. */
export const isNative = Boolean(window.HybridWebView?.SendRawMessage);

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
const configArrived = new Promise((resolve) => { resolveConfig = resolve; });

window.TN_setConfig = (config) => resolveConfig(config ?? {});

/**
 * Espera la configuracion y devuelve la base de la API.
 *
 * En el navegador resuelve al instante contra el mismo origen. En la cascara
 * espera al puente, con un limite: si algo salio mal del lado nativo es mejor
 * decirlo que quedarse cargando para siempre.
 */
export async function initPlatform() {
  if (!isNative) return { apiBase: '' };

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve({ apiBase: null }), 6000));

  return Promise.race([configArrived, timeout]);
}

/* ---------------------------------------------------------------------------
   Ubicacion
--------------------------------------------------------------------------- */

let positionWaiters = [];

/** La cascara empuja cada posicion que lee del GPS nativo. */
window.TN_setPosition = (lat, lng) => {
  const coords = { lat, lng };

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
export function watchPosition(onMove) {
  watchers.add(onMove);

  if (isNative) {
    send({ action: 'watchLocation', on: true });

    return () => {
      watchers.delete(onMove);
      if (watchers.size === 0) send({ action: 'watchLocation', on: false });
    };
  }

  if (!navigator.geolocation) return () => watchers.delete(onMove);

  const id = navigator.geolocation.watchPosition(
    ({ coords }) => onMove({ lat: coords.latitude, lng: coords.longitude }),
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
