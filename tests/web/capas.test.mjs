/**
 * La hoja de capas (el prototipo, tablero "Capas"): qué capas hay, cuáles
 * están prendidas según lo guardado —incluido lo que se guardó con los dos
 * botones viejos— y cómo se dibuja la hoja.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CAPAS_DEL_CAMION, capasActivas, textoDeSoloAptos, hojaCapas } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/capas.js';

test('las cinco capas del camión, con su calcomanía; los pasos a nivel y las zonas llevan nota', () => {
  assert.deepEqual(CAPAS_DEL_CAMION.map((c) => c.id), ['red', 'galibo', 'paso', 'radar', 'zona']);
  for (const c of CAPAS_DEL_CAMION) assert.ok(c.calcomania && c.nombre, c.id);
  assert.equal(CAPAS_DEL_CAMION.find((c) => c.id === 'paso').nota, 'sólo en viaje');
  assert.equal(CAPAS_DEL_CAMION.find((c) => c.id === 'zona').nota, 'comunidad');
});

test('sin nada guardado: todo prendido salvo las zonas peligrosas, que arrancan apagadas', () => {
  assert.deepEqual(capasActivas({}), { red: true, galibo: true, paso: true, radar: true, zona: false });
});

test('lo guardado con los dos botones viejos se respeta: capas de camión apagadas, zonas prendidas', () => {
  assert.deepEqual(capasActivas({ truckLayers: false, riskZones: true }), { red: false, galibo: false, paso: false, radar: true, zona: true });
});

test('lo guardado por capa manda sobre lo viejo, y lo que falta cae en el defecto', () => {
  assert.deepEqual(capasActivas({ truckLayers: false, capas: { red: true, zona: true } }), { red: true, galibo: true, paso: true, radar: true, zona: true });
});

test('el interruptor dice para qué camión y cuántos lugares oculta', () => {
  assert.deepEqual(textoDeSoloAptos({ camion: { name: 'El Rayo' }, ocultos: 7 }), { titulo: 'Sólo aptos para El Rayo', sub: 'Oculta 7 lugares sin dato' });
  assert.deepEqual(textoDeSoloAptos({ camion: { name: 'El Rayo' }, ocultos: 1 }), { titulo: 'Sólo aptos para El Rayo', sub: 'Oculta 1 lugar sin dato' });
  assert.deepEqual(textoDeSoloAptos({ camion: { name: 'El Rayo' }, ocultos: 0 }), { titulo: 'Sólo aptos para El Rayo', sub: 'No oculta ninguno de los que se ven' });
  assert.deepEqual(textoDeSoloAptos({ camion: { name: 'El Rayo' }, ocultos: null }), { titulo: 'Sólo aptos para El Rayo', sub: 'Lo que la fuente o la comunidad no confirman, no se muestra' });
  assert.deepEqual(textoDeSoloAptos({ camion: null, ocultos: 3 }), { titulo: 'Sólo aptos para tu camión', sub: 'Elegí un camión para filtrar' });
});

test('la hoja: un cuadro por capa y por categoría, el prendido marcado, el interruptor y aportar', () => {
  const html = hojaCapas({
    capas: { red: true, galibo: false, paso: true, radar: true, zona: false },
    categorias: ['gomeria'],
    soloAptos: true,
    camion: { name: 'El Rayo' },
    ocultos: 7
  });

  const cuadros = html.match(/data-accion="capa" data-id="[a-z]+"/g);
  assert.equal(cuadros.length, 5);
  assert.equal((html.match(/data-accion="categoria" data-id="[a-z]+"/g) ?? []).length, 6);

  const red = html.match(/<button[^>]*data-id="red"[^>]*>/)[0];
  const galibo = html.match(/<button[^>]*data-id="galibo"[^>]*>/)[0];
  const gomeria = html.match(/<button[^>]*data-accion="categoria" data-id="gomeria"[^>]*>/)[0];
  const taller = html.match(/<button[^>]*data-accion="categoria" data-id="taller"[^>]*>/)[0];
  assert.ok(red.includes('is-on') && !galibo.includes('is-on'));
  assert.ok(gomeria.includes('is-on') && !taller.includes('is-on'));

  assert.ok(html.includes('Sólo aptos para El Rayo') && html.includes('Oculta 7 lugares sin dato'));
  assert.ok(/data-accion="solo-aptos"[^>]*aria-checked="true"/.test(html));
  assert.ok(html.includes('data-accion="cerrar"'));
  assert.ok(html.includes('data-accion="aportar"'));
});

test('sin camión el interruptor queda deshabilitado', () => {
  const html = hojaCapas({ capas: capasActivas({}), categorias: [], soloAptos: false, camion: null, ocultos: null });
  assert.ok(/data-accion="solo-aptos"[^>]*disabled/.test(html));
});
