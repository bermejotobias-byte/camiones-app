/**
 * Los reportes de la comunidad (spec del 19/09/2026): el catálogo como lo ve
 * la app, la edad legible, el sentido de marcha, la capa, el toast, y cuándo
 * preguntar "¿sigue ahí?".
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TIPOS, tipoDeReporte, etiquetaEdad, mismoSentido, estadoDelPin, featuresDeReportes,
  textoDelToast, deberiaPreguntar, bboxDeRuta, bboxVisible,
  seccionReportar, hojaGalibo, fichaReporte, promptSigueAhi
} from '../../src/TruckNavigator.Api/wwwroot/js/mapa/reportes.js';

const ahora = Date.parse('2026-09-19T15:00:00-03:00');

const reporte = (extra = {}) => ({
  id: 'r1', type: 'Accident', kind: 'info', latitude: -34.6, longitude: -58.4, street: 'Av. Corrientes 5500',
  headingDegrees: null, value: null, createdAt: '2026-09-19T14:48:00-03:00', expiresAt: '2026-09-19T16:48:00-03:00',
  status: 'Active', fixed: false, reliability: { score: 50, label: 'new' }, confirmations: 0, rejections: 0,
  validated: false, reportedBy: { alias: 'elgaucho' }, mine: false, yourVote: null, forYourTruck: null, ...extra
});

/* ---------------------------------------------------------------------------
   El catálogo
--------------------------------------------------------------------------- */

test('son diez tipos, sin repetidos, en el orden de la grilla', () => {
  assert.equal(TIPOS.length, 10);
  assert.equal(new Set(TIPOS.map((t) => t.id)).size, 10);
  assert.equal(new Set(TIPOS.map((t) => t.tipo)).size, 10);
  assert.deepEqual(TIPOS.map((t) => t.tipo), [
    'Accident', 'Traffic', 'Checkpoint', 'Police', 'Camera', 'Roadworks', 'Pothole', 'Hazard', 'RoadClosed', 'LowClearance'
  ]);
});

test('sólo el gálibo pide un valor, y sólo la calle cerrada y el gálibo son restricción', () => {
  assert.deepEqual(TIPOS.filter((t) => t.pideValor).map((t) => t.tipo), ['LowClearance']);
  assert.deepEqual(TIPOS.filter((t) => t.restriccion).map((t) => t.tipo), ['RoadClosed', 'LowClearance']);
});

test('cada tipo tiene nombre y calcomanía propia', () => {
  for (const t of TIPOS) {
    assert.ok(t.nombre.length > 2, t.tipo);
    assert.ok(t.calcomania, t.tipo);
  }
  assert.equal(new Set(TIPOS.map((t) => t.calcomania)).size, 10);
});

test('se busca un tipo por el nombre del enum, y uno desconocido no rompe', () => {
  assert.equal(tipoDeReporte('Pothole').nombre, 'Bache');
  assert.equal(tipoDeReporte('Ovni').nombre, 'Reporte');
});

/* ---------------------------------------------------------------------------
   La edad
--------------------------------------------------------------------------- */

test('la edad se lee como la diría una persona', () => {
  assert.equal(etiquetaEdad('2026-09-19T14:59:30-03:00', ahora), 'recién');
  assert.equal(etiquetaEdad('2026-09-19T14:48:00-03:00', ahora), 'hace 12 min');
  assert.equal(etiquetaEdad('2026-09-19T11:40:00-03:00', ahora), 'hace 3 h');
  assert.equal(etiquetaEdad('2026-09-17T09:00:00-03:00', ahora), 'hace 2 días');
  assert.equal(etiquetaEdad('2026-09-18T09:00:00-03:00', ahora), 'hace 1 día');
});

test('una cámara fija no tiene edad', () => {
  assert.equal(etiquetaEdad('2026-09-01T09:00:00-03:00', ahora, { fija: true }), null);
});

/* ---------------------------------------------------------------------------
   El sentido de marcha
--------------------------------------------------------------------------- */

test('sin rumbo en el reporte, le importa a todos; con rumbo, sólo a quien va parecido', () => {
  assert.equal(mismoSentido(null, 90), true);
  assert.equal(mismoSentido(90, 90), true);
  assert.equal(mismoSentido(90, 170), true);      // 80° de diferencia
  assert.equal(mismoSentido(90, 200), false);     // 110°
  assert.equal(mismoSentido(350, 10), true);      // 20°, cruzando el norte
  assert.equal(mismoSentido(90, 270), false);     // en contra
  assert.equal(mismoSentido(90, null), true);     // la ruta no sabe: no se filtra
});

