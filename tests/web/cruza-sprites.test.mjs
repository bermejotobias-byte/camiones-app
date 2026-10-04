/**
 * Los sprites de CRUZÁ, MONO, portados del prototipo aprobado
 * (docs/diseno/prototipo-cruza/sprites.js): el mono de 24 × 24, las cabezas del HUD,
 * la gorra y la caja. Sin lienzo: se prueban las grillas y la paleta.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as S from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/sprites.js';

const MEDIDAS = {
  MONO_ATRAS: [24, 24], MONO_FRENTE: [24, 24], MONO_PARPADEO: [24, 24], MONO_LADO: [24, 24], MONO_GOLPE: [24, 24],
  GORRA: [4, 10], CABEZA: [12, 12], CABEZA_GUINO: [12, 12], CAJA: [14, 16]
};

test('cada sprite mide lo del prototipo, con todas sus filas del mismo largo', () => {
  for (const [nombre, [alto, ancho]] of Object.entries(MEDIDAS)) {
    assert.equal(S[nombre].length, alto, nombre);
    for (const fila of S[nombre]) assert.equal(fila.length, ancho, nombre);
  }
});

test('ningún píxel de un sprite queda sin color', () => {
  for (const nombre of Object.keys(MEDIDAS)) {
    const sin = [...new Set(S[nombre].join('').replace(/\./g, ''))].filter((ch) => !(ch in S.PAL));
    assert.deepEqual(sin, [], nombre);
  }
});

test('la vida perdida es la misma cabeza en gris', () => {
  assert.deepEqual(Object.keys(S.GRIS).sort(), Object.keys(S.PAL).sort());
  assert.ok(Object.values(S.GRIS).every((c) => c === '#2b313b'));
});

test('el texto mide seis píxeles por letra, sin el último espacio', () => {
  assert.equal(S.ancho('SCORE'), 29);
  assert.equal(S.ancho('HI-SCORE', 2), 94);
});
