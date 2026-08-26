/**
 * Motor de guiado: las reglas que se pagan manejando.
 *
 * `navigation.js` no importa nada y no toca ninguna API del navegador, asi que
 * corre tal cual en Node. Estos tests no reemplazan la prueba en movimiento
 * —esa sigue pendiente— pero fijan las reglas que ya se decidieron y que son
 * faciles de romper sin darse cuenta al tocar el archivo.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  prepareRoute,
  advance,
  angleDifference,
  shouldReroute,
  pendingAnnouncement,
  speakableInstruction,
  maneuverArrow,
  STRIKES_TO_REROUTE,
  REROUTE_COOLDOWN_MS
} from '../../src/TruckNavigator.Api/wwwroot/js/navigation.js';

/* ---------------------------------------------------------------------------
   Angulos
--------------------------------------------------------------------------- */

test('angleDifference toma siempre el camino corto', () => {
  assert.equal(angleDifference(10, 10), 0);
  assert.equal(angleDifference(0, 90), 90);
  assert.equal(angleDifference(90, 0), 90);

  // El caso que importa: cruzando el norte, 350 y 10 estan a 20 grados, no a 340.
  assert.equal(angleDifference(350, 10), 20);
  assert.equal(angleDifference(10, 350), 20);

  // Opuestos exactos: 180 y no -180 ni 180.0000001.
  assert.equal(angleDifference(0, 180), 180);
});

/* ---------------------------------------------------------------------------
   Recalculo

   Dos condiciones y las dos hacen falta: varios fixes seguidos afuera, para no
   reaccionar a un rebote del GPS, y una espera entre recalculos, para que un
   destino inalcanzable no genere una tormenta de pedidos.
--------------------------------------------------------------------------- */

const desviado = (strikes) => ({ strikes, hasArrived: false });

test('no recalcula con menos strikes de los necesarios', () => {
  for (let strikes = 0; strikes < STRIKES_TO_REROUTE; strikes++) {
    assert.equal(shouldReroute(desviado(strikes), null), false, `strikes=${strikes}`);
  }
});

test('recalcula al llegar al umbral de strikes, si nunca recalculo', () => {
  assert.equal(shouldReroute(desviado(STRIKES_TO_REROUTE), null), true);
});

test('respeta el enfriamiento entre recalculos', () => {
  const ahora = 1_000_000;
  const state = desviado(STRIKES_TO_REROUTE);

  // Recien recalculado: no otra vez.
  assert.equal(shouldReroute(state, ahora - 1, ahora), false);

  // Justo en el limite: si.
  assert.equal(shouldReroute(state, ahora - REROUTE_COOLDOWN_MS, ahora), true);

  // Un milisegundo antes del limite: no.
  assert.equal(shouldReroute(state, ahora - REROUTE_COOLDOWN_MS + 1, ahora), false);
});

test('no recalcula si ya llego', () => {
  const llegado = { strikes: STRIKES_TO_REROUTE + 5, hasArrived: true };
  assert.equal(shouldReroute(llegado, null), false);
});

test('un estado nulo no rompe ni dispara recalculo', () => {
  assert.equal(shouldReroute(null, null), false);
});

/* ---------------------------------------------------------------------------
   Avisos

   Se avisa al CRUZAR el umbral, no por estar debajo. Si el criterio fuera
   "estar debajo", una maniobra que aparece a 150 m dispararia el aviso de 800
   y enseguida el de 300, y el conductor escucharia dos veces el mismo giro.
--------------------------------------------------------------------------- */

const enManiobra = (indice, metros) => ({
  next: { fromPointIndex: indice, kind: 'Left', streetName: 'Corrientes' },
  distanceToManeuver: metros
});

test('avisa al cruzar el umbral', () => {
  const antes = enManiobra(4, 900);
  const ahora = enManiobra(4, 700);

  const aviso = pendingAnnouncement(ahora, antes, new Set());

  assert.deepEqual(aviso, { key: '4:800', meters: 800 });
});

