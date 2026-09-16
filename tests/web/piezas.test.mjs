/**
 * Las piezas compartidas del GPS: la flecha de maniobra, las calcomanías y
 * los pedazos de interfaz que se repiten en varias hojas.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANIOBRAS,
  iconoDeManiobra,
  CALCOMANIAS,
  calcomania,
  pildora,
  circulo,
  chip
} from '../../src/TruckNavigator.Api/wwwroot/js/mapa/piezas.js';

/* ---------------------------------------------------------------------------
   La flecha de la banda
--------------------------------------------------------------------------- */

test('hay una flecha dibujada para cada maniobra que devuelve el servidor', () => {
  const kinds = ['Continue', 'SlightLeft', 'Left', 'SharpLeft', 'SlightRight', 'Right', 'SharpRight',
    'KeepLeft', 'KeepRight', 'UTurn', 'Roundabout', 'Waypoint', 'Finish'];

  for (const kind of kinds) {
    assert.ok(MANIOBRAS[kind], `falta la maniobra ${kind}`);
    assert.match(iconoDeManiobra(kind), /^<svg/, `la flecha de ${kind} no es un SVG`);
  }
});

test('izquierda y derecha son dibujos distintos, y lo desconocido va derecho', () => {
  assert.notEqual(iconoDeManiobra('Left'), iconoDeManiobra('Right'));
  assert.equal(iconoDeManiobra('loquesea'), iconoDeManiobra('Continue'));
  assert.equal(iconoDeManiobra(null), iconoDeManiobra('Continue'));
});

test('la flecha lleva el trazo medido en Waze y se puede pedir de otro tamaño', () => {
  assert.match(iconoDeManiobra('Left'), /stroke-width="5.5"/, 'trazo de 5,5, medido en waze-06');
  assert.match(iconoDeManiobra('Left', 30), /width="30"/);
});

/* ---------------------------------------------------------------------------
   Las calcomanías
--------------------------------------------------------------------------- */

test('cada categoría de lugar y cada dato del mapa tiene su calcomanía', () => {
  for (const nombre of ['gomeria', 'taller', 'estacion', 'comer', 'auxilio', 'playa',
    'red', 'galibo', 'galiboOk', 'paso', 'radar', 'zona', 'casa', 'deposito', 'lugar', 'lugarMas', 'comunidad', 'bandera']) {
    assert.ok(CALCOMANIAS[nombre], `falta la calcomanía ${nombre}`);
    assert.match(calcomania(nombre), /^<svg/);
  }
});

test('una calcomanía que no existe no dibuja nada, sin romper', () => {
  assert.equal(calcomania('inexistente'), '');
});

/* ---------------------------------------------------------------------------
   Píldoras, círculos y chips
--------------------------------------------------------------------------- */

test('la píldora lleva el texto y su clase; el texto va escapado', () => {
  const html = pildora('Ir <ahora>', { clase: 'celeste' });

  assert.match(html, /gps-pildora/);
  assert.match(html, /celeste/);
  assert.match(html, /Ir &lt;ahora&gt;/, 'lo que viene de afuera no puede inyectar marcado');
});

test('el círculo envuelve un dibujo y puede llevar id y rótulo accesible', () => {
  const html = circulo('<svg></svg>', { id: 'salir', etiqueta: 'Salir del viaje' });

  assert.match(html, /gps-circulo/);
  assert.match(html, /id="salir"/);
  assert.match(html, /aria-label="Salir del viaje"/);
});

test('el chip lleva un punto del color que se le pide', () => {
  const html = chip('#f9c531', '2 radares');

  assert.match(html, /background:#f9c531/);
  assert.match(html, /2 radares/);
});
