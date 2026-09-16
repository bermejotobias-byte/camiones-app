/**
 * Estado compartido de la aplicacion.
 *
 * Chico a proposito: solo lo que dos pantallas distintas necesitan ver. Todo lo
 * que usa una sola vista se queda adentro de esa vista.
 */

const PREFS_KEY = 'tn.prefs';

const defaults = {
  /** Si ya se leyo la pantalla de fuentes. Se pide una sola vez. */
  sourcesAccepted: false,
  /** 'dark' | 'light' | 'auto' */
  theme: 'auto',
  /** Camion elegido para rutear. */
  selectedTruckId: null,

  /**
   * Si se muestran sobre el mapa la Red de Transito Pesado, los galibos y los
   * pasos a nivel.
   *
   * Arranca encendido: es la informacion por la que existe este producto. Se
   * puede apagar porque a veces hace falta ver la calle limpia.
   */
  truckLayers: true,

  /**
   * Mapa de zonas peligrosas.
   *
   * Arranca APAGADO, al reves que las capas de camion, y es a proposito: es un
   * dato de la comunidad y no oficial, cubre area en vez de marcar puntos, y no
   * es lo que uno necesita para manejar. Que aparezca solo si se lo pide.
   */
  riskZones: false,

  /**
   * La voz del guiado. Se silencia desde el boton de sonido del viaje y se
   * recuerda: quien la apaga una vez no quiere apagarla en cada viaje. La
   * vibracion no depende de esto (AD-39).
   */
  voz: true
};

function readPrefs() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export const prefs = readPrefs();

export function savePrefs(patch) {
  Object.assign(prefs, patch);
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  listeners.forEach((fn) => fn(state));
}

/** Estado de sesion cargado desde la API. Se llena al entrar. */
export const state = {
  profile: null,
  trucks: [],
  /** Viaje en curso, si hay uno. */
  activeTrip: null,

  /**
   * Ruta del viaje en curso.
   *
   * Se guarda al lado del viaje porque al retomarlo despues de cerrar la app no
   * hay de donde sacarla: la pantalla se rearma de cero y la ruta la tiene el
   * servidor, no el navegador. Es null si el viaje esta abierto pero no se pudo
   * rutear —motor caido, camion borrado—, caso en el que igual hay que dejar
   * cerrarlo.
   */
  activeRoute: null
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

/** El camion elegido, o el primero disponible si el elegido ya no esta. */
export function selectedTruck() {
  if (!state.trucks.length) return null;

  return (
    state.trucks.find((truck) => truck.id === prefs.selectedTruckId) ??
    state.trucks.find((truck) => !truck.isTemplate) ??
    state.trucks[0]
  );
}

// --- tema -------------------------------------------------------------------

/**
 * Aplica el tema.
 *
 * 'auto' quita el atributo y deja que decida el sistema operativo, que es lo que
 * hace que la app se ponga oscura sola al entrar la noche.
 */
export function applyTheme() {
  const root = document.documentElement;

  if (prefs.theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', prefs.theme);
  }
}


// --- niveles ----------------------------------------------------------------
//
// La escala se mudo al SERVIDOR (TruckNavigator.Domain.Progression.LevelScale).
//
// Vivia aca, o sea en un lugar donde el usuario puede cambiar la regla, y ademas
// habria quedado duplicada con la del backend: dos copias de la misma regla
// terminan divergiendo. El cliente pide /api/progress y muestra lo que le llega.
