/**
 * La Red de Tránsito Pesado como dibujo (spec 2026-10-03-la-red-primero):
 * cuatro capas de la misma fuente que se leen como un tubo de cromo, la vía
 * más ancha del mapa, y siempre debajo de la ruta.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const { PARADAS } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js');
const { lineasDeLaRed, anclaDeLaRed, mezclar } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/red.js');

const COLORES = { canto: '#111111', cuerpo: '#222222', reflejo: '#333333', brillo: '#444444', rotulo: '#555555', halo: '#666666' };

/** Las paradas de un `interpolate` sobre el zoom: { 13: 5, 15: 10, … }. */
const paradas = (expr) => {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['exponential', 1.4], ['zoom']], 'el zoom va en el nivel superior');
  const pares = {};
  for (let i = 3; i < expr.length; i += 2) pares[expr[i]] = expr[i + 1];
  return pares;
};

const capa = (id) => lineasDeLaRed(COLORES).find((c) => c.id === id);

test('la Red es la vía más ancha del mapa en cada zoom', () => {
  assert.deepEqual(PARADAS.red, [6, 10, 22, 48]);

  for (const [clase, otra] of Object.entries(PARADAS)) {
    if (clase === 'red') continue;
    otra.forEach((px, i) => assert.ok(PARADAS.red[i] > px, `${clase} mide ${px} y la Red ${PARADAS.red[i]}`));
  }
});

test('el cromo son cuatro capas de la misma fuente, de abajo hacia arriba: canto, cuerpo, reflejo, brillo', () => {
  const capas = lineasDeLaRed(COLORES);

  assert.deepEqual(capas.map((c) => c.id), ['red-canto', 'red-linea', 'red-reflejo', 'red-brillo']);
  for (const c of capas) {
    assert.equal(c.type, 'line');
    assert.equal(c.source, 'red');
  }
  const [canto, cuerpo, reflejo, brillo] = capas.map((c) => c.paint['line-color']);
  assert.equal(canto, '#111111');
  assert.equal(cuerpo, '#222222');
  // El reflejo y el brillo llevan el color ya mezclado sobre lo que tienen abajo.
  assert.equal(reflejo, mezclar('#222222', '#333333', 0.55));
  assert.equal(brillo, mezclar(reflejo, '#444444', 0.75));
});

test('el canto rodea al cuerpo por 3 px; el reflejo y el brillo son una fracción del cuerpo', () => {
  const cuerpo = paradas(capa('red-linea').paint['line-width']);
  const canto = paradas(capa('red-canto').paint['line-width']);
  const reflejo = paradas(capa('red-reflejo').paint['line-width']);
  const brillo = paradas(capa('red-brillo').paint['line-width']);

  assert.deepEqual(cuerpo, { 13: 6, 15: 10, 17: 22, 19: 48 });
  for (const z of [13, 15, 17, 19]) {
    assert.equal(canto[z], cuerpo[z] + 3);
    assert.ok(Math.abs(reflejo[z] - cuerpo[z] * 0.55) < 1e-9);
    assert.ok(Math.abs(brillo[z] - cuerpo[z] * 0.18) < 1e-9);
  }
});

test('las capas del cromo son opacas: donde se tocan dos tramos no se suma brillo', () => {
  // Con opacidad, las puntas redondas de dos tramos vecinos se superponían y
  // cada unión salía como un punto más claro: un collar de puntos sobre la Red.
  for (const c of lineasDeLaRed(COLORES)) assert.equal(c.paint['line-opacity'], undefined, c.id);
});

test('mezclar dos colores', () => {
  assert.equal(mezclar('#000000', '#ffffff', 0), '#000000');
  assert.equal(mezclar('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mezclar('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mezclar('#8fb6de', '#cfe4f8', 0.55), '#b2cfec');
});

test('el brillo va centrado: ninguna capa de la Red se corre de su eje', () => {
  // Con line-offset el especular quedaría a la izquierda del sentido de cada
  // tramo, y como los tramos van en sentidos distintos saltaría de borde a borde.
  for (const c of lineasDeLaRed(COLORES)) assert.equal(c.paint['line-offset'], undefined, c.id);
});

test('la Red se apila debajo de la ruta si hay ruta, y si no debajo de los nombres de calle', () => {
  assert.equal(anclaDeLaRed((id) => ['route-casing', 'calles-nombre'].includes(id)), 'route-casing');
  assert.equal(anclaDeLaRed((id) => id === 'calles-nombre'), 'calles-nombre');
  // El raster de respaldo no tiene ninguna de las dos: va arriba de todo.
  assert.equal(anclaDeLaRed(() => false), undefined);
});
