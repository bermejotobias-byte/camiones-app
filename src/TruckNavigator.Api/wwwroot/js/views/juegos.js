/**
 * Juegos: la pestaña existe antes que los juegos.
 *
 * Decision del usuario del 12/09/2026: el zocalo tiene cuatro accesos desde el
 * primer dia, y JUEGOS abre esta pantalla mientras no haya ninguno. Una pestaña
 * apagada se lee como rota, y una que falta cambia la forma del zocalo cuando
 * aparece. Esto no miente: dice que viene, y que.
 *
 * La trivia va primero (producto, v2 y v3). El lugar de la mascota queda
 * reservado arriba, como pide la skill de diseño: se compone previendo donde va,
 * y nada depende de que este.
 */

import { html, raw, icon, wire, render } from '../ui.js';

export function juegosView(host, { go, openDrawer }) {
  host.className = 'screen';

  render(host, html`
    <div class="topbar">
      <button class="fab" id="menu" aria-label="Menú">${raw(icon('menu', 20))}</button>
      <h2>Juegos</h2>
    </div>

    <div class="scroll">
      <!-- El lugar de la mascota. Vacio a proposito: se reserva, no se rellena. -->
      <div class="mascota-slot" aria-hidden="true"></div>

      <div class="card stack">
        <span class="pill pill-reward" style="align-self:flex-start">Pronto</span>
        <h2>Trivia del camionero</h2>
        <p class="muted">
          Preguntas del oficio y de cultura general argentina: rutas y distancias,
          marcas y modelos, señalización, provincias, fútbol. Rápida, de a una,
          con respuesta al instante.
        </p>
        <p class="muted">
          Las trivias y los desafíos van a dar EXP y bonos. Mientras tanto, la
          experiencia se gana manejando.
        </p>
      </div>

      <button class="btn btn-outline btn-duo btn-block" id="to-perfil">
        Ver mi progreso
      </button>
    </div>
  `);

  wire(host, {
    '#menu': openDrawer,
    '#to-perfil': () => go('perfil')
  });
}