test('NO avisa un umbral del que nunca se estuvo lejos', () => {
  // La maniobra aparece a 150 m: nunca se cruzo ni el de 800 ni el de 300.
  const antes = enManiobra(4, 150);
  const ahora = enManiobra(4, 120);

  assert.equal(pendingAnnouncement(ahora, antes, new Set()), null);
});

test('no repite un aviso ya dicho', () => {
  const antes = enManiobra(4, 900);
  const ahora = enManiobra(4, 700);

  assert.equal(pendingAnnouncement(ahora, antes, new Set(['4:800'])), null);
});

test('no arrastra el umbral cruzado a otra maniobra', () => {
  // Cambio la maniobra pendiente: no hay nada que se haya cruzado todavia.
  const antes = enManiobra(4, 900);
  const ahora = enManiobra(9, 700);

  assert.equal(pendingAnnouncement(ahora, antes, new Set()), null);
});

test('sin estado anterior no hay cruce posible', () => {
  assert.equal(pendingAnnouncement(enManiobra(4, 700), null, new Set()), null);
});

test('sin maniobra pendiente no avisa', () => {
  assert.equal(pendingAnnouncement({ next: null, distanceToManeuver: 10 }, null, new Set()), null);
});

/* ---------------------------------------------------------------------------
   Frases

   Se dicen distancias pronunciables. "En doscientos ochenta y siete metros"
   ademas de raro tarda mas de lo que dura la ventana para escucharlo.
--------------------------------------------------------------------------- */

const giro = { kind: 'Left', streetName: 'Corrientes' };

test('redondea la distancia a multiplos de 50', () => {
  assert.equal(speakableInstruction(giro, 287), 'En 300 metros, girá a la izquierda por Corrientes.');
  assert.equal(speakableInstruction(giro, 260), 'En 250 metros, girá a la izquierda por Corrientes.');
});

test('cerca de la maniobra dice la orden sin distancia', () => {
  assert.equal(speakableInstruction(giro, 80), 'Girá a la izquierda por Corrientes.');
  assert.equal(speakableInstruction(giro, 20), 'Girá a la izquierda por Corrientes.');
});

test('nunca dice menos de 50 metros', () => {
  // Por encima del umbral de 80 pero cerca: el redondeo no puede dar 0.
  assert.match(speakableInstruction(giro, 90), /^En 100 metros/);
});

test('en kilometros usa coma decimal, que es como se lee en castellano', () => {
  assert.equal(speakableInstruction(giro, 2400), 'En 2,4 kilómetros, girá a la izquierda por Corrientes.');
});

test('a partir de diez kilometros no usa decimales', () => {
  assert.equal(speakableInstruction(giro, 12400), 'En 12 kilómetros, girá a la izquierda por Corrientes.');
});

test('sin nombre de calle no inventa uno', () => {
  const frase = speakableInstruction({ kind: 'Left' }, 300);
  assert.equal(frase, 'En 300 metros, girá a la izquierda.');
  assert.ok(!frase.includes('undefined'));
});

test('la llegada tiene frase propia', () => {
  assert.equal(speakableInstruction({ kind: 'Finish' }, 40), 'Llegaste a destino.');
  assert.equal(speakableInstruction({ kind: 'Finish' }, 500), 'Llegás a destino en 500 metros.');
});

test('la rotonda dice que salida tomar', () => {
  const frase = speakableInstruction({ kind: 'Roundabout', exitNumber: 2 }, 300);
  assert.equal(frase, 'En 300 metros, tomá la salida 2 de la rotonda.');
});

test('una maniobra desconocida no rompe la voz', () => {
  assert.equal(speakableInstruction({ kind: 'EstoNoExiste' }, 300), 'En 300 metros, seguí la ruta.');
  assert.equal(speakableInstruction(null, 300), '');
});

