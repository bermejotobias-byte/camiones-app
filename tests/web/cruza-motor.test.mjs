/**
 * El motor de CRUZÁ, MONO (spec §5), sobre mundos armados a mano: cada fila dice
 * exactamente qué hay, así cada regla se prueba sola.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPartida, pedirPaso, avanzar, puntaje, xDelMono, xVehiculo, xTronco, choca, troncoBajo } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/motor.js';
import { CEL, PASO_MS, GOLPE_MS, INVULNERABLE_MS, AFUERA } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

const vereda = (i, bloq = [], cajas = []) => ({ t: 'vereda', i, obst: [], bloq: new Set(bloq), cajas });
const calle = (i, veh, { dir = 1, vel = 0 } = {}) => ({ t: 'calle', i, clase: 'autos', dir, vel, veh, bloq: new Set(), cajas: [] });
const rio = (i, xs, { dir = 1, vel = 0, n = 3, cajaEn = -1 } = {}) => ({ t: 'rio', i, dir, vel, n, xs, P: 15 * CEL, cajaEn, bloq: new Set(), cajas: [] });

/** Un mundo a mano: las filas que se den, y vereda libre en todas las demás. */
function mundo(filas = {}) {
  return { fila: (i) => filas[i] ?? (filas[i] = vereda(i)), olvidar() {} };
}
const partida = (filas) => crearPartida(1, { mundo: mundo(filas) });
/** Avanza en pasos de 10 ms, como la vista, y junta los eventos. */
function correr(p, ms) {
  const ev = [];
  for (let t = 0; t < ms; t += 10) ev.push(...avanzar(p, 10));
  return ev;
}
const tipos = (ev) => ev.map((e) => e.tipo);
/** Avanza de a 10 ms hasta que pase un evento de ese tipo. */
function hasta(p, tipo) {
  for (let k = 0; k < 1000; k++) if (avanzar(p, 10).some((e) => e.tipo === tipo)) return;
  assert.fail(`no hubo ${tipo}`);
}
/** Un auto parado justo encima de la columna 4. */
const autoEnLa4 = () => [['torino', AFUERA + 4 * CEL - 10]];

test('la partida arranca en la fila 0, columna 4, con 3 vidas y 0 puntos', () => {
  const p = partida();
  assert.equal(p.fila, 0);
  assert.equal(p.x, 4 * CEL);
  assert.equal(p.vidas, 3);
  assert.equal(puntaje(p), 0);
});

test('un paso adelante tarda 140 ms y suma 10', () => {
  const p = partida();
  assert.equal(pedirPaso(p, 'arr'), true);
  correr(p, PASO_MS - 10);
  assert.equal(p.fila, 0);
  assert.ok(p.salto);
  const ev = correr(p, 10);
  assert.deepEqual(tipos(ev), ['aterrizo']);
  assert.equal(p.fila, 1);
  assert.equal(puntaje(p), 10);
});

test('un obstáculo o un borde bloquean, y no cuestan nada', () => {
  const p = partida({ 1: vereda(1, [4]) });
  assert.equal(pedirPaso(p, 'arr'), false);
  assert.equal(pedirPaso(p, 'aba'), false, 'debajo de la largada no hay nada');
  assert.equal(p.salto, null);
  p.x = 0;
  assert.equal(pedirPaso(p, 'izq'), false);
  p.x = 8 * CEL;
  assert.equal(pedirPaso(p, 'der'), false);
  assert.equal(p.vidas, 3);
});

test('en medio del salto se guarda un solo paso, y sale al aterrizar', () => {
  const p = partida();
  pedirPaso(p, 'arr');
  pedirPaso(p, 'arr');
  pedirPaso(p, 'der');
  correr(p, 2 * PASO_MS);
  assert.equal(p.fila, 2);
  assert.equal(p.x, 4 * CEL, 'el tercer gesto se descartó');
});

test('ir y volver no suma: cuenta la fila más lejana', () => {
  const p = partida();
  for (const dir of ['arr', 'arr', 'aba', 'arr']) { pedirPaso(p, dir); correr(p, PASO_MS); }
  assert.equal(p.maxFila, 2);
  assert.equal(puntaje(p), 20);
});

test('la caja vale 50 y se levanta una sola vez', () => {
  const p = partida({ 1: vereda(1, [], [4]) });
  pedirPaso(p, 'arr');
  const ev = correr(p, PASO_MS);
  assert.ok(tipos(ev).includes('caja'));
  assert.equal(puntaje(p), 10 + 50);
  pedirPaso(p, 'aba'); correr(p, PASO_MS);
  pedirPaso(p, 'arr'); correr(p, PASO_MS);
  assert.equal(p.cajas, 1);
});

test('el tronco lleva al mono, y la caja de arriba del tronco también cuenta', () => {
  // Tronco de 3 celdas que a los 140 ms va de 87 a 159: el centro del mono (108) cae arriba.
  const p = partida({ 1: rio(1, [AFUERA + 84], { vel: 24, cajaEn: 0 }) });
  pedirPaso(p, 'arr');
  const ev = correr(p, PASO_MS);
  assert.deepEqual(tipos(ev).sort(), ['aterrizo', 'caja']);
  assert.equal(p.enTronco, 0);
  const antes = p.x;
  correr(p, 1000);
  assert.ok(Math.abs(p.x - (antes + 24)) < 0.01, `${p.x}`);
  assert.equal(p.vidas, 3);
});

