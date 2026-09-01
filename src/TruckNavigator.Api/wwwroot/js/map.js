/**
 * El mapa, detras de una interfaz chica.
 *
 * Todo lo que sabe de MapLibre vive aca. Las vistas piden "mostra esta ruta" o
 * "pone el origen en este punto" y no conocen ni una capa ni una fuente. Si
 * manana se cambia de biblioteca de mapas, se reescribe este archivo y nada mas.
 */

import { installTruckLayers, setTruckLayersVisible, setRiskZonesVisible, setTruckHeight, refreshLayerColors } from './layers.js';
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
    attributionControl: { compact: true },

    // --- la camara no se inclina ni gira por gesto, nunca ------------------
    //
    // Fuera del viaje el mapa es una vista cenital fija, mirando al norte, como
    // en cualquier navegador conocido. Girarlo e inclinarlo son gestos que en un
    // telefono salen SIN QUERER —un pellizco desparejo alcanza— y dejan el mapa
    // torcido sin que el usuario sepa que toco ni como volver.
    //
    // La perspectiva existe en un solo lugar y por una sola razon: durante el
    // viaje, donde inclinar la camara muestra las cuadras que vienen en vez de
    // las que ya se pasaron. Esa inclinacion la aplica la app con easeTo, que no
    // pasa por estos manejadores, asi que apagarlos no la afecta.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false
  });

  // El pellizco sigue haciendo zoom —eso es esencial— pero pierde la parte que
  // rota. Son el mismo manejador y por eso se desactiva aparte.
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

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

  // El toque lleva ademas que hay debajo del dedo, si hay algo nuestro. Un
  // icono chico en un mapa no puede explicarse solo: tocarlo tiene que decir en
  // palabras que es. Sin esto, cada simbolo obliga a aprenderse una leyenda que
  // no existe.
  map.on('click', (event) => handlers.onTap?.(featureAt(event.point)));

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

/* ---------------------------------------------------------------------------
   Donde estoy y hacia donde miro

   El punto de la ubicacion propia lleva un cono que dice hacia donde apunta el
   telefono. No sale del GPS: el GPS informa hacia donde se MUEVE el camion y no
   dice nada con el camion parado. Esto sale del magnetometro y vale siempre.

   El cono se dibuja EN EL MAPA y no pegado a la pantalla. Con la camara girada
   —lo normal navegando— un cono anclado a la pantalla apuntaria a cualquier
   lado, porque el norte de la pantalla ya no es el norte del mapa.
--------------------------------------------------------------------------- */

let gpsHeading = null;

export function setGpsPosition(coords) {
  if (!map) return;

  if (!coords) {
    markers.gps?.remove();
    markers.gps = null;
    return;
  }

  if (!markers.gps) {
    markers.gps = new maplibregl.Marker({ element: gpsElement(), rotationAlignment: 'map' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    applyGpsHeading();
  }

  markers.gps.setLngLat([coords.lng, coords.lat]);
}

/**
 * Hacia donde apunta el telefono.
 *
 * @param {number|null} degrees grados horarios desde el norte, o `null` si el
 *   dispositivo no lo informa — ahi el cono se esconde en vez de quedar clavado
 *   al norte, que seria mentir.
 */
export function setGpsHeading(degrees) {
  gpsHeading = Number.isFinite(degrees) ? degrees : null;
  applyGpsHeading();
}

function applyGpsHeading() {
  if (!markers.gps) return;

  markers.gps.setRotation(gpsHeading ?? 0);
  markers.gps.getElement().classList.toggle('gps-facing', gpsHeading !== null);
}

function gpsElement() {
  const node = document.createElement('div');
  node.className = 'gps-puck';

  // El cono se desvanece hacia afuera: dice una direccion, no una distancia. Con
  // un borde neto parecia un haz que llega hasta ahi y no mas.
  node.innerHTML = `
    <svg class="gps-cone" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <defs>
        <radialGradient id="gps-cone-fade" cx="50%" cy="50%" r="50%">
          <stop offset="15%" stop-color="currentColor" stop-opacity=".6"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path d="M24 24 L14 6.7 A20 20 0 0 1 34 6.7 Z" fill="url(#gps-cone-fade)"/>
    </svg>
    <div class="pin pin-gps"></div>`;

  return node;
}

/* ---------------------------------------------------------------------------
   Ruta

   Se dibuja en tres capas apiladas: un halo grueso que la despega del mapa, la
   linea de la ruta, y encima los tramos fuera de la Red punteados.

   Fuera de la Red va en CELESTE y no en naranja ni rojo: la norma admite salir
   de la Red para llegar al destino, asi que pintarlo como infraccion seria
   mentir sobre lo que dice la ley.
--------------------------------------------------------------------------- */

const ROUTE_LAYERS = ['route-halo', 'route-line', 'route-access', 'calle-actual'];
// `calle-actual` NO tiene fuente propia: se dibuja sobre la del mapa base,
// filtrando por nombre. Borrar esa fuente al limpiar la ruta se llevaria puesto
// el mapa entero.
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

  // DEBAJO de los nombres de calle, no encima.
  //
  // Sin esto la ruta —17 px entre el halo y la linea— tapa justamente el nombre
  // de la calle por la que se va, que es el dato que el conductor mas necesita
  // durante el viaje. La ruta se sigue viendo igual: es una linea gruesa y de
  // color, y el texto encima lleva halo.
  const antesDeNombres = map.getLayer('calles-nombre') ? 'calles-nombre' : undefined;

  map.addLayer({
    id: 'route-halo',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': token('--route-halo'), 'line-width': 11, 'line-opacity': .9 }
  }, antesDeNombres);

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': token('--route'), 'line-width': 6 }
  }, antesDeNombres);

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
    }, antesDeNombres);
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

