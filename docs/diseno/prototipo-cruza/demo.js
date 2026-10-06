// ================================================================ la demostracion
// El mundo sin fin de la spec (§3) y un mono en piloto automatico, para ver la jugabilidad.
// Es prototipo: el motor de verdad se escribe con tests (plan). Aca se busca que se vea.
const DEMO_PASO = 0.14;
const DEMO_LARGO = { torino: 50, uno: 44, fitito: 38, '504': 50, taxi: 50 };
const demoLargo = (m) => DEMO_LARGO[m] ?? 96;
const DEMO_AUTOS = ['torino', 'uno', 'fitito', '504', 'taxi'];
const DEMO_FLOTA = ['celeste', 'violeta', 'naranja', 'amarillo', 'verde', 'rojo', 'azul', 'jaula', 'cisterna'];
const DEMO_LINEAS = ['152', '60', '29', '39', '64', '12'];
const DEMO_BANDAS = [
  { desde: 0, calle: [1, 2], rio: [1, 2], tr: [3, 4], vmax: 1.5, cam: 4, rep: [0.8, 0.2, 0] },
  { desde: 20, calle: [1, 3], rio: [1, 3], tr: [2, 3], vmax: 2.5, cam: 3, rep: [0.55, 0.3, 0.15] },
  { desde: 60, calle: [2, 4], rio: [2, 3], tr: [2, 2], vmax: 3.5, cam: 2.5, rep: [0.55, 0.3, 0.15] },
  { desde: 120, calle: [2, 5], rio: [2, 4], tr: [2, 2], vmax: 4.5, cam: 2, rep: [0.55, 0.3, 0.15] }
];
const demoBanda = (f) => DEMO_BANDAS.filter((b) => b.desde <= f).pop();
function demoAzar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function crearMundoDemo(semilla) {
  const r = demoAzar(semilla), filas = [];
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const uno = (v) => v[Math.floor(r() * v.length)];
  let primero = true, peligroAnterior = null, despuesDeRio = false, ultimoMural = null;
  const vacia = (i) => ({ t: 'vereda', i, obst: [], cajas: [], bloq: new Set() });
  const muralSiguiente = (opciones) => { const v = opciones.filter((o) => o !== ultimoMural); ultimoMural = uno(v.length ? v : opciones); return ultimoMural; };

  function caja(f) { if (f.i >= 3 && r() < 0.15) { const libres = [...Array(9).keys()].filter((c) => !f.bloq.has(c)); if (libres.length) f.cajas.push(uno(libres)); } }
  function segura(tipo, pasillo) {
    const i = filas.length, f = { t: tipo === 'boca' || tipo === 'galpones' ? 'vereda' : tipo, i, obst: [], cajas: [], bloq: new Set(), amarillo: r() < 0.3, petalos: r() < 0.3 };
    if (i > 0 && i % 25 === 0) { f.t = 'playon'; f.numero = i; f.obst = [[0, 'bolardo'], [8, 'bolardo'], [1, 'mastil']]; [0, 1, 8].forEach((c) => f.bloq.add(c)); caja(f); return f; }
    if (tipo === 'boca') {
      const libres = new Set([pasillo]); while (libres.size < 4) libres.add(entre(0, 8));
      f.boca = []; f.murales = [];
      for (let col = 0; col < 9; col++) if (!libres.has(col)) { f.boca.push(col); f.bloq.add(col); }
      tramos(f.boca).forEach(([c0, n]) => { if (n >= 3 && r() < 0.85) f.murales.push([c0 + Math.floor((n - 3) / 2), muralSiguiente(['chapa', 'neon'])]); });
    } else if (tipo === 'galpones') {
      f.galpones = []; f.murales = [];
      for (let intento = 0; intento < 30 && f.galpones.length < 2; intento++) {
        const n = entre(2, 3), c0 = entre(0, 9 - n), cols = [...Array(n).keys()].map((k) => c0 + k);
        if (cols.some((c) => c === pasillo || f.bloq.has(c) || f.bloq.has(c - 1) || f.bloq.has(c + 1)) || f.bloq.size + n > 5) continue;
        cols.forEach((c) => f.bloq.add(c)); f.galpones.push([c0, n, entre(0, 3)]);
        if (n === 3) f.murales.push([c0, muralSiguiente(filas[i - 1]?.t === 'calle' ? ['senal'] : ['senal', 'neon', 'chapa'])]);
      }
    } else {
      const opciones = tipo === 'plaza' ? ['arbol', 'jacaranda', 'mate'] : ['arbol', 'jacaranda', 'contenedor'];
      for (let k = entre(1, 3); k > 0; k--) { const col = entre(0, 8); if (col === pasillo || f.bloq.has(col)) continue; f.bloq.add(col); f.obst.push([col, uno(opciones)]); }
    }
    caja(f);
    return f;
  }
  function calle(anterior) {
    const i = filas.length, b = demoBanda(i), u = r();
    let clase = u < b.rep[0] ? 'autos' : u < b.rep[0] + b.rep[1] ? 'red' : 'colectivos';
    if (clase !== 'autos' && anterior && anterior.clase !== 'autos') clase = 'autos';
    const largo = clase !== 'autos', dir = r() < 0.5 ? 1 : -1;
    const vmax = b.vmax * (largo ? 0.75 : 1), velC = Math.max(0.8, 0.8 + r() * (vmax - 0.8));
    const hueco = (2 + velC * 0.5) * CEL, elegir = () => clase === 'autos' ? uno(DEMO_AUTOS) : clase === 'red' ? 'tbf-' + uno(DEMO_FLOTA) : 'colectivo-' + uno(DEMO_LINEAS);
    const modelos = []; let usado = 0;
    while (modelos.length < (largo ? 2 : 3)) { const m = elegir(); if (usado + demoLargo(m) + hueco > P) break; modelos.push(m); usado += demoLargo(m) + hueco; }
    if (!modelos.length) { modelos.push(elegir()); usado = demoLargo(modelos[0]) + hueco; }
    const holgura = Math.max(0, P - usado); let x = Math.floor(r() * P); const veh = [];
    for (const m of modelos) { veh.push([m, x]); x += demoLargo(m) + hueco + Math.floor(r() * holgura / modelos.length); }
    const f = { t: 'calle', i, clase, red: clase === 'red', dir, vel: velC * CEL, veh, cajas: [], bloq: new Set(), adoquin: clase !== 'red' && r() < 0.2, mancha: r() < 0.3 ? entre(10, 190) : 0 };
    if (i >= 3 && r() < 0.1) f.cajas.push(entre(0, 8));
    return f;
  }
  function rio(anterior) {
    const i = filas.length, b = demoBanda(i);
    const dir = anterior?.t === 'rio' ? -anterior.dir : (r() < 0.5 ? 1 : -1);
    const velC = 0.8 + r() * Math.max(0.2, b.vmax * 0.6 - 0.8), n = entre(b.tr[0], b.tr[1]);
    const fase = entre(0, 14) * CEL, xs = [0, 1, 2].map((k) => fase + k * 5 * CEL);
    return { t: 'rio', i, dir, vel: velC * CEL, n, xs, P: 15 * CEL, cajaEn: i >= 3 && r() < 0.1 ? entre(0, 2) : -1, cajas: [], bloq: new Set() };
  }
  function bloque() {
    if (!filas.length) { for (let k = 0; k < 3; k++) { const f = segura('vereda', 4); f.cajas = []; filas.push(f); } return; }
    const pasillo = entre(0, 8), n = Math.max(despuesDeRio ? 2 : 1, entre(1, 3)), desde = filas.length;
    // Sin bolsillos: desde cualquier celda libre de la franja se llega al pasillo sin salir de
    // ella. Si sale una franja con un bolsillo, se vuelve a armar; a la quinta, sin obstaculos.
    for (let intento = 0; ; intento++) {
      for (let k = 0; k < n; k++) {
        const tipo = k === 0 && despuesDeRio ? 'boca' : r() < 0.18 ? 'galpones' : r() < 0.35 ? 'plaza' : 'vereda';
        const f = segura(tipo, pasillo);
        if (intento >= 5 && f.t !== 'playon') { f.obst = []; f.boca = []; f.galpones = []; f.murales = []; f.bloq = new Set(); }
        filas.push(f);
      }
      if (intento >= 8 || sinBolsillos(filas.slice(desde), pasillo)) break;
      filas.length = desde;
    }
    despuesDeRio = false;
    const b = demoBanda(filas.length), tipo = primero ? 'calle' : peligroAnterior === 'rio' ? 'calle' : r() < 0.3 ? 'rio' : 'calle';
    const carriles = primero ? 1 : entre(...b[tipo === 'rio' ? 'rio' : 'calle']);
    primero = false;
    let anterior = null; const nuevos = [];
    for (let k = 0; k < carriles; k++) {
      if (filas.length % 25 === 0) { filas.push(segura('vereda', pasillo)); anterior = null; continue; }
      const f = tipo === 'rio' ? rio(anterior) : calle(anterior); filas.push(f); nuevos.push(f); anterior = f;
    }
    if (tipo === 'calle' && nuevos.length >= 2) { const c0 = entre(0, 7) * CEL; nuevos.forEach((f) => { f.senda = [c0, c0 + 44]; }); }
    peligroAnterior = tipo; if (tipo === 'rio') despuesDeRio = true;
  }
  return { fila(i) { if (i < 0) return vacia(i); while (filas.length <= i) bloque(); return filas[i]; } };
}
function sinBolsillos(franja, pasillo) {
  const libre = (k, c) => c >= 0 && c <= 8 && !franja[k].bloq.has(c);
  const visto = new Set(), cola = [];
  franja.forEach((f, k) => { if (libre(k, pasillo)) { visto.add(k + ':' + pasillo); cola.push([k, pasillo]); } });
  while (cola.length) {
    const [k, c] = cola.pop();
    for (const [dk, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const k2 = k + dk, c2 = c + dc;
      if (k2 < 0 || k2 >= franja.length || !libre(k2, c2) || visto.has(k2 + ':' + c2)) continue;
      visto.add(k2 + ':' + c2); cola.push([k2, c2]);
    }
  }
  return franja.every((f, k) => [...Array(9).keys()].every((c) => !libre(k, c) || visto.has(k + ':' + c)));
}
function tramos(cols) {
  const v = []; let ini = null, prev = null;
  for (const c of [...cols].sort((a, b) => a - b)) { if (prev !== null && c === prev + 1) { prev = c; continue; } if (ini !== null) v.push([ini, prev - ini + 1]); ini = prev = c; }
  if (ini !== null) v.push([ini, prev - ini + 1]);
  return v;
}

// --- el piloto automatico
const demo = { semilla: 7, partida: 0 };
function nuevaDemo() {
  demo.partida++;
  Object.assign(demo, {
    mundo: crearMundoDemo(demo.semilla + demo.partida * 101), fila: 0, x: 4 * CEL, salto: null, enTronco: null,
    cam: 0, camVis: 0, vidas: 3, maxFila: 0, cajas: 0, tm: 0, reloj: 0, golpe: null, fin: null, ultimaSegura: 0,
    invul: 0, proxima: 0, espera: 0, particulas: [], vista: 'atras', apuro: 0
  });
}
nuevaDemo();
demo.hi = 1850;
const xVeh = (f, x0, t) => mod(x0 + f.dir * f.vel * t, P) - 110;
const xTr = (f, x0, t) => mod(x0 + f.dir * f.vel * t, f.P) - 110;
function choca(f, xm, t) {
  if (f.t !== 'calle') return false;
  return f.veh.some(([m, x0]) => { const xv = xVeh(f, x0, t), L = demoLargo(m); return xm + 4 < xv + L - 3 && xm + 20 > xv + 3; });
}
function troncoBajo(f, xm, t, margen = 2) {
  const cx = xm + 12;
  for (let j = 0; j < f.xs.length; j++) { const xt = xTr(f, f.xs[j], t); if (cx >= xt + margen && cx <= xt + f.n * CEL - margen) return j; }
  return -1;
}
const peligro = (f, xm, t0, dur) => { for (let s = 0; s <= dur; s += 0.02) if (choca(f, xm, t0 + s)) return true; return false; };
const seguraDemo = (f) => f.t !== 'calle' && f.t !== 'rio';
function destino(df, dcol) {
  const enTronco = demo.enTronco !== null && df === 0;
  const x = enTronco ? demo.x + dcol * CEL : Math.round((demo.x + dcol * CEL) / CEL) * CEL;
  return { fila: demo.fila + df, x };
}
// Cuanto tiempo se esta a salvo en un lugar, desde t0 (hasta 3 s): en la calle, hasta que llega
// un vehiculo; en el rio, si hay tronco y hasta que te lleva al borde; en lo seguro, siempre.
function aSalvo(f, x, t0) {
  if (f.t === 'calle') { for (let s = 0; s <= 3; s += 0.03) if (choca(f, x, t0 + s)) return s; return 3; }
  if (f.t === 'rio') {
    if (troncoBajo(f, x, t0, 6) < 0) return 0;
    const cx = x + 12, borde = f.dir > 0 ? W - cx : cx;
    return Math.min(3, borde / f.vel);
  }
  return 3;
}
function movida(df, dcol) {
  const d = destino(df, dcol);
  if (d.fila < Math.ceil(demo.cam) || d.x < 0 || d.x > 8 * CEL) return null;
  const f = demo.mundo.fila(d.fila), col = Math.round(d.x / CEL);
  if (f.bloq.has(col)) return null;
  // en la calle cuenta desde ya: mientras salta, el mono ya esta en el carril de destino
  return { m: [df, dcol], s: f.t === 'calle' ? aSalvo(f, d.x, demo.tm) : aSalvo(f, d.x, demo.tm + DEMO_PASO) };
}
function puedeIr(df, dcol) { const v = movida(df, dcol); return !!v && v.s >= 0.6; }
function decidir() {
  const f = demo.mundo.fila(demo.fila);
  if (puedeIr(1, 0)) return [1, 0];
  // a veces se apura y no espera el hueco: asi se ve un golpe cada tanto
  if (demo.espera > 0.6 && Math.random() < 0.0012) return [1, 0];
  // si quedarse se pone feo, la movida que mas tiempo deja a salvo
  const quedarse = aSalvo(f, demo.x, demo.tm);
  if (quedarse < 0.45) {
    const mejor = [[1, 0], [0, 1], [0, -1], [-1, 0]].map((m) => movida(...m)).filter((v) => v && v.s > quedarse + 0.15).sort((a, b) => b.s - a.s)[0];
    if (mejor) return mejor.m;
  }
  if (f.t === 'rio' && demo.enTronco !== null) {
    const hacia = demo.x < 3 * CEL ? 1 : demo.x > 5 * CEL ? -1 : 0;
    if (hacia && (demo.x < CEL || demo.x > 7 * CEL) && puedeIr(0, hacia)) return [0, hacia];
    return null;
  }
  const adelante = demo.mundo.fila(demo.fila + 1);
  const bloqueado = adelante.bloq.has(Math.round(demo.x / CEL));
  if (seguraDemo(f) && (bloqueado || demo.espera > 1.4)) {
    const lado = demo.lado ?? (demo.lado = Math.random() < 0.5 ? 1 : -1);
    for (const dc of [lado, -lado]) if (puedeIr(0, dc)) { demo.lado = dc; return [0, dc]; }
  }
  const objetivo = adelante.cajas.find((c) => Math.abs(c - demo.x / CEL) <= 2);
  if (seguraDemo(f) && objetivo !== undefined && objetivo !== Math.round(demo.x / CEL)) { const dc = Math.sign(objetivo - demo.x / CEL); if (puedeIr(0, dc)) return [0, dc]; }
  return null;
}
function saltar([df, dc]) {
  const d = destino(df, dc);
  demo.salto = { f0: demo.fila, x0: demo.x, f1: d.fila, x1: d.x, t0: demo.tm };
  demo.vista = df > 0 ? 'atras' : df < 0 ? 'frente' : dc > 0 ? 'der' : 'izq';
  demo.espera = 0; if (df !== 0) demo.lado = null;
}
function polvoDemo(x, filaY) { for (let k = 0; k < 6; k++) demo.particulas.push({ x: x + 12, fila: filaY, dy: 21, vx: (k - 2.5) * 0.25, vy: -0.08, s: 1, col: 'rgba(255,255,255,.85)', vida: 0.3, t0: demo.reloj }); }
function tomarCaja() {
  demo.cajas++;
  demo.particulas.push({ texto: '+50', x: demo.x - 6, fila: demo.fila, dy: -8, vida: 0.7, t0: demo.reloj });
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; demo.particulas.push({ x: demo.x + 12, fila: demo.fila, dy: 10, vx: Math.cos(a), vy: Math.sin(a) * 0.8, s: 2, col: ['#35b8e8', '#a97bf0', '#ffffff', '#ffd21f'][k % 4], vida: 0.5, t0: demo.reloj, g: true }); }
}
function aterrizar() {
  const s = demo.salto; demo.salto = null;
  demo.fila = s.f1; demo.x = s.x1;
  const f = demo.mundo.fila(demo.fila);
  if (f.t === 'rio') {
    const j = troncoBajo(f, demo.x, demo.tm);
    if (j < 0) return golpeDemo('agua');
    demo.enTronco = j;
    if (f.cajaEn === j) { f.cajaEn = -1; tomarCaja(); }
  } else {
    demo.enTronco = null; demo.x = Math.round(demo.x / CEL) * CEL;
    const k = f.cajas.indexOf(demo.x / CEL); if (k >= 0) { f.cajas.splice(k, 1); tomarCaja(); }
    if (seguraDemo(f)) demo.ultimaSegura = demo.fila;
    polvoDemo(demo.x, demo.fila);
  }
  if (demo.fila > demo.maxFila) demo.maxFila = demo.fila;
}
function golpeDemo(motivo) {
  if (demo.golpe || demo.reloj < demo.invul) return;
  demo.golpe = { t: demo.reloj, motivo }; demo.vidas--; demo.salto = null;
}
function reaparecer() {
  if (demo.vidas <= 0) { demo.fin = demo.reloj; demo.hi = Math.max(demo.hi, puntajeDemo()); return; }
  let fila = Math.max(demo.ultimaSegura, Math.ceil(demo.cam) + 1);
  while (!seguraDemo(demo.mundo.fila(fila))) fila++;
  const f = demo.mundo.fila(fila);
  let col = 4; for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]) if (!f.bloq.has(4 + d) && 4 + d >= 0 && 4 + d <= 8) { col = 4 + d; break; }
  Object.assign(demo, { fila, x: col * CEL, enTronco: null, golpe: null, invul: demo.reloj + 1.5, ultimaSegura: fila, vista: 'atras', espera: 0 });
  demo.cam = Math.min(demo.cam, fila - 1); demo.camVis = Math.min(demo.camVis, demo.cam);
}
const puntajeDemo = () => 10 * demo.maxFila + 50 * demo.cajas;
function avanzarDemo(dt) {
  demo.reloj += dt;
  if (demo.fin !== null) { if (demo.reloj - demo.fin > 3.2) { const hi = demo.hi; nuevaDemo(); demo.hi = hi; } return; }
  if (demo.golpe) { if (demo.reloj - demo.golpe.t > 0.9) reaparecer(); return; }
  demo.tm += dt;
  if (demo.maxFila > 0) demo.cam += dt / demoBanda(demo.maxFila).cam;
  demo.cam = Math.max(demo.cam, demo.fila - 6);
  demo.camVis += (demo.cam - demo.camVis) * Math.min(1, dt * 5);
  if (demo.salto) { if (demo.tm - demo.salto.t0 >= DEMO_PASO) aterrizar(); }
  else if (demo.enTronco !== null) {
    const f = demo.mundo.fila(demo.fila); demo.x += f.dir * f.vel * dt;
    if (demo.x + 12 < 0 || demo.x + 12 > W) return golpeDemo('agua');
  }
  if (!demo.salto && demo.fila < Math.floor(demo.cam)) return golpeDemo('grua');
  const fAct = demo.mundo.fila(demo.salto ? demo.salto.f1 : demo.fila);
  const xAct = demo.salto ? lerp(demo.salto.x0, demo.salto.x1, Math.min(1, (demo.tm - demo.salto.t0) / DEMO_PASO)) : demo.x;
  if (demo.reloj >= demo.invul && choca(fAct, xAct, demo.tm)) return golpeDemo('calle');
  if (!demo.salto && !demo.golpe) { demo.espera += dt; if (demo.tm >= demo.proxima) { const m = decidir(); if (m) saltar(m); demo.proxima = demo.tm + 0.06; } }
}
let demoUltimo = null, demoPausa = false;
lienzo('escena', W, H, (c, t) => {
  const dt = demoUltimo === null ? 0 : Math.min(0.05, t - demoUltimo); demoUltimo = t;
  if (!demoPausa) avanzarDemo(dt);
  const tm = demo.tm, camTop = demo.camVis + FILAS - 1;
  const yDe = (i) => Math.round(HUD + (camTop - i) * CEL);
  const g = demo.golpe ? demo.reloj - demo.golpe.t : -1;
  const sac = g >= 0 && g < 0.32 && !quieto ? (Math.floor(g * 40) % 2 ? 2 : -2) : 0;
  px(c, 0, 0, W, H, '#000');
  c.save(); c.beginPath(); c.rect(0, HUD, W, H - HUD); c.clip(); c.translate(sac, 0);
  const i0 = Math.floor(demo.camVis) - 2, i1 = Math.ceil(camTop) + 2;
  for (let i = i1; i >= i0; i--) {
    const k = demo.mundo.fila(i), y = yDe(i), arr = demo.mundo.fila(i + 1).t, aba = demo.mundo.fila(i - 1).t;
    if (k.t === 'calle') asfalto(c, y, i, arr, aba, k);
    if (k.t === 'vereda') vereda(c, y, i, arr, aba, t, k);
    if (k.t === 'plaza') plaza(c, y, i, t);
    if (k.t === 'playon') playon(c, y, i, t, k.numero);
    if (k.t === 'rio') rio(c, y, i, k.dir, tm, arr, aba);
  }
  const s = demo.salto, fs = s ? Math.min(1, (demo.tm - s.t0) / DEMO_PASO) : 0;
  const filaMono = s ? s.f1 : demo.fila;
  for (let i = i1 + 2; i >= i0; i--) {
    cosas(c, demo.mundo.fila(i), i, yDe(i), tm, new Set());
    if (i !== filaMono || demo.fin !== null) continue;
    const filaV = s ? lerp(s.f0, s.f1, fs) : demo.fila, xm = s ? lerp(s.x0, s.x1, fs) : demo.x;
    const ym = Math.round(HUD + (camTop - filaV) * CEL);
    if (demo.golpe) {
      if (demo.golpe.motivo === 'agua') chapuzon(c, xm, ym, t); else { pegar(c, MONO_GOLPE, xm, ym); estrellas(c, xm, ym + 6, t); }
    } else {
      const parpadea = demo.reloj < demo.invul && Math.floor(demo.reloj * 10) % 2 === 0;
      mono(c, xm, ym, t, { vista: demo.vista, salto: fs, alto: s ? Math.round(Math.sin(fs * Math.PI) * 6) : 0, invisible: parpadea });
    }
  }
  demo.particulas = demo.particulas.filter((p) => demo.reloj - p.t0 < p.vida);
  for (const p of demo.particulas) {
    const a = (demo.reloj - p.t0) / p.vida, y = Math.round(HUD + (camTop - p.fila) * CEL) + p.dy;
    if (p.texto) { letrasFilete(c, p.texto, p.x, Math.round(y - a * 16), 2, DEGRADE_VIOLETA, '#3d1f7a'); continue; }
    px(c, p.x + p.vx * a * 30, y + p.vy * a * 30 + (p.g ? a * a * 10 : 0), p.s, p.s, p.col);
  }
  if (g >= 0 && g < 0.9 && (quieto ? g < 0.6 : [0, 0.18, 0.36].some((s0) => g >= s0 && g < s0 + 0.1))) px(c, 0, HUD, W, H - HUD, 'rgba(255,24,40,.55)');
  c.restore();
  marcadorVisible += (puntajeDemo() - marcadorVisible) * 0.2;
  hud(c, marcadorVisible, demo.hi, Math.max(0, demo.vidas), t, g);
  if (demo.fin !== null) {
    const gf = demo.reloj - demo.fin;
    px(c, 0, HUD, W, H - HUD, 'rgba(0,0,0,.8)');
    const caida = Math.min(1, gf / 0.5), rebote = caida < 1 ? -60 * (1 - caida) : Math.round(Math.abs(Math.sin((gf - 0.5) * 9)) * 6 * Math.max(0, 1 - (gf - 0.5) * 2));
    centro(c, 'GAME', 110 + rebote + 3, '#7a0d14', W, 4); centro(c, 'GAME', 110 + rebote, '#ff2e3a', W, 4);
    centro(c, 'OVER', 144 + rebote + 3, '#7a0d14', W, 4); centro(c, 'OVER', 144 + rebote, '#ff2e3a', W, 4);
    centro(c, '¡QUÉ MACANA!', 186, '#ffffff', W);
    centro(c, 'FILAS ' + demo.maxFila + '  CAJAS ' + demo.cajas, 204, '#97a3b3', W);
  }
});
document.getElementById('b-otra').addEventListener('click', () => { const hi = demo.hi; nuevaDemo(); demo.hi = hi; });
document.getElementById('b-pausa').addEventListener('click', (e) => { demoPausa = !demoPausa; e.currentTarget.textContent = demoPausa ? 'SEGUIR' : 'PAUSA'; });
