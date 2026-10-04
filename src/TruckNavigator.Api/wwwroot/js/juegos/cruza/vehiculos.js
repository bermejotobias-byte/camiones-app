/**
 * Los vehiculos de CRUZA, MONO (spec §4.2): el rasterizador de siluetas y los
 * modelos, portados del prototipo aprobado (docs/diseno/prototipo-cruza/escena.js).
 *
 * Cada vehiculo es una grilla de partes (pintura, techo, vidrio, cromo, faros); cada
 * pixel toma luz si arriba hay otra parte y sombra si abajo, y el vacio que toca la
 * silueta es contorno. El lienzo de cada modelo se arma una vez, al primer uso. Lo
 * que no se espeja (el logo TBF, el sol, la cara del mono, el numero de linea) se
 * dibuja aparte en `extra`.
 */

import { lienzo, CONTORNO, mod, lerp, px, brillo, humo, letrasFilete, CELESTE7, BLANCO7, SOL, VOLUTA, estampa, solCol, ancho, texto, CABEZA, pegar } from './sprites.js';

// ================================================================ el rasterizador de siluetas
// Cada vehiculo se describe por partes (pintura, techo, vidrio, cromo...) en una grilla. Despues
// cada pixel toma luz si arriba hay otra parte, sombra si abajo hay otra, y el vacio que toca
// la silueta se pinta de contorno. Asi todos comparten el mismo acabado.
export function construir(L, Hh, pintar) {
  const g = Array.from({ length: Hh }, () => Array(L).fill(null));
  const put = (x, y, m) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < L && y >= 0 && y < Hh) g[y][x] = m; };
  pintar({
    put,
    get: (x, y) => g[y]?.[x],
    rect: (x, y, w, h, m) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, m); },
    perfil: (x0, x1, arriba, abajo, m) => { for (let x = x0; x <= x1; x++) for (let y = Math.round(arriba(x)); y <= abajo; y++) put(x, y, m); },
    donde: (cond, m) => { for (let y = 0; y < Hh; y++) for (let x = 0; x < L; x++) if (g[y][x] && cond(x, y, g[y][x])) g[y][x] = m; },
    borrar: (cx, cy, r) => { for (let y = 0; y < Hh; y++) for (let x = 0; x < L; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y][x] = null; }
  });
  return g;
}
export function renderizar(g, pal) {
  const Hh = g.length, L = g[0].length, cv = lienzo(L + 2, Hh + 2);
  const c = cv.getContext('2d');
  for (let y = -1; y <= Hh; y++) for (let x = -1; x <= L; x++) {
    const m = g[y]?.[x];
    if (!m) { if ([g[y - 1]?.[x], g[y + 1]?.[x], g[y]?.[x - 1], g[y]?.[x + 1]].some(Boolean)) px(c, x + 1, y + 1, 1, 1, CONTORNO); continue; }
    const p = pal[m]; if (!p) continue;
    let col = p;
    if (Array.isArray(p)) {
      col = p[0];
      if (g[y - 1]?.[x] !== m && p[1]) col = p[1];
      else if (g[y + 1]?.[x] !== m && p[2]) col = p[2];
    }
    if (m === 'vidrio' && mod(x - y, 9) < 2) col = '#e9f9ff';
    px(c, x + 1, y + 1, 1, 1, col);
  }
  return cv;
}
const VIDRIO = ['#5cc4ff', '#bdeeff', '#2c88cc'];
const CROMO = ['#e3ebf3', '#ffffff', '#8d99a8'];
const NEGRO = ['#2b2a35', '#4a4958', '#16151d'];
const PLAST = ['#33333d', '#4c4c58', '#1d1d24'];

