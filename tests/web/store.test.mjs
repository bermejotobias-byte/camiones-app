/**
 * Las preferencias que la app guarda en el teléfono.
 *
 * Se prueba porque acá vive la migración de quien ya venía usando la app: una
 * preferencia que se llama distinto en dos archivos deja a alguien afuera de la
 * entrada o lo hace repetirla. El resto del estado compartido no necesita test:
 * es un objeto.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/* ---------------------------------------------------------------------------
   Andamio

   `store.js` lee localStorage al cargarse, así que el entorno se arma ANTES de
   importarlo. Se guarda lo escrito para poder comprobar que savePrefs persiste.
--------------------------------------------------------------------------- */

const guardado = new Map();

globalThis.localStorage = {
  getItem: (clave) => guardado.get(clave) ?? null,
  setItem: (clave, valor) => guardado.set(clave, String(valor)),
  removeItem: (clave) => guardado.delete(clave)
};

const { prefs, savePrefs } = await import('../../src/TruckNavigator.Api/wwwroot/js/store.js');
const { PREFERENCIAS_DE_ENTRADA } = await import('../../src/TruckNavigator.Api/wwwroot/js/sesion.js');

test('las preferencias de la entrada están entre las de fábrica, con los nombres de sesion.js', () => {
  // Salen de un solo lugar a propósito: si store.js las declarara por su cuenta,
  // un nombre distinto en cada archivo pasaría los tests de los dos.
  for (const [nombre, valor] of Object.entries(PREFERENCIAS_DE_ENTRADA)) {
    assert.ok(nombre in prefs, `falta la preferencia ${nombre}`);
    assert.equal(prefs[nombre], valor, nombre);
  }
});

test('el idioma arranca sin elegir, no en español', () => {
  // La pantalla de idioma existe para que alguien elija, aunque hoy haya una
  // sola opción. Si arrancara elegido, el paso 2 no se mostraría nunca.
  assert.equal(prefs.idioma, null);
});

test('sourcesAccepted sigue existiendo: es lo que migra a quien ya usaba la app', () => {
  assert.ok('sourcesAccepted' in prefs);
  assert.equal(prefs.sourcesAccepted, false);
});

test('lo que se guarda queda escrito en el teléfono y en el objeto', () => {
  savePrefs({ idioma: 'es' });

  assert.equal(prefs.idioma, 'es');
  assert.match(guardado.get('tn.prefs'), /"idioma":"es"/);
});
