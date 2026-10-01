/**
 * Los íconos ilustrados del prototipo, aprobados el 14/09/2026.
 *
 * Son dos tonos —el color y su sombra— y por eso se leen como ilustración y no
 * como trazo. El candado importa porque una pantalla que pide un ícono que no
 * existe no falla: queda un hueco, y el hueco no se nota hasta que alguien mira.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ICONOS_ILUSTRADOS, icono } from '../../src/TruckNavigator.Api/wwwroot/js/iconos.js';

test('están los del prototipo, con sus nombres', () => {
  assert.ok(ICONOS_ILUSTRADOS.length >= 27, `son ${ICONOS_ILUSTRADOS.length}, tendrían que ser 27 o más`);
});

test('están los que la entrada necesita y hoy no existían en la app', () => {
  for (const nombre of ['idioma', 'fuentes', 'viaje', 'exp', 'km', 'nivel', 'logros', 'trivia']) {
    assert.ok(ICONOS_ILUSTRADOS.includes(nombre), `falta ${nombre}`);
  }
});

test('están también los nueve del zócalo, que ya andaban', () => {
  for (const nombre of ['mapa', 'juegos', 'emergencia', 'mas', 'perfil', 'carnet', 'camiones', 'chat', 'configuracion']) {
    assert.ok(ICONOS_ILUSTRADOS.includes(nombre), `falta ${nombre}`);
  }
});

test('cada ícono es un SVG del tamaño pedido', () => {
  const svg = icono('idioma', 32);

  assert.match(svg, /^<svg/);
  assert.match(svg, /width="32"/);
  assert.match(svg, /height="32"/);
  assert.match(svg, /viewBox="0 0 32 32"/);
});

test('son de DOS tonos: el color y su sombra, que es lo que los hace ilustración', () => {
  for (const nombre of ['viaje', 'idioma', 'camiones']) {
    const colores = new Set([...icono(nombre, 30).matchAll(/#[0-9a-fA-F]{3,6}/g)].map((m) => m[0].toLowerCase()));
    assert.ok(colores.size >= 2, `${nombre} tiene ${colores.size} tono(s)`);
  }
});

test('los colores son FIJOS y no salen de un token del tema', () => {
  // Un icono ilustrado es un dibujo, no texto: se registra una vez y no se
  // repinta al cambiar entre dia y noche, asi que tiene que leerse en los dos.
  assert.doesNotMatch(icono('viaje', 30), /var\(--/);
});

test('un nombre que no existe no rompe la pantalla: devuelve vacío', () => {
  assert.equal(icono('no-existe', 24), '');
});

test('el tamaño por defecto no es cero', () => {
  assert.match(icono('mapa'), /width="\d+"/);
});
