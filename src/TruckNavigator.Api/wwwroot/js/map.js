/**
 * El mapa, detras de una interfaz chica.
 *
 * Todo lo que sabe de MapLibre vive aca. Las vistas piden "mostra esta ruta" o
 * "pone el origen en este punto" y no conocen ni una capa ni una fuente. Si
 * manana se cambia de biblioteca de mapas, se reescribe este archivo y nada mas.
 */

import { installTruckLayers, setLayerGroupVisible, applyLayerGroups, setCrossingsVisible, setTruckHeight, refreshLayerColors, truckDataset } from './layers.js';
import { registerPmtilesProtocol, buildBasemapStyle } from './mapa/estilo-mapa.js';
import { calcomania } from './mapa/piezas.js';
import { instalarLugares, mostrarLugares, CAPA_LUGARES } from './mapa/lugares.js';
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
let markers = { origin: null, destination: null, gps: null, flag: null };
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
      return;
    }

    // Con un oyente puesto, MapLibre deja de imprimir sus errores solo. Y un
    // estilo con una expresion mal formada falla justamente por aca, sin
    // excepcion: si no se reimprime, el sintoma es un mapa negro sin una linea
    // en la consola. Costo una tarde.
    console.error('Mapa: ' + (message || 'error sin detalle'), event?.error ?? event);
  });

  // El toque lleva ademas que hay debajo del dedo, si hay algo nuestro. Un
  // icono chico en un mapa no puede explicarse solo: tocarlo tiene que decir en
  // palabras que es. Sin esto, cada simbolo obliga a aprenderse una leyenda que
  // no existe.
  map.on('click', (event) => handlers.onTap?.(featureAt(event.point)));

  // Durante el viaje, si el usuario arrastra o pellizca el mapa, la camara deja
  // de seguir al camion hasta que toque "Volver a centrar" (waze-08). Solo los
  // gestos del usuario cuentan: easeTo tambien dispara estos eventos, pero sin
  // originalEvent, y ese es el que mueve la camara para seguir al vehiculo.
  for (const gesto of ['dragstart', 'zoomstart']) {
    map.on(gesto, (event) => {
      if (!navigating || !following || !event.originalEvent) return;
      following = false;
      handlers.onPan?.();
    });
  }

  // Las capas de camion se agregan apenas carga el estilo y antes de que
  // exista una ruta, para que la ruta quede dibujada por encima.
  map.on('load', async () => {
    await installTruckLayers(map);
    instalarLugares(map);
    handlers.onReady?.();
  });

  // 'load' se dispara UNA sola vez por mapa (medido el 17/09/2026): cambiar de
  // estilo —el raster de respaldo, el dia— no lo vuelve a disparar, y sin esto
  // el mapa nuevo quedaba sin la Red, sin galibos y sin lugares. 'style.load'
  // si se dispara en cada estilo; el primero ya lo cubre 'load'.
  let primerEstilo = true;

  map.on('style.load', async () => {
    if (primerEstilo) {
      primerEstilo = false;
      return;
    }

    await installTruckLayers(map);
    instalarLugares(map);
  });

  installLongPress();

  // Solo en desarrollo: el mapa a mano desde la consola, para calibrar el
  // estilo contra los tiles reales (que `kind` hay, como se ve una capa) sin
  // adivinar. En el telefono y en produccion no existe.
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.tnMap = map;
  }

  return map;
}

