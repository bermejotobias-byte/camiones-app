/**
 * Lo que dice una tarjeta de ruta: por dónde va, y la línea de tiempo con lo
 * que hay en el camino (waze-01, waze-02 y el prototipo).
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  porDonde, lineaDeTiempo, opcionesDeRuta, elegirAlternativa, mismaRuta, textoDeEstado, chipsDeRuta,
  nombreCorto, textoDelCamion, cabeceraDeRutas, hojaRutas,
  loQueImporta, filasDelCamino, fuentesDeLaRuta, hojaDetalles, cabeceraSimple
} from '../../src/TruckNavigator.Api/wwwroot/js/mapa/rutas.js';

/* ---------------------------------------------------------------------------
   La línea de estado y los chips de una ruta
--------------------------------------------------------------------------- */

const ruta = (share, accessLegs = []) => ({ heavyNetworkSharePercent: share, accessLegs });

test('la línea de estado: toda por la Red, mejor ruta con su porcentaje, o cuánto sale de la Red', () => {
  assert.equal(textoDeEstado(ruta(100), true), 'Toda por la Red');
  assert.equal(textoDeEstado(ruta(99.7), false), 'Toda por la Red');
  assert.equal(textoDeEstado(ruta(85.4), true), 'Mejor ruta, 85% por la Red');
  assert.equal(textoDeEstado(ruta(70, [{ distanceMeters: 9_300 }]), false), 'Sale de la Red 9,3 km');
  assert.equal(textoDeEstado(ruta(90, [{ distanceMeters: 450 }, { distanceMeters: 400 }]), false), 'Sale de la Red 850 m');
});

test('los chips cuentan lo que hay en el camino, con el color de cada cosa', () => {
  const alerts = [
    { tipo: 'radar', at: 100 }, { tipo: 'radar', at: 900 },
    { tipo: 'galibo', at: 500, metres: 4.5 },
    { tipo: 'paso', at: 700 }
  ];

  const chips = chipsDeRuta(alerts, ruta(85, [{ distanceMeters: 9_300 }]));

  assert.deepEqual(chips.map((c) => c.texto), ['Fuera de la Red', '2 radares', 'Gálibo 4,50 · pasás', '1 paso a nivel']);
  assert.equal(chips[0].color, '#f9c531');
});

test('sin nada en el camino no hay chips, y uno solo va en singular', () => {
  assert.deepEqual(chipsDeRuta([], ruta(100)), []);
  assert.deepEqual(chipsDeRuta([{ tipo: 'radar', at: 1 }], ruta(100)).map((c) => c.texto), ['1 radar']);
});

/* ---------------------------------------------------------------------------
   Las opciones que devuelve el servidor
--------------------------------------------------------------------------- */

const respuesta = { distanceMeters: 2200, alternatives: [{ distanceMeters: 2700 }, { distanceMeters: 3100 }] };

test('las opciones son la recomendada y sus alternativas, en ese orden', () => {
  assert.deepEqual(opcionesDeRuta(respuesta).map((r) => r.distanceMeters), [2200, 2700, 3100]);
  assert.deepEqual(opcionesDeRuta({ distanceMeters: 2200 }).map((r) => r.distanceMeters), [2200]);
  assert.deepEqual(opcionesDeRuta(null), []);
});

test('una opción que va por las mismas vías y mide lo mismo es la ruta que ya se sigue', () => {
  const actual = { por: 'Por Av. Sáenz; Av. Perito Moreno', metros: 1900 };

  assert.equal(mismaRuta(actual, { por: 'Por Av. Sáenz; Av. Perito Moreno', metros: 1940 }), true);
  assert.equal(mismaRuta(actual, { por: 'Por Av. Sáenz; Av. Perito Moreno', metros: 2400 }), false);
  assert.equal(mismaRuta(actual, { por: 'Por Av. Perito Moreno; Av. Amancio Alcorta', metros: 1900 }), false);
});

