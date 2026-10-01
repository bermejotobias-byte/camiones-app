/**
 * El mapa de fondo, con la jerarquia de Waze.
 *
 * Tiles vectoriales propios en formato PMTiles —un solo archivo estatico que el
 * navegador lee por rangos de bytes— generados por `data/build-basemap.ps1`
 * (esquema Protomaps basemap). Reemplaza a los tiles raster de OpenStreetMap y
 * resuelve el minimalismo, el modo dia y noche del fondo, y la limitacion L-4.
 *
 * ## El criterio del estilo (16/09/2026, AD-48)
 *
 * Se calco de Waze de noche, medido sobre las capturas de docs/referencias/waze:
 *
 * · **las calles no llevan borde** y tienen puntas redondas; la jerarquia es por
 *   ancho y por claridad: calle, avenida, y encima de todo la Red de Transito
 *   Pesado —que la pinta layers.js— en el lugar que en Waze ocupa la autopista.
 *   De dia, en cambio, las calles son blancas y llevan un filete gris;
 * · **la autopista** es una banda clara con dos lineas de carril y la linea
 *   central punteada (waze-08);
 * · **las manzanas no son todas iguales**: lo residencial va apenas distinto de
 *   la tierra, los predios (industria, comercio, escuelas, hospitales, vias)
 *   mas claros, los parques en verde y el agua en azul;
 * · **los rotulos son pocos y chicos**: nombres de calle en 12 sp claros a lo
 *   largo de la calle, barrios en 17 sp gris, parques en verde, lugares en
 *   celeste claro;
 * · **nada de puntos de interes** del mapa base. Los lugares utiles para un
 *   camion son capa nuestra y aparte.
 *
 * Los `kind` de cada capa se VERIFICARON sobre los tiles del AMBA el
 * 16/09/2026 (`tnMap.querySourceFeatures`), no se supusieron: roads trae
 * highway, major_road (primary, secondary, tertiary, trunk y sus links),
 * minor_road, path, rail, aeroway, ferry; landuse trae residential, park,
 * pitch, industrial, grass, school, railway, commercial, recreation_ground,
 * hospital, university, pedestrian, wood, scrub, garden, military, college,
 * wetland, cemetery, golf_course, playground, meadow, forest, nature_reserve
 * y mas; places trae neighbourhood, macrohood, locality.
 */

/** De donde sale el archivo de tiles. Lo sirve la API fuera de wwwroot. */
export const BASEMAP_URL = 'tiles/amba.pmtiles';

const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Registra el protocolo `pmtiles://` en MapLibre.
 *
 * Hay que hacerlo una sola vez y antes de crear cualquier mapa: si no, MapLibre
 * no sabe leer la URL y el estilo falla entero.
 */
let registered = false;

export function registerPmtilesProtocol() {
  if (registered) return true;

  if (typeof pmtiles === 'undefined' || typeof maplibregl === 'undefined') {
    return false;
  }

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;

  return true;
}

/* ---------------------------------------------------------------------------
   Que es cada cosa en los tiles
--------------------------------------------------------------------------- */

const VERDE = ['park', 'grass', 'garden', 'wood', 'scrub', 'forest', 'nature_reserve', 'golf_course',
  'recreation_ground', 'pitch', 'playground', 'meadow', 'grassland', 'wetland', 'zoo', 'farmland'];

const PREDIO = ['industrial', 'commercial', 'railway', 'military', 'aerodrome', 'other', 'school',
  'university', 'college', 'hospital', 'kindergarten', 'pier', 'retail', 'brownfield', 'construction'];

const MANZANA_B = ['pedestrian', 'residential'];

const esKind = (lista) => ['in', ['get', 'kind'], ['literal', lista]];
const esDetalle = (lista) => ['in', ['get', 'kind_detail'], ['literal', lista]];

/** Nombre en castellano si lo hay. */
const NOMBRE = ['coalesce', ['get', 'name:es'], ['get', 'name']];

/**
 * Ancho de una clase de via segun el zoom. De cerca (z17) reproduce las
 * medidas de waze-03 y waze-06: calle 10, avenida 12, autopista 16; de lejos
 * (z13) las de waze-08: 2,5 / 4 / 14.
 *
 * `por` y `mas` escalan y corren las paradas ANTES de armar la expresion:
 * `['zoom']` solo puede ir en el nivel superior de un `interpolate`, y
 * envolverlo en una suma o un producto hace que MapLibre rechace la capa
 * entera — por el evento `error`, sin excepcion (ver CLAUDE.md, AD-36).
 */
const ancho = ([z13, z15, z17, z19], { por = 1, mas = 0 } = {}) =>
  ['interpolate', ['exponential', 1.4], ['zoom'],
    13, z13 * por + mas, 15, z15 * por + mas, 17, z17 * por + mas, 19, z19 * por + mas];

const PARADAS = {
  calle: [1, 2.6, 10, 26],
  avenida: [2.2, 4.5, 12, 30],
  principal: [3, 6, 14, 34],
  autopista: [5, 8, 16, 38],
  sendero: [0.4, 0.8, 2, 4],
  ferrocarril: [1.2, 2, 4, 8]
};