export function destroyMap() {
  map?.remove();
  map = null;
  markers = { origin: null, destination: null, gps: null, flag: null };
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

/**
 * La bandera a cuadros del destino, durante el viaje (waze-02). Reemplaza al
 * pin "B" del planificador: en viaje el destino es la llegada, no un punto
 * que se este eligiendo. Con null se saca.
 */
export function setDestinationFlag(coords) {
  if (!map) return;

  markers.flag?.remove();
  markers.flag = null;

  if (!coords) return;

  const element = document.createElement('div');
  element.className = 'gps-bandera';
  element.innerHTML = calcomania('bandera', 32);

  // El mastil esta a 8 px del borde izquierdo de la calcomania: se corre el
  // marcador para que su base caiga justo sobre el punto.
  markers.flag = new maplibregl.Marker({ element, anchor: 'bottom', offset: [8, 2] })
    .setLngLat([coords.lng, coords.lat])
    .addTo(map);
}

/**
 * Las paradas de un reparto, numeradas en el orden de visita.
 *
 * @param {Array<{lat:number, lng:number}>} paradas
 *   Ya en el orden en que se visitan. El numero que se dibuja es la posicion en
 *   esta lista, empezando por 1.
 *
 * Van como marcadores y no como una capa de simbolos porque tienen que
 * distinguirse del resto del mapa aunque haya galibos y radares encima: un
 * marcador se dibuja sobre todo el canvas y no compite por lugar.
 *
 * OJO al estilarlos: MapLibre le pone `position: absolute` al elemento y lo ubica
 * por `transform`. Declarar `position: relative` en `.pin` lo sacaria del mapa —
 * y con un solo marcador la posicion coincide igual, asi que no se nota hasta
 * que hay dos.
 */
export function setDeliveryStops(paradas) {
  if (!map) return;

  for (const marcador of deliveryMarkers) {
    marcador.remove();
  }

  deliveryMarkers = [];

  for (const [i, parada] of (paradas ?? []).entries()) {
    if (!Number.isFinite(parada?.lat) || !Number.isFinite(parada?.lng)) continue;

    deliveryMarkers.push(
      new maplibregl.Marker({ element: pinElement('pin-stop', String(i + 1)) })
        .setLngLat([parada.lng, parada.lat])
        .addTo(map));
  }
}

let deliveryMarkers = [];

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

   Como en Waze (waze-06, medido): una linea de 8 dp en celeste con un canto de
   1 dp blanco al 35 % que la despega del mapa. Encima, los tramos fuera de la
   Red en AMARILLO, que en toda la app significa "salis de la Red" — no naranja
   ni rojo: la norma admite salir de la Red para llegar al destino, asi que
   pintarlo como infraccion seria mentir sobre lo que dice la ley. El rojo
   nunca esta sobre una ruta (AD-47).

   Y sobre la ruta, la flecha blanca de la proxima maniobra: un pedazo de la
   ruta misma alrededor del giro, con la punta hacia donde se sigue. Es lo que
   Waze dibuja ademas de la banda, y se mueve cuando cambia la maniobra.
--------------------------------------------------------------------------- */

const ROUTE_LAYERS = ['route-casing', 'route-line', 'route-access', 'maniobra-canto', 'maniobra-linea', 'maniobra-punta', 'globo', 'globo-punto'];
const ROUTE_SOURCES = ['route', 'route-access', 'maniobra', 'maniobra-fin', 'globos'];

/** Ancho de la ruta en px de pantalla y de su canto (1 dp por lado). */
const ROUTE_WIDTH = 8;
const ROUTE_CASING = ROUTE_WIDTH + 2;

/** Que maniobra tiene la flecha puesta, para no rehacerla en cada latido. */
let maniobraDibujada = null;

/** Que paso del viaje tiene los globos puestos, por lo mismo. */
let globosDibujados = null;

export function clearRoute() {
  if (!map) return;

  ROUTE_LAYERS.forEach((id) => map.getLayer(id) && map.removeLayer(id));
  ROUTE_SOURCES.forEach((id) => map.getSource(id) && map.removeSource(id));
  maniobraDibujada = null;
  globosDibujados = null;
}

/**
 * @param {object} route respuesta de la API
 * @param {Array}  accessLegs tramos que usan la excepcion de acceso
 * @param {{top:number,bottom:number,left:number,right:number}} [encuadre]
 *   el aire alrededor de la ruta al encuadrarla; sin el, el de la hoja inferior
 */
export function drawRoute(route, accessLegs = [], encuadre = undefined) {
  if (!map || !route?.geometry?.coordinates?.length) return;

  // El estilo puede no haber terminado de cargar cuando llega la ruta: agregar
  // una fuente antes de eso hace que MapLibre tire "Style is not done loading",
  // la excepcion sube hasta el llamador y la ruta no se dibuja nunca.
  //
  // Es intermitente por naturaleza —depende de si contesto antes el servidor o
  // los tiles—, asi que se espera a que el mapa quede quieto y se reintenta.
  if (!map.isStyleLoaded()) {
    map.once('idle', () => drawRoute(route, accessLegs, encuadre));
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
  // Sin esto la ruta tapa justamente el nombre de la calle por la que se va,
  // que es el dato que el conductor mas necesita durante el viaje. La ruta se
  // sigue viendo igual: es una linea gruesa y de color, y el texto encima
  // lleva halo.
  const antesDeNombres = map.getLayer('calles-nombre') ? 'calles-nombre' : undefined;

  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ROUTE_CASING, 'line-opacity': .35 }
  }, antesDeNombres);

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': token('--gps-ruta'), 'line-width': ROUTE_WIDTH }
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
      paint: { 'line-color': token('--gps-amarillo'), 'line-width': ROUTE_WIDTH }
    }, antesDeNombres);
  }

  fitTo(coordinates, encuadre);
}