test('elegir una alternativa devuelve esa ruta; una posición que no existe, la recomendada', () => {
  assert.equal(elegirAlternativa(respuesta, 1).distanceMeters, 2700);
  assert.equal(elegirAlternativa(respuesta, 0).distanceMeters, 2200);
  assert.equal(elegirAlternativa(respuesta, 7).distanceMeters, 2200);
  assert.equal(elegirAlternativa(respuesta, -1).distanceMeters, 2200);
  assert.equal(elegirAlternativa(null, 0), null);
});

/* ---------------------------------------------------------------------------
   Por dónde
--------------------------------------------------------------------------- */

const instr = (streetName, distanceMeters, kind = 'Continue') => ({ streetName, distanceMeters, kind });

test('"Por" nombra las dos vías más largas, en el orden en que se toman', () => {
  const instrucciones = [
    instr('Avenida Sáenz', 500),
    instr('Avenida Perito Moreno', 1000),
    instr('Pepirí', 130),
    instr('Avenida Amancio Alcorta', 460),
    instr('', 0, 'Finish')
  ];

  // Perito Moreno es la mas larga, pero Saenz se toma antes: se leen en el orden del viaje.
  assert.equal(porDonde(instrucciones), 'Por Av. Sáenz; Av. Perito Moreno');
});

test('la misma vía en varios tramos suma, y se cuenta una vez', () => {
  const instrucciones = [
    instr('Avenida Sáenz', 300),
    instr('Junín', 400),
    instr('Avenida Sáenz', 300)
  ];

  assert.equal(porDonde(instrucciones), 'Por Av. Sáenz; Junín');
});

test('desde un paso dado se ignora lo ya recorrido', () => {
  const instrucciones = [
    instr('Avenida Sáenz', 5000),
    instr('Junín', 400),
    instr('Pepirí', 130)
  ];

  assert.equal(porDonde(instrucciones, 1), 'Por Junín; Pepirí');
});

test('sin nombres no hay "Por"', () => {
  assert.equal(porDonde([instr('', 100), instr('', 0, 'Finish')]), '');
  assert.equal(porDonde([]), '');
  assert.equal(porDonde(null), '');
});

/* ---------------------------------------------------------------------------
   La línea de tiempo
--------------------------------------------------------------------------- */

// Una ruta de 1000 m en diez vértices de 100 m.
const preparada = { cumulative: Array.from({ length: 11 }, (_, i) => i * 100), totalMeters: 1000 };

test('cada aviso cae en la línea según a qué altura del recorrido está', () => {
  const { marcas } = lineaDeTiempo(preparada, {
    alerts: [{ tipo: 'radar', at: 250 }, { tipo: 'galibo', at: 500 }, { tipo: 'paso', at: 900 }]
  });

  assert.deepEqual(marcas, [
    { pos: 25, icono: 'radar' },
    { pos: 50, icono: 'galiboOk' },
    { pos: 90, icono: 'paso' }
  ]);
});

test('lo ya recorrido queda afuera y el resto se mide sobre lo que falta', () => {
  const { marcas } = lineaDeTiempo(preparada, {
    travelled: 500,
    alerts: [{ tipo: 'radar', at: 250 }, { tipo: 'radar', at: 750 }]
  });

  assert.deepEqual(marcas, [{ pos: 50, icono: 'radar' }]);
});

test('los tramos fuera de la Red se pintan amarillos por su parte del recorrido', () => {
  const { tramos } = lineaDeTiempo(preparada, {
    accessLegs: [{ fromPointIndex: 0, toPointIndex: 2 }, { fromPointIndex: 8, toPointIndex: 10 }]
  });

  assert.deepEqual(tramos, [[0, 20], [80, 100]]);
});

test('un tramo fuera de la Red que ya se pasó en parte se recorta', () => {
  const { tramos } = lineaDeTiempo(preparada, {
    travelled: 100,
    accessLegs: [{ fromPointIndex: 0, toPointIndex: 4 }]
  });

  // Faltan 900 m; del tramo quedan 300 (de 100 a 400): el primer tercio.
  assert.deepEqual(tramos, [[0, 33.3]]);
});

test('sin ruta no hay línea', () => {
  assert.deepEqual(lineaDeTiempo(null, {}), { marcas: [], tramos: [] });
  assert.deepEqual(lineaDeTiempo({ cumulative: [0], totalMeters: 0 }, {}), { marcas: [], tramos: [] });
});

