/**
 * El zócalo: las cuatro entradas del v3 §11 y qué ve un invitado en el menú.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ACCESOS, MENU_MAS, menuParaInvitado } from '../../src/TruckNavigator.Api/wwwroot/js/dock.js';

test('el zócalo son los cuatro accesos del brainstorm v3', () => {
  assert.deepEqual(ACCESOS.map((a) => a.id), ['mapa', 'juegos', 'emergencia', 'mas']);
});

test('el menú tiene las entradas del v3 §12, con Resumen y Chat marcados como pronto', () => {
  assert.deepEqual(
    MENU_MAS.map((m) => m.ruta),
    ['perfil', 'resumen', 'reportes', 'camiones', 'carnet', 'chat', 'configuracion']
  );

  assert.deepEqual(MENU_MAS.filter((m) => m.pronto).map((m) => m.ruta), ['resumen', 'chat']);
});

test('cada entrada del menú dice de qué se trata, no sólo su nombre', () => {
  // La fila del prototipo es ícono, título, subtítulo y chevron: sin subtítulo
  // es media fila.
  for (const entrada of MENU_MAS) {
    assert.ok(entrada.label, entrada.ruta);
    assert.ok(entrada.sub, `${entrada.ruta} no dice de qué se trata`);
  }
});

test('el invitado ve Configuración y la invitación, y nada que no pueda abrir', () => {
  // Un menú lleno de filas que no puede abrir es una lista de frustraciones.
  assert.deepEqual(menuParaInvitado(MENU_MAS).map((m) => m.ruta), ['configuracion', 'cuenta-nueva']);
});

test('la fila de la cuenta del invitado invita, no reta', () => {
  const fila = menuParaInvitado(MENU_MAS).find((m) => m.ruta === 'cuenta-nueva');

  assert.equal(fila.label, 'Crear mi cuenta');
  assert.match(fila.sub, /kilómetros|reportar|nivel/);
});

test('Configuración no es un lujo para el invitado: ahí está la dirección del servidor', () => {
  // Es lo que le permite arreglar la app si la IP del backend cambió.
  const fila = menuParaInvitado(MENU_MAS).find((m) => m.ruta === 'configuracion');

  assert.ok(fila);
});
