/**
 * La hoja que aparece cuando un invitado toca algo que necesita cuenta.
 *
 * Se prueba el TEXTO, que es lo que decide si alguien entiende por qué no puede
 * y si le dan ganas de crear la cuenta. Un cartel genérico repetido cinco veces
 * enseña a ignorarlo.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MOTIVOS, textoDeCuenta } from '../../src/TruckNavigator.Api/wwwroot/js/cuenta.js';

test('hay un motivo por cada acción que el invitado no puede hacer', () => {
  assert.deepEqual(
    Object.keys(MOTIVOS).sort(),
    ['contacto', 'juegos', 'lugar', 'perfil', 'reportar', 'vencido', 'votar']
  );
});

test('cada motivo dice por qué ESA acción necesita cuenta, no un cartel comodín', () => {
  const textos = Object.keys(MOTIVOS).map((m) => textoDeCuenta(m).texto);

  assert.equal(new Set(textos).size, textos.length, 'dos motivos comparten el texto');

  // Se mira el título y el cuerpo juntos, que es lo que la persona lee de una.
  const dice = (motivo) => `${textoDeCuenta(motivo).titulo} ${textoDeCuenta(motivo).texto}`;

  assert.match(dice('reportar'), /alias/);
  assert.match(dice('votar'), /confiabilidad|confirm/i);
  assert.match(dice('lugar'), /Casa|Depósito/);
  assert.match(dice('contacto'), /emergencia/);
  assert.match(dice('juegos'), /EXP|nivel/);
  assert.match(dice('vencido'), /kilómetros/);
});

test('el título del vencido no reta a nadie: dice que se terminó y ofrece seguir', () => {
  assert.equal(textoDeCuenta('vencido').titulo, 'Se terminó tu día de prueba');
});

test('el vencido ofrece una sola salida; el resto deja seguir mirando', () => {
  // Con el día terminado no hay "ahora no" que valga: lo que sigue es la cuenta.
  assert.equal(textoDeCuenta('vencido').soloCuenta, true);
  assert.equal(textoDeCuenta('reportar').soloCuenta, false);
});

test('un motivo que no existe no deja a nadie sin explicación', () => {
  const generico = textoDeCuenta('cualquier-cosa');

  assert.ok(generico.titulo);
  assert.ok(generico.texto);
});