/**
 * Centra el mapa en un punto.
 *
 * @param {{lat:number,lng:number}|null} coords
 * @param {{minZoom?: number}} [options]
 *
 * <b>El zoom que eligio el usuario no se toca.</b> Antes cada punto que se
 * fijaba forzaba el zoom a 15: alguien que se habia acercado a mirar una esquina
 * perdia su encuadre al elegir el destino, y alguien que estaba mirando la
 * ciudad entera se encontraba de golpe adentro de una cuadra. Mover la camara
 * bajo los pies del usuario es de las cosas que mas molestan de un mapa.
 *
 * `minZoom` es la unica excepcion y solo acerca, nunca aleja: sirve para "Mi
 * ubicacion", donde el punto no se veria si el mapa esta en toda la ciudad.
 */
export function flyTo(coords, { minZoom } = {}) {
  // Sin punto no hay a donde ir. Se comprueba porque borrar un origen o un
  // destino pasa por el mismo camino que ponerlo, y ahi el punto es nulo.
  if (!coords || !map) return;

  const current = map.getZoom();
  const zoom = minZoom && current < minZoom ? minZoom : current;

  map.flyTo({ center: [coords.lng, coords.lat], zoom, duration: 700 });
}

/* ---------------------------------------------------------------------------
   Zoom

   Con botones y no solo con pellizco. El pellizco pide dos dedos y una mano
   libre; los botones se tocan con el pulgar de la mano que sostiene el
   telefono, que arriba de un camion suele ser la unica disponible.
--------------------------------------------------------------------------- */

/** Un paso de zoom. Entero: medio paso no se percibe y dos marean. */
const ZOOM_STEP = 1;

export function zoomIn() {
  map?.easeTo({ zoom: map.getZoom() + ZOOM_STEP, duration: 220 });
}

