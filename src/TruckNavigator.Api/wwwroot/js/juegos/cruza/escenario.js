/**
 * El escenario de CRUZA, MONO (spec §2.2 y §4): el piso, el barrio, los galpones y los
 * conventillos, la letra gruesa y los tres carteles de la app, el mono animado, los
 * troncos y la caja. Portado del prototipo aprobado
 * (docs/diseno/prototipo-cruza/escena.js), pixel por pixel.
 *
 * Rendimiento (spec §8): lo quieto de cada piso se dibuja una vez por fila en un
 * lienzo aparte y despues se copia entero; los arboles se guardan en sus dos
 * posiciones de vaiven. Cada cuadro solo dibuja lo que se mueve.
 */

import { lienzo, CONTORNO, mod, lerp, px, semilla, brillo, SOL, estampa, solCol, ancho, texto, CROMO7, MONO_ATRAS, MONO_FRENTE, MONO_PARPADEO, MONO_LADO, GORRA, CAJA, pegar } from './sprites.js';
import { vehiculo } from './vehiculos.js';
import { CEL, ANCHO } from './reglas.js';

/** El ancho del campo, con el nombre que tiene en el prototipo. */
const W = ANCHO;

// ================================================================ el piso, mas vivo
function asfalto(c, y, i, arriba, abajo, opc = {}) {
  if (opc.adoquin) {
    px(c, 0, y, W, CEL, '#4a434f');
    for (let f = 0; f < 4; f++) for (let x = -6; x < W; x += 8) {
      const xx = x + (f % 2) * 4, yy = y + f * 6;
      px(c, xx + 1, yy + 1, 6, 4, '#6e6672'); px(c, xx + 1, yy + 1, 6, 1, '#8a8190'); px(c, xx + 1, yy + 4, 6, 1, '#5a5360');
    }
  } else {
    px(c, 0, y, W, CEL, '#2f3240');
    const az = semilla(i + 3);
    for (let k = 0; k < 46; k++) px(c, Math.floor(az() * W), y + Math.floor(az() * CEL), 1, 1, az() > 0.5 ? '#3a3e4f' : '#272a36');
    if (opc.mancha) { px(c, opc.mancha, y + 9, 8, 4, '#262833'); px(c, opc.mancha + 2, y + 8, 4, 6, '#262833'); px(c, opc.mancha + 3, y + 9, 1, 1, '#4a4466'); }
  }
  if (arriba === 'calle') for (let x = 4; x < W; x += 16) px(c, x, y, 8, 1, '#f4f4f4');
  if (opc.red) { px(c, 0, y + CEL - 3, W, 1, '#d4f3ff'); px(c, 0, y + CEL - 2, W, 1, '#35b8e8'); px(c, 0, y + CEL - 1, W, 1, '#1f86ad'); }
  if (opc.senda) for (let x = opc.senda[0]; x < opc.senda[1]; x += 6) px(c, x, y + 2, 3, CEL - 4, 'rgba(250,250,250,.7)');
}
function vereda(c, y, i, arriba, abajo, t, opc = {}) {
  px(c, 0, y, W, CEL, '#a3a9b6');
  for (let x = 0; x < W; x += 12) for (let yy = 0; yy < CEL; yy += 12) {
    px(c, x, y + yy, 12, 1, '#8c93a1'); px(c, x, y + yy, 1, 12, '#8c93a1');
    for (const a of [3, 6, 9]) for (const b of [3, 6, 9]) px(c, x + a, y + yy + b, 1, 1, '#bcc1cb');
  }
  for (const [lado, hay] of [['arriba', arriba === 'calle'], ['abajo', abajo === 'calle']]) {
    if (!hay) continue;
    const cy = lado === 'arriba' ? y : y + CEL - 3;
    px(c, 0, cy, W, 3, '#d7dbe2'); px(c, 0, lado === 'arriba' ? cy + 2 : cy, W, 1, '#ffffff');
    if (opc.amarillo) for (let x = 0; x < W; x += 16) px(c, x, cy, 8, 3, x % 32 ? '#ffd21f' : '#2b2a35');
  }
  if (opc.petalos) { const az = semilla(i + 99); for (let k = 0; k < 18; k++) px(c, Math.floor(az() * W), y + Math.floor(az() * CEL), 1, 1, k % 3 ? '#c9a8ff' : '#a97bf0'); }
}
// La plaza sin sus florcitas, que titilan y van en vivo. El azar es el mismo: se
// consumen las llamadas de las florcitas para que los puntos violetas caigan donde caian.
function plazaBase(c, y, i) {
  px(c, 0, y, W, CEL, '#33c24d');
  for (let x = 0; x < W; x++) for (let yy = 0; yy < CEL; yy++) if ((x * 7 + yy * 13 + i) % 11 === 0) px(c, x, y + yy, 1, 1, '#3ad457');
  const az = semilla(i + 41);
  for (let k = 0; k < 16; k++) { const fx = Math.floor(az() * W), fy = 3 + Math.floor(az() * 18); px(c, fx, y + fy, 2, 1, '#24a33c'); px(c, fx + 1, y + fy - 1, 1, 1, '#24a33c'); }
  for (let k = 0; k < 20; k++) az();
  for (let k = 0; k < 8; k++) px(c, Math.floor(az() * W), y + Math.floor(az() * CEL), 1, 1, '#b388ff');
}
function florcitas(c, y, i, t) {
  const az = semilla(i + 41);
  for (let k = 0; k < 32; k++) az();
  for (let k = 0; k < 10; k++) {
    const fx = Math.floor(az() * W), fy = 3 + Math.floor(az() * 18), col = ['#ffffff', '#c9a8ff', '#ffd21f'][k % 3];
    px(c, fx, y + fy, 1, 1, col); if (Math.floor(t * 2 + k) % 3 !== 0) { px(c, fx - 1, y + fy, 1, 1, col); px(c, fx + 1, y + fy, 1, 1, col); px(c, fx, y + fy - 1, 1, 1, col); }
  }
}
function playonBase(c, y) {
  px(c, 0, y, W, CEL, '#68707f');
  for (let x = 0; x < W; x++) for (let yy = 0; yy < CEL; yy++) if ((x * 5 + yy * 3) % 13 === 0) px(c, x, y + yy, 1, 1, '#737b8b');
  for (let x = 12; x < W; x += 48) px(c, x, y + 2, 2, CEL - 4, '#35b8e8');
  texto(c, 'TBF', 66, y + 5, '#4f8fb0', 2);
}
function numeroDelPlayon(c, y, t, numero) {
  if (numero) texto(c, String(numero), 118, y + 9, Math.floor(t * 2) % 2 ? CROMO7 : '#4f8fb0');
}
function rioBase(c, y, i, arriba, abajo) {
  px(c, 0, y, W, CEL, '#1668ff');
  for (let x = 0; x < W; x += 2) for (let yy = (x / 2 + i) % 2; yy < CEL; yy += 4) px(c, x, y + yy, 1, 1, '#1d78ff');
  if (arriba !== 'rio') { px(c, 0, y, W, 2, '#0b3fa8'); px(c, 0, y + 2, W, 1, '#4fb0ff'); }
  if (abajo !== 'rio') px(c, 0, y + CEL - 2, W, 2, '#0b3fa8');
}
// Las crestas corren con el agua. La orilla de arriba se vuelve a pintar despues, como
// estaba: encima de las crestas.
function crestas(c, y, dir, t, arriba) {
  for (let k = 0; k < 12; k++) {
    const x = mod(k * 41 + dir * t * 10, W + 20) - 10, yy = 3 + (k * 7) % 17;
    px(c, x, y + yy, 6, 1, '#58c6ff'); px(c, x + 2, y + yy - 1, 2, 1, '#d8f4ff');
  }
  if (arriba !== 'rio') { px(c, 0, y, W, 2, '#0b3fa8'); px(c, 0, y + 2, W, 1, '#4fb0ff'); }
}

