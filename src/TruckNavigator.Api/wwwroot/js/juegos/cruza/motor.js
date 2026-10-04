/**
 * El motor de CRUZA, MONO (spec §5): pasos, camara, colisiones, vidas y puntos.
 *
 * Puro: sin reloj ni pantalla. La vista le pasa el tiempo (`avanzar(p, dt)`, en
 * milisegundos) y los gestos (`pedirPaso`); el motor cambia la partida y devuelve
 * lo que paso, para que la vista vibre y dibuje. El mundo se inyecta, asi los
 * tests arman el suyo a mano.
 *
 * Las posiciones van en pixeles del campo: `x` es el borde izquierdo del mono, una
 * celda de 24. El tiempo del transito (`t`) se congela durante el golpe; el
 * `reloj` no.
 */

import {
  CEL, COLUMNAS, ANCHO, LAZO, AFUERA, PASO_MS, VIDAS, GOLPE_MS, INVULNERABLE_MS,
  COLUMNA_DE_LARGADA, MONO_MAX_DESDE_ABAJO, OLVIDAR_DEBAJO, largoDe, banda, puntos
} from './reglas.js';
import { crearMundo, esSegura } from './mundo.js';

const mod = (a, b) => ((a % b) + b) % b;
const lerp = (a, b, f) => a + (b - a) * f;

/** Donde esta un vehiculo de la fila en el tiempo t: su borde izquierdo. */
export const xVehiculo = (f, x0, t) => mod(x0 + (f.dir * f.vel * t) / 1000, LAZO) - AFUERA;
/** Donde esta un tronco del rio en el tiempo t. */
export const xTronco = (f, x0, t) => mod(x0 + (f.dir * f.vel * t) / 1000, f.P) - AFUERA;

/**
 * Si un vehiculo toca al mono. La caja de golpe del mono es de 16 x 18, centrada
 * en su celda; la del vehiculo, su largo menos 3 pixeles en cada punta.
 */
export function choca(f, xm, t) {
  if (f.t !== 'calle') return false;
  return f.veh.some(([m, x0]) => {
    const xv = xVehiculo(f, x0, t);
    return xm + 4 < xv + largoDe(m) - 3 && xm + 20 > xv + 3;
  });
}

/** El tronco que tiene abajo el centro del mono, o -1 si es agua. */
export function troncoBajo(f, xm, t) {
  const cx = xm + CEL / 2;
  for (let j = 0; j < f.xs.length; j++) {
    const xt = xTronco(f, f.xs[j], t);
    if (cx >= xt + 2 && cx <= xt + f.n * CEL - 2) return j;
  }
  return -1;
}

const MOVIDAS = { arr: [1, 0], aba: [-1, 0], izq: [0, -1], der: [0, 1] };
const VISTAS = { arr: 'atras', aba: 'frente', izq: 'izq', der: 'der' };

export function crearPartida(semilla, { mundo = crearMundo(semilla) } = {}) {
  return {
    mundo, estado: 'jugando',
    t: 0, reloj: 0,
    fila: 0, x: COLUMNA_DE_LARGADA * CEL, vista: 'atras',
    salto: null, cola: null, enTronco: null,
    cam: 0, vidas: VIDAS, maxFila: 0, cajas: 0, tomadas: new Set(),
    golpe: null, invulnerableHasta: 0, ultimaSegura: 0
  };
}

/** SCORE = 10 x la fila mas lejana + 50 x las cajas: ir y volver no suma. */
export const puntaje = (p) => puntos(p.maxFila, p.cajas);

/** Donde esta el mono ahora, tambien en medio del salto. */
export const xDelMono = (p) => (p.salto ? lerp(p.salto.x0, p.salto.x1, Math.min(1, (p.t - p.salto.desde) / PASO_MS)) : p.x);
/** Cuanto lleva el salto, de 0 a 1, o 0 si esta quieto. */
export const avanceDelSalto = (p) => (p.salto ? Math.min(1, (p.t - p.salto.desde) / PASO_MS) : 0);

function destino(p, dir) {
  const [df, dc] = MOVIDAS[dir];
  // De costado sobre un tronco se mueve en pixeles; si no, cae en la columna mas cercana.
  const x = p.enTronco !== null && df === 0 ? p.x + dc * CEL : Math.round((p.x + dc * CEL) / CEL) * CEL;
  return { fila: p.fila + df, x };
}

function bloqueado(p, d) {
  if (d.fila < 0 || d.x < 0 || d.x > (COLUMNAS - 1) * CEL) return true;
  const f = p.mundo.fila(d.fila);
  return f.t !== 'rio' && f.bloq.has(Math.round(d.x / CEL));
}

function saltar(p, dir) {
  p.vista = VISTAS[dir];
  const d = destino(p, dir);
  if (bloqueado(p, d)) return false;
  p.salto = { f0: p.fila, x0: p.x, f1: d.fila, x1: d.x, desde: p.t };
  p.enTronco = null;
  return true;
}