// --- las llantas giran
function rueda(c, cx, cy, r, t, giro) {
  const n = Math.ceil(r);
  for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) {
    const d2 = dx * dx + dy * dy; if (d2 > r * r + 0.6) continue;
    let col = '#1b1a22';
    if (d2 > (r - 0.9) ** 2) col = '#0d0c12';
    else if (d2 <= (r - 1.8) ** 2) col = d2 <= 1 ? '#6b7685' : '#cfd8e3';
    if (dy < 0 && d2 <= (r - 1.8) ** 2 && d2 > 1) col = '#eef3f8';
    px(c, cx + dx, cy + dy, 1, 1, col);
  }
  const a = t * giro / Math.max(r, 1);
  for (const f of [0, Math.PI]) px(c, Math.round(cx + Math.cos(a + f) * (r - 2.2)), Math.round(cy + Math.sin(a + f) * (r - 2.2)), 1, 1, '#4a5463');
}

// ================================================================ los vehiculos
export const MODELOS = {};
function modelo(nombre, def) { MODELOS[nombre] = def; }
function imagenDe(def) { return def.cv ??= renderizar(construir(def.L, def.H, def.pintar), def.pal); }
// pasa una coordenada de la grilla del vehiculo al lienzo, segun el sentido
function aLienzo(def, x, y, dir, gx, gy, w = 1) { return [dir > 0 ? x + gx : x + def.L - gx - w, y - def.arriba + gy]; }
export function vehiculo(c, nombre, x, y, dir, t, vel = 30) {
  const def = MODELOS[nombre], im = imagenDe(def);
  px(c, x + 3, y + 20, def.L - 6, 3, 'rgba(10,8,30,.28)');
  const oy = y - def.arriba - 1;
  if (dir > 0) c.drawImage(im, x - 1, oy);
  else { c.save(); c.translate(x - 1 + im.width, oy); c.scale(-1, 1); c.drawImage(im, 0, 0); c.restore(); }
  for (const [gx, gy, r] of def.ruedas) { const [rx, ry] = aLienzo(def, x, y, dir, gx, gy); rueda(c, rx, ry, r, t, vel * dir); }
  def.extra?.(c, x, y, dir, t, def);
}