test('toda maniobra tiene flecha, incluso una que no existe', () => {
  assert.equal(maneuverArrow('Left'), '←');
  assert.equal(maneuverArrow('EstoNoExiste'), '↑');
  assert.equal(maneuverArrow(undefined), '↑');
});

/* ---------------------------------------------------------------------------
   Ruta preparada y avance

   Se arma una ruta recta de este a oeste sobre una latitud de CABA. Los numeros
   se comparan contra la geometria, no contra lo que devuelve el codigo: si la
   proyeccion se rompe, estos tests lo dicen.
--------------------------------------------------------------------------- */

/** Ruta recta hacia el este desde Plaza de Mayo, en pasos de ~100 m. */
function rutaRecta(pasos = 10) {
  const lat = -34.6083;
  const lng0 = -58.4370;

  // 100 m en longitud a esta latitud.
  const paso = 100 / (111_320 * Math.cos(lat * Math.PI / 180));

  const coordinates = [];
  for (let i = 0; i <= pasos; i++) {
    coordinates.push([lng0 + paso * i, lat]);
  }

  return {
    geometry: { type: 'LineString', coordinates },
    distanceMeters: 100 * pasos,
    durationSeconds: 60 * pasos,
    instructions: []
  };
}

test('prepareRoute mide la ruta con error menor al uno por ciento', () => {
  const prepared = prepareRoute(rutaRecta(10));

  assert.ok(prepared, 'la ruta tiene que prepararse');
  assert.equal(prepared.points.length, 11);

  const error = Math.abs(prepared.totalMeters - 1000) / 1000;
  assert.ok(error < 0.01, `error de ${(error * 100).toFixed(2)}% en 1 km`);
});

test('la distancia acumulada crece de forma monotona', () => {
  const { cumulative } = prepareRoute(rutaRecta(10));

  assert.equal(cumulative[0], 0);

  for (let i = 1; i < cumulative.length; i++) {
    assert.ok(cumulative[i] > cumulative[i - 1], `retrocede en el vertice ${i}`);
  }
});

test('prepareRoute conserva lo que informo el servidor y no lo recalcula', () => {
  // Es lo que quedo registrado en el viaje: mostrar otro numero seria mentir
  // sobre lo que se acredito.
  const prepared = prepareRoute({ ...rutaRecta(10), distanceMeters: 987 });
  assert.equal(prepared.reportedMeters, 987);
});

test('una ruta sin dos puntos no se prepara', () => {
  assert.equal(prepareRoute(null), null);
  assert.equal(prepareRoute({ geometry: { coordinates: [] } }), null);
  assert.equal(prepareRoute({ geometry: { coordinates: [[-58.4, -34.6]] } }), null);
});

test('advance descuenta lo recorrido a medida que se avanza', () => {
  const prepared = prepareRoute(rutaRecta(10));
  const puntos = prepared.points;

  let previo = null;
  let anterior = Infinity;

  for (let i = 0; i < puntos.length; i++) {
    const estado = advance(prepared, { lat: puntos[i].lat, lng: puntos[i].lng, accuracy: 5 }, previo);

    assert.ok(estado.remainingMeters <= anterior + 1,
      `lo que falta crecio en el vertice ${i}: ${anterior} -> ${estado.remainingMeters}`);

    anterior = estado.remainingMeters;
    previo = estado;
  }

  // Parado en el ultimo vertice, no puede faltar mas de un metro.
  assert.ok(anterior < 1, `al final faltan ${anterior} m`);
});

test('estar sobre la ruta no acumula strikes', () => {
  const prepared = prepareRoute(rutaRecta(10));
  const puntos = prepared.points;

  let estado = null;

  for (const punto of puntos) {
    estado = advance(prepared, { lat: punto.lat, lng: punto.lng, accuracy: 5 }, estado);
  }

  assert.equal(estado.strikes, 0);
});
