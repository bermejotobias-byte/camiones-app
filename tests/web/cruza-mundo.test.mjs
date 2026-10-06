/**
 * El mundo sin fin de CRUZÁ, MONO (spec §3), con semilla fija: cada garantía de la
 * spec se recorre sobre miles de filas, porque un mundo sin paso no se ve en diez.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearMundo, esSegura, sinBolsillos, tramos } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/mundo.js';
import { CEL, COLUMNAS, LAZO, LAZO_RIO, TRONCO_CADA, largoDe } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

const N = 3000;
const SEMILLAS = [1, 7, 2026, 99991];
const filasDe = (semilla, n = N) => { const m = crearMundo(semilla); return [...Array(n).keys()].map((i) => m.fila(i)); };
const MUNDOS = SEMILLAS.map((s) => filasDe(s));
const libres = (f) => [...Array(COLUMNAS).keys()].filter((c) => !f.bloq.has(c));

/** Los tramos de filas seguidas que cumplen la condición: [[desde, hasta]]. */
function corridas(filas, cond) {
  const v = [];
  let desde = null;
  filas.forEach((f, i) => {
    if (cond(f) && desde === null) desde = i;
    if (!cond(f) && desde !== null) { v.push([desde, i - 1]); desde = null; }
  });
  return v; // la última corrida abierta se descarta: puede seguir más allá de N
}

test('la misma semilla da el mismo mundo, y otra semilla otro', () => {
  const resumen = (filas) => JSON.stringify(filas.slice(0, 300).map((f) => ({ ...f, bloq: [...f.bloq] })));
  assert.equal(resumen(filasDe(7, 300)), resumen(filasDe(7, 300)));
  assert.notEqual(resumen(filasDe(7, 300)), resumen(filasDe(8, 300)));
});

test('las filas 0 a 2 son la largada: vereda, la columna 4 libre y sin cajas', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.slice(0, 3)) {
      assert.equal(f.t, 'vereda');
      assert.ok(!f.bloq.has(4));
      assert.deepEqual(f.cajas, []);
    }
  }
});

test('el primer peligro es una calle de un carril', () => {
  for (const filas of MUNDOS) {
    const d = filas.findIndex((f) => !esSegura(f));
    assert.equal(filas[d].t, 'calle');
    assert.ok(esSegura(filas[d + 1]), `la fila ${d + 1} tendría que ser segura`);
  }
});

test('nunca hay dos bloques de río seguidos', () => {
  for (const filas of MUNDOS) {
    const bloques = corridas(filas, (f) => !esSegura(f));
    for (let k = 1; k < bloques.length; k++) {
      const [a0, a1] = bloques[k - 1], [b0] = bloques[k];
      // Un playón solo en medio es el mismo bloque, cortado.
      if (b0 === a1 + 2 && filas[a1 + 1].t === 'playon') continue;
      if (filas[a0].t === 'rio') assert.equal(filas[b0].t, 'calle', `fila ${b0}`);
    }
  }
});

test('dos carriles de río vecinos van en sentidos opuestos', () => {
  for (const filas of MUNDOS) {
    filas.forEach((f, i) => { if (i && f.t === 'rio' && filas[i - 1].t === 'rio') assert.equal(f.dir, -filas[i - 1].dir, `fila ${i}`); });
  }
});

test('entre dos vehículos de un carril hay siempre el hueco mínimo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'calle')) {
      const hueco = (2 + (f.vel / CEL) * 0.5) * CEL;
      const v = f.veh.map(([m, x0]) => ({ x: ((x0 % LAZO) + LAZO) % LAZO, L: largoDe(m) })).sort((a, b) => a.x - b.x);
      v.forEach((a, k) => {
        const b = v[(k + 1) % v.length];
        const libre = (((b.x - (a.x + a.L)) % LAZO) + LAZO) % LAZO;
        assert.ok(v.length === 1 ? LAZO - a.L >= hueco : libre >= hueco - 1e-9, `fila ${f.i}: ${libre} < ${hueco}`);
      });
    }
  }
});

