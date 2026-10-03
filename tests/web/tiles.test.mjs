/**
 * El mapa que no se rompe (AD-54): cuándo se cae al raster de respaldo, y
 * cómo se reintentan los tiles del mapa base que fallaron.
 *
 * Medido el 03/10/2026: un 502 o un corte en UN pedido de tiles dejaba un
 * cuadrado vacío para siempre —MapLibre no reintenta un tile fallido— o, si
 * el error decía "Failed to fetch", pasaba el mapa entero al OpenStreetMap
 * estándar, sin la Red ni nada nuestro, hasta reabrir la app.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { debeCaerAlRaster, colaDeReintentos, ESCALERA_DE_TILES } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/tiles.js';

const tile = (z, x, y) => ({ tileID: { canonical: { z, x, y } } });

test('sin el archivo del mapa base, se cae al raster', () => {
  assert.equal(debeCaerAlRaster({ sourceId: 'base', error: { message: 'Bad response code: 404' } }), true);
  assert.equal(debeCaerAlRaster({ sourceId: 'base', error: { message: 'Failed to fetch' } }), true);
});

test('un tile que falla NUNCA tira el mapa entero al raster, diga lo que diga el error', () => {
  for (const message of ['Failed to fetch', 'Bad response code: 404', 'Bad response code: 502', 'Load failed']) {
    assert.equal(debeCaerAlRaster({ sourceId: 'base', tile: tile(15, 1, 2), error: { message } }), false, message);
  }
});

test('un error que no es de la fuente del mapa base no decide nada', () => {
  assert.equal(debeCaerAlRaster({ sourceId: 'red', error: { message: 'Failed to fetch' } }), false);
  assert.equal(debeCaerAlRaster({ error: { message: 'Expected value to be of type number' } }), false);
  assert.equal(debeCaerAlRaster({ sourceId: 'base', error: { message: 'algo distinto' } }), false);
});

/** Un reloj de mentira: los temporizadores se disparan a mano. */
function reloj() {
  let ahora = 0;
  let siguiente = 1;
  const timers = new Map();
  return {
    timers,
    ahora: () => ahora,
    programar: (fn, ms) => { const id = siguiente++; timers.set(id, { fn, ms }); return id; },
    cancelar: (id) => timers.delete(id),
    avanzar(ms) {
      ahora += ms;
      for (const [id, t] of [...timers]) {
        if (t.ms <= ms) { timers.delete(id); t.fn(); }
      }
    }
  };
}

function armar() {
  const r = reloj();
  const reintentos = [];
  const cola = colaDeReintentos({
    reintentar: (tiles) => reintentos.push(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)),
    programar: r.programar,
    cancelar: r.cancelar,
    ahora: r.ahora
  });
  return { r, cola, reintentos };
}

test('la escalera de espera es la del freno de red: 2, 5, 15 y 60 s', () => {
  assert.deepEqual(ESCALERA_DE_TILES, [2000, 5000, 15000, 60000]);
});

test('los tiles que fallan juntos se reintentan juntos, a los 2 s', () => {
  const { r, cola, reintentos } = armar();

  cola.fallo({ z: 15, x: 1, y: 2 });
  cola.fallo({ z: 15, x: 1, y: 3 });
  cola.fallo({ z: 15, x: 1, y: 2 });

  assert.deepEqual([...r.timers.values()].map((t) => t.ms), [2000]);
  r.avanzar(2000);
  assert.deepEqual(reintentos, [['15/1/2', '15/1/3']]);
});

test('si siguen fallando, cada vez se espera más, hasta 60 s', () => {
  const { r, cola, reintentos } = armar();
  const esperas = [];

  for (let i = 0; i < 6; i++) {
    cola.fallo({ z: 15, x: 1, y: 2 });
    const [{ ms }] = r.timers.values();
    esperas.push(ms);
    r.avanzar(ms);
  }

  assert.deepEqual(esperas, [2000, 5000, 15000, 60000, 60000, 60000]);
  assert.equal(reintentos.length, 6);
});

test('pasado un rato sin fallas, la escalera vuelve a empezar', () => {
  const { r, cola } = armar();

  cola.fallo({ z: 15, x: 1, y: 2 });
  r.avanzar(2000);
  cola.fallo({ z: 15, x: 1, y: 2 });
  r.avanzar(5000);

  r.avanzar(120_000);
  cola.fallo({ z: 14, x: 3, y: 4 });
  assert.deepEqual([...r.timers.values()].map((t) => t.ms), [2000]);
});

test('cuando vuelve la red, se reintenta en el acto y la escalera vuelve a empezar', () => {
  const { r, cola, reintentos } = armar();

  cola.fallo({ z: 15, x: 1, y: 2 });
  cola.volvioLaRed();

  assert.deepEqual(reintentos, [['15/1/2']]);
  assert.equal(r.timers.size, 0);

  cola.fallo({ z: 15, x: 1, y: 2 });
  assert.deepEqual([...r.timers.values()].map((t) => t.ms), [2000]);
});

test('si vuelve la red y no hay nada pendiente, no se pide nada', () => {
  const { cola, reintentos } = armar();

  cola.volvioLaRed();

  assert.deepEqual(reintentos, []);
});

test('olvidar frena el reintento pendiente', () => {
  const { r, cola, reintentos } = armar();

  cola.fallo({ z: 15, x: 1, y: 2 });
  cola.olvidar();
  r.avanzar(60_000);

  assert.deepEqual(reintentos, []);
  assert.equal(r.timers.size, 0);
});
