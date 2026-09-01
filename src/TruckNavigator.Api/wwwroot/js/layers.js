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
  pasos: 'data/pasos-a-nivel.geojson',
  radares: 'data/radares-velocidad.geojson',
  zonas: 'data/zonas-riesgo.geojson'
};

/**
 * Ids de las capas de CAMION, para prenderlas y apagarlas juntas.
 *
 * Los radares quedan afuera a proposito: no son un dato de camion sino de
 * transito, le sirven igual a cualquiera y no tienen por que apagarse junto con
 * los galibos. Waze y Maps tampoco los esconden.
 */
const LAYER_IDS = [
  'red-linea', 'red-nombre',
  'altura-senal'
];

/**
 * Los pasos a nivel dependen de DOS cosas a la vez, y por eso no estan en
 * `LAYER_IDS`: del boton de capas de camion, como el resto, y ademas de que haya
 * un viaje en curso. Se guardan los dos estados por separado porque cada uno
 * llega por su lado y ninguno sabe del otro; si el bucle generico los tocara,
 * prender las capas de camion los haria aparecer fuera del viaje.
 */
let truckLayersOn = true;
let navigating = false;

function aplicarPasos(map) {
  if (!map?.getLayer('paso-senal')) return;

  map.setLayoutProperty('paso-senal', 'visibility',
    truckLayersOn && navigating ? 'visible' : 'none');
}

/**
 * Las capas de zonas peligrosas, que se prenden y apagan APARTE.
 *
 * Tienen su propio boton y no viajan con las de camion. Son dos cosas distintas:
 * los galibos y la Red son datos oficiales sobre por donde puede pasar el
 * vehiculo; esto es el juicio de gente que trabaja en la calle sobre donde no
 * conviene parar. Quien quiera una no necesariamente quiere la otra.
 */
const RISK_LAYER_IDS = ['zona-riesgo-calor', 'zona-riesgo', 'zona-riesgo-senal'];

const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Los datasets tal como se descargaron, para quien necesite leerlos.
 *
 * El motor de avisos cruza la ruta entera contra los galibos, los pasos a nivel
 * y los radares, y eso no se puede hacer con `querySourceFeatures`: ese devuelve
 * lo que hay dibujado en pantalla, o sea lo que uno ya esta viendo — no lo que
 * viene mas adelante en el camino, que es justo lo que hay que avisar.
 */
const descargados = {};

export const truckDataset = (key) => descargados[key] ?? null;

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

    // Se guarda ademas del alta en el mapa: el motor de avisos necesita cruzar
    // la ruta contra estos puntos, y `querySourceFeatures` solo devuelve lo que
    // hay dibujado en pantalla — serviria para lo que se ve, no para lo que
    // viene mas adelante en el camino, que es justo lo que hay que avisar.
    descargados[dataset.key] = dataset.data;
  }

  // Cada capa se instala por separado y con su propia red. Antes iban sueltas y
  // una expresion mal formada en la primera se llevaba puestas a las otras
  // cuatro sin dejar rastro: el mapa aparecia sin galibos, sin pasos a nivel y
  // sin radares, y no habia nada en la consola que dijera por que.
  //
  // Las zonas van PRIMERO: son un sombreado de area y tienen que quedar debajo
  // de todo lo demas. Ver addRiskZoneLayers.
  const capas = [
    ['zonas de riesgo', addRiskZoneLayers],
    ['Red de Transito Pesado', addRedLayers],
    ['galibos', addHeightLayers],
    ['pasos a nivel', addCrossingLayers],
    ['radares', addSpeedCameraLayers]
  ];

  for (const [nombre, instalar] of capas) {
    try {
      instalar(map);
    } catch (error) {
      console.error(`No se pudieron instalar las capas de ${nombre}: ${error.message}`);
    }
  }
}