const NARANJA = ['#ff7f1f', '#ffb766', '#c95300'];
modelo('torino', {
  L: 50, H: 25, arriba: 0, ruedas: [[11, 20, 4], [39, 20, 4]],
  pal: { pint: NARANJA, techo: ['#2b2633', '#4d465c', '#17141d'], vidrio: VIDRIO, cromo: CROMO, faro: '#fff4c2', stop: '#ff3048' },
  pintar(a) {
    const top = (x) => x < 5 ? 12 : x < 16 ? lerp(12, 5, (x - 5) / 11) : x < 28 ? 5 : x < 33 ? lerp(5, 10, (x - 28) / 5) : x < 47 ? 10 : 11;
    a.perfil(1, 48, top, 19, 'pint');
    a.donde((x, y) => y < 11, 'techo');
    for (let x = 8; x <= 31; x++) for (let y = 7; y <= 10; y++) if (y >= Math.round(top(x)) + 2 && x !== 23 && x !== 24 && a.get(x, y) === 'techo') a.put(x, y, 'vidrio');
    a.rect(3, 14, 44, 1, 'cromo'); a.rect(46, 12, 3, 4, 'cromo'); a.rect(0, 13, 3, 3, 'cromo');
    a.put(47, 11, 'faro'); a.put(48, 11, 'faro'); a.put(1, 11, 'stop'); a.put(1, 12, 'stop');
    a.borrar(11, 20, 5); a.borrar(39, 20, 5);
  }
});
modelo('uno', {
  L: 44, H: 25, arriba: 0, ruedas: [[9, 20, 4], [34, 20, 4]],
  pal: { pint: ['#2fb4ff', '#a3e3ff', '#136fbf'], vidrio: VIDRIO, negro: NEGRO, plast: PLAST, faro: '#fff4c2', stop: '#ff3048' },
  pintar(a) {
    const top = (x) => x < 2 ? 8 : x < 4 ? lerp(8, 4, (x - 2) / 2) : x < 21 ? 4 : x < 28 ? lerp(4, 10, (x - 21) / 7) : x < 42 ? 10 : 11;
    a.perfil(1, 43, top, 19, 'pint');
    for (let x = 4; x <= 27; x++) for (let y = 6; y <= 10; y++) if (y >= Math.round(top(x)) + 1) a.put(x, y, 'vidrio');
    for (let y = 5; y <= 10; y++) { a.put(4, y, 'negro'); a.put(12, y, 'negro'); a.put(19, y, 'negro'); a.put(20, y, 'negro'); }
    a.rect(40, 13, 4, 5, 'plast'); a.rect(0, 13, 3, 5, 'plast'); a.rect(3, 15, 37, 1, 'plast');
    a.put(42, 11, 'faro'); a.put(42, 12, 'faro'); a.rect(1, 9, 1, 4, 'stop');
    a.borrar(9, 20, 5); a.borrar(34, 20, 5);
  }
});
modelo('fitito', {
  L: 38, H: 25, arriba: 0, ruedas: [[8, 20, 4], [29, 20, 4]],
  pal: { pint: ['#ffd21f', '#fff08a', '#d49a00'], vidrio: VIDRIO, cromo: CROMO, negro: NEGRO, faro: '#fff4c2', stop: '#ff3048' },
  pintar(a) {
    const top = (x) => x < 4 ? lerp(13, 8, x / 4) : x < 8 ? lerp(8, 5, (x - 4) / 4) : x < 22 ? 5 : x < 27 ? lerp(5, 10, (x - 22) / 5) : x < 34 ? lerp(10, 12, (x - 27) / 7) : lerp(12, 15, (x - 34) / 3);
    a.perfil(1, 37, top, 19, 'pint');
    for (let x = 6; x <= 25; x++) for (let y = 6; y <= 10; y++) if (y >= Math.round(top(x)) + 1 && x !== 15) a.put(x, y, 'vidrio');
    a.rect(35, 15, 3, 2, 'cromo'); a.rect(0, 15, 2, 2, 'cromo'); a.rect(3, 14, 32, 1, 'cromo');
    a.rect(3, 11, 3, 1, 'negro'); a.rect(3, 13, 3, 1, 'negro');
    a.put(36, 13, 'faro'); a.put(1, 12, 'stop'); a.put(1, 13, 'stop');
    a.borrar(8, 20, 4.6); a.borrar(29, 20, 4.6);
  }
});
function sedan504(pal, taxi) {
  return {
    L: 50, H: 25, arriba: 0, ruedas: [[11, 20, 4], [39, 20, 4]], pal,
    pintar(a) {
      const top = (x) => x < 10 ? 11 : x < 15 ? lerp(11, 5, (x - 10) / 5) : x < 29 ? 5 : x < 34 ? lerp(5, 10, (x - 29) / 5) : x < 48 ? 10 : 11;
      a.perfil(1, 48, top, 19, 'pint');
      if (taxi) a.donde((x, y) => y < 11, 'techo');
      for (let x = 11; x <= 33; x++) for (let y = 6; y <= 10; y++) if (y >= Math.round(top(x)) + 1 && x !== 22) a.put(x, y, 'vidrio');
      a.rect(46, 12, 3, 4, 'cromo'); a.rect(0, 12, 3, 4, 'cromo'); a.rect(3, 15, 44, 1, 'cromo');
      a.put(47, 11, 'faro'); a.put(47, 12, 'faro'); a.rect(1, 11, 1, 3, 'stop');
      if (taxi) a.rect(19, 2, 8, 2, 'cartel');
      a.borrar(11, 20, 5); a.borrar(39, 20, 5);
    }
  };
}
modelo('504', sedan504({ pint: ['#2fd3b8', '#a6f3e6', '#13998a'], vidrio: VIDRIO, cromo: CROMO, faro: '#fff4c2', stop: '#ff3048' }, false));
modelo('taxi', Object.assign(sedan504({ pint: ['#25242e', '#4a4960', '#121119'], techo: ['#ffd21f', '#fff08a', '#d49a00'], vidrio: VIDRIO, cromo: CROMO, faro: '#fff4c2', stop: '#ff3048', cartel: ['#ffffff', '#ffffff', '#c9d3de'] }, true), {
  extra(c, x, y, dir, t, def) { if (Math.floor(t * 2.5) % 2 === 0) { const [lx, ly] = aLienzo(def, x, y, dir, 32, 9); px(c, lx, ly, 1, 1, '#ff2e3a'); px(c, lx, ly - 1, 1, 1, 'rgba(255,46,58,.5)'); } }
}));
// --- los colectivos: seis lineas, cada una con sus colores (de fantasia, no los reales de cada linea)
function mezcla(a, b, f) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
}
const tonos = (h) => [h, mezcla(h, '#ffffff', 0.45), mezcla(h, '#000000', 0.3)];
const LINEAS = {
  152: { arriba: '#ffffff', abajo: '#1f8fff', f1: '#ffd21f', f2: '#a97bf0', filete: '#ffd21f' },
  60: { arriba: '#fff1c9', abajo: '#e8394d', f1: '#7a1426', f2: '#ffd21f', filete: '#ffffff' },
  29: { arriba: '#ffd21f', abajo: '#22a344', f1: '#ffffff', f2: '#ff7f1f', filete: '#ffffff' },
  39: { arriba: '#ffffff', abajo: '#ff7f1f', f1: '#35b8e8', f2: '#1f4fbf', filete: '#ffd21f' },
  64: { arriba: '#7fd6ff', abajo: '#7a4fd6', f1: '#ffffff', f2: '#ffd21f', filete: '#ffffff' },
  12: { arriba: '#ffffff', abajo: '#13b39a', f1: '#1f4fbf', f2: '#ffd21f', filete: '#ff7f1f' }
};
for (const [num, li] of Object.entries(LINEAS)) {
  modelo('colectivo-' + num, {
    L: 96, H: 25, arriba: 0, ruedas: [[14, 20, 5], [80, 20, 5]],
    pal: { pint: tonos(li.abajo), blanco: tonos(li.arriba), vidrio: VIDRIO, negro: NEGRO, f1: li.f1, f2: li.f2, led: '#ffb000', faro: '#fff4c2', stop: '#ff3048' },
    pintar(a) {
      a.perfil(1, 94, (x) => (x < 3 || x > 92) ? 3 : 2, 19, 'pint');
      a.donde((x, y) => y < 11, 'blanco');
      for (let x = 5; x <= 85; x++) for (let y = 4; y <= 9; y++) a.put(x, y, (x - 5) % 9 === 0 ? 'negro' : 'vidrio');
      for (const d of [20, 76]) { a.rect(d, 4, 6, 15, 'vidrio'); a.rect(d, 4, 1, 15, 'negro'); a.rect(d + 5, 4, 1, 15, 'negro'); a.rect(d + 2, 4, 2, 15, 'negro'); a.rect(d + 3, 4, 1, 15, 'vidrio'); }
      a.rect(87, 3, 7, 10, 'vidrio'); a.rect(86, 2, 8, 1, 'led');
      a.rect(1, 11, 93, 1, 'f1'); a.rect(1, 19, 93, 1, 'f2');
      a.rect(93, 15, 3, 4, 'negro'); a.put(94, 13, 'faro'); a.put(1, 12, 'stop'); a.put(1, 13, 'stop');
      a.borrar(14, 20, 6); a.borrar(80, 20, 6);
    },
    extra(c, x, y, dir, t, def) {
      const n = String(num), w = ancho(n);
      const [nx, ny] = aLienzo(def, x, y, dir, 50, 12, w);
      texto(c, n, nx + 1, ny + 1, mezcla(li.abajo, '#000000', 0.55)); texto(c, n, nx, ny, '#ffffff');
      const col = { a: li.filete, b: '#ffffff', c: li.f1 };
      const [v1x, v1y] = aLienzo(def, x, y, dir, 41, 12, 7); estampa(c, VOLUTA, v1x, v1y, col, dir < 0);
      const [v2x, v2y] = aLienzo(def, x, y, dir, 52 + w, 12, 7); estampa(c, VOLUTA, v2x, v2y, col, dir > 0);
      const [cx2, cy2] = aLienzo(def, x, y, dir, 88, 0, 5);
      px(c, cx2, cy2 + 0, 5, 1, Math.floor(t * 2) % 2 ? '#ffe08a' : '#ffb000');
      humo(c, aLienzo(def, x, y, dir, 1, 18)[0], y + 16, -dir, t, (x % 5) / 5, '150,156,168');
    }
  });
}
MODELOS.colectivo = MODELOS['colectivo-152'];

