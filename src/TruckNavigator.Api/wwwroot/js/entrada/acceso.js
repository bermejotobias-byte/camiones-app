/**
 * Paso 4 de la entrada: el acceso.
 *
 * El tablero "Entrar" del prototipo: la luz celeste, el titulo, el mono con su
 * globo al costado, y la tarjeta de VIDRIO con correo, contraseña y el boton. El
 * campo con foco se enciende con neon, que es el unico neon de la pantalla.
 *
 * Y la accion que el tablero no tiene, porque se decidio despues: "Probar sin
 * cuenta", separada de las otras dos para que no compita con la principal.
 *
 * El ALTA no esta aca: sigue en views/auth.js, junto con "revisa tu correo". Dos
 * formularios de ingreso serian dos formularios que se desincronizan. Por lo
 * mismo, los errores se traducen con `mensajeDeIngreso`, que es la unica
 * traduccion y vive alla.
 */

import { html, raw, render, wire, toastOk, toastError, withBusy } from '../ui.js';
import { mascota } from '../mascota.js';
import { api } from '../api.js';
import { savePrefs } from '../store.js';
import { mensajeDeIngreso } from '../views/auth.js';

export function accesoView(host, { onEntro, onCrearCuenta, onInvitado }) {
  host.className = 'screen';

  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-brand"></div>

      <div class="entrada-cuerpo" style="align-items:stretch;gap:12px">
        <span class="section-caps entrada-rotulo" style="text-align:left">Navegador de tránsito pesado · CABA</span>
        <h1 class="entrada-titulo" style="text-align:left;font-size:30px">Hola de nuevo,<br><span>compañero.</span></h1>

        <div class="mono-globo">
          <div class="mono-suelto">${raw(mascota('saludo', { escala: 2.3 }))}</div>
          <div class="globo globo-lado">
            <span class="pill chip-accent">Entrar</span>
            <b>¿Salimos?</b>
            <p>Entrá y te devuelvo tu camión y tus kilómetros.</p>
          </div>
        </div>
      </div>

      <div class="entrada-acciones">
        <form class="vidrio entrada-tarjeta" id="form" novalidate>
          <div class="field">
            <label for="correo">Correo</label>
            <input class="input" id="correo" type="email" inputmode="email"
                   autocomplete="email" placeholder="vos@ejemplo.com" required>
          </div>

          <div class="field">
            <label for="clave">Contraseña</label>
            <input class="input" id="clave" type="password"
                   autocomplete="current-password" placeholder="••••••••" required>
          </div>

          <p class="error" id="error" hidden></p>

          <button class="btn btn-primary btn-duo btn-block brillo" type="submit" id="entrar">Entrar</button>
        </form>

        <div class="entrada-secundarias">
          <button class="enlace" id="crear">Crear una cuenta</button>
          <button class="enlace hint" id="olvide">¿Olvidaste la contraseña?</button>
        </div>

        <button class="btn btn-outline btn-duo btn-block" id="invitado">Probar sin cuenta</button>
      </div>
    </div>
  `);

  const campo = (id) => host.querySelector(`#${id}`);

  function mostrarError(mensaje) {
    const nodo = host.querySelector('#error');
    nodo.textContent = mensaje;
    nodo.hidden = false;
  }

  wire(host, {
    '#form@submit': async (event) => {
      event.preventDefault();

      const correo = campo('correo').value.trim();
      const clave = campo('clave').value;

      host.querySelector('#error').hidden = true;

      if (!correo || !clave) {
        mostrarError('Completá el correo y la contraseña.');
        return;
      }

      await withBusy(campo('entrar'), 'Entrando', async () => {
        try {
          await api.signIn(correo, clave);
          onEntro();
        } catch (error) {
          mostrarError(mensajeDeIngreso(error, 'signin'));
        }
      });
    },

    '#crear': onCrearCuenta,

    // Se muda TAL CUAL de auth.js, incluido su cuidado: responder distinto segun
    // si el correo existe permitiria averiguar quien tiene cuenta.
    '#olvide': async () => {
      const correo = campo('correo').value.trim();

      if (!correo) {
        mostrarError('Escribí tu correo primero y volvé a tocar acá.');
        return;
      }

      try {
        await api.forgotPassword(correo);
      } catch {
        // A proposito en silencio, por lo mismo.
      }

      toastOk('Si esa cuenta existe, le llegó un enlace para cambiar la clave.');
    },

    // El invitado queda sellado aca: desde este momento corre su dia.
    '#invitado': () => {
      savePrefs({ invitadoDesde: new Date().toISOString() });
      onInvitado();
    }
  });
}
