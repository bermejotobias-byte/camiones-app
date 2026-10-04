/**
 * Las pantallas de CRUZA, MONO (spec §2.3 y §6): la partida con su HUD, el inicio, la
 * pausa, el game over y el nuevo record. Portadas del prototipo aprobado
 * (docs/diseno/prototipo-cruza/escena.js y demo.js).
 *
 * Todo se dibuja en el lienzo logico de 216 x 340; la vista lo copia a escala entera.
 * `t` es el tiempo de lo decorativo, en segundos; lo que choca sale del motor.
 */

import { CONTORNO, mod, lerp, px, semilla, brillo, letrasFilete, CELESTE7, SOL, estampa, solCol, ancho, texto, centro, CROMO7, centroEn, DEGRADE_VIOLETA, GRIS, MONO_GOLPE, CABEZA, CABEZA_GUINO, pegar, lienzo } from './sprites.js';
import { crearCacheDePisos, pisoBase, pisoVivo, cosasDeFila, mono, estrellas, chapuzon } from './escenario.js';
import { MODELOS, vehiculo } from './vehiculos.js';
import { puntaje, xVehiculo, xTronco, xDelMono, avanceDelSalto } from './motor.js';
import { ANCHO, ALTO, HUD, CEL, FILAS_VISIBLES } from './reglas.js';

/** El ancho y el alto del campo, con los nombres que tienen en el prototipo. */
const W = ANCHO, H = ALTO;

// ================================================================ lo puro: botones, textos, escala, estado visual
export const BOTONES = {
  pausa: [{ accion: 'seguir', x: 34, y: 150, w: 148, h: 19 }, { accion: 'salir', x: 34, y: 178, w: 148, h: 19 }],
  fin: [{ accion: 'otra', x: 34, y: 262, w: 148, h: 19 }, { accion: 'salir', x: 34, y: 290, w: 148, h: 19 }]
};

/** El boton que esta en (x, y) del campo, o null. */
export const botonEn = (lista, x, y) => lista.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)?.accion ?? null;

/** Cada texto fijo que se dibuja: el test de `faltantes` los recorre. */
export const TEXTOS = ['CRUZÁ,', 'MONO', 'TOCÁ PARA JUGAR', 'HI-SCORE', 'SCORE', 'GAME', 'OVER', '¡QUÉ MACANA!',
  '¡SOS UN', 'CRACK!', '¡NUEVO HI-SCORE!', 'SIN SEÑAL: RÉCORD NO GUARDADO', 'OTRA VEZ', 'SALIR', 'SEGUIR',
  'PAUSA', 'FILAS', 'CAJAS', '+50', '0123456789'];

/**
 * La escala del campo: un entero de pixeles fisicos por pixel del juego, el mas
 * grande que entra en el lugar. Con densidades fraccionarias (2,625 en Android) el
 * campo puede quedar un poco mas chico que el lugar, pero nunca borroso.
 */
export function tamanoDelCampo(anchoCss, altoCss, dpr = 1) {
  const P = Math.max(1, Math.floor(Math.min((anchoCss * dpr) / ANCHO, (altoCss * dpr) / ALTO)));
  return { P, ancho: ANCHO * P, alto: ALTO * P, anchoCss: (ANCHO * P) / dpr, altoCss: (ALTO * P) / dpr };
}

export const crearVisual = () => ({ camara: 0, marcador: 0, particulas: [], reloj: 0 });

const CHISPAS = ['#35b8e8', '#a97bf0', '#ffffff', '#ffd21f'];

