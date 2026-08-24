/**
 * El mapa, detras de una interfaz chica.
 *
 * Todo lo que sabe de MapLibre vive aca. Las vistas piden "mostra esta ruta" o
 * "pone el origen en este punto" y no conocen ni una capa ni una fuente. Si
 * manana se cambia de biblioteca de mapas, se reescribe este archivo y nada mas.
 */

import { installTruckLayers, setTruckLayersVisible, setTruckHeight, refreshLayerColors } from './layers.js';
import { registerPmtilesProtocol, buildBasemapStyle } from './basemap.js';
import { currentApiBase } from './api.js';

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

/** Ya se cayo al raster de respaldo una vez; no hace falta repetirlo. */
let fellBack = false;

/** Lee un color del sistema de diseno para que el mapa siga al tema. */
const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Estilo de respaldo con tiles raster.
 *
 * Se usa sólo si el mapa base vectorial no está generado. **No sirve para
 * distribuir** (L-4). Existe para que el mapa no quede en blanco en una máquina
 * recién clonada, y para que se note que falta correr `data/build-basemap.ps1`.
 *
 * Las fuentes viajan con la app en vez de pedirse a un servidor: adentro de un
 * camión, una descarga más es una cosa más que puede fallar, y sin glifos
 * MapLibre no dibuja NI UNA letra.
 */
const rasterFallbackStyle = () => ({
  version: 8,
  glyphs: 'fonts/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: [TILE_URL],
      tileSize: 256,
      attribution: '© colaboradores de OpenStreetMap'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
});

/**
 * Crea el mapa.
 *
 * Conviene pasarle el elemento y no un id: buscarlo por id obliga a que el nodo
 * ya esté montado en el documento en el momento exacto de la llamada, que es
 * justo lo que se rompe cuando una vista se arma antes de insertarse.
 */
