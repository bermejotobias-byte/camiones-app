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

const { buildBasemapStyle, PARADAS, ANCHO_DE_RUTA, TAMANO_DE_PUNTA } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js');

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

test('la autopista no lleva línea punteada: la banda y los dos carriles alcanzan', () => {
  const punteadas = buildBasemapStyle('').layers
    .filter((l) => l.paint?.['line-dasharray'] && JSON.stringify(l.filter).includes('highway'))
    .map((l) => l.id);

  assert.deepEqual(punteadas, []);
  assert.ok(capa('autopista-carril-a') && capa('autopista-carril-b'));
});

const paradas = (expr) => {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['exponential', 1.4], ['zoom']], 'el zoom va en el nivel superior');
  const pares = {};
  for (let i = 3; i < expr.length; i += 2) pares[expr[i]] = expr[i + 1];
  return pares;
};

test('la ruta crece con el zoom como las calles: no tapa a las vecinas de lejos ni flota de cerca', () => {
  assert.deepEqual(paradas(ANCHO_DE_RUTA.linea), { 13: 4, 15: 7, 17: 14, 19: 30 });
  assert.deepEqual(paradas(ANCHO_DE_RUTA.canto), { 13: 7, 15: 10, 17: 17, 19: 33 });
});

test('la ruta es más angosta que la Red: se ve el tubo a los costados', () => {
  PARADAS.ruta.forEach((px, i) => assert.ok(px < PARADAS.red[i], `zoom ${[13, 15, 17, 19][i]}`));
});

test('la flecha de la maniobra acompaña a la ruta: tres cuartos de su ancho, canto +3, y la punta escala igual', () => {
  const ruta = paradas(ANCHO_DE_RUTA.linea);
  const flecha = paradas(ANCHO_DE_RUTA.flecha);
  const canto = paradas(ANCHO_DE_RUTA.flechaCanto);
  const punta = paradas(TAMANO_DE_PUNTA);

  for (const z of [13, 15, 17, 19]) {
    assert.ok(Math.abs(flecha[z] - ruta[z] * 0.75) < 1e-9, `flecha en ${z}`);
    assert.ok(Math.abs(canto[z] - (flecha[z] + 3)) < 1e-9, `canto en ${z}`);
    // La punta se dibujó para una línea de 6 px.
    assert.ok(Math.abs(punta[z] - flecha[z] / 6) < 1e-9, `punta en ${z}`);
  }
});
