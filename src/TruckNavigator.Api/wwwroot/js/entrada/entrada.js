/**
 * La entrada: Bienvenida -> Idioma -> Condiciones -> Acceso.
 *
 * Es la sucesion que pide el brainstorm v3 §6. Este modulo ORQUESTA: no dibuja
 * ninguna de las cuatro pantallas —cada una tiene su archivo— y no decide quien
 * entra, que es de sesion.js. Es el mismo reparto que rige en el mapa (AD-48):
 * un modulo por superficie, y el que engancha no calcula.
 *
 * La INTRO del v3 §6 no existe como pantalla aparte: la Bienvenida ya es la
 * identidad visual, y un splash en una app web es tiempo que el camionero espera
 * sin recibir nada.
 */

export const PASOS_DE_LA_ENTRADA = ['bienvenida', 'idioma', 'condiciones', 'acceso'];

/**
 * El chip del encabezado, o nulo donde el prototipo no lo pone.
 *
 * La Bienvenida y el Acceso son pantallas enteras y no los pasos de un tramite,
 * asi que no llevan. El camion del invitado tampoco: el tablero fija
 * "Paso 2 de 4" y numerarlo como quinto lo contradiria.
 */
export function chipDePaso(paso) {
  const indice = PASOS_DE_LA_ENTRADA.indexOf(paso);

  if (indice < 1 || paso === 'acceso') return null;

  return { etiqueta: 'Paso', valor: `${indice + 1} de ${PASOS_DE_LA_ENTRADA.length}` };
}

/** Que paso sigue. Nulo cuando ya no sigue ninguno y la entrada termino. */
export function pasoSiguiente(paso) {
  const indice = PASOS_DE_LA_ENTRADA.indexOf(paso);

  if (indice < 0 || indice === PASOS_DE_LA_ENTRADA.length - 1) return null;

  return PASOS_DE_LA_ENTRADA[indice + 1];
}