/* ---------------------------------------------------------------------------
   La hoja de elegir ruta (el prototipo, tablero "Rutas")
--------------------------------------------------------------------------- */

test('el nombre corto de un lugar es lo que va antes de la primera coma, abreviado como en los carteles', () => {
  assert.equal(nombreCorto('Avenida Sáenz 1200, Nueva Pompeya, Buenos Aires'), 'Av. Sáenz 1200');
  assert.equal(nombreCorto('Puerto de Buenos Aires'), 'Puerto de Buenos Aires');
  assert.equal(nombreCorto('  Junín 300 ,  Balvanera'), 'Junín 300');
  assert.equal(nombreCorto(null), '');
});

test('la cabecera dice de dónde a dónde; el origen que es la posición del GPS se llama "Mi ubicación"', () => {
  const desdeElGps = cabeceraDeRutas({
    origen: { label: 'Avenida Sáenz 1200, Nueva Pompeya', actual: true },
    destino: { label: 'Puerto de Buenos Aires, Retiro' }
  });

  assert.ok(desdeElGps.includes('Mi ubicación'));
  assert.ok(desdeElGps.includes('Puerto de Buenos Aires'));
  assert.ok(!desdeElGps.includes('Sáenz'));
  assert.ok(desdeElGps.includes('data-accion="volver"'));

  const desdeOtroLado = cabeceraDeRutas({ origen: { label: 'Avenida Sáenz 1200, Nueva Pompeya' }, destino: { label: 'Puerto' } });
  assert.ok(desdeOtroLado.includes('Av. Sáenz 1200'));
});

test('la píldora del camión dice el nombre y las toneladas', () => {
  assert.equal(textoDelCamion({ name: 'El Rayo', grossWeightKg: 40_000 }), 'El Rayo · 40 t');
  assert.equal(textoDelCamion({ name: 'El Chico', grossWeightKg: 26_500 }), 'El Chico · 26,5 t');
  assert.equal(textoDelCamion(null), 'Elegí un camión');
});

test('la hoja de rutas: una fila por ruta, la elegida marcada, sus chips, y las píldoras Detalles y Arrancar', () => {
  const html = hojaRutas({
    rutas: [
      { tiempo: '39 min', km: '32 km', por: 'Por Au. Ricchieri; Au. 25 de Mayo', estado: 'Mejor ruta, 85% por la Red', chips: [{ color: '#4f6d8e', texto: '2 radares' }] },
      { tiempo: '36 min', km: '29 km', por: 'Por Av. Gral. Paz', estado: 'Sale de la Red 9,3 km', chips: [] }
    ],
    elegida: 1
  });

  const filas = html.match(/class="gps-ruta( elegida)?"/g);
  assert.equal(filas.length, 2);
  assert.ok(!filas[0].includes('elegida'));
  assert.ok(filas[1].includes('elegida'));

  assert.ok(html.includes('data-accion="elegir" data-indice="0"'));
  assert.ok(html.includes('data-accion="elegir" data-indice="1"'));
  assert.ok(html.includes('class="gps-chip"'));
  assert.ok(html.includes('2 radares'));
  assert.ok(html.includes('data-accion="detalles"'));
  assert.ok(html.includes('data-accion="arrancar"'));
});

test('lo que se escribe en una fila se escapa', () => {
  const html = hojaRutas({ rutas: [{ tiempo: '1 min', km: '1 km', por: 'Por <b>x</b>', estado: '', chips: [] }], elegida: 0 });

  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
});

/* ---------------------------------------------------------------------------
   Los detalles de la ruta (el prototipo, tablero "Detalles")
--------------------------------------------------------------------------- */

const camion = { name: 'El Rayo', heightMeters: 4.2, grossWeightKg: 40_000 };

const hallazgo = {
  kind: 'OutsideHeavyTrafficNetwork',
  ruleReference: 'Ley 2148, arts. 9.10.1 y 9.10.5',
  dataReference: 'OpenStreetMap, etiqueta hgv=designated'
};

