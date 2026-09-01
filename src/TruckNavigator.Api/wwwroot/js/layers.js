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
  'altura-senal',
  'paso-senal',
  // Las zonas de riesgo SI se apagan con el boton, aunque no sean un dato de
  // camion: son un sombreado que cubre area, y es lo primero que uno quiere
  // sacar del medio para leer el mapa. No llevan control propio a proposito —
  // cada boton nuevo en la columna lateral agranda la franja que se come el
  // arrastre del mapa, y esto no vale ese precio.
  'zona-riesgo', 'zona-riesgo-senal'
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
   Zonas de riesgo

   Dato oficial: Mapa del Delito del GCBA (CC-BY), robos y hurtos de vehiculos
   denunciados, agregados en celdas de 250 m por `data/fetch-zonas-riesgo.ps1`.

   La decision que manda acá es CUANTO NO se dibuja. En 2025 el 92% de la Ciudad
   registro al menos un hecho: pintar todo lo que tiene delito es pintar CABA
   entera y no decir nada. Solo se emiten las celdas que duplican la densidad
   media de la Ciudad —413 de 3.005—, y la escala se expresa en multiplos de esa
   media, que es lo que hace que se explique sola: "el triple que el promedio".

   Y por eso mismo el silencio del mapa NO es un certificado de seguridad. Que no
   haya sombreado significa "no llega al doble de la media", no "acá no pasa
   nada". Tocar la zona lo dice con todas las letras.

   Se dibuja como MANCHA DIFUMINADA y no como los cuadrados de la grilla. Costo
   dos intentos fallidos llegar acá, y los dos enseñaron algo:

   1. Pintar las celdas tal cual, con relleno translucido y sin borde, esperando
      que las vecinas se fundieran. Quedo un tablero de ajedrez: cada celda se
      recortaba nitida contra la de al lado y el damero tapaba los nombres de las
      calles. El cuadrado de 250 m es una unidad de CALCULO, no un hecho del
      territorio; dibujarlo afirma que el riesgo cambia al cruzar una linea recta
      que en la calle no existe.
   2. Una capa `heatmap`. Empapelo el mapa de lunares alineados. El heatmap
      normaliza por densidad de PUNTOS y esta fuente ya viene agregada en grilla
      regular, asi que el patron de la grilla reaparece sin importar el radio:
      agrandarlo solo daba lunares mas grandes. Es la herramienta equivocada para
      un dato que ya esta contado por celda.

   Lo que funciona son circulos difuminados de radio mayor que la separacion
   entre celdas, con opacidad baja. Se funden entre si y el color se ACUMULA
   donde hay varias celdas calientes pegadas — esa suma es la escala, y aparece
   sola sin ningun corte artificial que decida donde empieza un foco.

   Ademas `circle` si responde a queryRenderedFeatures, cosa que `heatmap` no
   hace: la misma capa que se ve es la que contesta el toque.
--------------------------------------------------------------------------- */

/**
 * Rampa de la escala. Fija, como el resto de las señales.
 *
 * Va de ambar a rojo y no de verde a rojo a proposito: no hay ningun nivel
 * "seguro" que justifique un verde. Todo lo que se dibuja aqui ya duplica la
 * media de la Ciudad.
 */
const RIESGO = {
  alta:       '#f2b705',
  'muy-alta': '#e8590c',
  extrema:    '#c92a2a'
};

/**
 * Radio de la mancha, en pixeles, para que represente siempre los mismos metros.
 *
 * Se declara en pixeles de pantalla, asi que dejarlo fijo haria que la mancha
 * cubra cada vez menos terreno al acercarse — el foco pareceria encogerse cuando
 * no cambio nada. Se compensa doblandolo en cada nivel de zoom, que es como
 * funciona la escala del mapa.
 *
 * A la latitud de Buenos Aires un pixel son unos 63 m en zoom 11 y 1 m en zoom
 * 17: estos valores mantienen el radio en unos 450 m.
 *
 * Ese numero es casi el DOBLE de la separacion entre celdas, y no sobra. Con
 * 250 m cada celda dibujaba su propio lunar; con 350 se fundian pero quedaban
 * agujeros oscuros donde faltaba una celda por no llegar al corte, y en pantalla
 * esos huecos parecian manchas o un defecto del dibujo. Recien con ~450 m el
 * solape los cubre y la zona se lee como una sola mancha continua.
 */
