/**
 * La pantalla del viaje: qué dice la banda en cada estado y qué muestra la
 * hoja. El marcado se verifica en el navegador; acá va la lógica que decide
 * qué se muestra, que es lo que se puede probar sin pantalla.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { estadoDeBanda, resumenRestante } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/viaje.js';
import { ICONOS, dibujo } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/piezas.js';
import { arrivalTime } from '../../src/TruckNavigator.Api/wwwroot/js/ui.js';

/* ---------------------------------------------------------------------------
   La banda
--------------------------------------------------------------------------- */

const nav = (next, distanceToManeuver = 40) => ({ next, distanceToManeuver });

test('recalculando manda sobre todo lo demás', () => {
  const estado = estadoDeBanda({ recalculando: true, esperandoGps: true, nav: nav({ kind: 'Left', streetName: 'Junín' }) });

  assert.equal(estado.tipo, 'recalculando');
});

test('sin posición todavía, la banda dice que está buscando señal', () => {
  const estado = estadoDeBanda({ recalculando: false, esperandoGps: true, problema: null, nav: null });

  assert.equal(estado.tipo, 'buscando');
  assert.equal(estado.titulo, 'Buscando señal de GPS…');
  assert.match(estado.sub, /Bajo techo/);
});

test('si el GPS falló, la banda lo dice y recuerda que se puede salir', () => {
  const estado = estadoDeBanda({ recalculando: false, esperandoGps: true, problema: 'El GPS no responde.', nav: null });

  assert.equal(estado.tipo, 'buscando');
  assert.equal(estado.titulo, 'El GPS no responde.');
  assert.match(estado.sub, /Salir/);
});

test('con posición, la maniobra que viene con su distancia y su calle', () => {
  const estado = estadoDeBanda({ esperandoGps: false, nav: nav({ kind: 'Left', streetName: 'Junín', text: 'Girá a la izquierda' }, 40) });

  assert.deepEqual(estado, { tipo: 'maniobra', kind: 'Left', distancia: '40 m', calle: 'Junín' });
});

test('sin próxima maniobra se sigue derecho por la ruta', () => {
  const estado = estadoDeBanda({ esperandoGps: false, nav: nav(null, 1200) });

  assert.equal(estado.tipo, 'maniobra');
  assert.equal(estado.kind, 'Continue');
  assert.equal(estado.calle, 'Seguí la ruta');
  assert.equal(estado.distancia, '1.2 km');
});

test('si la calle no tiene nombre, la banda usa el texto de la instrucción', () => {
  const estado = estadoDeBanda({ esperandoGps: false, nav: nav({ kind: 'Right', streetName: '', text: 'Girá a la derecha' }, 80) });

  assert.equal(estado.calle, 'Girá a la derecha');
});

test('la primera posición del viaje saca la banda de "buscando" aunque la bandera siga puesta', () => {
  // `esperandoGps` se apaga en el mismo latido en que llega la posición; si
  // por orden de llamadas la banda se pinta antes, lo que manda es que ya
  // hay un estado de navegación.
  const estado = estadoDeBanda({ esperandoGps: true, nav: nav({ kind: 'Continue', streetName: 'Av. Sáenz' }, 200) });

  assert.equal(estado.tipo, 'maniobra');
});

/* ---------------------------------------------------------------------------
   La hoja
--------------------------------------------------------------------------- */

test('el resumen de la hoja es "39 min • 32 km", como en waze-06', () => {
  assert.equal(resumenRestante(39 * 60, 32_000), '39 min • 32 km');
});

test('sin cifras, el resumen no inventa: dos guiones', () => {
  assert.equal(resumenRestante(null, null), '— • —');
});

test('la hora de llegada va en 24 horas, sin "p. m."', () => {
  const tarde = new Date(2026, 8, 16, 20, 6).getTime();
  const madrugada = new Date(2026, 8, 16, 0, 5).getTime();

  assert.equal(arrivalTime(0, tarde), '20:06');
  assert.equal(arrivalTime(0, madrugada), '00:05');
  assert.equal(arrivalTime(39 * 60, tarde), '20:45');
});

/* ---------------------------------------------------------------------------
   Los dibujos de interfaz (cruz, rutas, sonido…)
--------------------------------------------------------------------------- */

test('cada dibujo de interfaz que usan las hojas existe y va en el color del texto', () => {
  for (const nombre of ['cerrar', 'rutas', 'sonido', 'sonidoApagado', 'lupa', 'capas', 'ubicacion', 'centrar', 'mas', 'atras']) {
    assert.ok(ICONOS[nombre], `falta el dibujo ${nombre}`);
    assert.match(dibujo(nombre), /^<svg/);
    assert.match(dibujo(nombre), /stroke="currentColor"/);
  }
});

test('un dibujo que no existe no dibuja nada', () => {
  assert.equal(dibujo('inexistente'), '');
});
