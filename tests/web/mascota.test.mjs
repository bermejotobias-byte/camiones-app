/**
 * La mascota por momentos: que cada momento apunte a una pose que existe, y que
 * la lista de poses disponibles diga la verdad sobre los archivos.
 *
 * Lo segundo es lo que importa: un PNG que está en la carpeta pero no en
 * DISPONIBLES no se muestra nunca, y una pose en DISPONIBLES sin su PNG es una
 * imagen rota en la pantalla de festejo. Ninguna de las dos falla en consola.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { POSES, MOMENTOS, DISPONIBLES, mascota } from '../../src/TruckNavigator.Api/wwwroot/js/mascota.js';

const carpeta = fileURLToPath(new URL('../../src/TruckNavigator.Api/wwwroot/img/mascota/', import.meta.url));
const archivos = new Set(readdirSync(carpeta).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));

test('cada momento apunta a una pose de las hojas', () => {
  for (const [momento, { pose }] of Object.entries(MOMENTOS)) {
    assert.ok(pose in POSES, `el momento "${momento}" apunta a la pose "${pose}", que no existe`);
  }
});

test('toda pose disponible tiene su PNG en la carpeta', () => {
  for (const pose of DISPONIBLES) {
    assert.ok(archivos.has(pose), `la pose "${pose}" está en DISPONIBLES pero no hay img/mascota/${pose}.png`);
  }
});

test('todo PNG de la carpeta está en DISPONIBLES: si no, no se muestra nunca', () => {
  for (const archivo of archivos) {
    assert.ok(DISPONIBLES.has(archivo), `existe img/mascota/${archivo}.png pero la pose no está en DISPONIBLES`);
  }
});

test('un momento con pose disponible dibuja la imagen de esa pose', () => {
  const html = mascota('festejo', { escala: 3 });

  assert.match(html, /<img src="\/img\/mascota\/festejo\.png"/);
  assert.match(html, /mascota-con-pose/);
  assert.match(html, /--mascota-lado:192px/);
});

test('un momento sin pose disponible deja el hueco, sin imagen rota', () => {
  const html = mascota('motivar');   // neutro: no hay hoja con gorra TBF parado sin hacer nada

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /mascota-sin-pose/);
});

test('un momento desconocido cae en motivar, no en una excepción', () => {
  assert.match(mascota('no-existe'), /aria-label="El mono te acompaña"/);
});

test('los detalles de la ruta tienen su momento: el mono lee el mapa', () => {
  assert.equal(MOMENTOS.ruta.pose, 'mapa');
  assert.ok(mascota('ruta', { escala: 1 }).includes('/img/mascota/mapa.png'));
});
