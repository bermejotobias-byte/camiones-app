/**
 * Las rutas: lo que se dice de una ruta en una tarjeta de la vista general
 * del viaje, y la hoja de elegir ruta (waze-01, waze-02 y el prototipo).
 *
 *   · `porDonde`: "Por Av. Gral. Paz; Av. Lugones", las dos vias mas largas;
 *   · `textoDeEstado` y `chipsDeRuta`: la linea de estado y los chips;
 *   · `lineaDeTiempo`: donde caen los avisos y los tramos fuera de la Red
 *     sobre una linea que representa lo que falta del recorrido;
 *   · `hojaRutas`, `cabeceraDeRutas`, `pildoraDelCamion`: la hoja de elegir.
 *
 * Todo puro y probado en tests/web/rutas.test.mjs. El marcado vive aca
 * tambien, para que la vista general y la lista de rutas lo compartan;
 * navigate.js lo engancha.
 */

import { abreviarCalle } from './viaje.js';
import { calcomania, chip, dibujo, pildora } from './piezas.js';
import { escapeHtml } from '../ui.js';
import { mascota } from '../mascota.js';

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
   Que dice cada ruta al elegir

   Donde Waze dice "Trafico habitual", aca va cuanto va por la Red: es lo que
   decide entre dos rutas para un camion. Y los chips cuentan lo que hay en el
   camino con el color de cada cosa: amarillo es salir de la Red; el rojo no
   aparece sobre ninguna ruta (AD-47).
--------------------------------------------------------------------------- */

const COLOR_CHIP = { red: '#f9c531', radar: '#4f6d8e', galibo: '#8b949e', paso: '#8b949e' };

const metrosLegibles = (metros) => (metros < 1000
  ? `${Math.round(metros)} m`
  : `${(metros / 1000).toFixed(1).replace('.', ',')} km`);

const fueraDeLaRed = (route) => (route.accessLegs ?? []).reduce((suma, leg) => suma + (leg.distanceMeters ?? 0), 0);

/**
 * "Toda por la Red" / "Mejor ruta, 85% por la Red" / "Sale de la Red 9,3 km".
 *
 * @param {object} route          la ruta, con heavyNetworkSharePercent y accessLegs
 * @param {boolean} esRecomendada si es la primera de la lista
 */
export function textoDeEstado(route, esRecomendada) {
  const share = route.heavyNetworkSharePercent ?? 0;

  if (share >= 99.5) return 'Toda por la Red';
  if (esRecomendada) return `Mejor ruta, ${Math.round(share)}% por la Red`;

  const metros = fueraDeLaRed(route);
  return metros > 0 ? `Sale de la Red ${metrosLegibles(metros)}` : `${Math.round(share)}% por la Red`;
}

/**
 * Los chips de una ruta: fuera de la Red, radares, galibos (siempre "pasas":
 * uno que no se pasa no llega a la ruta) y pasos a nivel.
 *
 * @param {Array} alerts  lo que devuelve alertsAlongRoute para esa ruta
 * @param {object} route  la ruta
 * @returns {{color: string, texto: string}[]}
 */
