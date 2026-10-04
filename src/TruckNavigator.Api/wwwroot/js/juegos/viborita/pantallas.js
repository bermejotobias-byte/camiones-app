/**
 * Que dibuja la LCD de VIBORITA TBF en cada pantalla (spec §3).
 *
 * Devuelve ordenes de dibujo, no pixeles ni canvas: asi se prueba en node y la
 * vista solo pinta. Las coordenadas son pixeles de la LCD (102 x 128), las del
 * prototipo aprobado.
 */

import { spriteDe } from './dibujos.js';
import { puntos } from './reglas.js';

export const AN = 102;
export const AL = 128;
export const CAMPO_Y = 10;
export const CEL = 10;

const cuatro = (n) => String(Math.max(0, n ?? 0)).padStart(4, '0');

const texto = (t, x, y, k = 1) => ({ op: 'texto', t, x, y, k });
const centro = (t, y, k = 1) => ({ op: 'centro', t, y, k });
const sprite = (n, x, y) => ({ op: 'sprite', n, x, y });
const linea = (x0, y0, x1, y1) => ({ op: 'linea', x0, y0, x1, y1 });
const marco = (x0, y0, x1, y1) => ({ op: 'marco', x0, y0, x1, y1 });
const borrar = (x0, y0, x1, y1) => ({ op: 'borrar', x0, y0, x1, y1 });

/** La linea de abajo y lo que hace el boton del medio, centrado. */
const pie = (etiqueta) => [linea(0, AL - 11, AN - 1, AL - 11), centro(etiqueta, AL - 8)];

/** El camion de costado, decorativo: n acoplados y la cabina. */
const camionDeCostado = (x, y, acoplados) => [
  ...Array.from({ length: acoplados }, (_, i) => sprite('TRL_H', x + i * CEL, y)),
  sprite('CAB_R', x + acoplados * CEL, y)
];

export function inicio({ record }) {
  const etiqueta = 'JUGAR';
  return {
    ordenes: [
      { op: 'estado' },
      centro('VIBORITA', 16, 2), centro('TBF', 34, 2),
      ...camionDeCostado(14, 58, 3), sprite('CAJA', 76, 58),
      centro(`RÉCORD ${cuatro(record)}`, 84),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe: ['TOCÁ EL CENTRO']
  };
}

function campo(partida) {
  const ordenes = [marco(0, CAMPO_Y - 1, AN - 1, CAMPO_Y + 10 * CEL + 1)];
  partida.cuerpo.forEach((c, i) => ordenes.push(sprite(spriteDe(partida.cuerpo, i, partida.rumbo), 1 + c.x * CEL, CAMPO_Y + 1 + c.y * CEL)));
  if (partida.caja) ordenes.push(sprite('CAJA', 1 + partida.caja.x * CEL, CAMPO_Y + 1 + partida.caja.y * CEL));
  return ordenes;
}

export function jugando(partida, { record }) {
  const etiqueta = 'PAUSA';
  const acoplados = `X${partida.cuerpo.length - 1}`;
  return {
    ordenes: [
      texto(cuatro(puntos(partida.cajas)), 1, 1),
      texto(acoplados, AN - (acoplados.length * 6 - 1) - 1, 1),
      ...campo(partida),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe: [`RÉCORD ${cuatro(record)}`]
  };
}

export function pausa(partida, { record }) {
  const base = jugando(partida, { record });
  const etiqueta = 'SEGUIR';
  return {
    ordenes: [
      ...base.ordenes.slice(0, -2),
      borrar(24, 50, 77, 66), marco(24, 50, 77, 66), centro('PAUSA', 55),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe: base.epigrafe
  };
}

const MOTIVO = { cola: 'TE ENGANCHASTE LA COLA', borde: 'CHOCASTE' };

export function fin(partida, { record, nuevoRecord, guardado }) {
  const etiqueta = 'OTRA VEZ';
  const gano = partida.estado === 'gano';
  const acoplados = partida.cuerpo.length - 1;
  const epigrafe = guardado === false
    ? ['SIN SEÑAL:', 'RÉCORD NO GUARDADO']
    : [gano ? 'LLENASTE EL CAMPO' : MOTIVO[partida.motivo] ?? MOTIVO.cola];

  return {
    ordenes: [
      { op: 'estado' },
      centro(gano ? '¡GANASTE!' : 'GAME OVER', 14),
      linea(10, 24, AN - 11, 24),
      // La pared es del choque: al ganar, el camión no choca contra nada.
      ...camionDeCostado(16, 32, 4), ...(gano ? [] : [linea(68, 30, 68, 42)]),
      centro(`PUNTOS ${cuatro(puntos(partida.cajas))}`, 54),
      centro(nuevoRecord ? '¡NUEVO RÉCORD!' : `RÉCORD ${cuatro(record)}`, 66),
      centro(`X${acoplados} ACOPLADOS`, 78),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe
  };
}
