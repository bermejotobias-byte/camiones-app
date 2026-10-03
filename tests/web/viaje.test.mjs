/**
 * La pantalla del viaje: qué dice la banda en cada estado y qué muestra la
 * hoja. El marcado se verifica en el navegador; acá va la lógica que decide
 * qué se muestra, que es lo que se puede probar sin pantalla.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { estadoDeBanda, resumenRestante, textoDeAviso, preguntaDeReanudar, tarjetaReanudar, preguntaDeSalida } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/viaje.js';
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
   La tarjeta de aviso
--------------------------------------------------------------------------- */

const camion = { name: 'El Rayo', heightMeters: 4.2 };

test('un gálibo sobre la ruta se avisa como informativo: se pasa', () => {
  const aviso = textoDeAviso({ tipo: 'galibo', metres: 3.9, meters: 150, name: 'Avenida Sáenz' }, camion);

  assert.equal(aviso.calcomania, 'galiboOk');
  assert.equal(aviso.titulo, 'Gálibo de 3,90 m en 150 m');
  assert.match(aviso.sub, /Pasás/);
  assert.match(aviso.sub, /El Rayo/);
});

test('un paso a nivel dice qué barrera tiene y pide bajar la velocidad', () => {
  assert.equal(textoDeAviso({ tipo: 'paso', meters: 150, barrier: 'half' }).titulo, 'Paso a nivel en 150 m');
  assert.equal(textoDeAviso({ tipo: 'paso', meters: 150, barrier: 'half' }).sub, 'Con media barrera · Bajá la velocidad');
  assert.equal(textoDeAviso({ tipo: 'paso', meters: 80, barrier: 'no' }).sub, 'Sin barrera · Bajá la velocidad');
  assert.equal(textoDeAviso({ tipo: 'paso', meters: 80, barrier: null }).sub, 'Bajá la velocidad');
  assert.equal(textoDeAviso({ tipo: 'paso', meters: 80 }).calcomania, 'paso');
});

test('un reporte se avisa con su tipo y su calle; la restricción dice si está sin confirmar o si no pasás', () => {
  const accidente = textoDeAviso({ tipo: 'reporte', subtipo: 'Accident', meters: 300, street: 'Av. Rivadavia' });
  assert.equal(accidente.calcomania, 'accidente');
  assert.equal(accidente.titulo, 'Accidente en 300 m');
  assert.equal(accidente.sub, 'Av. Rivadavia · Reportado por la comunidad');

  const cierre = textoDeAviso({ tipo: 'reporte', subtipo: 'RoadClosed', meters: 400, street: null, validated: false });
  assert.equal(cierre.titulo, 'Calle cerrada en 400 m');
  assert.match(cierre.sub, /sin confirmar/i);

  const galibo = textoDeAviso({ tipo: 'reporte', subtipo: 'LowClearance', meters: 250, value: 3.8, validated: true, forYourTruck: 'incompatible' }, camion);
  assert.equal(galibo.calcomania, 'galiboReporte');
  assert.equal(galibo.titulo, 'Gálibo reportado de 3,80 m en 250 m');
  assert.match(galibo.sub, /no pasás/i);
  assert.match(galibo.sub, /El Rayo/);

  const camara = textoDeAviso({ tipo: 'reporte', subtipo: 'Camera', meters: 200, fixed: true });
  assert.equal(camara.calcomania, 'camaraComunidad');
  assert.equal(camara.titulo, 'Cámara en 200 m');
});

test('un radar dice dónde está', () => {
  const aviso = textoDeAviso({ tipo: 'radar', meters: 200, ubicacion: 'AV. SÁENZ - 1200' });

  assert.equal(aviso.calcomania, 'radar');
  assert.equal(aviso.titulo, 'Radar de velocidad en 200 m');
  assert.equal(aviso.sub, 'AV. SÁENZ - 1200');
});