/** Lo que se ve y no decide nada: la camara suave, el marcador que cuenta, las particulas. */
export function actualizarVisual(vis, p, eventos, dt) {
  vis.reloj += dt;
  vis.camara += (p.cam - vis.camara) * Math.min(1, (dt / 1000) * 5);
  vis.marcador += (puntaje(p) - vis.marcador) * Math.min(1, (dt / 1000) * 12);
  for (const e of eventos) {
    if (e.tipo === 'caja') {
      vis.particulas.push({ texto: '+50', x: p.x - 6, fila: p.fila, dy: -8, vida: 700, desde: vis.reloj });
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        vis.particulas.push({ x: p.x + 12, fila: p.fila, dy: 10, vx: Math.cos(a), vy: Math.sin(a) * 0.8, s: 2, col: CHISPAS[k % 4], vida: 500, desde: vis.reloj, g: true });
      }
    }
    if (e.tipo === 'aterrizo' && p.mundo.fila(p.fila).t !== 'rio') {
      for (let k = 0; k < 6; k++) vis.particulas.push({ x: p.x + 12, fila: p.fila, dy: 21, vx: (k - 2.5) * 0.25, vy: -0.08, s: 1, col: 'rgba(255,255,255,.85)', vida: 300, desde: vis.reloj });
    }
  }
  vis.particulas = vis.particulas.filter((q) => vis.reloj - q.desde < q.vida);
}

// ================================================================ el HUD
function hud(c, score, hi, vidas, t, perdiendo = -1) {
  px(c, 0, 0, W, HUD, '#000000');
  texto(c, 'SCORE', 6, 3, '#35b8e8');
  texto(c, String(Math.round(score)).padStart(6, '0'), 6, 11, '#ffffff', 2);
  const supera = score > hi, late = supera && Math.floor(t * 3) % 2;
  texto(c, 'HI-SCORE', 88, 3, late ? '#ffffff' : '#c9a8ff');
  texto(c, String(Math.round(Math.max(score, hi))).padStart(6, '0'), 88, 11, supera ? (late ? '#c9a8ff' : '#ffffff') : '#ffffff', 2);
  for (let i = 0; i < 3; i++) {
    const viva = i < vidas, x = 170 + i * 15, y = 8;
    if (i === vidas && perdiendo >= 0 && perdiendo < 0.9 && Math.floor(perdiendo * 8) % 2 === 0) { pegar(c, CABEZA, x, y); continue; }
    if (!viva) { pegar(c, CABEZA, x, y, { pal: GRIS }); continue; }
    if (vidas === 1 && Math.floor(t * 2.5) % 2 === 0) px(c, x - 1, y - 1, 14, 13, 'rgba(255,46,58,.45)');
    pegar(c, mod(t + i * 1.1, 4) < 0.15 ? CABEZA_GUINO : CABEZA, x, y);
  }
  px(c, 0, HUD - 3, W, 1, '#d4f3ff'); px(c, 0, HUD - 2, W, 1, '#35b8e8'); px(c, 0, HUD - 1, W, 1, '#1f86ad');
  brillo(c, 0, HUD - 3, W, 3, t, 4, 'rgba(255,255,255,.8)');
}

// ================================================================ la partida, dibujada de atras para adelante
const cache = crearCacheDePisos();

/**
 * El campo y el HUD (la demostracion del prototipo, demo.js). `t` es el tiempo de lo
 * decorativo del HUD; el campo anima con el tiempo del mundo, que se congela en el golpe.
 */