export function createMap(container, handlers = {}) {
  onLongPress = handlers.onLongPress ?? null;

  // El protocolo pmtiles:// tiene que estar registrado ANTES de crear el mapa:
  // si no, MapLibre no sabe leer la URL y el estilo entero falla.
  const vector = registerPmtilesProtocol();

  map = new maplibregl.Map({
    container,
    style: vector ? buildBasemapStyle(currentApiBase()) : rasterFallbackStyle(),
    center: CABA_CENTER,
    zoom: 12,
    attributionControl: { compact: true }
  });

  // Si el archivo de tiles no está, MapLibre avisa por este evento y no con una
  // excepción. Se cae al raster para que el mapa no quede negro y sin explicación.
  map.on('error', (event) => {
    const message = event?.error?.message ?? '';

    if (vector && !fellBack && /pmtiles|404|not found|failed to fetch/i.test(message)) {
      fellBack = true;

      console.warn(
        'No se pudo cargar el mapa base vectorial; se usa el raster de respaldo. ' +
        'Generarlo con data/build-basemap.ps1. Detalle: ' + message);

      map.setStyle(rasterFallbackStyle());
    }
  });

  map.on('click', () => handlers.onTap?.());

  // Con estilo vectorial, cambiar de estilo vuelve a disparar 'load'. Las capas
  // de camion se reinstalan solas porque installTruckLayers es idempotente.
  map.on('load', async () => {
    // Las capas de camion se agregan apenas carga el estilo y antes de que
    // exista una ruta, para que la ruta quede dibujada por encima.
    await installTruckLayers(map);
    handlers.onReady?.();
  });

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

/* ---------------------------------------------------------------------------
   Modo navegacion

   Camara en primera persona: inclinada, orientada al rumbo y con el vehiculo
   corrido hacia abajo para que se vea el camino por delante y no por detras.
--------------------------------------------------------------------------- */

const NAVIGATION_ZOOM = 16.5;
const NAVIGATION_PITCH = 60;

/**
 * El vehiculo se dibuja al 72% del alto en lugar del centro.
 *
 * Con la camara inclinada, centrarlo desperdicia la mitad de la pantalla
 * mostrando lo que ya se recorrio. Corrido hacia abajo, ese espacio muestra las
 * proximas cuadras, que es lo unico que el conductor necesita ver.
 */
const VEHICLE_SCREEN_OFFSET = 0.22;

let vehicleMarker = null;
let navigating = false;

export function enterNavigationMode() {
  if (!map) return;
  navigating = true;

  // Con la camara siguiendo al vehiculo, la rotacion por gesto desorienta mas
  // de lo que ayuda: el mapa volveria a girar solo en el proximo latido.
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
}

export function exitNavigationMode() {
  if (!map) return;
  navigating = false;

  map.dragRotate.enable();
  map.touchZoomRotate.enableRotation();

  vehicleMarker?.remove();
  vehicleMarker = null;

  map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
}

/**
 * Mueve la camara y el vehiculo a la posicion nueva.
 *
 * @param {{lat:number,lng:number}} coords posicion ya ajustada a la ruta
 * @param {number} bearing rumbo en grados
 */
export function followVehicle(coords, bearing) {
  if (!map) return;

  placeVehicle(coords, bearing);

  if (!navigating) return;

  map.easeTo({
    center: [coords.lng, coords.lat],
    bearing,
    pitch: NAVIGATION_PITCH,
    zoom: NAVIGATION_ZOOM,
    // El desplazamiento se aplica en pixeles de pantalla, asi que se recalcula
    // con el alto real del contenedor.
    offset: [0, map.getContainer().clientHeight * VEHICLE_SCREEN_OFFSET],
    // La animacion dura un poco menos que el intervalo entre posiciones: si
    // durara mas, cada latido cortaria la anterior y el mapa se veria a los
    // tirones.
    duration: 900,
    easing: (t) => t
  });
}

function placeVehicle(coords, bearing) {
  if (!vehicleMarker) {
    const element = document.createElement('div');
    element.className = 'vehicle';
    element.innerHTML =
      '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
      '<path d="M12 2 L20 21 L12 17 L4 21 Z" fill="currentColor"/></svg>';

    vehicleMarker = new maplibregl.Marker({
      element,
      // El marcador rota con el mapa para que la flecha apunte siempre hacia
      // donde avanza el camion.
      rotationAlignment: 'map'
    }).setLngLat([coords.lng, coords.lat]).addTo(map);
  }

  vehicleMarker.setLngLat([coords.lng, coords.lat]);
  vehicleMarker.setRotation(bearing);
}

/** Recorta la ruta ya recorrida, para que sólo se vea lo que falta. */
export function trimRoute(coordinates, fromIndex, snappedPoint) {
  if (!map || !map.getSource('route')) return;

  const rest = [[snappedPoint.lng, snappedPoint.lat], ...coordinates.slice(fromIndex + 1)];

  if (rest.length < 2) return;

  map.getSource('route').setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: rest }
  });
}

export function resize() {
  map?.resize();
}

/* ---------------------------------------------------------------------------
   Capas de camion

   Se reexportan desde aca para que las vistas tengan una sola puerta de entrada
   al mapa y no tengan que saber que las capas viven en otro archivo.
--------------------------------------------------------------------------- */

export const showTruckLayers = (visible) => setTruckLayersVisible(map, visible);
export const useTruckHeight = (metres) => setTruckHeight(map, metres);
export const refreshColors = () => refreshLayerColors(map);

/**
 * Que hay en un punto del mapa, de nuestras capas.
 *
 * Sirve para que tocar un galibo o un paso a nivel diga que es, en lugar de ser
 * un punto de color sin explicacion.
 */
export function featureAt(point) {
  if (!map) return null;

  const found = map.queryRenderedFeatures(point, {
    layers: ['altura-fondo', 'paso-punto'].filter((id) => map.getLayer(id))
  });

  return found.length ? found[0] : null;
}
