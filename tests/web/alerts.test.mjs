/**
 * Avisos de lo que hay sobre la ruta: gálibos, pasos a nivel y radares.
 *
 * Estos avisos son el único canal que llega manejando —la vista va a la calle y
 * la voz se pierde con el motor—, así que sus dos formas de fallar son caras y
 * silenciosas: avisar de un puente por el que uno NO va a pasar enseña a
 * desconfiar del aviso, y no avisar del que sí importa es exactamente el choque
 * que la app existe para evitar.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  prepareRoute,
  alertsAlongRoute,
  pendingRouteAlert,
  speakableAlert,
  normalizarCalle
} from '../../src/TruckNavigator.Api/wwwroot/js/navigation.js';

/* ---------------------------------------------------------------------------
   Andamio

   Una recta hacia el este desde el Obelisco. A esta latitud un grado de longitud
   son unos 91.700 m, así que los puntos se calculan en metros y se convierten,
   y las distancias de los tests quedan en metros de verdad.
--------------------------------------------------------------------------- */

const LAT = -34.6037;
const LNG = -58.3816;
const METRO = 1 / (111320 * Math.cos(LAT * Math.PI / 180));   // grados por metro

const coordenadas = (largo) => {
  const coordinates = [];
  for (let m = 0; m <= largo; m += 100) coordinates.push([LNG + m * METRO, LAT]);
  return coordinates;
};

/** Ruta recta al este, de `largo` metros, sin calle conocida ni gálibos. */
function rectaAlEste(largo = 2000) {
  return prepareRoute({ geometry: { coordinates: coordenadas(largo) }, instructions: [] });
}

/** Una recta al este por una calle con nombre. */
function rectaPor(streetName, largo = 2000) {
  const coordinates = coordenadas(largo);

  return prepareRoute({
    geometry: { coordinates },
    instructions: [{ text: 'Seguí', streetName, kind: 'Continue', fromPointIndex: 0, toPointIndex: coordinates.length - 1 }]
  });
}

/** Una ruta con un gálibo declarado entre los puntos 5 y 7 (a 500 m). */
function rectaConGalibo(metres = 4.5) {
  return prepareRoute({
    geometry: { coordinates: coordenadas(2000) },
    instructions: [],
    hazards: [{ kind: 'galibo', metres, streetName: 'Av. Sáenz', fromPointIndex: 5, toPointIndex: 7 }]
  });
}

/** Un punto a `metros` del arranque y `desvio` metros al norte de la ruta. */
const punto = (metros, desvio = 0, properties = {}) => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [LNG + metros * METRO, LAT + desvio / 110574] }
});

const capa = (...features) => ({ type: 'FeatureCollection', features });

/* ---------------------------------------------------------------------------
   Qué cuenta como "sobre la ruta"
--------------------------------------------------------------------------- */

test('lo que está sobre la ruta se ubica por distancia recorrida', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(500)) });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].tipo, 'radar');
  assert.ok(Math.abs(alerts[0].at - 500) < 2, `quedó en ${alerts[0].at} y debía estar cerca de 500`);
});

test('lo que está lejos de la ruta no se avisa', () => {
  const prepared = rectaAlEste();

  // 80 m al costado: la calle paralela, o la colectora. Avisar de un puente por
  // el que uno no va a pasar enseña a desconfiar del aviso.
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(500, 80)) });

  assert.equal(alerts.length, 0);
});

test('lo que está al borde del corredor sí se avisa', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(500, 20)) });

  assert.equal(alerts.length, 1);
});

test('los avisos salen ordenados por dónde aparecen', () => {
  const prepared = rectaAlEste();

  const alerts = alertsAlongRoute(prepared, {
    radares: capa(punto(1500), punto(300)),
    pasos: capa(punto(900))
  });

  const posiciones = alerts.map((a) => Math.round(a.at));

  assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b),
    'sin orden, el aviso de un puente lejano puede taparse con uno cercano');
});