/**
 * Dibuja la flecha blanca de la proxima maniobra sobre la calle.
 *
 * @param {{coordinates: number[][], bearing: number}|null} flecha
 *   la salida de `maneuverArrowPath`, o null para sacarla
 * @param {number|null} clave que maniobra es (su indice), para no redibujar
 *   la misma en cada posicion del GPS
 */
export function showManeuver(flecha, clave = null) {
  if (!map) return;

  if (!flecha) {
    ['maniobra-punta', 'maniobra-linea', 'maniobra-canto'].forEach((id) => map.getLayer(id) && map.removeLayer(id));
    ['maniobra-fin', 'maniobra'].forEach((id) => map.getSource(id) && map.removeSource(id));
    maniobraDibujada = null;
    return;
  }

  if (clave !== null && clave === maniobraDibujada) return;

  if (!map.isStyleLoaded() || !map.getLayer('route-line')) {
    map.once('idle', () => showManeuver(flecha, clave));
    return;
  }

  const linea = { type: 'Feature', geometry: { type: 'LineString', coordinates: flecha.coordinates } };
  const fin = {
    type: 'Feature',
    properties: { rumbo: flecha.bearing },
    geometry: { type: 'Point', coordinates: flecha.coordinates[flecha.coordinates.length - 1] }
  };

  if (map.getSource('maniobra')) {
    map.getSource('maniobra').setData(linea);
    map.getSource('maniobra-fin').setData(fin);
    maniobraDibujada = clave;
    return;
  }

  // `lineMetrics` habilita el degradado a lo largo de la linea: la cola de la
  // flecha nace tenue sobre la ruta y se hace blanca hacia el giro.
  //
  // Estas tres capas van ENCIMA de todo, nombres incluidos: en el momento de
  // la maniobra la flecha es lo unico que importa, y un rotulo que la tape es
  // un rotulo que se lee despues de doblar.
  map.addSource('maniobra', { type: 'geojson', lineMetrics: true, data: linea });
  map.addSource('maniobra-fin', { type: 'geojson', data: fin });

  // Los globos de las calles, si ya estan, quedan encima de la flecha.
  const antesDeGlobos = map.getLayer('globo-punto') ? 'globo-punto' : undefined;

  map.addLayer({
    id: 'maniobra-canto',
    type: 'line',
    source: 'maniobra',
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-width': 9,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(20,26,34,.25)', .2, 'rgba(20,26,34,.9)', 1, 'rgba(20,26,34,.9)']
    }
  }, antesDeGlobos);

  map.addLayer({
    id: 'maniobra-linea',
    type: 'line',
    source: 'maniobra',
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-width': 6,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(255,255,255,.3)', .2, 'rgba(255,255,255,1)', 1, 'rgba(255,255,255,1)']
    }
  }, antesDeGlobos);

  ensureArrowHead();

  map.addLayer({
    id: 'maniobra-punta',
    type: 'symbol',
    source: 'maniobra-fin',
    layout: {
      'icon-image': 'maniobra-punta',
      'icon-size': 1,
      'icon-rotate': ['get', 'rumbo'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      // La punta se apoya en el final de la linea: el ancla va abajo.
      'icon-anchor': 'bottom'
    }
  }, antesDeGlobos);

  maniobraDibujada = clave;
}

/**
 * La punta de la flecha, dibujada en un canvas una sola vez: blanca con el
 * mismo canto oscuro que la linea. Apunta al norte; la capa la rota.
 */
function ensureArrowHead() {
  if (map.hasImage('maniobra-punta')) return;

  const escala = window.devicePixelRatio || 1;
  const ancho = 22;
  const alto = 18;
  const canvas = document.createElement('canvas');
  canvas.width = ancho * escala;
  canvas.height = alto * escala;

  const g = canvas.getContext('2d');
  g.scale(escala, escala);
  g.lineJoin = 'round';

  const punta = () => {
    g.beginPath();
    g.moveTo(ancho / 2, 1);
    g.lineTo(ancho - 1, alto - 1);
    g.lineTo(ancho / 2, alto - 6);
    g.lineTo(1, alto - 1);
    g.closePath();
  };

  punta();
  g.strokeStyle = 'rgba(20,26,34,.9)';
  g.lineWidth = 3;
  g.stroke();

  punta();
  g.fillStyle = '#ffffff';
  g.fill();

  map.addImage('maniobra-punta', g.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: escala });
}

