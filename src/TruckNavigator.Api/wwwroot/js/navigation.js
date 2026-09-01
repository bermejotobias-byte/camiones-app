/**
 * Motor de navegacion.
 *
 * Responde, para cada posicion del GPS: donde estoy sobre la ruta, cuanto me
 * desvie, cual es la proxima maniobra y a que distancia, y cuanto falta.
 *
 * Es codigo puro: no toca el mapa, ni el DOM, ni la red. Todo lo que entra son
 * numeros y todo lo que sale son numeros, que es lo que permite probarlo con
 * recorridos sinteticos en vez de manejando un camion.
 */

const EARTH_RADIUS = 6_371_008.8;
const RAD = Math.PI / 180;

/* ---------------------------------------------------------------------------
   Geometria

   Se trabaja en metros sobre un plano local y no en grados. Proyectar un punto
   sobre un segmento directamente en lat/lng esta mal: un grado de longitud mide
   distinto que uno de latitud, asi que la perpendicular sale torcida y la
   distancia al camino queda mal medida.

   La aproximacion equirectangular alrededor del primer punto de la ruta es
   exacta muy por debajo del metro en las decenas de kilometros que puede tener
   un viaje urbano, y cuesta dos multiplicaciones.
--------------------------------------------------------------------------- */

function makeProjector(lat0, lng0) {
  const scaleX = EARTH_RADIUS * RAD * Math.cos(lat0 * RAD);
  const scaleY = EARTH_RADIUS * RAD;

  return {
    toLocal: (lat, lng) => ({ x: (lng - lng0) * scaleX, y: (lat - lat0) * scaleY }),
    toGeo: (x, y) => ({ lat: lat0 + y / scaleY, lng: lng0 + x / scaleX })
  };
}

/**
 * Proyecta un punto sobre un segmento, acotado a sus extremos.
 *
 * Se proyecta sobre el SEGMENTO y no se busca el vertice mas cercano: en una
 * avenida los vertices pueden estar a cien metros, y quedarse con el mas cercano
 * mete un error de hasta medio segmento en la distancia al proximo giro.
 */
function projectOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return { t: 0, x: a.x, y: a.y, distance: Math.hypot(point.x - a.x, point.y - a.y) };
  }

  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const x = a.x + t * dx;
  const y = a.y + t * dy;

  return { t, x, y, distance: Math.hypot(point.x - x, point.y - y) };
}

/** Rumbo de un segmento, en grados desde el norte. */
function segmentBearing(a, b) {
  // x apunta al este e y al norte, asi que atan2(este, norte) ya es un rumbo.
  return (Math.atan2(b.x - a.x, b.y - a.y) / RAD + 360) % 360;
}

/* ---------------------------------------------------------------------------
   Preparacion de la ruta

   Se hace una vez por ruta y no en cada posicion: proyectar 120 puntos y sumar
   distancias acumuladas en cada latido del GPS seria trabajo tirado.
--------------------------------------------------------------------------- */

/**
 * @param {object} route respuesta de la API
 * @returns {object} ruta lista para navegar
 */
export function prepareRoute(route) {
  const coordinates = route?.geometry?.coordinates ?? [];

  if (coordinates.length < 2) {
    return null;
  }

  const [lng0, lat0] = coordinates[0];
  const projector = makeProjector(lat0, lng0);

  const points = coordinates.map(([lng, lat]) => ({
    lat,
    lng,
    ...projector.toLocal(lat, lng)
  }));

  // Distancia acumulada hasta cada vertice. Con esto, "cuanto falta" y "a que
  // distancia esta el proximo giro" son una resta.
  const cumulative = new Array(points.length);
  cumulative[0] = 0;

  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] +
      Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  return {
    points,
    cumulative,
    projector,
    totalMeters: cumulative[cumulative.length - 1],
    // La API informa la distancia con su propio calculo; se conserva para
    // mostrarla, porque es la que quedo registrada en el viaje.
    reportedMeters: route.distanceMeters ?? cumulative[cumulative.length - 1],
    durationSeconds: route.durationSeconds ?? 0,
    instructions: route.instructions ?? []
  };
}

/* ---------------------------------------------------------------------------
   Ubicacion sobre la ruta
--------------------------------------------------------------------------- */

