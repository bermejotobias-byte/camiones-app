// ================================================================ ayudas de dibujo
const CEL = 24, W = 216, HUD = 28, FILAS = 13, H = HUD + FILAS * CEL;
const mod = (a, b) => ((a % b) + b) % b;
const lerp = (a, b, f) => a + (b - a) * f;
function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
function semilla(n) { let s = (n * 9301 + 49297) % 233280 + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function brillo(c, x0, y0, w, h, t, periodo = 3, color = 'rgba(255,255,255,.55)') {
  const fase = mod(t, periodo) / periodo, banda = fase * (w + h + 20) - 10;
  c.fillStyle = color;
  for (let y = 0; y < h; y++) { const x = Math.round(banda - y); for (let d = 0; d < 3; d++) { const xx = x + d; if (xx >= 0 && xx < w) c.fillRect(x0 + xx, y0 + y, 1, 1); } }
}
function humo(c, xs, ys, dir, t, fase = 0, tono = '205,212,222') {
  for (let k = 0; k < 3; k++) {
    const a = mod(t * 0.9 + k / 3 + fase, 1);
    const r = 2 + Math.floor(a * 3), x = Math.round(xs - dir * a * 6), y = Math.round(ys - a * 16);
    c.fillStyle = `rgba(${tono},${(0.45 * (1 - a)).toFixed(2)})`;
    c.fillRect(x - r + 1, y - r, 2 * r - 1, 2 * r + 1); c.fillRect(x - r, y - r + 1, 2 * r + 1, 2 * r - 1);
    c.fillStyle = `rgba(255,255,255,${(0.25 * (1 - a)).toFixed(2)})`; c.fillRect(x - r + 1, y - r + 1, r, 1);
  }
}

// --- letras de fileteado: contorno, relleno en degradé por fila y brillo blanco arriba de cada trazo
function letrasFilete(c, s, x, y, k, relleno, contorno, luz = '#ffffff') {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [2, 2], [1, 2], [2, 1]]) texto(c, s, x + dx, y + dy, contorno, k);
  texto(c, s, x, y, relleno, k);
  let cx = x;
  for (const ch of s) {
    const g = F[ch] || F[' '];
    g.forEach((fila, j) => [...fila].forEach((p, i) => { if (p === '#' && (j === 0 || g[j - 1][i] !== '#')) px(c, cx + i * k, y + j * k, k, 1, luz); }));
    cx += 6 * k;
  }
}
const CELESTE7 = ['#d4f3ff', '#9fe3ff', '#5fcbf5', '#35b8e8', '#2a9fd0', '#1f86ad', '#176e91'];
const BLANCO7 = ['#ffffff', '#ffffff', '#f3ecff', '#e6d8ff', '#d9c4ff', '#c9a8ff', '#b892ff'];
const VIOLETA7 = ['#ffffff', '#f0e6ff', '#d9c4ff', '#c9a8ff', '#a97bf0', '#8d5fe0', '#c9a8ff'];

// --- estampas: sol de mayo y volutas del fileteado
const SOL = ['....Y....', '.Y..Y..Y.', '..YYYYY..', '..YoooY..', 'YYYoooYYY', '..YoooY..', '..YYYYY..', '.Y..Y..Y.', '....Y....'];
const VOLUTA = ['..aaa..', '.a...a.', 'a..cc.a', 'a.c..a.', 'a.cb.a.', '.a..a..', '..aa...'];
function estampa(c, filas, x, y, colores, voltear = false) {
  filas.forEach((f, j) => [...f].forEach((p, i) => { if (colores[p]) px(c, x + (voltear ? f.length - 1 - i : i), y + j, 1, 1, colores[p]); }));
}
const solCol = { Y: '#ffd21f', o: '#ff9e1f' };

