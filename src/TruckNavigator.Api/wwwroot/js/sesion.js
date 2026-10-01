/**
 * En que estado esta la app, y que puede hacer ese estado.
 *
 * Reemplaza las dos puertas que app.js tenia sueltas —las fuentes y la sesion—.
 * Con cuatro pasos de entrada y un invitado, esas puertas serian cinco
 * condiciones cruzadas dentro de una funcion que ademas monta pantallas: la
 * clase de escalera donde despues se cuela un caso que nadie previo.
 *
 * Es pura a proposito: recibe las preferencias, si hay sesion y la hora. No lee
 * localStorage ni la API, y por eso se puede probar entera.
 *
 * Los tres estados:
 *
 *   nueva     todavia esta en la entrada. Falta un paso.
 *   invitado  entro sin cuenta. Navega, pero nada se guarda.
 *   cuenta    entro con su cuenta. Puede todo.
 */

/**
 * Lo que la entrada guarda.
 *
 * Vive aca y no en store.js para que la funcion que decide y el almacenamiento
 * no puedan discrepar sobre como se llama cada cosa.
 *
 * `condicionesAceptadas` es una FECHA y no un booleano: el dia que cambien los
 * terminos, la fecha dice quien acepto cuales. Es un campo mas y evita una
 * migracion.
 */
export const PREFERENCIAS_DE_ENTRADA = {
  vioBienvenida: false,
  idioma: null,
  condicionesAceptadas: null,
  invitadoDesde: null,
  invitadoCamionId: null
};

/** Cuanto dura la prueba sin cuenta. Es un numero, no una verdad. */
export const DIAS_DE_PRUEBA = 1;

/** Los pasos de la entrada, en orden. */
const PASOS = ['bienvenida', 'idioma', 'condiciones', 'acceso'];

/**
 * Offset local.
 *
 * El mismo que usa el tope de votos de reportes en el servidor, para que "un
 * dia" signifique lo mismo en los dos lados de la app.
 */
const HORAS_LOCALES = -3;

/** El dia local de un instante, como numero comparable. */
function diaLocal(fecha) {
  return Math.floor((fecha.getTime() + HORAS_LOCALES * 3_600_000) / 86_400_000);
}

/**
 * Si el dia de prueba ya paso.
 *
 * Se mide en dias locales y no en horas corridas: quien empieza a las once de la
 * noche no tiene una prueba de una hora.
 *
 * Sin sello no hay invitado y no hay nada vencido. Una fecha que no se entiende
 * tampoco vence: una preferencia corrupta no puede convertirse en una puerta
 * cerrada.
 */
export function invitadoVencido(prefs, ahora) {
  if (!prefs?.invitadoDesde) return false;

  const desde = new Date(prefs.invitadoDesde);

  if (Number.isNaN(desde.getTime())) return false;

  return diaLocal(ahora) - diaLocal(desde) >= DIAS_DE_PRUEBA;
}

/**
 * El estado de la app.
 *
 * `pasoQueFalta` es lo unico que app.js necesita para decidir: si no es nulo,
 * monta la entrada en ese paso.
 */
export function estadoDeSesion(prefs = {}, haySesion = false, ahora = new Date()) {
  // La sesion manda sobre el sello del invitado, que queda en las preferencias:
  // quien se crea la cuenta despues de probar deja de ser invitado.
  if (haySesion) {
    return { tipo: 'cuenta', pasoQueFalta: null, invitadoVencido: false };
  }

  if (prefs.invitadoDesde) {
    return {
      tipo: 'invitado',
      pasoQueFalta: prefs.invitadoCamionId ? null : 'camion',
      invitadoVencido: invitadoVencido(prefs, ahora)
    };
  }

  // Quien ya habia aceptado las fuentes viene usando la app: ya leyo lo que
  // Condiciones enlaza, y hacerle dar la vuelta entera seria castigarlo por
  // haber estado antes.
  if (prefs.sourcesAccepted) {
    return { tipo: 'nueva', pasoQueFalta: 'acceso', invitadoVencido: false };
  }

  const hechos = {
    bienvenida: Boolean(prefs.vioBienvenida),
    idioma: Boolean(prefs.idioma),
    condiciones: Boolean(prefs.condicionesAceptadas),
    acceso: false
  };

  return {
    tipo: 'nueva',
    pasoQueFalta: PASOS.find((paso) => !hechos[paso]) ?? 'acceso',
    invitadoVencido: false
  };
}

/**
 * Que puede hacer un estado.
 *
 * El resto de la app consulta esto en vez de preguntar `isSignedIn()` por su
 * cuenta: el invitado es una sesion que en el servidor no existe, y una pantalla
 * que pregunta por la sesion no lo ve.
 *
 * La fila de emergencia no depende de nada. Nada de las cuentas ni de la
 * gamificacion puede estorbar un pedido de auxilio.
 */
export function permisos(estado) {
  const conCuenta = estado?.tipo === 'cuenta';
  const invitado = estado?.tipo === 'invitado';

  return {
    verMapa: conCuenta || invitado,
    navegar: conCuenta || (invitado && !estado.invitadoVencido),
    guardarViaje: conCuenta,
    reportar: conCuenta,
    guardarLugares: conCuenta,
    contactos: conCuenta,
    perfil: conCuenta,
    configuracion: conCuenta || invitado,
    emergencia: true
  };
}