/**
 * Cuanto se puede retroceder entre dos posiciones, en metros.
 *
 * El GPS tiembla y a veces informa un punto un poco atras del anterior. No es
 * movimiento real, pero tampoco conviene prohibirlo: si se prohibe, la posicion
 * se traba contra el maximo alcanzado.
 */
const MAX_BACKWARD_METERS = 60;

/** Piso de avance permitido, para cuando no se conoce la velocidad. */
const MIN_FORWARD_METERS = 150;

/**
 * Busca el punto de la ruta que corresponde a la posicion.
 *
 * <b>La ventana se mide en metros de avance plausible, no en cantidad de
 * segmentos.</b> La diferencia no es cosmetica: un recorrido de camion se cruza
 * consigo mismo todo el tiempo —la Red de Transito Pesado obliga a rodeos, y la
 * ruta vuelve por calles paralelas a menos de veinte metros—. Con una ventana
 * contada en segmentos, un fix con quince metros de error alcanza para que el
 * punto "mas cercano" sea un tramo que se recorre media hora despues; y como la
 * ventana solo mira hacia adelante, una vez que salta no vuelve nunca.
 *
 * Acotando por lo que el camion pudo haber avanzado desde la posicion anterior,
 * ese tramo paralelo queda directamente fuera de la busqueda.
 *
 * Sin posicion previa —primer fix, o despues de recalcular— se busca en toda la
 * ruta, que es lo correcto porque no hay nada de que fiarse.
 */
function snapToRoute(prepared, local, previous, elapsedSeconds, speed) {
  const { points, cumulative } = prepared;
  const lastSegment = points.length - 2;

  let from = 0;
  let to = lastSegment;

  if (previous && Number.isFinite(previous.travelledMeters)) {
    const metersPerSecond = Number.isFinite(speed) && speed > 0 ? speed : 25;
    const elapsed = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 2;

    // Se toma el triple del avance teorico como margen: cubre un GPS que se
    // perdio unos segundos y volvio, sin abrir la ventana a media ruta.
    const forward = Math.max(MIN_FORWARD_METERS, metersPerSecond * elapsed * 3);

    from = segmentAtDistance(cumulative, previous.travelledMeters - MAX_BACKWARD_METERS);
    to = Math.min(lastSegment, segmentAtDistance(cumulative, previous.travelledMeters + forward));
  }

  let best = null;

  for (let i = from; i <= to; i++) {
    const projection = projectOnSegment(local, points[i], points[i + 1]);

    if (best === null || projection.distance < best.distance) {
      best = { ...projection, index: i };
    }
  }

  return best;
}

/** Indice del segmento que contiene una distancia acumulada dada. */
function segmentAtDistance(cumulative, meters) {
  const target = Math.max(0, meters);
  const lastSegment = cumulative.length - 2;

  let low = 0;
  let high = lastSegment;

  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (cumulative[middle] <= target) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return Math.max(0, Math.min(lastSegment, low));
}

/**
 * Umbral para considerar que el camion se salio de la ruta.
 *
 * Depende de la precision informada por el GPS: entre edificios altos un fix
 * puede tener cincuenta metros de error, y un umbral fijo de treinta metros
 * mandaria a recalcular en cada cuadra del centro. El piso evita el caso
 * opuesto: un GPS que informa una precision optimista de dos metros no puede
 * hacer que el navegador se ponga histerico.
 */
function offRouteThreshold(accuracy) {
  const reported = Number.isFinite(accuracy) ? accuracy : 20;
  return Math.min(90, Math.max(30, reported * 2));
}

/**
 * Avanza el estado de navegacion con una posicion nueva.
 *
 * @param {object} prepared      ruta preparada
 * @param {object} fix           { lat, lng, accuracy?, heading?, speed? }
 * @param {object|null} previous estado devuelto por la llamada anterior
 */
