/**
 * El mundo sin fin de CRUZA, MONO (spec §3).
 *
 * Puro y con semilla: la misma semilla da el mismo mundo, y asi se prueba. Se arma
 * por bloques —una franja segura y un bloque de peligro— a medida que se piden
 * filas. Es el generador de la demostracion del prototipo
 * (docs/diseno/prototipo-cruza/demo.js, crearMundoDemo), con las garantias de la
 * spec cerradas: sin bolsillos, el pasillo libre tambien en el playon, la boca
 * siempre pegada al rio y la senal de la Red solo en galpones pegados a una calle.
 *
 * Una fila es un objeto:
 *   comun   { i, t, bloq: Set de columnas, cajas: [columna] }
 *   segura  t: vereda | plaza | boca | galpones | playon, con obst: [[col, que]],
 *           boca: [col], galpones: [[col, ancho, color]], murales: [[col, tipo]],
 *           amarillo, petalos y, en el playon, numero
 *   calle   { clase: autos | red | colectivos, red, dir, vel (px/s), veh: [[modelo, x0]],
 *             adoquin, mancha, senda?: [x0, x1] }
 *   rio     { dir, vel (px/s), n (celdas del tronco), xs: [x0], P (lazo), cajaEn }
 */

import {
  COLUMNAS, CEL, COLUMNA_DE_LARGADA, FILAS_DE_LARGADA, CADA_PLAYON, FILA_OBELISCO,
  PROB_RIO, PROB_GALPONES, PROB_PLAZA, PROB_CARTEL_BOCA, PROB_ADOQUIN, PROB_CAJA,
  LIBRES_MINIMAS, BLOQUEADAS_MAXIMAS_GALPONES, FILAS_DESPUES_DE_BOCA,
  LAZO, VELOCIDAD_MINIMA, FACTOR_LARGOS, LARGOS_POR_CARRIL, AUTOS_POR_CARRIL,
  HUECO_CELDAS, HUECO_SEGUNDOS, LAZO_RIO, TRONCOS_POR_CARRIL, TRONCO_CADA,
  AUTOS, FLOTA, LINEAS, largoDe, banda
} from './reglas.js';

const PELIGRO = new Set(['calle', 'rio']);
/** Si una fila es segura: no es calle ni rio. */
export const esSegura = (f) => !PELIGRO.has(f.t);

