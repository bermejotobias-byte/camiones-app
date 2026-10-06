/**
 * Los patrones de vibración: cada aviso vibra distinto, y los reportes traen
 * dos nuevos (AD-39; reportes del 19/09/2026).
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// platform.js decide al cargarse si está adentro de la cáscara (ver contacts.test.mjs):
// se le arma el mismo andamio que a ese test.
globalThis.window = { HybridWebView: { SendRawMessage() {} } };
globalThis.location = { hostname: '0.0.0.0' };

const { VIBRACION } = await import('../../src/TruckNavigator.Api/wwwroot/js/platform.js');

test('los reportes vibran con dos patrones propios: información y peligro', () => {
  assert.ok(Array.isArray(VIBRACION.reporte) && VIBRACION.reporte.length > 0);
  assert.ok(Array.isArray(VIBRACION.peligro) && VIBRACION.peligro.length > 0);
});

test('los dos nuevos son distintos entre sí y de los que había (el gálibo y el radar comparten el suyo a propósito)', () => {
  const viejos = ['maniobra', 'galibo', 'radar', 'paso'].map((k) => VIBRACION[k].join(','));
  assert.notEqual(VIBRACION.reporte.join(','), VIBRACION.peligro.join(','));
  assert.ok(!viejos.includes(VIBRACION.reporte.join(',')));
  assert.ok(!viejos.includes(VIBRACION.peligro.join(',')));
});

test('el peligro se siente más largo que la información', () => {
  const suma = (p) => p.reduce((a, b) => a + b, 0);
  assert.ok(suma(VIBRACION.peligro) > suma(VIBRACION.reporte));
});

test('la Viborita vibra con dos patrones propios: la caja y el choque', () => {
  const viejos = ['maniobra', 'galibo', 'radar', 'paso', 'reporte', 'peligro'].map((k) => VIBRACION[k].join(','));
  assert.ok(Array.isArray(VIBRACION.caja) && Array.isArray(VIBRACION.choque));
  assert.ok(!viejos.includes(VIBRACION.caja.join(',')));
  assert.ok(!viejos.includes(VIBRACION.choque.join(',')));
  assert.ok(VIBRACION.caja.reduce((a, b) => a + b, 0) < 60, 'la caja es un toque corto');
});
