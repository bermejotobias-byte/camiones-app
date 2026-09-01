/**
 * Cliente HTTP de la API.
 *
 * Concentra tres cosas que si estuvieran repartidas se romperian de a poco:
 * el token de sesion, la renovacion cuando vence, y la traduccion de los
 * errores del servidor a algo que se le pueda mostrar a una persona.
 */

const STORAGE_KEY = 'tn.session';

/**
 * Base de la API.
 *
 * Servida por HTTP es el mismo origen y queda en cadena vacia. Dentro del
 * WebView de Android la pagina se carga desde file://, donde no hay origen al
 * que pegarle, y la URL la aporta la cascara nativa por el puente.
 *
 * Se resuelve en el arranque y no al cargar el modulo: cuando este archivo se
 * evalua, el puente todavia no contesto.
 */
let apiBase = '';

export function setApiBase(url) {
  apiBase = (url || '').replace(/\/$/, '');
}

export const currentApiBase = () => apiBase;

/** Error con el mensaje ya listo para mostrar. */
export class ApiError extends Error {
  constructor(message, status, problem) {
    super(message);
    this.status = status;
    this.problem = problem;
  }
}

// --- sesion -----------------------------------------------------------------

let session = null;

try {
  session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
} catch {
  session = null;
}

export function currentSession() {
  return session;
}

export function isSignedIn() {
  return Boolean(session?.accessToken);
}

function saveSession(next) {
  session = next;

  if (next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function signOut() {
  saveSession(null);
}

// --- pedidos ----------------------------------------------------------------

/**
 * Saca el mensaje util de una respuesta de error.
 *
 * La API responde ProblemDetails, pero Identity devuelve sus errores de
 * validacion en `errors` con codigos propios. Se prefiere el detalle escrito
 * antes que el codigo, y recien al final un texto generico: un "Error 400" no
 * le dice nada a nadie.
 */
function describe(problem, status) {
  if (!problem) {
    return status === 0
      ? 'No se pudo contactar al servidor. Fijate si tenes conexion.'
      : `El servidor respondio ${status}.`;
  }

  if (problem.detail) return problem.detail;

  if (problem.errors) {
    const first = Object.values(problem.errors).flat().filter(Boolean);
    if (first.length) return first.join(' ');
  }

  return problem.title || `El servidor respondio ${status}.`;
}

async function request(method, path, { body, auth = true, retryOn401 = true } = {}) {
  const headers = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  let response;

  try {
    response = await fetch(apiBase + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (cause) {
    throw new ApiError(describe(null, 0), 0, null);
  }

  // Token vencido: se renueva una sola vez y se reintenta. El guard evita que
  // un refresh que tambien da 401 entre en un bucle.
  if (response.status === 401 && auth && retryOn401 && session?.refreshToken) {
    if (await refresh()) {
      return request(method, path, { body, auth, retryOn401: false });
    }

    signOut();
  }

  if (response.status === 204) return null;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new ApiError(describe(payload, response.status), response.status, payload);
  }

  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function refresh() {
  try {
    const renewed = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: session.refreshToken },
      auth: false,
      retryOn401: false
    });

    saveSession(renewed);
    return true;
  } catch {
    return false;
  }
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, { body });
const put = (path, body) => request('PUT', path, { body });
const del = (path) => request('DELETE', path);

const query = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();

  return search ? `?${search}` : '';
};

// --- superficie de la API ---------------------------------------------------

export const api = {
  health: () => request('GET', '/api/health', { auth: false }),

  // cuenta
  register: (email, password) =>
    request('POST', '/api/auth/register', { body: { email, password }, auth: false }),

  async signIn(email, password) {
    const result = await request('POST', '/api/auth/login', {
      body: { email, password },
      auth: false
    });

    saveSession(result);
    return result;
  },

  resendConfirmation: (email) =>
    request('POST', '/api/auth/resendConfirmationEmail', { body: { email }, auth: false }),

  forgotPassword: (email) =>
    request('POST', '/api/auth/forgotPassword', { body: { email }, auth: false }),

  // perfil
  profile: () => get('/api/profile'),
  saveProfile: (data) => put('/api/profile', data),
  aliasAvailable: (alias) => get(`/api/profile/alias-available${query({ alias })}`),

  // camiones
  trucks: () => get('/api/trucks'),
  truckTemplates: () => get('/api/trucks/templates'),
  createTruck: (data) => post('/api/trucks', data),
  updateTruck: (id, data) => put(`/api/trucks/${id}`, data),
  deleteTruck: (id) => del(`/api/trucks/${id}`),

  // lugares
  searchPlaces: (text) => request('GET', `/api/places${query({ q: text, limit: 6 })}`, { auth: false }),
  reverseGeocode: (lat, lng) =>
    request('GET', `/api/places/reverse${query({ lat, lng })}`, { auth: false }),

  // puntos de interes
  pois: (categories, truckId) =>
    request('GET', `/api/pois${query({ categories, truckId })}`, { auth: false }),

  // Ruteo sin registrar viaje (vista previa).
  //
  // Va CON token: el endpoint no exige sesion —asi el ruteo con las plantillas
  // funciona sin cuenta— pero si no se manda el token, el servidor no ve los
  // camiones propios y responde 404 sobre el camion del propio usuario.
  route: (truckId, origin, destination) =>
    post('/api/routes', { truckId, origin, destination }),

  /**
   * Reparto: el servidor decide en qué orden visitar las paradas.
   *
   * `stops` va en el orden en que las cargó el usuario y la respuesta trae
   * `stopOrder` con los índices sobre ESA lista, no las paradas reordenadas: así
   * la app puede decir "tu parada 3 se visita quinta" y el usuario reconoce sus
   * propias direcciones.
   */
  delivery: (truckId, origin, stops) =>
    post('/api/routes/delivery', { truckId, origin, stops }),

  // viajes
  startTrip: (data) => post('/api/trips', data),

  // Devuelve null cuando no hay ninguno abierto: el 204 del servidor no trae
  // cuerpo. Se consulta al entrar, porque el viaje sobrevive a cerrar la app.
  activeTrip: () => get('/api/trips/active'),

  finishTrip: (id) => post(`/api/trips/${id}/finish`),
  cancelTrip: (id) => post(`/api/trips/${id}/cancel`),
  trips: (limit = 20) => get(`/api/trips${query({ limit })}`),
  tripStats: () => get('/api/trips/stats')
};
