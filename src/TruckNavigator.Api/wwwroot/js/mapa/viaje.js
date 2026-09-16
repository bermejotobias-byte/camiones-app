/**
 * La pantalla del viaje: lo que se ve mientras el camion anda.
 *
 * Cinco piezas, cada una en su lugar, con las medidas de waze-06 (ver
 * docs/superpowers/specs/2026-09-16-gps-waze-design.md, seccion 2):
 *
 *   · la BANDA negra de arriba, con la flecha de la maniobra, la distancia en
 *     27 sp y la calle que viene en 24 sp celeste; compacta, de 57, cuando
 *     hay una hoja abierta encima del mapa;
 *   · el COSTADO derecho: sonido y S.O.S., circulos de 52;
 *   · la pildora negra con la CALLE ACTUAL, 18 sp negrita, a 155 del borde;
 *   · el boton amarillo de APORTAR, de 63, donde Waze pone reportar;
 *   · la HOJA de abajo, de 137: salir, la hora de llegada en 25 sp con el
 *     resto en 20, y la vista general.
 *
 * Este modulo dibuja y actualiza; no sabe de GPS ni de rutas. Quien lo monta
 * le dice que mostrar y que hacer cuando se toca algo. Las piezas se
 * actualizan en su lugar, sin rehacer el marcado: rehacerlo en cada latido
 * del GPS tira el trabajo del navegador una vez por segundo.
 *
 * Lo que decide QUE se muestra —`estadoDeBanda`, `resumenRestante`— es puro
 * y esta probado en tests/web/viaje.test.mjs.
 */

import { iconoDeManiobra, calcomania, circulo, dibujo } from './piezas.js';
import { formatDistance, formatDuration, arrivalTime } from '../ui.js';

/* ---------------------------------------------------------------------------
   Que dice la banda
--------------------------------------------------------------------------- */

/**
 * El estado de la banda a partir del estado del viaje.
 *
 * Tres estados, en este orden de prioridad:
 *   recalculando  →  se salio de la ruta y se esta buscando otra;
 *   buscando      →  el viaje arranco y todavia no llego ninguna posicion
 *                    (o el GPS fallo: entonces se dice eso);
 *   maniobra      →  lo que viene: flecha, distancia y calle.
 *
 * Un `nav` presente gana a la bandera de espera: en el latido en que llega la
 * primera posicion las dos cosas son ciertas a la vez, y lo que importa es
 * que ya se puede guiar.
 */
export function estadoDeBanda({ recalculando = false, esperandoGps = false, problema = null, nav = null }) {
  if (recalculando) return { tipo: 'recalculando' };

  if (esperandoGps && !nav) {
    return problema
      ? { tipo: 'buscando', titulo: problema, sub: 'El viaje quedó abierto: podés cerrarlo desde Salir.' }
      : { tipo: 'buscando', titulo: 'Buscando señal de GPS…', sub: 'Bajo techo puede tardar. Al aire libre engancha enseguida.' };
  }

  const proxima = nav?.next ?? null;

  return {
    tipo: 'maniobra',
    kind: proxima?.kind ?? 'Continue',
    distancia: nav ? formatDistance(nav.distanceToManeuver) : '—',
    calle: proxima ? (proxima.streetName || proxima.text) : 'Seguí la ruta'
  };
}

/** "39 min • 32 km", como en la hoja de waze-06. */
export function resumenRestante(segundos, metros) {
  return `${formatDuration(segundos)} • ${formatDistance(metros)}`;
}

/* ---------------------------------------------------------------------------
   El marcado
--------------------------------------------------------------------------- */

const bandaMarkup = () => `
  <div class="gps-banda" id="gps-banda">
    <div class="gps-banda-flecha"></div>
    <div class="gps-banda-texto">
      <b class="gps-banda-distancia"></b>
      <span class="gps-banda-calle"></span>
    </div>
  </div>`;

const costadoMarkup = (vozApagada) => `
  <div class="gps-costado">
    ${circulo(dibujo(vozApagada ? 'sonidoApagado' : 'sonido', 26), { clase: 'negro', id: 'gps-voz', etiqueta: vozApagada ? 'Activar la voz' : 'Silenciar la voz' })}
    ${circulo('SOS', { clase: 'sos', id: 'gps-sos', etiqueta: 'Emergencia' })}
  </div>`;