test('un aviso que no se conoce no arma tarjeta', () => {
  assert.equal(textoDeAviso({ tipo: 'loquesea', meters: 10 }), null);
  assert.equal(textoDeAviso(null), null);
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

/* ---------------------------------------------------------------------------
   Reanudar (waze-03 y el prototipo): al abrir la app con un viaje abierto
--------------------------------------------------------------------------- */

test('la pregunta nombra el destino en corto; sin nombre, pregunta igual', () => {
  assert.equal(preguntaDeReanudar({ destinationLabel: 'Puerto de Buenos Aires, Retiro, CABA' }), '¿Seguís yendo a Puerto de Buenos Aires?');
  assert.equal(preguntaDeReanudar({ destinationLabel: 'Avenida Sáenz 1200, Nueva Pompeya' }), '¿Seguís yendo a Av. Sáenz 1200?');
  assert.equal(preguntaDeReanudar({ destinationLabel: null }), '¿Seguís con el viaje que quedó abierto?');
});

test('la tarjeta: la pregunta, la "i", y las píldoras No y Continuar viaje', () => {
  const html = tarjetaReanudar({ destinationLabel: 'Puerto <b>x</b>' });

  assert.ok(html.includes('¿Seguís yendo a Puerto &lt;b&gt;x&lt;/b&gt;?'));
  assert.ok(html.includes('data-accion="info"'));
  assert.ok(html.includes('data-accion="no"'));
  assert.ok(html.includes('data-accion="continuar"'));
});

/* ---------------------------------------------------------------------------
   El cierre del viaje: qué dice la pantalla de fin
--------------------------------------------------------------------------- */

import { textoDeCierre } from '../../src/TruckNavigator.Api/wwwroot/js/views/fin-viaje.js';

test('el cierre del invitado dice los kilómetros que hizo y que no se guardaron', () => {
  const t = textoDeCierre({ invitado: true, distanceMeters: 24_300, creditedDistanceMeters: 0 });

  assert.equal(t.titulo, 'Hiciste 24,3 km');
  assert.match(t.bajada, /No se guardaron/);
  assert.match(t.bajada, /kilómetros/);
  assert.deepEqual(t.acciones, ['crear-cuenta', 'seguir']);
});

test('el cierre del invitado no festeja nada: no hay nada que festejar y fingirlo sería mentir', () => {
  assert.equal(textoDeCierre({ invitado: true, distanceMeters: 1_000, creditedDistanceMeters: 0 }).festeja, false);
});

test('el cierre con cuenta sigue siendo el de siempre', () => {
  const t = textoDeCierre({
    creditedDistanceMeters: 12_000,
    originLabel: 'Casa',
    destinationLabel: 'Depósito',
    earned: { totalExperience: 40 }
  });

  assert.equal(t.titulo, '¡Viaje completado!');
  assert.equal(t.bajada, 'Casa → Depósito');
  assert.equal(t.festeja, true);
});

test('subir de nivel se anuncia con el nombre del nivel nuevo', () => {
  const t = textoDeCierre({
    creditedDistanceMeters: 12_000,
    earned: { leveledUp: true, levelAfter: { name: 'Repartidor' } }
  });

  assert.equal(t.titulo, '¡Subiste a Repartidor!');
});

test('un viaje que no acreditó lo dice, y tampoco festeja', () => {
  const t = textoDeCierre({ creditedDistanceMeters: 0 });

  assert.equal(t.titulo, 'Llegaste');
  assert.match(t.bajada, /No sumó kilómetros/);
  assert.equal(t.festeja, false);
});

/* ---------------------------------------------------------------------------
   Salir del viaje
--------------------------------------------------------------------------- */

test('salir del viaje pregunta lo mismo de siempre: llegué, abandonar o seguir', () => {
  const p = preguntaDeSalida({ invitado: false });

  assert.equal(p.title, '¿Salís del viaje?');
  assert.deepEqual(p.options.map((o) => o.id), ['arrived', 'abandon', 'stay']);
  assert.match(p.message, /acreditan los kilómetros/);
});

test('al invitado no se le prometen kilómetros: su viaje no se guarda', () => {
  const p = preguntaDeSalida({ invitado: true });

  // Las mismas tres salidas: "Llegué" lleva a su pantalla de cierre, que es
  // donde ve lo que anduvo y la invitación a crear la cuenta.
  assert.deepEqual(p.options.map((o) => o.id), ['arrived', 'abandon', 'stay']);
  assert.doesNotMatch(p.message, /acredit/);
  assert.match(p.message, /no se guarda/);
});