test('en el río el agua libre entre troncos es de 3 celdas como máximo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'rio')) {
      assert.equal(f.P, LAZO_RIO);
      assert.ok(f.n >= 2 && f.n <= 4, `fila ${f.i}: tronco de ${f.n}`);
      assert.ok(TRONCO_CADA - f.n <= 3);
      f.xs.forEach((x, k) => k && assert.equal(x - f.xs[k - 1], TRONCO_CADA * CEL));
    }
  }
});

test('cada franja segura tiene 4 celdas libres por fila, un pasillo y ningún bolsillo', () => {
  for (const filas of MUNDOS) {
    for (const [a, b] of corridas(filas, esSegura)) {
      const franja = filas.slice(a, b + 1);
      franja.forEach((f) => assert.ok(libres(f).length >= 4, `fila ${f.i}: ${libres(f).length} libres`));
      const pasillos = [...Array(COLUMNAS).keys()].filter((c) => franja.every((f) => !f.bloq.has(c)));
      assert.ok(pasillos.length > 0, `filas ${a}-${b} sin pasillo`);
      assert.ok(sinBolsillos(franja, pasillos[0]), `filas ${a}-${b} con un bolsillo`);
    }
  }
});

test('sinBolsillos ve el hueco encerrado que encontró la demostración', () => {
  // Conventillos a los costados de la columna 2 y un árbol adelante: entrar ahí es no salir.
  const boca = { bloq: new Set([0, 1, 3, 4, 5]) };
  const vereda = { bloq: new Set([2]) };
  assert.equal(sinBolsillos([boca, vereda], 7), false);
  assert.equal(sinBolsillos([boca, { bloq: new Set() }], 7), true);
});

test('la fila boca va siempre justo después de un río, y su franja tiene 2 filas o más', () => {
  for (const filas of MUNDOS) {
    let vistas = 0;
    filas.forEach((f, i) => {
      if (f.t !== 'boca') return;
      vistas++;
      assert.equal(filas[i - 1].t, 'rio', `fila ${i}`);
      assert.ok(esSegura(filas[i + 1]), `fila ${i + 1}`);
    });
    assert.ok(vistas > 10);
  }
});

test('los carteles: sobre 3 edificios, nunca dos iguales seguidos, la señal sólo pegada a una calle', () => {
  for (const filas of MUNDOS) {
    const orden = [];
    for (const f of filas) {
      for (const [col, tipo] of f.murales ?? []) {
        orden.push(tipo);
        if (f.t === 'boca') {
          assert.ok([0, 1, 2].every((d) => f.boca.includes(col + d)), `fila ${f.i}: el cartel no está sobre 3 conventillos`);
          assert.notEqual(tipo, 'senal');
        } else {
          assert.equal(f.t, 'galpones');
          assert.ok(f.galpones.some(([c0, n]) => c0 === col && n === 3), `fila ${f.i}: el cartel no está sobre un galpón de 3`);
          if (tipo === 'senal') assert.equal(filas[f.i - 1].t, 'calle', `fila ${f.i}: señal lejos de la calle`);
        }
      }
    }
    orden.forEach((t, k) => k && assert.notEqual(t, orden[k - 1], `dos carteles ${t} seguidos`));
    assert.ok(new Set(orden).size === 3, 'aparecen los tres carteles');
  }
});

test('los galpones son de 2 o 3 celdas, con 5 bloqueadas como máximo, y los conventillos entran en el campo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'galpones')) {
      assert.ok(f.bloq.size <= 5);
      for (const [c0, n] of f.galpones) assert.ok(n === 2 || n === 3);
    }
    for (const f of filas.filter((x) => x.t === 'boca')) {
      for (const [c0, n] of tramos(f.boca)) assert.ok(c0 >= 0 && c0 + n <= COLUMNAS);
    }
  }
});