/* ---------------------------------------------------------------------------
   Los globos de las calles que vienen

   Como en waze-06: un globo de 30 dp con radio 7 en el azul del globo, el
   nombre en 18 sp negrita blanco, y la cola apuntando al punto de la calle
   donde arranca, marcado con un punto blanco. El globo es UNA imagen de nueve
   partes que MapLibre estira alrededor del texto (`icon-text-fit`), asi que
   sirve para "Junin" y para "Av. de los / Constituyentes" en dos lineas.
--------------------------------------------------------------------------- */

/**
 * Dibuja los globos que devuelve `globosDeRuta`.
 *
 * @param {{lineas: string[], punto: number[]}[]} globos
 * @param {number|null} clave el paso del viaje; con la misma clave no se redibuja
 */
export function showBalloons(globos, clave = null) {
  if (!map) return;

  if (!globos?.length) {
    ['globo', 'globo-punto'].forEach((id) => map.getLayer(id) && map.removeLayer(id));
    if (map.getSource('globos')) map.removeSource('globos');
    globosDibujados = null;
    return;
  }

  if (clave !== null && clave === globosDibujados) return;

  if (!map.isStyleLoaded()) {
    map.once('idle', () => showBalloons(globos, clave));
    return;
  }

  const data = {
    type: 'FeatureCollection',
    features: globos.map((globo) => ({
      type: 'Feature',
      properties: { texto: globo.lineas.join('\n') },
      geometry: { type: 'Point', coordinates: globo.punto }
    }))
  };

  if (map.getSource('globos')) {
    map.getSource('globos').setData(data);
    globosDibujados = clave;
    return;
  }

  ensureBalloonImage();
  map.addSource('globos', { type: 'geojson', data });

  // El punto blanco en la calle, con un canto oscuro para que se vea sobre la ruta.
  map.addLayer({
    id: 'globo-punto',
    type: 'circle',
    source: 'globos',
    paint: {
      'circle-radius': 4.5,
      'circle-color': '#ffffff',
      'circle-stroke-color': 'rgba(20,26,34,.9)',
      'circle-stroke-width': 2
    }
  });

  map.addLayer({
    id: 'globo',
    type: 'symbol',
    source: 'globos',
    layout: {
      'icon-image': 'globo',
      'icon-text-fit': 'both',
      // El aire alrededor del texto lo pone el marco de la imagen (5 px, ver
      // ensureBalloonImage): asi el globo mide 30 con una linea y 48 con dos,
      // como en Waze.
      'icon-text-fit-padding': [0, 0, 0, 0],
      'text-field': ['get', 'texto'],
      'text-font': ['NotoSans-Bold'],
      'text-size': 18,
      'text-line-height': 1.05,
      'text-justify': 'center',
      // El globo cuelga arriba y a la izquierda del punto, con la cola en el punto.
      'text-anchor': 'bottom-right',
      // La cola termina 8 px arriba y a la izquierda del punto, para no taparlo.
      'text-offset': [-0.56, -1.22],
      'text-allow-overlap': true,
      'icon-allow-overlap': true,
      'text-ignore-placement': true,
      'icon-ignore-placement': true
    },
    paint: { 'text-color': '#ffffff' }
  });

  globosDibujados = clave;
}

/**
 * La imagen del globo: caja redondeada con la cola abajo a la derecha. Se
 * dibuja una vez, en un canvas, y se registra con las zonas estirables (todo
 * menos las esquinas y la cola) y el rectangulo donde va el texto.
 */
function ensureBalloonImage() {
  if (map.hasImage('globo')) return;

  const escala = window.devicePixelRatio || 1;
  const ancho = 48;
  const caja = 30;     // alto de la caja sin la cola
  const cola = 10;     // lo que baja la cola por debajo de la caja
  const radio = 7;
  const marco = 5;     // aire entre el texto y el borde de la caja, medido en waze-06
  const alto = caja + cola;

  const canvas = document.createElement('canvas');
  canvas.width = ancho * escala;
  canvas.height = alto * escala;

  const g = canvas.getContext('2d');
  g.scale(escala, escala);
  g.fillStyle = token('--gps-globo') || '#1d7699';

  // La caja.
  g.beginPath();
  g.roundRect(0, 0, ancho, caja, radio);
  g.fill();

  // La cola: un triangulo que sale del borde de abajo, a la derecha, y
  // termina en la esquina inferior derecha de la imagen.
  g.beginPath();
  g.moveTo(ancho - 16, caja - 1);
  g.lineTo(ancho - 1, alto - 1);
  g.lineTo(ancho - 5, caja - 1);
  g.closePath();
  g.fill();

  map.addImage('globo', g.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: escala,
    // Se estira el medio de la caja; las esquinas y la cola quedan como estan.
    stretchX: [[radio + 1, ancho - 16]],
    stretchY: [[radio + 1, caja - radio - 1]],
    // El texto va adentro de la caja, a 5 px del borde, nunca sobre la cola.
    content: [marco, marco, ancho - marco, caja - marco]
  });
}