test('caer al agua cuesta una vida', () => {
  const p = partida({ 1: rio(1, [0]) });
  pedirPaso(p, 'arr');
  const ev = correr(p, PASO_MS);
  assert.deepEqual(ev.filter((e) => e.tipo === 'golpe'), [{ tipo: 'golpe', motivo: 'agua' }]);
  assert.equal(p.vidas, 2);
});

test('el tronco que saca al mono del campo cuesta una vida', () => {
  // A 240 px/s el tronco se corre 34 px durante el salto: arranca más a la izquierda.
  const p = partida({ 1: rio(1, [AFUERA + 60], { vel: 240 }) });
  pedirPaso(p, 'arr');
  const ev = correr(p, 2000);
  assert.ok(ev.some((e) => e.tipo === 'golpe' && e.motivo === 'borde'));
});

test('un vehículo golpea también en medio del salto', () => {
  const p = partida({ 1: calle(1, autoEnLa4()) });
  pedirPaso(p, 'arr');
  const ev = correr(p, 80);
  assert.deepEqual(ev, [{ tipo: 'golpe', motivo: 'calle' }]);
  assert.equal(p.fila, 1, 'queda en la fila del golpe');
});

test('el golpe congela el mundo 0,9 s y el mono reaparece en la última fila segura, cerca de la columna 4', () => {
  const filas = { 2: calle(2, autoEnLa4()) };
  const p = partida(filas);
  pedirPaso(p, 'arr'); correr(p, PASO_MS);
  filas[1].bloq.add(4); // la columna 4 de esa vereda queda tapada: reaparece en la 5
  pedirPaso(p, 'arr');
  hasta(p, 'golpe');
  const t = p.t;
  correr(p, GOLPE_MS - 20);
  assert.equal(p.t, t, 'el tránsito no se movió');
  hasta(p, 'reaparece');
  assert.equal(p.fila, 1);
  assert.equal(p.x, 5 * CEL);
});

test('después de reaparecer el mono es invulnerable 1,5 s a los vehículos', () => {
  const p = partida({ 1: calle(1, [['torino', AFUERA + 3 * CEL]]) });
  // Golpe de costado: camina a la 3 por la fila 0 y sube.
  pedirPaso(p, 'izq'); correr(p, PASO_MS);
  pedirPaso(p, 'arr'); hasta(p, 'golpe');
  assert.equal(p.vidas, 2);
  hasta(p, 'reaparece');
  assert.equal(p.fila, 0, 'la fila 0 sigue a la vista');
  pedirPaso(p, 'arr');
  correr(p, INVULNERABLE_MS - 30);
  assert.equal(p.fila, 1);
  assert.equal(p.vidas, 2, 'todavía invulnerable');
  correr(p, 60);
  assert.equal(p.vidas, 1);
});

test('la grúa: si la cámara deja al mono abajo, pierde una vida', () => {
  const p = partida();
  pedirPaso(p, 'arr'); correr(p, PASO_MS);
  // Banda 0: la cámara sube una fila cada 4 s. A los 8 s el borde de abajo pasa la fila 1.
  const ev = correr(p, 8200);
  assert.ok(ev.some((e) => e.tipo === 'golpe' && e.motivo === 'grua'));
});

test('la cámara no se mueve hasta el primer paso adelante, sigue al mono y nunca baja', () => {
  const p = partida();
  correr(p, 5000);
  assert.equal(p.cam, 0);
  for (let k = 0; k < 10; k++) { pedirPaso(p, 'arr'); correr(p, PASO_MS); }
  assert.ok(p.cam >= 10 - 6, `${p.cam}`);
  const cam = p.cam;
  pedirPaso(p, 'aba'); correr(p, PASO_MS);
  assert.ok(p.cam >= cam);
});

test('sin vidas, el fin', () => {
  const p = partida({ 1: calle(1, autoEnLa4()) });
  for (let k = 0; k < 2; k++) {
    pedirPaso(p, 'arr'); hasta(p, 'golpe');
    hasta(p, 'reaparece'); correr(p, INVULNERABLE_MS);
  }
  pedirPaso(p, 'arr'); hasta(p, 'golpe');
  assert.equal(p.vidas, 0);
  assert.equal(p.estado, 'jugando', 'el último golpe también dura 0,9 s');
  hasta(p, 'fin');
  assert.equal(p.estado, 'fin');
  assert.equal(pedirPaso(p, 'arr'), false);
  assert.deepEqual(avanzar(p, 100), []);
});

test('las posiciones del tránsito dan la vuelta por el lazo', () => {
  const f = { dir: 1, vel: 24, P: 15 * CEL };
  assert.equal(xVehiculo(f, AFUERA, 0), 0);
  assert.equal(xVehiculo(f, AFUERA, 1000), 24);
  assert.equal(xVehiculo({ ...f, dir: -1 }, AFUERA, 1000), -24);
  assert.equal(xVehiculo(f, AFUERA, 15000), 14, 'dio la vuelta: 360 px en un lazo de 346');
  assert.equal(xTronco(f, AFUERA, 0), 0);
  assert.equal(choca(calle(0, autoEnLa4()), 4 * CEL, 0), true);
  assert.equal(choca(calle(0, autoEnLa4()), 7 * CEL, 0), false);
  assert.equal(troncoBajo(rio(0, [AFUERA]), 0, 0), 0);
  assert.equal(troncoBajo(rio(0, [AFUERA]), 5 * CEL, 0), -1);
  assert.equal(xDelMono(crearPartida(1)), 4 * CEL);
});
