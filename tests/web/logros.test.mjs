/**
 * Las insignias de las pistas: que cada pista del servidor tenga su dibujo.
 *
 * Una pista sin entrada en PISTAS no se dibuja y no falla en consola: `insignia`
 * devuelve la cadena vacía y el escalón desaparece del perfil en silencio. Por
 * eso se fija acá la lista completa, la misma que TrackCatalog en el dominio.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PISTAS, insignia, tierColor } from '../../src/TruckNavigator.Api/wwwroot/js/logros.js';

test('las pistas del cliente son las del catálogo del servidor', () => {
  assert.deepEqual(
    Object.keys(PISTAS).sort(),
    ['kilometraje', 'lugares', 'nocturnos', 'repartos', 'viajes']
  );
});

test('la pista de lugares tiene diez escalones y se dibuja', () => {
  assert.equal(PISTAS.lugares.total, 10);
  assert.equal(PISTAS.lugares.nombre, 'Lugares');

  const html = insignia('lugares', 1, 3);

  assert.match(html, /logro-on/);
  assert.match(html, /title="Lugares"/);
  assert.match(html, /<b>3<\/b>/);
});

test('sin escalones la insignia está bloqueada, y una pista desconocida no dibuja nada', () => {
  assert.match(insignia('lugares', 0, 1), /logro-off/);
  assert.equal(insignia('inventada', 1, 1), '');
});

test('el color va por fracción del recorrido, no por índice', () => {
  assert.equal(tierColor(1, 10), tierColor(7, 70));
  assert.equal(tierColor(10, 10), tierColor(70, 70));
});
