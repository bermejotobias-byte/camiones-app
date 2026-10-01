/**
 * Prototipo del GPS — Waze como referencia principal, Maps para la hoja de capas.
 *
 * Genera `index.html`: una hoja con los tableros de cada pantalla del mapa,
 * MEDIDOS sobre las 16 capturas de Waze de `docs/referencias/waze/` (Android,
 * 720 x 1600 px, o sea 360 x 800 dp a 2x). Un dp de Waze es un px de este
 * prototipo; cada color esta sampleado de la captura y cada medida contada en
 * pixeles (ver los comentarios "waze-NN"). Adaptado a lo nuestro: la Red de
 * Transito Pesado, los galibos, los lugares para camiones, el camion elegido.
 *
 *   node gps.mjs
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..', '..');

const png = (nombre) =>
  'data:image/png;base64,' +
  readFileSync(join(raiz, 'src/TruckNavigator.Api/wwwroot/img/mascota', nombre)).toString('base64');

// La mascota entra al lienzo como archivo de imagen (--image); se referencia por nombre.
const MONO = 'binoculares.png';

/* ===========================================================================
   Paletas — la nocturna sampleada de las capturas (waze-03, 06, 08, 02)
=========================================================================== */

const NOCHE = {
  tierra: '#272d39',
  manzanaA: '#252e3d', manzanaB: '#233041', predio: '#2e3d50',
  calle: '#40546c', avenida: '#4d6179', red: '#6d89a8', autopista: '#7494b4', carril: '#4a5c74', centro: '#c8d3df',
  ferrocarril: '#3a4553', ferrocarrilDash: '#aab4bf',
  parque: '#216a4f', parqueBorde: '#1d5e46', agua: '#22467a',
  rotulo: '#d9e5ee', halo: '#272d39', barrio: '#8b95a5', parqueRotulo: '#6fc48a', poi: '#8fb8e8',
  redRotulo: '#e6eef5', flecha: '#8fb3d9'
};

const DIA = {
  tierra: '#eef1f4',
  manzanaA: '#e9edf1', manzanaB: '#e4eaf0', predio: '#dfe5eb',
  calle: '#ffffff', avenida: '#ffffff', red: '#9db4cc', autopista: '#ffe6a3', carril: '#e8cf85', centro: '#ffffff',
  ferrocarril: '#c5ccd4', ferrocarrilDash: '#ffffff',
  parque: '#c6e5c0', parqueBorde: '#b3d6ac', agua: '#a8d2f1',
  rotulo: '#2a323b', halo: '#eef1f4', barrio: '#6f7a86', parqueRotulo: '#3f8f4f', poi: '#3c74b8',
  redRotulo: '#2a323b', flecha: '#7fa4cf'
};

const RUTA = '#2ddcff';        // la linea de la ruta (waze-06, fila 800)
const CYAN = '#32ccfe';        // botones y pildoras (waze-03, "Continuar viaje")
const CYAN_TEXTO = '#32c8fb';  // texto celeste ("Junin", "Vista general")
const CHEVRON = '#00b5d0';     // el vehiculo (waze-06)
const GLOBO = '#1d7699';       // globos de calle (waze-06, waze-08)
const AMARILLO = '#f9c531';
const ROJO = '#e9463f';
const VERDE = '#43c98b';

/* ===========================================================================
   Iconos
=========================================================================== */

const UI = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  ubicacion: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  capas: '<path d="M12 4l8 4.5-8 4.5-8-4.5z"/><path d="M4 13l8 4.5 8-4.5"/><path d="M19 17.5v3M17.5 19h3"/>',
  centrar: '<circle cx="12" cy="12" r="2.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/><path d="M12 3l-2.2 2.6M12 3l2.2 2.6M12 21l-2.2-2.6M12 21l2.2-2.6M3 12l2.6-2.2M3 12l2.6 2.2M21 12l-2.6-2.2M21 12l-2.6 2.2"/>',
  rutas: '<path d="M12 21v-8M12 13l-5-5V4M12 13l5-5V4"/><circle cx="7" cy="4" r="1.6"/><circle cx="17" cy="4" r="1.6"/><circle cx="12" cy="21" r="1.6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sonido: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  paradas: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="8" cy="18" r="2.2"/><path d="M8 6h6a3 3 0 0 1 0 6h-3a3 3 0 0 0 0 6"/>',
  mano: '<path d="M9 12V5a1.5 1.5 0 0 1 3 0v6M12 10V4a1.5 1.5 0 0 1 3 0v7M15 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S6 18 6 14v-3a1.5 1.5 0 0 1 3 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camion: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  telefono: '<path d="M6 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 6a2 2 0 0 1 2-2z"/>'
};

const ui = (nombre, t = 24, color = 'currentColor', grosor = 2.2) =>
  `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[nombre]}</svg>`;

const flechaIr = (t = 16, color = '#0a1f2a') =>
  `<svg viewBox="0 0 24 24" width="${t}" height="${t}" aria-hidden="true"><path d="M12 3l8 18-8-4.5L4 21z" fill="${color}"/></svg>`;

/** Calcomanias: relleno saturado con contorno blanco, como las de Waze. */
const cal = (inner, t = 28) =>
  `<svg viewBox="0 0 32 32" width="${t}" height="${t}" style="overflow:visible" aria-hidden="true">${inner}</svg>`;

const borde = 'stroke="#fff" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"';

const CAL = {
  gomeria: `<circle cx="16" cy="16" r="11.5" fill="#55636f" ${borde}/><circle cx="16" cy="16" r="6" fill="#d7dfe6"/><circle cx="16" cy="16" r="2.4" fill="#55636f"/>`,
  taller: `<path d="M20 4a7 7 0 0 0-6.6 9.4L4 22.8 8.2 27l9.4-9.4A7 7 0 0 0 27 11l-4.4 2-3.2-3.2 2-4.4A7 7 0 0 0 20 4z" fill="#f28c28" ${borde}/>`,
  estacion: `<path d="M6 5h12v22H6z" fill="#35b26b" ${borde}/><path d="M9 8h6v6H9z" fill="#dff5e8"/><path d="M19 11h2.5l4 4v8a2.5 2.5 0 0 1-5 0v-7h-1.5" fill="none" stroke="#35b26b" stroke-width="2.6" stroke-linejoin="round"/>`,
  comer: `<path d="M9 4v9a3 3 0 0 0 3 3v12h2V16a3 3 0 0 0 3-3V4h-2v8h-1V4h-2v8h-1V4zM21 4c-2.5 0-4 3-4 7v6h2v11h2V4z" fill="#e85d6b" ${borde}/>`,
  auxilio: `<path d="M4 20h4l3-6h9l4 6h4v4H4z" fill="#f5c400" ${borde}/><circle cx="9" cy="24" r="3" fill="#2b3035" stroke="#fff" stroke-width="1.8"/><circle cx="23" cy="24" r="3" fill="#2b3035" stroke="#fff" stroke-width="1.8"/><path d="M20 14V8l6-3" fill="none" stroke="#f5c400" stroke-width="2.6" stroke-linecap="round" paint-order="stroke"/>`,
  playa: `<rect x="5" y="5" width="22" height="22" rx="5" fill="#4b7bec" ${borde}/><path d="M12 23V9h5.5a4 4 0 0 1 0 8H12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  red: `<path d="M4 26L12 6h8l8 20h-6l-1.5-5h-9L10 26z" fill="#6d89a8" ${borde}/><path d="M16 9v3M16 15v3M16 21v3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  galibo: `<path d="M3 27V12a13 13 0 0 1 26 0v15h-6V14a7 7 0 0 0-14 0v13z" fill="${ROJO}" ${borde}/>`,
  galiboOk: `<path d="M3 27V12a13 13 0 0 1 26 0v15h-6V14a7 7 0 0 0-14 0v13z" fill="#6b7c8c" ${borde}/>`,
  paso: `<path d="M16 3l3 3-3 3-3-3z" fill="${ROJO}" ${borde}/><path d="M6 8h20l-10 10zM6 28l10-10 10 10z" fill="${ROJO}" ${borde}/><rect x="14" y="8" width="4" height="20" fill="#7c8794" ${borde}/>`,
  radar: `<rect x="4" y="7" width="24" height="18" rx="4" fill="#4f6d8e" ${borde}/><circle cx="16" cy="16" r="5.5" fill="#1b2632"/><circle cx="16" cy="16" r="2.4" fill="#8fdcf7"/><circle cx="24" cy="11" r="1.6" fill="${AMARILLO}"/>`,
  zona: `<path d="M16 4L30 28H2z" fill="${ROJO}" ${borde}/><path d="M16 12v7M16 22.5v.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  casa: `<path d="M4 15L16 5l12 10v13H4z" fill="#f28c28" ${borde}/><path d="M13 28v-8h6v8" fill="#fff"/>`,
  deposito: `<path d="M4 12l12-6 12 6v16H4z" fill="#8a6a4a" ${borde}/><path d="M9 28v-9h14v9M9 23h14" fill="none" stroke="#fff" stroke-width="2"/>`,
  lugar: `<path d="M16 3a9 9 0 0 1 9 9c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 9-9z" fill="#8b5cf6" ${borde}/><circle cx="16" cy="12" r="3.5" fill="#fff"/>`,
  lugarMas: `<path d="M16 3a9 9 0 0 1 9 9c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 9-9z" fill="#ffc302" ${borde}/><path d="M16 8v8M12 12h8" stroke="#2b1405" stroke-width="2.8" stroke-linecap="round"/>`,
  aviso: `<path d="M16 4L30 28H2z" fill="#ffc302" ${borde}/><path d="M16 12v7M16 22.5v.5" stroke="#2b1405" stroke-width="3" stroke-linecap="round"/>`,
  bandera: `<path d="M8 3v26" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M8 4h16l-3 5 3 5H8z" fill="#fff" stroke="#fff" stroke-width="1.5"/><path d="M8 4h4v3.5H8zM16 4h4v3.5h-4zM12 7.5h4V11h-4zM20 7.5h4V11h-4zM8 11h4v3H8zM16 11h4v3h-4z" fill="#111"/>`,
  comunidad: `<circle cx="11" cy="11" r="5" fill="${CYAN}" ${borde}/><circle cx="22" cy="12" r="4" fill="${CYAN}" ${borde}/><path d="M3 27c0-6 4-9 8-9s8 3 8 9zM17 26c.5-4 2.5-6.5 5-6.5s6 2.5 6 6.5z" fill="${CYAN}" ${borde}/>`
};

const CATEGORIAS = [
  { id: 'gomeria', nombre: 'Gomería', plural: 'Gomerías' },
  { id: 'taller', nombre: 'Taller', plural: 'Talleres' },
  { id: 'estacion', nombre: 'Estación', plural: 'Estaciones' },
  { id: 'comer', nombre: 'Comer', plural: 'Comer' },
  { id: 'auxilio', nombre: 'Auxilio', plural: 'Auxilio' },
  { id: 'playa', nombre: 'Playa', plural: 'Playas' }
];

