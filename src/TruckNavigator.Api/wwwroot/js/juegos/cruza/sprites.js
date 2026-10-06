/**
 * Los sprites de CRUZA, MONO y las ayudas de dibujo (spec §4.1).
 *
 * Portados del prototipo aprobado (docs/diseno/prototipo-cruza/sprites.js y el
 * principio de escena.js), pixel por pixel: no se redibujan. La fuente es la 5 x 7
 * de la Viborita, con los glifos que suma esta etapa. Nada de esto toca el
 * documento al importarse: los lienzos se crean al primer uso.
 */

import { FUENTE, anchoDeTexto } from '../viborita/dibujos.js';
import { ANCHO } from './reglas.js';

/** La unica fabrica de lienzos: sin suavizado, para que el pixel quede pixel. */
export function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').imageSmoothingEnabled = false;
  return cv;
}

export const CONTORNO = '#170c16';

export const mod = (a, b) => ((a % b) + b) % b;
export const lerp = (a, b, f) => a + (b - a) * f;
export function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
export function semilla(n) { let s = (n * 9301 + 49297) % 233280 + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function brillo(c, x0, y0, w, h, t, periodo = 3, color = 'rgba(255,255,255,.55)') {
  const fase = mod(t, periodo) / periodo, banda = fase * (w + h + 20) - 10;
  c.fillStyle = color;
  for (let y = 0; y < h; y++) { const x = Math.round(banda - y); for (let d = 0; d < 3; d++) { const xx = x + d; if (xx >= 0 && xx < w) c.fillRect(x0 + xx, y0 + y, 1, 1); } }
}
export function humo(c, xs, ys, dir, t, fase = 0, tono = '205,212,222') {
  for (let k = 0; k < 3; k++) {
    const a = mod(t * 0.9 + k / 3 + fase, 1);
    const r = 2 + Math.floor(a * 3), x = Math.round(xs - dir * a * 6), y = Math.round(ys - a * 16);
    c.fillStyle = `rgba(${tono},${(0.45 * (1 - a)).toFixed(2)})`;
    c.fillRect(x - r + 1, y - r, 2 * r - 1, 2 * r + 1); c.fillRect(x - r, y - r + 1, 2 * r + 1, 2 * r - 1);
    c.fillStyle = `rgba(255,255,255,${(0.25 * (1 - a)).toFixed(2)})`; c.fillRect(x - r + 1, y - r + 1, r, 1);
  }
}

// --- letras de fileteado: contorno, relleno en degrade por fila y brillo blanco arriba de cada trazo
export function letrasFilete(c, s, x, y, k, relleno, contorno, luz = '#ffffff') {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [2, 2], [1, 2], [2, 1]]) texto(c, s, x + dx, y + dy, contorno, k);
  texto(c, s, x, y, relleno, k);
  let cx = x;
  for (const ch of s) {
    const g = FUENTE[ch] || FUENTE[' '];
    g.forEach((fila, j) => [...fila].forEach((p, i) => { if (p === '#' && (j === 0 || g[j - 1][i] !== '#')) px(c, cx + i * k, y + j * k, k, 1, luz); }));
    cx += 6 * k;
  }
}
export const CELESTE7 = ['#d4f3ff', '#9fe3ff', '#5fcbf5', '#35b8e8', '#2a9fd0', '#1f86ad', '#176e91'];
export const BLANCO7 = ['#ffffff', '#ffffff', '#f3ecff', '#e6d8ff', '#d9c4ff', '#c9a8ff', '#b892ff'];
export const VIOLETA7 = ['#ffffff', '#f0e6ff', '#d9c4ff', '#c9a8ff', '#a97bf0', '#8d5fe0', '#c9a8ff'];

