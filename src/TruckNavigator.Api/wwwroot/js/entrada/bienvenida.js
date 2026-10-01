/**
 * Paso 1 de la entrada: la Bienvenida.
 *
 * Es uno de los dos tableros que el usuario eligio como orientacion el
 * 14/09/2026 —"es la orientacion que estaba buscando"—, asi que se implementa
 * tal cual: luz celeste, la silueta de la ruta, el globo del mono, el mono con
 * mate, el titulo, la bajada, tres beneficios y dos acciones.
 *
 * El globo va ABAJO del mono porque el mono esta debajo del globo, y su pildora
 * es naranja: es la voz del mono, la unica pieza naranja de la region. Por eso
 * las dos acciones son celestes, y no al revés.
 *
 * Los tres beneficios usan viaje, logros y exp, que es lo que usa el tablero. No
 * existe icono de "galibo" en el set aprobado.
 */

import { html, raw, render, wire } from '../ui.js';
import { mascota } from '../mascota.js';
import { icono } from '../iconos.js';

/**
 * La silueta de la ruta que sube desde el pie de la pantalla, con sus guiones de
 * carril. Es del tablero: da profundidad sin competir con el mono.
 */
const siluetaDeRuta = () => `
  <svg class="luz" viewBox="0 0 390 844" width="390" height="844" fill="none"
       preserveAspectRatio="xMidYMax slice" style="opacity:.55" aria-hidden="true">
    <path d="M60 844 L178 520 L212 520 L330 844" stroke="rgba(53,184,232,.22)" stroke-width="2"/>
    <path d="M195 530 v40 M195 600 v52 M195 685 v64 M195 785 v60"
          stroke="rgba(53,184,232,.30)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

export function bienvenidaView(host, { onEmpezar, onYaTengoCuenta }) {
  host.className = 'screen';

  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-brand"></div>
      ${raw(siluetaDeRuta())}

      <div class="entrada-cuerpo">
        <span class="section-caps entrada-rotulo">Navegador de tránsito pesado · CABA</span>

        <div class="entrada-centro">
          <div class="globo globo-abajo">
            <span class="pill chip-accent">Bienvenido</span>
            <b>Hola, compañero.</b>
            <p>Yo te acompaño. Vos manejás.</p>
          </div>

          <div class="entrada-mono mono-grande">
            ${raw(mascota('saludo', { escala: 3.5 }))}
          </div>

          <h1 class="entrada-titulo">El GPS de los<br><span>camioneros</span></h1>
          <p class="entrada-bajada">Rutas por donde tu camión puede pasar. Y kilómetros que suman.</p>
        </div>

        <div class="entrada-beneficios">
          <div class="beneficio">${raw(icono('viaje', 30))}<span>Ruta según tu camión</span></div>
          <div class="beneficio">${raw(icono('logros', 30))}<span>Gálibos y Red pesada</span></div>
          <div class="beneficio">${raw(icono('exp', 30))}<span>Cada viaje suma</span></div>
        </div>
      </div>

      <div class="entrada-acciones">
        <button class="btn btn-primary btn-duo btn-block brillo" id="empezar">Empezar</button>
        <button class="btn btn-outline-brand btn-duo btn-block" id="ya-tengo">Ya tengo una cuenta</button>
        <p class="hint entrada-legal">Ley 2148 de la Ciudad · Mapa de OpenStreetMap</p>
      </div>
    </div>
  `);

  wire(host, { '#empezar': onEmpezar, '#ya-tengo': onYaTengoCuenta });
}