/** El azar con semilla (mulberry32): numeros entre 0 y 1. */
export function azarCon(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los tramos de columnas seguidas: [[desde, cuantas]]. */
export function tramos(cols) {
  const v = [];
  let ini = null, prev = null;
  for (const c of [...cols].sort((a, b) => a - b)) {
    if (prev !== null && c === prev + 1) { prev = c; continue; }
    if (ini !== null) v.push([ini, prev - ini + 1]);
    ini = prev = c;
  }
  if (ini !== null) v.push([ini, prev - ini + 1]);
  return v;
}

/**
 * Sin bolsillos: desde cualquier celda libre de la franja se llega al pasillo sin
 * salir de ella. Busqueda en anchura desde el pasillo de cada fila.
 */
export function sinBolsillos(franja, pasillo) {
  const libre = (k, c) => c >= 0 && c < COLUMNAS && !franja[k].bloq.has(c);
  const visto = new Set();
  const cola = [];
  franja.forEach((f, k) => { if (libre(k, pasillo)) { visto.add(k + ':' + pasillo); cola.push([k, pasillo]); } });
  while (cola.length) {
    const [k, c] = cola.pop();
    for (const [dk, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const k2 = k + dk, c2 = c + dc;
      if (k2 < 0 || k2 >= franja.length || !libre(k2, c2) || visto.has(k2 + ':' + c2)) continue;
      visto.add(k2 + ':' + c2);
      cola.push([k2, c2]);
    }
  }
  return franja.every((f, k) => [...Array(COLUMNAS).keys()].every((c) => !libre(k, c) || visto.has(k + ':' + c)));
}

const vacia = (i) => ({ t: 'vereda', i, obst: [], cajas: [], bloq: new Set() });

export function crearMundo(semilla) {
  const r = azarCon(semilla);
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const uno = (v) => v[Math.floor(r() * v.length)];
  const filas = new Map();
  let siguiente = 0;
  let olvidadasHasta = 0;
  let primero = true;
  let peligroAnterior = null;
  let ultimoMural = null;
  let ultimoPasillo = COLUMNA_DE_LARGADA;

  const columnasLibres = (f) => [...Array(COLUMNAS).keys()].filter((c) => !f.bloq.has(c));
  const caja = (f) => {
    if (f.i >= FILAS_DE_LARGADA && r() < PROB_CAJA.segura) {
      const libres = columnasLibres(f);
      if (libres.length) f.cajas.push(uno(libres));
    }
  };
  // Nunca dos carteles seguidos del mismo tipo.
  const mural = (opciones) => {
    const v = opciones.filter((o) => o !== ultimoMural);
    ultimoMural = uno(v.length ? v : opciones);
    return ultimoMural;
  };

  function playon(i, pasillo) {
    const f = { t: 'playon', i, numero: i, obst: [[0, 'bolardo'], [8, 'bolardo'], [1, 'mastil']], cajas: [], bloq: new Set([0, 1, 8]) };
    // El Obelisco va pegado a lo bloqueado, asi lo libre queda de una pieza.
    if (i === FILA_OBELISCO) {
      const col = pasillo === 2 ? 7 : 2;
      f.obst.push([col, 'obelisco']);
      f.bloq.add(col);
    }
    caja(f);
    return f;
  }

  function segura(tipo, pasillo, limpia) {
    const i = siguiente;
    if (i > 0 && i % CADA_PLAYON === 0) return playon(i, pasillo);
    const f = { t: limpia && (tipo === 'boca' || tipo === 'galpones') ? 'vereda' : tipo, i, obst: [], cajas: [], bloq: new Set(), amarillo: r() < 0.3, petalos: r() < 0.3 };
    if (limpia) { caja(f); return f; }
    if (tipo === 'boca') {
      const libres = new Set([pasillo]);
      while (libres.size < LIBRES_MINIMAS) libres.add(entre(0, COLUMNAS - 1));
      f.boca = [];
      f.murales = [];
      for (let col = 0; col < COLUMNAS; col++) if (!libres.has(col)) { f.boca.push(col); f.bloq.add(col); }
      for (const [c0, n] of tramos(f.boca)) {
        if (n >= 3 && r() < PROB_CARTEL_BOCA) f.murales.push([c0 + Math.floor((n - 3) / 2), mural(['chapa', 'neon'])]);
      }
    } else if (tipo === 'galpones') {
      f.galpones = [];
      f.murales = [];
      const pegadoACalle = filas.get(i - 1)?.t === 'calle';
      for (let intento = 0; intento < 30 && f.galpones.length < 2; intento++) {
        const n = entre(2, 3), c0 = entre(0, COLUMNAS - n);
        const cols = [...Array(n).keys()].map((k) => c0 + k);
        if (cols.some((c) => c === pasillo || f.bloq.has(c) || f.bloq.has(c - 1) || f.bloq.has(c + 1))) continue;
        if (f.bloq.size + n > BLOQUEADAS_MAXIMAS_GALPONES) continue;
        cols.forEach((c) => f.bloq.add(c));
        f.galpones.push([c0, n, entre(0, 3)]);
        if (n !== 3) continue;
        // La senal de la Red va en el galpon pegado a una calle, y solo ahi.
        const tipoMural = pegadoACalle && ultimoMural !== 'senal' ? 'senal' : mural(['neon', 'chapa']);
        if (tipoMural === 'senal') ultimoMural = 'senal';
        f.murales.push([c0, tipoMural]);
      }
    } else {
      const opciones = tipo === 'plaza' ? ['arbol', 'jacaranda', 'mate'] : ['arbol', 'jacaranda', 'contenedor'];
      for (let k = entre(1, 3); k > 0; k--) {
        const col = entre(0, COLUMNAS - 1);
        if (col === pasillo || f.bloq.has(col)) continue;
        f.bloq.add(col);
        f.obst.push([col, uno(opciones)]);
      }
    }
    caja(f);
    return f;
  }

  function calle(anterior) {
    const i = siguiente, b = banda(i), u = r();
    let clase = u < b.reparto[0] ? 'autos' : u < b.reparto[0] + b.reparto[1] ? 'red' : 'colectivos';
    // Nunca dos carriles seguidos de vehiculos largos.
    if (clase !== 'autos' && anterior && anterior.clase !== 'autos') clase = 'autos';
    const largo = clase !== 'autos';
    const dir = r() < 0.5 ? 1 : -1;
    const maxima = b.velocidad * (largo ? FACTOR_LARGOS : 1);
    const celdasPorSegundo = Math.max(VELOCIDAD_MINIMA, VELOCIDAD_MINIMA + r() * (maxima - VELOCIDAD_MINIMA));
    const hueco = (HUECO_CELDAS + celdasPorSegundo * HUECO_SEGUNDOS) * CEL;
    const elegir = () => (clase === 'autos' ? uno(AUTOS) : clase === 'red' ? 'tbf-' + uno(FLOTA) : 'colectivo-' + uno(LINEAS));
    const modelos = [];
    let usado = 0;
    while (modelos.length < (largo ? LARGOS_POR_CARRIL : AUTOS_POR_CARRIL)) {
      const m = elegir();
      if (usado + largoDe(m) + hueco > LAZO) break;
      modelos.push(m);
      usado += largoDe(m) + hueco;
    }
    const holgura = Math.max(0, LAZO - usado);
    let x = Math.floor(r() * LAZO);
    const veh = [];
    for (const m of modelos) {
      veh.push([m, x]);
      x += largoDe(m) + hueco + Math.floor((r() * holgura) / modelos.length);
    }
    const f = {
      t: 'calle', i, clase, red: clase === 'red', dir, vel: celdasPorSegundo * CEL, veh, cajas: [], bloq: new Set(),
      adoquin: clase !== 'red' && r() < PROB_ADOQUIN, mancha: r() < 0.3 ? entre(10, 190) : 0
    };
    if (i >= FILAS_DE_LARGADA && r() < PROB_CAJA.calle) f.cajas.push(entre(0, COLUMNAS - 1));
    return f;
  }

  function rio(anterior) {
    const i = siguiente, b = banda(i);
    // Dos carriles de rio seguidos van en sentidos opuestos.
    const dir = anterior?.t === 'rio' ? -anterior.dir : r() < 0.5 ? 1 : -1;
    const celdasPorSegundo = VELOCIDAD_MINIMA + r() * Math.max(0.2, b.velocidad * 0.6 - VELOCIDAD_MINIMA);
    const n = entre(b.troncos[0], b.troncos[1]);
    const fase = entre(0, 14) * CEL;
    const xs = [...Array(TRONCOS_POR_CARRIL).keys()].map((k) => fase + k * TRONCO_CADA * CEL);
    const cajaEn = i >= FILAS_DE_LARGADA && r() < PROB_CAJA.rio ? entre(0, TRONCOS_POR_CARRIL - 1) : -1;
    return { t: 'rio', i, dir, vel: celdasPorSegundo * CEL, n, xs, P: LAZO_RIO, cajaEn, cajas: [], bloq: new Set() };
  }

  const poner = (f) => { filas.set(f.i, f); siguiente++; return f; };

  /**
   * Una franja segura. La primera trae la largada adelante, con el pasillo en la
   * columna de largada. Si el bloque anterior lo corto un playon en su ultimo
   * carril, ese playon queda pegado a esta franja: es parte de ella y comparte el
   * pasillo, asi la busqueda de bolsillos lo cubre.
   */
  function franjaSegura() {
    const anterior = filas.get(siguiente - 1);
    const largada = siguiente === 0;
    const despuesDeRio = anterior?.t === 'rio';
    const prefijo = anterior?.t === 'playon' ? [anterior] : [];
    const pasillo = largada ? COLUMNA_DE_LARGADA : prefijo.length ? ultimoPasillo : entre(2, 7);
    const n = (largada ? FILAS_DE_LARGADA : 0) + Math.max(despuesDeRio ? FILAS_DESPUES_DE_BOCA : 1, entre(1, 3));
    const desde = siguiente;
    const muralAntes = ultimoMural;
    // Sin bolsillos: si la franja sale con uno, se vuelve a armar. Desde el quinto
    // intento sale sin obstaculos, que no puede tener bolsillos.
    for (let intento = 0; ; intento++) {
      const franja = [];
      for (let k = 0; k < n; k++) {
        const deLargada = largada && k < FILAS_DE_LARGADA;
        const tipo = deLargada ? 'vereda' : k === 0 && despuesDeRio ? 'boca' : r() < PROB_GALPONES ? 'galpones' : r() < PROB_PLAZA ? 'plaza' : 'vereda';
        const f = poner(segura(tipo, pasillo, intento >= 5));
        if (deLargada) f.cajas = [];
        franja.push(f);
      }
      if (sinBolsillos([...prefijo, ...franja], pasillo)) break;
      for (let k = desde; k < siguiente; k++) filas.delete(k);
      siguiente = desde;
      ultimoMural = muralAntes;
    }
    ultimoPasillo = pasillo;
  }

  function bloque() {
    franjaSegura();
    const pasillo = ultimoPasillo;
    const b = banda(siguiente);
    const tipo = primero || peligroAnterior === 'rio' ? 'calle' : r() < PROB_RIO ? 'rio' : 'calle';
    const carriles = primero ? 1 : entre(...b[tipo]);
    primero = false;
    let anterior = null;
    const nuevos = [];
    for (let k = 0; k < carriles; k++) {
      // El playon corta el bloque: sigue despues.
      if (siguiente % CADA_PLAYON === 0) { poner(playon(siguiente, pasillo)); anterior = null; continue; }
      const f = poner(tipo === 'rio' ? rio(anterior) : calle(anterior));
      nuevos.push(f);
      anterior = f;
    }
    // La senda cruza el bloque entero, y la caja de la calle va sobre ella.
    if (tipo === 'calle' && nuevos.length >= 2) {
      const c0 = entre(0, COLUMNAS - 2);
      for (const f of nuevos) {
        f.senda = [c0 * CEL, c0 * CEL + 44];
        f.cajas = f.cajas.map(() => c0 + (f.i % 2));
      }
    }
    peligroAnterior = tipo;
  }

  return {
    /** La fila i. Las de abajo de la largada son vereda; las olvidadas no vuelven. */
    fila(i) {
      if (i < olvidadasHasta) return vacia(i);
      while (siguiente <= i) bloque();
      return filas.get(i);
    },
    /** Olvida las filas por debajo de esta: el mundo no crece sin fin en memoria. */
    olvidar(debajo) {
      for (let k = olvidadasHasta; k < Math.min(debajo, siguiente); k++) filas.delete(k);
      olvidadasHasta = Math.max(olvidadasHasta, Math.min(debajo, siguiente));
    }
  };
}