function fitTo(coordinates, padding = { top: 90, bottom: 320, left: 40, right: 40 }, camara = {}) {
  if (!map || !coordinates?.length) return;

  const bounds = coordinates.reduce(
    (box, coord) => box.extend(coord),
    new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
  );

  map.fitBounds(bounds, {
    // Deja aire arriba para la barra y abajo para la hoja inferior.
    padding,
    duration: 600,
    ...camara
  });
}

/**
 * Encuadra la ruta entera, cenital y mirando al norte: la vista general del
 * viaje (waze-02). El aire de arriba y de abajo lo dice quien llama, porque
 * sabe que tiene puesto sobre el mapa.
 */
export function fitRoute(coordinates, padding) {
  fitTo(coordinates, padding, { pitch: 0, bearing: 0 });
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

/** Si la camara sigue al camion. Se suelta con un gesto y se retoma a pedido. */
let following = true;
let lastVehicle = null;

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
  following = true;

  // Los pasos a nivel aparecen recien ahora. Son 312 en la Ciudad y fuera del
  // viaje no cambian ninguna decision: solo llenan de chapas la pantalla en la
  // que uno esta armando la ruta.
  setCrossingsVisible(map, true);

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
  following = true;
  lastVehicle = null;

  setCrossingsVisible(map, false);

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
  lastVehicle = { coords, bearing };

  if (!navigating || !following) return;

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

/** Si la camara esta siguiendo al camion. */
export const isFollowing = () => following;

/**
 * Vuelve a seguir al camion: la camara va a donde esta ahora, con la
 * perspectiva del viaje, y el proximo latido del GPS ya la encuentra ahi.
 */
export function setFollowing(si) {
  following = Boolean(si);

  if (following && navigating && lastVehicle) {
    followVehicle(lastVehicle.coords, lastVehicle.bearing);
  }
}

function placeVehicle(coords, bearing) {
  if (!vehicleMarker) {
    // El chevron de Waze (waze-06, medido): 40 x 39, celeste con canto blanco
    // y una base clara que lo hace ver apoyado sobre el mapa, encima de un
    // disco de 82 apenas mas claro que la calle. Se apilan en una grilla y no
    // con `position: absolute`, que a un marcador de MapLibre lo saca del mapa.
    const element = document.createElement('div');
    element.className = 'gps-chevron';
    element.innerHTML =
      '<div class="gps-chevron-disco"></div>' +
      '<svg viewBox="0 0 40 44" width="40" height="44" aria-hidden="true">' +
      '<path d="M20 9 L35 35 L20 29 L5 35 Z" fill="#d7e0e3" stroke="#d7e0e3" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M20 4 L35 30 L20 24 L5 30 Z" fill="var(--gps-chevron)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>' +
      '</svg>';

    vehicleMarker = new maplibregl.Marker({
      element,
      // El marcador rota con el mapa para que la flecha apunte siempre hacia
      // donde avanza el camion; se mantiene de pie con la camara inclinada.
      rotationAlignment: 'map',
      pitchAlignment: 'viewport'
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

/** Un cuadro de la hoja de capas: red, galibo, paso, radar o zona. */
export const showLayerGroup = (grupo, visible) => setLayerGroupVisible(map, grupo, visible);
export const applyLayers = (capas) => applyLayerGroups(map, capas);

/** Los datasets de camion, para que el motor de avisos los cruce con la ruta. */
export const datasets = () => ({
  galibos: truckDataset('alturas'),
  pasos: truckDataset('pasos'),
  radares: truckDataset('radares')
});
export const useTruckHeight = (metres) => setTruckHeight(map, metres);
export const refreshColors = () => refreshLayerColors(map);

/** El centro del mapa, donde cae el pin fijo al marcar un lugar. */
export function center() {
  if (!map) return null;
  const { lat, lng } = map.getCenter();
  return { lat, lng };
}

/**
 * Los lugares (puntos de interes) sobre el mapa, como pines. Con el estilo a
 * medio cargar se espera, como con la ruta: la fuente todavia no existe.
 */
export function showPlaces(pois) {
  if (!map) return;

  if (!map.isStyleLoaded()) {
    map.once('idle', () => showPlaces(pois));
    return;
  }

  instalarLugares(map);
  mostrarLugares(map, pois);
}

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
  const orden = [CAPA_LUGARES, 'altura-senal', 'paso-senal', 'radar-punto', 'zona-riesgo-senal', 'zona-riesgo'];

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