export function dibujarJuego(c, p, vis, t, { hi = 0, quieto = false } = {}) {
  const tm = p.t / 1000, camTop = vis.camara + FILAS_VISIBLES - 1;
  const yDe = (i) => Math.round(HUD + (camTop - i) * CEL);
  const g = p.golpe ? (p.reloj - p.golpe.desde) / 1000 : -1;
  const sac = g >= 0 && g < 0.32 && !quieto ? (Math.floor(g * 40) % 2 ? 2 : -2) : 0;
  px(c, 0, 0, W, H, '#000');
  c.save(); c.beginPath(); c.rect(0, HUD, W, H - HUD); c.clip(); c.translate(sac, 0);
  const i0 = Math.floor(vis.camara) - 2, i1 = Math.ceil(camTop) + 2;
  for (let i = i1; i >= i0; i--) {
    const k = p.mundo.fila(i), y = yDe(i), arr = p.mundo.fila(i + 1).t, aba = p.mundo.fila(i - 1).t;
    cache.dibujar(c, k, y, arr, aba);
    pisoVivo(c, k, y, tm, arr);
  }
  const s = p.salto, fs = avanceDelSalto(p);
  const filaMono = s ? s.f1 : p.fila;
  for (let i = i1 + 2; i >= i0; i--) {
    cosasDeFila(c, p.mundo.fila(i), yDe(i), tm, { tomadas: p.tomadas, xVehiculo, xTronco, tMs: p.t });
    if (i !== filaMono) continue;
    const filaV = s ? lerp(s.f0, s.f1, fs) : p.fila, xm = xDelMono(p);
    const ym = Math.round(HUD + (camTop - filaV) * CEL);
    if (p.golpe) {
      if (p.golpe.motivo === 'agua' || p.golpe.motivo === 'borde') chapuzon(c, xm, ym, tm);
      else { pegar(c, MONO_GOLPE, xm, ym); estrellas(c, xm, ym + 6, t); }
    } else {
      const parpadea = p.reloj < p.invulnerableHasta && Math.floor(p.reloj / 100) % 2 === 0;
      mono(c, xm, ym, tm, { vista: p.vista, salto: fs, alto: s ? Math.round(Math.sin(fs * Math.PI) * 6) : 0, invisible: parpadea });
    }
  }
  for (const q of vis.particulas) {
    const a = (vis.reloj - q.desde) / q.vida, y = Math.round(HUD + (camTop - q.fila) * CEL) + q.dy;
    if (q.texto) { letrasFilete(c, q.texto, q.x, Math.round(y - a * 16), 2, DEGRADE_VIOLETA, '#3d1f7a'); continue; }
    px(c, q.x + q.vx * a * 30, y + q.vy * a * 30 + (q.g ? a * a * 10 : 0), q.s, q.s, q.col);
  }
  if (g >= 0 && g < 0.9 && (quieto ? g < 0.6 : [0, 0.18, 0.36].some((s0) => g >= s0 && g < s0 + 0.1))) px(c, 0, HUD, W, H - HUD, 'rgba(255,24,40,.55)');
  c.restore();
  hud(c, vis.marcador, hi, Math.max(0, p.vidas), t, g);
}

/** La pausa: el campo quieto y oscurecido, y SEGUIR o SALIR. */
export function dibujarPausa(c, p, vis, t, { hi = 0 } = {}) {
  dibujarJuego(c, p, vis, t, { hi, quieto: true });
  px(c, 0, HUD, W, H - HUD, 'rgba(0,0,0,.6)');
  centro(c, 'PAUSA', 112 + 3, '#3d1f7a', 3); centro(c, 'PAUSA', 112, CROMO7, 3);
  const [seguir, salir] = BOTONES.pausa;
  boton(c, seguir.x, seguir.y, seguir.w, 'SEGUIR', true);
  boton(c, salir.x, salir.y, salir.w, 'SALIR', false);
}

