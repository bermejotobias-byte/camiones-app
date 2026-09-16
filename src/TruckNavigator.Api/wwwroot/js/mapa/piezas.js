/**
 * Las piezas compartidas del GPS: la flecha de maniobra de la banda, las
 * calcomanias, y los pedazos de interfaz que se repiten en varias hojas
 * (pildoras, circulos, chips).
 *
 * Todo devuelve cadenas de marcado, sin tocar el documento: asi se prueba
 * con node y lo usa cualquier hoja. Las medidas salen del prototipo
 * (docs/diseno/prototipo-gps/gps.mjs), medidas sobre las capturas de Waze.
 *
 * Sin dependencias del resto de la app a proposito: es un modulo hoja.
 */

const escapar = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------------------------------------------------------------------------
   La flecha de la banda

   Medida en waze-06: 40 x 46, trazo de 5,5, puntas y uniones redondas, blanca
   sobre negro. Una por cada ManeuverKind del servidor. Se dibujan en una caja
   de 44 x 50 con la punta arriba y el tronco abajo.
--------------------------------------------------------------------------- */

const TRAZO = 'fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"';

/** Los trazos de cada maniobra, como paths dentro de la caja de 44 x 50. */
export const MANIOBRAS = {
  Continue: `<path d="M22 46V8" ${TRAZO}/><path d="M12 18L22 8l10 10" ${TRAZO}/>`,
  SlightLeft: `<path d="M26 46V22L14 10" ${TRAZO}/><path d="M13 22V9h13" ${TRAZO}/>`,
  Left: `<path d="M37 48V24a9 9 0 0 0-9-9H10" ${TRAZO}/><path d="M18 6L8 15l10 9" ${TRAZO}/>`,
  SharpLeft: `<path d="M30 46V14a6 6 0 0 0-6-6H20l-9 9" ${TRAZO}/><path d="M11 6v11h11" ${TRAZO}/>`,
  SlightRight: `<path d="M18 46V22l12-12" ${TRAZO}/><path d="M31 22V9H18" ${TRAZO}/>`,
  Right: `<path d="M7 48V24a9 9 0 0 1 9-9h18" ${TRAZO}/><path d="M26 6l10 9-10 9" ${TRAZO}/>`,
  SharpRight: `<path d="M14 46V14a6 6 0 0 1 6-6h4l9 9" ${TRAZO}/><path d="M33 6v11H22" ${TRAZO}/>`,
  KeepLeft: `<path d="M28 46V26l-9-9V8" ${TRAZO}/><path d="M11 16l8-8 8 8" ${TRAZO}/><path d="M28 46V30" ${TRAZO} opacity=".35"/>`,
  KeepRight: `<path d="M16 46V26l9-9V8" ${TRAZO}/><path d="M17 16l8-8 8 8" ${TRAZO}/><path d="M16 46V30" ${TRAZO} opacity=".35"/>`,
  UTurn: `<path d="M12 46V18a10 10 0 0 1 20 0v12" ${TRAZO}/><path d="M23 22l9 9 9-9" ${TRAZO}/>`,
  Roundabout: `<path d="M22 46V34" ${TRAZO}/><circle cx="22" cy="22" r="10" ${TRAZO}/><path d="M22 4v8" ${TRAZO}/><path d="M14 11l8-7 8 7" ${TRAZO}/>`,
  Waypoint: `<circle cx="22" cy="24" r="11" ${TRAZO}/><circle cx="22" cy="24" r="3.5" fill="currentColor"/>`,
  Finish: `<path d="M12 46V6" ${TRAZO}/><path d="M12 8h22l-4 7 4 7H12z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`
};

/**
 * La flecha de una maniobra, como SVG. Lo que no se conoce va derecho: es
 * mejor una flecha recta que una caja vacia en la banda.
 *
 * @param {string} kind  el ManeuverKind del servidor
 * @param {number} t     ancho en px (40 en la banda); el alto sale de la caja 44 x 50
 */
export function iconoDeManiobra(kind, t = 40) {
  const trazos = MANIOBRAS[kind] ?? MANIOBRAS.Continue;
  const alto = Math.round((t * 50) / 44);
  return `<svg viewBox="0 0 44 50" width="${t}" height="${alto}" aria-hidden="true">${trazos}</svg>`;
}

/* ---------------------------------------------------------------------------
   Calcomanias

   Relleno saturado con contorno blanco, como los pines y los botones de
   reporte de Waze; `paint-order` pone el contorno por fuera. Son dibujos
   propios: no se copia ninguna ilustracion de Waze.
--------------------------------------------------------------------------- */