// --- la flota TBF: cabina trompuda, muchos colores
const AZUL7 = ['#c4d3ff', '#9fb8ff', '#6f95ff', '#4d7cff', '#2f6bff', '#2453d6', '#1c44b0'];
const AMARILLO7 = ['#fff6c2', '#fff08a', '#ffe14a', '#ffd21f', '#f2b800', '#d49a00', '#b37f00'];
const LIBREAS = {
  celeste: { caja: tonos('#ffffff'), franja: tonos('#4fc3f7'), cab: tonos('#4fc3f7'), cabtecho: tonos('#ffffff'), letras: CELESTE7, contorno: '#0d2a3a', filete: '#ffd21f' },
  violeta: { caja: tonos('#a97bf0'), franja: tonos('#ffffff'), cab: tonos('#eef2f7'), cabtecho: tonos('#a97bf0'), letras: BLANCO7, contorno: '#3d1f7a', filete: '#ffd21f' },
  naranja: { caja: tonos('#ff7f1f'), franja: tonos('#ffffff'), cab: tonos('#ff7f1f'), cabtecho: tonos('#ffffff'), letras: BLANCO7, contorno: '#7a2e00', filete: '#ffd21f' },
  amarillo: { caja: tonos('#ffd21f'), franja: tonos('#2f6bff'), cab: tonos('#2f6bff'), cabtecho: tonos('#ffd21f'), letras: AZUL7, contorno: '#0b1a4a', filete: '#ffffff' },
  verde: { caja: tonos('#22a344'), franja: tonos('#ffd21f'), cab: tonos('#ffffff'), cabtecho: tonos('#22a344'), letras: AMARILLO7, contorno: '#0b3d19', filete: '#ffffff' },
  rojo: { caja: tonos('#e8394d'), franja: tonos('#ffffff'), cab: tonos('#e8394d'), cabtecho: tonos('#ffffff'), letras: BLANCO7, contorno: '#5c0f1c', filete: '#ffd21f' },
  azul: { caja: tonos('#2f6bff'), franja: tonos('#ffd21f'), cab: tonos('#ffffff'), cabtecho: tonos('#2f6bff'), letras: AMARILLO7, contorno: '#0b1a4a', filete: '#ffffff' },
  jaula: { caja: tonos('#d98a4a'), franja: tonos('#b8692f'), cab: tonos('#a97bf0'), cabtecho: tonos('#ffffff'), letras: CELESTE7, contorno: '#0d2a3a', filete: '#ffd21f' },
  cisterna: { caja: CROMO, franja: tonos('#4fc3f7'), cab: tonos('#4fc3f7'), cabtecho: tonos('#ffffff'), letras: CELESTE7, contorno: '#0d2a3a', filete: '#a97bf0' }
};