/* ---------------------------------------------------------------------------
   Gálibos: salen de la ruta, no de la capa

   Un gálibo por el que el camión no pasa no puede estar sobre la ruta: el motor
   lo excluye antes de calcular. Lo que hay que avisar es el que la ruta SÍ
   recorre, y eso lo dice la ruta misma (hazards), no una capa que puede quedar
   a cero metros por debajo de un puente por el que uno pasa por arriba.
--------------------------------------------------------------------------- */

test('un gálibo de la ruta se avisa donde empieza, y es informativo', () => {
  const alerts = alertsAlongRoute(rectaConGalibo(4.5), {});

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].tipo, 'galibo');
  assert.equal(alerts[0].metres, 4.5);
  assert.equal(alerts[0].name, 'Av. Sáenz');
  assert.ok(Math.abs(alerts[0].at - 500) < 2, `quedó en ${alerts[0].at} y debía estar cerca de 500`);
});

test('la capa de gálibos ya no manda avisos, aunque se la pase', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { galibos: capa(punto(500, 0, { metres: 3.0 })) });

  assert.equal(alerts.length, 0,
    'yendo por arriba de un puente, el bajo vía de la capa queda a cero metros: avisar "no pasás" ahí es falso');
});

test('sin hazards en la ruta no se avisa ningún gálibo', () => {
  assert.equal(alertsAlongRoute(rectaAlEste(), {}).filter((a) => a.tipo === 'galibo').length, 0);
});

/* ---------------------------------------------------------------------------
   Radares: por corredor Y por calle

   El dataset trae la calle del radar ("AV. JOSE MARÍA MORENO - 1657"). Un radar
   sobre la avenida que se CRUZA queda dentro del corredor de 30 m y no es de
   uno: si la ruta sabe por qué calle va en ese punto, el nombre tiene que
   coincidir.
--------------------------------------------------------------------------- */

test('un radar de la calle por la que se va se avisa', () => {
  const prepared = rectaPor('Avenida José María Moreno');
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(500, 10, { ubicacion: 'AV. JOSE MARÍA MORENO - 1657' })) });

  assert.equal(alerts.length, 1);
});

test('un radar de la calle que se cruza NO se avisa aunque esté a diez metros', () => {
  const prepared = rectaPor('Avenida José María Moreno');
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(500, 10, { ubicacion: 'AV. RIVADAVIA - 4800' })) });

  assert.equal(alerts.length, 0, 'el de la avenida que se cruza es el falso positivo clásico del corredor');
});

test('si la ruta no sabe por qué calle va, el corredor decide solo', () => {
  const alerts = alertsAlongRoute(rectaAlEste(), { radares: capa(punto(500, 10, { ubicacion: 'AV. RIVADAVIA - 4800' })) });

  assert.equal(alerts.length, 1);
});

test('normalizarCalle iguala mayúsculas, acentos, prefijos y numeración', () => {
  assert.equal(normalizarCalle('AV. JOSE MARÍA MORENO - 1657'), 'JOSE MARIA MORENO');
  assert.equal(normalizarCalle('Avenida José María Moreno'), 'JOSE MARIA MORENO');
  assert.equal(normalizarCalle('Au. 25 de Mayo'), '25 DE MAYO');
  assert.equal(normalizarCalle(null), '');
});

/* ---------------------------------------------------------------------------
   Pasos a nivel: corredor angosto

   El cruce está SOBRE la calle que se recorre; uno a 20 m es el de la calle
   paralela, que en un barrio con vías corre pegada.
--------------------------------------------------------------------------- */

test('un paso a nivel sobre la ruta se avisa', () => {
  assert.equal(alertsAlongRoute(rectaAlEste(), { pasos: capa(punto(700, 6)) }).length, 1);
});