const BORDE = 'stroke="#fff" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"';
const ROJO = '#e9463f';
const CELESTE = '#32ccfe';
const AMARILLO = '#ffc302';

export const CALCOMANIAS = {
  gomeria: `<circle cx="16" cy="16" r="11.5" fill="#55636f" ${BORDE}/><circle cx="16" cy="16" r="6" fill="#d7dfe6"/><circle cx="16" cy="16" r="2.4" fill="#55636f"/>`,
  taller: `<path d="M20 4a7 7 0 0 0-6.6 9.4L4 22.8 8.2 27l9.4-9.4A7 7 0 0 0 27 11l-4.4 2-3.2-3.2 2-4.4A7 7 0 0 0 20 4z" fill="#f28c28" ${BORDE}/>`,
  estacion: `<path d="M6 5h12v22H6z" fill="#35b26b" ${BORDE}/><path d="M9 8h6v6H9z" fill="#dff5e8"/><path d="M19 11h2.5l4 4v8a2.5 2.5 0 0 1-5 0v-7h-1.5" fill="none" stroke="#35b26b" stroke-width="2.6" stroke-linejoin="round"/>`,
  comer: `<path d="M9 4v9a3 3 0 0 0 3 3v12h2V16a3 3 0 0 0 3-3V4h-2v8h-1V4h-2v8h-1V4zM21 4c-2.5 0-4 3-4 7v6h2v11h2V4z" fill="#e85d6b" ${BORDE}/>`,
  auxilio: `<path d="M4 20h4l3-6h9l4 6h4v4H4z" fill="#f5c400" ${BORDE}/><circle cx="9" cy="24" r="3" fill="#2b3035" stroke="#fff" stroke-width="1.8"/><circle cx="23" cy="24" r="3" fill="#2b3035" stroke="#fff" stroke-width="1.8"/><path d="M20 14V8l6-3" fill="none" stroke="#f5c400" stroke-width="2.6" stroke-linecap="round" paint-order="stroke"/>`,
  playa: `<rect x="5" y="5" width="22" height="22" rx="5" fill="#4b7bec" ${BORDE}/><path d="M12 23V9h5.5a4 4 0 0 1 0 8H12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  red: `<path d="M4 26L12 6h8l8 20h-6l-1.5-5h-9L10 26z" fill="#6d89a8" ${BORDE}/><path d="M16 9v3M16 15v3M16 21v3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  galibo: `<path d="M3 27V12a13 13 0 0 1 26 0v15h-6V14a7 7 0 0 0-14 0v13z" fill="${ROJO}" ${BORDE}/>`,
  galiboOk: `<path d="M3 27V12a13 13 0 0 1 26 0v15h-6V14a7 7 0 0 0-14 0v13z" fill="#6b7c8c" ${BORDE}/>`,
  paso: `<path d="M16 3l3 3-3 3-3-3z" fill="${ROJO}" ${BORDE}/><path d="M6 8h20l-10 10zM6 28l10-10 10 10z" fill="${ROJO}" ${BORDE}/><rect x="14" y="8" width="4" height="20" fill="#7c8794" ${BORDE}/>`,
  radar: `<rect x="4" y="7" width="24" height="18" rx="4" fill="#4f6d8e" ${BORDE}/><circle cx="16" cy="16" r="5.5" fill="#1b2632"/><circle cx="16" cy="16" r="2.4" fill="#8fdcf7"/><circle cx="24" cy="11" r="1.6" fill="#f9c531"/>`,
  zona: `<path d="M16 4L30 28H2z" fill="${ROJO}" ${BORDE}/><path d="M16 12v7M16 22.5v.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  casa: `<path d="M4 15L16 5l12 10v13H4z" fill="#f28c28" ${BORDE}/><path d="M13 28v-8h6v8" fill="#fff"/>`,
  deposito: `<path d="M4 12l12-6 12 6v16H4z" fill="#8a6a4a" ${BORDE}/><path d="M9 28v-9h14v9M9 23h14" fill="none" stroke="#fff" stroke-width="2"/>`,
  lugar: `<path d="M16 3a9 9 0 0 1 9 9c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 9-9z" fill="#8b5cf6" ${BORDE}/><circle cx="16" cy="12" r="3.5" fill="#fff"/>`,
  lugarMas: `<path d="M16 3a9 9 0 0 1 9 9c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 9-9z" fill="${AMARILLO}" ${BORDE}/><path d="M16 8v8M12 12h8" stroke="#2b1405" stroke-width="2.8" stroke-linecap="round"/>`,
  aviso: `<path d="M16 4L30 28H2z" fill="${AMARILLO}" ${BORDE}/><path d="M16 12v7M16 22.5v.5" stroke="#2b1405" stroke-width="3" stroke-linecap="round"/>`,
  bandera: `<path d="M8 3v26" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M8 4h16l-3 5 3 5H8z" fill="#fff" stroke="#fff" stroke-width="1.5"/><path d="M8 4h4v3.5H8zM16 4h4v3.5h-4zM12 7.5h4V11h-4zM20 7.5h4V11h-4zM8 11h4v3H8zM16 11h4v3h-4z" fill="#111"/>`,
  comunidad: `<circle cx="11" cy="11" r="5" fill="${CELESTE}" ${BORDE}/><circle cx="22" cy="12" r="4" fill="${CELESTE}" ${BORDE}/><path d="M3 27c0-6 4-9 8-9s8 3 8 9zM17 26c.5-4 2.5-6.5 5-6.5s6 2.5 6 6.5z" fill="${CELESTE}" ${BORDE}/>`
};