/* ---------------------------------------------------------------------------
   La capa
--------------------------------------------------------------------------- */

test('el estado del pin: nuevo, confirmado, en duda, rojo para lo que no le sirve al camión, y fijo', () => {
  assert.equal(estadoDelPin(reporte()), 'nuevo');
  assert.equal(estadoDelPin(reporte({ reliability: { score: 74, label: 'confirmed' } })), 'confirmado');
  assert.equal(estadoDelPin(reporte({ reliability: { score: 40, label: 'disputed' } })), 'duda');
  assert.equal(estadoDelPin(reporte({ type: 'LowClearance', kind: 'restriction', forYourTruck: 'incompatible' })), 'rojo');
  assert.equal(estadoDelPin(reporte({ type: 'Camera', fixed: true, status: 'Fixed' })), 'fijo');
});

test('lo que no le sirve al camión es rojo aunque esté confirmado', () => {
  assert.equal(estadoDelPin(reporte({
    type: 'RoadClosed', kind: 'restriction', forYourTruck: 'incompatible', reliability: { score: 80, label: 'confirmed' }
  })), 'rojo');
});

test('la capa lleva un feature por reporte con lo que el pin necesita', () => {
  const geojson = featuresDeReportes([reporte(), reporte({ id: 'r2', type: 'Camera', fixed: true })]);

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 2);
  assert.deepEqual(geojson.features[0].geometry, { type: 'Point', coordinates: [-58.4, -34.6] });
  assert.equal(geojson.features[0].properties.id, 'r1');
  assert.equal(geojson.features[0].properties.pin, 'reporte-accidente-nuevo');
  assert.equal(geojson.features[1].properties.pin, 'reporte-camara-fijo');
});

test('una lista vacía o nula da una capa vacía', () => {
  assert.deepEqual(featuresDeReportes([]).features, []);
  assert.deepEqual(featuresDeReportes(null).features, []);
});

/* ---------------------------------------------------------------------------
   El toast
--------------------------------------------------------------------------- */

test('el toast dice qué se reportó y dónde, si se sabe', () => {
  assert.equal(textoDelToast(reporte()), 'Reportado · Accidente en Av. Corrientes 5500');
  assert.equal(textoDelToast(reporte({ street: null })), 'Reportado · Accidente');
  assert.equal(textoDelToast(reporte({ type: 'LowClearance', value: 3.8, street: null })), 'Reportado · Gálibo bajo 3,80 m');
});

/* ---------------------------------------------------------------------------
   ¿Sigue ahí?
--------------------------------------------------------------------------- */

test('se pregunta una vez, al alejarse después de haber pasado cerca', () => {
  const base = { reporte: reporte(), yaPreguntado: false, mio: false, votado: false };

  assert.equal(deberiaPreguntar({ ...base, distancia: 40, distanciaAnterior: 80 }), false);   // acercándose
  assert.equal(deberiaPreguntar({ ...base, distancia: 55, distanciaAnterior: 40 }), true);    // pasó y se aleja
  assert.equal(deberiaPreguntar({ ...base, distancia: 120, distanciaAnterior: 90 }), false);  // nunca estuvo cerca
  assert.equal(deberiaPreguntar({ ...base, distancia: 55, distanciaAnterior: 40, yaPreguntado: true }), false);
  assert.equal(deberiaPreguntar({ ...base, distancia: 55, distanciaAnterior: 40, mio: true }), false);
  assert.equal(deberiaPreguntar({ ...base, distancia: 55, distanciaAnterior: 40, votado: true }), false);
});

/* ---------------------------------------------------------------------------
   Los recuadros
--------------------------------------------------------------------------- */

test('el recuadro de la ruta la envuelve con margen, en el orden que pide la API', () => {
  const bbox = bboxDeRuta([[-58.44, -34.60], [-58.42, -34.59]], 500);
  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);

  assert.ok(minLon < -58.44 && maxLon > -58.42);
  assert.ok(minLat < -34.60 && maxLat > -34.59);
  assert.ok(Math.abs((maxLat - (-34.59)) * 111_320 - 500) < 5);
});

