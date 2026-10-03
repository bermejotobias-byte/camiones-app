/**
 * La Red de Tránsito Pesado como dibujo (spec 2026-10-03-la-red-primero):
 * cuatro capas de la misma fuente que se leen como un tubo de cromo, la vía
 * más ancha del mapa, y siempre debajo de la ruta.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// El estilo base lee los colores del tema con getComputedStyle: un documento de mentira.
globalThis.document = { documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#123456' });

const { PARADAS, buildBasemapStyle, filtroCallesNombre } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js');
const {
  lineasDeLaRed, nombreDeLaRed, anclaDeLaRed, nombresDeLaRed, mezclar,
  opacidadDelBrillo, destello, CICLO_DESTELLO_MS, LATIDO_DESTELLO_MS, BRILLO_REPOSO
} = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/red.js');

const COLORES = { canto: '#111111', cuerpo: '#222222', reflejo: '#333333', brillo: '#444444', rotulo: '#555555', halo: '#666666' };

/** Las paradas de un `interpolate` sobre el zoom: { 13: 5, 15: 10, … }. */
const paradas = (expr) => {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['exponential', 1.4], ['zoom']], 'el zoom va en el nivel superior');
  const pares = {};
  for (let i = 3; i < expr.length; i += 2) pares[expr[i]] = expr[i + 1];
  return pares;
};

const capa = (id) => lineasDeLaRed(COLORES).find((c) => c.id === id);

test('la Red es la vía más ancha del mapa en cada zoom', () => {
  assert.deepEqual(PARADAS.red, [6, 10, 22, 48]);

  for (const [clase, otra] of Object.entries(PARADAS)) {
    if (clase === 'red') continue;
    otra.forEach((px, i) => assert.ok(PARADAS.red[i] > px, `${clase} mide ${px} y la Red ${PARADAS.red[i]}`));
  }
});

test('el cromo son cuatro capas de la misma fuente, de abajo hacia arriba: canto, cuerpo, reflejo, brillo', () => {
  const capas = lineasDeLaRed(COLORES);

  assert.deepEqual(capas.map((c) => c.id), ['red-canto', 'red-linea', 'red-reflejo', 'red-brillo']);
  for (const c of capas) {
    assert.equal(c.type, 'line');
    assert.equal(c.source, 'red');
  }
  const [canto, cuerpo, reflejo, brillo] = capas.map((c) => c.paint['line-color']);
  assert.equal(canto, '#111111');
  assert.equal(cuerpo, '#222222');
  // El reflejo y el brillo llevan el color ya mezclado sobre lo que tienen abajo.
  assert.equal(reflejo, mezclar('#222222', '#333333', 0.55));
  assert.equal(brillo, mezclar(reflejo, '#444444', 0.75));
});

test('el canto rodea al cuerpo por 3 px; el reflejo y el brillo son una fracción del cuerpo', () => {
  const cuerpo = paradas(capa('red-linea').paint['line-width']);
  const canto = paradas(capa('red-canto').paint['line-width']);
  const reflejo = paradas(capa('red-reflejo').paint['line-width']);
  const brillo = paradas(capa('red-brillo').paint['line-width']);

  assert.deepEqual(cuerpo, { 13: 6, 15: 10, 17: 22, 19: 48 });
  for (const z of [13, 15, 17, 19]) {
    assert.equal(canto[z], cuerpo[z] + 3);
    assert.ok(Math.abs(reflejo[z] - cuerpo[z] * 0.55) < 1e-9);
    assert.ok(Math.abs(brillo[z] - cuerpo[z] * 0.18) < 1e-9);
  }
});

test('las capas del cromo son opacas: donde se tocan dos tramos no se suma brillo', () => {
  // Con opacidad, las puntas redondas de dos tramos vecinos se superponían y
  // cada unión salía como un punto más claro: un collar de puntos sobre la Red.
  for (const c of lineasDeLaRed(COLORES)) assert.equal(c.paint['line-opacity'], undefined, c.id);
});

test('mezclar dos colores', () => {
  assert.equal(mezclar('#000000', '#ffffff', 0), '#000000');
  assert.equal(mezclar('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mezclar('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mezclar('#8fb6de', '#cfe4f8', 0.55), '#b2cfec');
});

test('el brillo va centrado: ninguna capa de la Red se corre de su eje', () => {
  // Con line-offset el especular quedaría a la izquierda del sentido de cada
  // tramo, y como los tramos van en sentidos distintos saltaría de borde a borde.
  for (const c of lineasDeLaRed(COLORES)) assert.equal(c.paint['line-offset'], undefined, c.id);
});

test('la Red se apila debajo de la ruta si hay ruta, y si no debajo de los nombres de calle', () => {
  assert.equal(anclaDeLaRed((id) => ['route-casing', 'calles-nombre'].includes(id)), 'route-casing');
  assert.equal(anclaDeLaRed((id) => id === 'calles-nombre'), 'calles-nombre');
  // El raster de respaldo no tiene ninguna de las dos: va arriba de todo.
  assert.equal(anclaDeLaRed(() => false), undefined);
});

/** El valor de un `interpolate` lineal sobre el zoom, como lo calcula MapLibre (con tope en las puntas). */
function valorEn(expr, z) {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['linear'], ['zoom']]);
  const p = [];
  for (let i = 3; i < expr.length; i += 2) p.push([expr[i], expr[i + 1]]);
  if (z <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [z0, v0] = p[i - 1];
    const [z1, v1] = p[i];
    if (z <= z1) return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
  }
  return p.at(-1)[1];
}

const callesNombre = () => buildBasemapStyle('').layers.find((l) => l.id === 'calles-nombre');

