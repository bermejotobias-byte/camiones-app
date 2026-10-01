/**
 * Reportes en vivo: de dónde se piden, en qué orden salen y qué dice cada fila.
 *
 * Es la cara visible de la Fase 5 y la pide el v3 §12: "cada reporte debe
 * mostrar tipo, ubicación, horario, usuario que lo realizó y estado".
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRADOS_DE_LA_LISTA, recuadroDeLaLista, filasDeReportes, vacioDeLaLista
} from '../../src/TruckNavigator.Api/wwwroot/js/views/reportes.js';

import { bboxVisible } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/reportes.js';

/** Los cuatro numeros de un recuadro, sea cual sea su formato de texto. */
const numeros = (bbox) => bbox.split(',').map((n) => Number(Number(n).toFixed(4)));

const AHORA = Date.parse('2026-09-30T15:00:00-03:00');

const reporte = (extra) => ({
  id: 'r1',
  type: 'Traffic',
  createdAt: '2026-09-30T14:40:00-03:00',
  street: 'Av. Corrientes 2000',
  ...extra
});

test('el recuadro sale del último fix, con 0,02° de lado', () => {
  assert.equal(GRADOS_DE_LA_LISTA, 0.02);

  const bbox = recuadroDeLaLista({ lat: -34.6037, lng: -58.3816 }, null);

  assert.deepEqual(numeros(bbox), [-58.3916, -34.6137, -58.3716, -34.5937]);
});

test('sin fix vale el último recuadro que se vio en el mapa, TAL COMO el mapa lo guarda', () => {
  // Esto es lo que `bboxVisible` deja en sessionStorage: una CADENA, no un
  // arreglo. El test viejo le pasaba un arreglo inventado, asi que la lista
  // pasaba en verde y en el telefono reventaba con "bbox.join is not a
  // function" en cuanto no habia fix. La forma de la entrada se toma de quien
  // la escribe, no de lo que seria comodo afirmar.
  const visto = bboxVisible({ west: -58.40, south: -34.62, east: -58.38, north: -34.60 });

  assert.equal(recuadroDeLaLista(null, visto), visto);
});

test('venga del GPS o del mapa, el recuadro tiene UNA sola forma: la que pide la API', () => {
  const delFix = recuadroDeLaLista({ lat: -34.6037, lng: -58.3816 }, null);
  const delMapa = recuadroDeLaLista(null, bboxVisible({ west: -58.40, south: -34.62, east: -58.38, north: -34.60 }));

  for (const bbox of [delFix, delMapa]) {
    assert.equal(typeof bbox, 'string', 'el recuadro viaja como texto, que es lo que `api.reports` manda');
    assert.equal(bbox.split(',').length, 4);
    assert.ok(numeros(bbox).every(Number.isFinite));
  }
});

test('sin fix y sin mapa no se inventa una posición', () => {
  assert.equal(recuadroDeLaLista(null, null), null);
});

test('las filas salen por más nuevo primero, que es el orden en que importan', () => {
  const filas = filasDeReportes([
    reporte({ id: 'viejo', createdAt: '2026-09-30T10:00:00-03:00' }),
    reporte({ id: 'nuevo', createdAt: '2026-09-30T14:55:00-03:00' })
  ], AHORA);

  assert.deepEqual(filas.map((f) => f.id), ['nuevo', 'viejo']);
});

test('cada fila dice tipo, dónde, cuándo, quién y en qué estado está', () => {
  const [fila] = filasDeReportes([reporte({ reportedBy: { alias: 'Nico' } })], AHORA);

  assert.equal(fila.tipo.nombre.length > 0, true);
  assert.equal(fila.donde, 'Av. Corrientes 2000');
  assert.equal(fila.cuando, 'hace 20 min');
  assert.equal(fila.quien, 'Nico');
  assert.equal(fila.estado, 'nuevo');
});

test('un reporte sin calle no inventa una', () => {
  const [fila] = filasDeReportes([reporte({ street: null })], AHORA);

  assert.equal(fila.donde, 'Cerca de tu posición');
});

test('el propio se marca y se puede cerrar; el ajeno no', () => {
  const filas = filasDeReportes([
    reporte({ id: 'mio', mine: true, reportedBy: { alias: 'Tobi' } }),
    reporte({ id: 'suyo', mine: false, reportedBy: { alias: 'Nico' } })
  ], AHORA);

  assert.equal(filas[0].quien, 'Vos');
  assert.equal(filas[0].sePuedeCerrar, true);
  assert.equal(filas[1].sePuedeCerrar, false);
});

test('un reporte sin alias no deja el lugar vacío', () => {
  const [fila] = filasDeReportes([reporte({ reportedBy: null })], AHORA);

  assert.equal(fila.quien, 'Alguien');
});

test('lo fijo no dice una edad: dejó de ser algo que pasó hace un rato', () => {
  const [fila] = filasDeReportes([reporte({ fixed: true, type: 'Camera' })], AHORA);

  assert.equal(fila.estado, 'fijo');
  assert.equal(fila.cuando, null);
});

test('lo que tu camión no pasa se marca aparte del resto', () => {
  const [fila] = filasDeReportes([reporte({ type: 'LowClearance', forYourTruck: 'incompatible' })], AHORA);

  assert.equal(fila.estado, 'rojo');
});

test('el vacío vende la próxima acción, y el que no tiene posición pide prenderla', () => {
  assert.match(vacioDeLaLista('sin-reportes').texto, /contámelo/i);
  assert.match(vacioDeLaLista('sin-posicion').texto, /ubicación/i);
});
