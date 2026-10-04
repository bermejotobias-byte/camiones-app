/**
 * Los vehículos de CRUZÁ, MONO, portados del rasterizador de siluetas del prototipo:
 * cada modelo es una grilla de partes que recibe luz, sombra y contorno. Sin lienzo:
 * se arma la grilla y se mira que cada parte tenga color y cada rueda quepa.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MODELOS, construir } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/vehiculos.js';
import { AUTOS, FLOTA, LINEAS, largoDe } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

const QUE_SALEN = [...AUTOS, ...FLOTA.map((p) => 'tbf-' + p), ...LINEAS.map((l) => 'colectivo-' + l)];

test('están los 21 modelos: los que salen a la calle y el colectivo de muestra', () => {
  assert.equal(Object.keys(MODELOS).length, 21);
  for (const nombre of QUE_SALEN) assert.ok(MODELOS[nombre], nombre);
});

test('cada modelo mide lo que el motor usa para chocar', () => {
  for (const nombre of QUE_SALEN) assert.equal(MODELOS[nombre].L, largoDe(nombre), nombre);
});

test('cada modelo se arma, sin partes sin color', () => {
  for (const [nombre, d] of Object.entries(MODELOS)) {
    const g = construir(d.L, d.H, d.pintar);
    assert.equal(g.length, d.H, nombre);
    assert.ok(g.every((fila) => fila.length === d.L), nombre);
    const partes = new Set(g.flat().filter(Boolean));
    assert.ok(partes.size > 0, nombre);
    assert.deepEqual([...partes].filter((p) => !d.pal[p]), [], nombre);
  }
});

test('las ruedas quedan adentro del vehículo', () => {
  for (const [nombre, d] of Object.entries(MODELOS)) {
    for (const [x, y, r] of d.ruedas) {
      assert.ok(x - r >= 0 && x + r <= d.L && y + r <= d.H, `${nombre}: rueda en ${x},${y}`);
    }
  }
});