test('los nombres crecen hasta el zoom 19, y los de la Red nunca son más chicos que los de una calle', () => {
  const calles = callesNombre().layout['text-size'];
  const red = nombreDeLaRed(COLORES).layout['text-size'];

  assert.equal(valorEn(calles, 14), 10);
  assert.equal(valorEn(calles, 19), 15);
  assert.equal(valorEn(red, 13), 10);
  assert.equal(valorEn(red, 19), 18);

  for (let z = 14; z <= 19; z += 0.25) {
    assert.ok(valorEn(red, z) > valorEn(calles, z), `zoom ${z}: Red ${valorEn(red, z)}, calle ${valorEn(calles, z)}`);
  }
});

test('el nombre de la Red se lee sobre el tubo: negrita, mayúsculas y halo de 2', () => {
  const nombre = nombreDeLaRed(COLORES);

  assert.equal(nombre.paint['text-halo-width'], 2);
  assert.equal(nombre.paint['text-halo-color'], COLORES.halo);
  assert.deepEqual(nombre.layout['text-font'], ['NotoSans-Bold']);
  assert.equal(nombre.layout['text-transform'], 'uppercase');
});

test('los nombres de la Red: sin repetir, sin vacíos y en orden', () => {
  const geojson = {
    features: [
      { properties: { name: 'Avenida Juan Bautista Justo' } },
      { properties: { name: 'Avenida General Paz' } },
      { properties: { name: 'Avenida Juan Bautista Justo' } },
      { properties: { name: null } },
      { properties: {} },
      { properties: { name: '' } }
    ]
  };

  assert.deepEqual(nombresDeLaRed(geojson), ['Avenida General Paz', 'Avenida Juan Bautista Justo']);
  assert.deepEqual(nombresDeLaRed(null), []);
});

test('una calle de la Red tiene un solo nombre: el del mapa base se filtra', () => {
  const sinRed = filtroCallesNombre([]);
  const conRed = filtroCallesNombre(['Avenida General Paz']);

  // Sin nombres de la Red, el filtro es el de siempre, el que trae el estilo.
  assert.deepEqual(callesNombre().filter, sinRed);
  // Con nombres, el mismo filtro y además "el name no está en la lista".
  assert.deepEqual(conRed, ['all', sinRed, ['!', ['in', ['get', 'name'], ['literal', ['Avenida General Paz']]]]]);
});

test('el brillo va de 0,55 a 0,95 y vuelve en 2,5 s', () => {
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;

  assert.equal(CICLO_DESTELLO_MS, 2500);
  assert.ok(cerca(opacidadDelBrillo(0), 0.55));
  assert.ok(cerca(opacidadDelBrillo(1250), 0.95));
  assert.ok(cerca(opacidadDelBrillo(2500), 0.55));
  assert.ok(cerca(opacidadDelBrillo(625), BRILLO_REPOSO));

  for (let ms = 0; ms < 10_000; ms += 37) {
    const o = opacidadDelBrillo(ms);
    assert.ok(o >= 0.55 - 1e-9 && o <= 0.95 + 1e-9, `${ms} ms: ${o}`);
  }
});

/** Un documento y un reloj de mentira para el destello. */
function escenario({ oculto = false } = {}) {
  const oyentes = new Set();
  const intervalos = new Map();
  let siguiente = 1;
  const aplicados = [];

  const documento = {
    hidden: oculto,
    addEventListener: (tipo, fn) => tipo === 'visibilitychange' && oyentes.add(fn),
    removeEventListener: (tipo, fn) => oyentes.delete(fn)
  };

  return {
    aplicados,
    intervalos,
    oyentes,
    documento,
    cambiar(hidden) {
      documento.hidden = hidden;
      for (const fn of oyentes) fn();
    },
    opciones: {
      aplicar: (o) => aplicados.push(o),
      ahora: () => 1250,
      cada: (fn, ms) => { const id = siguiente++; intervalos.set(id, { fn, ms }); return id; },
      parar: (id) => intervalos.delete(id),
      documento
    }
  };
}

test('el destello late a 10 Hz con la página a la vista', () => {
  const e = escenario();

  destello(e.opciones);

  assert.equal(LATIDO_DESTELLO_MS, 100);
  assert.deepEqual([...e.intervalos.values()].map((i) => i.ms), [100]);
  // Late una vez al arrancar, sin esperar el primer intervalo.
  assert.equal(e.aplicados.length, 1);
  assert.ok(Math.abs(e.aplicados[0] - 0.95) < 1e-9, `${e.aplicados[0]}`);
});

test('en segundo plano se frena, y vuelve al volver', () => {
  const e = escenario();
  destello(e.opciones);

  e.cambiar(true);
  assert.equal(e.intervalos.size, 0);

  e.cambiar(false);
  assert.equal(e.intervalos.size, 1);
});

test('si arranca con la página oculta, no late hasta que se vea', () => {
  const e = escenario({ oculto: true });

  destello(e.opciones);

  assert.equal(e.intervalos.size, 0);
  assert.deepEqual(e.aplicados, []);
});

test('apagarlo frena el latido y suelta al documento', () => {
  const e = escenario();
  const apagar = destello(e.opciones);

  apagar();

  assert.equal(e.intervalos.size, 0);
  assert.equal(e.oyentes.size, 0);
});

test('con movimiento reducido el brillo queda quieto en su punto medio', () => {
  const e = escenario();

  destello({ ...e.opciones, quieto: true });

  assert.equal(e.intervalos.size, 0);
  assert.deepEqual(e.aplicados, [BRILLO_REPOSO]);
});
