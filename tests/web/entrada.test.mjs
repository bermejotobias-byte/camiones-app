/**
 * La entrada: el orden de los pasos y el chip que dice en cuál va.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PASOS_DE_LA_ENTRADA, chipDePaso, pasoSiguiente } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js';

test('la entrada son cuatro pasos, en el orden del brainstorm v3', () => {
  assert.deepEqual(PASOS_DE_LA_ENTRADA, ['bienvenida', 'idioma', 'condiciones', 'acceso']);
});

test('el chip dice el paso sobre cuatro, como el tablero del prototipo', () => {
  assert.deepEqual(chipDePaso('idioma'), { etiqueta: 'Paso', valor: '2 de 4' });
  assert.deepEqual(chipDePaso('condiciones'), { etiqueta: 'Paso', valor: '3 de 4' });
});

test('la bienvenida y el acceso no llevan chip: son pantallas enteras, no los pasos de un trámite', () => {
  assert.equal(chipDePaso('bienvenida'), null);
  assert.equal(chipDePaso('acceso'), null);
});

test('el camión del invitado no lleva chip: ya pasó la puerta y no es un quinto paso', () => {
  // El prototipo fija "Paso 2 de 4"; numerar esto como 5 lo contradiría.
  assert.equal(chipDePaso('camion'), null);
});

test('un paso que no existe no lleva chip en vez de romper la cabecera', () => {
  assert.equal(chipDePaso('cualquiera'), null);
});

test('cada paso sabe cuál sigue, y el último no sigue a ninguno', () => {
  assert.equal(pasoSiguiente('bienvenida'), 'idioma');
  assert.equal(pasoSiguiente('idioma'), 'condiciones');
  assert.equal(pasoSiguiente('condiciones'), 'acceso');
  assert.equal(pasoSiguiente('acceso'), null);
});
