/**
 * Primera pantalla: de donde salen los datos.
 *
 * No es letra chica ni un tramite. Este producto decide por donde puede circular
 * un camion de treinta toneladas, y quien lo usa tiene derecho a saber que la
 * pertenencia a la Red sale de OpenStreetMap y no de una capa oficial, y que no
 * se modelan restricciones horarias porque no se encontro norma confirmada.
 *
 * Decir la limitacion no debilita al producto: es lo que lo vuelve confiable
 * frente a un GPS de autos que no avisa nada.
 */

import { html, raw, icon, wire } from '../ui.js';
import { savePrefs } from '../store.js';

export function onboardingView(host, { onDone }) {
  host.className = 'screen';
  host.innerHTML = html`
    <div class="scroll" style="gap:20px">
      <div class="stack-sm" style="padding-top:8px">
        <div style="color:var(--brand)">${raw(icon('truck', 40))}</div>
        <h1>Antes de arrancar</h1>
        <p class="hint" style="font-size:15px">
          Esta app calcula rutas según las medidas y el peso de tu camión. Para que
          puedas confiar en lo que te muestra, esto es de dónde sale cada dato.
        </p>
      </div>

      <div class="card">
        <div class="row">
          <span class="pill pill-ok">La norma</span>
        </div>
        <p style="font-size:14.5px">
          <b>Ley 2148 de la Ciudad</b>, artículos 9.10.1 y 9.10.5. Prohíbe circular
          fuera de la Red de Tránsito Pesado a los vehículos de más de 12 toneladas,
          y permite salir de ella <b>sólo para llegar al destino y volver</b>.
        </p>
        <p class="note-source">
          La Red son 205 km sobre 95 calles y avenidas, en 39 de los 48 barrios.
        </p>
      </div>

      <div class="card">
        <div class="row">
          <span class="pill pill-brand">El mapa</span>
        </div>
        <p style="font-size:14.5px">
          <b>OpenStreetMap</b>, bajo licencia ODbL. De ahí salen las calles, los
          gálibos de los puentes y los límites de peso declarados.
        </p>
        <p class="note-source">
          Nunca se usan datos de Google Maps ni de Waze.
        </p>
      </div>

      <div class="card" style="border-color:var(--warn)">
        <div class="row">
          <span class="pill pill-warn">${raw(icon('warning', 13))} Lo que no sabemos</span>
        </div>
        <p style="font-size:14.5px">
          El Gobierno de la Ciudad <b>no publica</b> la Red como dato abierto. Qué
          calle pertenece a la Red lo aporta la comunidad de OpenStreetMap: es una
          transcripción, no la fuente legal.
        </p>
        <p style="font-size:14.5px">
          <b>No se modelan restricciones por horario</b>, porque no encontramos una
          norma general confirmada. Si existe una en tu recorrido, la app no la sabe.
        </p>
      </div>

      <div class="card" style="border-color:var(--danger)">
        <p style="font-size:14.5px">
          <b>Manejás vos.</b> La app es una ayuda, no un permiso. La cartelería de la
          calle y lo que ves por el parabrisas mandan siempre por encima de lo que
          diga esta pantalla.
        </p>
      </div>

      <button class="btn btn-primary btn-block" id="accept">Entendido, empecemos</button>

      <p class="note-source" style="text-align:center">
        Datos de mapa © colaboradores de OpenStreetMap, bajo ODbL.
      </p>
    </div>
  `;

  wire(host, {
    '#accept': () => {
      savePrefs({ sourcesAccepted: true });
      onDone();
    }
  });
}