/** Una calcomania de `t` px. Si no existe, nada: mejor un hueco que un dibujo equivocado. */
export function calcomania(nombre, t = 28) {
  const inner = CALCOMANIAS[nombre];
  if (!inner) return '';
  return `<svg viewBox="0 0 32 32" width="${t}" height="${t}" style="overflow:visible" aria-hidden="true">${inner}</svg>`;
}

/* ---------------------------------------------------------------------------
   Dibujos de interfaz

   Trazos de 2,4 en el color del texto, en una caja de 24: la cruz de la
   hoja, las rutas, el sonido, la lupa. Distintos de las calcomanias, que
   llevan relleno y contorno: estos son controles, no cosas del mapa.
--------------------------------------------------------------------------- */

export const ICONOS = {
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  ubicacion: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  capas: '<path d="M12 4l8 4.5-8 4.5-8-4.5z"/><path d="M4 13l8 4.5 8-4.5"/><path d="M19 17.5v3M17.5 19h3"/>',
  centrar: '<circle cx="12" cy="12" r="2.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/><path d="M12 3l-2.2 2.6M12 3l2.2 2.6M12 21l-2.2-2.6M12 21l2.2-2.6M3 12l2.6-2.2M3 12l2.6 2.2M21 12l-2.6-2.2M21 12l-2.6 2.2"/>',
  rutas: '<path d="M12 21v-8M12 13l-5-5V4M12 13l5-5V4"/><circle cx="7" cy="4" r="1.6"/><circle cx="17" cy="4" r="1.6"/><circle cx="12" cy="21" r="1.6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sonido: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  sonidoApagado: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  paradas: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="8" cy="18" r="2.2"/><path d="M8 6h6a3 3 0 0 1 0 6h-3a3 3 0 0 0 0 6"/>',
  mano: '<path d="M9 12V5a1.5 1.5 0 0 1 3 0v6M12 10V4a1.5 1.5 0 0 1 3 0v7M15 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S6 18 6 14v-3a1.5 1.5 0 0 1 3 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camion: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  telefono: '<path d="M6 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 6a2 2 0 0 1 2-2z"/>'
};

/** Un dibujo de interfaz de `t` px, en el color del texto. Desconocido: nada. */
export function dibujo(nombre, t = 24, grosor = 2.4) {
  const trazos = ICONOS[nombre];
  if (!trazos) return '';
  return `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazos}</svg>`;
}

/* ---------------------------------------------------------------------------
   Pildoras, circulos y chips
--------------------------------------------------------------------------- */

/**
 * Una pildora de accion: 48 dp, texto en 16 sp negrita. `celeste` es la
 * accion principal (texto oscuro sobre celeste); sin clase, la gris con texto
 * celeste. El texto viene de afuera y se escapa.
 */
export function pildora(texto, { clase = '', id = '', icono = '' } = {}) {
  return `<button type="button" class="gps-pildora ${clase}"${id ? ` id="${id}"` : ''}>${icono}<span>${escapar(texto)}</span></button>`;
}

/** Un boton redondo de 52 dp (Waze) con un dibujo adentro. */
export function circulo(dibujo, { clase = '', id = '', etiqueta = '' } = {}) {
  return `<button type="button" class="gps-circulo ${clase}"${id ? ` id="${id}"` : ''}${etiqueta ? ` aria-label="${escapar(etiqueta)}"` : ''}>${dibujo}</button>`;
}

/** Un chip de 25 dp con un punto de color y un texto de 14 sp. */
export function chip(color, texto) {
  return `<span class="gps-chip"><i style="background:${color}"></i>${escapar(texto)}</span>`;
}
