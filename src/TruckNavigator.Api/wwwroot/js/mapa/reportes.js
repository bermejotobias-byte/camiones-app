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

import { CALCOMANIAS, calcomania, dibujo, pildora } from './piezas.js';

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

/** Lo mismo, pero con lo que el motor de avisos lee de cada reporte (navigation.js). */
export function featuresParaAvisos(reportes) {
  return {
    type: 'FeatureCollection',
    features: (reportes ?? []).map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: {
        id: r.id,
        type: r.type,
        street: r.street ?? null,
        headingDegrees: r.headingDegrees ?? null,
        value: r.value ?? null,
        validated: !!r.validated,
        fixed: !!r.fixed,
        forYourTruck: r.forYourTruck ?? null
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
   Cuándo se puede volver a pedir: el freno de la red

   Los reportes se piden al quedar quieto el mapa. Con el backend caído
   MapLibre reintenta los tiles sin parar, cada reintento vuelve a disparar
   'idle', y la app termina pidiendo una vez por segundo para siempre: batería
   y datos del camionero gastados en nada. Tras un fallo de red se espera cada
   vez más, y en cuanto un pedido vuelve bien se olvida todo.
--------------------------------------------------------------------------- */

/** La escalera, en ms. El último valor es el tope: de ahí no se sube más. */
export const ESPERAS_DE_RED_MS = [2_000, 5_000, 15_000, 60_000];

/** Cuánto esperar con `fallas` fallos de red seguidos. Sin fallos, nada. */
export function esperaTrasFallas(fallas) {
  if (!Number.isFinite(fallas) || fallas < 1) return 0;

  return ESPERAS_DE_RED_MS[Math.min(Math.trunc(fallas), ESPERAS_DE_RED_MS.length) - 1];
}

/**
 * Si el error es "no se pudo contactar al servidor".
 *
 * `ApiError` trae `status` 0 sólo en ese caso (ver `describe()` en api.js). Un
 * 4xx no frena: ahí el servidor contestó, y el pedido siguiente puede andar.
 */
export const esFalloDeRed = (error) => error?.status === 0;

/**
 * El freno: si ya se puede pedir, y cuánto esperar cuando un pedido falla.
 *
 * `fallo` devuelve lo que se va a esperar —0 si ese error no frena— para poder
 * decirlo en el log. El reloj se recibe de afuera: así se prueba sin esperar.
 */
/**
 * Cuanto hay que esperar para volver a pedir EL MISMO recuadro.
 *
 * El freno de fallas no cubre este caso: si los tiles se caen y la API no, cada
 * reintento de tile dispara 'idle', la app pide reportes y el servidor contesta
 * 200, asi que no hay falla que frenar. Medido el 30/09/2026 con el mapa QUIETO:
 * 42 pedidos por minuto, todos con el mismo recuadro.
 *
 * Mas corto que el refresco de 60 s del viaje, para no dejarlo sin reportes
 * nuevos; mover el mapa a otro lado pide de una, porque lo que se frena es
 * repetir, no mirar.
 */
export const MINIMO_MISMO_RECUADRO_MS = 30_000;

export function frenoDeRed() {
  let fallas = 0;
  let proximo = 0;
  let ultimaCaja = null;
  let ultimaCajaEn = 0;

  return {
    permite(ahora, caja = null) {
      if (ahora < proximo) return false;

      if (caja && caja === ultimaCaja && ahora - ultimaCajaEn < MINIMO_MISMO_RECUADRO_MS) {
        return false;
      }

      return true;
    },

    fallo(error, ahora) {
      if (!esFalloDeRed(error)) return 0;

      fallas += 1;
      const espera = esperaTrasFallas(fallas);
      proximo = ahora + espera;
      return espera;
    },

    exito(caja = null, ahora = Date.now()) {
      fallas = 0;
      proximo = 0;
      ultimaCaja = caja;
      ultimaCajaEn = ahora;
    }
  };
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

/* ---------------------------------------------------------------------------
   Los pines y la capa en MapLibre

   El mismo pin de 32 x 38 de los lugares, con el anillo por estado: gris
   nuevo, blanco confirmado, punteado en duda, rojo lo que a tu camión no le
   sirve, y celeste la cámara fija, que ya es dato de la app. Las imágenes se
   piden por `styleimagemissing` y se precalientan, como los lugares.
--------------------------------------------------------------------------- */

const ANILLO_REPORTE = { nuevo: '#8b949e', confirmado: '#ffffff', duda: '#8b949e', rojo: '#e9463f', fijo: '#32ccfe' };
const ESTADOS_REPORTE = ['nuevo', 'confirmado', 'duda', 'rojo', 'fijo'];

const PIN_ANCHO = 32;
const PIN_ALTO = 38;

/** El pin de un reporte, como SVG al doble para pantallas densas. Sin calcomanía, nada. */
export function pinReporteSvg(nombreCalcomania, estado) {
  const inner = CALCOMANIAS[nombreCalcomania];
  if (!inner) return '';

  const anillo = ANILLO_REPORTE[estado] ?? ANILLO_REPORTE.nuevo;
  const trazo = estado === 'duda' ? ' stroke-dasharray="4 3"' : '';
  const disco = estado === 'rojo' ? '#3a1416' : '#2b3035';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_ANCHO * 2}" height="${PIN_ALTO * 2}" viewBox="0 0 ${PIN_ANCHO} ${PIN_ALTO}">` +
    `<path d="M11 28l5 9 5-9z" fill="${anillo}"/>` +
    `<circle cx="16" cy="16" r="15.6" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>` +
    `<circle cx="16" cy="16" r="14.5" fill="${disco}" stroke="${anillo}" stroke-width="3"${trazo}/>` +
    `<svg x="7" y="7" width="18" height="18" viewBox="0 0 32 32" overflow="visible">${inner}</svg>` +
    '</svg>';
}

/** Todas las imágenes que la capa puede pedir: un pin por tipo y estado. */
export function nombresDePinesDeReporte() {
  return TIPOS.flatMap((t) => ESTADOS_REPORTE.map((estado) => nombreDelPin(t.tipo, estado)));
}

export const CAPA_REPORTES = 'reporte-pin';
const FUENTE_REPORTES = 'reportes';

const pendientes = new Set();
const escuchando = new WeakSet();

function registrarImagen(map, nombre, svg) {
  if (!svg || map.hasImage(nombre) || pendientes.has(nombre)) return;
  pendientes.add(nombre);

  const img = new Image();
  img.onload = () => {
    pendientes.delete(nombre);
    if (!map.hasImage(nombre)) map.addImage(nombre, img, { pixelRatio: 2 });
  };
  img.onerror = () => pendientes.delete(nombre);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function pedirImagen(map, id) {
  const partes = /^reporte-([a-z]+)-(nuevo|confirmado|duda|rojo|fijo)$/i.exec(id);
  if (!partes) return;

  const tipo = TIPOS.find((t) => t.id === partes[1]);
  if (tipo) registrarImagen(map, id, pinReporteSvg(tipo.calcomania, partes[2]));
}

/**
 * Deja la fuente y la capa listas, vacías. Idempotente: al cambiar de estilo
 * las capas se pierden y map.js las vuelve a instalar. Sin mapa no hace nada:
 * el mapa destruido sigue disparando eventos (medido el 18/09/2026).
 */
export function instalarReportes(map) {
  if (!map) return;

  if (!escuchando.has(map)) {
    escuchando.add(map);
    map.on('styleimagemissing', ({ id }) => pedirImagen(map, id));
  }

  for (const id of nombresDePinesDeReporte()) pedirImagen(map, id);

  if (map.getSource(FUENTE_REPORTES)) return;

  map.addSource(FUENTE_REPORTES, { type: 'geojson', data: featuresDeReportes([]) });

  map.addLayer({
    id: CAPA_REPORTES,
    // Un reporte importa desde más lejos que un lugar: desde el zoom en que se
    // ve el barrio, para que el accidente de la avenida se vea antes de llegar.
    minzoom: 12,
    type: 'symbol',
    source: FUENTE_REPORTES,
    layout: {
      'icon-image': ['get', 'pin'],
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    },
    paint: {
      // Lo que está en duda se ve, pero apagado.
      'icon-opacity': ['match', ['get', 'estado'], 'duda', 0.7, 1]
    }
  });
}

/** Pone estos reportes en el mapa (o ninguno). */
export function mostrarReportes(map, reportes) {
  map?.getSource?.(FUENTE_REPORTES)?.setData(featuresDeReportes(reportes));
}