// --- estampas: sol de mayo y volutas del fileteado
export const SOL = ['....Y....', '.Y..Y..Y.', '..YYYYY..', '..YoooY..', 'YYYoooYYY', '..YoooY..', '..YYYYY..', '.Y..Y..Y.', '....Y....'];
export const VOLUTA = ['..aaa..', '.a...a.', 'a..cc.a', 'a.c..a.', 'a.cb.a.', '.a..a..', '..aa...'];
export function estampa(c, filas, x, y, colores, voltear = false) {
  filas.forEach((f, j) => [...f].forEach((p, i) => { if (colores[p]) px(c, x + (voltear ? f.length - 1 - i : i), y + j, 1, 1, colores[p]); }));
}
export const solCol = { Y: '#ffd21f', o: '#ff9e1f' };

export const ancho = (s, k = 1) => anchoDeTexto(s, k);
export function texto(c, s, x, y, color, k = 1) {
  let cx = x;
  for (const ch of s) {
    (FUENTE[ch] || FUENTE[' ']).forEach((fila, j) => {
      c.fillStyle = Array.isArray(color) ? color[j] : color;
      [...fila].forEach((p, i) => { if (p === '#') c.fillRect(cx + i * k, y + j * k, k, k); });
    });
    cx += 6 * k;
  }
}
export const centro = (c, s, y, color, k = 1) => texto(c, s, Math.floor((ANCHO - ancho(s, k)) / 2), y, color, k);
export const CROMO7 = ['#ffffff', '#d4f3ff', '#8fdcf7', '#35b8e8', '#2697c4', '#1f86ad', '#8fdcf7'];
export const centroEn = (c, s, x, w, y, col) => texto(c, s, x + Math.floor((w - ancho(s)) / 2), y, col);
export const DEGRADE_VIOLETA = ['#ffffff', '#f0e6ff', '#d9c4ff', '#c9a8ff', '#a97bf0', '#8d5fe0', '#c9a8ff'];

// ================================================================ sprites por grilla
export const PAL = {
  K:'#2a1206', R:'#ff3b30', r:'#c41a22', q:'#ff8f85', W:'#ffffff', w:'#c9d3e0',
  B:'#9a5526', b:'#66310f', n:'#c47c45', F:'#f7c793', f:'#d6935a', m:'#7a2412', E:'#120804', e:'#ffffff',
  G:'#35c75a', g:'#1f8a3c', h:'#0f5c26', O:'#2f6bff', o:'#1c44b0', u:'#7aa2ff', Y:'#ffd21f',
  T:'#f2bd78', C:'#35b8e8', c:'#d48a3a', s:'#9a5a22'
};
export const GRIS = Object.fromEntries(Object.keys(PAL).map((k) => [k, '#2b313b']));
const sim = (filas) => filas.map((f) => f + [...f].reverse().join(''));
export const MONO_ATRAS = sim([
  '........KKKK','......KKqqRR','.....KqqRRRR','....KqRRRRRR','....KRRRRRRR','....KRRRRRRR','....KrRRRRRK','....KrrrrrKW',
  '....KKKKKKKK','..KKKbBBnBBB','.KbBKbBBBBBB','.KbbKbBBBBBB','..KKKbBBBBBB','....KbbBBBBB','.....Kbbbbbb','...KKgGGOOGG',
  '..KbKgGhOOGh','.KbBKgGGOOGG','.KbBKoOOOOOO','.KnBKoOOuOOO','..KKKoOOOOOO','....KoOOOOoK','....KfFFfK..','.....KKKK...']);
export const MONO_FRENTE = sim([
  '........KKKK','......KKqqRR','.....KqqRRRR','....KqRRWWWW','....KRRRWWWW','....KrRRRRRR','..KKrrrrrrrr','.KbKKKKKKKKK',
  'KbnBKfFFFFFF','KbFfKFFeEFFF','KbFfKFFEEFFF','.KbbKFFFFFFF','..KKfFFFmFFF','...KffFFFmmm','....KffFFFFF','...KKgGGOOGG',
  '..KbKgGhOOGh','.KbBKgGOOOOO','.KbBKgOOYOOO','.KfFKoOOOuOO','..KKKoOOOOOO','....KoOOOOoK','....KfFFfK..','.....KKKK...']);