/** Lo quieto de una fila: va al cache. `arriba` y `abajo` son los tipos de las vecinas. */
export function pisoBase(c, k, y, arriba, abajo) {
  if (k.t === 'calle') asfalto(c, y, k.i, arriba, abajo, k);
  else if (k.t === 'plaza') plazaBase(c, y, k.i);
  else if (k.t === 'playon') playonBase(c, y);
  else if (k.t === 'rio') rioBase(c, y, k.i, arriba, abajo);
  else vereda(c, y, k.i, arriba, abajo, 0, k);
}

/** Lo que se mueve del piso: las florcitas, el numero del playon y las crestas del rio. */
export function pisoVivo(c, k, y, t, arriba) {
  if (k.t === 'plaza') florcitas(c, y, k.i, t);
  else if (k.t === 'playon') numeroDelPlayon(c, y, t, k.numero);
  else if (k.t === 'rio') crestas(c, y, k.dir, t, arriba);
}

/**
 * El piso quieto de cada fila se dibuja una vez y despues se copia entero (spec §8).
 * Se guarda por la fila misma, no por su numero: una partida nueva es otro mundo con
 * los mismos numeros. Las filas olvidadas se van solas con el WeakMap.
 */
export function crearCacheDePisos() {
  const guardados = new WeakMap();
  return {
    dibujar(c, k, y, arriba, abajo) {
      let cv = guardados.get(k);
      if (!cv) {
        cv = lienzo(W, CEL);
        pisoBase(cv.getContext('2d'), k, 0, arriba, abajo);
        guardados.set(k, cv);
      }
      c.drawImage(cv, 0, Math.round(y));
    }
  };
}

