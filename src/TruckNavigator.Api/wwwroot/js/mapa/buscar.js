/**
 * La hoja de busqueda (waze-05, medida): la pildora de 52 con la flecha de
 * volver y lo que se escribe; los chips de categorias de 82 x 65; Casa y
 * Deposito; los recientes; y "Mas opciones", que trae lo que Waze no tiene:
 * el reparto y fijar un punto en el mapa.
 *
 * Sirve para cuatro busquedas distintas —el destino, el origen, donde queda la
 * Casa, donde queda el Deposito— y `seccionesDeBusqueda` decide que se ve en
 * cada caso. Es puro y esta probado en tests/web/buscar.test.mjs; el marcado
 * lo arma `hojaBuscar` y navigate.js lo engancha.
 */

import { calcomania, dibujo } from './piezas.js';
import { escapeHtml } from '../ui.js';

/**
 * Las categorias de lugares, en el orden de los chips. `categoria` es el
 * nombre del enum del servidor (PoiCategory); `calcomania` la del mapa.
 */
export const CATEGORIAS = [
  { id: 'gomeria', categoria: 'TyreShop', calcomania: 'gomeria', nombre: 'Gomerías' },
  { id: 'taller', categoria: 'RepairShop', calcomania: 'taller', nombre: 'Talleres' },
  { id: 'estacion', categoria: 'FuelStation', calcomania: 'estacion', nombre: 'Estaciones' },
  { id: 'comer', categoria: 'TruckFriendlyEatery', calcomania: 'comer', nombre: 'Comer' },
  { id: 'auxilio', categoria: 'HeavyRoadsideAssistance', calcomania: 'auxilio', nombre: 'Auxilio' },
  { id: 'playa', categoria: 'TruckParking', calcomania: 'playa', nombre: 'Playas' }
];

/** A partir de cuantas letras se le pregunta al geocoder (AD-10). */
export const LETRAS_PARA_BUSCAR = 3;

/** Que dice la pildora segun que se busca. */
export function tituloDeBusqueda(objetivo) {
  return {
    origin: '¿Desde dónde salís?',
    Home: '¿Dónde queda tu casa?',
    Depot: '¿Dónde queda el depósito?'
  }[objetivo] ?? '¿Adónde vas?';
}

/**
 * Las secciones que se muestran, en orden.
 *
 * Con tres letras escritas solo importan las sugerencias. Buscando la Casa,
 * el Deposito o el origen no tiene sentido ofrecer los atajos de ir a
 * algun lado: lo que se busca es un lugar, y ayudan los recientes y fijar en
 * el mapa.
 */
export function seccionesDeBusqueda({ texto = '', objetivo = 'destination', recientes = [] } = {}) {
  if ((texto ?? '').trim().length >= LETRAS_PARA_BUSCAR) return ['sugerencias'];

  const secciones = [];
  const buscaDestino = objetivo === 'destination';

  if (buscaDestino) secciones.push('categorias', 'lugares');
  if (recientes.length) secciones.push('recientes');
  secciones.push('mas');

  return secciones;
}

/* ---------------------------------------------------------------------------
   El marcado
--------------------------------------------------------------------------- */

const fila = ({ icono, titulo, sub, subClase = 'gris', datos }) => `
  <button type="button" class="gps-fila" ${datos}>
    <span class="gps-fila-ico">${icono}</span>
    <span class="gps-fila-texto"><b>${escapeHtml(titulo)}</b>${sub ? `<span class="${subClase}">${escapeHtml(sub)}</span>` : ''}</span>
  </button>`;

const filaLugar = (kind, nombre, lugar) => fila({
  icono: calcomania(kind === 'Home' ? 'casa' : 'deposito', 30),
  titulo: nombre,
  sub: lugar ? lugar.label : 'Establecer una vez e ir',
  subClase: lugar ? 'gris' : 'celeste',
  datos: `data-accion="${lugar ? 'ir-a-guardado' : 'fijar-guardado'}" data-kind="${kind}"`
});