for (const [nombre, lib] of Object.entries(LIBREAS)) {
  modelo('tbf-' + nombre, {
    L: 96, H: 29, arriba: 4, ruedas: [[8, 24, 4], [17, 24, 4], [70, 24, 4], [88, 24, 4]],
    pal: { caja: lib.caja, franja: lib.franja, cab: lib.cab, cabtecho: lib.cabtecho, vidrio: VIDRIO, cromo: CROMO, negro: NEGRO, hueco: '#2a1a12', faro: '#fff4c2', stop: '#ff3048', riel: ['#8d99a8', '#c9d3de', '#5f6b7a'] },
    pintar(a) {
      if (nombre === 'cisterna') {
        for (let x = 0; x <= 61; x++) for (let y = 7; y <= 20; y++) {
          const borde = (x < 2 || x > 59) && (y < 9 || y > 18);
          if (!borde) a.put(x, y, 'caja');
        }
        for (const b of [15, 30, 45]) a.rect(b, 7, 1, 14, 'riel');
        a.rect(4, 6, 54, 1, 'riel'); a.rect(2, 17, 58, 1, 'franja'); a.rect(2, 18, 58, 1, 'franja');
      } else if (nombre === 'jaula') {
        a.rect(0, 6, 62, 16, 'caja');
        for (let x = 1; x < 61; x++) for (let y = 9; y <= 19; y++) if (mod(x, 5) >= 3) a.put(x, y, 'hueco');
        a.rect(0, 6, 62, 3, 'franja'); a.rect(0, 13, 62, 1, 'franja'); a.rect(0, 20, 62, 2, 'franja');
      } else {
        a.rect(0, 6, 62, 16, 'caja'); a.rect(0, 6, 62, 2, 'franja'); a.rect(0, 20, 62, 2, 'franja');
      }
      a.rect(2, 22, 64, 1, 'negro'); a.rect(61, 18, 4, 3, 'negro');
      a.rect(62, 0, 2, 11, 'cromo');
      a.perfil(64, 80, (x) => x === 64 ? 9 : x < 66 ? 8 : 7, 22, 'cab');
      a.donde((x, y, m) => m === 'cab' && y <= 8, 'cabtecho');
      a.rect(70, 9, 9, 6, 'vidrio');
      a.perfil(81, 95, (x) => x < 93 ? 13 : x === 93 ? 14 : 15, 22, 'cab');
      a.rect(84, 16, 7, 1, 'negro'); a.rect(84, 18, 7, 1, 'negro');
      a.rect(93, 20, 3, 3, 'cromo'); a.put(95, 16, 'faro'); a.put(95, 17, 'faro');
      a.put(0, 10, 'stop'); a.put(0, 11, 'stop');
      a.borrar(8, 24, 5); a.borrar(17, 24, 5); a.borrar(70, 24, 5); a.borrar(88, 24, 5);
      a.rect(22, 20, 2, 5, 'negro'); a.rect(76, 20, 2, 5, 'negro');
    },
    extra(c, x, y, dir, t, def) {
      const at = (gx, gy, w) => aLienzo(def, x, y, dir, gx, gy, w);
      // luces de galibo en el techo de la cabina
      for (let i = 0; i < 4; i++) { const [lx, ly] = at(67 + i * 3, 6, 2); const on = Math.floor(t * 3 + i) % 2 === 0; px(c, lx, ly, 2, 1, on ? (i % 2 ? '#8fdcf7' : '#ffb000') : '#5a4a2a'); }
      if (nombre === 'jaula') {
        const [tx, ty] = at(22, 1, 17); px(c, tx - 2, ty - 1, 21, 10, '#0d2a3a'); px(c, tx - 1, ty, 19, 8, '#ffffff'); texto(c, 'TBF', tx, ty + 1, '#1f86ad');
        const [mx, my] = at(70, 15, 12); pegar(c, CABEZA, mx, my - 1);
      } else {
        const filete = lib.filete;
        if (nombre !== 'cisterna') for (const fy of [8, 19]) { const [fx, fyy] = at(2, fy, 58); for (let k = 0; k < 58; k++) if (k % 6 !== 5) px(c, fx + k, fyy, 1, 1, filete); }
        const [lx, ly] = at(4, 7, 34);
        letrasFilete(c, 'TBF', lx, ly, 2, lib.letras, lib.contorno);
        const [sx, sy] = at(40, 10, 9); estampa(c, SOL, sx, sy, solCol);
        const [mx, my] = at(50, 9, 12); pegar(c, CABEZA, mx, my);
      }
      if (nombre === 'cisterna') { c.save(); const [bx, by] = at(0, 7, 62); c.beginPath(); c.rect(bx, by, 62, 14); c.clip(); brillo(c, bx, by, 62, 14, t + (x % 7), 3.2, 'rgba(255,255,255,.55)'); c.restore(); }
      const [hx] = at(62, 0, 2); humo(c, hx + 1, y - 6, dir, t, (x % 5) / 5);
    }
  });
}
