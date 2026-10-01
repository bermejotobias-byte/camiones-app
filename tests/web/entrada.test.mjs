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

/* ---------------------------------------------------------------------------
   Paso 4 · Acceso — los mensajes de error del ingreso
--------------------------------------------------------------------------- */

import { mensajeDeIngreso } from '../../src/TruckNavigator.Api/wwwroot/js/views/auth.js';
import { ApiError } from '../../src/TruckNavigator.Api/wwwroot/js/api.js';

const problema = (cuerpo, status = 400) => new ApiError('error', status, cuerpo);

test('el correo sin confirmar se explica, que es lo que menos se adivina', () => {
  const mensaje = mensajeDeIngreso(problema({ detail: 'NotAllowed' }, 401), 'signin');

  assert.match(mensaje, /confirmaste el correo/i);
});

test('la cuenta bloqueada dice cuánto esperar, y el 401 no culpa al correo ni a la clave por separado', () => {
  assert.match(mensajeDeIngreso(problema({ detail: 'LockedOut' }, 401), 'signin'), /15 minutos/);

  // Decir cuál de los dos está mal le regala a un atacante saber qué correos
  // existen.
  assert.match(mensajeDeIngreso(problema(null, 401), 'signin'), /no coinciden/i);
});

test('un correo ya usado manda a entrar en vez de dejar a alguien trabado', () => {
  assert.match(mensajeDeIngreso(problema({ errors: { DuplicateEmail: [] } }), 'signup'), /Probá entrando/);
});

test('lo que no es un error de la API vuelve tal cual', () => {
  assert.equal(mensajeDeIngreso(new Error('se cayó la red'), 'signin'), 'se cayó la red');
});

/* ---------------------------------------------------------------------------
   El camión del invitado
--------------------------------------------------------------------------- */

import { fichaDePlantilla } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/camion.js';

test('la ficha de una plantilla dice las medidas que deciden la ruta, con unidad', () => {
  assert.deepEqual(
    fichaDePlantilla({ name: 'Semi 3 ejes', heightMeters: 4.1, widthMeters: 2.6, lengthMeters: 18.6, grossWeightKg: 45000 }),
    { nombre: 'Semi 3 ejes', medidas: '4,10 m de alto · 18,6 m de largo', peso: '45 t' }
  );
});

test('lo que la plantilla no declara no se inventa', () => {
  // Decir lo que falta es lo que vuelve confiable a lo que sí está.
  const ficha = fichaDePlantilla({ name: 'Chasis', heightMeters: null, lengthMeters: null, grossWeightKg: 12000 });

  assert.equal(ficha.medidas, 'Sin medidas declaradas');
  assert.equal(ficha.peso, '12 t');
});

test('con una sola medida declarada, dice esa y nada más', () => {
  const ficha = fichaDePlantilla({ name: 'Camión', heightMeters: 3.6, lengthMeters: null, grossWeightKg: 8000 });

  assert.equal(ficha.medidas, '3,60 m de alto');
});

test('el alto va con dos decimales y coma, que es como se lee en la calle', () => {
  // 4.1 es "4,10 m": el cartel del gálibo dice 4,10 y no 4.1.
  assert.match(fichaDePlantilla({ name: 'x', heightMeters: 4.1, grossWeightKg: 1000 }).medidas, /4,10 m/);
});

test('el largo de un semi es el del CONJUNTO, no el del tractor solo', () => {
  // La plantilla "Semirremolque" declara 6 m de tractor y 12 de acoplado. Lo que
  // decide por qué calles puede doblar son los 18, y es lo que el dominio llama
  // TotalLengthMeters: "la que se compara contra los límites de la vía".
  const ficha = fichaDePlantilla({
    name: 'Semirremolque',
    heightMeters: 4.2,
    lengthMeters: 6,
    totalLengthMeters: 18,
    grossWeightKg: 40_000
  });

  assert.match(ficha.medidas, /18 m de largo/);
  assert.doesNotMatch(ficha.medidas, /6 m de largo/);
});