const radioMancha = ['interpolate', ['exponential', 2], ['zoom'], 11, 7, 17, 450];

function addRiskZoneLayers(map) {
  if (!map.getSource('zonas') || map.getLayer('zona-riesgo')) return;

  registrarIconos(map);

  // Debajo de las etiquetas del mapa base: el sombreado no puede tapar los
  // nombres de las calles, que es lo que el conductor necesita para ubicarse.
  const primerTexto = map.getStyle().layers.find((capa) => capa.type === 'symbol')?.id;

  map.addLayer({
    id: 'zona-riesgo',
    type: 'circle',
    source: 'zonas',
    paint: {
      'circle-radius': radioMancha,
      // Desvanece el borde a lo largo de casi todo el radio: no queda ningun
      // contorno duro, que es lo que delataba la grilla. En 1 exacto el color se
      // diluye tanto que hace falta subir la opacidad para verlo, y entonces
      // vuelve a saturar donde las manchas se pisan; 0,75 deja un nucleo con
      // cuerpo y un borde que igual se apaga sin linea.
      'circle-blur': 0.75,
      // UN SOLO COLOR, no tres. Con las manchas superpuestas, tres colores
      // distintos se promedian en tonos sucios que no corresponden a ningun
      // nivel de la leyenda: el naranja que uno ve puede ser una zona naranja o
      // la mezcla de una amarilla con una roja, y no hay forma de saberlo.
      // Naranja y no el rojo del nivel extremo: un rojo oscuro al 10% sobre el
      // mapa de noche practicamente no existe, y subirlo para que se vea lo hace
      // saturar de dia. El naranja tiene luminancia intermedia y es el unico de
      // la rampa que se lee sobre los dos fondos sin cambiar de valor.
      'circle-color': RIESGO['muy-alta'],
      // Opacidad BAJA, y ahi esta el truco. Con manchas de 450 m y celdas cada
      // 250 m, cada punto de la pantalla queda cubierto por varios circulos a la
      // vez: una celda sola casi no se nota —que es lo correcto, una celda
      // aislada es señal debil— y donde hay un racimo el color se acumula solo.
      // Esa suma ES la escala, y aparece sin que ningun corte decida donde
      // empieza el foco. Es como esta hecho el mapa comunitario que sirvio de
      // referencia: ahi se lee una gradacion aunque todos sus poligonos sean del
      // mismo color, y es por superposicion.
      //
      // El numero se calibro mirando Constitucion, que es el foco mas intenso de
      // la Ciudad: si ahi se leen los nombres de las calles, en el resto tambien.
      // 0,05 no llegaba a verse y 0,18 tapaba la cartografia.
      //
      // El nivel de la celda modula esa opacidad base para que una celda extrema
      // suelta pese mas que una alta suelta.
      //
      // OJO CON LA FORMA de esta expresion: el `interpolate` sobre ['zoom'] va
      // en el nivel superior, con el `match` por nivel adentro de cada parada, y
      // no al reves. MapLibre solo acepta ['zoom'] en el tope de la propiedad;
      // envuelto en una multiplicacion tira "zoom expressions may only be used
      // as a top-level expression" y RECHAZA LA CAPA ENTERA. Como el error se
      // pierde, el sintoma es que la capa simplemente no aparece.
      'circle-opacity': [
        'interpolate', ['linear'], ['zoom'],
        11, ['*', ['match', ['get', 'nivel'], 'extrema', 2.2, 'muy-alta', 1.5, 1], 0.145],
        15, ['*', ['match', ['get', 'nivel'], 'extrema', 2.2, 'muy-alta', 1.5, 1], 0.13],
        18, ['*', ['match', ['get', 'nivel'], 'extrema', 2.2, 'muy-alta', 1.5, 1], 0.09]
      ],
      'circle-pitch-alignment': 'map'
    }
  }, primerTexto);

  // El triangulo solo en las 21 celdas extremas. Ponerlo en las 413 seria
  // volver a cargar el mapa, que es lo que la mancha evita.
  map.addLayer({
    id: 'zona-riesgo-senal',
    type: 'symbol',
    source: 'zonas',
    minzoom: 12,
    filter: ['==', ['get', 'nivel'], 'extrema'],
    layout: {
      'icon-image': 'senal-riesgo',
      'icon-size': tamanoSenal,
      // Las celdas extremas vienen en racimo —Constitucion tiene varias
      // pegadas— y sin esto salen tres triangulos identicos a un centimetro uno
      // del otro. El padding grande deja uno por foco, y el orden por cantidad
      // de hechos garantiza que el que sobrevive sea el peor del racimo.
      'icon-allow-overlap': false,
      'icon-padding': 28,
      'symbol-sort-key': ['-', 0, ['get', 'hechos']]
    }
  });
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

  ctx.strokeStyle = SENAL.tinta;
  ctx.lineCap = 'butt';

  // El arco del puente, con sus dos patas.
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c + 2, 8.5, Math.PI, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(c - 8.5, c + 2); ctx.lineTo(c - 8.5, c + 8);
  ctx.moveTo(c + 8.5, c + 2); ctx.lineTo(c + 8.5, c + 8);
  ctx.stroke();

  // La calzada por debajo: es lo que convierte el arco en "paso bajo puente".
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(c - 12, c + 10.5); ctx.lineTo(c + 12, c + 10.5);
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

  ctx.fillStyle = SENAL.tinta;
  rectangulo(ctx, c - 10, c - 5, 20, 13, 3);
  rectangulo(ctx, c - 4, c - 8, 7, 4, 1);

  ctx.beginPath();
  ctx.arc(c, c + 1.5, 4, 0, Math.PI * 2);
  ctx.fillStyle = SENAL.chapa;
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
    'senal-paso-sin-barrera': () => senalPaso(SENAL.peligro),
    'senal-paso-con-barrera': () => senalPaso(SENAL.atencion),
    'senal-paso-sin-dato':    () => senalPaso(SENAL.neutro),
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
    layout: {
      // Sin barrera es lo peligroso. "null" es que la fuente no lo dice, y eso
      // NO es lo mismo que no tener barrera: va en neutro, no en rojo.
      'icon-image': [
        'match',
        ['coalesce', ['get', 'barrier'], 'desconocido'],
        'no', 'senal-paso-sin-barrera',
        ['full', 'half', 'double_half', 'yes'], 'senal-paso-con-barrera',
        'senal-paso-sin-dato'
      ],
      'icon-size': tamanoSenal,
      'icon-allow-overlap': false,
      'icon-padding': 2,

      // Mismo criterio que en los galibos: al chocar gana el mas peligroso. Un
      // paso sin barrera es lo que hay que ver; uno con barrera completa avisa
      // solo cuando bajan las barreras.
      'symbol-sort-key': [
        'match',
        ['coalesce', ['get', 'barrier'], 'desconocido'],
        'no', 0,
        ['full', 'half', 'double_half', 'yes'], 2,
        1
      ]
    }
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

  // Cambia la SEÑAL, no el color: el galibo pasa de neutro a rojo cuando el
  // camion elegido no le da la altura.
  if (map?.getLayer('altura-senal')) {
    map.setLayoutProperty('altura-senal', 'icon-image', senalDeGalibo());
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

  // Las señales NO se repintan con el tema: son imagenes de colores fijos, como
  // las señales de transito de verdad. Lo unico que se retoca es el numero del
  // galibo, que si es texto del mapa.
  if (map.getLayer('altura-senal')) {
    map.setPaintProperty('altura-senal', 'text-color', SENAL.tinta);
  }
}
