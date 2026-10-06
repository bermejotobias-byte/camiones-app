/**
 * Las reglas de CRUZÁ, MONO (spec §2, §3 y §5). Los puntos son los mismos que el
 * servidor (Domain/Juegos/Cruza.cs): si cambian, cambian en los dos lados.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as R from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

test('el campo: 9 columnas y 13 filas de 24, con un HUD de 28', () => {
  assert.equal(R.COLUMNAS, 9);
  assert.equal(R.CEL, 24);
  assert.equal(R.FILAS_VISIBLES, 13);
  assert.equal(R.HUD, 28);
  assert.equal(R.ANCHO, 216);
  assert.equal(R.ALTO, 340);
});

test('el mono: un paso de 140 ms, 3 vidas, 0,9 s de golpe y 1,5 s invulnerable', () => {
  assert.equal(R.PASO_MS, 140);
  assert.equal(R.VIDAS, 3);
  assert.equal(R.GOLPE_MS, 900);
  assert.equal(R.INVULNERABLE_MS, 1500);
  assert.equal(R.COLUMNA_DE_LARGADA, 4);
  assert.equal(R.MONO_MAX_DESDE_ABAJO, 6);
  assert.equal(R.UMBRAL_DESLIZAR, 24);
});

test('SCORE = 10 × filas + 50 × cajas, y nada negativo', () => {
  assert.equal(R.puntos(0, 0), 0);
  assert.equal(R.puntos(1, 0), 10);
  assert.equal(R.puntos(73, 4), 930);
  assert.equal(R.puntos(-3, -1), 0);
});

test('las bandas de dificultad, como en la tabla de la spec', () => {
  assert.deepEqual(R.BANDAS.map((b) => b.desde), [0, 20, 60, 120]);
  assert.deepEqual(R.BANDAS.map((b) => b.velocidad), [1.5, 2.5, 3.5, 4.5]);
  assert.deepEqual(R.BANDAS.map((b) => b.camara), [4, 3, 2.5, 2]);
  assert.deepEqual(R.BANDAS.map((b) => b.calle), [[1, 2], [1, 3], [2, 4], [2, 5]]);
  assert.deepEqual(R.BANDAS.map((b) => b.rio), [[1, 2], [1, 3], [2, 3], [2, 4]]);
  assert.deepEqual(R.BANDAS.map((b) => b.troncos), [[3, 4], [2, 3], [2, 2], [2, 2]]);
  assert.deepEqual(R.BANDAS[0].reparto, [0.8, 0.2, 0]);
  for (const b of R.BANDAS.slice(1)) assert.deepEqual(b.reparto, [0.55, 0.3, 0.15]);
  assert.equal(R.banda(0).desde, 0);
  assert.equal(R.banda(19).desde, 0);
  assert.equal(R.banda(20).desde, 20);
  assert.equal(R.banda(500).desde, 120);
});

test('el mundo: playón cada 25, Obelisco en la 100, río 0,3 y galpones 0,18', () => {
  assert.equal(R.CADA_PLAYON, 25);
  assert.equal(R.FILA_OBELISCO, 100);
  assert.equal(R.PROB_RIO, 0.3);
  assert.equal(R.PROB_GALPONES, 0.18);
  assert.deepEqual(R.PROB_CAJA, { segura: 0.15, calle: 0.1, rio: 0.1 });
  assert.equal(R.VELOCIDAD_MINIMA, 0.8);
  assert.equal(R.FACTOR_LARGOS, 0.75);
  assert.equal(R.LARGOS_POR_CARRIL, 2);
});

test('los vehículos: 5 autos, 9 pinturas de la flota y 6 líneas, con su largo', () => {
  assert.deepEqual(R.AUTOS, ['torino', 'uno', 'fitito', '504', 'taxi']);
  assert.equal(R.FLOTA.length, 9);
  assert.deepEqual(R.LINEAS, ['152', '60', '29', '39', '64', '12']);
  assert.equal(R.largoDe('fitito'), 38);
  assert.equal(R.largoDe('tbf-cisterna'), 96);
  assert.equal(R.largoDe('colectivo-60'), 96);
});
