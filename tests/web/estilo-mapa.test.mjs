/**
 * El estilo del mapa base: desde qué zoom se ve cada clase de calle.
 *
 * Medido en el teléfono el 18/09/2026: al alejar el mapa para ver la Ciudad
 * entera (zoom 10–11) desaparecían TODAS las calles y quedaba la Red sola
 * flotando sobre el fondo, porque cada capa de calles nacía en el zoom 11.
 * Como en Waze, de lejos tienen que quedar las autopistas y las avenidas
 * principales; las calles chicas aparecen al acercarse.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// El estilo lee los colores del tema con getComputedStyle: se le da un
// documento de mentira con un color cualquiera.
globalThis.document = { documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#123456' });

const { buildBasemapStyle } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js');

const capa = (id) => buildBasemapStyle('').layers.find((l) => l.id === id);

test('de lejos quedan las autopistas y las vías principales; las avenidas un poco más cerca', () => {
  assert.equal(capa('autopista').minzoom, 8);
  assert.equal(capa('principales').minzoom, 9);
  assert.equal(capa('avenidas').minzoom, 10);
});

test('las calles chicas y los senderos aparecen recién al acercarse', () => {
  assert.equal(capa('calles').minzoom, 12);
  assert.equal(capa('senderos').minzoom, 14);
});

test('el borde de día acompaña a su calle desde el mismo zoom', () => {
  assert.equal(capa('calles-borde').minzoom, capa('calles').minzoom);
  assert.equal(capa('avenidas-borde').minzoom, capa('avenidas').minzoom);
  assert.equal(capa('principales-borde').minzoom, capa('principales').minzoom);
});
