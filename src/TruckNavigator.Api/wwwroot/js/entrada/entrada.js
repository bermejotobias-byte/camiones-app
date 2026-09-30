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

import { savePrefs } from '../store.js';
import { bienvenidaView } from './bienvenida.js';
import { idiomaView } from './idioma.js';
import { condicionesView } from './condiciones.js';
import { accesoView } from './acceso.js';
import { camionInvitadoView } from './camion.js';

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

/**
 * Monta el paso que falta.
 *
 * `onListo` recibe el paso que sigue, o null cuando la entrada termino y hay que
 * arrancar la app. Cada pantalla guarda lo suyo ANTES de avisar: si la app se
 * cierra en el medio, se retoma donde iba y no desde el principio.
 */
export function entradaView(host, { paso, onListo, verFuentes, crearCuenta }) {
  if (paso === 'bienvenida') {
    return bienvenidaView(host, {
      onEmpezar: () => {
        savePrefs({ vioBienvenida: true });
        onListo(pasoSiguiente('bienvenida'));
      },

      // Quien ya tiene cuenta acepto las condiciones la primera vez: pedirselas
      // de nuevo es tratarlo como nuevo.
      onYaTengoCuenta: () => {
        savePrefs({ vioBienvenida: true });
        onListo('acceso');
      }
    });
  }

  if (paso === 'idioma') {
    return idiomaView(host, {
      chip: chipDePaso('idioma'),
      onContinuar: (idioma) => {
        savePrefs({ idioma });
        onListo(pasoSiguiente('idioma'));
      }
    });
  }

  if (paso === 'condiciones') {
    return condicionesView(host, {
      chip: chipDePaso('condiciones'),
      onAcepto: () => {
        // La FECHA, no un booleano: el dia que cambien los terminos, dice quien
        // acepto cuales.
        savePrefs({ condicionesAceptadas: new Date().toISOString() });
        onListo(pasoSiguiente('condiciones'));
      },
      onVerFuentes: () => verFuentes?.()
    });
  }

  if (paso === 'acceso') {
    return accesoView(host, {
      onEntro: () => onListo(null),
      onCrearCuenta: () => crearCuenta?.(),

      // Elegir el camion es lo primero que ve el invitado: es el dato que
      // decide por donde puede pasar, y sin el el ruteo trabajaria con medidas
      // de auto.
      onInvitado: () => onListo('camion')
    });
  }

  if (paso === 'camion') {
    return camionInvitadoView(host, {
      onElegido: (id) => {
        savePrefs({ invitadoCamionId: id });
        onListo(null);
      }
    });
  }

  // No deberia llegar nunca: los pasos los elige estadoDeSesion y son estos.
  // Queda dicho en voz alta para que, si alguien cae, sepa por que en vez de
  // ver una pantalla en blanco.
  console.warn(`entrada: no se que es el paso "${paso}"`);

  return null;
}