// ================================================================ el barrio
function sombra(c, x, y, w, h = 3) { px(c, x, y, w, h, 'rgba(10,8,30,.28)'); }
// El arbol quieto (sombra, tronco y copa) depende solo del vaiven y de si es jacaranda:
// se guarda en sus dos posiciones. Las flores que caen van en vivo.
const ARBOLES = new Map();
function copa(c, x, y, sway, jac) {
  sombra(c, x + 4, y + 17, 18, 4);
  const pal = jac ? ['#3a1f6e', '#e3c9ff', '#c4a0ff', '#a97bf0', '#7a4fd6'] : ['#0b3d19', '#9cf0a6', '#55d66b', '#2fb14a', '#1f8a3c'];
  px(c, x + 11, y + 14, 3, 8, '#6b3a1c');
  const cx = x + 11.5 + sway, cy = y + 8.5;
  const lobs = [[0, 0, 10.5], [-4, 2, 7], [4, 3, 7], [0, -3, 8]];
  for (let py = -13; py <= 12; py++) for (let pxx = -12; pxx <= 12; pxx++) {
    let dentro = false, nx = 0, ny = 0;
    for (const [ox, oy, r] of lobs) { const dx = pxx - ox, dy = py - oy; if (dx * dx + dy * dy <= r * r) { dentro = true; nx = dx / r; ny = dy / r; } }
    if (!dentro) continue;
    const borde = !lobs.some(([ox, oy, r]) => { const dx = pxx - ox, dy = py - oy; return dx * dx + dy * dy <= (r - 1.3) ** 2; });
    const luz = -(nx * 0.7 + ny * 0.7);
    let col = borde ? pal[0] : luz > 0.55 ? pal[1] : luz > 0.15 ? pal[2] : luz > -0.35 ? pal[3] : pal[4];
    if (!borde && (pxx * 3 + py * 5 + 40) % 9 === 0) col = pal[4];
    px(c, cx + pxx, cy + py, 1, 1, col);
  }
}
function arbol(c, x, y, t, i = 0, jac = false) {
  const sway = Math.floor(t * 1.2 + i) % 2;
  const clave = (jac ? 'j' : 'p') + sway;
  let cv = ARBOLES.get(clave);
  if (!cv) {
    cv = lienzo(28, 28);
    copa(cv.getContext('2d'), 2, 5, sway, jac);
    ARBOLES.set(clave, cv);
  }
  c.drawImage(cv, Math.round(x) - 2, Math.round(y) - 5);
  if (jac) for (let k = 0; k < 3; k++) { const a = mod(t * 0.5 + k / 3 + i * 0.13, 1); px(c, x + 4 + k * 7 + Math.round(Math.sin(t * 2 + k) * 2), y + 4 + a * 18, 1, 1, '#d9c4ff'); }
}
function contenedor(c, x, y) {
  sombra(c, x + 5, y + 19, 16);
  px(c, x + 3, y + 4, 18, 16, '#0b2010');
  [['#7be08a', 2], ['#3fc458', 4], ['#2fb14a', 5], ['#1f8a3c', 4]].reduce((yy, [col, h]) => { px(c, x + 4, y + yy, 16, h, col); return yy + h; }, 5);
  px(c, x + 3, y + 4, 18, 3, '#14632c'); px(c, x + 4, y + 5, 16, 1, '#55d66b');
  px(c, x + 7, y + 10, 10, 1, '#14632c'); px(c, x + 7, y + 13, 10, 1, '#14632c');
  px(c, x + 5, y + 20, 3, 2, '#0d0c12'); px(c, x + 16, y + 20, 3, 2, '#0d0c12');
}
function banco(c, x, y, mate = false) {
  sombra(c, x + 3, y + 17, 19);
  px(c, x + 2, y + 7, 20, 11, CONTORNO);
  for (let k = 0; k < 3; k++) px(c, x + 3, y + 8 + k * 3, 18, 2, k === 0 ? '#e6a86e' : '#c47c45');
  px(c, x + 3, y + 17, 2, 3, '#3a3f4a'); px(c, x + 19, y + 17, 2, 3, '#3a3f4a');
  if (mate) {
    px(c, x + 6, y + 2, 5, 6, CONTORNO); px(c, x + 7, y + 3, 3, 5, '#8a4f22'); px(c, x + 7, y + 3, 3, 1, '#c58447'); px(c, x + 8, y + 2, 1, 2, '#3fc458'); px(c, x + 9, y - 1, 1, 4, '#d7dbe2');
    px(c, x + 13, y - 2, 4, 10, CONTORNO); px(c, x + 14, y - 1, 2, 8, '#35b8e8'); px(c, x + 14, y - 1, 1, 8, '#a6e6ff'); px(c, x + 14, y - 3, 2, 2, '#e3ebf3');
  }
}
function bolardo(c, x, y) {
  sombra(c, x + 9, y + 18, 8);
  px(c, x + 8, y + 6, 8, 14, CONTORNO);
  [['#d4f3ff', 3], ['#7fdcff', 3], ['#35b8e8', 3], ['#1f86ad', 3]].reduce((yy, [col, h]) => { px(c, x + 9, y + yy, 6, h, col); return yy + h; }, 7);
  px(c, x + 9, y + 5, 6, 2, '#e8eef5');
}
function mastil(c, x, y, t) {
  sombra(c, x + 8, y + 19, 10);
  px(c, x + 7, y + 17, 10, 4, '#d7dbe2'); px(c, x + 7, y + 17, 10, 1, '#ffffff');
  px(c, x + 11, y - 30, 2, 48, '#c9d3de'); px(c, x + 11, y - 30, 1, 48, '#ffffff'); px(c, x + 10, y - 32, 4, 2, '#ffd21f');
  for (let i = 0; i < 18; i++) {
    const dy = Math.round(Math.sin(t * 5 - i * 0.5) * 1.2 * (i / 18)), fx = x + 13 + i, fy = y - 29 + dy;
    for (let j = 0; j < 12; j++) { const col = j < 4 || j >= 8 ? '#74c7ff' : '#ffffff'; px(c, fx, fy + j, 1, 1, col); }
    if (i === 8) { px(c, fx, fy + 5, 1, 2, '#ffd21f'); px(c, fx - 1, fy + 5, 1, 2, '#ffb000'); }
  }
}
function chapa(c, x, y, w, h, base, oscuro) { px(c, x, y, w, h, base); for (let i = 1; i < w; i += 3) px(c, x + i, y, 1, h, oscuro); }
const COLORES_BOCA = [['#ffcc33', '#d9a400'], ['#33b6ff', '#1f86ad'], ['#ff7a3d', '#c9541c'], ['#7be08a', '#3fa04f'], ['#b388ff', '#7a4fd6'], ['#ff6fae', '#c94680']];
// Lo que no cambia de un cuadro al otro se dibuja una vez en un lienzo y despues se
// copia (spec §8): los conventillos, los galpones sin sus lamparitas y las letras de
// los carteles. `ox`, `oy` es donde cae el origen del dibujo adentro del lienzo.
const GUARDADOS = new Map();
function copiar(c, clave, w, h, ox, oy, x, y, dibujar) {
  let cv = GUARDADOS.get(clave);
  if (!cv) {
    cv = lienzo(w, h);
    dibujar(cv.getContext('2d'), ox, oy);
    GUARDADOS.set(clave, cv);
  }
  c.drawImage(cv, Math.round(x) - ox, Math.round(y) - oy);
}
function conventillo(c, x, y, i) {
  copiar(c, 'conventillo' + (i % COLORES_BOCA.length) + ':' + (i % 2), 26, 46, 1, 22, x, y, (g, ox, oy) => conventilloQuieto(g, ox, oy, i));
}
function conventilloQuieto(c, x, y, i) {
  const [base, osc] = COLORES_BOCA[i % COLORES_BOCA.length], top = y - 22;
  sombra(c, x + 1, y + 19, 22, 4);
  px(c, x, top + 2, 24, 40, CONTORNO);
  chapa(c, x + 1, top + 6, 22, 35, base, osc);
  px(c, x - 1, top, 26, 6, CONTORNO); px(c, x, top + 1, 24, 4, i % 2 ? '#c94f3a' : '#5f6b7a'); for (let k = 0; k < 24; k += 3) px(c, x + k, top + 1, 1, 4, 'rgba(0,0,0,.25)');
  px(c, x + 6, top + 10, 12, 10, CONTORNO); px(c, x + 7, top + 11, 10, 8, '#bdeeff'); px(c, x + 7, top + 11, 4, 8, '#2fb14a'); px(c, x + 13, top + 11, 4, 8, '#2fb14a'); px(c, x + 12, top + 11, 1, 8, '#ffffff');
  px(c, x + 3, top + 21, 18, 1, CONTORNO); for (let k = 0; k < 18; k += 3) px(c, x + 3 + k, top + 21, 1, 4, CONTORNO);
  px(c, x + 8, top + 28, 8, 13, CONTORNO); px(c, x + 9, top + 29, 6, 12, i % 2 ? '#8a4f22' : '#3d1f7a'); px(c, x + 13, top + 35, 1, 1, '#ffd21f');
}
// --- los galpones de carga: un tramo de 2 o 3 celdas que no se pisa. Chapa acanalada, techo en
// dientes de sierra y un porton por celda. La fachada tiene lugar para un cartel pintado.
const COLORES_GALPON = [['#b9c6d3', '#8d99a8', '#5f6b7a'], ['#a6e6ff', '#5fcbf5', '#2a9fd0'], ['#d9c4ff', '#a97bf0', '#7650c9'], ['#ffe6a6', '#f2c25a', '#c9922a']];
function galpon(c, x, y, ancho, color, t) {
  copiar(c, 'galpon' + ancho + ':' + (color % COLORES_GALPON.length), ancho * CEL, 48, 0, 23, x, y, (g, ox, oy) => galponQuieto(g, ox, oy, ancho, color));
  for (let k = 0; k < ancho; k++) px(c, x + k * CEL + 10, y + 3, 4, 1, Math.floor(t * 2 + k) % 4 ? '#fff4c2' : '#8d99a8');
}
function galponQuieto(c, x, y, ancho, color) {
  const w = ancho * CEL, top = y - 22, [claro, base, osc] = COLORES_GALPON[color % COLORES_GALPON.length];
  sombra(c, x + 2, y + 19, w - 4, 4);
  px(c, x, top + 4, w, 38, CONTORNO);
  for (let i = 1; i < w - 1; i++) px(c, x + i, top + 5, 1, 36, i % 3 === 0 ? osc : i % 3 === 1 ? claro : base);
  for (let k = 0; k < ancho; k++) for (let j = 0; j < 24; j++) {
    const h = Math.floor(j / 4), cx = x + k * CEL + j;
    px(c, cx, top + 4 - h, 1, h + 1, j === 23 ? '#bdeeff' : '#5f6b7a'); px(c, cx, top + 4 - h, 1, 1, j === 23 ? '#ffffff' : '#c9d3de');
  }
  for (let k = 0; k < ancho; k++) {
    const dx = x + k * CEL + 3;
    px(c, dx, y + 5, 18, 15, CONTORNO);
    for (let j = 0; j < 13; j++) px(c, dx + 1, y + 6 + j, 16, 1, j % 2 ? '#8d99a8' : '#c9d3de');
    for (let j = 0; j < 16; j++) px(c, dx + 1 + j, y + 19, 1, 1, Math.floor(j / 2) % 2 ? '#2b2a35' : '#ffd21f');
  }
}