/* Los cuatro accesos del zocalo, copiados de dock.js: es una pieza aprobada. */
const ZOCALO = {
  mapa: `<path d="M16 5 L26 27 L16 22 L6 27 Z" fill="#1a6f9a" transform="translate(0 2)"/><path d="M16 5 L26 27 L16 22 L6 27 Z" fill="#35b8e8"/><path d="M16 5 L26 27 L16 22 Z" fill="#8fdcf7" opacity=".55"/>`,
  juegos: `<path d="M9 10h14a6 6 0 0 1 6 6l-1 7a3.5 3.5 0 0 1-6 2l-2-3h-8l-2 3a3.5 3.5 0 0 1-6-2l-1-7a6 6 0 0 1 6-6z" fill="#6d46c4" transform="translate(0 2)"/><path d="M9 10h14a6 6 0 0 1 6 6l-1 7a3.5 3.5 0 0 1-6 2l-2-3h-8l-2 3a3.5 3.5 0 0 1-6-2l-1-7a6 6 0 0 1 6-6z" fill="#a97bf0"/><path d="M10.5 14v6M7.5 17h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="22" cy="15.5" r="1.6" fill="#fff"/><circle cx="25" cy="18.5" r="1.6" fill="#fff"/>`,
  emergencia: `<circle cx="16" cy="18" r="11" fill="#b6362b"/><circle cx="16" cy="16" r="11" fill="#f0736a"/><circle cx="16" cy="16" r="5" fill="#fff"/><path d="M16 5v6M16 21v6M5 16h6M21 16h6" stroke="#fff" stroke-width="3.2"/><circle cx="16" cy="16" r="4" fill="#f0736a" opacity=".35"/>`,
  mas: `<circle cx="16" cy="18" r="12" fill="#3f3aa0"/><circle cx="16" cy="16" r="12" fill="#6b64d9"/><circle cx="10" cy="16" r="2.1" fill="#fff"/><circle cx="16" cy="16" r="2.1" fill="#fff"/><circle cx="22" cy="16" r="2.1" fill="#fff"/>`
};

const zocalo = (activo = 'mapa') => `
<div class="zocalo">
  ${['mapa', 'juegos', 'emergencia', 'mas'].map((id) => `
  <div class="zocalo-item${id === activo ? ' is-active' : ''}"><svg viewBox="0 0 32 32" width="30" height="30">${ZOCALO[id]}</svg></div>`).join('')}
</div>`;

/* ===========================================================================
   El mapa dibujado
   ---------------------------------------------------------------------------
   Coordenadas "de suelo" de 360 x 800. En modo inclinado se proyectan: las
   filas lejanas (arriba) se comprimen y se angostan, las cercanas se ensanchan.
   Los rotulos y los pines se proyectan pero quedan derechos, como en Waze.

   Criterios de Waze de noche, medidos en las capturas:
   · calles SIN borde, puntas y uniones redondas, sobre el fondo liso;
   · de cerca (waze-03, waze-06) las calles miden 10 dp; de lejos (waze-08)
     2,5 y las avenidas 4; la autopista es una banda clara de 14 con dos lineas
     de carril y la central punteada;
   · las manzanas no son todas iguales: hay dos tonos y los predios grandes
     van mas claros; los parques en verde, el agua en azul;
   · rotulos de calle en 12 sp claros a lo largo de la calle, barrios en 17 sp
     gris, parques en verde, lugares en celeste claro; de cerca, flechas de
     mano sobre las calles y semaforos en los cruces.
=========================================================================== */

const W = 360;
const H = 800;

function proyector(inclinado) {
  if (!inclinado) return (x, y) => [x, y];
  return (x, y) => {
    const t = Math.max(0, Math.min(1, y / H));
    const s = 0.4 + 0.6 * t;
    return [W / 2 + (x - W / 2) * s * 1.4, H * Math.pow(t, 1.45)];
  };
}

const f1 = (v) => (Math.round(v * 10) / 10).toString();

/**
 * @param {object} o
 * @param {object} o.tema         NOCHE | DIA
 * @param {boolean} o.inclinado
 * @param {'cerca'|'lejos'} o.zoom   grosores de calle
 * @param {Array} o.vias          [{ pts, tipo }] calle | avenida
 * @param {Array} o.red           [{ pts, autopista }]
 * @param {Array} o.ferrocarriles [pts]
 * @param {Array} o.manzanas      [{ pts, tono: 'a'|'b'|'predio' }]
 * @param {Array} o.parques       [pts]
 * @param {Array} o.aguas         [pts]
 * @param {Array} o.rutas         [{ pts, color, ancho, canto }]
 * @param {Array} o.rotulos       [{ x, y, texto, tipo, rot }]
 * @param {Array} o.flechas       [{ x, y, rot }]
 * @param {Array} o.semaforos     [[x, y]]
 * @param {Function} o.encima     (P) => svg
 */
function mapa({
  tema = NOCHE, inclinado = false, zoom = 'cerca', vias = [], red = [], ferrocarriles = [], manzanas = [],
  parques = [], aguas = [], rutas = [], rotulos = [], flechas = [], semaforos = [], encima = null, atenuado = false
} = {}) {
  const P = proyector(inclinado);
  const pt = ([x, y]) => P(x, y).map(f1).join(' ');
  const poli = (pts) => pts.map(pt).join(' ');
  const trazo = (pts, color, ancho, extra = '') =>
    `<polyline points="${poli(pts)}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

  const g = zoom === 'cerca'
    ? { calle: 10, avenida: 12, red: 14, autopista: 16 }
    : { calle: 2.5, avenida: 4, red: 5.5, autopista: 14 };

  let s = `<svg class="mapa" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
  s += `<rect width="${W}" height="${H}" fill="${tema.tierra}"/>`;

  for (const m of manzanas) {
    const color = m.tono === 'predio' ? tema.predio : m.tono === 'b' ? tema.manzanaB : tema.manzanaA;
    s += `<polygon points="${poli(m.pts)}" fill="${color}"/>`;
  }
  for (const a of aguas) s += `<polygon points="${poli(a)}" fill="${tema.agua}"/>`;

  // De dia las calles son blancas y llevan un filete gris que las separa.
  if (tema === DIA) {
    for (const v of vias) s += trazo(v.pts, '#d3d9e0', g[v.tipo] + 2);
  }
  for (const v of vias.filter((v) => v.tipo === 'calle')) s += trazo(v.pts, tema.calle, g.calle);

  // Un parque ocupa manzanas enteras: va DESPUES de la trama menor —las
  // calles chicas no lo atraviesan— y ANTES de las avenidas, que lo bordean.
  // El trazo del mismo color redondea las esquinas; el borde le da cuerpo.
  for (const p of parques) {
    s += `<polygon points="${poli(p)}" fill="${tema.parque}" stroke="${tema.parque}" stroke-width="8" stroke-linejoin="round"/>`;
    s += `<polygon points="${poli(p)}" fill="none" stroke="${tema.parqueBorde}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }

  for (const v of vias.filter((v) => v.tipo === 'avenida')) s += trazo(v.pts, tema.avenida, g.avenida);

  // Ferrocarril: linea gris con rayas claras, como "Ferrocarril Mitre" en waze-09.
  for (const f of ferrocarriles) {
    s += trazo(f, tema.ferrocarril, zoom === 'cerca' ? 6 : 3.5);
    s += trazo(f, tema.ferrocarrilDash, zoom === 'cerca' ? 2 : 1.4, 'stroke-dasharray="4 7"');
  }

  // La Red de Transito Pesado: la via mas clara y mas ancha del mapa, el lugar
  // que en Waze ocupa la autopista. Si el tramo es autopista lleva ademas el
  // tratamiento de waze-08: carriles y centro punteado.
  for (const t of red) {
    if (t.autopista) {
      s += trazo(t.pts, tema.autopista, g.autopista);
      const off = g.autopista * 0.28;
      s += `<g transform="translate(0 ${-off})">${trazo(t.pts, tema.carril, 1, 'opacity=".8"')}</g>`;
      s += `<g transform="translate(0 ${off})">${trazo(t.pts, tema.carril, 1, 'opacity=".8"')}</g>`;
      s += trazo(t.pts, tema.centro, 1.2, 'stroke-dasharray="5 6" opacity=".9"');
    } else {
      s += trazo(t.pts, tema.red, g.red);
    }
  }

  // Flechas de mano: chicas, celeste claro, sobre la calle (waze-03).
  for (const f of flechas) {
    const [x, y] = P(f.x, f.y);
    s += `<path d="M-4.5 0h8M0.5 -3.5l3.5 3.5-3.5 3.5" transform="translate(${f1(x)} ${f1(y)}) rotate(${f.rot ?? 0})" fill="none" stroke="${tema.flecha}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
  }

  // Las rutas: un canto claro apenas visible y la linea; la elegida encima.
  for (const r of [...rutas].reverse()) {
    const ancho = r.ancho ?? 8;
    s += trazo(r.pts, r.canto ?? 'rgba(255,255,255,.35)', ancho + 2);
    s += trazo(r.pts, r.color, ancho);
  }

  // Semaforos: la pastilla blanca vertical con tres puntos (waze-03: 11 x 22).
  for (const [sx, sy] of semaforos) {
    const [x, y] = P(sx, sy);
    s += `<g transform="translate(${f1(x)} ${f1(y)})"><rect x="-5.5" y="-11" width="11" height="22" rx="4" fill="#fff"/><circle cy="-5.5" r="2.2" fill="#e9463f"/><circle cy="0" r="2.2" fill="#f9c531"/><circle cy="5.5" r="2.2" fill="#43c98b"/></g>`;
  }

  for (const r of rotulos) {
    const [x, y] = P(r.x, r.y);
    const rot = r.rot ? ` transform="rotate(${r.rot} ${f1(x)} ${f1(y)})"` : '';
    const lineas = r.texto.split('\n');
    const texto = (clase, color, halo, extra = '') => lineas.map((l, i) =>
      `<text x="${f1(x)}" y="${f1(y + i * (r.tipo === 'barrio' ? 20 : 15))}" class="${clase}" fill="${color}"${halo ? ` stroke="${tema.halo}" stroke-width="2.5" paint-order="stroke"` : ''} text-anchor="middle"${extra}${rot}>${l}</text>`).join('');
    if (r.tipo === 'barrio') s += texto('rot-barrio', tema.barrio, true);
    else if (r.tipo === 'parque') s += texto('rot-parque', tema.parqueRotulo, true);
    else if (r.tipo === 'poi') s += texto('rot-poi', tema.poi, true);
    else if (r.tipo === 'red') s += texto('rot-red', tema.redRotulo, true);
    else if (r.tipo === 'globo') s += globo(x, y, r.texto);
    else s += texto('rot-calle', tema.rotulo, true);
  }

  if (encima) s += encima(P);
  if (atenuado) s += `<rect width="${W}" height="${H}" fill="rgba(0,0,0,.6)"/>`;

  s += '</svg>';
  return s;
}

/**
 * Globo de calle, medido en waze-06 y waze-08: 30 dp de alto por linea (48 con
 * dos), radio 7, relleno #1d7699, texto en 18 sp negrita blanco. La punta de la
 * cola cae exactamente en (x, y), sobre la calle que nombra, y ahi va el punto
 * blanco que Waze tambien pone.
 */
