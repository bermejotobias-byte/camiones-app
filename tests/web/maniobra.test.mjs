/**
 * La flecha blanca sobre la calle: un pedazo corto de la ruta alrededor de la
 * próxima maniobra, con la punta apuntando hacia donde sigue. Es lo que Waze
 * dibuja sobre el mapa además de la banda (waze-06).
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareRoute, maneuverArrowPath } from '../../src/TruckNavigator.Api/wwwroot/js/navigation.js';

// Sobre el ecuador, 0,001° de longitud son 111,3 m: las cuentas se hacen a ojo.
const METRO = 1 / 111_319;

// Va hacia el este 111 m y dobla al norte otros 111 m. La maniobra es el vértice 1.
const ruta = () => prepareRoute({
  geometry: { coordinates: [[0, 0], [0.001, 0], [0.001, 0.001]] },
  instructions: []
});

test('la flecha arranca 25 m antes del giro, pasa por el vértice y sigue 45 m después', () => {
  const flecha = maneuverArrowPath(ruta(), 1, { before: 25, after: 45 });

  assert.equal(flecha.coordinates.length, 3);

  const [inicio, vertice, fin] = flecha.coordinates;
  assert.ok(Math.abs(inicio[0] - (0.001 - 25 * METRO)) < 1e-6, `arranca en ${inicio}`);
  assert.deepEqual(vertice, [0.001, 0]);
  assert.ok(Math.abs(fin[1] - 45 * METRO) < 1e-6, `termina en ${fin}`);
});

test('la punta apunta hacia donde sigue la ruta después del giro', () => {
  const flecha = maneuverArrowPath(ruta(), 1, { before: 25, after: 45 });

  // Después del giro se va al norte: rumbo 0.
  assert.ok(Math.abs(flecha.bearing) < 0.5, `rumbo ${flecha.bearing}`);
});

test('al principio y al final de la ruta la flecha se recorta en vez de salirse', () => {
  const alPrincipio = maneuverArrowPath(ruta(), 0, { before: 25, after: 45 });
  const alFinal = maneuverArrowPath(ruta(), 2, { before: 25, after: 45 });

  assert.deepEqual(alPrincipio.coordinates[0], [0, 0]);
  assert.deepEqual(alFinal.coordinates.at(-1), [0.001, 0.001]);
});

test('sin ruta o sin vértice no hay flecha', () => {
  assert.equal(maneuverArrowPath(null, 1), null);
  assert.equal(maneuverArrowPath(ruta(), 7), null);
  assert.equal(maneuverArrowPath(ruta(), -1), null);
});