/* ---------------------------------------------------------------------------
   Zonas peligrosas

   Fuente: mapa colaborativo "Zonas Peligrosas" de Google My Maps, que circula
   entre repartidores del AMBA. Lo genera `data/fetch-zonas-riesgo.ps1`, que se
   queda con los 19 poligonos que tocan CABA —8,8 km2, el 4,3% de la Ciudad— y
   los recorta al limite de la Ciudad.

   POR QUE NO ES EL DATO OFICIAL DE DELITOS

   Se intento antes con el Mapa del Delito del GCBA y hubo que descartarlo, por
   dos motivos que conviene no repetir:

   1. Contar delitos denunciados mide DONDE HAY GENTE, no donde hay peligro.
      Palermo encabezaba la Ciudad. Filtrar a robos a mano armada corregia parte
      del sesgo —Villa Soldati tiene 42% de robos con arma contra 6% de Palermo—
      pero no el fondo.
   2. El dataset cubre exactamente CABA, asi que el mapa de calor terminaba
      dibujando la silueta de la Ciudad: un manchon rojo con la forma del limite
      administrativo, que decia "toda la Ciudad es peligrosa y el conurbano es
      seguro". Absurdo, y al reves de la realidad.

   El problema de fondo es que un conteo de hechos no es un mapa de peligro. Las
   zonas que un repartidor evita son un juicio, y este mapa las tiene marcadas a
   mano por gente que anda por ahi todos los dias. Caen donde uno esperaria:
   Villa Soldati, Villa 21-24, Villa Lugano, Villa 31, Villa 1-11-14, La Boca.

   LO QUE ESTE DATO NO ES

   - **No es oficial.** Autoria anonima, sin metodologia escrita, sin fecha y sin
     licencia declarada. El toque lo dice con todas las letras.
   - **No tiene grados.** Los poligonos son todos iguales y ninguno se superpone
     con otro dentro de CABA: hay dos estados, marcada y no marcada.
   - **Que una zona no este marcada NO significa que sea segura.** Significa que
     nadie la marco. Por eso la app no dice "zona segura" en ningun lado.

   COMO SE DIBUJA: mapa de calor sobre puntos muestreados adentro de las zonas.

   El script rellena cada poligono con puntos cada 60 m y el `heatmap` los
   difumina. Dos razones: una capa `heatmap` solo acepta puntos, y el difuminado
   evita prometer un borde exacto que este dato no tiene — el limite de una zona
   marcada a mano no es una linea, es un degradado.

   El calor se prende y apaga con su propio boton, aparte de las capas de camion.
   Arranca APAGADO: es dato de comunidad, cubre area, y no es lo que uno necesita
   para manejar.
--------------------------------------------------------------------------- */

/**
 * Colores de la escala de calor. Fijos, como el resto de las señales.
 *
 * Va de amarillo a rojo y no de verde a rojo a proposito: no hay ningun nivel
 * "seguro" que justifique un verde. Donde no hay zona marcada no se pinta nada,
 * que es distinto de pintar de verde — nadie reviso ese lugar y decirlo seguro
 * seria inventar.
 */
const RIESGO = {
  alta:       '#f2b705',
  'muy-alta': '#e8590c',
  extrema:    '#c92a2a'
};

/**
 * Radio del calor, en pixeles, para que represente siempre los mismos metros.
 *
 * `heatmap-radius` se declara en pixeles de pantalla, asi que dejarlo fijo haria
 * que la mancha cubra cada vez menos terreno al acercarse: el foco pareceria
 * encogerse cuando no cambio nada. Se compensa doblandolo en cada nivel de zoom,
 * que es como funciona la escala del mapa.
 *
 * A diferencia de la version por celdas, aca NO hace falta que supere ninguna
 * separacion: los hechos estan donde ocurrieron y no hay grilla que disimular.
 *
 * Pero el radio NO representa los mismos metros en todo el rango, y es a
 * proposito. Va de unos 280 m en zoom 11 a unos 150 m en zoom 17: de lejos hace
 * falta suavizar mas para que se lea el patron —si no, con 5.551 puntos sueltos
 * el mapa queda en un puntillismo donde no se distingue ningun foco— y de cerca
 * conviene ser mas fiel al lugar donde ocurrio cada hecho.
 */
