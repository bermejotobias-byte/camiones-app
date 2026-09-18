/**
 * La hoja de capas (el prototipo, tablero "Capas"). De Maps se toma solo
 * esta hoja: la grilla de cuadros de 52 con radio 12 y rotulo en 12,5, el
 * prendido con borde de 3 y rotulo del color; celestes sobre la hoja de
 * Waze. Dos secciones —los datos para el camion, que antes vivian en dos
 * botones flotantes, y las categorias de lugares— y el interruptor que ya
 * existia en la API: solo aptos para este camion, con cuantos oculta.
 *
 * Lo puro esta probado en tests/web/capas.test.mjs; navigate.js engancha
 * la hoja por data-accion y prende las capas en el mapa.
 */

import { calcomania, dibujo, pildora } from './piezas.js';
import { CATEGORIAS } from './buscar.js';
import { escapeHtml } from '../ui.js';

/** Las capas de datos para el camion, en el orden de la grilla. */
export const CAPAS_DEL_CAMION = [
  { id: 'red', calcomania: 'red', nombre: 'Red de Tránsito Pesado' },
  { id: 'galibo', calcomania: 'galiboOk', nombre: 'Gálibos' },
  { id: 'paso', calcomania: 'paso', nombre: 'Pasos a nivel', nota: 'sólo en viaje' },
  { id: 'radar', calcomania: 'radar', nombre: 'Radares' },
  { id: 'zona', calcomania: 'zona', nombre: 'Zonas peligrosas', nota: 'comunidad' }
];

/**
 * Que capas estan prendidas segun lo guardado.
 *
 * Todo arranca prendido salvo las zonas peligrosas: son un dato de la
 * comunidad, cubren area y no hacen falta para manejar. Lo que se guardo con
 * los dos botones viejos (`truckLayers`, `riskZones`) se respeta hasta que
 * se toque una capa por separado.
 */
export function capasActivas(prefs = {}) {
  const defecto = { red: true, galibo: true, paso: true, radar: true, zona: false };

  if (prefs.capas) return { ...defecto, ...prefs.capas };

  const camion = prefs.truckLayers ?? true;
  return { ...defecto, red: camion, galibo: camion, paso: camion, zona: prefs.riskZones ?? false };
}

/** Lo que dice el interruptor de "solo aptos". */
export function textoDeSoloAptos({ camion, ocultos }) {
  if (!camion) return { titulo: 'Sólo aptos para tu camión', sub: 'Elegí un camión para filtrar' };

  const titulo = `Sólo aptos para ${camion.name}`;

  if (ocultos === null || ocultos === undefined) return { titulo, sub: 'Lo que la fuente o la comunidad no confirman, no se muestra' };
  if (ocultos === 0) return { titulo, sub: 'No oculta ninguno de los que se ven' };
  return { titulo, sub: `Oculta ${ocultos} ${ocultos === 1 ? 'lugar' : 'lugares'} sin dato` };
}

const cuadro = (accion, id, calco, nombre, activo, nota = '') => `
  <button type="button" class="gps-cuadro${activo ? ' is-on' : ''}" data-accion="${accion}" data-id="${id}" aria-pressed="${activo}">
    <span class="gps-cuadro-ico">${calcomania(calco, 32)}</span>
    <span class="gps-cuadro-nombre">${escapeHtml(nombre)}</span>${nota ? `<small>${escapeHtml(nota)}</small>` : ''}
  </button>`;

/**
 * La hoja dibujada.
 *
 * @param {{capas: object, categorias: string[], soloAptos: boolean, camion: object|null, ocultos: number|null}} estado
 */
export function hojaCapas({ capas, categorias = [], soloAptos = false, camion = null, ocultos = null }) {
  const activas = new Set(categorias);
  const interruptor = textoDeSoloAptos({ camion, ocultos });

  return `
  <div class="gps-manija"></div>
  <div class="gps-capas-titulo">
    <b>Capas</b>
    <button type="button" class="gps-ficha-cerrar" data-accion="cerrar" aria-label="Cerrar">${dibujo('cerrar', 24, 2.4)}</button>
  </div>
  <p class="gps-capas-seccion">Para tu camión</p>
  <div class="gps-cuadros">
    ${CAPAS_DEL_CAMION.map((c) => cuadro('capa', c.id, c.calcomania, c.nombre, !!capas[c.id], c.nota)).join('')}
  </div>
  <p class="gps-capas-seccion">Lugares</p>
  <div class="gps-cuadros">
    ${CATEGORIAS.map((c) => cuadro('categoria', c.id, c.calcomania, c.nombre, activas.has(c.id))).join('')}
  </div>
  <button type="button" class="gps-interruptor" role="switch" data-accion="solo-aptos" aria-checked="${soloAptos}"${camion ? '' : ' disabled'}>
    <span class="gps-interruptor-texto"><b>${escapeHtml(interruptor.titulo)}</b><span>${escapeHtml(interruptor.sub)}</span></span>
    <i class="gps-interruptor-perilla${soloAptos ? ' is-on' : ''}"></i>
  </button>
  <div class="gps-acciones">
    ${pildora('Aportar un lugar', { icono: calcomania('lugarMas', 20), datos: 'data-accion="aportar"' })}
  </div>`;
}
