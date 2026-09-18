/**
 * Aportar un lugar (el prototipo, tableros "Aportar · ¿Qué hay acá?" y
 * "Marcar el lugar").
 *
 * La hoja "¿Qué ves?" de waze-07, medida: titulo en 21 negrita, cruz a la
 * derecha, y la grilla de circulos de 75 en #3c4043 con calcomania de 40 y
 * rotulo debajo. Con lo que existe hoy: las seis categorias de lugar; los
 * reportes de la Fase 5 entran a esta misma grilla cuando se decidan.
 *
 * Elegida la categoria, el mapa vuelve al frente con el pin fijo en el
 * centro —se mueve el mapa, no el pin, como en Maps— y una hoja corta: la
 * categoria, el nombre y Guardar. Si ya hay uno igual a menos de 25 m, la
 * API contesta 409 y se ofrece votar el existente en vez de duplicarlo.
 *
 * Solo marcado y lo puro; navigate.js lo engancha por data-accion.
 */

import { calcomania, dibujo, pildora } from './piezas.js';
import { CATEGORIAS } from './buscar.js';
import { escapeHtml } from '../ui.js';

/** Los limites del nombre son los del dominio (PoiContribution). */
export const LARGO_MINIMO = 3;
export const LARGO_MAXIMO = 80;

const EN_SINGULAR = {
  gomeria: 'Gomería',
  taller: 'Taller',
  estacion: 'Estación de servicio',
  comer: 'Lugar para comer',
  auxilio: 'Auxilio pesado',
  playa: 'Playa de camiones'
};

/** Por que no sirve un nombre, o null si sirve. Se dice antes de mandar. */
export function nombreValido(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return 'Poné el nombre del lugar.';
  if (limpio.length < LARGO_MINIMO) return 'El nombre es muy corto.';
  if (limpio.length > LARGO_MAXIMO) return 'El nombre es muy largo.';
  return null;
}

/** "¿Qué hay acá?": la grilla de categorias. */
export function hojaAportar() {
  return `
  <div class="gps-manija"></div>
  <div class="gps-aportar-titulo">
    <b>¿Qué hay acá?</b>
    <button type="button" class="gps-ficha-cerrar" data-accion="cerrar" aria-label="Cerrar">${dibujo('cerrar', 24, 2.4)}</button>
  </div>
  <div class="gps-redondos">
    ${CATEGORIAS.map((c) => `
    <button type="button" class="gps-redondo-grande" data-accion="categoria" data-id="${c.id}">
      <span class="gps-redondo-ico">${calcomania(c.calcomania, 40)}</span>
      <span>${escapeHtml(EN_SINGULAR[c.id] ?? c.nombre)}</span>
    </button>`).join('')}
  </div>
  <p class="gps-pie">Se guarda como aporte de la comunidad, con tu voto. <b>+10 EXP</b></p>`;
}

/**
 * Marcar el lugar: el chip de la categoria (tocarlo vuelve a elegir), el
 * nombre y Guardar. El pin fijo y la cabecera los pone navigate.js sobre el
 * mapa.
 */
export function hojaMarcar({ categoria, nombre = '' }) {
  const cat = CATEGORIAS.find((c) => c.id === categoria);

  return `
  <div class="gps-manija"></div>
  <button type="button" class="gps-chip-cat is-on gps-chip-elegido" data-accion="categoria">
    ${calcomania(cat?.calcomania ?? 'lugar', 20)}<span>${escapeHtml(EN_SINGULAR[categoria] ?? 'Lugar')}</span>${dibujo('abajo', 16, 2.4)}
  </button>
  <label class="gps-campo">
    <span>Nombre</span>
    <input id="gps-aportar-nombre" type="text" value="${escapeHtml(nombre)}" maxlength="${LARGO_MAXIMO}"
           placeholder="Como figura en el cartel" autocomplete="off" enterkeyhint="done">
  </label>
  <p class="gps-pie">Movés el mapa hasta que el pin quede sobre la entrada.</p>
  <div class="gps-acciones">
    ${pildora('Guardar', { clase: 'celeste', id: 'gps-aportar-guardar', datos: 'data-accion="guardar"' })}
  </div>`;
}
