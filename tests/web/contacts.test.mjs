/**
 * El puente hacia la libreta de contactos de Android.
 *
 * Esto se testea porque vive en la costura entre la cáscara nativa y la web, que
 * es donde el proyecto se lastimó cinco veces y lo único que no se puede probar
 * desde acá. Lo que sí se puede probar es la mitad de este lado: que una promesa
 * termine SIEMPRE, y que termine distinto según lo que haya pasado.
 *
 * La distinción que más importa: **cancelar no es fallar**. Quien salió de la
 * agenda sin elegir no necesita ver un cartel de error; quien no pudo abrirla,
 * sí. Si las dos cosas viajaran iguales, la app le mentiría a una de las dos.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/* ---------------------------------------------------------------------------
   Andamio

   `platform.js` decide al cargarse si está adentro de la cáscara, mirando
   `window.HybridWebView` y el hostname. Así que el entorno se arma ANTES de
   importarlo, y para probar el caso del navegador hace falta otra instancia del
   módulo: de ahí el `?v=` del último test.
--------------------------------------------------------------------------- */

const enviados = [];

globalThis.window = {
  HybridWebView: { SendRawMessage: (mensaje) => enviados.push(JSON.parse(mensaje)) }
};

globalThis.location = { hostname: '0.0.0.0' };

const RUTA = '../../src/TruckNavigator.Api/wwwroot/js/platform.js';
const { pickContact, canPickContact } = await import(RUTA);

/** Deja el puente limpio entre tests: cada uno arranca sin pedidos en curso. */
function limpiar() {
  enviados.length = 0;
  window.TN_contactCancelled(null);
}

/* ------------------------------------------------------------------ elegir */

test('elegir un contacto devuelve su nombre y su número', async () => {
  limpiar();

  const pedido = pickContact();
  window.TN_contactPicked('Doña Rosa', '11 4567-8900');

  assert.deepEqual(await pedido, { name: 'Doña Rosa', phone: '11 4567-8900' });
});

test('el número llega tal como está en la agenda', async () => {
  limpiar();

  // Con espacios, guiones y prefijo internacional. El puente no normaliza: las
  // reglas del 0, el 15 y el +54 9 son de quien guarde el dato, no de acá, y
  // además no valen fuera del país.
  const pedido = pickContact();
  window.TN_contactPicked('Taller', '+54 9 11 5555-1234');

  assert.equal((await pedido).phone, '+54 9 11 5555-1234');
});

test('un contacto sin nombre no rompe: viaja vacío', async () => {
  limpiar();

  const pedido = pickContact();
  window.TN_contactPicked(null, '1145678900');

  assert.deepEqual(await pedido, { name: '', phone: '1145678900' });
});

/* --------------------------------------------------------------- cancelar */

test('salir sin elegir resuelve null, y NO es un error', async () => {
  limpiar();

  const pedido = pickContact();
  window.TN_contactCancelled(null);

  assert.equal(await pedido, null);
});

test('una cadena vacía también es cancelar', async () => {
  limpiar();

  // La cáscara manda null explícito, pero un motivo vacío significa lo mismo y
  // no debería convertirse en un cartel de error sin texto.
  const pedido = pickContact();
  window.TN_contactCancelled('');

  assert.equal(await pedido, null);
});

/* ----------------------------------------------------------------- fallar */

test('un fallo con motivo rechaza, y el motivo llega entero', async () => {
  limpiar();

  const pedido = pickContact();
  window.TN_contactCancelled('Ese contacto no tiene un número de teléfono.');

  await assert.rejects(pedido, {
    message: 'Ese contacto no tiene un número de teléfono.'
  });
});

/* ------------------------------------------------------- un pedido por vez */

test('dos pedidos con uno abierto comparten promesa y abren UNA sola agenda', async () => {
  limpiar();

  const primero = pickContact();
  const segundo = pickContact();

  assert.equal(primero, segundo, 'tiene que ser la misma promesa');
  assert.equal(enviados.length, 1, 'no puede abrirse un segundo selector encima');
  assert.deepEqual(enviados[0], { action: 'pickContact' });

  window.TN_contactPicked('Ana', '1122334455');
  assert.deepEqual(await primero, { name: 'Ana', phone: '1122334455' });
});

test('cerrado un pedido, el siguiente vuelve a abrir la agenda', async () => {
  limpiar();

  const primero = pickContact();
  window.TN_contactCancelled(null);
  await primero;

  const segundo = pickContact();

  assert.notEqual(primero, segundo);
  assert.equal(enviados.length, 2);

  window.TN_contactPicked('Luis', '1199887766');
  await segundo;
});

test('una respuesta sin pedido en curso no rompe nada', () => {
  limpiar();

  // Pasa si la cáscara contesta dos veces, o tarde. No hay a quién avisarle, y
  // eso no puede tirar una excepción adentro del WebView.
  assert.doesNotThrow(() => window.TN_contactPicked('Nadie', '123'));
  assert.doesNotThrow(() => window.TN_contactCancelled('tarde'));
});

/* ---------------------------------------------------------- en el navegador */

test('sin cáscara no hay agenda, y se dice en vez de quedar esperando', async () => {
  const otroWindow = {};

  globalThis.window = otroWindow;
  globalThis.location = { hostname: 'localhost' };

  const web = await import(`${RUTA}?v=navegador`);

  assert.equal(web.canPickContact, false, 'quien ofrezca el botón tiene que poder saberlo');
  await assert.rejects(web.pickContact(), /aplicación del teléfono/);

  // El entorno queda como estaba para no ensuciar a quien corra después.
  globalThis.window = otroWindow;
});

/* --------------------------------------------------------- listo para marcar */

test('el número de la agenda queda marcable: sin espacios ni guiones', async () => {
  const { forDialing } = await import(RUTA);

  // Este es el bug que encontró el teléfono: el 911 marcaba y "11 4567-8900"
  // no hacía nada. `tel:` es un URI y un espacio adentro no es válido, así que
  // el Intent no resuelve — sin error, sin nada. Ver AD-43.
  assert.equal(forDialing('11 4567-8900'), '1145678900');
});

test('conserva el + que abre un número internacional', async () => {
  const { forDialing } = await import(RUTA);

  assert.equal(forDialing('+54 9 11 5555-1234'), '+5491155551234');
});

test('descarta un + que no está al principio, porque ahí no significa nada', async () => {
  const { forDialing } = await import(RUTA);

  assert.equal(forDialing('11 4567+8900'), '1145678900');
});

test('conserva * y # de los códigos de servicio', async () => {
  const { forDialing } = await import(RUTA);

  assert.equal(forDialing('*111#'), '*111#');
});

test('saca paréntesis, puntos y barras', async () => {
  const { forDialing } = await import(RUTA);

  assert.equal(forDialing('(011) 4567.8900'), '01145678900');
  assert.equal(forDialing('0800/333/1234'), '08003331234');
});

test('un número corto sigue funcionando', async () => {
  const { forDialing } = await import(RUTA);

  // El 911 andaba antes del arreglo y tiene que seguir andando: es lo único de
  // esta pantalla que no puede fallar.
  assert.equal(forDialing('911'), '911');
});

test('sin dígitos no devuelve nada, para no abrir el discador en blanco', async () => {
  const { forDialing } = await import(RUTA);

  // Un `tel:` vacío abre el discador sin número: parece que la app hizo algo
  // cuando no hizo nada.
  assert.equal(forDialing('llamar al taller'), '');
  assert.equal(forDialing(''), '');
  assert.equal(forDialing(null), '');
  assert.equal(forDialing(undefined), '');
});
