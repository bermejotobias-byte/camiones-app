/**
 * Perfil, progresion e historial.
 *
 * Es la pantalla del registro expresivo: acá entran el color de recompensa, la
 * barra de nivel y las medallas. Nada de esto aparece en el mapa mientras se
 * maneja — un GPS que distrae a alguien que lleva treinta toneladas es un
 * producto peligroso, y esa separación es de diseño, no de estilo.
 *
 * Los niveles se ganan sólo con kilómetros, así que no se pueden comprar.
 */

import { api } from '../api.js';
import { state, setState, levelFor } from '../store.js';
import { signOut } from '../api.js';
import {
  html, raw, icon, wire, q, render, withBusy, debounce,
  formatDistance, formatDuration, formatDate, toastOk, toastError, askConfirm
} from '../ui.js';

/**
 * Avatares del catalogo inicial.
 *
 * El documento pide predeterminados con distintos tonos de piel, uno con gorrita,
 * otro con pelo degrade y uno mas formal. Se guardan por identificador y no por
 * imagen, asi que cambiar el dibujo despues no toca la base.
 */
const AVATARS = [
  { id: 'gorrita-1', glyph: '🧢' },
  { id: 'clasico-1', glyph: '👨🏻' },
  { id: 'clasico-2', glyph: '👨🏽' },
  { id: 'clasico-3', glyph: '👨🏿' },
  { id: 'clasica-1', glyph: '👩🏽' },
  { id: 'formal-1', glyph: '🕴️' },
  { id: 'barba-1', glyph: '🧔🏽' },
  { id: 'mate-1', glyph: '🧉' }
];

const LOCKED_BADGES = [
  { glyph: '🌙', label: 'Nocturno' },
  { glyph: '🛞', label: 'Rodado' },
  { glyph: '👽', label: 'Edición especial' }
];