export function chipsDeRuta(alerts, route) {
  const chips = [];
  const cuantos = (tipo) => alerts.filter((a) => a.tipo === tipo).length;
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  if ((route.accessLegs ?? []).length) chips.push({ color: COLOR_CHIP.red, texto: 'Fuera de la Red' });

  const radares = cuantos('radar');
  if (radares) chips.push({ color: COLOR_CHIP.radar, texto: plural(radares, 'radar', 'radares') });

  const galibos = alerts.filter((a) => a.tipo === 'galibo');
  if (galibos.length) {
    const masBajo = Math.min(...galibos.map((g) => g.metres));
    chips.push({ color: COLOR_CHIP.galibo, texto: `Gálibo ${masBajo.toFixed(2).replace('.', ',')} · pasás` });
  }

  const pasos = cuantos('paso');
  if (pasos) chips.push({ color: COLOR_CHIP.paso, texto: plural(pasos, 'paso a nivel', 'pasos a nivel') });

  return chips;
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

/* ---------------------------------------------------------------------------
   La hoja de elegir ruta (el prototipo, tablero "Rutas")

   Cabecera negra de 55 con "origen → destino" en 18, la tira de mapa de 117
   con la pildora del camion flotando, filas de 145 —el tiempo en 27 negrita,
   celeste y sobre negro en la elegida; los km en 18 gris; "Por…" en 18; el
   estado en 16 gris; los chips de 25— y abajo las pildoras "Detalles" y
   "Arrancar" de 48. Donde Waze dice "Trafico habitual", aca cuanto va por la
   Red; donde dice "Evitar", el camion.
--------------------------------------------------------------------------- */

/** Lo que va antes de la primera coma de una direccion, abreviado como en los carteles. */
export function nombreCorto(label) {
  return abreviarCalle(String(label ?? '').split(',')[0].trim());
}

/** "El Rayo · 40 t": la pildora que flota sobre la tira de mapa. */
export function textoDelCamion(camion) {
  if (!camion) return 'Elegí un camión';

  const toneladas = (camion.grossWeightKg / 1000).toFixed(1).replace('.0', '').replace('.', ',');
  return `${camion.name} · ${toneladas} t`;
}

/**
 * La cabecera: la flecha de volver y "Mi ubicación → Puerto".
 *
 * El origen que salio del GPS se llama "Mi ubicación", como en Waze, aunque
 * ya tenga direccion: es lo que el conductor entiende sin leer.
 *
 * @param {{origen: {label: string, actual?: boolean}|null, destino: {label: string}|null}} puntos
 */
export function cabeceraDeRutas({ origen, destino }) {
  const desde = origen?.actual ? 'Mi ubicación' : nombreCorto(origen?.label);
  const hasta = nombreCorto(destino?.label);

  return `
  <div class="gps-cabecera">
    <button type="button" class="gps-cabecera-volver" data-accion="volver" aria-label="Volver">${dibujo('atras', 22, 2.4)}</button>
    <div class="gps-cabecera-titulo"><span>${escapeHtml(desde)}</span><i>→</i><span>${escapeHtml(hasta)}</span></div>
  </div>`;
}

/** La pildora de 42 con el camion elegido; tocarla lleva a cambiarlo. */
export function pildoraDelCamion(camion) {
  return `<button type="button" class="gps-pildora-camion" data-accion="camion">${dibujo('camion', 20, 2.4)}<span>${escapeHtml(textoDelCamion(camion))}</span>${dibujo('abajo', 18, 2.6)}</button>`;
}

/** Una fila de 145: el tiempo manda; los km, por donde, el estado y los chips lo acompañan. */
function filaDeRuta({ tiempo, km, por = '', estado = '', chips = [] }, indice, elegida) {
  return `
  <button type="button" class="gps-ruta${elegida ? ' elegida' : ''}" data-accion="elegir" data-indice="${indice}">
    <span class="gps-ruta-cabeza"><b>${escapeHtml(tiempo)}</b><span>${escapeHtml(km)}</span></span>
    ${por ? `<span class="gps-ruta-por">${escapeHtml(por)}</span>` : ''}
    ${estado ? `<span class="gps-ruta-estado">${escapeHtml(estado)}</span>` : ''}
    ${chips.length ? `<span class="gps-ruta-chips">${chips.map((c) => chip(c.color, c.texto)).join('')}</span>` : ''}
  </button>`;
}

/**
 * La hoja: la manija, una fila por ruta y las dos pildoras.
 *
 * @param {{rutas: Array<{tiempo, km, por, estado, chips}>, elegida: number}} estado
 */
export function hojaRutas({ rutas = [], elegida = 0 } = {}) {
  return `
  <div class="gps-manija angosta"></div>
  <div class="gps-rutas">${rutas.map((r, i) => filaDeRuta(r, i, i === elegida)).join('')}</div>
  <div class="gps-acciones">
    ${pildora('Detalles', { datos: 'data-accion="detalles"' })}
    ${pildora('Arrancar', { clase: 'celeste', id: 'gps-arrancar', datos: 'data-accion="arrancar"' })}
  </div>`;
}

/* ---------------------------------------------------------------------------
   Los detalles de la ruta (el prototipo, tablero "Detalles")

   Lo que en la hoja vieja era prosa pasa a filas como las de Waze: las
   cifras, el mono diciendo lo unico que importa de esta ruta —habla una
   vez, aca, antes de arrancar—, lo que hay en el camino y las fuentes.
   Donde falta el dato, se dice.
--------------------------------------------------------------------------- */

const metrosEnM = (metros) => `${metros.toFixed(2).replace('.', ',')} m`;
const kmDeRuta = (metros) => `km ${(metros / 1000).toFixed(1).replace('.', ',')}`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Las calles de los tramos fuera de la Red, una vez cada una y en orden. */
function callesDeLosTramos(route) {
  const calles = [];

  for (const leg of route.accessLegs ?? []) {
    const nombre = (leg.streetName ?? '').trim();
    if (!nombre || /^tramo sin nombre$/i.test(nombre) || calles.includes(nombre)) continue;
    calles.push(nombre);
  }

  return calles;
}

/** "A, B, C y 17 más". */
function listaCorta(nombres, max = 3) {
  const resto = nombres.length - max;
  const cabeza = nombres.slice(0, max).join(', ');
  return resto > 0 ? `${cabeza} y ${resto} más` : cabeza;
}

/**
 * "Av. J. B. Justo km 3,2 · km 9,1 y 2 más": donde cae cada aviso sobre la
 * ruta. Dos en el mismo lugar —los radares vienen de a pares, uno por mano;
 * un paso a nivel por cada via— se nombran una vez.
 */
function dondeCaen(avisos, max = 3) {
  const lugares = [...new Set(avisos.map((a) => (a.calle ? `${abreviarCalle(a.calle)} ${kmDeRuta(a.at)}` : kmDeRuta(a.at))))];
  const resto = lugares.length - max;
  const cabeza = lugares.slice(0, max).join(' · ');
  return resto > 0 ? `${cabeza} y ${resto} más` : cabeza;
}

const pasaElCamion = (camion, terminal = '.') => (camion?.heightMeters
  ? `${camion.name} mide ${metrosEnM(camion.heightMeters)}: pasás${terminal}`
  : `Pasás${terminal}`);

/**
 * Lo unico que importa de esta ruta, para la tarjeta del mono: salir de la
 * Red antes que nada; si no, el galibo mas bajo; si no, los radares; si no,
 * los pasos a nivel; y si no hay nada, que esta todo en orden.
 *
 * @returns {{momento: string, titulo: string, texto: string}}
 */
export function loQueImporta(route, alerts, camion) {
  const tramos = (route.accessLegs ?? []).length;

  if (tramos) {
    return {
      momento: 'alerta',
      titulo: `Ojo: ${plural(tramos, 'tramo', 'tramos')} fuera de la Red`,
      texto: `Son ${metrosLegibles(fueraDeLaRed(route))}. La norma admite salir de la Red sólo para llegar al destino y volver por el camino más corto.`
    };
  }

  const galibos = alerts.filter((a) => a.tipo === 'galibo');
  if (galibos.length) {
    const masBajo = metrosEnM(Math.min(...galibos.map((g) => g.metres)));
    return {
      momento: 'alerta',
      titulo: galibos.length === 1 ? `Un gálibo de ${masBajo} en el camino` : `${galibos.length} gálibos en el camino, el más bajo de ${masBajo}`,
      texto: pasaElCamion(camion)
    };
  }

  const radares = alerts.filter((a) => a.tipo === 'radar').length;
  if (radares) {
    return {
      momento: 'radar',
      titulo: `${plural(radares, 'radar', 'radares')} en el camino`,
      texto: 'Te aviso antes de cada uno. Manejá a la velocidad de la vía y listo.'
    };
  }

  const pasos = alerts.filter((a) => a.tipo === 'paso').length;
  if (pasos) {
    return {
      momento: 'alerta',
      titulo: `${plural(pasos, 'paso a nivel', 'pasos a nivel')} en el camino`,
      texto: 'Bajá la velocidad al cruzarlos: te aviso antes de cada uno.'
    };
  }

  return {
    momento: 'ruta',
    titulo: 'Todo en orden',
    texto: 'Va toda por la Red y no hay nada que avisar en el camino.'
  };
}

/**
 * Las filas de "En el camino": fuera de la Red con sus calles, los radares y
 * los pasos a nivel con la calle y el km donde caen, y los galibos con el
 * mas bajo.
 *
 * @returns {{icono: string, titulo: string, sub: string}[]}
 */
export function filasDelCamino(route, alerts, camion) {
  const filas = [];

  if ((route.accessLegs ?? []).length) {
    const calles = callesDeLosTramos(route);
    filas.push({
      icono: 'red',
      titulo: `Fuera de la Red · ${metrosLegibles(fueraDeLaRed(route))}`,
      sub: calles.length ? listaCorta(calles) : 'Tramos sin nombre'
    });
  }

  const radares = alerts.filter((a) => a.tipo === 'radar');
  if (radares.length) {
    filas.push({ icono: 'radar', titulo: `${plural(radares.length, 'radar', 'radares')} de velocidad`, sub: dondeCaen(radares) });
  }

  const galibos = alerts.filter((a) => a.tipo === 'galibo');
  if (galibos.length) {
    const masBajo = metrosEnM(Math.min(...galibos.map((g) => g.metres)));
    filas.push({
      icono: 'galiboOk',
      titulo: galibos.length === 1 ? `1 gálibo · ${masBajo}` : `${galibos.length} gálibos · el más bajo ${masBajo}`,
      sub: pasaElCamion(camion, '')
    });
  }

  const pasos = alerts.filter((a) => a.tipo === 'paso');
  if (pasos.length) {
    filas.push({ icono: 'paso', titulo: plural(pasos.length, 'paso a nivel', 'pasos a nivel'), sub: dondeCaen(pasos) });
  }

  return filas;
}

/* Las fuentes de lo que no viene con su referencia en la ruta. Ver
   docs/data-sources.md; la de la Red la trae cada hallazgo del servidor. */
const FUENTE_RED = {
  titulo: 'Ley 2148, arts. 9.10.1 y 9.10.5 (mod. Ley 6.401/2020)',
  sub: 'Red de Tránsito Pesado · transcripción comunitaria en OpenStreetMap (hgv=designated)'
};

const FUENTES_DE_AVISOS = {
  radar: { titulo: 'Radares: Buenos Aires Data', sub: 'Cámaras fijas de control vehicular, GCBA · CC-BY-2.5-AR' },
  galibo: { titulo: 'Gálibos: OpenStreetMap', sub: 'Alturas máximas declaradas (maxheight) · ODbL' },
  paso: { titulo: 'Pasos a nivel: OpenStreetMap', sub: 'Cruces ferroviarios (railway=level_crossing) · ODbL' }
};

/**
 * Las fuentes de esta ruta: la norma y el dato de la Red —tal como los
 * declara el servidor en cada hallazgo, o la referencia fija si la ruta va
 * toda por la Red— y una por cada cosa que aparece en el camino.
 *
 * @returns {{titulo: string, sub: string}[]}
 */
export function fuentesDeLaRuta(route, alerts) {
  const fuentes = [];
  const vistas = new Set();

  for (const leg of route.accessLegs ?? []) {
    for (const hallazgo of leg.findings ?? []) {
      const titulo = (hallazgo.ruleReference ?? '').trim();
      if (!titulo || vistas.has(titulo)) continue;
      vistas.add(titulo);
      fuentes.push({ titulo, sub: (hallazgo.dataReference ?? '').trim() });
    }
  }

  if (fuentes.length === 0) fuentes.push(FUENTE_RED);

  for (const tipo of ['radar', 'galibo', 'paso']) {
    if (alerts.some((a) => a.tipo === tipo)) fuentes.push(FUENTES_DE_AVISOS[tipo]);
  }

  return fuentes;
}

/** Una cabecera de 55 con solo la flecha de volver y un titulo. */
export function cabeceraSimple(titulo) {
  return `
  <div class="gps-cabecera">
    <button type="button" class="gps-cabecera-volver" data-accion="volver" aria-label="Volver">${dibujo('atras', 22, 2.4)}</button>
    <div class="gps-cabecera-titulo"><span class="gps-cabecera-solo">${escapeHtml(titulo)}</span></div>
  </div>`;
}

const filaDeDetalle = ({ icono = '', titulo, sub }) => `
  <div class="gps-fila">
    ${icono ? `<div class="gps-fila-ico">${calcomania(icono, 30)}</div>` : ''}
    <div class="gps-fila-texto"><b>${escapeHtml(titulo)}</b>${sub ? `<span class="gris">${escapeHtml(sub)}</span>` : ''}</div>
  </div>`;

/**
 * La hoja de detalles: lo que se lee —las cifras, el mono con lo que
 * importa, "En el camino" y "Fuentes"— en un cuerpo que scrollea, y
 * "Arrancar" pegado abajo.
 *
 * @param {{tiempo, hora, km, red, mono: {momento, titulo, texto}, camino: Array, fuentes: Array}} d
 */
export function hojaDetalles({ tiempo, hora, km, red, mono, camino = [], fuentes = [] }) {
  const nada = { titulo: 'Nada que avisar', sub: 'Ni radares, ni gálibos, ni pasos a nivel en el camino' };

  return `
  <div class="gps-detalles">
    <div class="gps-cifras">
      <div><b>${escapeHtml(tiempo)}</b><span>${escapeHtml(hora)}</span></div>
      <div><b>${escapeHtml(km)}</b><span>${escapeHtml(red)}</span></div>
    </div>
    <div class="gps-mono">
      ${mascota(mono.momento, { escala: 1 })}
      <div><b>${escapeHtml(mono.titulo)}</b><span>${escapeHtml(mono.texto)}</span></div>
    </div>
    <p class="gps-seccion">En el camino</p>
    ${(camino.length ? camino : [nada]).map(filaDeDetalle).join('')}
    ${fuentes.length ? `<p class="gps-seccion">Fuentes</p>${fuentes.map(filaDeDetalle).join('')}` : ''}
  </div>
  <div class="gps-acciones">
    ${pildora('Arrancar', { clase: 'celeste', id: 'gps-arrancar', datos: 'data-accion="arrancar"' })}
  </div>`;
}
