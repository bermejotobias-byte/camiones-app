/**
 * Las reglas de VIBORITA TBF (spec §4). Son los mismos números que el servidor
 * (Domain/Juegos/Viborita.cs): si cambian, cambian en los dos lados.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as R from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/reglas.js';

test('el campo es de 10 × 10 y caben 97 cajas', () => {
  assert.equal(R.COLUMNAS, 10);
  assert.equal(R.FILAS, 10);
  assert.equal(R.ACOPLADOS_AL_ARRANCAR, 2);
  assert.equal(R.CAJAS_MAXIMAS, 97);
});

test('cada caja vale los acoplados que llevas después de levantarla', () => {
  assert.deepEqual([0, 1, 2, 5, 97].map(R.puntos), [0, 3, 7, 25, 4947]);
});

test('el paso arranca en 260 ms, baja 20 cada 5 cajas y se planta en 140', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 29, 30, 60, 97].map(R.pasoMs), [260, 260, 240, 240, 220, 160, 140, 140, 140]);
  assert.equal(R.PASO_MAS_RAPIDO_MS, 140);
});

test('se encolan hasta dos giros', () => {
  assert.equal(R.GIROS_EN_COLA, 2);
});