export function zoomOut() {
  map?.easeTo({ zoom: map.getZoom() - ZOOM_STEP, duration: 220 });
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

/**
 * Pone el mapa en modo viaje.
 *
 * @param {{lat:number,lng:number}} [from] desde donde arranca el viaje
 *
 * Si se le pasa un punto, **la camara se inclina ahi mismo**, sin esperar al
 * GPS. Antes la perspectiva se aplicaba recien en el primer `followVehicle`, o
 * sea con la primera posicion: tocar "Arrancar viaje" no producia ningun cambio
 * visible hasta que el GPS enganchara —decenas de segundos bajo techo— y la app
 * parecia colgada. La inclinacion es lo que le dice al conductor que el viaje
 * empezo, y eso tiene que pasar cuando toca el boton.
 */
export function enterNavigationMode(from) {
  if (!map) return;
  navigating = true;

  // El punto de la ubicacion propia le deja el lugar a la flecha del vehiculo.
  // Si no, quedan dos marcadores encima del mismo punto y el de la ubicacion
  // ademas congelado en la ultima vez que se toco "Mi ubicacion".
  setGpsPosition(null);

  if (!from) return;

  map.easeTo({
    center: [from.lng, from.lat],
    pitch: NAVIGATION_PITCH,
    zoom: NAVIGATION_ZOOM,
    offset: [0, map.getContainer().clientHeight * VEHICLE_SCREEN_OFFSET],
    duration: 600
  });
}

export function exitNavigationMode() {
  if (!map) return;
  navigating = false;

  vehicleMarker?.remove();
  vehicleMarker = null;

  // Se vuelve a la vista cenital mirando al norte. No se reactiva ningun gesto
  // de rotacion: fuera del viaje el mapa no se inclina ni gira por ningun
  // camino, y esta es la unica funcion que deshace la perspectiva.
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

/* ---------------------------------------------------------------------------
   El nombre de la calle por la que se va

   Manejando, el dato que mas se necesita del mapa es por que calle se esta
   yendo — y era lo que peor se veia: el mapa base rotula en 11 px y solo desde
   el zoom 15, y encima la ruta le pasaba por arriba tapandolo.

   Se dibuja como una capa propia sobre el tramo que se esta recorriendo, en
   verde y grande. Verde porque es el color que el proyecto reservo para "la
   calle por la que vas" (ver la skill de producto), y porque lo separa de un
   golpe de los nombres grises del mapa base.

   No alcanza con agrandar el rotulo del mapa base: ese texto sale de los tiles
   y no sabe cual de todas las calles es la que uno esta tomando. Este si, porque
   sale del motor de guiado.
--------------------------------------------------------------------------- */

/** Filtro que no deja pasar ninguna calle. Se usa para apagar el rotulo. */
const NINGUNA_CALLE = ['==', ['literal', '_'], ['literal', '']];

/**
 * Rotula en verde la calle por la que se esta yendo.
 *
 * @param {string|null} name Nombre de la calle, o null para borrar el rotulo.
 */
export function labelCurrentStreet(name) {
  if (!map) return;

  // Se rotula sobre la geometria DEL MAPA BASE, filtrando por nombre, y no
  // sobre el tramo de la ruta. Costo un intento entender por que:
  //
  // los tramos entre maniobras son cortisimos —medidos sobre una ruta real del
  // centro: 29 m, 69 m, 91 m, 251 m— y `symbol-placement: line` no dibuja nada
  // si el texto no entra a lo largo de la linea. A zoom 16, 29 m son 15 px y
  // "Avenida 9 de Julio" necesita unos 300: no aparecia casi nunca, y cuando
  // aparecia era por casualidad.
  //
  // La calle del mapa base, en cambio, viene entera en el tile, asi que hay
  // largo de sobra y ademas el texto sigue su curva. El precio es que si dos
  // calles distantes comparten nombre se rotulan las dos; en el entorno visible
  // eso practicamente no pasa.
  if (!map.getSource('base')) return;   // el mapa base cayo al raster: no hay que rotular

  if (!map.getLayer('calle-actual')) {
    // El estilo puede no estar listo todavia. Se REINTENTA, no se abandona: sin
    // esto, si el primer llamado cae antes de que el estilo termine de cargar,
    // la capa no se crea nunca y el nombre no aparece en todo el viaje — de
    // forma intermitente, segun quien conteste primero. Es la misma red que ya
    // tiene `drawRoute` por el mismo motivo.
    if (!map.isStyleLoaded()) {
      map.once('idle', () => labelCurrentStreet(name));
      return;
    }

    map.addLayer({
      id: 'calle-actual',
      type: 'symbol',
      source: 'base',
      'source-layer': 'roads',
      minzoom: 12,
      filter: NINGUNA_CALLE,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name']],
        'text-font': ['NotoSans-Regular'],
        // El mapa base rotula en 11 px. Esto va de 20 a 28 segun el zoom, o sea
        // entre 1,8x y 2,5x — no los 3x que pedia el brainstorm, y a proposito:
        // en 33 px el texto no entra en el largo visible de la calle y MapLibre
        // no dibuja NADA. Mas grande se ve menos, no mas.
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 20, 17, 28],
        'text-letter-spacing': 0.02,
        'symbol-spacing': 260,
        // Gana siempre: es el dato mas importante de la pantalla y no puede
        // perder una colision contra el nombre de una calle que no se toma.
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': token('--ok'),
        // Halo grueso: el texto pasa por encima de la linea de la ruta, que es
        // de color, y sin esto se pierde contra ella.
        'text-halo-color': token('--surface'),
        'text-halo-width': 2.8
      }
    });
  }

  map.setFilter('calle-actual', name
    ? ['==', ['coalesce', ['get', 'name:es'], ['get', 'name']], name]
    : NINGUNA_CALLE);
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
export const showRiskZones = (visible) => setRiskZonesVisible(map, visible);
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

  // El orden de esta lista ES la prioridad, y no es cosmetico: una zona de
  // riesgo cubre 250 m por lado, asi que cualquier toque adentro de una tambien
  // le pega a la zona. Si ganara la zona, un puente bajo parado encima de ella
  // dejaria de poder consultarse. Primero lo puntual, la zona al final.
  const orden = ['altura-senal', 'paso-senal', 'radar-punto', 'zona-riesgo-senal', 'zona-riesgo'];

  for (const id of orden) {
    if (!map.getLayer(id)) continue;

    const found = map.queryRenderedFeatures(point, { layers: [id] });
    if (!found.length) continue;

    // Las manchas de riesgo tienen 450 m de radio y se superponen de a varias,
    // asi que un toque cae adentro de un monton a la vez. Sin esto contestaria
    // la primera en orden de dibujo —una cualquiera— y el numero que aparece no
    // seria el del foco que uno esta viendo. Contesta la peor.
    if (id === 'zona-riesgo') {
      return found.reduce((peor, f) =>
        (f.properties?.hechos ?? 0) > (peor.properties?.hechos ?? 0) ? f : peor);
    }

    return found[0];
  }

  return null;
}
