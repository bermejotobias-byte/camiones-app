/**
 * Los reportes de la comunidad (spec del 19/09/2026): lo que un camionero vio
 * en su posición, que otros confirman o rechazan al pasar, que vive lo que su
 * tipo dice y muere solo.
 *
 * Este módulo tiene lo puro y el marcado; navigate.js lo engancha por
 * data-accion, como el resto de las superficies del mapa (AD-48). Los números
 * de vida útil, confiabilidad y abuso viven en el servidor: acá sólo se lee lo
 * que la API ya decidió (`reliability`, `validated`, `forYourTruck`).
 */

/* ---------------------------------------------------------------------------
   El catálogo, como lo ve la app
--------------------------------------------------------------------------- */

/**
 * Los diez tipos, en el orden de la grilla. `tipo` es el nombre del enum de la
 * API; `id` el nombre corto para el pin y el DOM; `restriccion` es lo único que
 * puede tocar la ruta (validado); `pideValor` abre el segundo toque del gálibo.
 */
export const TIPOS = [
  { id: 'accidente', tipo: 'Accident', nombre: 'Accidente', calcomania: 'accidente', restriccion: false, pideValor: false },
  { id: 'transito', tipo: 'Traffic', nombre: 'Tránsito', calcomania: 'transito', restriccion: false, pideValor: false },
  { id: 'control', tipo: 'Checkpoint', nombre: 'Control', calcomania: 'control', restriccion: false, pideValor: false },
  { id: 'policia', tipo: 'Police', nombre: 'Policía', calcomania: 'policia', restriccion: false, pideValor: false },
  { id: 'camara', tipo: 'Camera', nombre: 'Cámara', calcomania: 'camaraComunidad', restriccion: false, pideValor: false },
  { id: 'obra', tipo: 'Roadworks', nombre: 'Obra', calcomania: 'obra', restriccion: false, pideValor: false },
  { id: 'bache', tipo: 'Pothole', nombre: 'Bache', calcomania: 'bache', restriccion: false, pideValor: false },
  { id: 'peligro', tipo: 'Hazard', nombre: 'Peligro', calcomania: 'peligro', restriccion: false, pideValor: false },
  { id: 'cerrada', tipo: 'RoadClosed', nombre: 'Calle cerrada', calcomania: 'calleCerrada', restriccion: true, pideValor: false },
  { id: 'galibo', tipo: 'LowClearance', nombre: 'Gálibo bajo', calcomania: 'galiboReporte', restriccion: true, pideValor: true }
];

const DESCONOCIDO = { id: 'reporte', tipo: '?', nombre: 'Reporte', calcomania: 'peligro', restriccion: false, pideValor: false };

/** El tipo por el nombre del enum de la API. Uno desconocido no rompe la ficha. */
export function tipoDeReporte(tipo) {
  return TIPOS.find((t) => t.tipo === tipo) ?? DESCONOCIDO;
}

/* ---------------------------------------------------------------------------
   La edad, el sentido, el estado
--------------------------------------------------------------------------- */