const hojaMarkup = () => `
  <div class="gps-hoja-viaje" id="gps-hoja">
    <div class="gps-manija"></div>
    <div class="gps-hoja-viaje-fila">
      ${circulo(dibujo('cerrar', 24), { clase: 'chico', id: 'stop-nav', etiqueta: 'Salir del viaje' })}
      <div class="gps-eta"><b id="gps-hora"></b><span id="gps-restante"></span></div>
      ${circulo(dibujo('rutas', 24), { clase: 'chico', id: 'gps-general', etiqueta: 'Vista general' })}
    </div>
  </div>`;

/**
 * Monta la pantalla del viaje sobre `host` y devuelve como actualizarla.
 *
 * @param {HTMLElement} host   la pantalla del mapa
 * @param {object} acciones    que hacer al tocar: alSalir, alVistaGeneral, alAportar, alSos, alVoz
 * @param {boolean} vozApagada si la voz arranca silenciada
 */
export function montarViaje(host, { alSalir, alVistaGeneral, alAportar, alSos, alVoz, vozApagada = false } = {}) {
  const capa = document.createElement('div');
  capa.className = 'gps-viaje';
  capa.innerHTML = `
    ${bandaMarkup()}
    ${costadoMarkup(vozApagada)}
    <div class="gps-calle" id="gps-calle" hidden></div>
    <button type="button" class="gps-aportar" id="gps-aportar" aria-label="Aportar un lugar">${calcomania('lugarMas', 36)}</button>
    ${hojaMarkup()}`;

  host.appendChild(capa);

  const q = (selector) => capa.querySelector(selector);
  const tocar = (selector, accion) => {
    const nodo = q(selector);
    if (nodo && accion) nodo.addEventListener('click', accion);
  };

  tocar('#stop-nav', alSalir);
  tocar('#gps-general', alVistaGeneral);
  tocar('#gps-aportar', alAportar);
  tocar('#gps-sos', alSos);
  tocar('#gps-voz', alVoz);

  const poner = (selector, texto) => {
    const nodo = q(selector);
    if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
  };

  // La banda se rehace solo cuando cambia de forma (de "buscando" a maniobra,
  // o de una maniobra a otra); la distancia se toca en su lugar.
  let formaDeBanda = null;

  return {
    /** Pinta la banda segun el estado que devuelve `estadoDeBanda`. */
    banda(estado) {
      const banda = q('#gps-banda');
      const forma = estado.tipo === 'maniobra' ? `maniobra:${estado.kind}` : estado.tipo;

      if (forma !== formaDeBanda) {
        formaDeBanda = forma;
        banda.classList.toggle('esperando', estado.tipo !== 'maniobra');

        if (estado.tipo === 'maniobra') {
          q('.gps-banda-flecha').innerHTML = iconoDeManiobra(estado.kind, 40);
        } else {
          q('.gps-banda-flecha').innerHTML = '<span class="spinner"></span>';
        }
      }

      if (estado.tipo === 'maniobra') {
        poner('.gps-banda-distancia', estado.distancia);
        poner('.gps-banda-calle', estado.calle);
      } else if (estado.tipo === 'recalculando') {
        poner('.gps-banda-distancia', 'Recalculando…');
        poner('.gps-banda-calle', 'Te saliste de la ruta. Buscando otra.');
      } else {
        poner('.gps-banda-distancia', estado.titulo);
        poner('.gps-banda-calle', estado.sub);
      }
    },

    /** La hora de llegada y lo que falta. Sin cifras, guiones. */
    hoja({ segundos = null, metros = null } = {}) {
      poner('#gps-hora', segundos === null ? '—' : arrivalTime(segundos));
      poner('#gps-restante', resumenRestante(segundos, metros));
    },

    /** La calle por la que se va. Sin nombre, la pildora se esconde. */
    calle(nombre) {
      const pildora = q('#gps-calle');
      const texto = (nombre ?? '').trim();
      pildora.hidden = !texto;
      poner('#gps-calle', texto);
    },

    /** Banda compacta mientras hay una hoja abierta sobre el mapa. */
    compacta(si) {
      q('#gps-banda').classList.toggle('compacta', Boolean(si));
    },

    /** El dibujo del boton de sonido segun si la voz esta silenciada. */
    voz(apagada) {
      const boton = q('#gps-voz');
      if (!boton) return;
      boton.innerHTML = dibujo(apagada ? 'sonidoApagado' : 'sonido', 26);
      boton.setAttribute('aria-label', apagada ? 'Activar la voz' : 'Silenciar la voz');
      boton.classList.toggle('apagado', Boolean(apagada));
    },

    /** Saca la pantalla del viaje. */
    destruir() {
      capa.remove();
    },

    /** Por si hace falta mirar adentro (tests, depuracion). */
    get elemento() { return capa; }
  };
}

