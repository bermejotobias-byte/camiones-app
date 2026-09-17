/**
 * Los globos de las calles que vienen, clavados en la calle (waze-06 y
 * waze-08): cuáles se muestran, dónde, y cómo se parte un nombre largo.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { globosDeRuta, partirNombre, abreviarCalle } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/viaje.js';

/* ---------------------------------------------------------------------------
   Nombres
--------------------------------------------------------------------------- */

test('las vías se abrevian como en los carteles: Av., Diag., Au., Dr., Gral.', () => {
  assert.equal(abreviarCalle('Avenida Perito Moreno'), 'Av. Perito Moreno');
  assert.equal(abreviarCalle('Diagonal Norte'), 'Diag. Norte');
  assert.equal(abreviarCalle('Autopista 25 de Mayo'), 'Au. 25 de Mayo');
  assert.equal(abreviarCalle('Doctor Antonio Sáenz'), 'Dr. Antonio Sáenz');
  assert.equal(abreviarCalle('Avenida General Paz'), 'Av. Gral. Paz');
  assert.equal(abreviarCalle('Junín'), 'Junín');
});

test('un nombre corto va en una línea', () => {
  assert.deepEqual(partirNombre('Junín', 14), ['Junín']);
  assert.deepEqual(partirNombre('Av. Sáenz', 14), ['Av. Sáenz']);
});

test('un nombre largo se parte en dos líneas por el espacio más cercano al medio', () => {
  assert.deepEqual(partirNombre('Av. de los Constituyentes', 14), ['Av. de los', 'Constituyentes']);
  assert.deepEqual(partirNombre('Av. Amancio Alcorta', 14), ['Av. Amancio', 'Alcorta']);
});

test('lo que no entra ni en dos líneas se corta con puntos suspensivos', () => {
  const lineas = partirNombre('Av. Presidente Figueroa Alcorta', 14);

  assert.equal(lineas.length, 2);
  assert.ok(lineas.every((l) => l.length <= 15), `líneas ${JSON.stringify(lineas)}`);
  assert.match(lineas[1], /…$/);
});

/* ---------------------------------------------------------------------------
   Qué globos
--------------------------------------------------------------------------- */

const coords = Array.from({ length: 32 }, (_, i) => [-58.41 + i * 0.001, -34.65]);

const instr = (kind, streetName, from, to) => ({ kind, streetName, text: '', fromPointIndex: from, toPointIndex: to });

const route = {
  geometry: { coordinates: coords },
  instructions: [
    instr('Continue', 'Avenida Sáenz', 0, 3),
    instr('Right', 'Avenida Perito Moreno', 3, 14),
    instr('Right', 'Avenida Amancio Alcorta', 14, 18),
    instr('KeepLeft', '', 18, 27),
    instr('SharpRight', 'Pepirí', 27, 28),
    instr('Finish', '', 31, 31)
  ]
};

test('los globos son las dos próximas calles con nombre, cada uno en su vértice', () => {
  const globos = globosDeRuta(route, { stepIndex: 0, next: route.instructions[1] });

  assert.deepEqual(globos.map((g) => g.nombre), ['Av. Perito Moreno', 'Av. Amancio Alcorta']);
  assert.deepEqual(globos[0].punto, coords[3]);
  assert.deepEqual(globos[1].punto, coords[14]);
  assert.deepEqual(globos[0].lineas, ['Av. Perito', 'Moreno']);
});

test('un tramo sin nombre y la llegada no llevan globo', () => {
  const globos = globosDeRuta(route, { stepIndex: 2, next: route.instructions[3] });

  assert.deepEqual(globos.map((g) => g.nombre), ['Pepirí']);
});

test('dos tramos seguidos por la misma calle dan un solo globo', () => {
  const repetida = {
    geometry: { coordinates: coords },
    instructions: [
      instr('Continue', 'Avenida Sáenz', 0, 3),
      instr('SlightLeft', 'Avenida Sáenz', 3, 8),
      instr('Right', 'Junín', 8, 12),
      instr('Finish', '', 12, 12)
    ]
  };

  const globos = globosDeRuta(repetida, { stepIndex: 0, next: repetida.instructions[1] });

  assert.deepEqual(globos.map((g) => g.nombre), ['Junín']);
});

test('sin estado de navegación no hay globos', () => {
  assert.deepEqual(globosDeRuta(route, null), []);
  assert.deepEqual(globosDeRuta(null, { stepIndex: 0 }), []);
});
