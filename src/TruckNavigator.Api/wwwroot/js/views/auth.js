/**
 * Alta, verificacion e ingreso.
 *
 * Tres estados en una sola pantalla en vez de tres pantallas: entrar, crear
 * cuenta y "revisa tu mail". Cambiar entre ellos no navega, asi que el usuario
 * nunca pierde lo que ya escribio.
 */

import { api, ApiError } from '../api.js';
import { html, raw, icon, wire, q, withBusy, toastOk, toastError } from '../ui.js';

export function authView(host, { onSignedIn }) {
  let mode = 'signin';        // 'signin' | 'signup' | 'check-inbox'
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
    const signup = mode === 'signup';

    return html`
      <div class="scroll" style="gap:18px">
        <div class="stack-sm" style="padding-top:24px">
          <div style="color:var(--brand)">${raw(icon('truck', 40))}</div>
          <h1>${signup ? 'Creá tu cuenta' : 'Entrá'}</h1>
          <p class="hint" style="font-size:15px">
            ${signup
              ? 'Con una cuenta se guardan tus camiones, tus viajes y tus kilómetros.'
              : 'Bienvenido de vuelta.'}
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
                   autocomplete="${signup ? 'new-password' : 'current-password'}"
                   placeholder="${signup ? 'Al menos 8 caracteres y un número' : '••••••••'}" required>
            ${signup
              ? raw('<p class="hint">Mínimo 8 caracteres, con al menos un número. No hacen falta símbolos ni mayúsculas.</p>')
              : ''}
          </div>

          <p class="error" id="error" hidden></p>

          <button class="btn btn-primary btn-block" type="submit" id="submit">
            ${signup ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <button class="btn btn-ghost btn-block" id="switch">
          ${signup ? 'Ya tengo cuenta' : 'No tengo cuenta, quiero crear una'}
        </button>

        ${signup ? '' : raw('<button class="btn btn-ghost btn-block" id="forgot">Olvidé mi contraseña</button>')}
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
        '#to-signin': () => {
          mode = 'signin';
          draw();
        }
      });

      return;
    }

    wire(host, {
      '#switch': () => {
        mode = mode === 'signup' ? 'signin' : 'signup';
        draw();
      },

      '#forgot?': async () => {
        const email = q(host, '#email').value.trim();

        if (!email) {
          showError('Escribí tu correo primero y volvé a tocar acá.');
          return;
        }

        try {
          await api.forgotPassword(email);
        } catch {
          // Se ignora a proposito: responder distinto segun si el correo existe
          // permitiria averiguar quien tiene cuenta.
        }

        toastOk('Si esa cuenta existe, le llegó un enlace para cambiar la clave.');
      },

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

        await withBusy(button, mode === 'signup' ? 'Creando' : 'Entrando', async () => {
          try {
            if (mode === 'signup') {
              await api.register(email, password);
              pendingEmail = email;
              mode = 'check-inbox';
              draw();
              return;
            }

            await api.signIn(email, password);
            onSignedIn();
          } catch (error) {
            showError(translate(error, mode));
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
 */
function translate(error, mode) {
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