const chipsMarkup = (activas) => `
  <div class="gps-chips">
    ${CATEGORIAS.map((c) => `
      <button type="button" class="gps-chip-cat${activas.includes(c.id) ? ' is-on' : ''}" data-accion="categoria" data-id="${c.id}">
        ${calcomania(c.calcomania, 20)}<span>${c.nombre}</span>
      </button>`).join('')}
  </div>`;

const sugerenciasMarkup = (sugerencias) => {
  if (sugerencias === null) return '<p class="gps-seccion">Buscando…</p>';
  if (sugerencias.length === 0) return '<p class="gps-seccion">No encontramos esa dirección.</p>';

  return sugerencias.map((lugar, i) => fila({
    icono: dibujo('lupa', 22),
    titulo: lugar.label,
    sub: lugar.secondary ?? '',
    datos: `data-accion="sugerencia" data-indice="${i}"`
  })).join('');
};

/**
 * El cuerpo de la hoja: las secciones que tocan, segun el estado. Va aparte
 * de la pildora porque se rehace en cada letra, y rehacer la pildora le
 * sacaria el foco al teclado.
 *
 * @param {object} estado
 *   texto, objetivo, categorias (ids activas), casa, deposito, recientes,
 *   sugerencias (null mientras se busca)
 */
export function cuerpoDeBusqueda(estado) {
  const { objetivo = 'destination', categorias = [], casa = null, deposito = null, recientes = [], sugerencias = null } = estado;
  const secciones = seccionesDeBusqueda(estado);
  const partes = [];

  for (const seccion of secciones) {
    if (seccion === 'sugerencias') partes.push(sugerenciasMarkup(sugerencias));

    if (seccion === 'categorias') partes.push(chipsMarkup(categorias));

    if (seccion === 'lugares') {
      partes.push(filaLugar('Home', 'Casa', casa), filaLugar('Depot', 'Depósito', deposito));
    }

    if (seccion === 'recientes') {
      partes.push('<p class="gps-seccion">Recientes</p>');
      partes.push(...recientes.map((lugar, i) => fila({
        icono: dibujo('reloj', 24),
        titulo: lugar.label,
        sub: '',
        datos: `data-accion="reciente" data-indice="${i}"`
      })));
    }

    if (seccion === 'mas') {
      partes.push('<p class="gps-seccion">Más opciones</p>');

      if (objetivo === 'destination') {
        partes.push(fila({
          icono: dibujo('paradas', 24),
          titulo: 'Modo reparto',
          sub: 'Hasta 10 paradas. El orden lo resolvemos nosotros',
          datos: 'data-accion="reparto"'
        }));
      }

      partes.push(fila({
        icono: dibujo('mano', 24),
        titulo: 'Fijar en el mapa',
        sub: 'Mantené apretado un punto',
        datos: 'data-accion="fijar-en-mapa"'
      }));
    }
  }

  return partes.join('');
}

/**
 * La hoja entera: la pildora con la flecha de volver, "Desde" cuando se busca
 * el destino, y el cuerpo. `origen` es la etiqueta del origen actual.
 */
export function hojaBuscar(estado) {
  const { texto = '', objetivo = 'destination', origen = null } = estado;

  const desde = objetivo === 'destination'
    ? `<button type="button" class="gps-desde" data-accion="origen">${dibujo('ubicacion', 18)}<span>Desde</span><b>${escapeHtml(origen ?? 'Tu ubicación')}</b>${dibujo('abajo', 16)}</button>`
    : '';

  return `
    <div class="gps-buscar-pildora">
      <button type="button" class="gps-buscar-volver" data-accion="volver" aria-label="Volver">${dibujo('atras', 22)}</button>
      <input id="gps-buscar-texto" type="search" autocomplete="off" enterkeyhint="search"
             placeholder="${tituloDeBusqueda(objetivo)}" value="${escapeHtml(texto)}">
      <button type="button" class="gps-buscar-borrar" data-accion="borrar" aria-label="Borrar" ${texto ? '' : 'hidden'}>${dibujo('cerrar', 18)}</button>
    </div>
    ${desde}
    <div class="gps-buscar-cuerpo">${cuerpoDeBusqueda(estado)}</div>`;
}
