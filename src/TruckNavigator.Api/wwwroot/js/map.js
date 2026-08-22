/**
 * El mapa, detras de una interfaz chica.
 *
 * Todo lo que sabe de MapLibre vive aca. Las vistas piden "mostra esta ruta" o
 * "pone el origen en este punto" y no conocen ni una capa ni una fuente. Si
 * manana se cambia de biblioteca de mapas, se reescribe este archivo y nada mas.
 */

const CABA_CENTER = [-58.4370, -34.6083];

/**
 * Tiles raster de OpenStreetMap.
 *
 * Alcanzan para desarrollar, pero su politica de uso desaconseja el consumo
 * desde aplicaciones: antes de distribuir hay que pasar a tiles propios. Esta
 * como constante para que ese cambio sea una linea. Ver L-4 en data-sources.md.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

let map = null;
let markers = { origin: null, destination: null, gps: null };
let onLongPress = null;

/** Lee un color del sistema de diseno para que el mapa siga al tema. */
const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Crea el mapa.
 *
 * Conviene pasarle el elemento y no un id: buscarlo por id obliga a que el nodo
 * ya este montado en el documento en el momento exacto de la llamada, que es
 * justo lo que se rompe cuando una vista se arma antes de insertarse.
 */
export function createMap(container, handlers = {}) {
  onLongPress = handlers.onLongPress ?? null;

  map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [TILE_URL],
          tileSize: 256,
          attribution: '© colaboradores de OpenStreetMap'
        }
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    },
    center: CABA_CENTER,
    zoom: 12,
    attributionControl: { compact: true }
  });

  map.on('click', () => handlers.onTap?.());
  map.on('load', () => handlers.onReady?.());

  installLongPress();

  return map;
}

export function destroyMap() {
  map?.remove();
  map = null;
  markers = { origin: null, destination: null, gps: null };
}

/* ---------------------------------------------------------------------------
   Mantener apretado para fijar un punto

   MapLibre no trae el gesto. Se arma sobre los eventos tactiles del contenedor,
   con tres cancelaciones que importan:

   · si el dedo se corre mas de 12 px, esta arrastrando el mapa —sin esa
     tolerancia el pulso normal cancela el gesto y parece que no anda—;
   · si aparece un segundo dedo, esta haciendo zoom;
   · si suelta antes de tiempo, fue un toque.

   Un toque simple no fija nada: navegar el mapa es una actividad tactil
   constante y perder el destino ya elegido no tiene deshacer.
--------------------------------------------------------------------------- */

const LONG_PRESS_MS = 500;
const TOLERANCE_PX = 12;

function installLongPress() {
  const canvas = map.getCanvasContainer();

  let timer = null;
  let start = null;
  let lastFired = 0;

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    start = null;
  };

  const fire = (clientX, clientY) => {
    // El WebView puede emitir ademas su propio contextmenu por el mismo gesto.
    if (Date.now() - lastFired < 800) return;
    lastFired = Date.now();

    const rect = canvas.getBoundingClientRect();
    const point = map.unproject([clientX - rect.left, clientY - rect.top]);

    onLongPress?.({ lat: point.lat, lng: point.lng });
  };

  const begin = (clientX, clientY, target) => {
    // Mantener apretado sobre un marcador no marca el mapa que hay debajo.
    if (target?.closest?.('.maplibregl-marker')) return;

    start = { x: clientX, y: clientY };
    timer = setTimeout(() => fire(clientX, clientY), LONG_PRESS_MS);
  };

  const move = (clientX, clientY) => {
    if (!start) return;

    const moved = Math.hypot(clientX - start.x, clientY - start.y);
    if (moved > TOLERANCE_PX) cancel();
  };

  canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return cancel();
    const touch = event.touches[0];
    begin(touch.clientX, touch.clientY, event.target);
  }, { passive: true });

  canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length !== 1) return cancel();
    const touch = event.touches[0];
    move(touch.clientX, touch.clientY);
  }, { passive: true });

  canvas.addEventListener('touchend', cancel, { passive: true });
  canvas.addEventListener('touchcancel', cancel, { passive: true });

  // Con mouse, para poder probar en el navegador.
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    begin(event.clientX, event.clientY, event.target);
  });

  canvas.addEventListener('mousemove', (event) => move(event.clientX, event.clientY));
  canvas.addEventListener('mouseup', cancel);
  canvas.addEventListener('mouseleave', cancel);

  // El menu contextual nativo aparece justo encima del mapa.
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

