/**
 * La hoja de reposo (waze-03, medida): 150 dp con la manija de 50 x 4, la
 * pildora de 50 con la lupa y "¿Adónde vas?" en 16 sp gris, y tres atajos de
 * 45 —Casa, Deposito y Nuevo— en 17 sp. Es lo que se ve mientras no se
 * busca ni se viaja.
 *
 * Sin hamburguesa ni microfono: el zocalo tiene "Más", y la voz no entra en
 * esta etapa. Solo marcado; navigate.js lo engancha.
 */

import { calcomania, dibujo } from './piezas.js';
import { escapeHtml } from '../ui.js';

/**
 * @param {{casa: object|null, deposito: object|null}} lugares  los guardados, si hay
 */
export function hojaReposo({ casa = null, deposito = null } = {}) {
  const atajo = (kind, nombre, lugar) => `
    <button type="button" class="gps-atajo" data-accion="${lugar ? 'ir-a-guardado' : 'fijar-guardado'}" data-kind="${kind}"
            title="${escapeHtml(lugar ? lugar.label : `Establecer ${nombre}`)}">
      ${calcomania(kind === 'Home' ? 'casa' : 'deposito', 22)}<span>${nombre}</span>
    </button>`;

  return `
    <div class="gps-manija ancha"></div>
    <button type="button" class="gps-buscar-reposo" data-accion="buscar">
      ${dibujo('lupa', 24, 2.2)}<span>¿Adónde vas?</span>
    </button>
    <div class="gps-atajos">
      ${atajo('Home', 'Casa', casa)}
      ${atajo('Depot', 'Depósito', deposito)}
      <button type="button" class="gps-atajo nuevo" data-accion="buscar">${dibujo('mas', 18, 2.8)}<span>Nuevo</span></button>
    </div>`;
}