function globo(x, y, texto) {
  const lineas = texto.split('\n');
  const ancho = Math.max(...lineas.map((l) => l.length)) * 10.2 + 24;
  const alto = 30 + (lineas.length - 1) * 18;
  const cola = 11;
  const x0 = x - ancho / 2;
  const y0 = y - alto - cola;

  return `<g class="globo">
    <rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(ancho)}" height="${alto}" rx="7" fill="${GLOBO}"/>
    <path d="M${f1(x - 7)} ${f1(y0 + alto - 1)} L${f1(x)} ${f1(y)} L${f1(x + 7)} ${f1(y0 + alto - 1)}z" fill="${GLOBO}"/>
    <circle cx="${f1(x)}" cy="${f1(y)}" r="3.2" fill="#fff" stroke="${GLOBO}" stroke-width="2"/>
    ${lineas.map((l, i) => `<text x="${f1(x)}" y="${f1(y0 + 20.5 + i * 18)}" text-anchor="middle" class="rot-globo" fill="#fff">${l}</text>`).join('')}
  </g>`;
}

/**
 * Chapa cuadrada: datos fijos del mapa. Es la forma que Waze usa para las
 * camaras (waze-11): cuadrado blanco redondeado de 24 con el dibujo, y para la
 * camara de velocidad, un semaforo chico pegado al costado.
 */
const chapa = (P, x, y, icono, t = 24) => {
  const [px, py] = P(x, y);
  const semaforo = icono === 'radar'
    ? `<g transform="translate(${t + 1} ${t / 2 - 8})"><rect width="6" height="16" rx="3" fill="#fff"/><circle cx="3" cy="4" r="1.4" fill="#e9463f"/><circle cx="3" cy="8" r="1.4" fill="#f9c531"/><circle cx="3" cy="12" r="1.4" fill="#43c98b"/></g>`
    : '';
  return `<g transform="translate(${f1(px - t / 2)} ${f1(py - t / 2)})"><rect width="${t}" height="${t}" rx="5" fill="#fff"/><g transform="translate(2 2)">${cal(CAL[icono], t - 4)}</g>${semaforo}</g>`;
};

/**
 * Pin redondo: los lugares. Medido en los reportes de Waze (waze-08): 32 dp,
 * anillo blanco de 3, cola chica abajo, contador gris arriba a la derecha. El
 * anillo dice de donde sale el dato: blanco = verificado, celeste = la
 * comunidad, gris y apagado = sin confirmar.
 */
const pin = (P, x, y, icono, estado = 'verificado', t = 32, contador = null) => {
  const [px, py] = P(x, y);
  const anillo = estado === 'comunidad' ? CYAN : estado === 'sin' ? '#8b949e' : '#fff';
  const opacidad = estado === 'sin' ? '.72' : '1';
  const badge = contador
    ? `<circle cx="${t / 2 - 3}" cy="${-t / 2 + 4}" r="8.5" fill="#6e7378" stroke="#fff" stroke-width="2"/><text x="${t / 2 - 3}" y="${-t / 2 + 8}" text-anchor="middle" class="rot-badge" fill="#fff">${contador}</text>`
    : '';
  return `<g transform="translate(${f1(px)} ${f1(py)})" opacity="${opacidad}">
    <path d="M-5 ${t / 2 - 5} l5 8 l5 -8z" fill="${anillo}"/>
    <circle r="${t / 2}" fill="#2b3035" stroke="${anillo}" stroke-width="3"/>
    <g transform="translate(${-t / 2 + 7} ${-t / 2 + 7})">${cal(CAL[icono], t - 14)}</g>
    ${badge}
  </g>`;
};

/**
 * El chevron del vehiculo, medido en waze-06: 40 x 39, relleno #00b5d0 con
 * contorno blanco de 3 y una base clara que le da cuerpo, sobre un disco de
 * 82 apenas mas claro que el fondo.
 */
const chevron = (P, x, y, rot = 0) => {
  const [px, py] = P(x, y);
  return `<g transform="translate(${f1(px)} ${f1(py)}) rotate(${rot})">
    <circle r="41" fill="rgba(255,255,255,.06)"/>
    <path d="M0 -13 L19 24 L0 15 L-19 24 Z" fill="#cfe9ee" stroke="#fff" stroke-width="3" stroke-linejoin="round" transform="translate(0 5)"/>
    <path d="M0 -19 L19 18 L0 9 L-19 18 Z" fill="${CHEVRON}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  </g>`;
};

