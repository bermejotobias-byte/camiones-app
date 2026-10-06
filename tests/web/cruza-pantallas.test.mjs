/**
 * Las pantallas de CRUZÁ, MONO: los textos que la fuente tiene que tener, el estado
 * visual (cámara, marcador y partículas), los botones y la escala entera.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TEXTOS, BOTONES, botonEn, crearVisual, actualizarVisual, tamanoDelCampo } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/pantallas.js';
import { faltantes } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js';
import { crearPartida } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/motor.js';
import { ANCHO, ALTO } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

test('ningún texto de las pantallas tiene una letra que la fuente no dibuja', () => {
  for (const t of ['CRUZÁ,', 'MONO', 'TOCÁ PARA JUGAR', 'HI-SCORE', 'SCORE', '¡QUÉ MACANA!', '¡SOS UN', 'CRACK!',
    '¡NUEVO HI-SCORE!', 'SIN SEÑAL: RÉCORD NO GUARDADO', 'OTRA VEZ', 'SALIR', 'SEGUIR', 'PAUSA', 'FILAS', 'CAJAS', '+50']) {
    assert.ok(TEXTOS.includes(t), `falta en TEXTOS: ${t}`);
  }
  for (const t of TEXTOS) assert.deepEqual(faltantes(t), [], t);
});

test('los botones entran en el campo y se encuentran por dónde se toca', () => {
  for (const lista of Object.values(BOTONES)) {
    for (const b of lista) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= ANCHO && b.y + b.h <= ALTO, b.accion);
  }
  const [otra] = BOTONES.fin;
  assert.equal(botonEn(BOTONES.fin, otra.x + 2, otra.y + 2), 'otra');
  assert.equal(botonEn(BOTONES.fin, 2, 2), null);
  assert.deepEqual(BOTONES.pausa.map((b) => b.accion), ['seguir', 'salir']);
  assert.deepEqual(BOTONES.fin.map((b) => b.accion), ['otra', 'salir']);
});

test('una caja deja el "+50", y se va a los 0,7 s', () => {
  const vis = crearVisual(), p = crearPartida(1);
  actualizarVisual(vis, p, [{ tipo: 'caja' }], 16);
  assert.ok(vis.particulas.some((x) => x.texto === '+50'));
  assert.ok(vis.particulas.length >= 15);
  for (let k = 0; k < 50; k++) actualizarVisual(vis, p, [], 16);
  assert.ok(!vis.particulas.some((x) => x.texto === '+50'));
});

test('la cámara visible persigue a la del motor y el marcador cuenta hacia arriba', () => {
  const vis = crearVisual(), p = crearPartida(1);
  p.cam = 3;
  p.maxFila = 10;
  for (let k = 0; k < 120; k++) actualizarVisual(vis, p, [], 16);
  assert.ok(Math.abs(vis.camara - 3) < 0.01, `${vis.camara}`);
  assert.ok(Math.abs(vis.marcador - 100) < 0.5, `${vis.marcador}`);
});

test('la escala es entera en píxeles físicos y entra en el lugar', () => {
  assert.deepEqual(tamanoDelCampo(360, 692, 3), { P: 5, ancho: 1080, alto: 1700, anchoCss: 360, altoCss: 1700 / 3 });
  assert.equal(tamanoDelCampo(412, 851, 2.625).P, 5);
  assert.equal(tamanoDelCampo(375, 764, 2).P, 3);
  assert.equal(tamanoDelCampo(100, 100, 1).P, 1);
  for (const [w, h, dpr] of [[360, 692, 3], [375, 764, 3], [412, 851, 2.625], [1280, 900, 1]]) {
    const t = tamanoDelCampo(w, h, dpr);
    assert.ok(t.anchoCss <= w + 1e-9 && t.altoCss <= h + 1e-9, `${w}x${h}`);
  }
});
