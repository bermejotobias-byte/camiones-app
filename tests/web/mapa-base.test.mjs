/**
 * El archivo del mapa base se lee con una caché que guarda SÓLO lo que salió
 * bien (AD-54).
 *
 * La caché de fábrica de la librería PMTiles (`SharedPromiseCache`) guarda el
 * pedido de cada directorio antes de saber si salió bien y no lo borra si
 * falla: medido el 03/10/2026, dos 502 dejaron siete tiles fallando para
 * siempre —cada reintento recibía el mismo error sin salir a la red—.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const agregados = [];
let protocolos = 0;

class ResolvedValueCache {}
class SharedPromiseCache {}

globalThis.pmtiles = {
  ResolvedValueCache,
  SharedPromiseCache,
  PMTiles: class { constructor(url, cache) { this.url = url; this.cache = cache; } },
  Protocol: class {
    constructor() { protocolos++; this.tile = () => {}; }
    add(archivo) { agregados.push(archivo); }
  }
};
globalThis.maplibregl = { addProtocol: () => {} };

const { registerPmtilesProtocol, BASEMAP_URL } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js');

test('el mapa base se abre con la caché que no guarda las fallas', () => {
  assert.equal(registerPmtilesProtocol(''), true);

  assert.equal(agregados.length, 1);
  assert.equal(agregados[0].url, BASEMAP_URL);
  assert.ok(agregados[0].cache instanceof ResolvedValueCache);
});

test('con un backend en otra dirección, el archivo se registra con esa dirección', () => {
  registerPmtilesProtocol('https://ejemplo.trycloudflare.com');

  assert.equal(agregados.at(-1).url, `https://ejemplo.trycloudflare.com/${BASEMAP_URL}`);
});

test('el protocolo se registra una sola vez y cada archivo una sola vez', () => {
  const antes = agregados.length;

  registerPmtilesProtocol('');
  registerPmtilesProtocol('https://ejemplo.trycloudflare.com');

  assert.equal(protocolos, 1);
  assert.equal(agregados.length, antes);
});
