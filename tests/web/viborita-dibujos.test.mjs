/**
 * Los dibujos de VIBORITA TBF: los sprites del camión aprobados en el prototipo
 * (docs/diseno/prototipo-viborita/base-lcd.mjs) y la fuente de píxel 5 × 7.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SPRITES, FUENTE, spriteDe, faltantes, anchoDeTexto } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js';

test('los sprites aprobados, píxel por píxel', () => {
  assert.deepEqual(SPRITES.CAB_R, ['....#.....', '....#####.', '....##..#.', '....##..##', '....######', '....######', '##########', '.##....##.', '.##....##.', '..........']);
  assert.deepEqual(SPRITES.CAJA[2], '.#..##..#.');
  for (const [nombre, s] of Object.entries(SPRITES)) {
    assert.equal(s.length, 10, nombre);
    for (const fila of s) assert.equal(fila.length, 10, nombre);
  }
});

test('lo que va a la izquierda es el espejo, y lo que sube es el volteo', () => {
  assert.deepEqual(SPRITES.CAB_L, SPRITES.CAB_R.map((f) => [...f].reverse().join('')));
  assert.deepEqual(SPRITES.TRL_HL, SPRITES.TRL_H.map((f) => [...f].reverse().join('')));
  assert.deepEqual(SPRITES.CAB_U, [...SPRITES.CAB_D].reverse());
  assert.deepEqual(SPRITES.TRL_VU, [...SPRITES.TRL_V].reverse());
});

test('la cabina se dibuja según el rumbo', () => {
  const cuerpo = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
  assert.deepEqual(['der', 'izq', 'aba', 'arr'].map((r) => spriteDe(cuerpo, 0, r)), ['CAB_R', 'CAB_L', 'CAB_D', 'CAB_U']);
});

test('cada acoplado mira a la pieza de adelante, también en las curvas', () => {
  // Va a la derecha y dobla hacia abajo: la cabina en (6,6), la curva en (6,5).
  const cuerpo = [{ x: 6, y: 6 }, { x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }];
  assert.deepEqual([1, 2, 3].map((i) => spriteDe(cuerpo, i, 'aba')), ['TRL_V', 'TRL_H', 'TRL_H']);

  const subiendo = [{ x: 3, y: 2 }, { x: 3, y: 3 }];
  assert.equal(spriteDe(subiendo, 1, 'arr'), 'TRL_VU');
  const yendoIzq = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
  assert.equal(spriteDe(yendoIzq, 1, 'izq'), 'TRL_HL');
});

test('la fuente cubre las mayúsculas del castellano, los dígitos y los signos que se usan', () => {
  assert.deepEqual(faltantes('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ ÁÉÍÓÚ 0123456789 ¡!:<.'), []);
  for (const [c, g] of Object.entries(FUENTE)) {
    assert.equal(g.length, 7, c);
    for (const fila of g) assert.equal(fila.length, 5, c);
  }
});

test('un carácter que no está se informa, no se dibuja en blanco callado', () => {
  assert.deepEqual(faltantes('HOLA€'), ['€']);
});

test('el ancho de un texto: seis por letra menos el último espacio', () => {
  assert.equal(anchoDeTexto('TBF'), 17);
  assert.equal(anchoDeTexto('TBF', 2), 34);
});