test('una caja por fila como máximo, ninguna en la largada, y la de la calle sobre la senda', () => {
  for (const filas of MUNDOS) {
    filas.forEach((f, i) => {
      const cajas = f.cajas.length + (f.t === 'rio' && f.cajaEn >= 0 ? 1 : 0);
      assert.ok(cajas <= 1, `fila ${i}: ${cajas} cajas`);
      if (i < 3) assert.equal(cajas, 0);
      for (const col of f.cajas) assert.ok(!f.bloq.has(col), `fila ${i}: caja sobre un obstáculo`);
      if (f.t === 'calle' && f.senda && f.cajas.length) {
        const c = f.cajas[0] * CEL;
        assert.ok(c >= f.senda[0] && c < f.senda[1], `fila ${i}: caja fuera de la senda`);
      }
    });
  }
});

test('cada 25 filas un playón, y en la 100 el Obelisco', () => {
  for (const filas of MUNDOS) {
    for (let i = 25; i < N; i += 25) {
      assert.equal(filas[i].t, 'playon', `fila ${i}`);
      assert.equal(filas[i].numero, i);
      assert.ok(filas[i].bloq.has(0) && filas[i].bloq.has(1) && filas[i].bloq.has(8));
    }
    assert.ok(filas[100].obst.some(([, que]) => que === 'obelisco'));
    assert.ok(!filas[125].obst.some(([, que]) => que === 'obelisco'));
    assert.ok(filas.every((f, i) => f.t !== 'playon' || i % 25 === 0));
  }
});

test('el reparto: más autos, después la Red y lo que menos, colectivos', () => {
  // El sorteo es 0,55 / 0,30 / 0,15; la regla de no poner dos largos seguidos pasa
  // a autos los que tocan, y lo que queda en la calle es cerca de 2/3, 2/9 y 1/9.
  for (const filas of MUNDOS) {
    const cuenta = { autos: 0, red: 0, colectivos: 0 };
    for (const f of filas.slice(20)) if (f.t === 'calle') cuenta[f.clase]++;
    const total = cuenta.autos + cuenta.red + cuenta.colectivos;
    const parte = (k) => cuenta[k] / total;
    assert.ok(parte('autos') >= 0.6 && parte('autos') <= 0.72, `autos ${parte('autos').toFixed(3)}`);
    assert.ok(parte('red') >= 0.18 && parte('red') <= 0.28, `red ${parte('red').toFixed(3)}`);
    assert.ok(parte('colectivos') >= 0.08 && parte('colectivos') <= 0.16, `colectivos ${parte('colectivos').toFixed(3)}`);
    assert.ok(cuenta.colectivos < cuenta.red && cuenta.red < cuenta.autos);
  }
});

test('nunca dos carriles largos seguidos, 2 vehículos por carril largo y ningún colectivo antes de la fila 20', () => {
  for (const filas of MUNDOS) {
    filas.forEach((f, i) => {
      if (f.t !== 'calle') return;
      if (f.clase !== 'autos') {
        assert.ok(f.veh.length <= 2, `fila ${i}`);
        if (filas[i - 1].t === 'calle') assert.equal(filas[i - 1].clase, 'autos', `filas ${i - 1} y ${i}`);
      }
      if (i < 20) assert.notEqual(f.clase, 'colectivos', `fila ${i}`);
    });
  }
});

test('las velocidades salen de la banda y nunca bajan de 0,8 celdas por segundo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'calle' || x.t === 'rio')) {
      assert.ok(f.vel / CEL >= 0.8 - 1e-9, `fila ${f.i}`);
      assert.ok(f.vel / CEL <= 4.5 + 1e-9, `fila ${f.i}`);
    }
  }
});

test('olvidar suelta las filas de abajo y no cambia las de arriba', () => {
  const m = crearMundo(5);
  const antes = JSON.stringify({ ...m.fila(60), bloq: [...m.fila(60).bloq] });
  m.olvidar(50);
  assert.equal(m.fila(10).t, 'vereda');
  assert.deepEqual(m.fila(10).obst, []);
  assert.equal(JSON.stringify({ ...m.fila(60), bloq: [...m.fila(60).bloq] }), antes);
});
