/**
 * Aportar un lugar (el prototipo, tableros "Aportar · ¿Qué hay acá?" y
 * "Marcar el lugar"): la grilla de categorías, la hoja de marcar y qué
 * nombre vale.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { hojaAportar, hojaMarcar, nombreValido, LARGO_MAXIMO } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/aportar.js';

test('"¿Qué hay acá?": un círculo por categoría, la cruz y lo que paga', () => {
  const html = hojaAportar();

  assert.ok(html.includes('¿Qué hay acá?'));
  assert.equal((html.match(/data-accion="categoria" data-id="[a-z]+"/g) ?? []).length, 6);
  assert.ok(html.includes('data-accion="cerrar"'));
  assert.ok(html.includes('+10 EXP'));
});

test('marcar el lugar: la categoría elegida, el nombre escrito y Guardar', () => {
  const html = hojaMarcar({ categoria: 'gomeria', nombre: 'Gomería El Tano' });

  assert.ok(html.includes('Gomería'), 'la categoría por su nombre en singular');
  assert.ok(html.includes('data-accion="categoria"'), 'tocar el chip vuelve a elegir');
  assert.ok(/value="Gomería El Tano"/.test(html));
  assert.ok(html.includes('id="gps-aportar-nombre"'));
  assert.ok(html.includes('data-accion="guardar"'));
  assert.ok(html.includes('Movés el mapa'));
});

test('el nombre se escapa y una categoría desconocida no rompe la hoja', () => {
  const html = hojaMarcar({ categoria: 'inventada', nombre: 'a "b" <c>' });

  assert.ok(!html.includes('<c>'));
  assert.ok(html.includes('&quot;b&quot;'));
  assert.ok(html.includes('Lugar'));
});

test('un nombre vale con tres letras o más y hasta el largo máximo; si no, se dice por qué', () => {
  assert.equal(nombreValido('Gomería El Tano'), null);
  assert.equal(nombreValido('  El Tano  '), null);
  assert.equal(nombreValido(''), 'Poné el nombre del lugar.');
  assert.equal(nombreValido('Go'), 'El nombre es muy corto.');
  assert.equal(nombreValido('x'.repeat(LARGO_MAXIMO + 1)), 'El nombre es muy largo.');
});
