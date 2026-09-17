/**
 * Las tarjetas de ruta: lo que se dice de una ruta en una tarjeta, en la
 * vista general del viaje y al elegir ruta (waze-01, waze-02 y el prototipo).
 *
 *   · `porDonde`: "Por Av. Gral. Paz; Av. Lugones", las dos vias mas largas;
 *   · `lineaDeTiempo`: donde caen los avisos y los tramos fuera de la Red
 *     sobre una linea que representa lo que falta del recorrido.
 *
 * Todo puro y probado en tests/web/rutas.test.mjs. El marcado de la tarjeta
 * vive aca tambien, para que la vista general y la lista de rutas lo
 * compartan.
 */

import { abreviarCalle } from './viaje.js';
import { calcomania, pildora } from './piezas.js';
import { escapeHtml } from '../ui.js';

/* ---------------------------------------------------------------------------
   Las opciones que devuelve el servidor

   POST /api/routes trae la recomendada en la raiz y las demas en
   `alternatives`, ya ordenadas por lo que le conviene a un camion. Aca se
   aplanan, y elegir una es por posicion: la misma que despues viaja en
   `routeIndex` al arrancar el viaje.
--------------------------------------------------------------------------- */

/** La recomendada y sus alternativas, en ese orden. */
export function opcionesDeRuta(respuesta) {
  if (!respuesta) return [];
  return [respuesta, ...(respuesta.alternatives ?? [])];
}

/** La ruta de la posicion pedida; una posicion que no existe da la recomendada. */
export function elegirAlternativa(respuesta, indice) {
  const opciones = opcionesDeRuta(respuesta);
  if (opciones.length === 0) return null;
  return opciones[Number.isInteger(indice) && indice >= 0 && indice < opciones.length ? indice : 0];
}

/**
 * Si una opcion calculada desde donde esta el camion es, a los fines
 * practicos, la ruta que ya se sigue: va por las mismas vias y mide lo mismo
 * (con un 5 % de tolerancia, porque el punto de partida no es exactamente el
 * mismo). Se usa para no ofrecer "Ir" por la ruta en la que ya se esta.
 *
 * @param {{por: string, metros: number}} a  lo que falta de la ruta actual
 * @param {{por: string, metros: number}} b  la opcion
 */
export function mismaRuta(a, b) {
  if (!a || !b || a.por !== b.por) return false;
  const tolerancia = Math.max(50, a.metros * 0.05);
  return Math.abs(a.metros - b.metros) <= tolerancia;
}

/* ---------------------------------------------------------------------------
   Por donde
--------------------------------------------------------------------------- */

/**
 * "Por A; B": las dos vias por las que mas se anda, en el orden en que se
 * toman. La misma via en varios tramos suma una sola vez.
 *
 * @param {Array} instrucciones las de la ruta
 * @param {number} desde        el paso desde el que contar (lo anterior ya se hizo)
 */
export function porDonde(instrucciones, desde = 0) {
  if (!Array.isArray(instrucciones)) return '';

  const metros = new Map();
  const orden = [];

  for (const instruccion of instrucciones.slice(desde)) {
    const nombre = (instruccion?.streetName ?? '').trim();
    if (!nombre) continue;

    if (!metros.has(nombre)) orden.push(nombre);
    metros.set(nombre, (metros.get(nombre) ?? 0) + (instruccion.distanceMeters ?? 0));
  }

  const principales = [...metros.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([nombre]) => nombre);

  if (principales.length === 0) return '';

  return 'Por ' + orden.filter((n) => principales.includes(n)).map(abreviarCalle).join('; ');
}

/* ---------------------------------------------------------------------------
   La linea de tiempo
--------------------------------------------------------------------------- */

const ICONO_DE_AVISO = { radar: 'radar', galibo: 'galiboOk', paso: 'paso' };

const porcentaje = (valor) => Math.round(valor * 1000) / 10;

/**
 * Donde caen, sobre lo que falta del recorrido, los avisos y los tramos fuera
 * de la Red. Las posiciones van en porcentaje de lo que falta.
 *
 * @param {{cumulative: number[], totalMeters: number}|null} preparada la ruta de prepareRoute
 * @param {{travelled?: number, alerts?: Array, accessLegs?: Array}} datos
 */
export function lineaDeTiempo(preparada, { travelled = 0, alerts = [], accessLegs = [] } = {}) {
  const total = preparada?.totalMeters ?? 0;
  const falta = total - travelled;

  if (!preparada?.cumulative || !(falta > 0)) return { marcas: [], tramos: [] };

  const posicion = (metros) => porcentaje((metros - travelled) / falta);

  const marcas = alerts
    .filter((a) => ICONO_DE_AVISO[a.tipo] && a.at >= travelled)
    .map((a) => ({ pos: posicion(a.at), icono: ICONO_DE_AVISO[a.tipo] }));

  const tramos = accessLegs
    .map((leg) => [
      Math.max(travelled, preparada.cumulative[leg.fromPointIndex] ?? travelled),
      Math.min(total, preparada.cumulative[leg.toPointIndex] ?? total)
    ])
    .filter(([a, b]) => b > a)
    .map(([a, b]) => [posicion(a), posicion(b)]);

  return { marcas, tramos };
}

/* ---------------------------------------------------------------------------
   La tarjeta
--------------------------------------------------------------------------- */

/** El triangulo de "Ir" de las pildoras de Waze. */
const flechaIr = (t = 16) =>
  `<svg viewBox="0 0 24 24" width="${t}" height="${t}" aria-hidden="true"><path d="M12 3l8 18-8-4.5L4 21z" fill="currentColor"/></svg>`;

/**
 * La linea de tiempo dibujada: el triangulo de "vos", la linea celeste con
 * los tramos amarillos encima y las calcomanias de los avisos donde caen.
 */
export function lineaDeTiempoMarkup({ marcas = [], tramos = [] } = {}) {
  return `
  <div class="gps-lt">
    <span class="gps-lt-vos"></span>
    <div class="gps-lt-barra">
      ${tramos.map(([a, b]) => `<i style="left:${a}%;width:${b - a}%"></i>`).join('')}
      ${marcas.map(({ pos, icono }) => `<em style="left:${pos}%">${calcomania(icono, 16)}</em>`).join('')}
    </div>
  </div>`;
}

/**
 * Una tarjeta de ruta (waze-01, medida): radio 16, el tiempo en 27 negrita,
 * la pildora de accion a la derecha, "20:06 • 32 km" en 19, "Por…" en 18 y
 * la linea de tiempo.
 *
 * @param {object} r  { tiempo, hora, km, por, accion, datos, linea, elegida }
 *   `datos` son atributos para el boton de accion (data-*), ya escapados.
 */
export function tarjetaDeRutaMarkup({ tiempo, hora, km, por, accion, datos = '', linea, elegida = false }) {
  return `
  <div class="gps-tarjeta-ruta${elegida ? ' elegida' : ''}">
    <div class="gps-tarjeta-ruta-cabeza">
      <b>${escapeHtml(tiempo)}</b>
      ${pildora(accion, { clase: 'celeste chica', icono: flechaIr(16), datos })}
    </div>
    <div class="gps-tarjeta-ruta-sub">${escapeHtml(hora)} <i>•</i> ${escapeHtml(km)}</div>
    ${por ? `<div class="gps-tarjeta-ruta-por">${escapeHtml(por)}</div>` : ''}
    ${lineaDeTiempoMarkup(linea)}
  </div>`;
}
