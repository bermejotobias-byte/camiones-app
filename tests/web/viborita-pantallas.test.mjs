/**
 * Qué dibuja la LCD de VIBORITA TBF en cada pantalla (spec §3), como órdenes
 * puras, y qué píxeles prenden. El canvas sólo pinta lo que esto decide.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { inicio, jugando, pausa, fin, AN, AL } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/pantallas.js';
import { pixeles } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/lcd.js';
import { faltantes } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js';
import { crearPartida } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/motor.js';

const partida = crearPartida(() => 0);
const textos = (p) => [...p.ordenes.filter((o) => o.t !== undefined).map((o) => o.t), p.etiqueta, ...p.epigrafe];

const TODAS = [
  inicio({ record: 31 }), inicio({ record: null }),
  jugando(partida, { record: 31 }), pausa(partida, { record: 31 }),
  fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: true }),
  fin({ ...partida, estado: 'choco', motivo: 'borde', cajas: 9 }, { record: 117, nuevoRecord: true, guardado: true }),
  fin({ ...partida, estado: 'gano', cajas: 97 }, { record: 4947, nuevoRecord: true, guardado: true }),
  fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: false })
];

test('cada carácter de cada pantalla existe en la fuente', () => {
  for (const p of TODAS) for (const t of textos(p)) assert.deepEqual(faltantes(t), [], t);
});

test('el inicio: VIBORITA TBF, el récord con cuatro dígitos, JUGAR y TOCÁ EL CENTRO', () => {
  const p = inicio({ record: 31 });
  assert.ok(textos(p).includes('VIBORITA') && textos(p).includes('TBF'));
  assert.ok(textos(p).includes('RÉCORD 0031'));
  assert.equal(p.etiqueta, 'JUGAR');
  assert.deepEqual(p.epigrafe, ['TOCÁ EL CENTRO']);
  assert.ok(textos(inicio({ record: null })).includes('RÉCORD 0000'));
});

test('jugando: puntaje, acoplados, PAUSA y el récord abajo', () => {
  const p = jugando({ ...partida, cajas: 2 }, { record: 31 });
  assert.ok(textos(p).includes('0007'));
  assert.ok(textos(p).includes('X2'));
  assert.equal(p.etiqueta, 'PAUSA');
  assert.deepEqual(p.epigrafe, ['RÉCORD 0031']);
});

test('la pausa dice PAUSA encima del campo y el botón dice SEGUIR', () => {
  const p = pausa(partida, { record: 31 });
  assert.ok(p.ordenes.some((o) => o.op === 'borrar'));
  assert.ok(textos(p).includes('PAUSA'));
  assert.equal(p.etiqueta, 'SEGUIR');
});

test('al perder: GAME OVER, puntos, récord, acoplados y el motivo abajo', () => {
  const cola = fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: true });
  assert.ok(textos(cola).includes('GAME OVER'));
  assert.ok(textos(cola).includes('PUNTOS 0018'));
  assert.ok(textos(cola).includes('RÉCORD 0031'));
  assert.equal(cola.etiqueta, 'OTRA VEZ');
  assert.deepEqual(cola.epigrafe, ['TE ENGANCHASTE LA COLA']);

  const borde = fin({ ...partida, estado: 'choco', motivo: 'borde', cajas: 9 }, { record: 117, nuevoRecord: true, guardado: true });
  assert.ok(textos(borde).includes('¡NUEVO RÉCORD!'));
  assert.deepEqual(borde.epigrafe, ['CHOCASTE']);
});

test('al llenar el campo: ¡GANASTE!', () => {
  const p = fin({ ...partida, estado: 'gano', cajas: 97 }, { record: 4947, nuevoRecord: true, guardado: true });
  assert.ok(textos(p).includes('¡GANASTE!'));
  assert.deepEqual(p.epigrafe, ['LLENASTE EL CAMPO']);
});

test('si no se pudo guardar, el epígrafe lo dice', () => {
  const p = fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: false });
  assert.deepEqual(p.epigrafe, ['SIN SEÑAL:', 'RÉCORD NO GUARDADO']);
});

test('los píxeles: una línea prende sus puntos y borrar los apaga', () => {
  const prendidos = pixeles([{ op: 'linea', x0: 0, y0: 0, x1: 3, y1: 0 }, { op: 'borrar', x0: 1, y0: 0, x1: 1, y1: 0 }]);
  assert.deepEqual([...prendidos].sort((a, b) => a - b), [0, 2, 3]);
});

test('nada se dibuja afuera de la LCD', () => {
  for (const p of TODAS) for (const i of pixeles(p.ordenes)) assert.ok(i >= 0 && i < AN * AL, `${i}`);
});