const radioCalor = ['interpolate', ['linear'], ['zoom'], 11, 9, 13, 24, 15, 60, 17, 150];

function addRiskZoneLayers(map) {
  if (!map.getSource('zonas') || map.getLayer('zona-riesgo')) return;

  registrarIconos(map);

  // Debajo de las etiquetas del mapa base: el calor no puede tapar los nombres
  // de las calles, que es lo que el conductor necesita para ubicarse.
  const primerTexto = map.getStyle().layers.find((capa) => capa.type === 'symbol')?.id;

  map.addLayer({
    id: 'zona-riesgo-calor',
    type: 'heatmap',
    source: 'zonas',
    filter: ['==', ['get', 't'], 'h'],
    paint: {
      // Todos los hechos pesan igual: cada uno es un robo a mano armada. La
      // seleccion ya se hizo al elegir QUE contar, y ponderar de nuevo aca seria
      // apilar una escala arriba de otra.
      'heatmap-weight': 1,
      'heatmap-radius': radioCalor,
      // Sube con el zoom para compensar que el radio crece: sin esto la misma
      // cantidad de hechos se reparte sobre mas pixeles y el color se lava. Los
      // valores son bajos porque el radio ya es generoso — con 1,4 en zoom 12 la
      // Ciudad entera saturaba en rojo.
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.35, 14, 0.5, 17, 0.9],
      // Rampa de calor. El primer tramo llega hasta 0,35 y arranca casi
      // transparente, y eso es lo que decide cuanto mapa queda pintado: un hecho
      // suelto no alcanza para teñir nada, hace falta que varios coincidan. Con
      // el corte en 0,12 aparecia un fondo amarillo por toda la Ciudad y volvia
      // la sensacion de que todo es igual de peligroso, que es justo lo que esta
      // capa tiene que evitar.
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.35, 'rgba(242,183,5,0.07)',
        0.55, 'rgba(242,183,5,0.34)',
        0.70, 'rgba(232,89,12,0.56)',
        0.86, 'rgba(201,42,42,0.74)',
        1,    'rgba(140,16,16,0.90)'
      ],
      // Se destiñe al acercarse: de lejos el patron es la informacion, de cerca
      // la informacion es la calle y el calor tiene que dejarla ver.
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.95, 15, 0.8, 18, 0.55]
    }
  }, primerTexto);

  // Invisible y a proposito: es la que contesta el toque. Una capa `heatmap` no
  // devuelve nada en queryRenderedFeatures, asi que sin esto el calor no podria
  // decir de que zona se trata. Opacidad cero, no `visibility: none` — una capa
  // oculta tampoco se consulta.
  //
  // Va como `fill` y no como `circle` porque las zonas son POLIGONOS: una capa
  // `circle` de MapLibre solo dibuja puntos, y con un poligono no dibuja nada ni
  // contesta nada, sin emitir un solo error.
  map.addLayer({
    id: 'zona-riesgo',
    type: 'fill',
    source: 'zonas',
    filter: ['==', ['get', 't'], 'f'],
    paint: { 'fill-opacity': 0 }
  }, primerTexto);

  // Un triangulo por zona, en su centroide. Son 19: no hace falta filtrar por
  // gravedad porque este dato no tiene grados — una zona esta marcada o no.
  map.addLayer({
    id: 'zona-riesgo-senal',
    type: 'symbol',
    source: 'zonas',
    minzoom: 12,
    filter: ['==', ['get', 't'], 'f'],
    layout: {
      'icon-image': 'senal-riesgo',
      'icon-size': tamanoSenal,
      // Hay zonas pegadas —Villa Soldati y Villa Lugano se tocan— y sin esto
      // salen dos triangulos a un centimetro uno del otro.
      'icon-allow-overlap': false,
      'icon-padding': 28
    }
  });
}