export function profileView(host, { go }) {
  let profile = null;
  let stats = null;
  let trips = [];
  let tab = 'perfil';         // 'perfil' | 'historial'

  host.className = 'screen';

  async function load() {
    render(host, shell(html`<div class="center-note"><span class="spinner"></span></div>`));
    attachTop();

    try {
      [profile, stats, trips] = await Promise.all([
        api.profile(),
        api.tripStats(),
        api.trips(20)
      ]);

      setState({ profile });
      draw();
    } catch (error) {
      render(host, shell(html`<div class="center-note">${error.message}</div>`));
      attachTop();
    }
  }

  const shell = (body) => html`
    <div class="topbar">
      <button class="fab" id="back" aria-label="Volver">${raw(icon('back', 20))}</button>
      <h2>${tab === 'perfil' ? 'Mi perfil' : 'Mis viajes'}</h2>
    </div>
    ${raw(body)}
  `;

  const attachTop = () => wire(host, { '#back': () => go('mapa') });

  function draw() {
    render(host, shell(tab === 'perfil' ? profileMarkup() : historyMarkup()));
    attachTop();
    tab === 'perfil' ? attachProfile() : attachHistory();
  }

  /* ------------------------------------------------------------------------
     Perfil y progresion
  ------------------------------------------------------------------------ */

  function profileMarkup() {
    const km = stats?.creditedKilometers ?? 0;
    const level = levelFor(km);
    const avatar = AVATARS.find((a) => a.id === profile.avatarId) ?? AVATARS[0];

    return html`
      <div class="scroll">
        <div class="card" style="align-items:center;text-align:center;gap:14px">
          <div class="avatar avatar-lg">${avatar.glyph}</div>

          <div class="stack-sm" style="gap:2px">
            <h2>${profile.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : 'Camionero'}</h2>
            <p class="muted">${profile.alias ? `@${profile.alias}` : 'Todavía no elegiste alias'}</p>
          </div>

          <div class="stack-sm" style="width:100%">
            <div class="row-between">
              <span class="pill pill-reward">Nivel ${level.number} · ${level.name}</span>
              <span class="muted num">${km.toLocaleString('es-AR')} km</span>
            </div>
            <div class="level-track">
              <div class="level-fill" style="width:${Math.round(level.progress * 100)}%"></div>
            </div>
            <p class="hint">
              ${level.nextName
                ? `Te faltan ${level.remaining.toLocaleString('es-AR')} km para ${level.nextName}.`
                : 'Llegaste al último nivel. No es poca cosa.'}
            </p>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat"><b class="num">${stats?.totalTrips ?? 0}</b><span>Viajes</span></div>
          <div class="stat"><b class="num">${stats?.completedTrips ?? 0}</b><span>Completados</span></div>
          <div class="stat"><b class="num">${km.toLocaleString('es-AR')}</b><span>Kilómetros</span></div>
          <div class="stat"><b class="num">${formatDuration(stats?.drivenSeconds ?? 0)}</b><span>Al volante</span></div>
        </div>

        <div class="stack-sm">
          <h3>Logros</h3>
          <div class="badges">
            <div class="badge ${stats?.completedTrips > 0 ? 'badge-earned' : 'badge-locked'}"
                 title="Primer viaje">🏁</div>
            ${raw(LOCKED_BADGES.map((badge) =>
              `<div class="badge badge-locked" title="${badge.label}">${badge.glyph}</div>`).join(''))}
          </div>
          <p class="hint">Se desbloquean manejando y aportando datos a la comunidad.</p>
        </div>

        <button class="btn btn-block" id="to-history">
          ${raw(icon('history', 20))} Ver mis viajes
        </button>

        <h3 style="margin-top:8px">Datos de la cuenta</h3>

        <form class="stack" id="form" novalidate>
          <div class="field">
            <label for="alias">Alias</label>
            <input class="input" id="alias" value="${profile.alias ?? ''}"
                   placeholder="elgaucho" maxlength="20" autocapitalize="off" autocorrect="off">
            <p class="hint" id="alias-hint">
              Es único e irrepetible. Letras, números, punto y guion bajo.
            </p>
          </div>

          <div class="stat-grid" style="gap:10px">
            <div class="field">
              <label for="firstName">Nombre</label>
              <input class="input" id="firstName" value="${profile.firstName ?? ''}" maxlength="80">
            </div>
            <div class="field">
              <label for="lastName">Apellido</label>
              <input class="input" id="lastName" value="${profile.lastName ?? ''}" maxlength="80">
            </div>
          </div>

          <div class="field">
            <label>Avatar</label>
            <div class="badges" id="avatars">
              ${raw(AVATARS.map((option) => `
                <button type="button" class="badge ${option.id === avatar.id ? 'badge-earned' : ''}"
                        data-avatar="${option.id}">${option.glyph}</button>
              `).join(''))}
            </div>
          </div>

          <p class="error" id="error" hidden></p>

          <button class="btn btn-primary btn-block" type="submit" id="save">Guardar</button>
        </form>

        <p class="hint" style="text-align:center">
          ${profile.email}${profile.emailConfirmed ? ' · verificado' : ''}
        </p>

        <button class="btn btn-ghost btn-block" id="signout">Cerrar sesión</button>
      </div>
    `;
  }

  function attachProfile() {
    let chosenAvatar = profile.avatarId ?? AVATARS[0].id;

    wire(host, {
      '#to-history': () => { tab = 'historial'; draw(); },

      '#signout': async () => {
        const salir = await askConfirm({
          title: '¿Cerrás sesión?',
          message: 'Tus viajes y kilómetros quedan guardados en tu cuenta.',
          confirmLabel: 'Cerrar sesión',
          cancelLabel: 'Quedarme',
          danger: true
        });

        if (!salir) return;

        signOut();
        location.reload();
      },

      // Consulta en vivo: es mejor enterarse de que el alias esta tomado mientras
      // se escribe que despues de tocar Guardar.
      '#alias@input': debounce(async (event) => {
        const alias = event.target.value.trim();
        const hint = q(host, '#alias-hint');

        if (alias.length < 3) {
          hint.textContent = 'Es único e irrepetible. Letras, números, punto y guion bajo.';
          hint.style.color = '';
          return;
        }

        try {
          const result = await api.aliasAvailable(alias);
          hint.textContent = result.available ? 'Disponible.' : result.reason;
          hint.style.color = result.available ? 'var(--ok)' : 'var(--danger)';
        } catch {
          // Sin conexion no se bloquea: el servidor decide al guardar.
        }
      }, 400),

      '#form@submit': async (event) => {
        event.preventDefault();

        const error = q(host, '#error');
        error.hidden = true;

        const payload = {
          alias: q(host, '#alias').value.trim() || null,
          firstName: q(host, '#firstName').value.trim() || null,
          lastName: q(host, '#lastName').value.trim() || null,
          avatarId: chosenAvatar
        };

        await withBusy(q(host, '#save'), 'Guardando', async () => {
          try {
            profile = await api.saveProfile(payload);
            setState({ profile });
            toastOk('Perfil guardado.');
            draw();
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
          }
        });
      }
    });

    q(host, '#avatars').addEventListener('click', (event) => {
      const button = event.target.closest('[data-avatar]');
      if (!button) return;

      chosenAvatar = button.dataset.avatar;

      q(host, '#avatars').querySelectorAll('.badge')
        .forEach((node) => node.classList.toggle('badge-earned', node === button));
    });
  }

  /* ------------------------------------------------------------------------
     Historial
  ------------------------------------------------------------------------ */

  function historyMarkup() {
    if (!trips.length) {
      return html`
        <div class="scroll">
          <div class="empty">
            ${raw(icon('route', 40))}
            <b>Todavía no hiciste ningún viaje</b>
            <p class="hint">Cuando arranques uno desde el mapa, va a quedar acá con
            sus kilómetros.</p>
          </div>
          <button class="btn btn-primary btn-block" id="to-map">Ir al mapa</button>
        </div>
      `;
    }

    return html`
      <div class="scroll">
        ${raw(trips.map(tripCard).join(''))}
        <p class="note-source" style="text-align:center">
          Los kilómetros se acreditan al llegar, si pasó al menos la mitad del
          tiempo estimado.
        </p>
      </div>
    `;
  }

  const STATUS = {
    Completed: { label: 'Completado', pill: 'pill-ok' },
    Cancelled: { label: 'Abandonado', pill: 'pill-danger' },
    InProgress: { label: 'En curso', pill: 'pill-brand' }
  };

  const tripCard = (trip) => {
    const status = STATUS[trip.status] ?? STATUS.InProgress;
    const credited = trip.creditedDistanceMeters > 0;

    return `
      <div class="card">
        <div class="row-between">
          <span class="pill ${status.pill}">${status.label}</span>
          <span class="muted">${formatDate(trip.startedAt)}</span>
        </div>

        <div class="stack-sm">
          <div class="row">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--origin);flex:none"></span>
            <span class="grow truncate" style="font-size:14px">${escapeText(trip.originLabel ?? 'Punto en el mapa')}</span>
          </div>
          <div class="row">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--destination);flex:none"></span>
            <span class="grow truncate" style="font-size:14px">${escapeText(trip.destinationLabel ?? 'Punto en el mapa')}</span>
          </div>
        </div>

        <div class="row-between">
          <span class="muted">${escapeText(trip.truckName)}</span>
          <span class="num" style="font-weight:700;color:${credited ? 'var(--brand-ink)' : 'var(--ink-3)'}">
            ${credited ? `+${formatDistance(trip.creditedDistanceMeters)}` : formatDistance(trip.plannedDistanceMeters)}
          </span>
        </div>

        ${!credited && trip.status === 'Completed'
          ? '<p class="note-source">No sumó kilómetros: pasó menos de la mitad del tiempo estimado.</p>'
          : ''}
      </div>
    `;
  };

  function attachHistory() {
    // Desde el historial, Volver regresa al perfil y no al mapa.
    q(host, '#back').onclick = () => { tab = 'perfil'; draw(); };

    const toMap = q(host, '#to-map');
    if (toMap) toMap.addEventListener('click', () => go('mapa'));
  }

  load();
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
