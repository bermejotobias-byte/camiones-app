/**
 * El escenario de CRUZÁ, MONO: la letra gruesa de los carteles (spec §4.3), que tiene
 * que entrar en 3 celdas, y que ninguna leyenda caiga en un hueco.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GRUESA, anchoGruesa, pixelesGruesa } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/escenario.js';

const LEYENDAS = { 'EL MEJOR AMIGO': 64, 'DEL CAMIONERO': 62, 'RED DE TRÁNSITO': 66, PESADO: 29, 'TU GPS,': 28, 'BAJALA GRATIS': 59 };

test('la letra gruesa tiene cada letra de las tres leyendas', () => {
  for (const leyenda of Object.keys(LEYENDAS)) {
    const faltan = [...leyenda].filter((ch) => ch !== ' ' && !GRUESA[ch === 'Á' ? 'A' : ch]);
    assert.deepEqual(faltan, [], leyenda);
  }
});

test('las leyendas miden lo del prototipo y entran en un cartel de 72', () => {
  for (const [leyenda, ancho] of Object.entries(LEYENDAS)) {
    assert.equal(anchoGruesa(leyenda), ancho, leyenda);
    assert.ok(ancho <= 72 - 6, leyenda);
  }
});

test('la letra es angosta y gruesa: 4 × 7, la M y la N de 5, la I y la T de 3', () => {
  for (const [ch, g] of Object.entries(GRUESA)) {
    assert.equal(g.length, 7, ch);
    const ancho = g[0].length;
    if ('MN'.includes(ch)) assert.equal(ancho, 5, ch);
    else if ('IT'.includes(ch)) assert.equal(ancho, 3, ch);
    else if (ch === ',') assert.equal(ancho, 2);
    else if (ch === ' ') assert.equal(ancho, 1);
    else assert.equal(ancho, 4, ch);
  }
});

test('la Á lleva su acento arriba de la A', () => {
  const a = pixelesGruesa('A', 0, 10), aa = pixelesGruesa('Á', 0, 10);
  assert.equal(aa.length, a.length + 2);
  assert.ok(aa.some(([, y]) => y < 10));
});
