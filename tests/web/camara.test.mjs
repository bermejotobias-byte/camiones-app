/**
 * La cámara del viaje: qué gestos la sueltan y qué se puede hacer con dos
 * dedos según si hay viaje o no (AD-52, que enmienda AD-34).
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GESTOS_QUE_SUELTAN, sueltaLaCamara } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/camara.js';

const evento = { originalEvent: {} };   // un gesto del usuario trae el evento del dedo
const animacion = {};                   // un easeTo de la app, no

test('arrastrar, pellizcar y GIRAR sueltan la cámara: los tres son el usuario mirando otra cosa', () => {
  assert.deepEqual([...GESTOS_QUE_SUELTAN].sort(), ['dragstart', 'rotatestart', 'zoomstart']);
});

test('un giro con los dedos durante el viaje suelta la cámara, como arrastrar', () => {
  assert.equal(sueltaLaCamara({ navegando: true, siguiendo: true, evento }), true);
});

test('el giro que hace la app para seguir el rumbo NO la suelta: no trae evento del dedo', () => {
  // followVehicle gira el mapa con easeTo en cada latido del GPS, y eso
  // dispara rotatestart igual. Si contara, la cámara se soltaría sola.
  assert.equal(sueltaLaCamara({ navegando: true, siguiendo: true, evento: animacion }), false);
});

test('fuera del viaje, o con la cámara ya suelta, no hay nada que soltar', () => {
  assert.equal(sueltaLaCamara({ navegando: false, siguiendo: true, evento }), false);
  assert.equal(sueltaLaCamara({ navegando: true, siguiendo: false, evento }), false);
});