export function advance(prepared, fix, previous = null) {
  const at = Number.isFinite(fix.at) ? fix.at : Date.now();
  const elapsedSeconds = previous?.at ? (at - previous.at) / 1000 : null;

  const local = prepared.projector.toLocal(fix.lat, fix.lng);
  const snapped = snapToRoute(prepared, local, previous, elapsedSeconds, fix.speed);

  const { points, cumulative, instructions } = prepared;
  const index = snapped.index;

  // Distancia recorrida: lo acumulado hasta el vertice, mas el trecho ya hecho
  // dentro del segmento actual.
  const travelled = cumulative[index] +
    Math.hypot(snapped.x - points[index].x, snapped.y - points[index].y);

  const remaining = Math.max(0, prepared.totalMeters - travelled);

  const threshold = offRouteThreshold(fix.accuracy);
  const isOffRoute = snapped.distance > threshold;

  // Se exigen varios fixes seguidos fuera de la ruta antes de darla por perdida.
  // Un solo fix malo —un rebote contra un edificio— no puede disparar un
  // recalculo: seria una ruta nueva cada dos cuadras y una voz que no calla.
  const strikes = isOffRoute ? (previous?.strikes ?? 0) + 1 : 0;

  const step = currentStep(instructions, index);
  const next = instructions[step + 1] ?? null;

  const maneuverAt = next ? cumulative[clampIndex(next.fromPointIndex, cumulative)] : null;

  return {
    at,
    index,
    snapped: prepared.projector.toGeo(snapped.x, snapped.y),

    /** Distancia perpendicular a la ruta, en metros. */
    offRouteMeters: snapped.distance,
    offRouteThreshold: threshold,
    strikes,

    travelledMeters: travelled,
    remainingMeters: remaining,
    remainingSeconds: estimateRemainingSeconds(prepared, travelled, remaining),

    /** Instruccion que se esta recorriendo. */
    stepIndex: step,
    step: instructions[step] ?? null,

    /** Proxima maniobra, y a que distancia esta. */
    next,
    distanceToManeuver: maneuverAt === null ? remaining : Math.max(0, maneuverAt - travelled),

    bearing: courseFor(prepared, index, fix),
    hasArrived: remaining <= ARRIVAL_METERS
  };
}

/** A partir de aca se considera que llego. */
const ARRIVAL_METERS = 35;

function clampIndex(value, array) {
  return Math.max(0, Math.min(array.length - 1, value ?? 0));
}

/**
 * Cual de las instrucciones se esta recorriendo.
 *
 * La maniobra de cada instruccion ocurre en su <c>fromPointIndex</c>, asi que la
 * instruccion vigente es la ultima cuya maniobra ya quedo atras.
 */
function currentStep(instructions, index) {
  if (instructions.length === 0) return -1;

  let step = 0;

  for (let i = 0; i < instructions.length; i++) {
    if (instructions[i].fromPointIndex <= index) {
      step = i;
    } else {
      break;
    }
  }

  return step;
}

/**
 * Tiempo restante.
 *
 * Se escala la duracion estimada de la ruta por lo que falta recorrer, en lugar
 * de usar la velocidad instantanea: en un semaforo la velocidad es cero y el
 * tiempo restante saltaria a infinito.
 */
function estimateRemainingSeconds(prepared, travelled, remaining) {
  if (prepared.totalMeters <= 0) return 0;
  return prepared.durationSeconds * (remaining / prepared.totalMeters);
}

/**
 * Rumbo para orientar la camara.
 *
 * Se prefiere el rumbo del segmento de la ruta antes que el que informa el GPS.
 * El del GPS es ruido puro cuando el camion esta detenido o casi —da vueltas
 * sobre si mismo en un semaforo—, y mientras se sigue la ruta el del segmento es
 * el correcto y ademas es estable. Solo se usa el del GPS si viene con velocidad
 * suficiente y estamos fuera de la ruta, que es cuando el segmento ya no dice
 * nada util.
 */
function courseFor(prepared, index, fix) {
  const movingFast = Number.isFinite(fix.speed) && fix.speed > 2.5;

  if (movingFast && Number.isFinite(fix.heading) && fix.heading >= 0) {
    const routeBearing = segmentBearing(prepared.points[index], prepared.points[index + 1]);

    // Si el GPS y la ruta coinciden razonablemente, gana la ruta por estable.
    return angleDifference(fix.heading, routeBearing) < 45 ? routeBearing : fix.heading;
  }

  return segmentBearing(prepared.points[index], prepared.points[index + 1]);
}

