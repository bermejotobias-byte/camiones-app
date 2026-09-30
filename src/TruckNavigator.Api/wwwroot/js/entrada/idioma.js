/**
 * Paso 2 de la entrada: el idioma.
 *
 * Decision del usuario del 08/09/2026: la pantalla se presenta, pero la unica
 * opcion por ahora es el español. Las otras tres dicen "Pronto" y no se pueden
 * elegir; la pildora ya explica por que, asi que tocarlas no hace nada y no hace
 * falta ningun cartel.
 *
 * Se guarda la eleccion aunque hoy haya un solo valor posible. Es lo que permite
 * sumar un idioma sin rehacer el flujo (v3 §7), y es la razon por la que la
 * preferencia arranca en null y no en 'es': si arrancara elegida, este paso no
 * se mostraria nunca.
 *
 * El nombre de cada idioma esta escrito EN ese idioma, que es como lo reconoce
 * quien lo habla.
 */

import { html, raw, render, wire, qa } from '../ui.js';
import { icono } from '../iconos.js';

export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español', lugar: 'Argentina', disponible: true },
  { codigo: 'pt', nombre: 'Português', lugar: 'Brasil', disponible: false },
  { codigo: 'en', nombre: 'English', lugar: null, disponible: false },
  { codigo: 'gn', nombre: 'Guaraní', lugar: 'Paraguay', disponible: false }
];

export function idiomaView(host, { chip, onContinuar }) {
  host.className = 'screen';

  let elegido = 'es';

  const fila = (i) => `
    <button class="fila ${i.codigo === elegido ? 'neon' : ''}" data-idioma="${i.codigo}"
            ${i.disponible ? '' : 'disabled'}>
      ${icono('idioma', 32)}
      <div class="grow">
        <b>${i.nombre}</b>
        ${i.lugar ? `<span class="sub">${i.lugar}</span>` : ''}
      </div>
      <span class="pill ${i.disponible ? 'pill-brand' : 'pill-reward'}">${i.disponible ? 'Elegido' : 'Pronto'}</span>
    </button>`;

  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-tenue"></div>

      <div class="topbar">
        <h2>Idioma</h2>
        ${raw(chip ? `<span class="pill pill-brand">${chip.etiqueta} ${chip.valor}</span>` : '')}
      </div>

      <div class="entrada-scroll">
        <p class="entrada-bajada" style="text-align:left;max-width:none">
          ¿En qué idioma te hablo? Por ahora, español. Los demás están en camino.
        </p>

        ${raw(IDIOMAS.map(fila).join(''))}

        <div class="grow"></div>
        <button class="btn btn-primary btn-duo btn-block brillo" id="continuar">Continuar</button>
      </div>
    </div>
  `);

  // Los que dicen "Pronto" estan deshabilitados: el navegador no dispara su
  // click, asi que no hace falta filtrar nada aca.
  qa(host, '[data-idioma]').forEach((boton) =>
    boton.addEventListener('click', () => {
      elegido = boton.dataset.idioma;
      qa(host, '[data-idioma]').forEach((otro) => otro.classList.toggle('neon', otro === boton));
    }));

  wire(host, { '#continuar': () => onContinuar(elegido) });
}
