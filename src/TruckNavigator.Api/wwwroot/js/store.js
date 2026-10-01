/**
 * Estado compartido de la aplicacion.
 *
 * Chico a proposito: solo lo que dos pantallas distintas necesitan ver. Todo lo
 * que usa una sola vista se queda adentro de esa vista.
 */

import { PREFERENCIAS_DE_ENTRADA } from './sesion.js';

const PREFS_KEY = 'tn.prefs';

const defaults = {
  /**
   * Si ya se leyo la pantalla de fuentes.
   *
   * Desde el 30/09/2026 ya NO es una puerta: esa pantalla vive en
   * Configuracion y Condiciones la enlaza. Se sigue leyendo para MIGRAR a
   * quien venia usando la app: quien la habia aceptado entra directo al paso
   * 4 de la entrada en vez de dar la vuelta entera (ver sesion.js).
   */
  sourcesAccepted: false,

  /**
   * Lo que guarda la entrada: la bienvenida vista, el idioma, la fecha en que
   * se aceptaron las condiciones, y el sello del invitado con su camion.
   *
   * Se declaran en sesion.js y se traen de ahi, no se copian: si cada archivo
   * las nombrara por su cuenta, un nombre distinto pasaria los tests de los
   * dos y dejaria a alguien repitiendo la entrada.
   */
  ...PREFERENCIAS_DE_ENTRADA,
  /** 'dark' | 'light' | 'auto' */
  theme: 'auto',
  /** Camion elegido para rutear. */
  selectedTruckId: null,

  /**
   * Las capas del mapa, una por una: { red, galibo, paso, radar, zona }, lo
   * que se elige en la hoja de capas (js/mapa/capas.js, `capasActivas`).
   * Hasta que se toque una, rigen los dos valores viejos de abajo.
   */
  capas: null,

  /**
   * Los dos botones de antes: la Red, los galibos y los pasos a nivel juntos,
   * y las zonas peligrosas aparte. Se siguen leyendo para que lo que alguien
   * apago siga apagado; lo nuevo se guarda en `capas`.
   *
   * Las capas de camion arrancan encendidas: es la informacion por la que
   * existe este producto. Las zonas arrancan APAGADAS, a proposito: es un
   * dato de la comunidad y no oficial, cubre area en vez de marcar puntos, y
   * no es lo que uno necesita para manejar.
   */
  truckLayers: true,
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
