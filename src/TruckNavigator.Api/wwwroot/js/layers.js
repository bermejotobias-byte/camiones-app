/**
 * Las capas de camion del mapa.
 *
 * Son el diferencial del producto y no vienen en ningun mapa del mundo: ningun
 * proveedor de tiles incluye `hgv`, `maxheight` ni los pasos a nivel como datos
 * consultables. Los archivos los genera `data/fetch-caba-map-layers.ps1` desde
 * OpenStreetMap y viajan versionados, igual que el dataset de puntos de interes.
 *
 * Todo lo que sabe de MapLibre vive en map.js; esto es lo que sabe de camiones.
 */

const SOURCES = {
  red: 'data/red-transito-pesado.geojson',
  alturas: 'data/alturas.geojson',
  pasos: 'data/pasos-a-nivel.geojson'
};

/** Ids de todas las capas, para prenderlas y apagarlas juntas. */
const LAYER_IDS = [
  'red-linea', 'red-nombre',
  'altura-fondo', 'altura-texto',
  'paso-punto', 'paso-aviso'
];

const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Altura del camion elegido, en metros.
 *
 * Se guarda para poder pintar cada galibo segun el riesgo que representa PARA
 * ESE camion. Un puente de 4,10 no significa lo mismo para un chasis de 3,20 que
 * para un semirremolque de 4,20: al primero no le importa y al segundo no le da.
 */
let truckHeight = null;

/**
 * Margen de seguridad, en metros.
 *
 * Un galibo que le saca menos de esto al camion se marca como ajustado aunque
 * tecnicamente pase: la altura declarada en OSM no siempre contempla el
 * repavimentado, y un camion cargado se asienta distinto que uno vacio.
 */
const TIGHT_MARGIN = 0.3;

export async function installTruckLayers(map) {
  if (!map) return;

  // El estilo puede no haber terminado de cargar. Agregar una fuente antes de
  // eso tira "Style is not done loading" — y como el error se parece a un fallo
  // de red, es facil taparlo con el mismo catch y quedarse sin capas sin
  // entender por que. Se espera y se reintenta.
  if (!map.isStyleLoaded()) {
    await new Promise((ready) => map.once('idle', ready));
  }

  // La descarga y el alta en el mapa se separan a proposito: son dos fallas
  // distintas —una es del servidor, la otra del mapa— y confundirlas fue
  // exactamente lo que escondio este problema.
  const datasets = await Promise.all(
    Object.entries(SOURCES).map(async ([key, url]) => {
      if (map.getSource(key)) return null;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`el servidor respondio ${response.status}`);

        return { key, data: await response.json() };
      } catch (error) {
        console.warn(`No se pudo descargar la capa ${key}: ${error.message}`);
        return null;
      }
    })
  );

  for (const dataset of datasets) {
    if (!dataset) continue;
    map.addSource(dataset.key, { type: 'geojson', data: dataset.data });
  }

  addRedLayers(map);
  addHeightLayers(map);
  addCrossingLayers(map);
}

/* ---------------------------------------------------------------------------
   Red de Transito Pesado

   El pedido es explicito: que las avenidas aptas se vean aunque no sean parte
   de la ruta, "que no se marque con color pero que sea bien visible el nombre
   de forma destacada de las demas".

   Asi que el protagonista es EL NOMBRE, no la linea. La linea va en un gris
   apenas perceptible —lo justo para que el nombre no flote sobre la nada— y el
   nombre en mayusculas, espaciado y con halo, que lo despega de la cartografia
   de fondo sin competir con la ruta.
--------------------------------------------------------------------------- */

function addRedLayers(map) {
  if (!map.getSource('red') || map.getLayer('red-linea')) return;

  map.addLayer({
    id: 'red-linea',
    type: 'line',
    source: 'red',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': token('--ink-3'),
      'line-opacity': 0.35,
      // Se engrosa con el zoom para que a lo lejos se lea el corredor y de
      // cerca no tape la calle.
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 4, 17, 7]
    }
  });

  map.addLayer({
    id: 'red-nombre',
    type: 'symbol',
    source: 'red',
    // Sin nombre no hay nada que mostrar, y la linea ya la dibuja la capa de arriba.
    filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], null]],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.12,
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 12, 18, 14],
      'text-font': ['NotoSans-Bold'],
      // Se repite a lo largo de la avenida: sirve de referencia en cualquier
      // punto, no solo donde arranca el tramo.
      'symbol-spacing': 260,
      'text-max-angle': 35,
      'text-allow-overlap': false,
      'text-padding': 4
    },
    paint: {
      'text-color': token('--ink'),
      'text-halo-color': token('--surface'),
      'text-halo-width': 2.2
    }
  });
}

