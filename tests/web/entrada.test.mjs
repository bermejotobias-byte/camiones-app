/**
 * La entrada: el orden de los pasos y el chip que dice en cuál va.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PASOS_DE_LA_ENTRADA, chipDePaso, pasoSiguiente } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js';

test('la entrada son cuatro pasos, en el orden del brainstorm v3', () => {
  assert.deepEqual(PASOS_DE_LA_ENTRADA, ['bienvenida', 'idioma', 'condiciones', 'acceso']);
});

test('el chip dice el paso sobre cuatro, como el tablero del prototipo', () => {
  assert.deepEqual(chipDePaso('idioma'), { etiqueta: 'Paso', valor: '2 de 4' });
  assert.deepEqual(chipDePaso('condiciones'), { etiqueta: 'Paso', valor: '3 de 4' });
});

test('la bienvenida y el acceso no llevan chip: son pantallas enteras, no los pasos de un trámite', () => {
  assert.equal(chipDePaso('bienvenida'), null);
  assert.equal(chipDePaso('acceso'), null);
});

test('el camión del invitado no lleva chip: ya pasó la puerta y no es un quinto paso', () => {
  // El prototipo fija "Paso 2 de 4"; numerar esto como 5 lo contradiría.
  assert.equal(chipDePaso('camion'), null);
});

test('un paso que no existe no lleva chip en vez de romper la cabecera', () => {
  assert.equal(chipDePaso('cualquiera'), null);
});

test('cada paso sabe cuál sigue, y el último no sigue a ninguno', () => {
  assert.equal(pasoSiguiente('bienvenida'), 'idioma');
  assert.equal(pasoSiguiente('idioma'), 'condiciones');
  assert.equal(pasoSiguiente('condiciones'), 'acceso');
  assert.equal(pasoSiguiente('acceso'), null);
});

/* ---------------------------------------------------------------------------
   Paso 2 · Idioma
--------------------------------------------------------------------------- */

import { IDIOMAS } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/idioma.js';

test('los cuatro idiomas del v3, y sólo el español se puede elegir hoy', () => {
  assert.deepEqual(IDIOMAS.map((i) => i.codigo), ['es', 'pt', 'en', 'gn']);
  assert.deepEqual(IDIOMAS.filter((i) => i.disponible).map((i) => i.codigo), ['es']);
});

test('cada idioma dice su país donde lo tiene, y el inglés no inventa uno', () => {
  assert.equal(IDIOMAS.find((i) => i.codigo === 'es').lugar, 'Argentina');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'pt').lugar, 'Brasil');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'gn').lugar, 'Paraguay');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'en').lugar, null);
});

test('el nombre de cada idioma está en ese idioma, que es como se reconoce', () => {
  assert.equal(IDIOMAS.find((i) => i.codigo === 'pt').nombre, 'Português');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'en').nombre, 'English');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'gn').nombre, 'Guaraní');
});

/* ---------------------------------------------------------------------------
   Paso 3 · Condiciones
--------------------------------------------------------------------------- */

import { TERMINOS } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/condiciones.js';

test('los términos dicen las cinco cosas que esta app tiene que decir', () => {
  const texto = TERMINOS.join(' ').toLowerCase();

  assert.match(texto, /openstreetmap/);   // de dónde sale el mapa
  assert.match(texto, /conductor/);       // de quién es la responsabilidad
  assert.match(texto, /comunidad/);       // quién escribe los reportes
  assert.match(texto, /correo/);          // qué datos se guardan
  assert.match(texto, /borr/);            // qué pasa al borrar la cuenta
});

test('no prometen nada que la app no haga', () => {
  // Una cláusula que la app no cumple es peor que no tenerla: es letra chica
  // falsa, y este producto se apoya en decir lo que no sabe.
  const texto = TERMINOS.join(' ').toLowerCase();

  assert.doesNotMatch(texto, /publicidad(?!\.)|anunciante|vender tus|cookies|suscripción/);
});

test('son pocos y cortos: nadie lee cinco pantallas de letra chica', () => {
  assert.ok(TERMINOS.length <= 6, `son ${TERMINOS.length} párrafos`);

  for (const parrafo of TERMINOS) {
    assert.ok(parrafo.length < 340, `un párrafo de ${parrafo.length} caracteres es un muro`);
  }
});