// ================================================================ el rasterizador de siluetas
// Cada vehiculo se describe por partes (pintura, techo, vidrio, cromo...) en una grilla. Despues
// cada pixel toma luz si arriba hay otra parte, sombra si abajo hay otra, y el vacio que toca
// la silueta se pinta de contorno. Asi todos comparten el mismo acabado.
const CONTORNO = '#170c16';
function construir(L, Hh, pintar) {
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
function renderizar(g, pal) {
  const Hh = g.length, L = g[0].length, cv = document.createElement('canvas');
  cv.width = L + 2; cv.height = Hh + 2;
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
const MODELOS = {};
function modelo(nombre, def) { MODELOS[nombre] = def; }
function imagenDe(def) { return def.cv ??= renderizar(construir(def.L, def.H, def.pintar), def.pal); }
// pasa una coordenada de la grilla del vehiculo al lienzo, segun el sentido
function aLienzo(def, x, y, dir, gx, gy, w = 1) { return [dir > 0 ? x + gx : x + def.L - gx - w, y - def.arriba + gy]; }
function vehiculo(c, nombre, x, y, dir, t, vel = 30) {
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
function plaza(c, y, i, t) {
  px(c, 0, y, W, CEL, '#33c24d');
  for (let x = 0; x < W; x++) for (let yy = 0; yy < CEL; yy++) if ((x * 7 + yy * 13 + i) % 11 === 0) px(c, x, y + yy, 1, 1, '#3ad457');
  const az = semilla(i + 41);
  for (let k = 0; k < 16; k++) { const fx = Math.floor(az() * W), fy = 3 + Math.floor(az() * 18); px(c, fx, y + fy, 2, 1, '#24a33c'); px(c, fx + 1, y + fy - 1, 1, 1, '#24a33c'); }
  for (let k = 0; k < 10; k++) {
    const fx = Math.floor(az() * W), fy = 3 + Math.floor(az() * 18), col = ['#ffffff', '#c9a8ff', '#ffd21f'][k % 3];
    px(c, fx, y + fy, 1, 1, col); if (Math.floor(t * 2 + k) % 3 !== 0) { px(c, fx - 1, y + fy, 1, 1, col); px(c, fx + 1, y + fy, 1, 1, col); px(c, fx, y + fy - 1, 1, 1, col); }
  }
  for (let k = 0; k < 8; k++) px(c, Math.floor(az() * W), y + Math.floor(az() * CEL), 1, 1, '#b388ff');
}
function playon(c, y, i, t, numero) {
  px(c, 0, y, W, CEL, '#68707f');
  for (let x = 0; x < W; x++) for (let yy = 0; yy < CEL; yy++) if ((x * 5 + yy * 3) % 13 === 0) px(c, x, y + yy, 1, 1, '#737b8b');
  for (let x = 12; x < W; x += 48) px(c, x, y + 2, 2, CEL - 4, '#35b8e8');
  texto(c, 'TBF', 66, y + 5, '#4f8fb0', 2);
  if (numero) texto(c, String(numero), 118, y + 9, Math.floor(t * 2) % 2 ? CROMO7 : '#4f8fb0');
}
function rio(c, y, i, dir, t, arriba, abajo) {
  px(c, 0, y, W, CEL, '#1668ff');
  for (let x = 0; x < W; x += 2) for (let yy = (x / 2 + i) % 2; yy < CEL; yy += 4) px(c, x, y + yy, 1, 1, '#1d78ff');
  for (let k = 0; k < 12; k++) {
    const x = mod(k * 41 + dir * t * 10, W + 20) - 10, yy = 3 + (k * 7) % 17;
    px(c, x, y + yy, 6, 1, '#58c6ff'); px(c, x + 2, y + yy - 1, 2, 1, '#d8f4ff');
  }
  if (arriba !== 'rio') { px(c, 0, y, W, 2, '#0b3fa8'); px(c, 0, y + 2, W, 1, '#4fb0ff'); }
  if (abajo !== 'rio') px(c, 0, y + CEL - 2, W, 2, '#0b3fa8');
}

// ================================================================ el barrio
function sombra(c, x, y, w, h = 3) { px(c, x, y, w, h, 'rgba(10,8,30,.28)'); }
function arbol(c, x, y, t, i = 0, jac = false) {
  const sway = Math.floor(t * 1.2 + i) % 2;
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
function conventillo(c, x, y, i) {
  const [base, osc] = COLORES_BOCA[i % COLORES_BOCA.length], top = y - 22;
  sombra(c, x + 1, y + 19, 22, 4);
  px(c, x, top + 2, 24, 40, CONTORNO);
  chapa(c, x + 1, top + 6, 22, 35, base, osc);
  px(c, x - 1, top, 26, 6, CONTORNO); px(c, x, top + 1, 24, 4, i % 2 ? '#c94f3a' : '#5f6b7a'); for (let k = 0; k < 24; k += 3) px(c, x + k, top + 1, 1, 4, 'rgba(0,0,0,.25)');
  px(c, x + 6, top + 10, 12, 10, CONTORNO); px(c, x + 7, top + 11, 10, 8, '#bdeeff'); px(c, x + 7, top + 11, 4, 8, '#2fb14a'); px(c, x + 13, top + 11, 4, 8, '#2fb14a'); px(c, x + 12, top + 11, 1, 8, '#ffffff');
  px(c, x + 3, top + 21, 18, 1, CONTORNO); for (let k = 0; k < 18; k += 3) px(c, x + 3 + k, top + 21, 1, 4, CONTORNO);
  px(c, x + 8, top + 28, 8, 13, CONTORNO); px(c, x + 9, top + 29, 6, 12, i % 2 ? '#8a4f22' : '#3d1f7a'); px(c, x + 13, top + 35, 1, 1, '#ffd21f');
}
// --- el cartel de la app: copete fileteado, marco de cromo, estructura de hierro, lamparas
// y avisos en tablillas giratorias (tri-vision)
const AV_W = 84, AV_H = 27;
const avisoLienzo = [0, 1].map(() => { const cv = document.createElement('canvas'); cv.width = AV_W; cv.height = AV_H; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; return { cv, c }; });
function fondoBandas(c, cols) { const h = AV_H / cols.length; cols.forEach((col, i) => px(c, 0, Math.round(i * h), AV_W, Math.ceil(h) + 1, col)); }
const AVISOS = [
  (c, t) => {                                                                   // TBF · tu GPS de ruta
    fondoBandas(c, ['#bfeeff', '#d4f3ff', '#e6f8ff', '#f2fbff', '#ffffff']);
    for (const [nx, ny] of [[44, 3], [70, 6]]) { px(c, nx, ny, 9, 2, '#ffffff'); px(c, nx + 2, ny - 1, 5, 1, '#ffffff'); }
    pegar(c, CABEZA, 3, 2, { k: 2 });
    letrasFilete(c, 'TBF', 31, 3, 2, CELESTE7, '#0d2a3a');
    texto(c, 'TU GPS', 32, 19, '#7650c9');
    const b = Math.floor(t * 3) % 2;
    px(c, 74, 15 - b, 7, 7, '#1f86ad'); px(c, 75, 14 - b, 5, 9, '#1f86ad'); px(c, 76, 22 - b, 3, 2, '#1f86ad'); px(c, 77, 24 - b, 1, 1, '#1f86ad');
    px(c, 76, 16 - b, 3, 3, '#ffffff');
    for (let k = 0; k < 6; k++) px(c, 70 - k * 4, 25 - (k % 2), 2, 1, '#35b8e8');
  },
  (c, t) => {                                                                   // bajatela gratis
    fondoBandas(c, ['#5a33a8', '#6a3cc0', '#7a4fd6', '#8d5fe0', '#a97bf0']);
    px(c, 4, 2, 16, 24, '#0d0c18'); px(c, 5, 3, 14, 22, '#1b1a2e'); px(c, 6, 5, 12, 17, '#bfeeff');
    px(c, 6, 5, 12, 17, '#d4f3ff'); for (let k = 0; k < 4; k++) px(c, 6, 7 + k * 4, 12, 1, '#ffffff');
    px(c, 10, 5, 1, 17, '#ffffff'); px(c, 14, 5, 1, 17, '#ffffff'); px(c, 8, 9, 3, 3, '#7be08a'); px(c, 13, 15, 3, 4, '#7be08a');
    const pr = mod(t * 0.8, 1); for (let k = 0; k < 12; k++) px(c, 7 + Math.round(k * 0.8), 20 - k, 2, 1, '#35b8e8');
    px(c, 7 + Math.round(pr * 12 * 0.8), 20 - Math.round(pr * 12), 2, 2, '#ff7f1f');
    px(c, 10, 23, 4, 1, '#3a3958');
    texto(c, '¡BAJATELA', 25, 5, '#2a1660'); texto(c, '¡BAJATELA', 24, 4, '#ffffff');
    texto(c, 'GRATIS!', 31, 16, '#2a1660'); texto(c, 'GRATIS!', 30, 15, '#ffd21f');
  },
  (c, t) => {                                                                   // ruta libre con TBF
    fondoBandas(c, ['#ffd88a', '#ffc27a', '#ffad6b', '#ff9e6a', '#f5837f']);
    estampa(c, SOL, 72, 2, solCol);
    px(c, 0, 20, AV_W, 7, '#3a3e4f'); for (let x = mod(-t * 30, 10) - 10; x < AV_W; x += 10) px(c, x, 23, 5, 1, '#f4f4f4');
    const tx = Math.round(mod(t * 26, AV_W + 30) - 30);
    px(c, tx, 13, 18, 8, CONTORNO); px(c, tx + 1, 14, 16, 6, '#ffffff'); texto(c, 'TBF', tx + 1, 13, '#1f86ad');
    px(c, tx + 18, 15, 7, 6, CONTORNO); px(c, tx + 19, 16, 5, 4, '#35b8e8'); px(c, tx + 22, 16, 2, 2, '#bfeeff');
    for (const wx of [3, 12, 21]) { px(c, tx + wx, 20, 3, 3, '#0d0c12'); px(c, tx + wx + 1, 21, 1, 1, '#cfd8e3'); }
    texto(c, 'RUTA LIBRE', 4, 2, '#3d1f7a');
    texto(c, 'CON TBF', 13, 11 - 0, '#1f4a5c');
  },
  (c, t) => {                                                                   // suma EXP manejando
    fondoBandas(c, ['#0d1640', '#121d52', '#172668', '#1d2f7a', '#22388a']);
    for (let k = 0; k < 9; k++) { const sx = (k * 37) % AV_W, sy = (k * 13) % 12; if (Math.floor(t * 3 + k) % 3) px(c, sx, sy, 1, 1, '#ffffff'); }
    estampa(c, ['..a..', '.aaa.', 'aaaaa', '.aaa.', '.a.a.'], 4, 4, { a: '#c9a8ff' });
    texto(c, 'SUMÁ EXP', 12, 2, '#ffffff');
    texto(c, 'MANEJANDO', 12, 11, '#c9a8ff');
    const lleno = Math.round(mod(t * 0.4, 1) * 64);
    px(c, 10, 20, 66, 6, '#0b0f2a'); px(c, 11, 21, 64, 4, '#26305a');
    const barra = ['#ffffff', '#8fdcf7', '#35b8e8', '#a97bf0'];
    barra.forEach((col, i) => px(c, 11, 21 + i, lleno, 1, col));
    if (lleno > 2) px(c, 11 + lleno - 2, 21, 2, 4, '#ffffff');
  }
];
function cartel(c, x, y, t, fase = 0) {
  const top = y - 40;
  sombra(c, x + 8, y + 19, 82, 4);
  // estructura de hierro: dos columnas, cruces y placas de base
  for (const p of [20, 72]) { px(c, x + p, top + 46, 5, y + 21 - (top + 46), CONTORNO); px(c, x + p + 1, top + 46, 3, y + 21 - (top + 46), '#8d99a8'); px(c, x + p + 1, top + 46, 1, y + 21 - (top + 46), '#c9d3de'); px(c, x + p - 2, y + 19, 9, 2, '#5f6b7a'); }
  for (let k = 0; k <= 46; k++) { const yy = top + 48 + Math.round(k * (y + 16 - top - 48) / 46); px(c, x + 25 + k, yy, 1, 1, '#5f6b7a'); px(c, x + 71 - k, yy, 1, 1, '#5f6b7a'); }
  // pasarela con baranda y lamparas que alumbran hacia arriba
  px(c, x + 4, top + 44, 88, 3, CONTORNO); px(c, x + 5, top + 45, 86, 1, '#8d99a8');
  for (let k = 6; k < 92; k += 6) px(c, x + k, top + 41, 1, 3, '#5f6b7a');
  px(c, x + 5, top + 41, 86, 1, '#5f6b7a');
  // marco: contorno, cromo celeste en bandas, filete amarillo
  px(c, x + 1, top + 6, 94, 38, CONTORNO);
  [['#d4f3ff', 0], ['#7fdcff', 1], ['#35b8e8', 2], ['#1f86ad', 3]].forEach(([col, i]) => { px(c, x + 2 + i, top + 7 + i, 92 - 2 * i, 36 - 2 * i, col); });
  px(c, x + 6, top + 11, 84, 28, CONTORNO);
  // los avisos, con tablillas que giran
  const per = 4, n = Math.floor((t + fase) / per) % AVISOS.length, f = mod(t + fase, per);
  const prev = (n + AVISOS.length - 1) % AVISOS.length;
  const [A, B] = avisoLienzo;
  AVISOS[n](A.c, t); AVISOS[prev](B.c, t);
  const dx = x + 6, dy = top + 12, sl = 7, n_sl = AV_W / sl;
  for (let i = 0; i < n_sl; i++) {
    const p = Math.max(0, Math.min(1, (f - i * 0.035) / 0.35)), ang = p * Math.PI;
    const src = ang < Math.PI / 2 ? B.cv : A.cv, ww = Math.max(1, Math.round(sl * Math.abs(Math.cos(ang))));
    c.drawImage(src, i * sl, 0, sl, AV_H, dx + i * sl + Math.floor((sl - ww) / 2), dy, ww, AV_H);
    if (i > 0) px(c, dx + i * sl, dy, 1, AV_H, 'rgba(0,0,0,.12)');
  }
  // filete amarillo con volutas en las cuatro esquinas
  for (let k = 0; k < 84; k++) if (k % 5 !== 4) { px(c, x + 6 + k, top + 10, 1, 1, '#ffd21f'); px(c, x + 6 + k, top + 39, 1, 1, '#ffd21f'); }
  const vol = { a: '#a97bf0', b: '#ffffff', c: '#ffd21f' };
  estampa(c, VOLUTA, x + 1, top + 4, vol); estampa(c, VOLUTA, x + 88, top + 4, vol, true);
  estampa(c, VOLUTA.slice().reverse(), x + 1, top + 38, vol); estampa(c, VOLUTA.slice().reverse(), x + 88, top + 38, vol, true);
  // copete fileteado con el sol de mayo
  px(c, x + 34, top + 2, 28, 6, CONTORNO); px(c, x + 35, top + 3, 26, 4, '#35b8e8'); px(c, x + 35, top + 3, 26, 1, '#d4f3ff');
  for (let k = 0; k < 26; k += 3) px(c, x + 35 + k, top + 5, 1, 1, '#ffffff');
  estampa(c, VOLUTA, x + 26, top + 1, vol, true); estampa(c, VOLUTA, x + 63, top + 1, vol);
  estampa(c, SOL, x + 44, top - 3, solCol);
  // lamparas sobre la pasarela, con su luz hacia el aviso
  for (let k = 0; k < 3; k++) {
    const lx = x + 18 + k * 28, on = Math.floor(t * 2 + k + fase) % 5 !== 0;
    px(c, lx, top + 45, 7, 4, CONTORNO); px(c, lx + 1, top + 45, 5, 1, on ? '#fff4c2' : '#8d99a8'); px(c, lx + 2, top + 49, 3, 2, '#5f6b7a');
    if (on) { c.fillStyle = 'rgba(255,244,194,.13)'; for (let r = 0; r < 8; r++) c.fillRect(lx - r, top + 44 - r, 7 + 2 * r, 1); }
  }
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
function mono(c, x, y, t, { vista = 'atras', salto = 0, alto = 0, invisible = false } = {}) {
  sombraMono(c, x, y, alto);
  if (invisible) return;
  const estira = salto > 0 && salto < 0.35 ? 1 : salto > 0.8 ? -1 : 0;
  const yy = y - alto;
  if (vista === 'atras') { cola(c, x, yy, t); pegar(c, MONO_ATRAS, x, yy - estira, { alto: 24 + estira }); }
  if (vista === 'frente') { const parp = mod(t, 3) < 0.14; pegar(c, parp ? MONO_PARPADEO : MONO_FRENTE, x, yy - estira, { alto: 24 + estira }); }
  if (vista === 'der') pegar(c, MONO_LADO, x, yy - estira, { alto: 24 + estira });
  if (vista === 'izq') pegar(c, MONO_LADO, x, yy - estira, { voltear: true });
}
function estrellas(c, x, y, t) {
  for (let k = 0; k < 3; k++) {
    const a = t * 5 + k * 2.1, sx = x + 12 + Math.cos(a) * 9, sy = y + 13 + Math.sin(a) * 3;
    const col = ['#ffffff', '#8fdcf7', '#ffd21f'][k];
    px(c, sx, sy - 1, 1, 3, col); px(c, sx - 1, sy, 3, 1, col);
  }
}
function chapuzon(c, x, y, t) {
  const a = mod(t, 1.2) / 1.2;
  for (let ring = 0; ring < 2; ring++) {
    const f = (a + ring * 0.5) % 1, r = 3 + f * 10;
    c.fillStyle = `rgba(216,244,255,${(1 - f).toFixed(2)})`;
    for (let g = 0; g < 360; g += 12) { const rad = g * Math.PI / 180; c.fillRect(Math.round(x + 12 + Math.cos(rad) * r), Math.round(y + 16 + Math.sin(rad) * r * 0.45), 1, 1); }
  }
  pegar(c, GORRA, x + 7, y + 13 + (Math.floor(t * 3) % 2));
}
function cajaTBF(c, x, y, t, conHalo = true) {
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
function tronco(c, x, y, n, t, i = 0) {
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

// ================================================================ el HUD
let marcadorVisible = 1240;
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
    pegar(c, mod(t + i * 1.1, 4) < 0.15 ? CABEZA_GUIÑO : CABEZA, x, y);
  }
  px(c, 0, HUD - 3, W, 1, '#d4f3ff'); px(c, 0, HUD - 2, W, 1, '#35b8e8'); px(c, 0, HUD - 1, W, 1, '#1f86ad');
  brillo(c, 0, HUD - 3, W, 3, t, 4, 'rgba(255,255,255,.8)');
}

// ================================================================ la escena, dibujada de atras para adelante
const CARRILES = [
  { t: 'vereda', obst: [[1, 'arbol'], [5, 'contenedor'], [7, 'jacaranda']], petalos: true },
  { t: 'vereda', boca: [0, 1, 3, 4, 6, 8] },
  { t: 'rio', dir: -1, vel: 20, n: 3, xs: [30, 190] },
  { t: 'rio', dir: 1, vel: 11, n: 4, xs: [16, 170], cajaEn: 0 },
  { t: 'playon', obst: [[0, 'bolardo'], [8, 'bolardo'], [6, 'mastil']], numero: 50 },
  { t: 'calle', red: true, veh: [['tbf-naranja', 10]], dir: 1, vel: 28 },
  { t: 'calle', veh: [['torino', 40], ['uno', 200]], dir: -1, vel: 40, mancha: 150 },
  { t: 'calle', senda: [84, 128], veh: [['fitito', 0], ['taxi', 170]], dir: 1, vel: 46, cajas: [4] },
  { t: 'calle', red: true, veh: [['tbf-celeste', 40]], dir: -1, vel: 26 },
  { t: 'plaza', obst: [[2, 'jacaranda'], [5, 'mate']], cajas: [3] },
  { t: 'vereda', obst: [[0, 'arbol'], [2, 'contenedor'], [7, 'arbol']], amarillo: true, petalos: true },
  { t: 'calle', adoquin: true, veh: [['504', 60], ['colectivo-60', 210]], dir: 1, vel: 30 },
  { t: 'vereda', obst: [[5, 'cartel'], [1, 'arbol'], [3, 'contenedor']] }
];
const P = W + 130;
const pos = (x0, dir, vel, t) => mod(x0 + dir * vel * t, P) - 110;
function suelo(c, carriles, y0, t) {
  carriles.forEach((k, i) => {
    const y = y0 + i * CEL, arr = carriles[i - 1]?.t, aba = carriles[i + 1]?.t;
    if (k.t === 'calle') asfalto(c, y, i, arr, aba, k);
    if (k.t === 'vereda') vereda(c, y, i, arr, aba, t, k);
    if (k.t === 'plaza') plaza(c, y, i, t);
    if (k.t === 'playon') playon(c, y, i, t, k.numero);
    if (k.t === 'rio') rio(c, y, i, k.dir, t, arr, aba);
  });
}
function cosas(c, k, i, y, t, tomadas) {
  (k.boca || []).forEach((col, j) => conventillo(c, col * CEL, y, j + i));
  (k.obst || []).forEach(([col, que], j) => {
    const x = col * CEL;
    if (que === 'arbol') arbol(c, x, y, t, i + j);
    if (que === 'jacaranda') arbol(c, x, y, t, i + j, true);
    if (que === 'contenedor') contenedor(c, x, y);
    if (que === 'banco') banco(c, x, y);
    if (que === 'mate') banco(c, x, y, true);
    if (que === 'bolardo') bolardo(c, x, y);
    if (que === 'mastil') mastil(c, x, y, t);
    if (que === 'cartel') cartel(c, x, y, t, i);
  });
  (k.cajas || []).forEach((col) => { if (!tomadas.has(i + ':' + col)) cajaTBF(c, col * CEL, y, t); });
  if (k.t === 'rio') k.xs.forEach((x0, j) => {
    const x = Math.round(pos(x0, k.dir, k.vel, t));
    tronco(c, x, y, k.n, t, i * 3 + j);
    if (k.cajaEn === j) cajaTBF(c, x + CEL, y - 1, t, false);
  });
  if (k.t === 'calle') k.veh.forEach(([nombre, x0]) => vehiculo(c, nombre, Math.round(pos(x0, k.dir, k.vel, t)), y, k.dir, t, k.vel));
}
function campo(c, t, carriles = CARRILES, y0 = HUD, { tomadas = new Set(), filaMono = -1, dibujarMono } = {}) {
  suelo(c, carriles, y0, t);
  carriles.forEach((k, i) => {
    cosas(c, k, i, y0 + i * CEL, t, tomadas);
    if (i === filaMono && dibujarMono) dibujarMono();
  });
}

// ================================================================ lienzos y bucle
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animadores = [];
function lienzo(id, w, h, dibujar) {
  const el = document.getElementById(id); el.width = w; el.height = h;
  el.style.width = (w * Number(el.dataset.k || 2)) + 'px';
  const c = el.getContext('2d'); c.imageSmoothingEnabled = false;
  const a = { el, c, dibujar, visible: true }; animadores.push(a);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { a.visible = e.isIntersecting; }).observe(el);
  return a;
}
let t0 = performance.now();
function bucle(ahora) {
  const t = (ahora - t0) / 1000;
  for (const a of animadores) if (a.visible) { a.c.save(); a.dibujar(a.c, t); a.c.restore(); }
  if (!quieto) requestAnimationFrame(bucle);
}

// --- la maqueta principal
const estado = { vidas: 3, score: 1240, hi: 3850, golpe: -1, salto: -1, col: 4, desde: 4, hacia: 4, particulas: [], tomadas: new Set(), tiempo: 0, congelado: 0 };
const FILA_MONO = 10;
const DEGRADE_VIOLETA = ['#ffffff', '#f0e6ff', '#d9c4ff', '#c9a8ff', '#a97bf0', '#8d5fe0', '#c9a8ff'];
lienzo('escena', W, H, (c, t) => {
  estado.tiempo = t;
  const g = estado.golpe < 0 ? -1 : t - estado.golpe;
  const congelado = g >= 0 && g < 0.9;
  if (congelado && !estado.congelado) estado.congelado = t;
  if (!congelado) estado.congelado = 0;
  const tm = congelado ? estado.congelado : t;
  marcadorVisible += (estado.score - marcadorVisible) * 0.18;
  const sac = congelado && !quieto && g < 0.32 ? (Math.floor(g * 40) % 2 ? 2 : -2) : 0;
  px(c, 0, 0, W, H, '#000');
  c.save(); c.translate(sac, 0);
  const my = HUD + FILA_MONO * CEL;
  let mx = estado.col * CEL, alto = 0, vista = 'atras', s = 0;
  if (estado.salto >= 0) {
    s = Math.min(1, (t - estado.salto) / 0.14);
    mx = (estado.desde + (estado.hacia - estado.desde) * s) * CEL;
    alto = Math.round(Math.sin(s * Math.PI) * 6);
    vista = estado.hacia > estado.desde ? 'der' : 'izq';
    if (s >= 1) { estado.salto = -1; estado.col = estado.hacia; polvo(mx, my); }
  }
  campo(c, tm, CARRILES, HUD, {
    tomadas: estado.tomadas, filaMono: FILA_MONO, dibujarMono: () => {
      if (congelado) { pegar(c, MONO_GOLPE, mx, my); estrellas(c, mx, my + 6, t); return; }
      const invul = g >= 0.9 && g < 2.4 && estado.vidas > 0;
      mono(c, mx, my, t, { vista, salto: s, alto, invisible: invul && Math.floor(g * 10) % 2 === 0 });
    }
  });
  estado.particulas = estado.particulas.filter((p) => t - p.t0 < p.vida);
  for (const p of estado.particulas) {
    const a = (t - p.t0) / p.vida;
    if (p.texto) { letrasFilete(c, p.texto, p.x, Math.round(p.y - a * 16), 2, DEGRADE_VIOLETA, '#3d1f7a'); continue; }
    px(c, p.x + p.vx * a * 30, p.y + p.vy * a * 30 + (p.g ? a * a * 10 : 0), p.s, p.s, p.col);
  }
  if (congelado) {
    const on = quieto ? g < 0.6 : [0, 0.18, 0.36].some((s0) => g >= s0 && g < s0 + 0.1);
    if (on) px(c, 0, HUD, W, H - HUD, 'rgba(255,24,40,.55)');
  }
  c.restore();
  hud(c, marcadorVisible, estado.hi, estado.vidas, t, g);
  if (estado.vidas === 0 && g >= 0.9) {
    px(c, 0, HUD, W, H - HUD, 'rgba(0,0,0,.8)');
    const caida = Math.min(1, (g - 0.9) / 0.5), rebote = caida < 1 ? -60 * (1 - caida) : Math.round(Math.abs(Math.sin((g - 1.4) * 9)) * 6 * Math.max(0, 1 - (g - 1.4) * 2));
    centro(c, 'GAME', 110 + rebote + 3, '#7a0d14', W, 4); centro(c, 'GAME', 110 + rebote, '#ff2e3a', W, 4);
    centro(c, 'OVER', 144 + rebote + 3, '#7a0d14', W, 4); centro(c, 'OVER', 144 + rebote, '#ff2e3a', W, 4);
    centro(c, '¡QUÉ MACANA!', 186, '#ffffff', W);
    if (Math.floor(t * 2) % 2) centro(c, 'TOCÁ REPONER', 206, '#97a3b3', W);
  }
});
function polvo(x, y) {
  for (let k = 0; k < 6; k++) estado.particulas.push({ x: x + 12, y: y + 21, vx: (k - 2.5) * 0.25, vy: -0.08, s: 1, col: 'rgba(255,255,255,.85)', vida: 0.3, t0: estado.tiempo });
}
document.getElementById('b-saltar').addEventListener('click', () => {
  if (estado.salto >= 0 || estado.vidas === 0) return;
  estado.desde = estado.col; estado.hacia = estado.col >= 5 ? estado.col - 1 : estado.col <= 3 ? estado.col + 1 : estado.col + (Math.random() < 0.5 ? -1 : 1);
  estado.salto = estado.tiempo;
});
document.getElementById('b-caja').addEventListener('click', () => {
  if (estado.vidas === 0) return;
  const x = estado.col * CEL, y = HUD + FILA_MONO * CEL;
  estado.score += 50;
  estado.particulas.push({ texto: '+50', x: x - 6, y: y - 8, vida: 0.7, t0: estado.tiempo });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    estado.particulas.push({ x: x + 12, y: y + 10, vx: Math.cos(a), vy: Math.sin(a) * 0.8, s: 2, col: ['#35b8e8', '#a97bf0', '#ffffff', '#ffd21f'][k % 4], vida: 0.5, t0: estado.tiempo, g: true });
  }
});
document.getElementById('b-golpe').addEventListener('click', () => {
  if (estado.vidas === 0) return;
  if (estado.golpe >= 0 && estado.tiempo - estado.golpe < 0.9) return;
  estado.golpe = estado.tiempo; estado.vidas -= 1;
});
document.getElementById('b-reponer').addEventListener('click', () => { estado.vidas = 3; estado.golpe = -1; estado.score = 1240; marcadorVisible = 1240; });

// --- la mascota
const fondoM = (c, col = '#2f3240') => px(c, 0, 0, 28, 28, col);
lienzo('m-atras', 28, 28, (c, t) => { fondoM(c, '#a3a9b6'); mono(c, 2, 2, t); });
lienzo('m-frente', 28, 28, (c, t) => { fondoM(c, '#a3a9b6'); mono(c, 2, 2, t, { vista: 'frente' }); });
lienzo('m-lado', 28, 28, (c, t) => { fondoM(c, '#a3a9b6'); mono(c, 2, 2, t, { vista: Math.floor(t / 1.5) % 2 ? 'der' : 'izq' }); });
lienzo('m-salto', 28, 28, (c, t) => {
  fondoM(c, '#a3a9b6');
  const s = mod(t, 0.9) / 0.6;
  if (s <= 1) mono(c, 2, 2, t, { salto: s, alto: Math.round(Math.sin(s * Math.PI) * 6) });
  else { mono(c, 2, 2, t, { salto: 0.9 }); const a = (s - 1) * 2; for (let k = 0; k < 4; k++) px(c, 14 + (k - 1.5) * a * 6, 23 - a * 2, 1, 1, '#ffffff'); }
});
lienzo('m-golpe', 28, 28, (c, t) => { fondoM(c); pegar(c, MONO_GOLPE, 2, 2); estrellas(c, 2, 8, t); });
lienzo('m-agua', 28, 28, (c, t) => { px(c, 0, 0, 28, 28, '#1668ff'); for (let x = 0; x < 28; x += 2) for (let y = x / 2 % 2; y < 28; y += 4) px(c, x, y, 1, 1, '#1d78ff'); chapuzon(c, 2, 2, t); });

// --- el barrio
lienzo('calles', W, 5 * CEL + 18, (c, t) => { px(c, 0, 0, W, 18, '#a3a9b6'); campo(c, t, [
  { t: 'vereda', obst: [[0, 'arbol'], [3, 'contenedor'], [7, 'jacaranda']], amarillo: true, petalos: true },
  { t: 'calle', adoquin: true, veh: [['fitito', 30], ['504', 190]], dir: 1, vel: 40 },
  { t: 'calle', red: true, veh: [['tbf-rojo', 80]], dir: -1, vel: 28, mancha: 20 },
  { t: 'calle', senda: [96, 140], veh: [['torino', 20], ['taxi', 200]], dir: 1, vel: 48, cajas: [4] },
  { t: 'plaza', obst: [[2, 'jacaranda'], [6, 'mate']] }
], 18); });
const fondoP = (c, w, h) => { px(c, 0, 0, w, h, '#a3a9b6'); for (let x = 0; x < w; x += 12) for (let y = 0; y < h; y += 12) { px(c, x, y, 12, 1, '#8c93a1'); px(c, x, y, 1, 12, '#8c93a1'); } };
lienzo('p-cartel', 100, 68, (c, t) => { fondoP(c, 100, 68); cartel(c, 2, 46, t); });
lienzo('p-cartel2', 100, 68, (c, t) => { fondoP(c, 100, 68); cartel(c, 2, 46, t, 2); });
lienzo('p-jacaranda', 28, 36, (c, t) => { px(c, 0, 0, 28, 36, '#33c24d'); arbol(c, 2, 12, t, 0, true); });
lienzo('p-bandera', 44, 56, (c, t) => { px(c, 0, 0, 44, 56, '#68707f'); mastil(c, 4, 34, t); });
lienzo('p-mate', 28, 30, (c, t) => { px(c, 0, 0, 28, 30, '#33c24d'); banco(c, 2, 6, true); });
// --- vehiculos
const pista = (c, w) => { px(c, 0, 0, w, 40, '#2f3240'); const az = semilla(5); for (let k = 0; k < 40; k++) px(c, Math.floor(az() * w), Math.floor(az() * 40), 1, 1, '#3a3e4f'); };
for (const nombre of ['celeste', 'violeta', 'naranja', 'amarillo', 'verde', 'rojo', 'azul', 'jaula', 'cisterna']) lienzo('v-' + nombre, 112, 40, (c, t) => { pista(c, 112); vehiculo(c, 'tbf-' + nombre, 8, 12, ['violeta', 'amarillo', 'rojo', 'cisterna'].includes(nombre) ? -1 : 1, t, 30); });
for (const [id, nombre, dir, w] of [['v-torino', 'torino', 1, 64], ['v-uno', 'uno', -1, 64], ['v-fitito', 'fitito', 1, 64], ['v-504', '504', -1, 64], ['v-taxi', 'taxi', 1, 64]]) lienzo(id, w, 34, (c, t) => { pista(c, w); vehiculo(c, nombre, Math.floor((w - MODELOS[nombre].L) / 2), 6, dir, t, 40); });
for (const [i, num] of ['152', '60', '29', '39', '64', '12'].entries()) lienzo('c-' + num, 112, 34, (c, t) => { pista(c, 112); vehiculo(c, 'colectivo-' + num, 8, 6, i % 2 ? -1 : 1, t, 34); });
// --- rio
lienzo('rio', W, 4 * CEL + 22, (c, t) => { px(c, 0, 0, W, 22, '#a3a9b6'); campo(c, t, [
  { t: 'vereda', boca: [0, 1, 2, 4, 5, 7, 8] },
  { t: 'rio', dir: 1, vel: 14, n: 2, xs: [10, 140] },
  { t: 'rio', dir: -1, vel: 20, n: 3, xs: [60, 220] },
  { t: 'rio', dir: 1, vel: 11, n: 4, xs: [90], cajaEn: 0 }
], 22); });
// --- caja
lienzo('caja', 24, 24, (c, t) => { px(c, 0, 0, 24, 24, '#a3a9b6'); cajaTBF(c, 0, 0, t); });
lienzo('caja-toma', 56, 44, (c, t) => {
  px(c, 0, 0, 56, 44, '#33c24d');
  const a = mod(t, 1.4) / 1.4;
  if (a < 0.3) cajaTBF(c, 16, 16, t);
  mono(c, 16, 16, t);
  if (a >= 0.3) {
    const b = (a - 0.3) / 0.7;
    for (let k = 0; k < 12; k++) { const g = (k / 12) * Math.PI * 2; px(c, 28 + Math.cos(g) * b * 18, 26 + Math.sin(g) * b * 12 + b * b * 6, 2, 2, ['#35b8e8', '#a97bf0', '#ffffff', '#ffd21f'][k % 4]); }
    letrasFilete(c, '+50', 12, Math.round(12 - b * 10), 2, DEGRADE_VIOLETA, '#3d1f7a');
  }
});
// --- HUD y vidas
lienzo('hud', W, HUD, (c, t) => { const s = 3850 - 40 + Math.floor(mod(t, 6) * 20); hud(c, Math.min(s, 3990), 3850, 3, t); });
[3, 2, 1, 0].forEach((n) => lienzo('vidas' + n, 48, 16, (c, t) => {
  px(c, 0, 0, 48, 16, '#000');
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 16, viva = i < n;
    if (viva && n === 1 && Math.floor(t * 2.5) % 2 === 0) px(c, x - 1, 1, 14, 13, 'rgba(255,46,58,.45)');
    pegar(c, viva ? (mod(t + i, 4) < 0.15 ? CABEZA_GUIÑO : CABEZA) : CABEZA, x, 2, { pal: viva ? PAL : GRIS });
  }
}));
// --- inicio: atardecer porteño, game over y record
const imgs = { joy: document.getElementById('png-joystick'), rueda: document.getElementById('png-rueda'), festejo: document.getElementById('png-festejo') };
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
  if (!img.complete || !img.naturalWidth) return;
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
lienzo('inicio', W, H, (c, t) => {
  px(c, 0, 0, W, H, '#000');
  atardecer(c, t, 236);
  const ty = Math.round(Math.sin(t * 2) * 2);
  centro(c, 'CRUZÁ,', 20 + ty + 4, '#3d1f7a', W, 4); centro(c, 'CRUZÁ,', 20 + ty, CROMO7, W, 4);
  centro(c, 'MONO', 54 + ty + 4, '#3d1f7a', W, 4); centro(c, 'MONO', 54 + ty, CROMO7, W, 4);
  mascotaPNG(c, imgs.joy, 54, 124 + Math.round(Math.sin(t * 3) * 2), 112);
  px(c, 0, 236, W, 26, '#000');
  texto(c, 'HI-SCORE', 30, 240, '#c9a8ff'); texto(c, '003850', 140, 240, '#ffffff');
  if (Math.floor(t * 2.2) % 2 === 0) centro(c, 'TOCÁ PARA JUGAR', 252, '#8fdcf7', W);
  c.save(); c.beginPath(); c.rect(8, 262, W - 16, 70); c.clip();
  campo(c, t, [{ t: 'calle', red: true, veh: [['tbf-celeste', 0], ['tbf-violeta', 190]], dir: 1, vel: 40 }, { t: 'calle', veh: [['colectivo-64', 40], ['torino', 240]], dir: -1, vel: 34 }, { t: 'vereda', amarillo: true }], 262);
  c.restore();
  marquesina(c, t);
});
function boton(c, x, y, w, rotulo, principal) {
  if (principal) { px(c, x, y, w, 16, '#35b8e8'); px(c, x, y + 16, w, 3, '#1f86ad'); px(c, x + 2, y + 1, w - 4, 1, '#8fdcf7'); centroEn(c, rotulo, x, w, y + 5, '#06202c'); }
  else { px(c, x, y, w, 16, '#202a36'); px(c, x, y + 16, w, 3, '#0d1218'); centroEn(c, rotulo, x, w, y + 5, '#ffffff'); }
}
const centroEn = (c, s, x, w, y, col) => texto(c, s, x + Math.floor((w - ancho(s)) / 2), y, col);
function caer(t, periodo = 5) { const a = mod(t, periodo); if (a < 0.5) return -80 * (1 - a / 0.5); return Math.round(Math.abs(Math.sin((a - 0.5) * 10)) * 7 * Math.max(0, 1 - (a - 0.5) * 2.2)); }
lienzo('gameover', W, H, (c, t) => {
  px(c, 0, 0, W, H, '#000');
  for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,24,40,${(0.10 * (1 - i / 18)).toFixed(3)})`; c.fillRect(i, i, W - 2 * i, 1); c.fillRect(i, H - 1 - i, W - 2 * i, 1); c.fillRect(i, i, 1, H - 2 * i); c.fillRect(W - 1 - i, i, 1, H - 2 * i); }
  const d = caer(t);
  centro(c, 'GAME', 18 + d + 4, '#7a0d14', W, 4); centro(c, 'GAME', 18 + d, '#ff2e3a', W, 4);
  centro(c, 'OVER', 52 + d + 4, '#7a0d14', W, 4); centro(c, 'OVER', 52 + d, '#ff2e3a', W, 4);
  centro(c, '¡QUÉ MACANA!', 90, '#ffffff', W);
  mascotaPNG(c, imgs.rueda, 60, 102, 96);
  const filas = [['SCORE', '001240', '#35b8e8'], ['HI-SCORE', '003850', '#c9a8ff'], ['FILAS', '102', '#97a3b3'], ['CAJAS', '4', '#97a3b3']];
  filas.forEach(([a, b, col], i) => { texto(c, a, 34, 206 + i * 12, col); texto(c, b, 182 - ancho(b), 206 + i * 12, '#ffffff'); });
  boton(c, 34, 262, 148, 'OTRA VEZ', true); boton(c, 34, 290, 148, 'SALIR', false);
});
const confeti = Array.from({ length: 52 }, (_, i) => ({ x: (i * 47) % W, v: 18 + (i * 13) % 22, f: (i * 0.37) % 1, col: ['#74c7ff', '#ffffff', '#a97bf0', '#74c7ff', '#ffd21f', '#c9a8ff'][i % 6], w: 1 + (i % 2) }));
lienzo('record', W, H, (c, t) => {
  px(c, 0, 0, W, H, '#000');
  if (!quieto) confeti.forEach((p) => { const y = mod(p.f * H + t * p.v, H); const g = Math.floor(t * 6 + p.x) % 2; px(c, p.x + Math.round(Math.sin(t * 3 + p.x) * 3), y, g ? p.w + 1 : 1, g ? 1 : p.w + 1, p.col); });
  const d = caer(t, 6);
  centro(c, '¡SOS UN', 18 + d + 4, '#3d1f7a', W, 3); centro(c, '¡SOS UN', 18 + d, CROMO7, W, 3);
  centro(c, 'CRACK!', 46 + d + 4, '#3d1f7a', W, 4); centro(c, 'CRACK!', 46 + d, CROMO7, W, 4);
  estampa(c, SOL, 18, 96, solCol); estampa(c, SOL, 189, 96, solCol);
  mascotaPNG(c, imgs.festejo, 54, 84, 108);
  if (Math.floor(t * 3) % 2 === 0) centro(c, '¡NUEVO HI-SCORE!', 196, DEGRADE_VIOLETA, W);
  centro(c, String(Math.min(4120, Math.floor(mod(t, 6) * 1600))).padStart(6, '0'), 210, '#ffffff', W, 2);
  texto(c, 'FILAS', 34, 234, '#97a3b3'); texto(c, '312', 182 - ancho('312'), 234, '#ffffff');
  texto(c, 'CAJAS', 34, 246, '#97a3b3'); texto(c, '20', 182 - ancho('20'), 246, '#ffffff');
  boton(c, 34, 264, 148, 'OTRA VEZ', true); boton(c, 34, 292, 148, 'SALIR', false);
  marquesina(c, t);
});

if (quieto) { t0 = performance.now() - 1300; bucle(performance.now()); }
else requestAnimationFrame(bucle);
Promise.all(Object.values(imgs).map((im) => im.decode?.().catch(() => {}))).then(() => { if (quieto) bucle(performance.now()); });
