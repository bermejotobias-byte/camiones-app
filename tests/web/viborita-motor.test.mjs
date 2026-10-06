/**
 * El motor de VIBORITA TBF: el Snake, paso a paso (spec §4). Puro: el azar se
 * inyecta, así cada caso es exacto.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPartida, girar, avanzar, ponerCaja } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/motor.js';

const fijo = (v) => () => v;
const partida = (cuerpo, rumbo, extra = {}) => ({ cuerpo, rumbo, giros: [], caja: { x: 9, y: 9 }, cajas: 0, estado: 'jugando', motivo: null, ...extra });
const cabeza = (p) => p.cuerpo[0];

test('arranca con la cabina y dos acoplados en la fila del medio, yendo a la derecha', () => {
  const p = crearPartida(fijo(0));

  assert.deepEqual(p.cuerpo, [{ x: 2, y: 5 }, { x: 1, y: 5 }, { x: 0, y: 5 }]);
  assert.equal(p.rumbo, 'der');
  assert.equal(p.estado, 'jugando');
  assert.ok(!p.cuerpo.some((c) => c.x === p.caja.x && c.y === p.caja.y));
});

test('avanza una celda por paso y la cola la sigue', () => {
  const { partida: p, evento } = avanzar(crearPartida(fijo(0.99)));

  assert.equal(evento, null);
  assert.deepEqual(p.cuerpo, [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }]);
});

test('gira', () => {
  const p = avanzar(girar(crearPartida(fijo(0.99)), 'aba')).partida;

  assert.deepEqual(cabeza(p), { x: 2, y: 6 });
  assert.equal(p.rumbo, 'aba');
});

test('el giro en U se ignora', () => {
  const p = girar(crearPartida(fijo(0.99)), 'izq');

  assert.deepEqual(p.giros, []);
});

test('se encolan dos giros y no tres, y los dos se respetan en orden', () => {
  let p = crearPartida(fijo(0.99));
  p = girar(girar(girar(p, 'aba'), 'izq'), 'arr');

  assert.deepEqual(p.giros, ['aba', 'izq']);

  p = avanzar(p).partida;
  assert.deepEqual(cabeza(p), { x: 2, y: 6 });
  p = avanzar(p).partida;
  assert.deepEqual(cabeza(p), { x: 1, y: 6 });
});

test('levantar una caja suma un acoplado y una caja nueva', () => {
  const p0 = partida([{ x: 2, y: 5 }, { x: 1, y: 5 }, { x: 0, y: 5 }], 'der', { caja: { x: 3, y: 5 } });

  const { partida: p, evento } = avanzar(p0, fijo(0));

  assert.equal(evento, 'caja');
  assert.equal(p.cajas, 1);
  assert.equal(p.cuerpo.length, 4);
  assert.deepEqual(cabeza(p), { x: 3, y: 5 });
  assert.ok(!p.cuerpo.some((c) => c.x === p.caja.x && c.y === p.caja.y));
});

test('chocar contra el borde termina la partida y el camión queda donde estaba', () => {
  const cuerpo = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
  const { partida: p, evento } = avanzar(partida(cuerpo, 'der'));

  assert.equal(evento, 'choque');
  assert.equal(p.estado, 'choco');
  assert.equal(p.motivo, 'borde');
  assert.deepEqual(p.cuerpo, cuerpo);
});

test('chocar contra un acoplado propio termina la partida', () => {
  // Una U: la cabina va a la izquierda contra el segundo acoplado.
  const cuerpo = [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }];
  const { partida: p, evento } = avanzar(partida(cuerpo, 'izq'));

  assert.equal(evento, 'choque');
  assert.equal(p.motivo, 'cola');
});

test('perseguirse la cola no es choque: la celda que deja la cola ese paso está libre', () => {
  const cuerpo = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }];
  const { partida: p, evento } = avanzar(partida(cuerpo, 'izq'));

  assert.equal(evento, null);
  assert.deepEqual(cabeza(p), { x: 0, y: 0 });
});

test('la caja nunca cae sobre el camión', () => {
  const cuerpo = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  for (let i = 0; i < 100; i++) {
    const caja = ponerCaja(cuerpo, fijo(i / 100));
    assert.ok(!cuerpo.some((c) => c.x === caja.x && c.y === caja.y), `azar ${i / 100}`);
  }
});

test('con el campo lleno no hay caja, y llenarlo es ganar', () => {
  // Un recorrido en zigzag por las 100 celdas: el camión ocupa 99 y la caja la última.
  const zigzag = [];
  for (let y = 0; y < 10; y++) for (let i = 0; i < 10; i++) zigzag.push({ x: y % 2 ? 9 - i : i, y });

  assert.equal(ponerCaja(zigzag, fijo(0)), null);

  const cuerpo = zigzag.slice(0, 99).reverse();
  const { partida: p, evento } = avanzar(partida(cuerpo, 'izq', { caja: zigzag[99] }));

  assert.equal(evento, 'gano');
  assert.equal(p.estado, 'gano');
  assert.equal(p.caja, null);
});

test('una partida terminada no se mueve más', () => {
  const p0 = partida([{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }], 'der', { estado: 'choco', motivo: 'borde' });

  assert.deepEqual(avanzar(p0), { partida: p0, evento: null });
});
