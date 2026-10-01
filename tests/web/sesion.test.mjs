/**
 * En qué estado está la app y qué puede hacer cada estado.
 *
 * Es la función que reemplaza las dos puertas que app.js tenía sueltas. Se
 * prueba entera acá porque es la que decide si alguien entra, si puede navegar y
 * si su día de prueba se terminó: un error suyo deja gente afuera de un GPS.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DIAS_DE_PRUEBA, estadoDeSesion, permisos, invitadoVencido } from '../../src/TruckNavigator.Api/wwwroot/js/sesion.js';

const HOY = new Date('2026-09-30T15:00:00-03:00');
const nuevo = {};
const listo = { vioBienvenida: true, idioma: 'es', condicionesAceptadas: '2026-09-30T12:00:00.000Z' };

test('el día de prueba es uno, y es una constante con nombre', () => {
  assert.equal(DIAS_DE_PRUEBA, 1);
});

test('sin nada elegido, lo que falta es la bienvenida', () => {
  const estado = estadoDeSesion(nuevo, false, HOY);

  assert.equal(estado.tipo, 'nueva');
  assert.equal(estado.pasoQueFalta, 'bienvenida');
});

test('los pasos salen en orden: idioma, condiciones, acceso', () => {
  assert.equal(estadoDeSesion({ vioBienvenida: true }, false, HOY).pasoQueFalta, 'idioma');
  assert.equal(estadoDeSesion({ vioBienvenida: true, idioma: 'es' }, false, HOY).pasoQueFalta, 'condiciones');
  assert.equal(estadoDeSesion(listo, false, HOY).pasoQueFalta, 'acceso');
});

test('con sesión no falta ningún paso, sin importar lo que haya en las preferencias', () => {
  const estado = estadoDeSesion(nuevo, true, HOY);

  assert.equal(estado.tipo, 'cuenta');
  assert.equal(estado.pasoQueFalta, null);
});

test('quien ya había aceptado las fuentes cae directo en acceso: ya leyó lo que Condiciones enlaza', () => {
  // La migración de quien viene usando la app. Hacerle dar la vuelta entera
  // sería castigarlo por haber estado antes.
  const estado = estadoDeSesion({ sourcesAccepted: true }, false, HOY);

  assert.equal(estado.pasoQueFalta, 'acceso');
});

test('el invitado sin camión elegido todavía debe elegirlo', () => {
  const prefs = { ...listo, invitadoDesde: HOY.toISOString() };

  assert.equal(estadoDeSesion(prefs, false, HOY).pasoQueFalta, 'camion');
});

test('el invitado con camión ya está adentro, y es invitado', () => {
  const prefs = { ...listo, invitadoDesde: HOY.toISOString(), invitadoCamionId: 'plantilla-1' };
  const estado = estadoDeSesion(prefs, false, HOY);

  assert.equal(estado.tipo, 'invitado');
  assert.equal(estado.pasoQueFalta, null);
  assert.equal(estado.invitadoVencido, false);
});

test('el día se termina al día siguiente, en hora local', () => {
  assert.equal(invitadoVencido({ invitadoDesde: '2026-09-29T23:30:00-03:00' }, HOY), true);
  assert.equal(invitadoVencido({ invitadoDesde: '2026-09-30T00:10:00-03:00' }, HOY), false);
});

test('sin sello no hay nada vencido, y una fecha rota no deja a nadie afuera', () => {
  // Una preferencia corrupta no puede convertirse en una puerta cerrada.
  assert.equal(invitadoVencido({}, HOY), false);
  assert.equal(invitadoVencido({ invitadoDesde: 'cualquier cosa' }, HOY), false);
});

test('el invitado vencido sigue siendo invitado: no vuelve a la entrada', () => {
  const prefs = { ...listo, invitadoDesde: '2026-09-28T10:00:00-03:00', invitadoCamionId: 'plantilla-1' };
  const estado = estadoDeSesion(prefs, false, HOY);

  assert.equal(estado.tipo, 'invitado');
  assert.equal(estado.pasoQueFalta, null);
  assert.equal(estado.invitadoVencido, true);
});

test('quien entra con cuenta despues de haber sido invitado deja de ser invitado', () => {
  // El sello del invitado queda en las preferencias; la sesion manda sobre el.
  const prefs = { ...listo, invitadoDesde: '2026-09-28T10:00:00-03:00', invitadoCamionId: 'plantilla-1' };
  const estado = estadoDeSesion(prefs, true, HOY);

  assert.equal(estado.tipo, 'cuenta');
  assert.equal(estado.invitadoVencido, false);
});

test('la cuenta puede todo', () => {
  assert.deepEqual(permisos({ tipo: 'cuenta', invitadoVencido: false }), {
    verMapa: true,
    navegar: true,
    guardarViaje: true,
    reportar: true,
    guardarLugares: true,
    contactos: true,
    perfil: true,
    configuracion: true,
    emergencia: true
  });
});

test('el invitado ve el mapa y navega, pero nada se guarda ni se reporta', () => {
  const p = permisos({ tipo: 'invitado', invitadoVencido: false });

  assert.equal(p.verMapa, true);
  assert.equal(p.navegar, true);
  assert.equal(p.guardarViaje, false);
  assert.equal(p.reportar, false);
  assert.equal(p.guardarLugares, false);
  assert.equal(p.contactos, false);
  assert.equal(p.perfil, false);
  assert.equal(p.configuracion, true);
});

test('al invitado vencido se le apaga navegar, y sólo eso', () => {
  const p = permisos({ tipo: 'invitado', invitadoVencido: true });

  assert.equal(p.navegar, false);
  assert.equal(p.verMapa, true);
  assert.equal(p.configuracion, true);
});

test('el que todavía está en la entrada no ve el mapa', () => {
  const p = permisos({ tipo: 'nueva', invitadoVencido: false });

  assert.equal(p.verMapa, false);
  assert.equal(p.navegar, false);
});

test('el 911 funciona en los cuatro estados, y eso no se negocia', () => {
  // Nada de las cuentas ni de la gamificación puede estorbar un pedido de
  // auxilio. Es la misma regla que ya rige para la batería.
  for (const estado of [
    { tipo: 'nueva', invitadoVencido: false },
    { tipo: 'invitado', invitadoVencido: false },
    { tipo: 'invitado', invitadoVencido: true },
    { tipo: 'cuenta', invitadoVencido: false }
  ]) {
    assert.equal(permisos(estado).emergencia, true, estado.tipo);
  }
});
