/**
 * La jerarquía del mapa medida como contraste contra el fondo, con los colores
 * que de verdad están en app.css (spec 2026-10-03-la-red-primero, §3.1).
 *
 * Antes de la parte B, de noche la autopista (4,36) le ganaba a la Red (3,81) y
 * entre la Red y una avenida había 1,75: fuera de la ruta la Red no se
 * distinguía. De noche la jerarquía es una escalera; de día las calles son
 * blancas y la jerarquía la da la Red sola.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/TruckNavigator.Api/wwwroot/app.css', import.meta.url), 'utf8');

function bloque(selector) {
  const inicio = css.indexOf(`${selector} {`);
  assert.ok(inicio >= 0, `no está el bloque ${selector}`);
  return css.slice(inicio, css.indexOf('\n}', inicio));
}

const tokens = (texto) => Object.fromEntries(
  [...texto.matchAll(/--(map-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));

const noche = tokens(bloque(':root'));
const dia = { ...noche, ...tokens(bloque(':root[data-theme="light"]')) };

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

const contraFondo = (t, nombre) => contraste(t[`map-${nombre}`], t['map-tierra']);

test('de noche la jerarquía es una escalera: Red, autopista, avenida, calle', () => {
  const [red, autopista, avenida, calle] = ['red', 'autopista', 'avenida', 'calle'].map((n) => contraFondo(noche, n));

  assert.ok(red > autopista, `Red ${red.toFixed(2)} ≤ autopista ${autopista.toFixed(2)}`);
  assert.ok(autopista > avenida, `autopista ${autopista.toFixed(2)} ≤ avenida ${avenida.toFixed(2)}`);
  assert.ok(avenida > calle, `avenida ${avenida.toFixed(2)} ≤ calle ${calle.toFixed(2)}`);
  assert.ok(red >= 2 * autopista, `la Red (${red.toFixed(2)}) tiene que duplicar a la autopista (${autopista.toFixed(2)})`);
});

test('de día la Red es la única vía que se despega del fondo', () => {
  const red = contraFondo(dia, 'red');

  for (const via of ['autopista', 'avenida', 'calle']) {
    assert.ok(red > 2 * contraFondo(dia, via), `${via}: ${contraFondo(dia, via).toFixed(2)} contra la Red ${red.toFixed(2)}`);
  }
  assert.ok(red >= 3, `la Red de día mide ${red.toFixed(2)}`);
});

test('el cromo: el canto es más oscuro que el cuerpo, y el reflejo y el brillo más claros', () => {
  for (const [tema, t] of [['noche', noche], ['día', dia]]) {
    const l = (n) => luminancia(t[`map-${n}`]);

    assert.ok(t['map-red-canto'] && t['map-red-reflejo'] && t['map-red-brillo'], `faltan los tokens del cromo de ${tema}`);
    assert.ok(l('red-canto') < l('red'), `${tema}: canto`);
    assert.ok(l('red-reflejo') > l('red'), `${tema}: reflejo`);
    assert.ok(l('red-brillo') > l('red-reflejo'), `${tema}: brillo`);
  }

  assert.ok(contraste(noche['map-red-brillo'], noche['map-red']) >= 2, 'de noche el brillo tiene que verse sobre el cuerpo');
});