/** Diferencia angular mas corta entre dos rumbos, en grados. */
export function angleDifference(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/* ---------------------------------------------------------------------------
   Decision de recalcular
--------------------------------------------------------------------------- */

/** Fixes seguidos fuera de la ruta antes de darla por perdida. */
export const STRIKES_TO_REROUTE = 3;

/** Tiempo minimo entre recalculos, en milisegundos. */
export const REROUTE_COOLDOWN_MS = 15_000;

/**
 * Si corresponde pedir una ruta nueva.
 *
 * Dos condiciones, y las dos hacen falta: varios fixes seguidos afuera —para no
 * reaccionar a un rebote del GPS— y que haya pasado un tiempo desde el ultimo
 * recalculo. Sin la espera, un destino inalcanzable produce una tormenta de
 * pedidos al servidor.
 */
export function shouldReroute(state, lastRerouteAt, now = Date.now()) {
  if (!state || state.strikes < STRIKES_TO_REROUTE) return false;
  if (state.hasArrived) return false;

  return !lastRerouteAt || now - lastRerouteAt >= REROUTE_COOLDOWN_MS;
}

/* ---------------------------------------------------------------------------
   Avisos

   Los umbrales estan pensados para transito urbano y para un vehiculo que
   necesita anticipar el carril bastante antes que un auto. Se avisa una sola vez
   por maniobra y por umbral: repetir es peor que no decir nada.
--------------------------------------------------------------------------- */

const ANNOUNCE_AT = [800, 300, 80];

/**
 * El umbral en el que ademas de hablar se vibra.
 *
 * Uno solo, el ultimo. Vibrar en los tres convierte cada maniobra en tres
 * sacudones desde ochocientos metros antes, y a esa altura uno deja de
 * prestarles atencion — que es justo lo que la vibracion no se puede permitir.
 */
export const ANNOUNCE_VIBRATE_AT = ANNOUNCE_AT[ANNOUNCE_AT.length - 1];

/**
 * Que aviso corresponde, si corresponde alguno.
 *
 * <b>Se avisa al CRUZAR el umbral, no por estar debajo de el.</b> La diferencia
 * se nota apenas se maneja: si el criterio es "estar debajo", una maniobra que
 * aparece a ciento cincuenta metros dispara el aviso de ochocientos y enseguida
 * el de trescientos, y el conductor escucha "en 150 metros" seguido de "en 100
 * metros" para el mismo giro. Con el cruce, un umbral del que nunca se estuvo
 * lejos simplemente no se anuncia.
 *
 * La primera instruccion del viaje es el caso que esta regla deja afuera a
 * proposito —se arranca ya encima de ella—, y la resuelve quien navega
 * anunciandola al iniciar.
 *
 * @param {object} state     estado devuelto por advance()
 * @param {object|null} previous estado anterior, para saber que se cruzo
 * @param {Set} alreadySaid  claves ya anunciadas
 * @returns {{key:string, meters:number}|null}
 */
export function pendingAnnouncement(state, previous, alreadySaid) {
  if (!state?.next) return null;

  const maneuver = state.next.fromPointIndex;

  // Solo cuenta como "antes" si la maniobra pendiente es la misma; si cambio,
  // no hay nada que se haya cruzado todavia.
  const before = previous?.next?.fromPointIndex === maneuver
    ? previous.distanceToManeuver
    : null;

  if (before === null) return null;

  for (const threshold of ANNOUNCE_AT) {
    const key = `${maneuver}:${threshold}`;

    if (before > threshold && state.distanceToManeuver <= threshold && !alreadySaid.has(key)) {
      return { key, meters: threshold };
    }
  }

  return null;
}

/* ---------------------------------------------------------------------------
   Texto de las maniobras
--------------------------------------------------------------------------- */

const MANEUVER_VERBS = {
  Continue: 'Seguí derecho',
  SlightLeft: 'Girá suave a la izquierda',
  Left: 'Girá a la izquierda',
  SharpLeft: 'Girá fuerte a la izquierda',
  SlightRight: 'Girá suave a la derecha',
  Right: 'Girá a la derecha',
  SharpRight: 'Girá fuerte a la derecha',
  KeepLeft: 'Mantenete a la izquierda',
  KeepRight: 'Mantenete a la derecha',
  UTurn: 'Date la vuelta',
  Roundabout: 'Entrá a la rotonda',
  Waypoint: 'Llegaste al punto',
  Finish: 'Llegaste',
  Unknown: 'Seguí la ruta'
};

/** Flecha para la maniobra. */
export const MANEUVER_ARROWS = {
  Continue: '↑',
  SlightLeft: '↖',
  Left: '←',
  SharpLeft: '↰',
  SlightRight: '↗',
  Right: '→',
  SharpRight: '↱',
  KeepLeft: '↖',
  KeepRight: '↗',
  UTurn: '⇊',
  Roundabout: '↻',
  Waypoint: '◉',
  Finish: '⚑',
  Unknown: '↑'
};

export const maneuverArrow = (kind) => MANEUVER_ARROWS[kind] ?? MANEUVER_ARROWS.Unknown;

/**
 * Frase para decir en voz alta.
 *
 * Se dice la distancia redondeada a algo pronunciable: "en trescientos metros"
 * y no "en doscientos ochenta y siete metros", que ademas de raro tarda mas de
 * lo que dura la ventana para escucharlo.
 */
export function speakableInstruction(instruction, meters) {
  if (!instruction) return '';

  const verb = MANEUVER_VERBS[instruction.kind] ?? MANEUVER_VERBS.Unknown;
  const street = instruction.streetName ? ` por ${instruction.streetName}` : '';

  if (instruction.kind === 'Finish') {
    return meters <= 80 ? 'Llegaste a destino.' : `Llegás a destino en ${roundDistance(meters)}.`;
  }

  if (instruction.kind === 'Roundabout' && instruction.exitNumber) {
    return `En ${roundDistance(meters)}, tomá la salida ${instruction.exitNumber} de la rotonda.`;
  }

  if (meters <= 80) {
    return `${verb}${street}.`;
  }

  return `En ${roundDistance(meters)}, ${lowerFirst(verb)}${street}.`;
}

function roundDistance(meters) {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km >= 10 ? `${Math.round(km)} kilómetros` : `${km.toFixed(1).replace('.', ',')} kilómetros`;
  }

  // A múltiplos de 50: nadie escucha "en 287 metros".
  const rounded = Math.max(50, Math.round(meters / 50) * 50);
  return `${rounded} metros`;
}

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