/** La flecha blanca de la maniobra sobre la calle, con su sombra celeste (waze-06). */
const flechaMapa = (P, x, y, rot = 0) => {
  const [px, py] = P(x, y);
  return `<g transform="translate(${f1(px)} ${f1(py)}) rotate(${rot})">
    <path d="M0 24 V4 M-8 11 L0 2 L8 11" fill="none" stroke="rgba(0,181,208,.45)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M0 24 V4 M-8 11 L0 2 L8 11" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
};

const banderaDestino = (P, x, y) => {
  const [px, py] = P(x, y);
  return `<g transform="translate(${f1(px - 18)} ${f1(py - 44)})"><path d="M18 0a14 14 0 0 1 14 14c0 11-14 30-14 30S4 25 4 14A14 14 0 0 1 18 0z" fill="#fff"/><g transform="translate(6 3)">${cal(CAL.bandera, 24)}</g></g>`;
};

/** Escudo de ruta, como "AU 9" en waze-04: blanco, texto negro, banda celeste arriba. */
const escudo = (P, x, y, texto) => {
  const [px, py] = P(x, y);
  return `<g transform="translate(${f1(px - 17)} ${f1(py - 13)})"><rect width="34" height="26" rx="4" fill="#fff"/><rect width="34" height="6" rx="2" fill="#74acdf"/><rect y="4" width="34" height="2" fill="#fff"/><text x="17" y="21" text-anchor="middle" class="rot-escudo" fill="#111">${texto}</text></g>`;
};

/* ===========================================================================
   Piezas de interfaz, medidas
=========================================================================== */

const barraEstado = () => `
<div class="estado"><span>7:37 <i>☁</i></span><span class="estado-der"><i>◉</i> ▮▮▮ ◔ <b>75</b> <em>●</em></span></div>`;

const botonRedondo = (icono, clase = '', etiqueta = '') =>
  `<div class="redondo ${clase}" title="${etiqueta}">${icono.startsWith('<') ? icono : ui(icono, 26, 'currentColor', 2.4)}</div>`;

/**
 * La banda, medida en waze-06: 127 dp con la barra de estado; flecha de
 * 40 x 46 con trazo de 5 a 20 del borde; texto a 85: distancia 27 sp regular,
 * calle 24 sp media celeste. La compacta (waze-01) baja a 92 y pone todo en
 * una linea de 20 sp.
 */
const banda = ({ distancia = '200 m', calle = 'Av. Sáenz', compacta = false } = {}) => `
<div class="banda${compacta ? ' compacta' : ''}">
  <svg viewBox="0 0 44 50" class="banda-flecha" aria-hidden="true">
    <path d="M37 48V24a9 9 0 0 0-9-9H10" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18 6L8 15l10 9" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <div class="banda-texto"><b>${distancia}</b><span>${calle}</span></div>
</div>`;

const chip = (color, texto) => `<span class="chip"><i style="background:${color}"></i>${texto}</span>`;

const manija = () => '<div class="manija"></div>';

const filaAcceso = (icono, titulo, sub, subClase = 'celeste') => `
<div class="fila">
  <div class="fila-ico">${cal(CAL[icono], 30)}</div>
  <div class="fila-texto"><b>${titulo}</b><span class="${subClase}">${sub}</span></div>
</div>`;

const filaUi = (icono, titulo, sub, subClase = 'gris') => `
<div class="fila">
  <div class="fila-ico fila-ico-ui">${ui(icono, 24, '#d7dee5')}</div>
  <div class="fila-texto"><b>${titulo}</b><span class="${subClase}">${sub}</span></div>
</div>`;

const mono = (titulo, texto) => `
<div class="mono">
  <img src="${MONO}" alt="" width="64" height="64">
  <div><b>${titulo}</b><span>${texto}</span></div>
</div>`;

/* ===========================================================================
   Tableros
=========================================================================== */

const tableros = [];
const tablero = (id, titulo, nota, cuerpo, { tema = 'noche' } = {}) =>
  tableros.push({ id, titulo, nota, cuerpo, tema });

const CAMION = 'El Rayo';

/* ---------------------------------------------------------------------------
   Escena de cerca, en reposo (calcada de waze-03): manzanas grandes de 90,
   calles de 10, dos tonos de manzana, un predio, un parque de dos manzanas.
--------------------------------------------------------------------------- */

const XS = [30, 118, 208, 300];
const YS = [60, 150, 250, 340, 430, 520, 610, 700];

const VIAS_CERCA = [
  ...XS.map((x) => ({ pts: [[x, -40], [x, H + 40]], tipo: 'calle' })),
  ...YS.map((y) => ({ pts: [[-40, y], [W + 40, y]], tipo: 'calle' }))
];

const RED_CERCA = [
  { pts: [[208, -40], [208, H + 40]] },            // Av. Saenz
  { pts: [[-40, 250], [W + 40, 250]] }             // Av. Amancio Alcorta
];

const MANZANAS_CERCA = [
  { pts: [[118, 340], [208, 340], [208, 430], [118, 430]], tono: 'predio' },
  { pts: [[30, 520], [118, 520], [118, 610], [30, 610]], tono: 'b' },
  { pts: [[300, 60], [380, 60], [380, 150], [300, 150]], tono: 'b' },
  { pts: [[-40, 340], [30, 340], [30, 430], [-40, 430]], tono: 'b' },
  { pts: [[300, 520], [380, 520], [380, 610], [300, 610]], tono: 'b' }
];

const PARQUE_CERCA = [[[215, 347], [293, 347], [293, 513], [215, 513]]];

const FLECHAS_CERCA = [
  { x: 30, y: 300, rot: -90 }, { x: 30, y: 475, rot: -90 }, { x: 30, y: 655, rot: -90 },
  { x: 118, y: 200, rot: 90 }, { x: 118, y: 475, rot: 90 }, { x: 118, y: 655, rot: 90 },
  { x: 300, y: 200, rot: -90 }, { x: 300, y: 300, rot: -90 }, { x: 300, y: 475, rot: -90 },
  { x: 74, y: 150, rot: 180 }, { x: 163, y: 150, rot: 180 }, { x: 254, y: 150, rot: 180 },
  { x: 74, y: 340, rot: 0 }, { x: 163, y: 340, rot: 0 },
  { x: 74, y: 430, rot: 180 }, { x: 163, y: 430, rot: 180 },
  { x: 74, y: 520, rot: 0 }, { x: 163, y: 520, rot: 0 }, { x: 254, y: 520, rot: 0 },
  { x: 254, y: 610, rot: 180 }, { x: 163, y: 610, rot: 180 }
];

const SEMAFOROS_CERCA = [[208, 150], [118, 250], [300, 430]];

const ROTULOS_CERCA = [
  { x: 118, y: 110, texto: 'Villa Soldati', tipo: 'barrio' },
  { x: 254, y: 434, texto: 'Parque Roca', tipo: 'parque' },
  { x: 163, y: 380, texto: 'Mercado\nde Flores', tipo: 'poi' },
  { x: 74, y: 566, texto: 'Pompeya', tipo: 'barrio' },
  { x: 208, y: 200, texto: 'AV. SÁENZ', tipo: 'red', rot: -90 },
  { x: 262, y: 246, texto: 'AV. AMANCIO ALCORTA', tipo: 'red' },
  { x: 26, y: 400, texto: 'Zuviría', tipo: 'calle', rot: -90 },
  { x: 60, y: 336, texto: 'Riestra', tipo: 'calle' },
  { x: 114, y: 470, texto: 'Traful', tipo: 'calle', rot: -90 },
  { x: 340, y: 426, texto: 'Esquiú', tipo: 'calle' },
  { x: 160, y: 516, texto: 'Ancaste', tipo: 'calle' },
  { x: 250, y: 606, texto: 'Pepirí', tipo: 'calle' },
  { x: 296, y: 300, texto: 'Sáenz Peña', tipo: 'calle', rot: -90 }
];

const encimaCerca = (P) => [
  chapa(P, 208, 380, 'radar'),
  chapa(P, 30, 250, 'galiboOk'),
  pin(P, 260, 295, 'gomeria', 'verificado'),
  pin(P, 74, 200, 'estacion', 'verificado'),
  pin(P, 345, 380, 'taller', 'comunidad', 32, '3'),
  pin(P, 74, 470, 'comer', 'sin'),
  chevron(P, 208, 500, 0)
].join('');

const MAPA_CERCA = (extra = {}) => mapa({
  vias: VIAS_CERCA, red: RED_CERCA, manzanas: MANZANAS_CERCA, parques: PARQUE_CERCA, flechas: FLECHAS_CERCA,
  semaforos: SEMAFOROS_CERCA, rotulos: ROTULOS_CERCA.filter((r) => r.texto), encima: encimaCerca, ...extra
});

/* ---------------------------------------------------------------------------
   Escena de cerca, en viaje (calcada de waze-06): el camion sube por la Red y
   dobla a la izquierda en Av. Saenz. La vertical por la que va queda un poco a
   la izquierda del centro, como en la captura.
--------------------------------------------------------------------------- */

const XV = [40, 150, 230, 330];
const YV = [60, 150, 240, 330, 420, 510, 600, 690];

const VIAS_VIAJE = [
  ...XV.map((x) => ({ pts: [[x, -80], [x, H + 120]], tipo: 'calle' })),
  ...YV.map((y) => ({ pts: [[-140, y], [W + 140, y]], tipo: 'calle' })),
  { pts: [[-140, 700], [W + 140, 640]], tipo: 'calle' }
];

const RED_VIAJE = [
  { pts: [[150, -80], [150, H + 120]] },           // Av. Amancio Alcorta: por donde va
  { pts: [[-140, 330], [W + 140, 330]] },          // Av. Saenz: a donde dobla
  { pts: [[40, -80], [40, H + 120]] }              // Av. Velez Sarsfield
];

const MANZANAS_VIAJE = [
  { pts: [[230, 420], [330, 420], [330, 600], [230, 600]], tono: 'predio' },
  { pts: [[40, 420], [150, 420], [150, 510], [40, 510]], tono: 'b' },
  { pts: [[-140, 150], [40, 150], [40, 240], [-140, 240]], tono: 'b' },
  { pts: [[330, 240], [W + 140, 240], [W + 140, 330], [330, 330]], tono: 'b' }
];

const PARQUE_VIAJE = [[[237, 67], [323, 67], [323, 233], [237, 233]]];
const SEMAFOROS_VIAJE = [[150, 240]];

const RUTA_VIAJE = [[150, 950], [150, 330], [40, 330], [40, -80]];

const ROTULOS_VIAJE = [
  { x: 95, y: 40, texto: 'Pompeya', tipo: 'barrio' },
  { x: 280, y: 152, texto: 'Parque\nPatricios', tipo: 'parque' },
  { x: 280, y: 505, texto: 'Club\nPompeya', tipo: 'poi' },
  { x: 95, y: 146, texto: 'Traful', tipo: 'calle' },
  { x: 280, y: 236, texto: 'Zavaleta', tipo: 'calle' },
  { x: 290, y: 416, texto: 'Esquiú', tipo: 'calle' },
  { x: 95, y: 506, texto: 'Ancaste', tipo: 'calle' },
  { x: 95, y: 596, texto: 'Pepirí', tipo: 'calle' },
  { x: 290, y: 326, texto: 'AV. SÁENZ', tipo: 'red' },
  { x: 36, y: 470, texto: 'AV. VÉLEZ SARSFIELD', tipo: 'red', rot: -90 },
  // El globo, clavado sobre Av. Saenz, en el tramo al que se dobla.
  { x: 105, y: 330, texto: 'Av. Sáenz', tipo: 'globo' }
];

const encimaViaje = (P, { flecha = true, sinChevron = false } = {}) => [
  chapa(P, 150, 425, 'radar'),
  chapa(P, 230, 330, 'galiboOk'),
  pin(P, 95, 465, 'estacion', 'verificado', 30),
  flecha ? flechaMapa(P, 150, 330, -90) : '',
  sinChevron ? '' : chevron(P, 150, 560, 0)
].join('');

const MAPA_VIAJE = (extra = {}) => mapa({
  inclinado: true, vias: VIAS_VIAJE, red: RED_VIAJE, manzanas: MANZANAS_VIAJE, parques: PARQUE_VIAJE,
  semaforos: SEMAFOROS_VIAJE, rutas: [{ pts: RUTA_VIAJE, color: RUTA }], rotulos: ROTULOS_VIAJE, encima: encimaViaje, ...extra
});

/* ---------------------------------------------------------------------------
   Escena de lejos, la vista general (calcada de waze-02 y waze-08): trama
   densa y fina, autopista con carriles, ferrocarril, rio, parques y barrios
   en grande.
--------------------------------------------------------------------------- */

// La trama de lejos no es pareja: cada tanto falta una calle y la manzana
// sale doble, como en cualquier ciudad de verdad.
const VIAS_LEJOS = [];
for (let x = 8, k = 0; x <= 400; x += 26, k++) {
  if (k % 5 === 3) continue;
  VIAS_LEJOS.push({ pts: [[x, -40], [x, H + 40]], tipo: x % 78 === 8 ? 'avenida' : 'calle' });
}
for (let y = 10, k = 0; y <= H + 40; y += 26, k++) {
  if (k % 7 === 4) continue;
  VIAS_LEJOS.push({ pts: [[-40, y], [W + 40, y]], tipo: y % 78 === 10 ? 'avenida' : 'calle' });
}
VIAS_LEJOS.push({ pts: [[-40, 90], [400, 330]], tipo: 'avenida' });

const RED_LEJOS = [
  { pts: [[-40, 640], [120, 560], [240, 430], [400, 300]], autopista: true },   // Au. 25 de Mayo
  { pts: [[60, -40], [60, H + 40]] },                                            // Av. Saenz
  { pts: [[-40, 244], [400, 244]] }                                              // Av. Amancio Alcorta
];

const FERROCARRIL_LEJOS = [[[-40, 740], [400, 480]]];
const AGUA_LEJOS = [[[320, -40], [400, -40], [400, 260], [340, 140]]];
const PARQUES_LEJOS = [
  [[164, 300], [242, 300], [242, 378], [164, 378]],
  [[112, 118], [138, 118], [138, 170], [112, 170]],
  [[268, 560], [320, 560], [320, 612], [268, 612]]
];
const MANZANAS_LEJOS = [
  { pts: [[190, 400], [294, 400], [294, 508], [190, 508]], tono: 'predio' },
  { pts: [[-40, 300], [60, 300], [60, 430], [-40, 430]], tono: 'b' }
];

const ACCESO_INICIO = [[112, 560], [112, 508], [60, 508]];
const POR_LA_RED = [[60, 508], [60, 244], [268, 244]];
const ACCESO_FIN = [[268, 244], [268, 140], [320, 140]];
const RUTA_LEJOS = [...ACCESO_INICIO, ...POR_LA_RED.slice(1), ...ACCESO_FIN.slice(1)];
const RUTA_ALT = [[112, 560], [112, 508], [190, 508], [240, 430], [320, 350], [320, 140]];

const ROTULOS_LEJOS = [
  { x: 220, y: 60, texto: 'Boedo', tipo: 'barrio' },
  { x: 120, y: 175, texto: 'Parque\nPatricios', tipo: 'barrio' },
  { x: 330, y: 440, texto: 'Barracas', tipo: 'barrio' },
  { x: 120, y: 420, texto: 'Pompeya', tipo: 'barrio' },
  { x: 203, y: 342, texto: 'Parque Roca', tipo: 'parque' },
  { x: 242, y: 452, texto: 'Mercado\nde Flores', tipo: 'poi' },
  { x: 215, y: 240, texto: 'Av. Amancio Alcorta', tipo: 'calle' },
  { x: 56, y: 360, texto: 'Av. Sáenz', tipo: 'calle', rot: -90 },
  { x: 300, y: 545, texto: 'Ferrocarril Belgrano Sur', tipo: 'calle', rot: -31 }
];

const MAPA_LEJOS = (extra = {}) => mapa({
  zoom: 'lejos', vias: VIAS_LEJOS, red: RED_LEJOS, ferrocarriles: FERROCARRIL_LEJOS, aguas: AGUA_LEJOS,
  parques: PARQUES_LEJOS, manzanas: MANZANAS_LEJOS, rotulos: ROTULOS_LEJOS, ...extra
});

/* --- 1 · Reposo ----------------------------------------------------------- */

/**
 * La hoja del reposo, medida en waze-03: 150 dp, pildora de 50 con la lupa y
 * el texto en 16 sp gris, tres atajos de 45 con borde fino, rotulo 17 sp.
 */
const hojaReposo = () => `
<div class="hoja hoja-reposo">
  ${manija()}
  <div class="buscar">${ui('lupa', 24, '#8e959c', 2.2)}<span>¿Adónde vas?</span></div>
  <div class="atajos">
    <div class="atajo">${cal(CAL.casa, 22)}<span>Casa</span></div>
    <div class="atajo">${cal(CAL.deposito, 22)}<span>Depósito</span></div>
    <div class="atajo atajo-nuevo">${ui('mas', 18, CYAN_TEXTO, 2.8)}<span>Nuevo</span></div>
  </div>
</div>`;

tablero('reposo', 'Reposo', `
  Calcado de waze-03: manzanas grandes, <b>calles de 10 dp sin borde</b> en #40546c sobre tierra #272d39,
  flechas de mano celestes, semáforos blancos en los cruces, nombres de calle en 12 sp claros a lo largo de
  la calle, barrios en 17 sp gris, el parque en verde con su nombre en verde, un predio más claro con su
  nombre en celeste. La hoja de 150 dp con la píldora de 50 y los atajos de 45. Lo nuestro: <b>la Red es la
  vía más clara y más ancha</b> —el lugar que en Waze ocupa la autopista—, con el nombre en mayúsculas;
  las chapas blancas de datos fijos, como las cámaras de Waze; los pines de lugares con el anillo que
  dice de dónde sale el dato; el S.O.S.; el zócalo en lugar del menú cuadrado.`, `
  ${MAPA_CERCA()}
  <div class="arriba"><div class="sos">SOS</div></div>
  <div class="costado">
    ${botonRedondo('capas', 'negro', 'Capas')}
    ${botonRedondo('ubicacion', 'negro', 'Mi ubicación')}
  </div>
  ${hojaReposo()}
  ${zocalo('mapa')}
`);

/* --- 2 · Buscar ------------------------------------------------------------ */

tablero('buscar', 'Buscar', `
  Medido en waze-05: píldora de 52 con la flecha de volver y el texto en 16 sp; <b>chips de categorías</b> de
  82 × 65, radio 12, ícono de 20 y rótulo en 14 sp; filas de 65 con ícono de 30, <b>título en 18 sp
  negrita</b> y subtítulo en 14 sp celeste; secciones en 14 sp gris; separadores de un píxel. "Más opciones"
  trae lo que Waze no tiene: el reparto y fijar un punto. Sin micrófono.`, `
  <div class="hoja-llena">
    <div class="buscar buscar-activa">${ui('atras', 22, '#8e959c', 2.2)}<span class="escribiendo">¿Adónde vas?</span></div>
    <div class="chips-cat">
      ${CATEGORIAS.map((c) => `<div class="chip-cat">${cal(CAL[c.id], 20)}<span>${c.plural}</span></div>`).join('')}
    </div>
    ${filaAcceso('casa', 'Casa', 'Establecer una vez e ir')}
    ${filaAcceso('deposito', 'Depósito', 'Establecer una vez e ir')}
    <p class="seccion">Recientes</p>
    ${filaUi('reloj', 'Puerto de Buenos Aires', 'Retiro · Ciudad Autónoma de Buenos Aires')}
    ${filaUi('reloj', 'Mercado Central', 'Tapiales · La Matanza')}
    <p class="seccion">Más opciones</p>
    ${filaUi('paradas', 'Modo reparto', 'Hasta 10 paradas. El orden lo resolvemos nosotros')}
    ${filaUi('mano', 'Fijar en el mapa', 'Mantené apretado un punto')}
  </div>
`);

/* --- 3 · Elegir ruta ------------------------------------------------------- */

const filaRuta = ({ min, km, por, estado, chips, elegida = false }) => `
<div class="ruta${elegida ? ' is-elegida' : ''}">
  <div class="ruta-cabeza"><b>${min}</b><span>${km}</span></div>
  <div class="ruta-por">${por}</div>
  <div class="ruta-estado">${estado}</div>
  <div class="ruta-chips">${chips}</div>
</div>`;

const RUTAS = [
  { min: '39 min', km: '32 km', por: 'Por Au. Ricchieri; Au. 25 de Mayo', estado: 'Mejor ruta, 85% por la Red',
    chips: chip('#4f6d8e', '2 radares') + chip('#8b949e', 'Gálibo 4,50 · pasás'), elegida: true },
  { min: '36 min', km: '29 km', por: 'Por Av. Gral. Paz; Av. Lugones', estado: 'Sale de la Red 9,3 km',
    chips: chip(AMARILLO, 'Fuera de la Red') + chip('#4f6d8e', '3 radares') },
  { min: '44 min', km: '34 km', por: 'Por Au. Perito Moreno; Av. 9 de Julio', estado: 'Toda por la Red',
    chips: chip('#4f6d8e', '1 radar') + chip(ROJO, 'Zona marcada') }
];

tablero('rutas', 'Elegir ruta', `
  Medido en la captura de la lista: cabecera negra de 55 con el título en 18 sp; tira de mapa de 117 con
  la píldora de 42; filas de 145 donde <b>el tiempo es la cifra grande, 27 sp negrita</b> —celeste y con
  borde celeste de 4 y fondo negro en la elegida—, los km en 18 sp gris a la derecha, "Por…" en 18 sp,
  la línea de estado en 16 sp gris y los chips de 25 con punto de color y texto en 14 sp. Dos píldoras de
  48 abajo: gris con texto celeste, celeste con texto negro, en 16 sp negrita. Donde Waze dice "Tráfico
  habitual", nosotros cuánto va por la Red. "Evitar" pasa a ser el camión.`, `
  <div class="cabecera"><span>${ui('atras', 22, '#fff', 2.4)}</span><span class="cabecera-titulo">Mi ubicación <i>→</i> Puerto</span></div>
  <div class="tira-mapa">
    ${MAPA_LEJOS({ rutas: [{ pts: RUTA_LEJOS, color: RUTA, ancho: 6 }], rotulos: [] })}
    <div class="pildora-flotante">${ui('camion', 20, CYAN_TEXTO, 2.4)}<span>${CAMION} · 40 t</span>${ui('abajo', 18, CYAN_TEXTO, 2.6)}</div>
  </div>
  <div class="hoja-rutas">
    ${manija()}
    ${RUTAS.map(filaRuta).join('')}
    <div class="acciones">
      <div class="pildora chip">Detalles</div>
      <div class="pildora celeste">Arrancar</div>
    </div>
  </div>
`);

/* --- 4 · Detalles de la ruta ---------------------------------------------- */

tablero('detalles', 'Detalles de la ruta', `
  Lo que hoy es prosa en la hoja de ruta pasa a un toque de distancia, en filas como las de Waze. Acá sí
  aparece el mono —<b>sólo antes de arrancar</b>, como quedó en el prototipo del 14/09— diciendo lo único
  que importa de esta ruta. Las fuentes siguen ahí, al final, como pide la regla de la casa.`, `
  <div class="cabecera"><span>${ui('atras', 22, '#fff', 2.4)}</span><span class="cabecera-titulo">Detalles de la ruta</span></div>
  <div class="hoja-llena hoja-detalles">
    <div class="detalle-cifras"><div><b>39 min</b><span>llegás 20:06</span></div><div><b>32 km</b><span>85% por la Red</span></div></div>
    ${mono('Ojo: 20 tramos fuera de la Red', 'Son 9,3 km. La norma admite salir de la Red sólo para llegar al destino y volver por el camino más corto.')}
    <p class="seccion">En el camino</p>
    ${filaUi('paradas', 'Fuera de la Red · 9,3 km', 'Del Arado, De la Huerta, De la Pala y 17 más')}
    <div class="fila"><div class="fila-ico">${cal(CAL.radar, 30)}</div><div class="fila-texto"><b>2 radares de velocidad</b><span class="gris">Au. Ricchieri km 3 · Au. 25 de Mayo km 9</span></div></div>
    <div class="fila"><div class="fila-ico">${cal(CAL.galiboOk, 30)}</div><div class="fila-texto"><b>1 gálibo · 4,50 m</b><span class="gris">${CAMION} mide 4,20: pasás</span></div></div>
    <p class="seccion">Fuentes</p>
    <div class="fila"><div class="fila-texto"><b>Ley 2148, art. 9.10.1</b><span class="gris">Red de Tránsito Pesado · transcripción de OpenStreetMap</span></div></div>
    <div class="fila"><div class="fila-texto"><b>Radares: GCBA</b><span class="gris">129 cinemómetros oficiales, CC-BY</span></div></div>
    <div class="acciones acciones-fijas"><div class="pildora celeste">Arrancar</div></div>
  </div>
`);

/* --- 5 · Viaje -------------------------------------------------------------- */

/**
 * La hoja del viaje, medida en waze-06: 137 dp, manija de 45 x 4, la hora en
 * 25 sp negrita, "39 min • 32 km" en 20 sp gris claro, dos circulos de 45.
 */
const hojaViaje = () => `
<div class="hoja hoja-viaje">
  ${manija()}
  <div class="hoja-viaje-fila">
    ${botonRedondo('cerrar', 'chip chico', 'Salir')}
    <div class="eta"><b>20:06</b><span>39 min <i>•</i> 32 km</span></div>
    ${botonRedondo('rutas', 'chip chico', 'Vista general')}
  </div>
</div>`;

/** La pildora negra de la calle actual: 20 sp negrita, blanca, como en waze-06. */
const calleActual = (nombre) => `<div class="calle-actual">${nombre}</div>`;

/** El boton de reportar de waze-06: 63 dp, radio 16, ambar oscuro #4e411e. */
const botonAportar = () => `<div class="aportar">${cal(CAL.lugarMas, 36)}</div>`;

tablero('viaje', 'Viaje', `
  Calcado de waze-06, medida por medida: <b>banda negra de 127</b> con la flecha de 40 × 46 y trazo de 5, la
  distancia en 27 sp regular y la calle en 24 sp media celeste; dos círculos negros de 52 a la derecha
  (sonido y, lo nuestro, el S.O.S.); la ruta de 8 dp en #2ddcff; <b>el globo de 30 dp</b> en 18 sp negrita,
  clavado sobre Av. Sáenz con su punto blanco; la flecha blanca de la maniobra con sombra celeste; el
  <b>chevrón de 40 en #00b5d0</b> sobre su disco de 82; la píldora negra con la calle actual en 20 sp
  negrita —blanca, como en Waze—; el botón de 63 dp donde Waze pone reportar; la hoja de 137 con la hora
  en 25 sp. Calles de 10 dp, manzanas en dos tonos, un predio, el parque, un semáforo y un radar sobre la
  ruta con la chapa de cámara de Waze. Sin velocímetro.`, `
  ${MAPA_VIAJE()}
  ${banda()}
  <div class="costado costado-viaje">${botonRedondo('sonido', 'negro', 'Sonido')}<div class="redondo sos-viaje">SOS</div></div>
  ${calleActual('Av. Amancio Alcorta')}
  ${botonAportar()}
  ${hojaViaje()}
`);

/* --- 6 · Viaje con aviso ---------------------------------------------------- */

tablero('aviso', 'Viaje · aviso', `
  Un aviso de la ruta —paso a nivel, radar— aparece como Waze muestra sus alertas: una tarjeta #202125 entre
  el mapa y la hoja, con el pin del aviso, qué es en 18 sp negrita y a cuánto está en 14 sp gris. Se va sola
  y vibra con su patrón (AD-39). <b>Acá no hay aviso rojo, y no puede haberlo</b>: un gálibo por el que este
  camión no pasa queda excluido del cálculo antes de trazar la ruta. La chapa roja de la izquierda es eso:
  un bajo vía de 3,90 m en una calle que la ruta ya esquivó. También se ve el segundo globo, en dos líneas
  como "Av. de los Constituyentes" en waze-08.`, `
  ${MAPA_VIAJE({ rotulos: [...ROTULOS_VIAJE, { x: 40, y: 300, texto: 'Av. Vélez\nSarsfield', tipo: 'globo' }], encima: (P) => encimaViaje(P) + chapa(P, 230, 150, 'galibo', 26) + chapa(P, 40, 150, 'paso', 26) })}
  ${banda()}
  <div class="costado costado-viaje">${botonRedondo('sonido', 'negro', 'Sonido')}<div class="redondo sos-viaje">SOS</div></div>
  <div class="aviso">
    <div class="aviso-pin">${cal(CAL.paso, 28)}</div>
    <div><b>Paso a nivel en 150 m</b><span>Barrera automática · Bajá la velocidad</span></div>
    ${ui('cerrar', 22, '#8e959c', 2.4)}
  </div>
  ${hojaViaje()}
`);

/* --- 7 · Mapa movido ------------------------------------------------------- */

tablero('movido', 'Viaje · mapa movido', `
  Si el conductor arrastra el mapa, la cámara deja de seguir al camión y aparece la tarjeta de waze-08,
  medida: 62 dp de alto, radio 20, fondo #202125, círculo #e8e9ed de 36 con la cruceta, <b>"Volver a
  centrar"</b> en 20 sp y el tiempo con los km en 16 sp gris, y la píldora "Vista general" de 132 × 37 en
  #3c4043 con texto celeste de 16 sp. Hoy el mapa vuelve solo al camión con el próximo latido del GPS.`, `
  ${MAPA_VIAJE({ encima: (P) => encimaViaje(P, { sinChevron: true }) + chevron(P, 240, 560, 0) })}
  ${banda()}
  <div class="tarjeta-centrar">
    <div class="redondo blanco chico">${ui('centrar', 22, '#111', 2.4)}</div>
    <div class="tarjeta-centrar-texto"><b>Volver a centrar</b><span>39 min <i>•</i> 32 km</span></div>
    <div class="pildora chip">Vista general</div>
  </div>
`);

/* --- 8 · Vista general ------------------------------------------------------ */

const lineaTiempo = (marcas, tramos = [[0, 100, RUTA]]) => `
<div class="linea-tiempo">
  <span class="lt-play"></span>
  <div class="lt-barra">
    ${tramos.map(([a, b, color]) => `<i style="left:${a}%;width:${b - a}%;background:${color}"></i>`).join('')}
    ${marcas.map(([pos, icono]) => `<em style="left:${pos}%"><span class="lt-pin">${cal(CAL[icono], 15)}</span></em>`).join('')}
  </div>
</div>`;

const tarjetaRuta = ({ min, hora, km, por, accion, marcas, tramos }) => `
<div class="tarjeta-ruta">
  <div class="tarjeta-ruta-cabeza"><b>${min}</b><div class="pildora celeste chica">${flechaIr(16)}<span>${accion}</span></div></div>
  <div class="tarjeta-ruta-sub">${hora} <i>•</i> ${km}</div>
  <div class="tarjeta-ruta-por">${por}</div>
  ${lineaTiempo(marcas, tramos)}
</div>`;

tablero('general', 'Vista general', `
  Calcado de waze-02: el conmutador Mapa/Lista de 155 × 40 a 112 del borde, la banda compacta de 92, la
  trama fina de lejos (calles de 2,5, avenidas de 4), la autopista con carriles y centro punteado, el
  ferrocarril a rayas, el río, los parques y los barrios en 17 sp gris; la ruta entera con la bandera a
  cuadros y la alternativa en gris con su globito negro. La tarjeta de la captura: radio 16, tiempo en
  27 sp negrita, "Reanudar" celeste de 134 × 44 con la flecha, hora y km en 19 sp, "Por…" en 18 sp, y <b>la
  línea de tiempo</b> con los avisos donde caen. La nuestra lleva el lenguaje del tráfico: celeste por la
  Red, amarillo fuera. El rojo no aparece sobre ninguna ruta.`, `
  ${MAPA_LEJOS({
    rutas: [{ pts: POR_LA_RED, color: RUTA, ancho: 7 }, { pts: ACCESO_INICIO, color: AMARILLO, ancho: 7 }, { pts: ACCESO_FIN, color: AMARILLO, ancho: 7 }, { pts: RUTA_ALT, color: '#c9d2dc', ancho: 5, canto: 'rgba(0,0,0,.35)' }],
    encima: (P) => [
      escudo(P, 180, 495, 'AU 1'),
      banderaDestino(P, 320, 140),
      chapa(P, 60, 420, 'radar', 20),
      chapa(P, 140, 244, 'radar', 20),
      chevron(P, 112, 540, 0),
      `<g transform="translate(${P(170, 506).map(f1).join(' ')})"><rect x="10" y="-17" width="160" height="34" rx="8" fill="#1a1c20"/><path d="M10 -2 l-8 6 l8 4z" fill="#1a1c20"/><text x="90" y="4" text-anchor="middle" class="rot-tooltip" fill="#fff">+5 min · toda por la Red</text></g>`
    ].join('')
  })}
  ${banda({ compacta: true })}
  <div class="conmutador"><span class="is-on">Mapa</span><span>Lista</span></div>
  <div class="tarjetas-general">
    ${tarjetaRuta({ min: '39 min', hora: '20:06', km: '32 km', por: 'Por Au. Ricchieri; Au. 25 de Mayo', accion: 'Reanudar', marcas: [[28, 'radar'], [58, 'galiboOk'], [80, 'radar']], tramos: [[0, 62, RUTA], [62, 90, AMARILLO], [90, 100, RUTA]] })}
  </div>
`);

/* --- 9 · Vista general · lista --------------------------------------------- */

tablero('lista', 'Vista general · lista', `
  Como waze-01: las mismas tarjetas apiladas sobre el mapa atenuado, con "Ir" en las alternativas —
  <b>cambiar de ruta sin cerrar el viaje</b>, posible porque el viaje guarda origen, destino y paradas, no la
  ruta—. La segunda lleva un tramo amarillo en su línea de tiempo: sale de la Red 9,3 km.`, `
  ${MAPA_LEJOS({ rutas: [{ pts: RUTA_LEJOS, color: RUTA, ancho: 6 }], rotulos: [], atenuado: true })}
  ${banda({ compacta: true })}
  <div class="conmutador"><span>Mapa</span><span class="is-on">Lista</span></div>
  <div class="tarjetas-general tarjetas-lista">
    ${tarjetaRuta({ min: '39 min', hora: '20:06', km: '32 km', por: 'Por Au. Ricchieri; Au. 25 de Mayo', accion: 'Reanudar', marcas: [[28, 'radar'], [58, 'galiboOk'], [80, 'radar']], tramos: [[0, 62, RUTA], [62, 90, AMARILLO], [90, 100, RUTA]] })}
    ${tarjetaRuta({ min: '36 min', hora: '20:03', km: '29 km', por: 'Por Av. Gral. Paz; Av. Lugones', accion: 'Ir', marcas: [[20, 'radar'], [45, 'radar'], [72, 'radar']], tramos: [[0, 30, RUTA], [30, 44, AMARILLO], [44, 100, RUTA]] })}
    ${tarjetaRuta({ min: '44 min', hora: '20:11', km: '34 km', por: 'Por Au. Perito Moreno; Av. 9 de Julio', accion: 'Ir', marcas: [[35, 'radar'], [66, 'zona']], tramos: [[0, 100, RUTA]] })}
  </div>
`);

/* --- 10 · Capas ------------------------------------------------------------- */

const cuadro = (icono, nombre, activo = true, nota = '') => `
<div class="cuadro${activo ? ' is-on' : ''}">
  <div class="cuadro-ico">${cal(CAL[icono], 32)}</div>
  <span>${nombre}</span>${nota ? `<small>${nota}</small>` : ''}
</div>`;

tablero('capas', 'Capas', `
  De Maps se toma <b>sólo esta hoja</b>: la grilla de cuadros de 52 con radio 12 y rótulo en 12,5 sp, el
  activo con borde de 3 y rótulo del color. En Maps son verdes y claros; acá, celestes sobre la hoja
  #202125 de Waze. Sin tipos de mapa. Dos secciones: los datos para el camión —que hoy viven en dos
  botones flotantes— y las categorías de lugares. Y el interruptor que ya existe en la API: <b>sólo aptos
  para este camión</b>, con cuántos oculta.`, `
  ${MAPA_CERCA({ atenuado: true })}
  <div class="hoja hoja-capas">
    <div class="hoja-titulo"><b>Capas</b>${ui('cerrar', 24, '#fff', 2.4)}</div>
    <p class="seccion">Para tu camión</p>
    <div class="cuadros">
      ${cuadro('red', 'Red de Tránsito Pesado')}
      ${cuadro('galibo', 'Gálibos')}
      ${cuadro('paso', 'Pasos a nivel', true, 'sólo en viaje')}
      ${cuadro('radar', 'Radares')}
      ${cuadro('zona', 'Zonas peligrosas', false, 'comunidad')}
    </div>
    <p class="seccion">Lugares</p>
    <div class="cuadros">
      ${CATEGORIAS.map((c) => cuadro(c.id, c.plural, c.id !== 'playa')).join('')}
    </div>
    <div class="interruptor"><div><b>Sólo aptos para ${CAMION}</b><span>Oculta 7 lugares sin dato</span></div><i class="is-on"></i></div>
  </div>
`);

/* --- 11 · Lugar verificado ------------------------------------------------- */

const fichaCabeza = (icono, nombre, sub) => `
<div class="ficha-cabeza">
  <div class="ficha-ico">${cal(CAL[icono], 32)}</div>
  <div class="ficha-titulo"><b>${nombre}</b><span>${sub}</span></div>
  ${ui('cerrar', 22, '#8e959c', 2.4)}
</div>`;

const voto = (propio = null) => `
<div class="voto">
  <span>¿Es apto para ${CAMION}?</span>
  <div class="voto-botones">
    <div class="pildora ${propio === 'si' ? 'celeste' : 'chip'} chica">${propio === 'si' ? ui('check', 16, '#0a1f2a', 3) : ''}<span>Apto</span></div>
    <div class="pildora ${propio === 'no' ? 'celeste' : 'chip'} chica"><span>No apto</span></div>
  </div>
</div>`;

tablero('lugar', 'Lugar verificado', `
  La ficha de un lugar, con la tarjeta de Waze: radio 16, calcomanía en caja de 44, nombre en 22 sp
  negrita, categoría y distancia en 14 sp gris, y "Ir" celeste con la flecha. Lo que no tiene Waze es
  <b>lo verificado separado de lo comunitario</b>: arriba la evidencia con su fecha —en verde porque es un
  sí—, abajo cuántos camioneros <b>con un camión como el tuyo</b> lo recomiendan, el total, y tu voto. Los
  votos nunca tocan lo verificado.`, `
  ${MAPA_CERCA({ encima: (P) => encimaCerca(P) + pin(P, 260, 295, 'gomeria', 'verificado', 42) })}
  <div class="hoja hoja-ficha">
    ${manija()}
    ${fichaCabeza('gomeria', 'Gomería Los Amigos', 'Gomería · a 1,2 km · Av. Vélez Sarsfield 1310')}
    <div class="bloque bloque-ok">
      <div class="bloque-titulo"><i>${ui('check', 14, '#0d1418', 3.2)}</i><b>Verificado · recibe semis y acoplados</b></div>
      <span>Ficha pública del comercio, 15/09/2026</span>
    </div>
    <div class="bloque bloque-comunidad">
      <div class="bloque-titulo">${cal(CAL.comunidad, 20)}<b>3 camioneros con un camión como el tuyo lo recomiendan</b></div>
      <span>5 en total · nadie lo desaconseja</span>
    </div>
    ${voto('si')}
    <div class="acciones"><div class="pildora chip">${ui('telefono', 18, CYAN_TEXTO, 2.4)}<span>Llamar</span></div><div class="pildora celeste">${flechaIr(16)}<span>Ir</span></div></div>
  </div>
`);

/* --- 12 · Lugar de la comunidad --------------------------------------------- */

tablero('lugar-comunidad', 'Lugar de la comunidad', `
  El mismo molde con un lugar que aportó alguien: <b>anillo celeste</b> en el pin y el contador de votos como
  el de los reportes agrupados de Waze, la etiqueta "Aportado por la comunidad" con la fecha y el alias,
  ningún bloque verde porque no hay evidencia, y los votos que le van sumando confianza. El toast del voto
  es lo único que dice EXP en el mapa: chico, gris, se va solo.`, `
  ${MAPA_CERCA({ encima: (P) => encimaCerca(P) + pin(P, 340, 560, 'taller', 'comunidad', 42, '3') })}
  <div class="toast">Voto guardado <i>•</i> +2 EXP</div>
  <div class="hoja hoja-ficha">
    ${manija()}
    ${fichaCabeza('taller', 'Taller El Tano', 'Taller · a 650 m · Traful 3400')}
    <div class="etiqueta-comunidad">${cal(CAL.comunidad, 16)}<span>Aportado por la comunidad · @lauta · 12/09/2026</span></div>
    <div class="bloque bloque-comunidad">
      <div class="bloque-titulo">${cal(CAL.comunidad, 20)}<b>1 camionero con un camión como el tuyo lo recomienda</b></div>
      <span>3 en total · sin verificar: nadie confirmó el dato todavía</span>
    </div>
    ${voto(null)}
    <div class="acciones"><div class="pildora chip">${ui('telefono', 18, CYAN_TEXTO, 2.4)}<span>Llamar</span></div><div class="pildora celeste">${flechaIr(16)}<span>Ir</span></div></div>
  </div>
`);

/* --- 13 · Aportar ------------------------------------------------------------ */

tablero('aportar', 'Aportar · ¿Qué hay acá?', `
  La hoja "¿Qué ves?" de waze-07, medida: título en 21 sp negrita, cruz a la derecha, y la grilla de
  <b>círculos de 75 dp</b> en #3c4043 con calcomanía de 40 y rótulo en 14 sp. Con lo que existe hoy: las seis
  categorías de lugar. Los reportes de la Fase 5 entran a esta misma grilla cuando se decidan. Se abre
  desde el botón amarillo del viaje y desde el mapa en reposo.`, `
  ${MAPA_VIAJE({ atenuado: true })}
  ${banda({ compacta: true })}
  <div class="hoja hoja-aportar">
    ${manija()}
    <div class="hoja-titulo"><b>¿Qué hay acá?</b>${ui('cerrar', 24, '#fff', 2.4)}</div>
    <div class="redondos">
      ${CATEGORIAS.map((c) => `<div class="redondo-grande"><div>${cal(CAL[c.id], 40)}</div><span>${c.nombre}</span></div>`).join('')}
    </div>
    <p class="pie">Se guarda como aporte de la comunidad, con tu voto. <b>+10 EXP</b></p>
  </div>
`);

/* --- 14 · Marcar el lugar --------------------------------------------------- */

tablero('marcar', 'Aportar · marcar el lugar', `
  Elegida la categoría, el mapa vuelve al frente con <b>el pin fijo en el centro</b> —se mueve el mapa, no el
  pin, como en Maps— y una hoja corta: la categoría, el nombre y Guardar. Si ya hay uno igual a menos de
  25 m, la API contesta 409 y la hoja ofrece votar el existente en vez de duplicarlo.`, `
  ${MAPA_CERCA({ encima: (P) => encimaCerca(P) + `<g transform="translate(${P(163, 300).map(f1).join(' ')})"><ellipse cy="4" rx="8" ry="4" fill="rgba(0,0,0,.45)"/><g transform="translate(-22 -48)">${cal(CAL.lugarMas, 44)}</g></g>` })}
  <div class="cabecera"><span>${ui('atras', 22, '#fff', 2.4)}</span><span class="cabecera-titulo">Nuevo lugar</span></div>
  <div class="hoja hoja-marcar">
    ${manija()}
    <div class="chip-cat is-on">${cal(CAL.gomeria, 20)}<span>Gomería</span>${ui('abajo', 16, '#8e959c')}</div>
    <div class="campo"><span>Nombre</span><b>Gomería El Tano</b></div>
    <p class="pie">Movés el mapa hasta que el pin quede sobre la entrada.</p>
    <div class="acciones"><div class="pildora celeste">Guardar</div></div>
  </div>
`);

/* --- 15 · Dia ---------------------------------------------------------------- */

tablero('dia', 'Viaje · día', `
  <b>Derivado, no medido</b>: no hay captura de Waze de día. Banda blanca con tinta negra y la calle en el
  celeste oscuro de nuestro modo día; mapa claro con calles blancas y filete gris, la Red en azul acero
  claro, autopista amarilla pálida con su punteado, parques verde claro. A validar con una captura.`, `
  ${MAPA_VIAJE({ tema: DIA, rutas: [{ pts: RUTA_VIAJE, color: '#1fb0ec', canto: '#ffffff' }] })}
  ${banda()}
  <div class="costado costado-viaje">${botonRedondo('sonido', 'blanco', 'Sonido')}<div class="redondo sos-viaje">SOS</div></div>
  ${calleActual('Av. Amancio Alcorta')}
  ${botonAportar()}
  ${hojaViaje()}
`, { tema: 'dia' });

/* --- 16 · Reanudar ------------------------------------------------------------ */

tablero('reanudar', 'Reanudar', `
  Al abrir la app con un viaje abierto en el servidor, en vez de meterte en la navegación de golpe, la
  tarjeta de waze-03, medida: fondo #202125, radio 16, pin de 30, pregunta en 22 sp negrita, la "i" arriba a
  la derecha, y dos píldoras de 42: "No" en #3c4043 con texto celeste, "Continuar viaje" celeste, en 15 sp
  negrita. "No" abre las tres salidas de siempre —llegué, abandono, sigo—, porque cerrar un viaje decide si
  suma o no.`, `
  ${MAPA_CERCA()}
  <div class="arriba"><div class="sos">SOS</div></div>
  <div class="tarjeta-pregunta">
    <div class="tarjeta-pregunta-cabeza">${cal(CAL.lugar, 30)}<b>¿Seguís yendo a Puerto de Bs. As.?</b>${ui('info', 22, '#d7dee5', 2)}</div>
    <div class="acciones"><div class="pildora chip">No</div><div class="pildora celeste">Continuar viaje</div></div>
  </div>
  ${hojaReposo()}
  ${zocalo('mapa')}
`);

/* ===========================================================================
   La portada: el sistema en una hoja
=========================================================================== */

const muestra = (color, nombre, valor) => `<div class="muestra"><i style="background:${color}"></i><b>${nombre}</b><span>${valor}</span></div>`;
const medida = (que, cuanto) => `<div class="medida"><b>${cuanto}</b><span>${que}</span></div>`;

const portada = `
<section class="portada">
  <p class="ojo">Prototipo · GPS · 16/09/2026 · vuelta 5, medida sobre las capturas</p>
  <h1>El mapa, con la piel de Waze</h1>
  <p class="bajada">Dieciséis tableros <b>medidos píxel por píxel</b> sobre las capturas de Waze en <code>docs/referencias/waze/</code>
  (Android, 720 × 1600): un dp de Waze es un píxel de estos teléfonos y cada color está sampleado de la captura.
  Adaptados a lo nuestro: la Red de Tránsito Pesado, los gálibos, los lugares para camiones y el camión elegido.
  De Google Maps se toma sólo la hoja de capas. Se copian patrones y medidas; nunca la marca, los Wazers ni sus dibujos.</p>

  <div class="sistema">
    <div class="bloque-sistema">
      <p class="seccion-portada">Medidas · contadas en las capturas</p>
      <div class="medidas">
        ${medida('banda de instrucción, con barra de estado (waze-06)', '127 dp')}
        ${medida('flecha de la maniobra · trazo 5', '40 × 46')}
        ${medida('distancia · Roboto regular', '27 sp')}
        ${medida('calle que viene · media, celeste', '24 sp')}
        ${medida('banda compacta · una línea de 20 sp (waze-01)', '92 dp')}
        ${medida('ruta · canto claro apenas visible', '8 dp')}
        ${medida('globo de calle · 18 sp negrita · dos líneas 48', '30 dp')}
        ${medida('chevrón · contorno 3 · disco de 82', '40 × 39')}
        ${medida('botones flotantes negros (waze-06)', '52 dp')}
        ${medida('hoja del viaje · hora en 25 sp', '137 dp')}
        ${medida('píldora de la calle actual · 20 sp negrita', '34 dp')}
        ${medida('botón de reportar · radio 16', '63 dp')}
        ${medida('tiempo en la lista de rutas · negrita (waze-01)', '27 sp')}
        ${medida('píldoras de acción · 16 sp negrita', '48 dp')}
        ${medida('pin de reporte · anillo 3 (waze-08)', '32 dp')}
        ${medida('círculos de "¿Qué ves?" (waze-07)', '75 dp')}
        ${medida('calle de cerca (waze-03) · de lejos (waze-08)', '10 · 2,5 dp')}
        ${medida('nombre de calle · barrio', '12 · 17 sp')}
      </div>
    </div>
    <div class="bloque-sistema">
      <p class="seccion-portada">Noche · sampleada de las capturas</p>
      <div class="muestras">
        ${muestra('#000000', 'Banda', '#000')}
        ${muestra('#202125', 'Hoja y tarjeta', '#202125')}
        ${muestra('#3c4043', 'Píldora y chip', '#3c4043')}
        ${muestra('#e8e9ed', 'Círculo claro', '#e8e9ed')}
        ${muestra(RUTA, 'Ruta', RUTA)}
        ${muestra(CYAN, 'Acción', CYAN)}
        ${muestra(CYAN_TEXTO, 'Texto celeste', CYAN_TEXTO)}
        ${muestra(CHEVRON, 'Chevrón', CHEVRON)}
        ${muestra(GLOBO, 'Globo', GLOBO)}
        ${muestra('#4e411e', 'Reportar', '#4e411e')}
        ${muestra(NOCHE.tierra, 'Tierra', NOCHE.tierra)}
        ${muestra(NOCHE.manzanaA, 'Manzana', NOCHE.manzanaA)}
        ${muestra(NOCHE.manzanaB, 'Manzana azul', NOCHE.manzanaB)}
        ${muestra(NOCHE.predio, 'Predio', NOCHE.predio)}
        ${muestra(NOCHE.calle, 'Calle', NOCHE.calle)}
        ${muestra(NOCHE.red, 'La Red', NOCHE.red)}
        ${muestra(NOCHE.autopista, 'Autopista', NOCHE.autopista)}
        ${muestra(NOCHE.parque, 'Parque', NOCHE.parque)}
        ${muestra(NOCHE.agua, 'Agua', NOCHE.agua)}
        ${muestra(NOCHE.rotulo, 'Rótulo de calle', NOCHE.rotulo)}
        ${muestra(NOCHE.barrio, 'Barrio', NOCHE.barrio)}
        ${muestra(NOCHE.poi, 'Lugar', NOCHE.poi)}
        ${muestra(NOCHE.parqueRotulo, 'Rótulo verde', NOCHE.parqueRotulo)}
        ${muestra(NOCHE.flecha, 'Flecha de mano', NOCHE.flecha)}
      </div>
    </div>
    <div class="bloque-sistema">
      <p class="seccion-portada">El lenguaje del tráfico, para lo nuestro</p>
      <div class="leyenda">
        <div><i style="background:${RUTA}"></i><b>Celeste</b><span>por la Red de Tránsito Pesado</span></div>
        <div><i style="background:${AMARILLO}"></i><b>Amarillo</b><span>fuera de la Red: la norma lo admite para llegar</span></div>
        <div><i style="background:${ROJO}"></i><b>Rojo</b><span>nunca sobre una ruta. Sólo en una chapa del mapa: el gálibo por el que este camión no pasa, que la ruta ya esquivó</span></div>
        <div><i style="background:${NOCHE.red}"></i><b>La Red</b><span>la vía más clara y más ancha del mapa, el lugar que en Waze ocupa la autopista; la autopista lleva carriles y centro punteado</span></div>
        <div><i class="rayas"></i><b>Rayas rojas</b><span>reservado para los cortes de la Fase 5</span></div>
      </div>
      <p class="nota-sistema">No hay dato de tráfico y no se inventa: los colores dicen restricciones, y se dice con su nombre. Lo que el camión no puede transitar no entra al cálculo de la ruta: por eso ninguna ruta lleva rojo.</p>
    </div>
    <div class="bloque-sistema">
      <p class="seccion-portada">Tipografía · Roboto, la del sistema, medida en las capturas</p>
      <div class="escala">
        <div><b style="font-size:27px;font-weight:400">200 m</b><span>distancia · 27 / 400</span></div>
        <div><b style="font-size:24px;font-weight:500;color:${CYAN_TEXTO}">Av. Sáenz</b><span>calle que viene · 24 / 500</span></div>
        <div><b style="font-size:27px;font-weight:700;color:${CYAN_TEXTO}">39 min</b><span>tiempo de ruta · 27 / 700</span></div>
        <div><b style="font-size:25px;font-weight:700">20:06</b><span>llegada · 25 / 700</span></div>
        <div><b style="font-size:22px;font-weight:700">¿Seguís yendo a Puerto?</b><span>pregunta · 22 / 700</span></div>
        <div><b style="font-size:20px;font-weight:700;background:#000;padding:4px 14px;border-radius:17px">Av. Amancio Alcorta</b><span>calle actual · 20 / 700</span></div>
        <div><b style="font-size:20px;font-weight:400">Volver a centrar</b><span>tarjeta · 20 / 400</span></div>
        <div><b style="font-size:18px;font-weight:700;color:#fff;background:${GLOBO};padding:3px 12px;border-radius:7px">Av. Sáenz</b><span>globo · 18 / 700</span></div>
        <div><b style="font-size:18px;font-weight:700">Casa</b><span>título de fila · 18 / 700</span></div>
        <div><b style="font-size:18px;font-weight:400">Por Au. Ricchieri; Au. 25 de Mayo</b><span>cuerpo · 18 / 400</span></div>
        <div><b style="font-size:16px;font-weight:500;color:${CYAN_TEXTO}">Vista general</b><span>píldora · 16 / 500</span></div>
        <div><b style="font-size:14px;font-weight:500">2 radares</b><span>chip · 14 / 500</span></div>
        <div><b style="font-size:12px;font-weight:500;color:${NOCHE.rotulo}">Zavaleta</b><span>calle en el mapa · 12 / 500</span></div>
      </div>
    </div>
    <div class="bloque-sistema">
      <p class="seccion-portada">Dos formas, dos orígenes</p>
      <div class="formas">
        <div><svg viewBox="0 0 60 60" width="60" height="60">${chapa((x, y) => [x, y], 26, 28, 'radar', 26)}</svg><b>Chapa cuadrada</b><span>datos fijos: gálibos, pasos a nivel, radares. Como las cámaras de Waze, con su semáforo chico</span></div>
        <div><svg viewBox="0 0 60 60" width="60" height="60">${pin((x, y) => [x, y], 30, 26, 'estacion', 'verificado', 34)}</svg><b>Pin, anillo blanco</b><span>lugar verificado</span></div>
        <div><svg viewBox="0 0 60 60" width="60" height="60">${pin((x, y) => [x, y], 30, 26, 'taller', 'comunidad', 34, '3')}</svg><b>Pin, anillo celeste</b><span>lugar de la comunidad, con sus votos</span></div>
        <div><svg viewBox="0 0 60 60" width="60" height="60">${pin((x, y) => [x, y], 30, 26, 'comer', 'sin', 34)}</svg><b>Pin apagado</b><span>sin confirmar</span></div>
      </div>
    </div>
    <div class="bloque-sistema">
      <p class="seccion-portada">Calcomanías · relleno saturado, contorno blanco</p>
      <div class="calcos">
        ${['gomeria', 'taller', 'estacion', 'comer', 'auxilio', 'playa', 'red', 'galibo', 'galiboOk', 'paso', 'radar', 'zona', 'casa', 'deposito', 'lugar', 'lugarMas', 'aviso', 'comunidad', 'bandera'].map((n) => `<div>${cal(CAL[n], 40)}<span>${n}</span></div>`).join('')}
      </div>
    </div>
    <div class="bloque-sistema reglas">
      <p class="seccion-portada">Seis reglas</p>
      <ol>
        <li><b>Una cifra manda por pantalla.</b> La distancia a la maniobra en viaje, el tiempo al elegir ruta, la hora de llegada en la hoja.</li>
        <li><b>El celeste es acción y ruta.</b> Nada más es celeste. El amarillo es salir de la Red; el rojo nunca está sobre una ruta, porque lo que este camión no puede transitar no entra al cálculo.</li>
        <li><b>La Red se lee sola.</b> La vía más clara y más ancha del mapa, con el nombre en mayúsculas; lo que no es Red, más fino y más oscuro. Qué calles la forman, cómo se conectan y cuáles quedan afuera, sin leyenda.</li>
        <li><b>Lo de la comunidad no se ve igual que lo verificado.</b> Anillo celeste, contador de votos, etiqueta con alias y fecha, y nunca el bloque verde.</li>
        <li><b>Nada del registro expresivo en movimiento.</b> Ni cromo, ni naranja, ni el mono. El mono habla una vez, antes de arrancar.</li>
        <li><b>Donde falta el dato, se dice.</b> Sin tráfico, sin límite de velocidad, sin "zona segura": los colores cuentan restricciones y se dice con su nombre.</li>
      </ol>
    </div>
  </div>
</section>`;

/* ===========================================================================
   Salida: un tablero .dc.html por pantalla, canvas.json con la disposicion y
   las notas, y una vista previa index.html para mirar todo en un navegador.
=========================================================================== */

const css = readFileSync(join(aqui, 'gps.css'), 'utf8');
const FUENTES = "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Nunito:wght@400;600;700;800&display=swap');";

/** Un tablero del lienzo: el formato de Design Components, con el estilo adentro. */
const artboard = (cuerpo, ancho, extra = '') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>${FUENTES}${css}
  body { padding: 0; background: transparent; }
  .telefono { border-radius: 0; box-shadow: none; }
  ${extra}</style>
</helmet>
${cuerpo}
</x-dc>
</body>
</html>
`;

/* Nombres de archivo: la pantalla del viaje es el tablero de entrada. */
const ARCHIVO = {
  viaje: 'Main', reposo: 'Reposo', aviso: 'Aviso', movido: 'Movido', general: 'General', lista: 'Lista',
  rutas: 'Rutas', detalles: 'Detalles', buscar: 'Buscar', capas: 'Capas', lugar: 'Lugar',
  'lugar-comunidad': 'LugarComunidad', aportar: 'Aportar', marcar: 'Marcar', dia: 'Dia', reanudar: 'Reanudar'
};

const sinHtml = (texto) => texto.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

for (const t of tableros) {
  const nombre = ARCHIVO[t.id];
  if (!nombre) throw new Error(`tablero sin archivo: ${t.id}`);
  writeFileSync(join(aqui, `${nombre}.dc.html`), artboard(`<div class="telefono ${t.tema}">${t.cuerpo}</div>`));
}

writeFileSync(join(aqui, 'Sistema.dc.html'), artboard(`<div style="width:1160px;min-height:1700px;padding:32px;box-sizing:border-box;background:#0c1014;color:#e6edf3;font-family:'Nunito',system-ui,sans-serif">${portada}</div>`, 1160));

/* La disposicion: el sistema a la izquierda; las pantallas en cuatro filas de
   cuatro, en el orden en que las ve el camionero, cada una con su nota debajo. */
const ORDEN = [
  ['viaje', 'reposo', 'aviso', 'movido'],
  ['general', 'lista', 'rutas', 'detalles'],
  ['buscar', 'capas', 'lugar', 'lugar-comunidad'],
  ['aportar', 'marcar', 'dia', 'reanudar']
];
const X0 = 1280, PASO_X = 480, PASO_Y = 1100;

const canvas = {
  artboards: [{ file: 'Sistema.dc.html', x: 0, y: 0, w: 1160, h: 1700, title: 'El sistema, medido' }],
  annotations: [],
  launch: { view: 'canvas' }
};

ORDEN.forEach((fila, f) => fila.forEach((id, c) => {
  const t = tableros.find((t) => t.id === id);
  const x = X0 + c * PASO_X;
  const y = f * PASO_Y;
  canvas.artboards.push({ file: `${ARCHIVO[id]}.dc.html`, x, y, w: 360, h: 800, title: t.titulo });
  canvas.annotations.push({ id: `nota-${ARCHIVO[id].toLowerCase()}`, x, y: y + 830, w: 360, text: sinHtml(t.nota) });
}));

writeFileSync(join(aqui, 'canvas.json'), JSON.stringify(canvas, null, 2));

/* La vista previa, para mirar todo junto en un navegador comun. */
const previa = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>GPS de camiones · vista previa</title>
<style>${FUENTES}${css}</style></head><body>
<main>${portada}<section class="tableros">
${tableros.map((t, i) => `<article class="tablero" id="${t.id}"><header><span class="numero">${String(i + 1).padStart(2, '0')}</span><h2>${t.titulo}</h2></header><div class="telefono ${t.tema}">${t.cuerpo}</div><p class="nota">${t.nota}</p></article>`).join('')}
</section></main></body></html>`;
writeFileSync(join(aqui, 'index.html'), previa);

console.log(`${tableros.length + 1} tableros .dc.html, canvas.json e index.html (${(previa.length / 1024).toFixed(0)} KB)`);