/** Prende o apaga el mapa de zonas peligrosas. */
export function setRiskZonesVisible(map, visible) {
  if (!map) return;

  for (const id of RISK_LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

/* ---------------------------------------------------------------------------
   Radares de velocidad

   Dato oficial: "Camaras fijas de control vehicular" de Buenos Aires Data
   (CC-BY-2.5-AR), filtrado a los 129 cinemometros. Las otras 95 camaras del
   dataset son de analitica de video —semaforo en rojo, celular, cinturon— y NO
   son radares: marcarlas como tales seria inventar.

   El pedido era que se vean sin recargar el mapa. Tres decisiones para eso, en
   la linea de lo que hacen Waze y Maps:

     · no aparecen hasta el zoom 13. Con la ciudad entera en pantalla, 129
       chinches no informan: tapan;
     · `icon-allow-overlap: false` deja que MapLibre descarte los que chocan
       entre si, asi que la densidad se autolimita al acercarse;
     · el icono es chico y de color fijo, no compite con la ruta ni con los
       galibos, que son lo que el conductor tiene que mirar primero.
--------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   Las señales del mapa

   Todo lo que se dibuja encima del mapa es una CHAPA: un disco claro con un
   anillo de color y un dibujo adentro. Tres razones:

   1. Un numero suelto no dice nada. "5,10" en un circulo gris puede ser
      cualquier cosa; un disco con anillo rojo y un numero adentro es la señal
      de gabito que el camionero ya vio mil veces en la calle. Se apoya en algo
      que ya sabe en vez de pedirle que aprenda una leyenda.
   2. Los colores son FIJOS, no salen del tema. Una imagen se registra una sola
      vez y no se repinta al pasar de dia a noche, asi que tiene que leerse en
      los dos — y ademas las señales de transito de verdad tampoco cambian de
      color segun la hora.
   3. El disco claro con borde oscuro se despega de cualquier cartografia, que
      es lo que hacen los pines de Maps y las chapas de Waze.

   NO se usan emojis: los glifos vendorizados llegan hasta el caracter 511, asi
   que una camara (U+1F4F7) no se dibujaria — sin error, simplemente ausente.
--------------------------------------------------------------------------- */

/**
 * Colores de señal. Fijos a proposito: ver el punto 2 de arriba.
 *
 * El anillo dice de que FAMILIA es la señal antes de que se distinga el dibujo:
 *
 *   rojo / ambar / pizarra  →  esto te puede afectar A VOS y a tu camion
 *   azul                    →  informacion de transito, no un riesgo del vehiculo
 *
 * Sin esa separacion, un radar y un puente que pasa holgado quedaban los dos con
 * anillo pizarra y a un metro de distancia se confundian.
 */
const SENAL = {
  peligro:  '#e03131',
  atencion: '#e8940c',
  neutro:   '#41545f',
  info:     '#1668a8',
  tinta:    '#16232b',
  chapa:    '#ffffff'
};

/** Lado del lienzo. Se dibuja al doble y se declara pixelRatio 2. */
const LADO = 56;

/**
 * Crecimiento con el zoom, comun a todas las señales.
 *
 * Arranca en 0,85 —unos 24 px— y no mas chico. La primera version usaba 0,6 y en
 * el telefono las chapas quedaban del tamaño de una arveja: el dibujo de adentro
 * no se distinguia y no se sabia que eran. Un simbolo ilegible no informa, solo
 * ensucia. Los marcadores de Maps y Waze rondan los 30 px por algo.
 */
const tamanoSenal = ['interpolate', ['linear'], ['zoom'], 13, 0.85, 15, 1, 17, 1.15];

/** Disco claro con anillo de color y una sombra que lo despega del mapa. */
function chapa(anillo) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LADO;

  const ctx = canvas.getContext('2d');
  const c = LADO / 2;

  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.arc(c, c, 21, 0, Math.PI * 2);
  ctx.fillStyle = SENAL.chapa;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  ctx.lineWidth = 5;
  ctx.strokeStyle = anillo;
  ctx.beginPath();
  ctx.arc(c, c, 18.5, 0, Math.PI * 2);
  ctx.stroke();

  return { canvas, ctx, c };
}

const imagen = ({ canvas, ctx }) => ctx.getImageData(0, 0, canvas.width, canvas.height);

/**
 * Rectangulo redondeado, a mano.
 *
 * No se usa `ctx.roundRect` aunque exista en los navegadores modernos: adentro
 * del WebView de Android es la clase de API que conviene no dar por sentada, y
 * si tirara excepcion se llevaria puesta el alta de TODAS las capas.
 */
function rectangulo(ctx, x, y, ancho, alto, radio) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
  ctx.fill();
}

