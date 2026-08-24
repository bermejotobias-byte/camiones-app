/**
 * El mapa de fondo.
 *
 * Tiles vectoriales propios en formato PMTiles —un solo archivo estatico que el
 * navegador lee por rangos de bytes— generados por `data/build-basemap.ps1`.
 *
 * Reemplaza a los tiles raster de OpenStreetMap y resuelve tres cosas de una vez:
 * el minimalismo, el modo dia y noche del fondo, y la limitacion L-4 —la politica
 * de uso de tile.openstreetmap.org desaconseja el consumo desde aplicaciones, asi
 * que con raster la app no se podia distribuir—.
 *
 * ## El criterio del estilo
 *
 * Un mapa de navegacion para camion se mira de reojo, de dia, con el sol de
 * frente y a sesenta por hora. Todo lo que no ayuda a decidir por donde ir
 * estorba. Entonces:
 *
 * · **el fondo no compite.** Tierra, agua y manzanas en tres grises apenas
 *   separados. Los edificios recien aparecen muy cerca y sin contorno;
 * · **la jerarquia vial es lo unico que se pinta con contraste**, porque es lo
 *   que dice si una calle sirve para pasar con un camion;
 * · **casi no hay etiquetas propias.** El fondo rotula solo barrios y las calles
 *   grandes: los nombres que importan los pone la capa de la Red de Transito
 *   Pesado, y dos juegos de etiquetas compitiendo terminan tapandose;
 * · **nada de puntos de interes.** Farmacias y cafeterias son ruido para quien
 *   maneja treinta toneladas. Los lugares utiles —playas, gomerias, auxilio—
 *   son una capa nuestra y aparte.
 *
 * Esquema de datos: Protomaps basemap. Capas `earth`, `landuse`, `water`,
 * `roads`, `buildings`, `boundaries`, `places`, con el campo `kind`.
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

/**
 * Arma el estilo completo, leyendo los colores del tema activo.
 *
 * Se construye en JavaScript y no como archivo JSON porque los colores salen de
 * las variables CSS: asi el mapa cambia de dia a noche con el resto de la app,
 * en lugar de mantener dos estilos que hay que actualizar a la par.
 */