/**
 * Un gesto. Quieto, salta (si no hay obstaculo ni borde: bloqueado no cuesta nada).
 * En medio de un salto guarda uno solo, que sale al aterrizar; los demas se
 * descartan. Devuelve si salto ya.
 */
export function pedirPaso(p, dir) {
  if (!MOVIDAS[dir] || p.estado !== 'jugando' || p.golpe) return false;
  if (p.salto) {
    if (p.cola === null) p.cola = dir;
    return false;
  }
  return saltar(p, dir);
}

function golpear(p, motivo, ev) {
  if (p.salto) { p.x = xDelMono(p); p.fila = p.salto.f1; }
  p.vidas--;
  p.golpe = { desde: p.reloj, motivo };
  p.salto = null;
  p.cola = null;
  p.enTronco = null;
  ev.push({ tipo: 'golpe', motivo });
}

function tomar(p, clave, ev) {
  if (p.tomadas.has(clave)) return;
  p.tomadas.add(clave);
  p.cajas++;
  ev.push({ tipo: 'caja' });
}

function aterrizar(p, ev) {
  const s = p.salto;
  p.salto = null;
  p.fila = s.f1;
  p.x = s.x1;
  const f = p.mundo.fila(p.fila);
  if (f.t === 'rio') {
    const j = troncoBajo(f, p.x, p.t);
    if (j < 0) { golpear(p, 'agua', ev); return; }
    p.enTronco = j;
    if (f.cajaEn === j) tomar(p, p.fila + ':t', ev);
  } else {
    p.x = Math.round(p.x / CEL) * CEL;
    const col = p.x / CEL;
    if (f.cajas.includes(col)) tomar(p, p.fila + ':' + col, ev);
    if (esSegura(f)) p.ultimaSegura = p.fila;
  }
  if (p.fila > p.maxFila) p.maxFila = p.fila;
  ev.push({ tipo: 'aterrizo' });
  if (p.cola) {
    const dir = p.cola;
    p.cola = null;
    saltar(p, dir);
  }
}

/**
 * Despues del golpe: en la ultima fila segura en la que estuvo —o la primera
 * segura entera a la vista, si esa quedo abajo de la camara— y en la columna libre
 * mas cercana a la de largada. Sin vidas, el fin.
 */
function reaparecer(p, ev) {
  p.golpe = null;
  if (p.vidas <= 0) {
    p.estado = 'fin';
    ev.push({ tipo: 'fin' });
    return;
  }
  let fila = Math.max(p.ultimaSegura, Math.ceil(p.cam));
  while (!esSegura(p.mundo.fila(fila))) fila++;
  const f = p.mundo.fila(fila);
  const col = [0, 1, -1, 2, -2, 3, -3, 4, -4]
    .map((d) => COLUMNA_DE_LARGADA + d)
    .find((c) => c >= 0 && c < COLUMNAS && !f.bloq.has(c));
  Object.assign(p, { fila, x: col * CEL, vista: 'atras', ultimaSegura: fila, invulnerableHasta: p.reloj + INVULNERABLE_MS });
  ev.push({ tipo: 'reaparece' });
}

/**
 * Avanza la partida dt milisegundos. Devuelve los eventos: aterrizo, caja,
 * golpe (con su motivo: calle, agua, borde o grua), reaparece y fin.
 *
 * La invulnerabilidad despues de reaparecer protege de los vehiculos; el agua, el
 * borde y la grua no perdonan, porque dejarlos pasar dejaria al mono parado
 * sobre el agua.
 */
export function avanzar(p, dt) {
  const ev = [];
  if (p.estado !== 'jugando') return ev;
  p.reloj += dt;

  if (p.golpe) {
    if (p.reloj - p.golpe.desde >= GOLPE_MS) reaparecer(p, ev);
    return ev;
  }

  p.t += dt;
  if (p.salto) {
    if (p.t - p.salto.desde >= PASO_MS) aterrizar(p, ev);
  } else if (p.enTronco !== null) {
    const f = p.mundo.fila(p.fila);
    p.x += (f.dir * f.vel * dt) / 1000;
    if (p.x + CEL / 2 < 0 || p.x + CEL / 2 > ANCHO) golpear(p, 'borde', ev);
  }
  if (p.golpe) return ev;

  // La camara sube sola desde el primer paso adelante, sigue al mono y nunca baja.
  if (p.maxFila > 0) p.cam += dt / (banda(p.maxFila).camara * 1000);
  p.cam = Math.max(p.cam, p.fila - MONO_MAX_DESDE_ABAJO);
  p.mundo.olvidar(Math.floor(p.cam) - OLVIDAR_DEBAJO);

  if (!p.salto && p.fila < Math.floor(p.cam)) {
    golpear(p, 'grua', ev);
    return ev;
  }

  const f = p.mundo.fila(p.salto ? p.salto.f1 : p.fila);
  if (p.reloj >= p.invulnerableHasta && choca(f, xDelMono(p), p.t)) golpear(p, 'calle', ev);
  return ev;
}