// ================================================================ inicio: atardecer porteno, game over y record
function marquesina(c, t) {
  const pasos = [];
  for (let x = 6; x < W - 4; x += 10) pasos.push([x, 4]);
  for (let y = 14; y < H - 4; y += 10) pasos.push([W - 6, y]);
  for (let x = W - 16; x > 4; x -= 10) pasos.push([x, H - 6]);
  for (let y = H - 16; y > 8; y -= 10) pasos.push([4, y]);
  pasos.forEach(([x, y], i) => {
    const on = (i + Math.floor(t * 9)) % 3 === 0, col = ['#35b8e8', '#ffffff', '#a97bf0'][i % 3];
    px(c, x - 1, y - 1, 3, 3, on ? col : '#1b2733'); if (on) { px(c, x, y, 1, 1, '#ffffff'); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 3, y - 3, 7, 7); }
  });
}
function mascotaPNG(c, img, x, y, tam) {
  if (!img?.complete || !img.naturalWidth) return;
  c.save(); c.imageSmoothingEnabled = true; c.drawImage(img, x, y, tam, tam); c.restore();
}
const CIELO = ['#2a1a6e', '#3d2290', '#5a2db0', '#7a3fd1', '#9a4bcf', '#c25bb8', '#e0699e', '#f5837f', '#ff9e6a', '#ffbb6b', '#ffd88a'];
const EDIFICIOS = (() => { const az = semilla(77), v = []; let x = 0; while (x < W) { const w = 10 + Math.floor(az() * 16), h = x > 150 ? 18 + Math.floor(az() * 20) : 26 + Math.floor(az() * 50); v.push([x, w, h, az()]); x += w + (az() < 0.3 ? 2 : 0); } return v; })();
function atardecer(c, t, base = 236) {
  const n = CIELO.length;
  for (let y = 0; y < base; y++) {
    const f = y / base * (n - 1), i = Math.floor(f), fr = f - i;
    for (let x = 0; x < W; x++) px(c, x, y, 1, 1, (fr > 0.5 && (x + y) % 2 === 0) || fr > 0.75 ? CIELO[Math.min(n - 1, i + 1)] : CIELO[i]);
  }
  const sx = 184, sy = base - 30;
  for (let y = -26; y <= 0; y++) for (let x = -26; x <= 26; x++) if (x * x + y * y <= 26 * 26) px(c, sx + x, sy + y, 1, 1, x * x + y * y > 23 * 23 ? '#ffb000' : '#ffe27a');
  for (let k = 0; k < 12; k++) { const a = Math.PI + k * Math.PI / 11 + t * 0.15; for (let r = 30; r < 38; r++) px(c, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 1, 1, 'rgba(255,226,122,.55)'); }
  for (const [x, w, h, s] of EDIFICIOS) {
    px(c, x, base - h, w, h, '#22184f'); px(c, x, base - h, w, 1, '#3d2f7a');
    for (let wy = base - h + 4; wy < base - 4; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (((wx * 7 + wy * 13) % 5 === 0) || (Math.floor(t * 0.7 + wx + wy) % 23 === 0)) px(c, wx, wy, 2, 2, '#ffd27a');
  }
  const ox = 70;
  for (let y = 0; y < 120; y++) { const w = Math.round(lerp(10, 4, y / 120)); px(c, ox - Math.floor(w / 2), base - y, w, 1, y % 30 === 0 ? '#c9c2e6' : '#e8e4f4'); px(c, ox + Math.ceil(w / 2) - 1, base - y, 1, 1, '#b3a9d9'); }
  for (let k = 0; k < 6; k++) px(c, ox - Math.floor((6 - k) / 2), base - 120 - k, 6 - k, 1, '#e8e4f4');
  px(c, ox - 1, base - 112, 2, 2, Math.floor(t * 2) % 2 ? '#ffd27a' : '#8a7fc0');
  const bx = 10, by = base - 64;
  px(c, bx, by, 44, 18, CONTORNO); px(c, bx + 1, by + 1, 42, 16, '#35b8e8'); px(c, bx + 2, by + 2, 40, 14, '#ffffff');
  letrasFilete(c, 'TBF', bx + 5, by + 4, 1, CELESTE7, '#0d2a3a'); pegar(c, CABEZA, bx + 28, by + 3);
  for (let k = 0; k < 3; k++) px(c, bx + 6 + k * 14, by - 2, 3, 1, Math.floor(t * 3 + k) % 2 ? '#fff4c2' : '#5a4a2a');
  px(c, bx + 8, by + 18, 2, 6, '#22184f'); px(c, bx + 34, by + 18, 2, 6, '#22184f');
}

const seis = (n) => String(Math.round(Math.max(0, n))).padStart(6, '0');

/** Tres filas fijas de la 9 de Julio, abajo del inicio. */
const CONVOY = [
  { t: 'calle', i: 0, red: true, veh: [['tbf-celeste', 0], ['tbf-violeta', 190]], dir: 1, vel: 40, bloq: new Set(), cajas: [] },
  { t: 'calle', i: 1, veh: [['colectivo-64', 40], ['torino', 240]], dir: -1, vel: 34, bloq: new Set(), cajas: [] },
  { t: 'vereda', i: 2, amarillo: true, obst: [], bloq: new Set(), cajas: [] }
];
function convoy(c, t, y0) {
  CONVOY.forEach((k, i) => { pisoBase(c, k, y0 + i * CEL, CONVOY[i - 1]?.t, CONVOY[i + 1]?.t); pisoVivo(c, k, y0 + i * CEL, t, CONVOY[i - 1]?.t); });
  CONVOY.forEach((k, i) => cosasDeFila(c, k, y0 + i * CEL, t, { xVehiculo, xTronco, tMs: t * 1000 }));
}

/**
 * Arma de entrada todo lo que va al cache —los 21 vehiculos, los conventillos, los
 * galpones, las letras de los carteles prendidas y apagadas, los arboles—, asi la
 * primera vez que aparece cada cosa no traba un cuadro en plena partida. Se llama
 * una vez, con la pantalla de inicio.
 */
export function precalentar() {
  const c = lienzo(ANCHO, 120).getContext('2d');
  const fila = (k) => ({ i: 0, bloq: new Set(), cajas: [], obst: [], ...k });
  for (const nombre of Object.keys(MODELOS)) vehiculo(c, nombre, 0, 60, 1, 0);
  for (const t of [0, 1]) {
    for (let i = 0; i < 6; i++) cosasDeFila(c, fila({ t: 'boca', i, boca: [0, 1, 2, 3, 4, 5, 6, 7, 8], murales: [[0, 'chapa'], [3, 'neon']] }), 60, t, {});
    for (let color = 0; color < 4; color++) cosasDeFila(c, fila({ t: 'galpones', galpones: [[0, 3, color], [4, 2, color]], murales: [[0, 'senal']] }), 60, t, {});
    cosasDeFila(c, fila({ t: 'vereda', obst: [[0, 'arbol'], [2, 'jacaranda']] }), 60, t / 1.2, {});
  }
}

export function dibujarInicio(c, t, { hi = 0, imagenes = {} } = {}) {
  px(c, 0, 0, W, H, '#000');
  atardecer(c, t, 236);
  const ty = Math.round(Math.sin(t * 2) * 2);
  centro(c, 'CRUZÁ,', 20 + ty + 4, '#3d1f7a', 4); centro(c, 'CRUZÁ,', 20 + ty, CROMO7, 4);
  centro(c, 'MONO', 54 + ty + 4, '#3d1f7a', 4); centro(c, 'MONO', 54 + ty, CROMO7, 4);
  mascotaPNG(c, imagenes.joystick, 54, 124 + Math.round(Math.sin(t * 3) * 2), 112);
  px(c, 0, 236, W, 26, '#000');
  texto(c, 'HI-SCORE', 30, 240, '#c9a8ff'); texto(c, seis(hi), 140, 240, '#ffffff');
  if (Math.floor(t * 2.2) % 2 === 0) centro(c, 'TOCÁ PARA JUGAR', 252, '#8fdcf7');
  c.save(); c.beginPath(); c.rect(8, 262, W - 16, 70); c.clip();
  convoy(c, t, 262);
  c.restore();
  marquesina(c, t);
}

function boton(c, x, y, w, rotulo, principal) {
  if (principal) { px(c, x, y, w, 16, '#35b8e8'); px(c, x, y + 16, w, 3, '#1f86ad'); px(c, x + 2, y + 1, w - 4, 1, '#8fdcf7'); centroEn(c, rotulo, x, w, y + 5, '#06202c'); }
  else { px(c, x, y, w, 16, '#202a36'); px(c, x, y + 16, w, 3, '#0d1218'); centroEn(c, rotulo, x, w, y + 5, '#ffffff'); }
}
function caer(t, periodo = 5) { const a = mod(t, periodo); if (a < 0.5) return -80 * (1 - a / 0.5); return Math.round(Math.abs(Math.sin((a - 0.5) * 10)) * 7 * Math.max(0, 1 - (a - 0.5) * 2.2)); }
const confeti = Array.from({ length: 52 }, (_, i) => ({ x: (i * 47) % W, v: 18 + (i * 13) % 22, f: (i * 0.37) % 1, col: ['#74c7ff', '#ffffff', '#a97bf0', '#74c7ff', '#ffd21f', '#c9a8ff'][i % 6], w: 1 + (i % 2) }));

/**
 * El final: GAME OVER con "¡QUE MACANA!", o "¡SOS UN CRACK!" si el servidor dijo que es
 * record. Sin senal, se dice que el record no se guardo. tFin son los segundos desde el
 * final: lo que cae y lo que cuenta arranca ahi.
 */
export function dibujarFin(c, t, { score = 0, hi = 0, filas = 0, cajas = 0, nuevoRecord = false, guardado, imagenes = {}, quieto = false, tFin = t } = {}) {
  const [otra, salir] = BOTONES.fin;
  px(c, 0, 0, W, H, '#000');
  if (nuevoRecord) {
    if (!quieto) confeti.forEach((q) => { const y = mod(q.f * H + t * q.v, H); const g = Math.floor(t * 6 + q.x) % 2; px(c, q.x + Math.round(Math.sin(t * 3 + q.x) * 3), y, g ? q.w + 1 : 1, g ? 1 : q.w + 1, q.col); });
    const d = caer(tFin, 6);
    centro(c, '¡SOS UN', 18 + d + 4, '#3d1f7a', 3); centro(c, '¡SOS UN', 18 + d, CROMO7, 3);
    centro(c, 'CRACK!', 46 + d + 4, '#3d1f7a', 4); centro(c, 'CRACK!', 46 + d, CROMO7, 4);
    estampa(c, SOL, 18, 96, solCol); estampa(c, SOL, 189, 96, solCol);
    mascotaPNG(c, imagenes.festejo, 54, 84, 108);
    if (Math.floor(t * 3) % 2 === 0) centro(c, '¡NUEVO HI-SCORE!', 196, DEGRADE_VIOLETA);
    centro(c, seis(Math.min(score, Math.floor(tFin * 1600))), 210, '#ffffff', 2);
    texto(c, 'FILAS', 34, 234, '#97a3b3'); texto(c, String(filas), 182 - ancho(String(filas)), 234, '#ffffff');
    texto(c, 'CAJAS', 34, 246, '#97a3b3'); texto(c, String(cajas), 182 - ancho(String(cajas)), 246, '#ffffff');
  } else {
    for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,24,40,${(0.10 * (1 - i / 18)).toFixed(3)})`; c.fillRect(i, i, W - 2 * i, 1); c.fillRect(i, H - 1 - i, W - 2 * i, 1); c.fillRect(i, i, 1, H - 2 * i); c.fillRect(W - 1 - i, i, 1, H - 2 * i); }
    const d = caer(tFin);
    centro(c, 'GAME', 18 + d + 4, '#7a0d14', 4); centro(c, 'GAME', 18 + d, '#ff2e3a', 4);
    centro(c, 'OVER', 52 + d + 4, '#7a0d14', 4); centro(c, 'OVER', 52 + d, '#ff2e3a', 4);
    centro(c, '¡QUÉ MACANA!', 90, '#ffffff');
    mascotaPNG(c, imagenes.rueda, 60, 102, 96);
    const filasDelResumen = [['SCORE', seis(score), '#35b8e8'], ['HI-SCORE', seis(hi), '#c9a8ff'], ['FILAS', String(filas), '#97a3b3'], ['CAJAS', String(cajas), '#97a3b3']];
    filasDelResumen.forEach(([a, b, col], i) => { texto(c, a, 34, 206 + i * 12, col); texto(c, b, 182 - ancho(b), 206 + i * 12, '#ffffff'); });
  }
  if (guardado === false) centro(c, 'SIN SEÑAL: RÉCORD NO GUARDADO', 252, '#ff9e1f');
  boton(c, otra.x, otra.y, otra.w, 'OTRA VEZ', true);
  boton(c, salir.x, salir.y, salir.w, 'SALIR', false);
  if (nuevoRecord) marquesina(c, t);
}
