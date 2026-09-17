/**
 * Lo que dice una tarjeta de ruta: por dónde va, y la línea de tiempo con lo
 * que hay en el camino (waze-01, waze-02 y el prototipo).
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { porDonde, lineaDeTiempo, opcionesDeRuta, elegirAlternativa, mismaRuta } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/rutas.js';

/* ---------------------------------------------------------------------------
   Las opciones que devuelve el servidor
--------------------------------------------------------------------------- */

const respuesta = { distanceMeters: 2200, alternatives: [{ distanceMeters: 2700 }, { distanceMeters: 3100 }] };

test('las opciones son la recomendada y sus alternativas, en ese orden', () => {
  assert.deepEqual(opcionesDeRuta(respuesta).map((r) => r.distanceMeters), [2200, 2700, 3100]);
  assert.deepEqual(opcionesDeRuta({ distanceMeters: 2200 }).map((r) => r.distanceMeters), [2200]);
  assert.deepEqual(opcionesDeRuta(null), []);
});

test('una opción que va por las mismas vías y mide lo mismo es la ruta que ya se sigue', () => {
  const actual = { por: 'Por Av. Sáenz; Av. Perito Moreno', metros: 1900 };

  assert.equal(mismaRuta(actual, { por: 'Por Av. Sáenz; Av. Perito Moreno', metros: 1940 }), true);
  assert.equal(mismaRuta(actual, { por: 'Por Av. Sáenz; Av. Perito Moreno', metros: 2400 }), false);
  assert.equal(mismaRuta(actual, { por: 'Por Av. Perito Moreno; Av. Amancio Alcorta', metros: 1900 }), false);
});

test('elegir una alternativa devuelve esa ruta; una posición que no existe, la recomendada', () => {
  assert.equal(elegirAlternativa(respuesta, 1).distanceMeters, 2700);
  assert.equal(elegirAlternativa(respuesta, 0).distanceMeters, 2200);
  assert.equal(elegirAlternativa(respuesta, 7).distanceMeters, 2200);
  assert.equal(elegirAlternativa(respuesta, -1).distanceMeters, 2200);
  assert.equal(elegirAlternativa(null, 0), null);
});

/* ---------------------------------------------------------------------------
   Por dónde
--------------------------------------------------------------------------- */

const instr = (streetName, distanceMeters, kind = 'Continue') => ({ streetName, distanceMeters, kind });

test('"Por" nombra las dos vías más largas, en el orden en que se toman', () => {
  const instrucciones = [
    instr('Avenida Sáenz', 500),
    instr('Avenida Perito Moreno', 1000),
    instr('Pepirí', 130),
    instr('Avenida Amancio Alcorta', 460),
    instr('', 0, 'Finish')
  ];

  // Perito Moreno es la mas larga, pero Saenz se toma antes: se leen en el orden del viaje.
  assert.equal(porDonde(instrucciones), 'Por Av. Sáenz; Av. Perito Moreno');
});

test('la misma vía en varios tramos suma, y se cuenta una vez', () => {
  const instrucciones = [
    instr('Avenida Sáenz', 300),
    instr('Junín', 400),
    instr('Avenida Sáenz', 300)
  ];

  assert.equal(porDonde(instrucciones), 'Por Av. Sáenz; Junín');
});

test('desde un paso dado se ignora lo ya recorrido', () => {
  const instrucciones = [
    instr('Avenida Sáenz', 5000),
    instr('Junín', 400),
    instr('Pepirí', 130)
  ];

  assert.equal(porDonde(instrucciones, 1), 'Por Junín; Pepirí');
});

test('sin nombres no hay "Por"', () => {
  assert.equal(porDonde([instr('', 100), instr('', 0, 'Finish')]), '');
  assert.equal(porDonde([]), '');
  assert.equal(porDonde(null), '');
});

/* ---------------------------------------------------------------------------
   La línea de tiempo
--------------------------------------------------------------------------- */

// Una ruta de 1000 m en diez vértices de 100 m.
const preparada = { cumulative: Array.from({ length: 11 }, (_, i) => i * 100), totalMeters: 1000 };

test('cada aviso cae en la línea según a qué altura del recorrido está', () => {
  const { marcas } = lineaDeTiempo(preparada, {
    alerts: [{ tipo: 'radar', at: 250 }, { tipo: 'galibo', at: 500 }, { tipo: 'paso', at: 900 }]
  });

  assert.deepEqual(marcas, [
    { pos: 25, icono: 'radar' },
    { pos: 50, icono: 'galiboOk' },
    { pos: 90, icono: 'paso' }
  ]);
});

test('lo ya recorrido queda afuera y el resto se mide sobre lo que falta', () => {
  const { marcas } = lineaDeTiempo(preparada, {
    travelled: 500,
    alerts: [{ tipo: 'radar', at: 250 }, { tipo: 'radar', at: 750 }]
  });

  assert.deepEqual(marcas, [{ pos: 50, icono: 'radar' }]);
});

test('los tramos fuera de la Red se pintan amarillos por su parte del recorrido', () => {
  const { tramos } = lineaDeTiempo(preparada, {
    accessLegs: [{ fromPointIndex: 0, toPointIndex: 2 }, { fromPointIndex: 8, toPointIndex: 10 }]
  });

  assert.deepEqual(tramos, [[0, 20], [80, 100]]);
});

test('un tramo fuera de la Red que ya se pasó en parte se recorta', () => {
  const { tramos } = lineaDeTiempo(preparada, {
    travelled: 100,
    accessLegs: [{ fromPointIndex: 0, toPointIndex: 4 }]
  });

  // Faltan 900 m; del tramo quedan 300 (de 100 a 400): el primer tercio.
  assert.deepEqual(tramos, [[0, 33.3]]);
});

test('sin ruta no hay línea', () => {
  assert.deepEqual(lineaDeTiempo(null, {}), { marcas: [], tramos: [] });
  assert.deepEqual(lineaDeTiempo({ cumulative: [0], totalMeters: 0 }, {}), { marcas: [], tramos: [] });
});