export const MONO_PARPADEO = MONO_FRENTE.map((f, j) => (j === 9 ? f.replace(/eE/g, 'FF').replace(/Ee/g, 'FF') : j === 10 ? f.replace(/EE/g, 'KK') : f));
export const MONO_LADO = [
  '........KKKKKK..........','......KKqqRRRRK.........','.....KqRRRRRRRRK........','....KqRRRRRRWWRRK.......',
  '....KRRRRRRRWWRRRKK.....','....KrRRRRRRRRRRrrrrK...','....KrrrrrrrrrrrrrrrrK..','...KbKKKKKKKKKKKKKKKK...',
  '..KbnBBBBBKfFFFFK.......','.KbFfKBBBBKFFFeEFK......','.KbFfKBBBBKFFFEEFFK.....','..KbbKBBBBKfFFFFFFFK....',
  '...KKBBBBBKffFFFmFFK....','....KbBBBBBKffmmmFK.....','.....KbbbbbbKKKKKK......','.....KgGGOOGGGK.........',
  '..KbKKgGhOOGGBK.........','.KbK.KgGOOOOBFK.........','.KbK.KoOOOYOOK..........','..KbKKoOOOuOOK..........',
  '...KKKoOOOOOOK..........','.....KoOOKoOOK..........','.....KfFFKfFFFK.........','......KKK.KKKK..........'];
export const MONO_GOLPE = [
  '........................','........................','........................','........................',
  '........................','........................','........................','........................',
  '........................','........................','........................','........................',
  '........................','........................','........................','......KKKKKKKKKKKK......',
  '.....KqRRRWWWWRRRrK.....','....KKKKKKKKKKKKKKKK....','...KbKFFeEFFFFEeFFKbK...','...KbKFFFFFmmFFFFFKbK...',
  '..KgGGOOOOYOOYOOOOGGgK..','.KfFKoOOOOOOOOOOOOoKFfK.','..KKK.KKKKKKKKKKKK.KKK..','........................'];
export const GORRA = ['..KKKKKK..','.KqRRWWRK.','KrrrrrrrrK','.KKKKKKKK.'];
export const CABEZA = ['...KKKKKK...','..KqRRRRRK..','.KqRRWWRRRK.','.KRRRWWRRRK.','KKrrrrrrrrKK','KbKFFFFFFKbK',
  'KfKFEFFEFKfK','.KKFFFFFFKK.','..KFfmmfFK..','...KFFFFK...','....KKKK....','............'];
export const CABEZA_GUINO = CABEZA.map((f, j) => (j === 6 ? 'KfKFKFFKFKfK' : f));
export const CAJA = ['..KKKKKKKKKKKK..','.KTTTTTCCTTTTTK.','KTTTTTTCCTTTTTTK','KTTTTTTCCTTTTTTK','KKKKKKKCCKKKKKKK',
  'KccccccCCccccccK','KccccccCCccccccK','KcWWWccCCccccccK','KcWWWccCCccccccK','KccccccCCccccccK','KccccccCCcccccsK',
  'KsccccsCCsccccsK','KssssssCCssssssK','.KKKKKKKKKKKKKK.'];

const cache = new Map();
export function hoja(filas, pal = PAL) {
  const clave = filas.join('|') + (pal === GRIS ? 'g' : '');
  if (cache.has(clave)) return cache.get(clave);
  const cv = lienzo(filas[0].length, filas.length);
  const c = cv.getContext('2d');
  filas.forEach((f, j) => [...f].forEach((p, i) => { if (p !== '.' && pal[p]) { c.fillStyle = pal[p]; c.fillRect(i, j, 1, 1); } }));
  cache.set(clave, cv); return cv;
}
export function pegar(c, filas, x, y, { pal = PAL, voltear = false, k = 1, alto } = {}) {
  const im = hoja(filas, pal), w = im.width * k, h = (alto ?? im.height) * k;
  c.save();
  if (voltear) { c.translate(Math.round(x) + w, Math.round(y)); c.scale(-1, 1); c.drawImage(im, 0, 0, w, h); }
  else c.drawImage(im, Math.round(x), Math.round(y) + (im.height * k - h), w, h);
  c.restore();
}
