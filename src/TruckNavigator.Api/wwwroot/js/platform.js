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