/* ---------------------------------------------------------------------------
   Avisos de lo que hay SOBRE la ruta

   Los galibos, los pasos a nivel y los radares estan en el mapa desde hace rato,
   pero manejando no se miran: la vista va a la calle. Estos avisos los convierten
   en algo que llega sin mirar — una vibracion con su patron, y una frase.

   El calculo se hace UNA VEZ, al preparar la ruta, y no en cada latido del GPS.
   Cruzar cada posicion contra 129 radares, 312 pasos a nivel y 685 galibos una
   vez por segundo es trabajo de sobra para un telefono que ademas esta dibujando
   el mapa; hacerlo al principio deja una lista corta y ordenada por distancia,
   y despues avisar es comparar dos numeros.
--------------------------------------------------------------------------- */

/**
 * A que distancia de la ruta tiene que estar algo para que cuente como "sobre
 * la ruta".
 *
 * Treinta metros. Mas ancho empieza a levantar lo de la calle paralela y lo de
 * la colectora —avisar de un puente por el que uno no va a pasar es peor que no
 * avisar, porque enseña a desconfiar del aviso—. Mas angosto se pierden cosas
 * por el error de la propia geometria de OpenStreetMap.
 */
const ALERT_CORRIDOR_METERS = 30;

/** A que distancia se avisa. Uno solo: no es una maniobra, es algo que esta ahi. */
const ALERT_AT_METERS = 200;

/**
 * Busca sobre la ruta lo que hay que avisar, ordenado por cuando aparece.
 *
 * @param prepared      lo que devuelve prepareRoute
 * @param features      { galibos, pasos, radares }, cada uno un GeoJSON de puntos
 * @param truckHeight   altura del camion, en metros, o null si no se sabe
 */
