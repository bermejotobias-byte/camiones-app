/**
 * La capa de lugares: los puntos de interes sobre el mapa como pines de 32
 * (el prototipo, tableros "Capas" y "Lugar"). Disco oscuro con un anillo de
 * 3 que dice de donde sale el dato —blanco lo verificado, celeste lo de la
 * comunidad con el contador de votos, gris lo que nadie confirmo— y la
 * calcomania de la categoria adentro. Lo comunitario no se ve igual que lo
 * verificado (AD-46), tampoco en el pin.
 *
 * Lo puro —que pin le toca a cada lugar, como viaja al mapa, como se pide—
 * esta probado en tests/web/lugares.test.mjs. Lo de MapLibre va abajo:
 * `instalarLugares` deja la fuente y la capa listas y `mostrarLugares` las
 * llena; los pines se dibujan a pedido cuando el mapa los reclama
 * (`styleimagemissing`), asi que no hay que registrar 6 x 3 imagenes de
 * antemano. Como los otros iconos del mapa, van con colores fijos.
 */

import { CALCOMANIAS } from './piezas.js';
import { CATEGORIAS } from './buscar.js';

/* ---------------------------------------------------------------------------
   Que pin le toca a cada lugar
--------------------------------------------------------------------------- */

const ANILLO = { verificado: '#ffffff', comunidad: '#32ccfe', sin: '#8b949e' };

const votos = (poi) => (poi.community?.suitable ?? 0) + (poi.community?.notSuitable ?? 0);

/**
 * 'verificado' si la fuente lo confirma; 'comunidad' si lo aporto alguien o
 * si hay votos; 'sin' cuando nadie dijo nada todavia. Lo verificado manda:
 * los votos nunca tocan lo verificado.
 */
export function estadoDelPin(poi) {
  if (poi.verificationLevel === 'Verified') return 'verificado';
  if (poi.community?.contributed || votos(poi) > 0) return 'comunidad';
  return 'sin';
}

/** El total de votos, solo en los pines de la comunidad; null si no va contador. */
export function contadorDelPin(poi) {
  if (estadoDelPin(poi) !== 'comunidad') return null;
  const total = votos(poi);
  return total > 0 ? total : null;
}

/** La calcomania de una categoria del servidor (PoiCategory); el pin generico si no la conoce. */
export function calcomaniaDeCategoria(categoria) {
  return CATEGORIAS.find((c) => c.categoria === categoria)?.calcomania ?? 'lugar';
}

/* ---------------------------------------------------------------------------
   Al mapa y al servidor
--------------------------------------------------------------------------- */

/** Los lugares como GeoJSON de puntos, con lo que la capa necesita para dibujar cada pin. */
export function featuresDeLugares(pois) {
  return {
    type: 'FeatureCollection',
    features: (pois ?? []).map((poi) => {
      const estado = estadoDelPin(poi);
      const contador = contadorDelPin(poi);

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [poi.longitude, poi.latitude] },
        properties: {
          id: poi.id,
          nombre: poi.name,
          icono: `pin-${calcomaniaDeCategoria(poi.category)}-${estado}`,
          estado,
          contador: contador === null ? '' : String(contador)
        }
      };
    })
  };
}

/** Los ids de los chips como los nombres del servidor, en el orden de los chips. */
export function categoriasParaPedir(ids) {
  const activas = new Set(ids ?? []);
  return CATEGORIAS.filter((c) => activas.has(c.id)).map((c) => c.categoria).join(',');
}

/* ---------------------------------------------------------------------------
   El pin

   32 de ancho y 38 de alto con la cola, dibujado al doble para pantallas
   densas. El disco #2b3035 con el anillo de 3 y la calcomania de 18 adentro,
   como en el prototipo.
--------------------------------------------------------------------------- */

const PIN_ANCHO = 32;
const PIN_ALTO = 38;

export function pinSvg(calcomania, estado) {
  const anillo = ANILLO[estado] ?? ANILLO.sin;
  const inner = CALCOMANIAS[calcomania] ?? '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_ANCHO * 2}" height="${PIN_ALTO * 2}" viewBox="0 0 ${PIN_ANCHO} ${PIN_ALTO}">` +
    `<path d="M11 28l5 9 5-9z" fill="${anillo}"/>` +
    `<circle cx="16" cy="16" r="14.5" fill="#2b3035" stroke="${anillo}" stroke-width="3"/>` +
    `<svg x="7" y="7" width="18" height="18" viewBox="0 0 32 32" overflow="visible">${inner}</svg>` +
    '</svg>';
}

/** El disco del contador de votos: 17 dp, gris con borde blanco; el numero lo pone la capa. */
const badgeSvg = () =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 18 18">' +
  '<circle cx="9" cy="9" r="7.5" fill="#6e7378" stroke="#ffffff" stroke-width="2"/></svg>';

/* ---------------------------------------------------------------------------
   MapLibre
--------------------------------------------------------------------------- */

export const CAPA_LUGARES = 'lugar-pin';
const CAPA_CONTADOR = 'lugar-contador';
const FUENTE = 'lugares';

const pendientes = new Set();

/** Los mapas que ya escuchan los iconos que faltan: el oyente va una sola vez por mapa. */
const escuchando = new WeakSet();

/** Carga un SVG como imagen y la registra; se llama cuando el mapa pide un icono que no tiene. */
function registrarImagen(map, nombre, svg) {
  if (map.hasImage(nombre) || pendientes.has(nombre)) return;
  pendientes.add(nombre);

  const img = new Image();
  img.onload = () => {
    pendientes.delete(nombre);
    if (!map.hasImage(nombre)) map.addImage(nombre, img, { pixelRatio: 2 });
  };
  img.onerror = () => pendientes.delete(nombre);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Deja la fuente y las capas listas, vacias. Idempotente: con estilo vectorial,
 * cambiar de estilo vuelve a disparar 'load' y hay que reinstalar.
 */
export function instalarLugares(map) {
  if (!escuchando.has(map)) {
    escuchando.add(map);

    map.on('styleimagemissing', ({ id }) => {
      if (id === 'lugar-badge') return registrarImagen(map, id, badgeSvg());

      const partes = /^pin-([a-z]+)-(verificado|comunidad|sin)$/i.exec(id);
      if (partes) registrarImagen(map, id, pinSvg(partes[1], partes[2]));
    });
  }

  if (map.getSource(FUENTE)) return;

  map.addSource(FUENTE, { type: 'geojson', data: featuresDeLugares([]) });

  map.addLayer({
    id: CAPA_LUGARES,
    type: 'symbol',
    source: FUENTE,
    layout: {
      'icon-image': ['get', 'icono'],
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    },
    paint: {
      // Lo que nadie confirmo se ve, pero apagado.
      'icon-opacity': ['match', ['get', 'estado'], 'sin', 0.72, 1]
    }
  });

  // El contador de votos, arriba a la derecha del pin, solo donde hay.
  map.addLayer({
    id: CAPA_CONTADOR,
    type: 'symbol',
    source: FUENTE,
    filter: ['!=', ['get', 'contador'], ''],
    layout: {
      'icon-image': 'lugar-badge',
      'icon-size': 1,
      'icon-anchor': 'center',
      'icon-offset': [13, -33],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'contador'],
      'text-font': ['NotoSans-Bold'],
      'text-size': 11,
      'text-anchor': 'center',
      'text-offset': [1.18, -3],
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: { 'text-color': '#ffffff' }
  });
}

/** Pone estos lugares en el mapa (o ninguno). */
export function mostrarLugares(map, pois) {
  map.getSource(FUENTE)?.setData(featuresDeLugares(pois));
}