/** "recién", "hace 12 min", "hace 3 h", "hace 2 días"; null para lo fijo, que no tiene edad. */
export function etiquetaEdad(createdAt, ahora = Date.now(), { fija = false } = {}) {
  if (fija) return null;

  const minutos = Math.floor((ahora - Date.parse(createdAt)) / 60_000);

  if (!Number.isFinite(minutos) || minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * Si un reporte le importa a quien va en este rumbo: sin rumbo en el reporte
 * (estaba parado) le importa a todos; con rumbo, a quien va a ±90°.
 */
export function mismoSentido(rumboReporte, rumboRuta) {
  if (rumboReporte === null || rumboReporte === undefined) return true;
  if (rumboRuta === null || rumboRuta === undefined) return true;

  const diferencia = Math.abs(((rumboRuta - rumboReporte + 540) % 360) - 180);
  return diferencia <= 90;
}

/**
 * Qué pin le toca: rojo si a tu camión no le sirve (manda sobre todo lo
 * demás), fijo para la cámara que ya es dato de la app, y si no la etiqueta
 * de confiabilidad que calculó el servidor.
 */
export function estadoDelPin(r) {
  if (r.forYourTruck === 'incompatible') return 'rojo';
  if (r.fixed) return 'fijo';
  if (r.reliability?.label === 'disputed') return 'duda';
  if (r.reliability?.label === 'confirmed') return 'confirmado';
  return 'nuevo';
}

/** El nombre de la imagen del pin: `reporte-<tipo>-<estado>`. */
export const nombreDelPin = (tipo, estado) => `reporte-${tipoDeReporte(tipo).id}-${estado}`;

/** La capa: un punto por reporte, con lo que el pin y la ficha necesitan. */
export function featuresDeReportes(reportes) {
  return {
    type: 'FeatureCollection',
    features: (reportes ?? []).map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: {
        id: r.id,
        tipo: r.type,
        estado: estadoDelPin(r),
        pin: nombreDelPin(r.type, estadoDelPin(r))
      }
    }))
  };
}

/* ---------------------------------------------------------------------------
   Textos
--------------------------------------------------------------------------- */

const metros = (valor) => `${Number(valor).toFixed(2).replace('.', ',')} m`;

/** Lo que dice el toast al reportar: qué y dónde, si se sabe. */
export function textoDelToast(r) {
  const tipo = tipoDeReporte(r.type);
  const que = tipo.pideValor && r.value != null ? `${tipo.nombre} ${metros(r.value)}` : tipo.nombre;

  return r.street ? `Reportado · ${que} en ${r.street}` : `Reportado · ${que}`;
}

/* ---------------------------------------------------------------------------
   ¿Sigue ahí?
--------------------------------------------------------------------------- */

/** A menos de esto se considera que se pasó por el reporte. */
export const CERCA_METROS = 60;

/**
 * Si hay que preguntar "¿sigue ahí?" por un reporte: una vez, cuando ya se
 * estuvo cerca y ahora uno se aleja, y sólo si no es propio ni está votado.
 */
export function deberiaPreguntar({ reporte, distancia, distanciaAnterior, yaPreguntado = false, mio = false, votado = false }) {
  if (yaPreguntado || mio || votado || reporte?.mine || reporte?.yourVote) return false;
  if (!Number.isFinite(distancia) || !Number.isFinite(distanciaAnterior)) return false;

  return distanciaAnterior <= CERCA_METROS && distancia > distanciaAnterior;
}

/* ---------------------------------------------------------------------------
   Los recuadros que se piden a la API
--------------------------------------------------------------------------- */

const formatear = (n) => n.toFixed(5);

/** El recuadro de una ruta ([lon, lat]) con un margen en metros, como `minLon,minLat,maxLon,maxLat`. */
export function bboxDeRuta(coords, margenMetros = 500) {
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const latMedia = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = margenMetros / 111_320;
  const dLon = margenMetros / (111_320 * Math.cos((latMedia * Math.PI) / 180));

  return [
    Math.min(...lons) - dLon,
    Math.min(...lats) - dLat,
    Math.max(...lons) + dLon,
    Math.max(...lats) + dLat
  ].map(formatear).join(',');
}

/** El recuadro visible, de los límites del mapa (`getBounds()` o `{west, south, east, north}`). */
export function bboxVisible(bounds) {
  const west = typeof bounds.getWest === 'function' ? bounds.getWest() : bounds.west;
  const south = typeof bounds.getSouth === 'function' ? bounds.getSouth() : bounds.south;
  const east = typeof bounds.getEast === 'function' ? bounds.getEast() : bounds.east;
  const north = typeof bounds.getNorth === 'function' ? bounds.getNorth() : bounds.north;

  return [west, south, east, north].map((n) => String(n)).join(',');
}