export function buildBasemapStyle(apiBase = '') {
  const url = apiBase ? `${apiBase}/${BASEMAP_URL}` : BASEMAP_URL;

  // Grises de fondo. Se derivan de los tokens del tema y no se eligen aparte,
  // para que el mapa y la interfaz no queden de dos familias distintas.
  const earth = token('--ground');
  const land = token('--surface-2');
  const water = token('--brand-soft');
  const building = token('--surface-3');
  const road = token('--surface');
  const roadCasing = token('--rule');
  const ink = token('--ink');
  const inkSoft = token('--ink-3');
  const halo = token('--ground');

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
      { id: 'fondo', type: 'background', paint: { 'background-color': earth } },

      {
        id: 'tierra',
        type: 'fill',
        source: 'base',
        'source-layer': 'earth',
        paint: { 'fill-color': earth }
      },

      // Parques y cementerios apenas se separan del fondo: ubican sin llamar.
      {
        id: 'suelo',
        type: 'fill',
        source: 'base',
        'source-layer': 'landuse',
        paint: { 'fill-color': land, 'fill-opacity': 0.6 }
      },

      // El agua si se distingue: en esta ciudad el rio y el Riachuelo son
      // referencias de orientacion de primer orden.
      {
        id: 'agua',
        type: 'fill',
        source: 'base',
        'source-layer': 'water',
        paint: { 'fill-color': water }
      },

      // Los edificios aparecen recien muy cerca y sin contorno: sirven para
      // reconocer una esquina, no para mirarlos.
      {
        id: 'edificios',
        type: 'fill',
        source: 'base',
        'source-layer': 'buildings',
        minzoom: 15,
        paint: {
          'fill-color': building,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 17, 0.5]
        }
      },

      /* ------------------------------------------------------------------
         Jerarquia vial

         Es lo unico que se pinta con contraste. Cada calle se dibuja con un
         reborde debajo y el relleno encima, que es lo que hace que los cruces
         se lean como cruces y no como una maraña.
      ------------------------------------------------------------------ */

      {
        id: 'calles-reborde',
        type: 'line',
        source: 'base',
        'source-layer': 'roads',
        minzoom: 12,
        filter: ['!=', ['get', 'kind'], 'path'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadCasing,
          'line-width': roadWidth(1.8)
        }
      },

      {
        id: 'calles',
        type: 'line',
        source: 'base',
        'source-layer': 'roads',
        minzoom: 12,
        filter: ['!=', ['get', 'kind'], 'path'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': road,
          'line-width': roadWidth(0)
        }
      },

      // Las vias del tren se dibujan porque explican los pasos a nivel: un
      // sapito suelto sobre el mapa no se entiende, sobre una via si.
      {
        id: 'vias',
        type: 'line',
        source: 'base',
        'source-layer': 'roads',
        minzoom: 13,
        filter: ['==', ['get', 'kind'], 'rail'],
        paint: {
          'line-color': inkSoft,
          'line-opacity': 0.45,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 17, 1.6],
          'line-dasharray': [3, 3]
        }
      },

      {
        id: 'limites',
        type: 'line',
        source: 'base',
        'source-layer': 'boundaries',
        paint: {
          'line-color': inkSoft,
          'line-opacity': 0.35,
          'line-width': 0.8,
          'line-dasharray': [4, 3]
        }
      },

      /* ------------------------------------------------------------------
         Etiquetas

         Deliberadamente pocas. Los nombres que le importan al camionero los
         pone la capa de la Red de Transito Pesado, y si el fondo rotula todo,
         las dos se tapan entre si.
      ------------------------------------------------------------------ */

      {
        id: 'calles-nombre',
        type: 'symbol',
        source: 'base',
        'source-layer': 'roads',
        minzoom: 15,
        // Solo las importantes: rotular cada calle de barrio llena la pantalla
        // de texto que nadie va a leer manejando.
        filter: ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name']],
          'text-font': ['NotoSans-Regular'],
          'text-size': 11,
          'symbol-spacing': 320
        },
        paint: {
          'text-color': inkSoft,
          'text-halo-color': halo,
          'text-halo-width': 1.6
        }
      },

      {
        id: 'barrios',
        type: 'symbol',
        source: 'base',
        'source-layer': 'places',
        filter: ['in', ['get', 'kind'], ['literal', ['neighbourhood', 'locality', 'macrohood']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name']],
          'text-font': ['NotoSans-Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 13],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
          'text-padding': 8
        },
        paint: {
          'text-color': ink,
          'text-opacity': 0.65,
          'text-halo-color': halo,
          'text-halo-width': 1.8
        }
      }
    ]
  };
}

/**
 * Ancho de cada calle segun su categoria y el zoom.
 *
 * @param {number} extra cuanto se agrega para el reborde de abajo
 */
function roadWidth(extra) {
  const width = (base) => base + extra;

  // La jerarquia del esquema es: highway, major_road, minor_road, other, path.
  // Se verifico muestreando 35 tiles sobre CABA — no hay "medium_road", que es
  // el nombre que usan otros esquemas: una rama con ese valor nunca coincidiria
  // y esas calles caerian al ancho por defecto sin que nada avise.
  return [
    'interpolate', ['linear'], ['zoom'],
    12, ['match', ['get', 'kind'],
      'highway', width(1.8), 'major_road', width(1.0), width(0.3)],
    15, ['match', ['get', 'kind'],
      'highway', width(6.5), 'major_road', width(4.2), 'minor_road', width(2.4), width(1.4)],
    18, ['match', ['get', 'kind'],
      'highway', width(22), 'major_road', width(15), 'minor_road', width(9), width(6)]
  ];
}
