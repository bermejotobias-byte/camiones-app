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

import { calcomania, dibujo, pildora } from './piezas.js';

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

/* ---------------------------------------------------------------------------
   Las hojas: la sección de reportar, los metros del gálibo, la ficha y el
   "¿sigue ahí?". Sólo marcado, con las piezas del GPS (círculos de 75,
   píldoras de 48); navigate.js engancha por data-accion.
--------------------------------------------------------------------------- */

/** Los metros prearmados del gálibo: un toque, sin teclado. */
export const METROS_GALIBO = [3.5, 3.8, 4.0, 4.3, 4.5];

const escapar = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Reportar": los diez tipos en círculos de 75, un toque cada uno. Va arriba de las categorías de lugar. */
export function seccionReportar() {
  return `
  <p class="gps-seccion-titulo">Reportar</p>
  <div class="gps-redondos">
    ${TIPOS.map((t) => `
    <button type="button" class="gps-redondo-grande" data-accion="reportar" data-tipo="${t.tipo}">
      <span class="gps-redondo-ico">${calcomania(t.calcomania, 40)}</span>
      <span>${escapar(t.nombre)}</span>
    </button>`).join('')}
  </div>`;
}

/** El segundo toque del gálibo: los metros prearmados y "otro" para escribirlos. */
export function hojaGalibo({ valor = null } = {}) {
  return `
  <div class="gps-manija"></div>
  <div class="gps-aportar-titulo">
    <b>¿Cuánto mide el gálibo?</b>
    <button type="button" class="gps-ficha-cerrar" data-accion="cerrar" aria-label="Cerrar">${dibujo('cerrar', 24, 2.4)}</button>
  </div>
  <div class="gps-metros">
    ${METROS_GALIBO.map((m) => `<button type="button" class="gps-metro${valor === m ? ' is-on' : ''}" data-accion="galibo-valor" data-valor="${m}">${m.toFixed(1).replace('.', ',')}</button>`).join('')}
    <button type="button" class="gps-metro gps-metro-otro" data-accion="galibo-otro">Otro</button>
  </div>
  <p class="gps-pie">Los metros que dice el cartel del puente. Se reporta en tu posición.</p>`;
}

/** Cuántas confirmaciones y rechazos, como se lee. */
function conteos(r) {
  const partes = [];
  if (r.confirmations) partes.push(`${r.confirmations} ${r.confirmations === 1 ? 'confirmación' : 'confirmaciones'}`);
  if (r.rejections) partes.push(`${r.rejections} ${r.rejections === 1 ? 'rechazo' : 'rechazos'}`);
  return partes.join(' · ');
}

const ETIQUETAS = { new: 'Nuevo', confirmed: 'Confirmado', disputed: 'En duda' };

/**
 * La ficha de un reporte: tipo, calle o "cerca de acá", edad y conteos, quién,
 * lo que le dice a tu camión, y los dos botones — o "Cerrar reporte" si es tuyo.
 */
export function fichaReporte(r, { ahora = Date.now() } = {}) {
  const tipo = tipoDeReporte(r.type);
  const titulo = r.fixed && r.type === 'Camera'
    ? 'Cámara fija'
    : tipo.pideValor && r.value != null ? `${tipo.nombre} ${metros(r.value)}` : tipo.nombre;
  const edad = etiquetaEdad(r.createdAt, ahora, { fija: !!r.fixed });
  const linea = [edad, conteos(r)].filter(Boolean).join(' · ');
  const estado = r.fixed ? 'Dato de la app, confirmado por la comunidad' : ETIQUETAS[r.reliability?.label] ?? 'Nuevo';
  const quien = `Reportado por @${r.reportedBy?.alias ?? 'anónimo'}`;

  const restriccion = tipo.restriccion
    ? (r.forYourTruck === 'incompatible'
      ? { clase: 'no-apto', texto: 'Tu camión no pasa', sub: r.validated ? 'Confirmado: la ruta lo esquiva' : 'Sin confirmar: la ruta todavía no lo esquiva' }
      : r.validated
        ? { clase: 'confirmado', texto: 'Confirmado por la comunidad', sub: r.forYourTruck === 'compatible' ? 'Tu camión pasa' : 'Puede cambiar la ruta de otros camiones' }
        : { clase: 'probable', texto: 'Sin confirmar', sub: 'Hacen falta dos confirmaciones para que cambie la ruta' })
    : null;

  const voto = (veredicto, texto) => pildora(texto, {
    clase: r.yourVote === veredicto ? 'celeste chica' : 'chica',
    icono: r.yourVote === veredicto ? dibujo('check', 16, 3) : '',
    datos: `data-accion="voto" data-veredicto="${veredicto}"`
  });

  return `
  <div class="gps-manija"></div>
  <div class="gps-ficha-cabeza">
    <div class="gps-ficha-ico">${calcomania(tipo.calcomania, 32)}</div>
    <div class="gps-ficha-titulo"><b>${escapar(titulo)}</b><span>${escapar(r.street ?? 'cerca de acá')}</span></div>
    <button type="button" class="gps-ficha-cerrar" data-accion="cerrar" aria-label="Cerrar">${dibujo('cerrar', 22, 2.4)}</button>
  </div>
  <div class="gps-etiqueta-comunidad">${calcomania('comunidad', 16)}<span>${escapar([estado, linea, quien].filter(Boolean).join(' · '))}</span></div>
  ${restriccion ? `
  <div class="gps-bloque gps-bloque-${restriccion.clase}">
    <div class="gps-bloque-titulo"><i>${dibujo(restriccion.clase === 'no-apto' ? 'cerrar' : restriccion.clase === 'confirmado' ? 'check' : 'info', 14, 3.2)}</i><b>${escapar(restriccion.texto)}</b></div>
    <span>${escapar(restriccion.sub)}</span>
  </div>` : ''}
  ${r.mine ? `
  <div class="gps-acciones">
    ${pildora('Cerrar reporte', { datos: 'data-accion="cerrar-reporte"' })}
  </div>` : `
  <div class="gps-voto">
    <span>¿Sigue ahí?</span>
    <div class="gps-voto-botones">${voto('StillThere', 'Sigue ahí')}${voto('Gone', 'Ya no está')}</div>
  </div>`}`;
}

/** Los dos botones grandes que aparecen al pasar junto a un reporte, diez segundos. */
export function promptSigueAhi(r) {
  const tipo = tipoDeReporte(r.type);

  return `
  <div class="gps-sigue" data-reporte="${escapar(r.id)}">
    <div class="gps-sigue-que">${calcomania(tipo.calcomania, 28)}<span>${escapar(tipo.nombre)}${r.street ? ` · ${escapar(r.street)}` : ''}</span></div>
    <div class="gps-sigue-botones">
      ${pildora('Sigue ahí', { clase: 'celeste', datos: 'data-accion="sigue" data-veredicto="StillThere"' })}
      ${pildora('Ya no está', { datos: 'data-accion="sigue" data-veredicto="Gone"' })}
    </div>
  </div>`;
}
