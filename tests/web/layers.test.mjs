/**
 * La Red de Tránsito Pesado no se apaga (AD-53): es la referencia permanente
 * del mapa. Ni la hoja de capas ni una preferencia guardada de antes —con la
 * Red apagada desde el cuadro o desde el botón viejo de "capas de camión"— la
 * pueden esconder; las demás capas siguen respetando lo elegido.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLayerGroups, setLayerGroupVisible } from '../../src/TruckNavigator.Api/wwwroot/js/layers.js';

function mapaDePrueba() {
  const llamadas = [];
  return {
    llamadas,
    getLayer: () => true,
    setLayoutProperty: (id, propiedad, valor) => llamadas.push([id, propiedad, valor])
  };
}

test('la hoja de capas con la Red apagada no la esconde, y las demás capas sí obedecen', () => {
  const map = mapaDePrueba();

  applyLayerGroups(map, { red: false, galibo: false });

  assert.deepEqual(map.llamadas.filter(([id]) => id.startsWith('red-')), []);
  assert.ok(map.llamadas.some(([id, , valor]) => id === 'altura-senal' && valor === 'none'));
});

test('pedir que se apague la Red no hace nada', () => {
  const map = mapaDePrueba();

  setLayerGroupVisible(map, 'red', false);

  assert.deepEqual(map.llamadas, []);
});