/** El Obelisco del playon de la fila 100: una celda, dibujado alto (spec §3.2). */
function obelisco(c, x, y, t) {
  sombra(c, x + 4, y + 18, 16, 4);
  const cx = x + 12, base = y + 20;
  for (let k = 0; k < 64; k++) {
    const w = Math.round(lerp(10, 4, k / 64));
    px(c, cx - Math.floor(w / 2) - 1, base - k, w + 2, 1, CONTORNO);
    px(c, cx - Math.floor(w / 2), base - k, w, 1, k % 16 === 0 ? '#c9c2e6' : '#e8e4f4');
    px(c, cx + Math.ceil(w / 2) - 1, base - k, 1, 1, '#b3a9d9');
  }
  for (let k = 0; k < 5; k++) px(c, cx - Math.floor((5 - k) / 2), base - 64 - k, 5 - k, 1, '#e8e4f4');
  px(c, cx - 1, base - 58, 2, 2, Math.floor(t * 2) % 2 ? '#ffd27a' : '#8a7fc0');
}

// --- la letra de los carteles: angosta (4 x 7, la M y la N de 5, la I y la T de 3), y se
// dibuja como letra fileteada: contorno oscuro, relleno en degrade por fila y brillo blanco
// arriba de cada trazo. Tiene que romper: la 5 x 7 fina no se ve de reojo.
export const GRUESA = {
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#', '#..#'], B: ['###.', '#..#', '#..#', '###.', '#..#', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '#...', '###.', '#...', '#...', '####'], F: ['####', '#...', '#...', '###.', '#...', '#...', '#...'],
  G: ['.###', '#...', '#...', '#.##', '#..#', '#..#', '.###'], I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..##', '...#', '...#', '...#', '...#', '#..#', '.##.'], L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'], P: ['###.', '#..#', '#..#', '###.', '#...', '#...', '#...'],
  R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#', '#..#'], S: ['.###', '#...', '#...', '.##.', '...#', '...#', '###.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.'], U: ['#..#', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'], ' ': ['.', '.', '.', '.', '.', '.', '.']
};
const glifo = (ch) => GRUESA[ch === 'Á' ? 'A' : ch] || GRUESA[' '];
export const anchoGruesa = (s) => [...s].reduce((a, ch) => a + glifo(ch)[0].length + 1, 0) - 1;
export function pixelesGruesa(s, x, y) {
  const v = []; let cx = x;
  for (const ch of s) {
    const g = glifo(ch);
    g.forEach((fila, j) => [...fila].forEach((p, i) => { if (p === '#') v.push([cx + i, y + j, j, j === 0 || g[j - 1][i] !== '#']); }));
    if (ch === 'Á') { v.push([cx + 2, y - 2, 0, true]); v.push([cx + 3, y - 3, 0, true]); }
    cx += g[0].length + 1;
  }
  return v;
}
function letraFilete(c, s, x, y, relleno, contorno, luz = '#ffffff') {
  copiar(c, ['filete', s, relleno, contorno, luz].join('|'), anchoGruesa(s) + 3, 13, 1, 4, x, y, (g, ox, oy) => letraFileteDirecta(g, s, ox, oy, relleno, contorno, luz));
}
function letraFileteDirecta(c, s, x, y, relleno, contorno, luz) {
  const v = pixelesGruesa(s, x, y);
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [1, 2], [2, 2], [0, 2]]) for (const [px0, py0] of v) px(c, px0 + dx, py0 + dy, 1, 1, contorno);
  for (const [px0, py0, j, arriba] of v) px(c, px0, py0, 1, 1, arriba ? luz : relleno[Math.min(j, relleno.length - 1)]);
}
const letraFileteCentro = (c, s, x, w, y, relleno, contorno, luz) => letraFilete(c, s, x + Math.floor((w - anchoGruesa(s)) / 2), y, relleno, contorno, luz);
function letraNeon(c, s, x, y, nucleo, halo, prendido) {
  copiar(c, ['neon', s, nucleo, halo, prendido].join('|'), anchoGruesa(s) + 4, 14, 2, 5, x, y, (g, ox, oy) => letraNeonDirecta(g, s, ox, oy, nucleo, halo, prendido));
}
function letraNeonDirecta(c, s, x, y, nucleo, halo, prendido) {
  const v = pixelesGruesa(s, x, y);
  if (!prendido) { for (const [a, b] of v) px(c, a, b, 1, 1, '#3a2f55'); return; }
  c.fillStyle = halo;
  for (const [a, b] of v) c.fillRect(a - 2, b - 2, 5, 5);
  for (const [a, b] of v) px(c, a, b, 1, 1, nucleo);
}
const DORADO7 = ['#fff6c2', '#fff08a', '#ffe14a', '#ffd21f', '#f2b800', '#e0a400', '#ffd21f'];
const NIEVE7 = ['#ffffff', '#ffffff', '#eef7ff', '#d4f3ff', '#bfeeff', '#a6e6ff', '#d4f3ff'];

