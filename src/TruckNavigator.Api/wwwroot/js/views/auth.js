/**
 * Alta, verificacion e ingreso.
 *
 * Tres estados en una sola pantalla en vez de tres pantallas: entrar, crear
 * cuenta y "revisa tu mail". Cambiar entre ellos no navega, asi que el usuario
 * nunca pierde lo que ya escribio.
 */

import { api, ApiError } from '../api.js';
import { html, raw, icon, wire, q, withBusy, toastOk, toastError } from '../ui.js';

/**
 * El ALTA de una cuenta, y el "revisa tu correo" que la sigue.
 *
 * El INGRESO ya no esta aca: desde el 30/09/2026 vive en entrada/acceso.js,
 * con el tablero del prototipo. Dos formularios de ingreso serian dos
 * formularios que se desincronizan; la traduccion de los errores de Identity
 * sigue viviendo en este archivo y la usan los dos.
 *
 * `onVolverAEntrar` es como se sale de aca sin haberse dado de alta.
 */
export function authView(host, { onSignedIn, onVolverAEntrar }) {
  let mode = 'signup';        // 'signup' | 'check-inbox'
  let pendingEmail = '';

  host.className = 'screen';

  function draw() {
    host.innerHTML = mode === 'check-inbox' ? inboxMarkup() : formMarkup();
    attach();
  }

  // --- "revisa tu mail" ------------------------------------------------------

  const inboxMarkup = () => html`
    <div class="scroll" style="gap:18px">
      <div class="stack-sm" style="padding-top:24px">
        <div style="color:var(--brand)">${raw(icon('info', 40))}</div>
        <h1>Revisá tu correo</h1>
        <p class="hint" style="font-size:15px">
          Le mandamos un enlace a <b>${pendingEmail}</b>. Tocalo para activar la
          cuenta y después volvé acá para entrar.
        </p>
      </div>

      <div class="card">
        <p class="hint">
          Sin confirmar el correo la cuenta no se activa. Si no llega, fijate en la
          carpeta de spam.
        </p>
      </div>

      <button class="btn btn-block" id="resend">Reenviar el enlace</button>
      <button class="btn btn-primary btn-block" id="to-signin">Ya lo confirmé, entrar</button>
    </div>
  `;

  // --- alta e ingreso --------------------------------------------------------

  const formMarkup = () => {
    return html`
      <div class="scroll" style="gap:18px">
        <div class="stack-sm" style="padding-top:24px">
          <div style="color:var(--brand)">${raw(icon('truck', 40))}</div>
          <h1>Creá tu cuenta</h1>
          <p class="hint" style="font-size:15px">
            Con una cuenta se guardan tus camiones, tus viajes y tus kilómetros.
          </p>
        </div>

        <form class="stack" id="form" novalidate>
          <div class="field">
            <label for="email">Correo</label>
            <input class="input" id="email" type="email" inputmode="email"
                   autocomplete="email" placeholder="vos@ejemplo.com" required>
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <input class="input" id="password" type="password"
                   autocomplete="new-password"
                   placeholder="Al menos 8 caracteres y un número" required>
            <p class="hint">Mínimo 8 caracteres, con al menos un número. No hacen falta símbolos ni mayúsculas.</p>
          </div>

          <p class="error" id="error" hidden></p>

          <button class="btn btn-primary btn-duo btn-block brillo" type="submit" id="submit">
            Crear cuenta
          </button>
        </form>

        <button class="btn btn-ghost btn-block" id="switch">
          Ya tengo cuenta
        </button>
      </div>
    `;
  };

  // --- comportamiento --------------------------------------------------------

  function showError(message) {
    const node = q(host, '#error');
    if (!node) return;

    node.textContent = message;
    node.hidden = false;
  }

  function attach() {
    if (mode === 'check-inbox') {
      wire(host, {
        '#resend': async (event) => {
          await withBusy(event.currentTarget, 'Enviando', async () => {
            try {
              await api.resendConfirmation(pendingEmail);
              toastOk('Listo, te lo mandamos de nuevo.');
            } catch (error) {
              toastError(error.message);
            }
          });
        },
        '#to-signin': () => onVolverAEntrar?.()
      });

      return;
    }

    wire(host, {
      '#switch': () => onVolverAEntrar?.(),


      '#form@submit': async (event) => {
        event.preventDefault();

        const email = q(host, '#email').value.trim();
        const password = q(host, '#password').value;
        const button = q(host, '#submit');

        q(host, '#error').hidden = true;

        if (!email || !password) {
          showError('Completá el correo y la contraseña.');
          return;
        }

        await withBusy(button, 'Creando', async () => {
          try {
            await api.register(email, password);
            pendingEmail = email;
            mode = 'check-inbox';
            draw();
          } catch (error) {
            showError(mensajeDeIngreso(error, 'signup'));
          }
        });
      }
    });
  }

  draw();
}

/**
 * Traduce los errores de Identity a algo accionable.
 *
 * Identity responde en ingles y con codigos propios; "NotAllowed" en particular
 * significa que falta confirmar el correo, que es la causa mas frecuente de que
 * alguien no pueda entrar y la que menos se adivina.
 *
 * Se exporta porque el ingreso vive en entrada/acceso.js desde el 30/09/2026 y
 * el alta sigue aca: dos pantallas, una sola traduccion. Escribirla de nuevo del
 * otro lado seria tener dos, y una se quedaria vieja.
 */
export function mensajeDeIngreso(error, mode) {
  if (!(error instanceof ApiError)) return error.message;

  const body = JSON.stringify(error.problem ?? '');

  if (body.includes('NotAllowed')) {
    return 'Todavía no confirmaste el correo. Buscá el enlace que te mandamos.';
  }

  if (body.includes('LockedOut')) {
    return 'Demasiados intentos fallidos. Probá de nuevo en 15 minutos.';
  }

  if (error.status === 401) {
    return 'El correo o la contraseña no coinciden.';
  }

  if (body.includes('DuplicateUserName') || body.includes('DuplicateEmail')) {
    return 'Ya existe una cuenta con ese correo. Probá entrando.';
  }

  if (body.includes('PasswordTooShort')) {
    return 'La contraseña necesita al menos 8 caracteres.';
  }

  if (body.includes('PasswordRequiresDigit')) {
    return 'La contraseña necesita al menos un número.';
  }

  if (mode === 'signup' && error.status === 400) {
    return error.message || 'Revisá el correo y la contraseña.';
  }

  return error.message;
}
