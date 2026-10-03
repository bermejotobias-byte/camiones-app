/**
 * La Red de Transito Pesado como dibujo (AD-53, spec 2026-10-03-la-red-primero).
 *
 * La Red es la via que manda en el mapa: siempre visible, la mas ancha y la mas
 * clara. Se pinta como un tubo de cromo —el metal se lee por la curva del
 * brillo, no por el color—: cuatro capas de la misma fuente, de abajo hacia
 * arriba un canto oscuro, el cuerpo, una banda clara y un especular angosto en
 * el centro, que destella despacio.
 *
 * Todo lo de aca es puro y esta probado en tests/web/red.test.mjs; layers.js lo
 * instala en el mapa.
 */

import { ancho, PARADAS } from './estilo-mapa.js';

/** Cuanto del brillo se ve cuando no destella (y el punto medio del destello). */
export const BRILLO_REPOSO = 0.75;

/** Cuanto del color del reflejo se ve sobre el cuerpo. */
const REFLEJO = 0.55;

/**
 * Mezcla dos colores `#rrggbb`: con `t` en 0 da `a`, en 1 da `b`.
 *
 * El reflejo y el brillo van con el color ya mezclado y NO con opacidad: la Red
 * son 2.426 tramos con puntas redondas, y donde dos se tocan la opacidad se
 * suma — cada union salia como un punto mas claro, un collar sobre la Red.
 */
export function mezclar(a, b, t) {
  const canal = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * t).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * El color del brillo con una intensidad dada: el especular sobre el reflejo
 * que tiene abajo. Lo usa tambien el destello, que cambia este color.
 *
 * @param {{cuerpo: string, reflejo: string, brillo: string}} c
 * @param {number} intensidad de 0 a 1
 */
export function colorDelBrillo(c, intensidad) {
  return mezclar(mezclar(c.cuerpo, c.reflejo, REFLEJO), c.brillo, intensidad);
}

const linea = (id, color, width, extra = {}) => ({
  id,
  type: 'line',
  source: 'red',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': color, 'line-width': width, ...extra }
});

/**
 * Las cuatro capas del cromo, en el orden en que se apilan.
 *
 * El brillo va CENTRADO, sin line-offset: los tramos de OSM y las dos manos de
 * una avenida van en sentidos distintos, y un especular corrido saltaria de un
 * borde al otro de tramo en tramo.
 *
 * @param {{canto: string, cuerpo: string, reflejo: string, brillo: string}} c
 */
export function lineasDeLaRed(c) {
  return [
    linea('red-canto', c.canto, ancho(PARADAS.red, { mas: 3 })),
    linea('red-linea', c.cuerpo, ancho(PARADAS.red)),
    linea('red-reflejo', mezclar(c.cuerpo, c.reflejo, REFLEJO), ancho(PARADAS.red, { por: 0.55 })),
    linea('red-brillo', colorDelBrillo(c, BRILLO_REPOSO), ancho(PARADAS.red, { por: 0.18 }))
  ];
}

/**
 * El nombre de la avenida, en mayusculas y negrita sobre el tubo.
 *
 * @param {{rotulo: string, halo: string}} c
 */
export function nombreDeLaRed(c) {
  return {
    id: 'red-nombre',
    type: 'symbol',
    source: 'red',
    // Sin nombre no hay nada que mostrar, y la linea ya la dibujan las de arriba.
    filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], null]],
    minzoom: 13,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.1,
      // Siempre un escalon arriba de los nombres de calle (estilo-mapa.js), y
      // creciendo hasta el zoom 19 (AD-53).
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 15, 11.5, 16, 13, 18, 16, 19, 18],
      'text-font': ['NotoSans-Bold'],
      // Se repite a lo largo de la avenida: sirve de referencia en cualquier
      // punto, no solo donde arranca el tramo.
      'symbol-spacing': 320,
      'text-max-angle': 35,
      'text-allow-overlap': false,
      'text-padding': 6
    },
    paint: {
      'text-color': c.rotulo,
      'text-halo-color': c.halo,
      // Mas ancho que el de una calle: el nombre va encima del tubo claro.
      'text-halo-width': 2
    }
  };
}

/**
 * Los nombres de las calles de la Red, sin repetir, para que el mapa base no
 * los dibuje una segunda vez (`filtroCallesNombre`).
 *
 * @param {{features: {properties: {name?: string|null}}[]}|null} geojson
 */
export function nombresDeLaRed(geojson) {
  const nombres = new Set();
  for (const f of geojson?.features ?? []) {
    const nombre = f.properties?.name;
    if (nombre) nombres.add(nombre);
  }
  return [...nombres].sort();
}

/**
 * Antes de que capa se apilan las lineas de la Red.
 *
 * Siempre DEBAJO de la ruta: la ruta manda. El orden no puede depender de quien
 * se instalo primero, porque createMap reinstala las capas en cada 'style.load'
 * y una Red reinstalada con la ruta ya dibujada quedaria encima. Sin ruta, debajo
 * de los nombres de calle; en el raster de respaldo no hay ninguna de las dos y
 * va arriba de todo, que es lo unico posible.
 *
 * @param {(id: string) => boolean} existe
 */
export function anclaDeLaRed(existe) {
  return ['route-casing', 'calles-nombre'].find((id) => existe(id));
}