const tramos = (calles, metros = 100) => calles.map((streetName, i) => ({
  streetName, distanceMeters: metros, fromPointIndex: i, toPointIndex: i + 1, requiresAccessException: true, findings: [hallazgo]
}));

const conTramos = (calles, metros) => ({ heavyNetworkSharePercent: 85, accessLegs: tramos(calles, metros) });
const todaPorLaRed = { heavyNetworkSharePercent: 100, accessLegs: [] };

test('lo que importa: salir de la Red va primero, con cuántos tramos y cuánto', () => {
  const m = loQueImporta(conTramos(['Lynch', 'Pepirí', 'Del Arado'], 3_100), [{ tipo: 'radar', at: 1 }], camion);

  assert.equal(m.momento, 'alerta');
  assert.equal(m.titulo, 'Ojo: 3 tramos fuera de la Red');
  assert.ok(m.texto.startsWith('Son 9,3 km.'), m.texto);
  assert.ok(m.texto.includes('llegar al destino'));

  assert.equal(loQueImporta(conTramos(['Lynch'], 850), [], camion).titulo, 'Ojo: 1 tramo fuera de la Red');
  assert.ok(loQueImporta(conTramos(['Lynch'], 850), [], camion).texto.startsWith('Son 850 m.'));
});

test('sin salir de la Red, importa el gálibo; después los radares; después los pasos a nivel', () => {
  const galibo = loQueImporta(todaPorLaRed, [{ tipo: 'galibo', at: 500, metres: 4.5 }, { tipo: 'radar', at: 900 }], camion);
  assert.equal(galibo.momento, 'alerta');
  assert.equal(galibo.titulo, 'Un gálibo de 4,50 m en el camino');
  assert.equal(galibo.texto, 'El Rayo mide 4,20 m: pasás.');

  const dos = loQueImporta(todaPorLaRed, [{ tipo: 'galibo', at: 500, metres: 4.5 }, { tipo: 'galibo', at: 700, metres: 5.1 }], camion);
  assert.equal(dos.titulo, '2 gálibos en el camino, el más bajo de 4,50 m');

  const radares = loQueImporta(todaPorLaRed, [{ tipo: 'radar', at: 900 }, { tipo: 'radar', at: 1900 }, { tipo: 'paso', at: 100 }], camion);
  assert.equal(radares.momento, 'radar');
  assert.equal(radares.titulo, '2 radares en el camino');

  const pasos = loQueImporta(todaPorLaRed, [{ tipo: 'paso', at: 100 }], camion);
  assert.equal(pasos.momento, 'alerta');
  assert.equal(pasos.titulo, '1 paso a nivel en el camino');
});

test('sin nada que avisar, el mono lee el mapa y dice que está todo en orden', () => {
  const m = loQueImporta(todaPorLaRed, [], camion);

  assert.equal(m.momento, 'ruta');
  assert.equal(m.titulo, 'Todo en orden');
  assert.ok(m.texto.includes('toda por la Red'));
});

test('las filas del camino: fuera de la Red con sus calles, radares y pasos con calle y km, gálibos con el más bajo', () => {
  const alerts = [
    { tipo: 'radar', at: 3_200, calle: 'Avenida Juan Bautista Justo' },
    { tipo: 'galibo', at: 4_000, metres: 4.5 },
    { tipo: 'paso', at: 300, calle: 'Lynch' },
    { tipo: 'radar', at: 9_050, calle: null }
  ];

  const filas = filasDelCamino(conTramos(['Lynch', 'Pepirí', 'Del Arado', 'De la Huerta', 'De la Pala'], 1_860), alerts, camion);

  assert.deepEqual(filas.map((f) => [f.icono, f.titulo, f.sub]), [
    ['red', 'Fuera de la Red · 9,3 km', 'Lynch, Pepirí, Del Arado y 2 más'],
    ['radar', '2 radares de velocidad', 'Av. Juan Bautista Justo km 3,2 · km 9,1'],
    ['galiboOk', '1 gálibo · 4,50 m', 'El Rayo mide 4,20 m: pasás'],
    ['paso', '1 paso a nivel', 'Lynch km 0,3']
  ]);
});

