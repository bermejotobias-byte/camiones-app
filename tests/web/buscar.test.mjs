/**
 * La hoja de búsqueda (waze-05 y el prototipo): qué secciones se muestran
 * según lo que se escribió y lo que hay guardado, y cómo se nombra cada
 * objetivo (destino, origen, Casa, Depósito).
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { seccionesDeBusqueda, tituloDeBusqueda, CATEGORIAS } from '../../src/TruckNavigator.Api/wwwroot/js/mapa/buscar.js';

const base = { texto: '', casa: null, deposito: null, recientes: [], sugerencias: null };

test('sin escribir nada: categorías, Casa y Depósito, recientes si hay, y más opciones', () => {
  const secciones = seccionesDeBusqueda({ ...base, recientes: [{ label: 'Puerto' }] });

  assert.deepEqual(secciones, ['categorias', 'lugares', 'recientes', 'mas']);
});

test('sin recientes, esa sección no aparece', () => {
  assert.deepEqual(seccionesDeBusqueda(base), ['categorias', 'lugares', 'mas']);
});

test('con tres letras o más solo se ven las sugerencias', () => {
  assert.deepEqual(seccionesDeBusqueda({ ...base, texto: 'Sáe', sugerencias: [] }), ['sugerencias']);
  assert.deepEqual(seccionesDeBusqueda({ ...base, texto: 'Sá' }), ['categorias', 'lugares', 'mas']);
});

test('buscando la Casa o el Depósito no se ofrecen atajos ni categorías: solo dónde queda', () => {
  assert.deepEqual(seccionesDeBusqueda({ ...base, objetivo: 'Home', recientes: [{ label: 'Puerto' }] }), ['recientes', 'mas']);
  assert.deepEqual(seccionesDeBusqueda({ ...base, objetivo: 'origin' }), ['mas']);
});

test('el título de la píldora dice qué se está buscando', () => {
  assert.equal(tituloDeBusqueda('destination'), '¿Adónde vas?');
  assert.equal(tituloDeBusqueda('origin'), '¿Desde dónde salís?');
  assert.equal(tituloDeBusqueda('Home'), '¿Dónde queda tu casa?');
  assert.equal(tituloDeBusqueda('Depot'), '¿Dónde queda el depósito?');
});

test('las seis categorías llevan la categoría del servidor y su calcomanía', () => {
  assert.equal(CATEGORIAS.length, 6);

  for (const c of CATEGORIAS) {
    assert.ok(c.id && c.categoria && c.calcomania && c.nombre, JSON.stringify(c));
  }

  assert.equal(CATEGORIAS.find((c) => c.id === 'gomeria').categoria, 'TyreShop');
  assert.equal(CATEGORIAS.find((c) => c.id === 'playa').categoria, 'TruckParking');
});