const ANCHO = Object.fromEntries(Object.entries(PARADAS).map(([k, p]) => [k, ancho(p)]));

/** La misma escala, sumandole un filete de 2 px (de dia). */
const conBorde = (clase) => ancho(PARADAS[clase], { mas: 2 });

/**
 * Arma el estilo completo, leyendo los colores del tema activo.
 *
 * Se construye en JavaScript y no como archivo JSON porque los colores salen de
 * las variables CSS: asi el mapa cambia de dia a noche con el resto de la app,
 * en lugar de mantener dos estilos que hay que actualizar a la par.
 */
export function buildBasemapStyle(apiBase = '') {
  const url = apiBase ? `${apiBase}/${BASEMAP_URL}` : BASEMAP_URL;

  const t = {
    tierra: token('--map-tierra'),
    manzana: token('--map-manzana'),
    manzanaB: token('--map-manzana-b'),
    predio: token('--map-predio'),
    agua: token('--map-agua'),
    parque: token('--map-parque'),
    cementerio: token('--map-cementerio'),
    calle: token('--map-calle'),
    calleBorde: token('--map-calle-borde'),
    avenida: token('--map-avenida'),
    autopista: token('--map-autopista'),
    carril: token('--map-carril'),
    centro: token('--map-centro'),
    ferrocarril: token('--map-ferrocarril'),
    ferrocarril2: token('--map-ferrocarril-2'),
    edificio: token('--map-edificio'),
    sendero: token('--map-sendero'),
    rotulo: token('--map-rotulo'),
    halo: token('--map-halo'),
    barrio: token('--map-barrio'),
    parqueRotulo: token('--map-parque-rotulo'),
    lugar: token('--map-lugar')
  };

  // Desde que zoom se ve cada clase (medido en el telefono el 18/09/2026: con
  // todas en 11, al alejar para ver la Ciudad entera quedaba la Red sola
  // flotando sin calles). Como en Waze: de lejos, autopistas y vias
  // principales; las calles chicas al acercarse.
  const DESDE = { autopista: 8, principal: 9, avenida: 10, calle: 12, sendero: 14, ferrocarril: 11 };

  const linea = (id, filtro, color, width, extra = {}, desde = 11) => ({
    id,
    type: 'line',
    source: 'base',
    'source-layer': 'roads',
    minzoom: desde,
    filter: filtro,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color, 'line-width': width, ...extra }
  });

  const esAutopista = ['==', ['get', 'kind'], 'highway'];
  const esPrincipal = ['all', ['==', ['get', 'kind'], 'major_road'], esDetalle(['primary', 'primary_link', 'trunk', 'trunk_link'])];
  const esAvenida = ['all', ['==', ['get', 'kind'], 'major_road'], esDetalle(['secondary', 'secondary_link', 'tertiary', 'tertiary_link'])];
  const esCalle = ['==', ['get', 'kind'], 'minor_road'];
  const esSendero = ['==', ['get', 'kind'], 'path'];
  const esFerrocarril = ['all', ['==', ['get', 'kind'], 'rail'], esDetalle(['rail'])];

  return {
    version: 8,
    glyphs: 'fonts/{fontstack}/{range}.pbf',

    sources: {
      base: {
        type: 'vector',
        url: `pmtiles://${url}`,
        attribution: '© colaboradores de OpenStreetMap'
      }
    },

    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': t.tierra } },

      { id: 'tierra', type: 'fill', source: 'base', 'source-layer': 'earth', paint: { 'fill-color': t.tierra } },

      /* -- manzanas y predios: la textura de la ciudad --------------------- */
      {
        id: 'manzanas',
        type: 'fill',
        source: 'base',
        'source-layer': 'landuse',
        filter: esKind(MANZANA_B),
        paint: { 'fill-color': ['match', ['get', 'kind'], 'pedestrian', t.manzanaB, t.manzana] }
      },
      {
        id: 'predios',
        type: 'fill',
        source: 'base',
        'source-layer': 'landuse',
        filter: esKind(PREDIO),
        paint: { 'fill-color': t.predio }
      },
      {
        id: 'verde',
        type: 'fill',
        source: 'base',
        'source-layer': 'landuse',
        filter: esKind([...VERDE, 'cemetery']),
        paint: { 'fill-color': ['match', ['get', 'kind'], 'cemetery', t.cementerio, t.parque] }
      },

      // El agua si se distingue: el rio y el Riachuelo son referencias de
      // orientacion de primer orden.
      { id: 'agua', type: 'fill', source: 'base', 'source-layer': 'water', paint: { 'fill-color': t.agua } },

      /* -- calles: sin borde de noche, con filete de dia -------------------- */
      linea('calles-borde', esCalle, t.calleBorde, conBorde('calle'), {}, DESDE.calle),
      linea('avenidas-borde', esAvenida, t.calleBorde, conBorde('avenida'), {}, DESDE.avenida),
      linea('principales-borde', esPrincipal, t.calleBorde, conBorde('principal'), {}, DESDE.principal),

      linea('senderos', esSendero, t.sendero, ANCHO.sendero, { 'line-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 1] }, DESDE.sendero),
      linea('calles', esCalle, t.calle, ANCHO.calle, {}, DESDE.calle),
      linea('avenidas', esAvenida, t.avenida, ANCHO.avenida, {}, DESDE.avenida),
      linea('principales', esPrincipal, t.avenida, ANCHO.principal, {}, DESDE.principal),

      // El tren: linea gris con rayas claras, como "Ferrocarril Mitre" en
      // waze-09. Explica los pasos a nivel: un sapito suelto no se entiende.
      linea('ferrocarril', esFerrocarril, t.ferrocarril, ANCHO.ferrocarril),
      linea('ferrocarril-rayas', esFerrocarril, t.ferrocarril2, ancho(PARADAS.ferrocarril, { por: 0.45 }),
        { 'line-dasharray': [1.5, 3] }),

      /* -- la autopista: banda clara, dos carriles y el centro punteado ----- */
      linea('autopista', esAutopista, t.autopista, ANCHO.autopista, {}, DESDE.autopista),
      linea('autopista-carril-a', esAutopista, t.carril, 1, { 'line-offset': ancho(PARADAS.autopista, { por: 0.28 }), 'line-opacity': 0.8 }),
      linea('autopista-carril-b', esAutopista, t.carril, 1, { 'line-offset': ancho(PARADAS.autopista, { por: -0.28 }), 'line-opacity': 0.8 }),
      linea('autopista-centro', esAutopista, t.centro, 1.2, { 'line-dasharray': [4, 5], 'line-opacity': 0.9 }),

      // Los edificios aparecen recien muy cerca y sin contorno: sirven para
      // reconocer una esquina, no para mirarlos.
      {
        id: 'edificios',
        type: 'fill',
        source: 'base',
        'source-layer': 'buildings',
        minzoom: 16,
        paint: {
          'fill-color': t.edificio,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0, 17.5, 0.7]
        }
      },

      /* -- rotulos: pocos, chicos, a lo largo de la calle ------------------- */
      {
        id: 'calles-nombre',
        type: 'symbol',
        source: 'base',
        'source-layer': 'roads',
        minzoom: 14,
        filter: ['any', esCalle, esAvenida, esPrincipal, esAutopista],
        layout: {
          'symbol-placement': 'line',
          'text-field': NOMBRE,
          'text-font': ['NotoSans-Regular'],
          // 12 sp de cerca (waze-03); un poco menos de lejos, que hay mas.
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 12],
          'symbol-spacing': 300,
          'text-max-angle': 30,
          'text-padding': 6
        },
        paint: {
          'text-color': t.rotulo,
          'text-halo-color': t.halo,
          'text-halo-width': 1.4
        }
      },

      {
        id: 'parques-nombre',
        type: 'symbol',
        source: 'base',
        'source-layer': 'pois',
        minzoom: 14,
        filter: esKind(['park', 'golf_course', 'recreation_ground', 'nature_reserve', 'zoo']),
        layout: {
          'text-field': NOMBRE,
          'text-font': ['NotoSans-Regular'],
          'text-size': 12,
          'text-max-width': 8,
          'text-padding': 10
        },
        paint: {
          'text-color': t.parqueRotulo,
          'text-halo-color': t.halo,
          'text-halo-width': 1.4
        }
      },

      // Los lugares grandes que orientan —un hospital, una universidad, una
      // estacion, un shopping—, en celeste claro como los pone Waze. Nada de
      // comercios chicos: eso es ruido para quien maneja treinta toneladas.
      {
        id: 'lugares-nombre',
        type: 'symbol',
        source: 'base',
        'source-layer': 'pois',
        minzoom: 15,
        filter: esKind(['hospital', 'university', 'station', 'mall', 'sports_centre', 'stadium', 'bus_station',
          'exhibition_centre', 'port', 'harbour', 'industrial', 'commercial', 'military', 'cemetery', 'aerodrome']),
        layout: {
          'text-field': NOMBRE,
          'text-font': ['NotoSans-Regular'],
          'text-size': 12,
          'text-max-width': 8,
          'text-padding': 12
        },
        paint: {
          'text-color': t.lugar,
          'text-halo-color': t.halo,
          'text-halo-width': 1.4
        }
      },

      {
        id: 'barrios',
        type: 'symbol',
        source: 'base',
        'source-layer': 'places',
        filter: ['in', ['get', 'kind'], ['literal', ['neighbourhood', 'locality', 'macrohood']]],
        layout: {
          'text-field': NOMBRE,
          'text-font': ['NotoSans-Regular'],
          // 17 sp de cerca (waze-03, "Villa Maipu"); de lejos, menos.
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 14, 14, 16, 17],
          'text-max-width': 7,
          'text-padding': 10
        },
        paint: {
          'text-color': t.barrio,
          'text-halo-color': t.halo,
          'text-halo-width': 1.6
        }
      }
    ]
  };
}
