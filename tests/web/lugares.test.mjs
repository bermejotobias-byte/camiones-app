/**
 * La capa de lugares (el prototipo, tableros "Capas" y "Lugar"): qué pin le
 * toca a cada lugar —verificado, de la comunidad, sin confirmar—, cómo viaja
 * al mapa y cómo se piden al servidor.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estadoDelPin, contadorDelPin, featuresDeLugares, pinSvg, categoriasParaPedir, calcomaniaDeCategoria
} from '../../src/TruckNavigator.Api/wwwroot/js/mapa/lugares.js';

const sinVotos = { suitable: 0, notSuitable: 0, seal: 'NoVotesYet', forYourTruck: null, yourVote: null, contributed: null };

const lugar = (extra = {}) => ({
  id: 'a1', name: 'Gomería Los Amigos', category: 'TyreShop', latitude: -34.6, longitude: -58.4,
  verificationLevel: 'NotConfirmed', community: sinVotos, ...extra
});

/* ---------------------------------------------------------------------------
   El estado del pin
--------------------------------------------------------------------------- */

test('confirmado por la fuente, de la comunidad (aportado o con votos), o sin confirmar', () => {
  assert.equal(estadoDelPin(lugar({ verificationLevel: 'Confirmed' })), 'verificado');
  assert.equal(estadoDelPin(lugar({ community: { ...sinVotos, contributed: { at: '2026-09-12', byAlias: 'lauta' } } })), 'comunidad');
  assert.equal(estadoDelPin(lugar({ community: { ...sinVotos, suitable: 3, seal: 'Recommended' } })), 'comunidad');
  assert.equal(estadoDelPin(lugar()), 'sin');
  assert.equal(estadoDelPin(lugar({ verificationLevel: 'Probable' })), 'sin');
});

test('lo verificado sigue siendo verificado aunque la comunidad vote', () => {
  assert.equal(estadoDelPin(lugar({ verificationLevel: 'Confirmed', community: { ...sinVotos, suitable: 5 } })), 'verificado');
});

test('el contador es el total de votos, y sólo en los pines de la comunidad', () => {
  assert.equal(contadorDelPin(lugar({ community: { ...sinVotos, suitable: 2, notSuitable: 1, contributed: { at: '2026-09-12', byAlias: null } } })), 3);
  assert.equal(contadorDelPin(lugar({ community: { ...sinVotos, contributed: { at: '2026-09-12', byAlias: null } } })), null);
  assert.equal(contadorDelPin(lugar({ verificationLevel: 'Confirmed', community: { ...sinVotos, suitable: 5 } })), null);
  assert.equal(contadorDelPin(lugar()), null);
});

/* ---------------------------------------------------------------------------
   Al mapa
--------------------------------------------------------------------------- */

test('cada categoría del servidor tiene su calcomanía; una desconocida cae en el pin genérico', () => {
  assert.equal(calcomaniaDeCategoria('TyreShop'), 'gomeria');
  assert.equal(calcomaniaDeCategoria('TruckParking'), 'playa');
  assert.equal(calcomaniaDeCategoria('HeavyRoadsideAssistance'), 'auxilio');
  assert.equal(calcomaniaDeCategoria('Otra'), 'lugar');
});

test('los lugares viajan como GeoJSON: un punto por lugar con su icono y su contador', () => {
  const geojson = featuresDeLugares([
    lugar(),
    lugar({ id: 'b2', name: 'Taller El Tano', category: 'RepairShop', community: { ...sinVotos, suitable: 2, notSuitable: 1, contributed: { at: '2026-09-12', byAlias: 'lauta' } } })
  ]);

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 2);

  const [a, b] = geojson.features;
  assert.deepEqual(a.geometry, { type: 'Point', coordinates: [-58.4, -34.6] });
  assert.deepEqual(a.properties, { id: 'a1', nombre: 'Gomería Los Amigos', icono: 'pin-gomeria-sin', estado: 'sin', contador: '' });
  assert.deepEqual(b.properties, { id: 'b2', nombre: 'Taller El Tano', icono: 'pin-taller-comunidad', estado: 'comunidad', contador: '3' });
});

test('sin lugares, una colección vacía', () => {
  assert.deepEqual(featuresDeLugares([]), { type: 'FeatureCollection', features: [] });
  assert.deepEqual(featuresDeLugares(null), { type: 'FeatureCollection', features: [] });
});

test('el pin de 32: el anillo del estado y la calcomanía de la categoría adentro', () => {
  const verificado = pinSvg('gomeria', 'verificado');
  assert.ok(verificado.startsWith('<svg'));
  assert.ok(verificado.includes('stroke="#ffffff"'));
  assert.ok(verificado.includes('r="11.5"'), 'la calcomanía de la gomería');

  assert.ok(pinSvg('taller', 'comunidad').includes('stroke="#32ccfe"'));
  assert.ok(pinSvg('taller', 'sin').includes('stroke="#8b949e"'));
  assert.ok(pinSvg('inexistente', 'sin').includes('stroke="#8b949e"'), 'sin calcomanía sigue habiendo pin');
});

/* ---------------------------------------------------------------------------
   Al servidor
--------------------------------------------------------------------------- */

test('las categorías se piden con el nombre del servidor, en el orden de los chips', () => {
  assert.equal(categoriasParaPedir(['playa', 'gomeria']), 'TyreShop,TruckParking');
  assert.equal(categoriasParaPedir(['gomeria', 'inventada']), 'TyreShop');
  assert.equal(categoriasParaPedir([]), '');
});