// --- "EL MEJOR AMIGO DEL CAMIONERO": chapa fileteada compacta. Queda dentro de su fila: un cartel
// que sube tapa los autos del carril de adelante.
export function chapaFilete(c, x, y, t, pared = false) {
  if (!pared) { sombra(c, x + 4, y + 20, 64, 3); for (const p of [10, 59]) { px(c, x + p, y + 20, 3, 3, CONTORNO); px(c, x + p + 1, y + 20, 1, 3, '#a8602a'); } }
  px(c, x, y, 72, 20, CONTORNO);
  px(c, x + 1, y + 1, 70, 18, '#ffd21f');
  px(c, x + 2, y + 2, 68, 16, '#1b1747'); px(c, x + 2, y + 2, 68, 6, '#221d5a');
  for (const [a, b] of [[1, 1], [69, 1], [1, 17], [69, 17]]) px(c, x + a, y + b, 2, 2, '#c9a8ff');
  for (let k = 0; k < 5; k++) { const on = Math.floor(t * 3 + k) % 3 !== 0; px(c, x + 8 + k * 13, y + 1, 3, 1, on ? '#ffffff' : '#ff9e1f'); }
  letraFileteCentro(c, 'EL MEJOR AMIGO', x, 72, y + 3, DORADO7, '#2a1206');
  letraFileteCentro(c, 'DEL CAMIONERO', x, 72, y + 11, NIEVE7, '#3d1f7a');
  estampa(c, SOL, x + 32, y - 5, solCol);
}
// --- "RED DE TRANSITO PESADO": la senal de la Red compacta, con sus balizas
export function senalRed(c, x, y, t, pared = false) {
  if (!pared) { sombra(c, x + 24, y + 20, 24, 3); for (let k = 0; k < 3; k++) px(c, x + 34, y + 20 + k, 4, 1, k % 2 ? '#2b2a35' : '#ffd21f'); }
  px(c, x, y, 72, 20, CONTORNO);
  px(c, x + 1, y + 1, 70, 18, '#d4f3ff'); px(c, x + 2, y + 2, 68, 16, '#35b8e8');
  px(c, x + 2, y + 2, 68, 15, '#1f4fbf'); px(c, x + 2, y + 2, 68, 6, '#2a5fd6');
  for (let k = 0; k < 70; k++) px(c, x + 1 + k, y + 18, 1, 1, mod(k, 6) < 3 ? '#ffd21f' : '#2b2a35');
  letraFileteCentro(c, 'RED DE TRÁNSITO', x, 72, y + 3, NIEVE7, '#0b1a4a');
  letraFileteCentro(c, 'PESADO', x, 72, y + 11, DORADO7, '#0b1a4a');
  const fl = Math.floor(t * 4) % 2;
  for (const [fx, d] of [[x + 15 + fl, 1], [x + 56 - fl, -1]]) { px(c, fx, y + 12, 1, 1, '#ffd21f'); px(c, fx + d, y + 13, 1, 1, '#ffd21f'); px(c, fx + 2 * d, y + 14, 1, 1, '#ffd21f'); px(c, fx + d, y + 15, 1, 1, '#ffd21f'); px(c, fx, y + 16, 1, 1, '#ffd21f'); }
  c.save(); c.beginPath(); c.rect(x + 2, y + 2, 68, 15); c.clip(); brillo(c, x + 2, y + 2, 68, 15, t + x * 0.01, 4, 'rgba(255,255,255,.3)'); c.restore();
  for (const [bx, fase] of [[x + 2, 0], [x + 67, 1]]) {
    const on = (Math.floor(t * 2.5) + fase) % 2 === 0;
    px(c, bx, y - 3, 3, 3, CONTORNO); px(c, bx + 1, y - 2, 1, 2, on ? '#ffb000' : '#6a4800');
    if (on) { c.fillStyle = 'rgba(255,176,0,.3)'; c.fillRect(bx - 2, y - 5, 7, 6); }
  }
}
// --- "TU GPS, BAJALA GRATIS": cartel de neon compacto
export function neon(c, x, y, t, pared = false) {
  if (!pared) { sombra(c, x + 4, y + 20, 64, 3); for (const p of [9, 61]) px(c, x + p, y + 20, 2, 3, '#5f6b7a'); }
  px(c, x, y, 72, 20, CONTORNO); px(c, x + 1, y + 1, 70, 18, '#0d0b1e');
  const corre = Math.floor(t * 12), borde = [];
  for (let k = 0; k < 70; k++) borde.push([x + 1 + k, y + 1], [x + 70 - k, y + 18]);
  for (let k = 0; k < 16; k++) borde.push([x + 1, y + 2 + k], [x + 70, y + 17 - k]);
  borde.forEach(([a, b], i) => px(c, a, b, 1, 1, (i + corre) % 6 < 2 ? '#ffffff' : '#a97bf0'));
  const parpadeo = mod(t, 3.7) < 0.35 && Math.floor(t * 18) % 2 === 0;
  letraNeon(c, 'TU GPS,', x + Math.floor((72 - anchoGruesa('TU GPS,')) / 2), y + 3, '#e6f8ff', 'rgba(53,184,232,.30)', true);
  letraNeon(c, 'BAJALA GRATIS', x + Math.floor((72 - anchoGruesa('BAJALA GRATIS')) / 2), y + 11, '#ffe6fb', 'rgba(255,79,216,.30)', !parpadeo);
}

