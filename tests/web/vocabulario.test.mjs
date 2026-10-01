/**
 * El vocabulario visual del prototipo aprobado el 14/09/2026, en app.css.
 *
 * Es un candado, no una prueba de diseño: que cada clase que las pantallas usan
 * esté DEFINIDA. En este proyecto ya pasó dos veces que una reorganización se
 * llevara definiciones que seguían en uso y que nada lo detectara —`node --check`
 * no ve un identificador que no existe, y en CSS no hay ni siquiera eso—.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/TruckNavigator.Api/wwwroot/app.css', import.meta.url), 'utf8');

const MATERIALES = ['vidrio', 'neon', 'cromo-frio', 'cromo-oro', 'cromo-plata', 'satin'];
const PIEZAS = ['chapa', 'chapa-grande', 'fila', 'ficha', 'beneficio', 'brillo'];
const GLOBOS = ['globo', 'globo-lado', 'globo-abajo', 'globo-pleno', 'mono-suelto'];
const LUCES = ['luz', 'luz-brand', 'luz-festejo', 'luz-tenue'];

for (const clase of [...MATERIALES, ...PIEZAS, ...GLOBOS, ...LUCES, 'btn-outline-brand', 'chip-accent']) {
  test(`app.css define .${clase}`, () => {
    assert.match(css, new RegExp(`\\.${clase}\\s*[,{:\\s]`), `falta la clase .${clase}`);
  });
}

test('los cuatro materiales del prototipo están', () => {
  for (const material of MATERIALES) {
    assert.ok(new RegExp(`\\.${material}\\s*[,{:\\s]`).test(css), `falta el material .${material}`);
  }
});

test('el vidrio se apoya en backdrop-filter, que es lo que lo hace vidrio y no un gris', () => {
  const desde = css.indexOf('.vidrio');
  assert.ok(desde > 0, 'no está .vidrio');
  assert.ok(/backdrop-filter/.test(css.slice(desde, desde + 500)), 'el vidrio no difumina lo que tiene detras');
});

test('los tres cromos son tres colores distintos: si fueran el mismo, no serían tres', () => {
  // Cada uno se apoya en su propio token de gradiente, y los tres comparten el
  // barniz metálico. Así el oro vive en UN solo lugar —volvió a la paleta sólo
  // para el nivel— en vez de estar copiado en cada regla que lo use.
  const fondo = (clase) => {
    const desde = css.indexOf(`.${clase}`);
    assert.ok(desde > 0, `no está .${clase}`);
    return css.slice(desde, desde + 400).match(/background:\s*([^;]+)/)?.[1] ?? '';
  };

  const frio = fondo('cromo-frio');
  const oro = fondo('cromo-oro');
  const plata = fondo('cromo-plata');

  assert.match(frio, /var\(--metal\).*var\(--rampa\)/);
  assert.match(oro, /var\(--metal\).*var\(--oro\)/);
  assert.match(plata, /var\(--metal\).*var\(--plata\)/);

  assert.equal(new Set([frio, oro, plata]).size, 3, 'dos cromos comparten el fondo');

  for (const token of ['--metal', '--rampa', '--oro', '--plata']) {
    assert.ok(new RegExp(`${token}:\\s*linear-gradient`).test(css), `falta el token ${token}`);
  }
});

test('la chapa de nivel tiene su variante grande, que es la del festejo', () => {
  assert.match(css, /\.chapa-grande\s*[,{:\s]/);
});
