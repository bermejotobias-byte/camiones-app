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
  truckLayers: true
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
// Los niveles se ganan solo con kilometros, asi que no se pueden comprar. Los
// nombres salen del vocabulario del oficio.

const LEVELS = [
  { km: 0, name: 'Novato' },
  { km: 500, name: 'Repartidor' },
  { km: 2_000, name: 'Fletero' },
  { km: 6_000, name: 'Transportista' },
  { km: 15_000, name: 'Rutero' },
  { km: 40_000, name: 'Veterano' },
  { km: 100_000, name: 'Leyenda del asfalto' }
];

/**
 * Nivel alcanzado con esos kilometros, y cuanto falta para el siguiente.
 *
 * En el ultimo nivel no hay siguiente: la barra se muestra llena en vez de
 * dividir por cero.
 */
export function levelFor(kilometers) {
  const km = Math.max(0, kilometers || 0);

  let index = 0;
  while (index + 1 < LEVELS.length && km >= LEVELS[index + 1].km) index++;

  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;

  const span = next ? next.km - current.km : 0;
  const done = km - current.km;

  return {
    number: index + 1,
    name: current.name,
    nextName: next?.name ?? null,
    nextAt: next?.km ?? null,
    progress: next ? Math.min(1, done / span) : 1,
    remaining: next ? Math.max(0, next.km - km) : 0
  };
}