test('el recuadro visible sale de los límites del mapa', () => {
  assert.equal(bboxVisible({ west: -58.44, south: -34.61, east: -58.42, north: -34.59 }), '-58.44,-34.61,-58.42,-34.59');
});

/* ---------------------------------------------------------------------------
   Las hojas
--------------------------------------------------------------------------- */

test('la sección de reportar: diez círculos, uno por tipo, con su nombre', () => {
  const html = seccionReportar();

  assert.equal((html.match(/data-accion="reportar" data-tipo="[A-Za-z]+"/g) ?? []).length, 10);
  assert.ok(html.includes('data-tipo="LowClearance"'));
  assert.ok(html.includes('Calle cerrada'));
  assert.ok(html.includes('Reportar'));
});

test('el gálibo pide los metros con valores grandes prearmados y "otro"', () => {
  const html = hojaGalibo({ valor: null });

  for (const v of ['3,5', '3,8', '4,0', '4,3', '4,5']) assert.ok(html.includes(`>${v}<`), v);
  assert.equal((html.match(/data-accion="galibo-valor" data-valor="[0-9.]+"/g) ?? []).length, 5);
  assert.ok(html.includes('data-accion="galibo-otro"'));
  assert.ok(html.includes('data-accion="cerrar"'));
});

test('la ficha: tipo, calle o "cerca de acá", edad y conteos, quién, y los dos botones', () => {
  const html = fichaReporte(reporte({ confirmations: 2 }), { ahora });

  assert.ok(html.includes('Accidente'));
  assert.ok(html.includes('Av. Corrientes 5500'));
  assert.ok(html.includes('hace 12 min'));
  assert.ok(html.includes('2 confirmaciones'));
  assert.ok(html.includes('@elgaucho'));
  assert.ok(html.includes('data-accion="voto" data-veredicto="StillThere"'));
  assert.ok(html.includes('data-accion="voto" data-veredicto="Gone"'));
  assert.ok(!html.includes('data-accion="cerrar-reporte"'), 'no es mío: no se puede cerrar');
  assert.ok(html.includes('data-accion="cerrar"'));
});

test('la ficha de lo mío ofrece cerrarlo y no votarlo; sin calle dice "cerca de acá"; sin alias, anónimo', () => {
  const html = fichaReporte(reporte({ mine: true, street: null, reportedBy: { alias: null } }), { ahora });

  assert.ok(html.includes('data-accion="cerrar-reporte"'));
  assert.ok(!html.includes('data-veredicto='));
  assert.ok(html.includes('cerca de acá'));
  assert.ok(html.includes('@anónimo'));
});

test('la ficha de una restricción dice si está sin confirmar y si tu camión no pasa', () => {
  const sinConfirmar = fichaReporte(reporte({ type: 'RoadClosed', kind: 'restriction', validated: false }), { ahora });
  assert.match(sinConfirmar, /sin confirmar/i);

  const noPasa = fichaReporte(reporte({ type: 'LowClearance', kind: 'restriction', value: 3.8, forYourTruck: 'incompatible', validated: true }), { ahora });
  assert.ok(noPasa.includes('3,80 m'));
  assert.ok(noPasa.includes('Tu camión no pasa'));
  assert.doesNotMatch(noPasa, /sin confirmar/i);
});

test('la ficha marca el voto propio y una cámara fija no tiene edad', () => {
  const votado = fichaReporte(reporte({ yourVote: 'StillThere' }), { ahora });
  assert.ok(/data-veredicto="StillThere"[^>]*class="[^"]*celeste/.test(votado) || /class="[^"]*celeste[^"]*"[^>]*data-veredicto="StillThere"/.test(votado));

  const fija = fichaReporte(reporte({ type: 'Camera', fixed: true, status: 'Fixed', createdAt: '2026-09-01T09:00:00-03:00' }), { ahora });
  assert.ok(!fija.includes('hace '));
  assert.ok(fija.includes('Cámara fija'));
});

test('el "¿sigue ahí?" son dos botones grandes con el id del reporte', () => {
  const html = promptSigueAhi(reporte({ id: 'abc' }));

  assert.ok(html.includes('data-reporte="abc"'));
  assert.ok(html.includes('data-accion="sigue" data-veredicto="StillThere"'));
  assert.ok(html.includes('data-accion="sigue" data-veredicto="Gone"'));
  assert.ok(html.includes('Accidente'));
});
