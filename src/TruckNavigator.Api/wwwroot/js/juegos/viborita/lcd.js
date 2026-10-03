/**
 * La LCD verde de VIBORITA TBF (spec §2.3), pintada en un canvas.
 *
 * `pixeles` decide que se prende (puro, probado en node); `pintar` lo pinta con
 * el aspecto aprobado: el verde con su degradado, la rejilla fantasma de la
 * matriz, la sombra de cada pixel corrida uno y las esquinas mas oscuras.
 */

import { SPRITES, FUENTE, anchoDeTexto } from './dibujos.js';
import { AN, AL } from './pantallas.js';

const LCD = { fondo: ['#b8d27a', '#97b555'], tinta: '#1b2412', sombra: 'rgba(27,36,18,.2)', fantasma: 'rgba(27,36,18,.07)' };

/** Los pixeles encendidos, como y * AN + x. Lo que cae afuera de la LCD no se prende. */
export function pixeles(ordenes) {
  const on = new Set();
  const prender = (x, y) => { if (x >= 0 && x < AN && y >= 0 && y < AL) on.add(y * AN + x); };
  const rect = (o, fn) => { for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) fn(x, y); };
  const escribir = (t, x0, y0, k) => {
    let cx = x0;
    for (const c of String(t)) {
      (FUENTE[c] ?? FUENTE[' ']).forEach((fila, j) => [...fila].forEach((p, i) => {
        if (p === '#') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) prender(cx + i * k + a, y0 + j * k + b);
      }));
      cx += 6 * k;
    }
  };

  for (const o of ordenes) {
    switch (o.op) {
      case 'texto': escribir(o.t, o.x, o.y, o.k ?? 1); break;
      case 'centro': escribir(o.t, Math.round((AN - anchoDeTexto(o.t, o.k ?? 1)) / 2), o.y, o.k ?? 1); break;
      case 'sprite': SPRITES[o.n].forEach((fila, j) => [...fila].forEach((p, i) => p === '#' && prender(o.x + i, o.y + j))); break;
      case 'linea': rect(o, prender); break;
      case 'marco':
        rect({ ...o, y1: o.y0 }, prender); rect({ ...o, y0: o.y1 }, prender);
        rect({ ...o, x1: o.x0 }, prender); rect({ ...o, x0: o.x1 }, prender);
        break;
      case 'borrar': rect(o, (x, y) => on.delete(y * AN + x)); break;
      case 'estado':
        // La barrita de senal y la pila del modo de espera, como en el 1100.
        [2, 3, 4, 5].forEach((h, i) => rect({ x0: 1 + i * 2, y0: 7 - h, x1: 1 + i * 2, y1: 6 }, prender));
        for (const r of [[AN - 9, 1, AN - 2, 1], [AN - 9, 6, AN - 2, 6], [AN - 9, 1, AN - 9, 6], [AN - 2, 1, AN - 2, 6], [AN - 1, 3, AN - 1, 4], [AN - 8, 2, AN - 3, 5]]) {
          rect({ x0: r[0], y0: r[1], x1: r[2], y1: r[3] }, prender);
        }
        break;
      default: break;
    }
  }
  return on;
}

/**
 * Pinta la LCD en el canvas, a `escala` px de pantalla por pixel de LCD. La escala
 * es siempre entera y se multiplica por la densidad del telefono: un pixel de LCD
 * nunca se dibuja borroso.
 */
export function pintar(canvas, ordenes, escala) {
  const dpr = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  const P = escala * dpr;
  const W = AN * P, H = AL * P;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${AN * escala}px`;
    canvas.style.height = `${AL * escala}px`;
  }
  const g = canvas.getContext('2d');

  const fondo = g.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, LCD.fondo[0]);
  fondo.addColorStop(1, LCD.fondo[1]);
  g.fillStyle = fondo;
  g.fillRect(0, 0, W, H);

  g.fillStyle = LCD.fantasma;
  for (let x = P; x < W; x += P) g.fillRect(x - Math.max(1, dpr / 2), 0, Math.max(1, dpr / 2), H);
  for (let y = P; y < H; y += P) g.fillRect(0, y - Math.max(1, dpr / 2), W, Math.max(1, dpr / 2));

  const on = pixeles(ordenes);
  g.fillStyle = LCD.sombra;
  for (const i of on) g.fillRect((i % AN + 1) * P, (Math.floor(i / AN) + 1) * P, P, P);
  g.fillStyle = LCD.tinta;
  for (const i of on) g.fillRect((i % AN) * P, Math.floor(i / AN) * P, P, P);

  const vineta = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.45, W / 2, H * 0.45, Math.max(W, H) * 0.75);
  vineta.addColorStop(0, 'rgba(0,0,0,0)');
  vineta.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = vineta;
  g.fillRect(0, 0, W, H);
}