// ================================================================ el mono, animado
function sombraMono(c, x, y, alto = 0) {
  const w = Math.max(8, 16 - alto * 2);
  c.fillStyle = 'rgba(10,8,30,.32)'; c.fillRect(Math.round(x + 12 - w / 2), y + 21, w, 2); c.fillRect(Math.round(x + 13 - w / 2), y + 20, w - 2, 1);
}
function cola(c, x, y, t) {
  const f = Math.floor(t * 2.5) % 2;
  const pts = f ? [[14, 20], [15, 20], [16, 19], [17, 18], [17, 17], [16, 16]] : [[14, 20], [15, 21], [16, 21], [17, 20], [18, 19], [18, 18]];
  for (const [a, b] of pts) { px(c, x + a, y + b - 1, 1, 1, '#2a1206'); px(c, x + a, y + b, 1, 1, '#9a5526'); }
}
export function mono(c, x, y, t, { vista = 'atras', salto = 0, alto = 0, invisible = false } = {}) {
  sombraMono(c, x, y, alto);
  if (invisible) return;
  const estira = salto > 0 && salto < 0.35 ? 1 : salto > 0.8 ? -1 : 0;
  const yy = y - alto;
  if (vista === 'atras') { cola(c, x, yy, t); pegar(c, MONO_ATRAS, x, yy - estira, { alto: 24 + estira }); }
  if (vista === 'frente') { const parp = mod(t, 3) < 0.14; pegar(c, parp ? MONO_PARPADEO : MONO_FRENTE, x, yy - estira, { alto: 24 + estira }); }
  if (vista === 'der') pegar(c, MONO_LADO, x, yy - estira, { alto: 24 + estira });
  if (vista === 'izq') pegar(c, MONO_LADO, x, yy - estira, { voltear: true });
}
export function estrellas(c, x, y, t) {
  for (let k = 0; k < 3; k++) {
    const a = t * 5 + k * 2.1, sx = x + 12 + Math.cos(a) * 9, sy = y + 13 + Math.sin(a) * 3;
    const col = ['#ffffff', '#8fdcf7', '#ffd21f'][k];
    px(c, sx, sy - 1, 1, 3, col); px(c, sx - 1, sy, 3, 1, col);
  }
}
export function chapuzon(c, x, y, t) {
  const a = mod(t, 1.2) / 1.2;
  for (let ring = 0; ring < 2; ring++) {
    const f = (a + ring * 0.5) % 1, r = 3 + f * 10;
    c.fillStyle = `rgba(216,244,255,${(1 - f).toFixed(2)})`;
    for (let g = 0; g < 360; g += 12) { const rad = g * Math.PI / 180; c.fillRect(Math.round(x + 12 + Math.cos(rad) * r), Math.round(y + 16 + Math.sin(rad) * r * 0.45), 1, 1); }
  }
  pegar(c, GORRA, x + 7, y + 13 + (Math.floor(t * 3) % 2));
}
export function cajaTBF(c, x, y, t, conHalo = true) {
  const flota = Math.round(Math.sin(t * 4 + x * 0.1) * 1.4);
  if (conHalo) {
    const a = 0.3 + 0.2 * Math.sin(t * 5 + x);
    c.fillStyle = `rgba(53,184,232,${a.toFixed(2)})`;
    c.fillRect(x + 2, y + 19, 20, 2); c.fillRect(x + 4, y + 21, 16, 1); c.fillRect(x + 4, y + 18, 16, 1);
  }
  pegar(c, CAJA, x + 4, y + 4 + flota);
  c.save(); c.beginPath(); c.rect(x + 5, y + 5 + flota, 14, 12); c.clip();
  brillo(c, x + 5, y + 5 + flota, 14, 12, t + x * 0.01, 2.2, 'rgba(255,255,255,.45)'); c.restore();
  if (Math.floor(t * 3 + x) % 4 === 0) { px(c, x + 19, y + 2 + flota, 1, 5, '#ffffff'); px(c, x + 17, y + 4 + flota, 5, 1, '#ffffff'); }
}
export function tronco(c, x, y, n, t, i = 0) {
  const L = n * CEL, yy = y + Math.floor(t * 2 + i) % 2;
  px(c, x + 2, yy + 5, L - 4, 15, CONTORNO); px(c, x, yy + 7, L, 11, CONTORNO);
  ['#e09a5a', '#c47838', '#a8602a', '#8a4a1c', '#6a3510'].forEach((col, j) => px(c, x + 1, yy + 6 + j * 3, L - 2, 3, col));
  const az = semilla(n * 13 + i);
  for (let k = 0; k < L / 7; k++) px(c, x + Math.floor(az() * (L - 14)) + 6, yy + 8 + Math.floor(az() * 9), 4 + Math.floor(az() * 4), 1, '#5a2c0c');
  for (let k = 0; k < 4; k++) px(c, x + 8 + Math.floor(az() * (L - 16)), yy + 6, 2, 1, '#55d66b');
  for (const ex of [1, L - 6]) { px(c, x + ex, yy + 7, 5, 11, '#f2c08a'); px(c, x + ex + 1, yy + 9, 3, 7, '#d99a5a'); px(c, x + ex + 2, yy + 11, 1, 3, '#a8602a'); }
  const es = Math.floor(t * 5 + i) % 2;
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillRect(x - 2 - es, yy + 16, 3, 1); c.fillRect(x - 1, yy + 18, 2, 1);
  c.fillRect(x + L - 1 + es, yy + 16, 3, 1); c.fillRect(x + L - 1, yy + 18, 2, 1);
}