/**
 * Galibo: un puente visto de frente.
 *
 * La chapa lleva el DIBUJO, no el numero. Primero se probo al reves —anillo
 * vacio con la altura adentro, como la señal de la calle— y en el telefono se
 * veian circulos blancos huecos: el numero no entra en un disco de veinte pixeles
 * y, cuando no entraba, la chapa quedaba muda. Un simbolo que a veces no dice
 * nada es peor que no tenerlo.
 *
 * Ahora el arco dice "puente" siempre, y la altura va como etiqueta debajo,
 * donde tiene lugar para leerse. Es como rotula los puntos cualquier mapa.
 */
function senalGalibo(anillo) {
  const { canvas, ctx, c } = chapa(anillo);

  // EL MISMO DIBUJO que el boton de capas de camion, que usa `icon('bridge')`
  // de ui.js: `M3 8h18 · M5 8v10 · M19 8v10 · M9 18v-5a3 3 0 0 1 6 0v5`.
  //
  // Que el boton que prende los galibos y la señal que aparece en el mapa sean
  // el mismo puente no es un detalle estetico: es lo que hace que uno entienda
  // sin leer nada que ese boton controla estas señales. Antes eran dos puentes
  // distintos, dibujados cada uno por su lado.
  //
  // Se traduce del viewBox de 24 al lienzo de la chapa. La escala y el centro se
  // calculan aca para que el dibujo siga al tamaño de la chapa si cambia.
  const escala = 1.05;
  const px = (x) => c + (x - 12) * escala;
  const py = (y) => c + (y - 13) * escala;

  ctx.strokeStyle = SENAL.tinta;
  ctx.lineWidth = 2.2 * escala;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();

  // El tablero.
  ctx.moveTo(px(3), py(8));
  ctx.lineTo(px(21), py(8));

  // Los dos pilares.
  ctx.moveTo(px(5), py(8));
  ctx.lineTo(px(5), py(18));
  ctx.moveTo(px(19), py(8));
  ctx.lineTo(px(19), py(18));

  // El vano: sube, media vuelta y baja. Es el `a3 3 0 0 1 6 0` del path.
  ctx.moveTo(px(9), py(18));
  ctx.lineTo(px(9), py(13));
  ctx.arc(px(12), py(13), 3 * escala, Math.PI, 0);
  ctx.lineTo(px(15), py(18));

  ctx.stroke();

  return imagen({ canvas, ctx });
}

/** Paso a nivel: la cruz de San Andres, que es la señal real del cruce. */
function senalPaso(anillo) {
  const { canvas, ctx, c } = chapa(anillo);
  const brazo = 8;

  ctx.strokeStyle = SENAL.tinta;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(c - brazo, c - brazo); ctx.lineTo(c + brazo, c + brazo);
  ctx.moveTo(c + brazo, c - brazo); ctx.lineTo(c - brazo, c + brazo);
  ctx.stroke();

  return imagen({ canvas, ctx });
}