test('un paso a nivel a veinte metros es el de la calle de al lado', () => {
  assert.equal(alertsAlongRoute(rectaAlEste(), { pasos: capa(punto(700, 20)) }).length, 0);
});

/* ---------------------------------------------------------------------------
   Cuándo se dispara

   Al CRUZAR el umbral, no por estar debajo: con "estar debajo", el aviso salta
   en cada latido del GPS durante doscientos metros.
--------------------------------------------------------------------------- */

test('se avisa al cruzar el umbral, una sola vez', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(1000)) });
  const dados = new Set();

  // Todavía lejos: nada.
  assert.equal(pendingRouteAlert(alerts, 700, 650, dados), null);

  // Cruza los 200 m que faltan: avisa.
  const aviso = pendingRouteAlert(alerts, 810, 780, dados);
  assert.ok(aviso, 'debía avisar al cruzar el umbral');
  dados.add(aviso.key);

  // Sigue acercándose: NO vuelve a avisar.
  assert.equal(pendingRouteAlert(alerts, 900, 810, dados), null);
  assert.equal(pendingRouteAlert(alerts, 980, 900, dados), null);
});

test('sin posición anterior no se avisa', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(1000)) });

  // El primer fix del viaje no cruzó ningún umbral: no hay "antes".
  assert.equal(pendingRouteAlert(alerts, 850, null, new Set()), null);
});

test('lo que quedó atrás no vuelve a avisar', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(300)) });
  const dados = new Set();

  // Se arranca ya pasado el radar —un recálculo, o el GPS que enganchó tarde—.
  assert.equal(pendingRouteAlert(alerts, 900, 800, dados), null);
  assert.ok(dados.size > 0, 'se marca como dado para que no reaparezca si el GPS retrocede');
});

test('avisa del más cercano primero', () => {
  const prepared = rectaAlEste();
  const alerts = alertsAlongRoute(prepared, { radares: capa(punto(1800), punto(600)) });

  const aviso = pendingRouteAlert(alerts, 410, 390, new Set());

  assert.ok(aviso);
  assert.ok(Math.abs(aviso.at - 600) < 2, 'debía avisar del que está a 600, no del de 1800');
});

/* ---------------------------------------------------------------------------
   Lo que se dice
--------------------------------------------------------------------------- */

test('el aviso de gálibo dice la altura y que se pasa', () => {
  const frase = speakableAlert({ tipo: 'galibo', metres: 4.5 });

  assert.match(frase, /4,50/, 'la altura va con coma, que es como se lee en castellano');
  assert.match(frase, /pas/i);
  assert.doesNotMatch(frase, /no pas/i, 'sobre una ruta calculada para este camión, un gálibo siempre se pasa');
});

test('cada tipo tiene su frase, y lo desconocido no inventa ninguna', () => {
  assert.ok(speakableAlert({ tipo: 'paso' }));
  assert.ok(speakableAlert({ tipo: 'radar' }));
  assert.equal(speakableAlert({ tipo: 'loquesea' }), null);
  assert.equal(speakableAlert(null), null);
});

/* ---------------------------------------------------------------------------
   Bordes
--------------------------------------------------------------------------- */

test('sin ruta preparada no se rompe', () => {
  assert.deepEqual(alertsAlongRoute(null, { radares: capa(punto(500)) }), []);
  assert.deepEqual(alertsAlongRoute(undefined, {}), []);
});

test('sin datasets no se rompe', () => {
  const prepared = rectaAlEste();

  assert.deepEqual(alertsAlongRoute(prepared), []);
  assert.deepEqual(alertsAlongRoute(prepared, { galibos: null, pasos: undefined }), []);
});

test('una geometría rota se saltea sin tumbar el resto', () => {
  const prepared = rectaAlEste();

  const rota = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [] } };
  const alerts = alertsAlongRoute(prepared, { radares: capa(rota, punto(500)) });

  assert.equal(alerts.length, 1, 'la buena tiene que sobrevivir a la rota');
});