test('dos radares en el mismo lugar se cuentan dos veces pero el lugar se nombra una', () => {
  const alerts = [
    { tipo: 'radar', at: 17_100, calle: 'Avenida Dorrego' },
    { tipo: 'radar', at: 17_120, calle: 'Avenida Dorrego' },
    { tipo: 'paso', at: 7_900, calle: 'Avenida Lafuente' },
    { tipo: 'paso', at: 7_930, calle: 'Avenida Lafuente' }
  ];

  const filas = filasDelCamino(todaPorLaRed, alerts, camion);

  assert.deepEqual(filas.map((f) => [f.titulo, f.sub]), [
    ['2 radares de velocidad', 'Av. Dorrego km 17,1'],
    ['2 pasos a nivel', 'Av. Lafuente km 7,9']
  ]);
});

test('una calle repetida en los tramos se nombra una vez, y "tramo sin nombre" no se nombra', () => {
  const filas = filasDelCamino(conTramos(['Lynch', 'Lynch', 'tramo sin nombre', 'Pepirí']), [], camion);

  assert.equal(filas[0].sub, 'Lynch, Pepirí');
});

test('sin nada en el camino no hay filas', () => {
  assert.deepEqual(filasDelCamino(todaPorLaRed, [], camion), []);
});

test('las fuentes: la norma y el dato de la Red desde el hallazgo, y una por cada cosa que aparece', () => {
  const fuentes = fuentesDeLaRuta(conTramos(['Lynch', 'Pepirí']), [{ tipo: 'radar', at: 1 }, { tipo: 'galibo', at: 2, metres: 4.5 }, { tipo: 'paso', at: 3 }]);

  assert.deepEqual(fuentes.map((f) => f.titulo), [
    'Ley 2148, arts. 9.10.1 y 9.10.5',
    'Radares: Buenos Aires Data',
    'Gálibos: OpenStreetMap',
    'Pasos a nivel: OpenStreetMap'
  ]);
  assert.equal(fuentes[0].sub, 'OpenStreetMap, etiqueta hgv=designated');
});

test('toda por la Red y sin avisos, la fuente es la Red misma', () => {
  const fuentes = fuentesDeLaRuta(todaPorLaRed, []);

  assert.equal(fuentes.length, 1);
  assert.ok(fuentes[0].titulo.includes('Ley 2148'));
  assert.ok(fuentes[0].sub.includes('OpenStreetMap'));
});

test('la hoja de detalles: las cifras, el mono con lo que importa, el camino, las fuentes y Arrancar', () => {
  const html = hojaDetalles({
    tiempo: '39 min', hora: 'llegás 20:06', km: '32 km', red: '85% por la Red',
    mono: { momento: 'alerta', titulo: 'Ojo: 3 tramos fuera de la Red', texto: 'Son 9,3 km.' },
    camino: [{ icono: 'radar', titulo: '2 radares de velocidad', sub: 'Av. X km 3' }],
    fuentes: [{ titulo: 'Ley 2148', sub: 'OSM' }]
  });

  assert.ok(html.includes('39 min') && html.includes('llegás 20:06') && html.includes('32 km') && html.includes('85% por la Red'));
  assert.ok(html.includes('/img/mascota/binoculares.png'));
  assert.ok(html.includes('Ojo: 3 tramos fuera de la Red'));
  assert.ok(html.includes('En el camino') && html.includes('2 radares de velocidad'));
  assert.ok(html.includes('Fuentes') && html.includes('Ley 2148'));
  assert.ok(html.includes('data-accion="arrancar"'));
});

test('sin nada en el camino la hoja lo dice en vez de dejar la sección vacía', () => {
  const html = hojaDetalles({ tiempo: '1 min', hora: '', km: '1 km', red: '', mono: { momento: 'ruta', titulo: 'Todo en orden', texto: '' }, camino: [], fuentes: [] });

  assert.ok(html.includes('Nada que avisar'));
  assert.ok(!html.includes('Fuentes'));
});

test('la cabecera simple lleva la flecha de volver y el título', () => {
  const html = cabeceraSimple('Detalles de la ruta');

  assert.ok(html.includes('data-accion="volver"'));
  assert.ok(html.includes('Detalles de la ruta'));
});