/** Radar: una camara, simplificada al maximo para que se lea a 20 px. */
function senalRadar() {
  const { canvas, ctx, c } = chapa(SENAL.info);

  // Camara de vigilancia de cuerpo largo, la silueta que todo el mundo reconoce
  // como "te estan filmando": carcasa inclinada, lente al frente y brazo a la
  // pared. La anterior era una camara de fotos —cuerpo chato con visor arriba—,
  // que se lee como "sacar una foto" y no como un control de velocidad.
  //
  // Va dibujada a mano y no como emoji: los glifos vendorizados llegan hasta el
  // caracter 511 y una camara (U+1F4F7) no se dibujaria, sin dar error.
  ctx.fillStyle = SENAL.tinta;
  ctx.strokeStyle = SENAL.tinta;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  // El soporte, de atras hacia adelante: base contra la pared, brazo y pivote.
  ctx.beginPath();
  ctx.moveTo(c + 9.5, c + 2.5);
  ctx.quadraticCurveTo(c + 13.5, c + 7, c + 9.5, c + 11.5);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c + 1, c + 7);
  ctx.lineTo(c + 10, c + 7);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c + 0.5, c + 7, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // El cuerpo: bloque alargado que baja hacia el morro, donde va el lente. El
  // morro tiene que ser MAS ALTO que el diametro del lente — con el lente mas
  // grande que la punta, el circulo se sale del cuerpo y el dibujo deja de
  // leerse como una camara.
  ctx.beginPath();
  ctx.moveTo(c - 13, c - 4);       // morro, arriba
  ctx.lineTo(c + 5, c - 10);       // cola, arriba
  ctx.lineTo(c + 9, c - 2.5);      // cola, abajo
  ctx.lineTo(c - 10, c + 4.5);     // morro, abajo
  ctx.closePath();
  ctx.fill();

  // El lente, sobre la punta: hueco claro con la pupila oscura adentro.
  ctx.beginPath();
  ctx.arc(c - 10.6, c + 0.2, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = SENAL.chapa;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c - 10.6, c + 0.2, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = SENAL.tinta;
  ctx.fill();

  return imagen({ canvas, ctx });
}

/**
 * Triangulo de advertencia para las zonas de riesgo extremo.
 *
 * Es la unica señal que NO es una chapa redonda, y eso es deliberado: la forma
 * separa antes que el color. Un galibo, un paso a nivel y un radar son puntos
 * concretos de la calle y comparten el disco; una zona es un area y no es
 * comparable con ninguno de los tres. Ademas el triangulo de peligro es la señal
 * vial que ya significa exactamente esto.
 */
function senalRiesgo() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LADO;

  const ctx = canvas.getContext('2d');
  const c = LADO / 2;

  const triangulo = (radio, y) => {
    ctx.beginPath();
    ctx.moveTo(c, y - radio);
    ctx.lineTo(c + radio * 0.95, y + radio * 0.75);
    ctx.lineTo(c - radio * 0.95, y + radio * 0.75);
    ctx.closePath();
  };

  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  // Contorno claro primero: es lo que despega la señal de un fondo que, por
  // definicion, ya esta pintado del mismo rojo que ella.
  triangulo(21, c + 2);
  ctx.fillStyle = SENAL.chapa;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  triangulo(17, c + 3);
  ctx.fillStyle = RIESGO.extrema;
  ctx.fill();

  ctx.fillStyle = SENAL.chapa;
  rectangulo(ctx, c - 2, c - 5, 4, 10, 2);
  ctx.beginPath();
  ctx.arc(c, c + 9, 2.4, 0, Math.PI * 2);
  ctx.fill();

  return imagen({ canvas, ctx });
}