export function alertsAlongRoute(prepared, features = {}, truckHeight = null) {
  if (!prepared?.points?.length) return [];

  const alerts = [];

  const agregar = (tipo, geojson, decidir) => {
    for (const feature of geojson?.features ?? []) {
      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;

      const sobre = locateOnRoute(prepared, coords[1], coords[0]);
      if (!sobre) continue;

      const aviso = decidir(feature.properties ?? {});
      if (!aviso) continue;

      alerts.push({ tipo, at: sobre.at, ...aviso });
    }
  };

  // Galibos: SOLO los que este camion no pasa. Un puente de 5 m no le importa a
  // nadie que quepa debajo, y avisarlo gasta la atencion que hace falta para el
  // que si importa. Sin altura declarada del camion no se avisa ninguno: no se
  // puede decir "no pasas" sin saber cuanto mide.
  agregar('galibo', features.galibos, (p) => {
    // parseFloat y NO Number: `Number(null)` es 0, asi que un galibo sin altura
    // declarada pasaba el filtro y se avisaba como "puente de 0,00 m, no pasas".
    // El generador hoy descarta los que no traen altura, pero esto no puede
    // depender de eso — es exactamente la clase de dato faltante que la regla de
    // la casa dice que hay que tratar como faltante.
    const metres = Number.parseFloat(p.metres);

    if (!Number.isFinite(metres) || !Number.isFinite(truckHeight)) return null;
    if (metres >= truckHeight) return null;

    return { metres, name: p.name ?? null };
  });

  // Pasos a nivel: todos. No dependen del camion y cruzarlos siempre pide bajar
  // la velocidad.
  agregar('paso', features.pasos, (p) => ({ barrier: p.barrier ?? null }));

  // Radares: todos.
  agregar('radar', features.radares, (p) => ({ ubicacion: p.ubicacion ?? null }));

  return alerts.sort((a, b) => a.at - b.at);
}

/**
 * Donde cae un punto sobre la ruta, si es que cae.
 *
 * Devuelve la distancia acumulada desde el arranque, que es la misma unidad con
 * la que el motor mide el avance: asi "cuanto falta para el puente" es una resta.
 */
function locateOnRoute(prepared, lat, lng) {
  const { points, cumulative, projector } = prepared;
  const target = projector.toLocal(lat, lng);

  let best = null;

  for (let i = 1; i < points.length; i++) {
    const projected = projectOnSegment(target, points[i - 1], points[i]);

    if (projected.distance > ALERT_CORRIDOR_METERS) continue;
    if (best && projected.distance >= best.distance) continue;

    const largo = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);

    best = {
      distance: projected.distance,
      at: cumulative[i - 1] + projected.t * largo
    };
  }

  return best;
}

/**
 * Que aviso de ruta corresponde ahora, si corresponde alguno.
 *
 * Se avisa al CRUZAR el umbral, igual que las maniobras: si el criterio fuera
 * "estar a menos de 200 m", un aviso saltaria en cada latido del GPS durante
 * doscientos metros.
 *
 * @param alerts    lo que devolvio alertsAlongRoute
 * @param travelled metros recorridos ahora
 * @param before    metros recorridos en el latido anterior, o null si es el primero
 * @param yaAvisados Set con las claves de los avisos ya dados
 */
export function pendingRouteAlert(alerts, travelled, before, yaAvisados) {
  if (!alerts?.length || before === null || before === undefined) return null;

  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    const key = `${alert.tipo}:${i}`;

    if (yaAvisados.has(key)) continue;

    // Ya pasamos de largo: se marca como dado para no acumular basura y para que
    // no salte si el GPS retrocede un metro.
    if (travelled > alert.at) {
      yaAvisados.add(key);
      continue;
    }

    const faltabaAntes = alert.at - before;
    const faltaAhora = alert.at - travelled;

    if (faltabaAntes > ALERT_AT_METERS && faltaAhora <= ALERT_AT_METERS) {
      return { ...alert, key, meters: Math.round(faltaAhora) };
    }
  }

  return null;
}

/** La frase del aviso, para decirla en voz alta. */
export function speakableAlert(alert) {
  if (!alert) return null;

  if (alert.tipo === 'galibo') {
    const altura = alert.metres.toFixed(2).replace('.', ',');
    return `Atención: puente de ${altura} metros. Tu camión no pasa.`;
  }

  if (alert.tipo === 'paso') {
    return 'Paso a nivel adelante.';
  }

  if (alert.tipo === 'radar') {
    return 'Radar de velocidad adelante.';
  }

  return null;
}