/* ---------------------------------------------------------------------------
   Galibos

   Cada altura se pinta segun lo que significa para el camion elegido, no en
   abstracto. Es la diferencia entre un dato y una advertencia.
--------------------------------------------------------------------------- */

/** Color del galibo segun el riesgo para este camion. */
function heightColor() {
  if (truckHeight === null) {
    return token('--ink-2');
  }

  return [
    'case',
    ['<', ['get', 'metres'], truckHeight], token('--danger'),
    ['<', ['get', 'metres'], truckHeight + TIGHT_MARGIN], token('--warn'),
    token('--ink-2')
  ];
}

function addHeightLayers(map) {
  if (!map.getSource('alturas') || map.getLayer('altura-fondo')) return;

  // Debajo de este zoom serian confeti: 577 etiquetas sobre la ciudad entera.
  const minzoom = 13;

  map.addLayer({
    id: 'altura-fondo',
    type: 'circle',
    source: 'alturas',
    minzoom,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 9, 17, 14],
      'circle-color': heightColor(),
      'circle-stroke-color': token('--surface'),
      'circle-stroke-width': 1.5
    }
  });

  map.addLayer({
    id: 'altura-texto',
    type: 'symbol',
    source: 'alturas',
    minzoom,
    layout: {
      // Con coma decimal, que es como se lee un galibo en la calle.
      'text-field': [
        'number-format',
        ['get', 'metres'],
        { locale: 'es-AR', 'min-fraction-digits': 2, 'max-fraction-digits': 2 }
      ],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 17, 12],
      'text-font': ['NotoSans-Bold'],
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': token('--surface')
    }
  });
}

/* ---------------------------------------------------------------------------
   Pasos a nivel

   Los "sapitos". Lo que le importa al camionero no es que exista el cruce sino
   COMO esta protegido: los que no tienen barrera son los que matan.
--------------------------------------------------------------------------- */

function addCrossingLayers(map) {
  if (!map.getSource('pasos') || map.getLayer('paso-punto')) return;

  const minzoom = 12;

  map.addLayer({
    id: 'paso-punto',
    type: 'circle',
    source: 'pasos',
    minzoom,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 8],
      // Sin barrera es lo peligroso. "null" es que la fuente no lo dice, y eso
      // NO es lo mismo que no tener barrera: va en gris, no en rojo.
      'circle-color': [
        'match',
        ['coalesce', ['get', 'barrier'], 'desconocido'],
        'no', token('--danger'),
        ['full', 'half', 'double_half', 'yes'], token('--warn'),
        token('--ink-3')
      ],
      'circle-stroke-color': token('--surface'),
      'circle-stroke-width': 1.5
    }
  });

  // Una cruz de San Andres sobre los que si tienen barrera, para distinguirlos
  // de un vistazo sin tener que tocar nada.
  map.addLayer({
    id: 'paso-aviso',
    type: 'symbol',
    source: 'pasos',
    minzoom: 14,
    layout: {
      // Se usa el signo de multiplicacion (U+00D7) y no una cruz de dingbats:
      // los glifos vendorizados llegan hasta el 511, y un caracter fuera de
      // rango no se dibuja — sin error, simplemente no aparece.
      'text-field': '×',
      'text-size': ['interpolate', ['linear'], ['zoom'], 14, 7, 17, 10],
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: { 'text-color': token('--surface') }
  });
}

/* ---------------------------------------------------------------------------
   Control
--------------------------------------------------------------------------- */

/**
 * Cambia el camion con el que se evaluan los galibos.
 *
 * Repinta en el acto: el mismo puente pasa de informativo a peligroso cuando se
 * cambia de vehiculo, y esa es justamente la informacion que importa.
 */
export function setTruckHeight(map, metres) {
  truckHeight = Number.isFinite(metres) ? metres : null;

  if (map?.getLayer('altura-fondo')) {
    map.setPaintProperty('altura-fondo', 'circle-color', heightColor());
  }
}

/** Prende o apaga todas las capas de camion. */
export function setTruckLayersVisible(map, visible) {
  if (!map) return;

  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

/** Vuelve a leer los colores del tema. Se llama al cambiar entre dia y noche. */
export function refreshLayerColors(map) {
  if (!map) return;

  if (map.getLayer('red-linea')) {
    map.setPaintProperty('red-linea', 'line-color', token('--ink-3'));
  }

  if (map.getLayer('red-nombre')) {
    map.setPaintProperty('red-nombre', 'text-color', token('--ink'));
    map.setPaintProperty('red-nombre', 'text-halo-color', token('--surface'));
  }

  if (map.getLayer('altura-fondo')) {
    map.setPaintProperty('altura-fondo', 'circle-color', heightColor());
    map.setPaintProperty('altura-fondo', 'circle-stroke-color', token('--surface'));
  }
}