// ================================================================ lo que hay en una fila
/**
 * Conventillos, galpones, carteles, obstaculos, cajas, troncos y vehiculos de una fila.
 * Las posiciones del transito llegan del motor (`xVehiculo`, `xTronco`): lo que se ve
 * es lo que choca.
 */
export function cosasDeFila(c, k, y, t, { tomadas = new Set(), xVehiculo, xTronco, tMs = t * 1000 } = {}) {
  const i = k.i;
  (k.boca || []).forEach((col, j) => conventillo(c, col * CEL, y, j + i));
  (k.galpones || []).forEach(([col, ancho, color]) => galpon(c, col * CEL, y, ancho, color, t));
  (k.murales || []).forEach(([col, tipo]) => { const xm = col * CEL, ym = y - 17; if (tipo === 'chapa') chapaFilete(c, xm, ym, t, true); if (tipo === 'senal') senalRed(c, xm, ym, t, true); if (tipo === 'neon') neon(c, xm, ym, t, true); });
  (k.obst || []).forEach(([col, que], j) => {
    const x = col * CEL;
    if (que === 'arbol') arbol(c, x, y, t, i + j);
    if (que === 'jacaranda') arbol(c, x, y, t, i + j, true);
    if (que === 'contenedor') contenedor(c, x, y);
    if (que === 'mate') banco(c, x, y, true);
    if (que === 'bolardo') bolardo(c, x, y);
    if (que === 'mastil') mastil(c, x, y, t);
    if (que === 'obelisco') obelisco(c, x, y, t);
  });
  (k.cajas || []).forEach((col) => { if (!tomadas.has(i + ':' + col)) cajaTBF(c, col * CEL, y, t); });
  if (k.t === 'rio') k.xs.forEach((x0, j) => {
    const x = Math.round(xTronco(k, x0, tMs));
    tronco(c, x, y, k.n, t, i * 3 + j);
    if (k.cajaEn === j && !tomadas.has(i + ':t')) cajaTBF(c, x + CEL, y - 1, t, false);
  });
  if (k.t === 'calle') k.veh.forEach(([nombre, x0]) => vehiculo(c, nombre, Math.round(xVehiculo(k, x0, tMs)), y, k.dir, t, k.vel));
}