/** Registra todas las señales una sola vez. */
function registrarIconos(map) {
  const senales = {
    'senal-galibo-no-pasa': () => senalGalibo(SENAL.peligro),
    'senal-galibo-justo':   () => senalGalibo(SENAL.atencion),
    'senal-galibo-pasa':    () => senalGalibo(SENAL.neutro),
    // Uno solo, en pizarra. El color del anillo dice de que FAMILIA es la señal,
    // no que tan grave es: la gravedad de un paso a nivel no depende del camion
    // y el tipo de barrera es un dato que se lee al tocarlo.
    'senal-paso': () => senalPaso(SENAL.neutro),
    'senal-radar': senalRadar,
    'senal-riesgo': senalRiesgo
  };

  for (const [nombre, dibujar] of Object.entries(senales)) {
    if (!map.hasImage(nombre)) {
      map.addImage(nombre, dibujar(), { pixelRatio: 2 });
    }
  }
}

function addSpeedCameraLayers(map) {
  if (!map.getSource('radares') || map.getLayer('radar-punto')) return;

  registrarIconos(map);

  map.addLayer({
    id: 'radar-punto',
    type: 'symbol',
    source: 'radares',
    minzoom: 13,
    layout: {
      'icon-image': 'senal-radar',
      'icon-size': tamanoSenal,
      // Que se descarten los que chocan es lo que impide que el mapa se cargue.
      'icon-allow-overlap': false,
      'icon-padding': 2
    }
  });
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

/** Que señal le corresponde a cada galibo, segun el riesgo para este camion. */
function senalDeGalibo() {
  if (truckHeight === null) {
    return 'senal-galibo-pasa';
  }

  return [
    'case',
    ['<', ['get', 'metres'], truckHeight], 'senal-galibo-no-pasa',
    ['<', ['get', 'metres'], truckHeight + TIGHT_MARGIN], 'senal-galibo-justo',
    'senal-galibo-pasa'
  ];
}

function addHeightLayers(map) {
  if (!map.getSource('alturas') || map.getLayer('altura-senal')) return;

  registrarIconos(map);

  // UNA sola capa de simbolo con el icono y el numero juntos.
  //
  // Antes eran dos: un circulo de color y un texto encima, y el texto llevaba
  // `text-allow-overlap` con `text-ignore-placement`. O sea que las 577
  // etiquetas se dibujaban TODAS, unas sobre otras: en una avenida con varios
  // puentes se leia "5,105,105,10" y no se entendia nada. Los circulos tampoco
  // ayudaban, porque una capa `circle` no participa de la deteccion de
  // colisiones de MapLibre.
  //
  // Con icono y texto en la misma capa y la colision activada, MapLibre
  // descarta los que chocan y al acercarse van apareciendo. Es lo que hace
  // cualquier mapa con sus etiquetas.
  map.addLayer({
    id: 'altura-senal',
    type: 'symbol',
    source: 'alturas',
    // Debajo de este zoom serian confeti: 577 señales sobre la ciudad entera.
    minzoom: 13,
    layout: {
      'icon-image': senalDeGalibo(),
      'icon-size': tamanoSenal,
      'icon-allow-overlap': false,
      'icon-padding': 2,

      // Cuando dos chapas chocan, gana la mas peligrosa.
      //
      // MapLibre resuelve las colisiones por orden de colocacion, y sin esto ese
      // orden es el del archivo: arbitrario. En una avenida con varios puentes
      // podia sobrevivir el de 5,50 —que no le importa a nadie— y descartarse el
      // de 3,80, que es el que te deja el acoplado en el asfalto. Con la altura
      // como clave, el mas bajo se coloca primero y gana siempre.
      'symbol-sort-key': ['get', 'metres'],

      // La altura va DEBAJO de la chapa, no adentro.
      //
      // Adentro no entra: "4,10" con letra legible mide mas que el hueco del
      // anillo, y cuando no entraba la chapa quedaba vacia. Debajo tiene todo el
      // ancho que necesita, con halo para despegarse de la cartografia. Es como
      // rotula los puntos cualquier mapa.
      'text-field': [
        'concat',
        ['number-format', ['get', 'metres'],
          { locale: 'es-AR', 'min-fraction-digits': 2, 'max-fraction-digits': 2 }],
        ' m'
      ],
      'text-font': ['NotoSans-Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 12],
      // La etiqueta busca lugar alrededor de la chapa en vez de ir siempre
      // abajo. Contra el borde de la pantalla, o con otra señal al lado, "4,50 m"
      // quedaba cortado y se leia "0 m" — un numero equivocado es peor que
      // ninguno. Con anclaje variable, MapLibre la reubica al lado que tenga
      // espacio y solo la descarta si no hay ninguno.
      'text-variable-anchor': ['bottom', 'top', 'right', 'left'],
      'text-radial-offset': 1,
      'text-justify': 'auto',
      // La etiqueta puede caerse si no hay lugar; la chapa se queda. Perder el
      // numero deja "hay un puente bajo aca", que ya es util. Perder la chapa
      // dejaria un numero flotando sin explicacion.
      'text-optional': true,
      'text-allow-overlap': false
    },
    paint: {
      'text-color': SENAL.tinta,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.6
    }
  });
}

/* ---------------------------------------------------------------------------
   Pasos a nivel

   Los "sapitos". Lo que le importa al camionero no es que exista el cruce sino
   COMO esta protegido: los que no tienen barrera son los que matan.
--------------------------------------------------------------------------- */

function addCrossingLayers(map) {
  if (!map.getSource('pasos') || map.getLayer('paso-senal')) return;

  registrarIconos(map);

  // La cruz de San Andres es LA señal del paso a nivel: la que esta plantada en
  // el cruce de verdad. Dibujarla en la chapa hace que no haga falta explicar
  // que es ese punto.
  map.addLayer({
    id: 'paso-senal',
    type: 'symbol',
    source: 'pasos',
    minzoom: 13,
    // ARRANCA APAGADA: los 312 pasos a nivel de la Ciudad sólo se muestran
    // durante el viaje. Ver setCrossingsVisible.
    layout: {
      visibility: 'none',

      // UN SOLO ICONO, sin escala de color, y esto es una correccion de fondo.
      //
      // Antes habia tres —rojo sin barrera, ambar con barrera, pizarra sin
      // dato— y el rojo significaba algo distinto que en el resto del mapa. En
      // los galibos, rojo es "tu camion NO PASA". Un paso a nivel en rojo se lee
      // igual, cuando en realidad decia "no tiene barrera": el mismo color con
      // dos significados, en la pantalla que se mira de reojo manejando.
      //
      // El tipo de barrera es un dato, no un veredicto sobre si se puede pasar.
      // Va en palabras al tocar la señal, no en el color.
      'icon-image': 'senal-paso',
      'icon-size': tamanoSenal,
      'icon-allow-overlap': false,
      'icon-padding': 2
    }
  });
}

/**
 * Avisa que arranco o termino un viaje.
 *
 * Los pasos a nivel se muestran SOLO durante el viaje. Son 312 en la Ciudad y
 * fuera del viaje no cambian ninguna decision: llenan de chapas la pantalla en
 * la que uno esta armando la ruta, que es justo cuando necesita verla limpia.
 */
export function setCrossingsVisible(map, visible) {
  navigating = visible;
  aplicarPasos(map);
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

  // Cambia la SEÑAL, no el color: el galibo pasa de neutro a rojo cuando el
  // camion elegido no le da la altura.
  if (map?.getLayer('altura-senal')) {
    map.setLayoutProperty('altura-senal', 'icon-image', senalDeGalibo());
  }
}

/** Prende o apaga todas las capas de camion. */
export function setTruckLayersVisible(map, visible) {
  if (!map) return;

  truckLayersOn = visible;

  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  // Los pasos a nivel van aparte: ademas del boton, necesitan que haya viaje.
  aplicarPasos(map);
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

  // Las señales NO se repintan con el tema: son imagenes de colores fijos, como
  // las señales de transito de verdad. Lo unico que se retoca es el numero del
  // galibo, que si es texto del mapa.
  if (map.getLayer('altura-senal')) {
    map.setPaintProperty('altura-senal', 'text-color', SENAL.tinta);
  }
}