/* ---------------------------------------------------------------------------
   Marcadores
--------------------------------------------------------------------------- */

function pinElement(className, label) {
  const node = document.createElement('div');
  node.className = `pin ${className}`;
  node.textContent = label ?? '';
  return node;
}

function place(kind, coords, className, label) {
  if (!map) return;

  if (!coords) {
    markers[kind]?.remove();
    markers[kind] = null;
    return;
  }

  const position = [coords.lng, coords.lat];

  if (markers[kind]) {
    markers[kind].setLngLat(position);
    return;
  }

  markers[kind] = new maplibregl.Marker({ element: pinElement(className, label) })
    .setLngLat(position)
    .addTo(map);
}

export const setOrigin = (coords) => place('origin', coords, 'pin-origin', 'A');
export const setDestination = (coords) => place('destination', coords, 'pin-destination', 'B');
export const setGpsPosition = (coords) => place('gps', coords, 'pin-gps');

/* ---------------------------------------------------------------------------
   Ruta

   Se dibuja en tres capas apiladas: un halo grueso que la despega del mapa, la
   linea de la ruta, y encima los tramos fuera de la Red punteados.

   Fuera de la Red va en CELESTE y no en naranja ni rojo: la norma admite salir
   de la Red para llegar al destino, asi que pintarlo como infraccion seria
   mentir sobre lo que dice la ley.
--------------------------------------------------------------------------- */

const ROUTE_LAYERS = ['route-halo', 'route-line', 'route-access'];
const ROUTE_SOURCES = ['route', 'route-access'];

export function clearRoute() {
  if (!map) return;

  ROUTE_LAYERS.forEach((id) => map.getLayer(id) && map.removeLayer(id));
  ROUTE_SOURCES.forEach((id) => map.getSource(id) && map.removeSource(id));
}

/**
 * @param {object} route respuesta de la API
 * @param {Array}  accessLegs tramos que usan la excepcion de acceso
 */
export function drawRoute(route, accessLegs = []) {
  if (!map || !route?.geometry?.coordinates?.length) return;

  // El estilo puede no haber terminado de cargar cuando llega la ruta: agregar
  // una fuente antes de eso hace que MapLibre tire "Style is not done loading",
  // la excepcion sube hasta el llamador y la ruta no se dibuja nunca.
  //
  // Es intermitente por naturaleza —depende de si contesto antes el servidor o
  // los tiles—, asi que se espera a que el mapa quede quieto y se reintenta.
  if (!map.isStyleLoaded()) {
    map.once('idle', () => drawRoute(route, accessLegs));
    return;
  }

  clearRoute();

  const coordinates = route.geometry.coordinates;

  map.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates } }
  });

  map.addLayer({
    id: 'route-halo',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': token('--route-halo'), 'line-width': 11, 'line-opacity': .9 }
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': token('--route'), 'line-width': 6 }
  });

  // Los tramos de acceso vienen como rangos de indices sobre la geometria.
  const segments = accessLegs
    .map((leg) => coordinates.slice(leg.fromPointIndex, leg.toPointIndex + 1))
    .filter((segment) => segment.length > 1);

  if (segments.length) {
    map.addSource('route-access', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'MultiLineString', coordinates: segments }
      }
    });

    map.addLayer({
      id: 'route-access',
      type: 'line',
      source: 'route-access',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': token('--route'),
        'line-width': 6,
        'line-dasharray': [1.4, 1.1]
      }
    });
  }

  fitTo(coordinates);
}

function fitTo(coordinates) {
  const bounds = coordinates.reduce(
    (box, coord) => box.extend(coord),
    new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
  );

  map.fitBounds(bounds, {
    // Deja aire arriba para la barra y abajo para la hoja inferior.
    padding: { top: 90, bottom: 320, left: 40, right: 40 },
    duration: 600
  });
}

export function flyTo(coords, zoom = 15) {
  map?.flyTo({ center: [coords.lng, coords.lat], zoom, duration: 700 });
}

export function resize() {
  map?.resize();
}
