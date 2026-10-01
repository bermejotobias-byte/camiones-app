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
import { state, setState } from '../store.js';
import { VEHICLE_TYPES } from './trucks.js';
import { insignia as insigniaDeLogro } from '../logros.js';
import { signOut } from '../api.js';
import {
  html, raw, icon, wire, q, render, withBusy, debounce, escapeHtml,
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

/**
 * Nacionalidades del catalogo inicial.
 *
 * Arranca por los paises desde donde entran camiones a la Argentina. La lista se
 * amplia agregando una linea; el servidor guarda el codigo de dos letras y no
 * valida contra esta lista, asi que sumar uno no requiere tocar el backend.
 */
const PAISES = [
  { code: 'AR', name: 'Argentina' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'PE', name: 'Perú' }
];

/**
 * Como se muestra cada pista del motor.
 *
 * Antes habia cuatro medallas de emoji fijas que no reflejaban nada: eran
 * decoracion. Ahora salen de las pistas reales —kilometraje, viajes, repartos,
 * nocturnos— con su escalon en curso.
 *
 * Los dibujos van como SVG y no como emoji: un emoji no se recolorea, no escala
 * parejo y se ve distinto en cada telefono.
 */
const TRACKS = {
  kilometraje: {
    name: 'Kilómetros',
    path: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'
  },
  viajes: {
    name: 'Viajes',
    path: '<path d="M6 21V4"/><path d="M6 4h12v8H6z"/>'
  },
  repartos: {
    name: 'Repartos',
    path: '<path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v8"/>'
  },
  nocturnos: {
    name: 'Nocturnos',
    path: '<path d="M18.5 14.5A7.5 7.5 0 0 1 9 5.2a7.5 7.5 0 1 0 9.5 9.3z"/>'
  }
};

/**
 * Dibujos de las cuatro cifras del resumen.
 *
 * Dos de ellos son EL MISMO trazo que la pista correspondiente —el camion de
 * kilometraje y el banderin de viajes—, a proposito: si el mismo concepto se
 * dibuja distinto en dos lugares de la misma pantalla, deja de leerse como el
 * mismo concepto. Los otros dos no tienen pista y son propios: el rayo de la
 * experiencia y el volante de las horas, que ademas es del oficio.
 *
 * Los tonos salen de la rampa fria y van EN ORDEN DE LECTURA, del violeta al
 * celeste. En una grilla de 2x2 se lee en zeta, asi que asignarlos corridos hace
 * que las cuatro fichas se vean como un degradado en diagonal y no como cuatro
 * colores sueltos. Con el orden mezclado se ve exactamente eso: colores sueltos.
 *
 * La unica atadura es el violeta: en el sistema ya significa recompensa —es el
 * de la insignia de nivel—, asi que va en la experiencia y en ningun otro lado.
 * Los otros tres no codifican nada; los que codifican son --ok, --warn y
 * --danger, que no entran aca.
 */
const RESUMEN = [
  { label: 'Experiencia', tone: 'var(--cool-4)', path: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>' },
  { label: 'Kilómetros',  tone: 'var(--cool-3)', path: TRACKS.kilometraje.path },
  { label: 'Viajes',      tone: 'var(--cool-2)', path: TRACKS.viajes.path },
  {
    label: 'Al volante',
    tone: 'var(--cool-1)',
    path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/>'
        + '<path d="M12 3v6.4M4.3 16.3l5.5-3.2M19.7 16.3l-5.5-3.2"/>'
  }
];

/**
 * Un renglon del resumen: el dibujo en su tono y el valor CON su unidad.
 *
 * No lleva etiqueta a proposito. En la referencia el resumen es lo mas liviano de
 * la pantalla —dibujo y valor, sin tarjeta ni borde— y la unidad va adentro del
 * valor: "120 EXP", "2 h 07". Con la unidad puesta, la etiqueta sobra; sin ella
 * habria que agregarla y el renglon dejaria de ser un renglon.
 */
const resumen = (i, valor) => `
  <div style="--tone:${RESUMEN[i].tone}" title="${RESUMEN[i].label}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RESUMEN[i].path}</svg>
    <b>${valor}</b>
  </div>`;

/**
 * Linea tipo MRZ, la del dorso de un pasaporte o una licencia.
 *
 * Es DECORATIVA y hay que decirlo: no codifica nada, nadie la lee y no sigue
 * ninguna norma. Esta porque en la referencia es el recurso que mas hace que algo
 * se sienta un documento — lo unico del dorso que no es un campo ni un codigo.
 *
 * Se arma con datos reales igual, y no con relleno inventado: si el dibujo dice
 * "documento", los caracteres tienen que ser los del titular. Todo lo que no sea
 * letra o numero se reemplaza por "<", que es como funciona el formato de verdad.
 */
const mrz = (profile) => {
  const limpio = (texto) => (texto ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')      // saca los acentos, como el formato real
    .replace(/[^A-Z0-9]/g, '');

  // Nacionalidad, apellido y nombre, como el formato real. El alias NO va: ya es
  // un campo de la credencial, y cuando coincide con el nombre —que pasa seguido—
  // la linea repite la misma palabra dos veces y se nota que es de adorno.
  const partes = [
    limpio(profile.nationality) || 'XX',
    limpio(profile.lastName),
    limpio(profile.firstName)
  ].filter(Boolean);

  return `${partes.join('<<')}`.padEnd(44, '<').slice(0, 44);
};

/**
 * Barra de progreso con el valor adentro.
 *
 * La clase `bar-started` la pinta de blanco: vacia el numero va gris. Es lo que
 * hace la referencia y tiene sentido — sobre el riel apagado un blanco pleno pesa
 * mas que el dato que esta contando.
 */
const barra = (porcentaje, valor, extra = '') => {
  const ancho = Math.max(0, Math.min(100, Math.round(porcentaje)));

  return `
    <div class="bar ${extra} ${ancho > 0 ? 'bar-started' : ''}">
      <div class="bar-fill" style="width:${ancho}%"></div>
      <span class="bar-value">${valor}</span>
    </div>`;
};

/**
 * Insignia de un logro: la compartida de logros.js, que trae el color por escalon
 * —rojo, violeta, dorado, celeste, como Duolingo— y el dibujo en pixel art. El
 * numero que pisa el dibujo es el objetivo del escalon en curso; si la pista esta
 * completa, lo hecho.
 */
const insignia = (t) => {
  const objetivo = t.currentGoal > 0 ? t.currentGoal : t.count;
  return insigniaDeLogro(t.code, t.tiersReached, objetivo, { tamanio: 64 });
};

/**
 * Bandera a partir del codigo de pais de dos letras.
 *
 * Las banderas no son caracteres propios: se arman con dos "indicadores
 * regionales", que son las letras A-Z corridas al bloque 1F1E6. Asi que AR se
 * convierte solo, sin tabla ni imagenes.
 *
 * En Windows no se dibujan y se ven las dos letras; en Android e iOS si. Por eso
 * al lado va igual el codigo, que se lee en cualquier lado.
 */
const bandera = (codigo) =>
  typeof codigo === 'string' && codigo.length === 2
    ? String.fromCodePoint(...[...codigo.toUpperCase()]
        .map((letra) => 0x1F1E6 + letra.charCodeAt(0) - 65))
    : '';

/**
 * Etiqueta del tipo de vehiculo.
 *
 * Llega como NUMERO, no como texto: el enum se serializa por su valor. Es la
 * misma trampa que hizo devolver 500 al endpoint de equipar, del otro lado.
 */
const tipoDeCamion = (valor) =>
  VEHICLE_TYPES.find((tipo) => tipo.value === Number(valor))?.label ?? '';

export function profileView(host, { go }) {
  let profile = null;
  let stats = null;
  let trips = [];

  // Nivel, meta y progreso llegan calculados del servidor. No se derivan aca: la
  // regla vive en el dominio y el cliente solo la muestra.
  let progress = null;

  // Las pistas del motor: cada una es una meta en curso y un logro a la vez.
  let tracks = [];

  // Para elegir cual se exhibe en el perfil.
  let trucks = [];
  let tab = 'perfil';         // 'perfil' | 'historial'

  host.className = 'screen';

  async function load() {
    render(host, shell(html`<div class="center-note"><span class="spinner"></span></div>`));
    attachTop();

    try {
      [profile, stats, trips, progress, tracks, trucks] = await Promise.all([
        api.profile(),
        api.tripStats(),
        api.trips(20),
        api.progress(),
        api.progressTracks(),
        api.trucks()
      ]);

      setState({ profile });
      draw();
    } catch (error) {
      render(host, shell(html`<div class="center-note">${error.message}</div>`));
      attachTop();
    }
  }

  /**
   * En la referencia la barra superior y la banda de color son UN solo bloque: el
   * nombre y los controles viven adentro del color, sin costura. Por eso en la
   * pestaña del perfil la barra toma la clase de la banda y el titulo es el nombre
   * del camionero, no "Mi perfil": el titulo de una pantalla de perfil es de quien
   * es el perfil.
   */
  const shell = (body) => html`
    <div class="topbar ${tab === 'perfil' ? 'topbar-band' : ''}">
      <button class="fab" id="back" aria-label="Volver">${raw(icon('back', 20))}</button>
      <h2>${tab === 'perfil' ? nombreVisible() : 'Mis viajes'}</h2>
    </div>
    ${raw(body)}
  `;

  const nombreVisible = () => {
    const nombre = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();
    return nombre || profile?.alias || 'Mi perfil';
  };

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
    // Los kilometros del nivel salen de la progresion, no de las estadisticas:
    // son el mismo total pero calculado por quien manda sobre el nivel.
    const km = progress?.kilometers ?? 0;
    const avatar = AVATARS.find((a) => a.id === profile.avatarId) ?? AVATARS[0];

    // Los campos de la credencial. Son los mismos datos de identidad que antes
    // iban en dos renglones sueltos; puestos como campos etiquetados se entiende
    // que cosa es cada uno, que es justamente lo que un documento resuelve.
    //
    // Todos van escapados: el nombre del camion lo escribe el usuario y el bloque
    // se inserta con raw(), que no escapa nada.
    //
    // Lo que falta se dice, no se esconde: un campo vacio en una credencial es
    // informacion —"esto todavia no lo cargaste"— y ademas mantiene la altura
    // estable, asi que la foto no se mueve al completar el perfil.
    const campos = [
      ['Alias', profile.alias ? `@${escapeHtml(profile.alias)}` : '—'],
      ['País', profile.nationality
        ? escapeHtml(PAISES.find((pais) => pais.code === profile.nationality)?.name ?? profile.nationality)
        : 'Sin declarar'],
      ['Camión', profile.activeTruckName ? escapeHtml(profile.activeTruckName) : 'Ninguno'],
      ['Tipo', profile.activeTruckName ? escapeHtml(tipoDeCamion(profile.activeTruckType)) : '—']
    ];

    const logrados = tracks.reduce((suma, t) => suma + (t.tiersReached ?? 0), 0);

    // Lo que falta para que el perfil este completo. La tarjeta existe SOLO
    // mientras esta lista tenga algo: en la referencia desaparece al completarse,
    // y una tarjeta que felicita por algo ya hecho ocupa el lugar de lo proximo.
    const faltan = [
      !profile.firstName && 'nombre',
      !profile.nationality && 'nacionalidad',
      !profile.birthDate && 'nacimiento',
      !profile.activeTruckId && 'camion'
    ].filter(Boolean);

    return html`
      <div class="scroll">
        <!-- El bloque del avatar con el lenguaje de las dos referencias de
             licencia: trama de seguridad, foto enmarcada, campos etiquetados,
             banda inferior segmentada y linea tipo MRZ.

             Sigue siendo el PERFIL, no el carnet: lo que se toma es como se ve un
             documento, no que datos lleva. Son dos pantallas distintas. -->
        <div class="profile-band">
          <div class="carnet-row">
            <div class="carnet-fields">
              ${raw(campos.map(([etiqueta, valor]) =>
                `<div class="carnet-field"><span>${etiqueta}</span> ${valor}</div>`).join(''))}
            </div>

            <div class="carnet-photo">
              <div>${avatar.glyph}</div>
              <b>${raw(profile.nationality
                    ? `${bandera(profile.nationality)} ${escapeHtml(profile.nationality)}`
                    : 'Sin país')}</b>
            </div>
          </div>

          <div class="carnet-strip">
            <span>Camionero</span>
            <span>${progress.levelName}</span>
            <span>Desde ${new Date(profile.createdAt).getFullYear()}</span>
          </div>

          <div class="carnet-mrz" aria-hidden="true">${mrz(profile)}</div>
        </div>

        <div class="figures">
          <div><b>${km.toLocaleString('es-AR')}</b><span>Kilómetros</span></div>
          <div><b>${stats?.completedTrips ?? 0}</b><span>Viajes</span></div>
          <div><b>${logrados}</b><span>Logros</span></div>
        </div>

        <button class="btn btn-outline btn-duo btn-block" id="to-history">
          ${raw(icon('history', 18))} Ver mis viajes
        </button>

        ${raw(faltan.length > 0
          ? `<div class="card complete-card">
               <div class="stack-sm" style="gap:2px">
                 <b style="font-size:17px">¡Completá tu perfil!</b>
                 <p class="profile-meta">${faltan.length === 1
                    ? 'Queda 1 paso'
                    : `Quedan ${faltan.length} pasos`}</p>
               </div>
               <button class="btn btn-accent btn-duo btn-block" id="to-form">Continuar</button>
             </div>`
          : '')}

        <div class="stack-sm">
          <!-- Sin los kilometros al costado: los dice el resumen tres bloques
               mas abajo, y el mismo numero dos veces en una pantalla hace dudar
               de si son el mismo numero. -->
          <p class="section-caps">Nivel ${progress.level} · ${progress.levelName}</p>

          <b style="font-size:17px">
            ${raw(progress.nextLevelName
              ? `Te faltan <span class="accent-num">${
                   progress.kilometersToNextLevel.toLocaleString('es-AR')} km</span> para ${
                   progress.nextLevelName}`
              : 'Llegaste al último nivel. No es poca cosa.')}
          </b>

          <!-- La unica barra cromada de la app. Ver .bar-chrome en app.css. -->
          ${raw(barra(
            progress.progressInLevel * 100,
            `${progress.nextLevelName ? progress.goalInLevel - 1 : progress.goalsPerLevel} / ${progress.goalsPerLevel}`,
            'bar-chrome'))}
        </div>

        <p class="section-caps">Resumen</p>

        <div class="summary">
          ${raw(resumen(0, `${(progress.experience ?? 0).toLocaleString('es-AR')} EXP`))}
          ${raw(resumen(1, `${km.toLocaleString('es-AR')} km`))}
          ${raw(resumen(2, `${stats?.completedTrips ?? 0} ${(stats?.completedTrips ?? 0) === 1 ? 'viaje' : 'viajes'}`))}
          ${raw(resumen(3, formatDuration(stats?.drivenSeconds ?? 0)))}
        </div>

        <p class="section-caps">Metas</p>

        <div class="stack">
          ${raw(tracks.map((t) => {
            const meta = TRACKS[t.code];
            if (!meta) return '';

            const porcentaje = t.currentGoal > 0
              ? Math.min(100, Math.round((t.count / t.currentGoal) * 100))
              : 100;

            return `
              <div class="goal">
                <div class="row-between">
                  <span class="section-caps">${meta.name}</span>
                  <span class="section-caps">${t.tiersReached} / ${t.totalTiers}</span>
                </div>
                ${barra(
                  porcentaje,
                  `${t.count.toLocaleString('es-AR')} / ${t.currentGoal.toLocaleString('es-AR')}`)}
              </div>`;
          }).join(''))}
        </div>

        <p class="section-caps">Logros</p>

        <div class="badges">
          ${raw(tracks.map((t) => insignia(t)).join(''))}
        </div>

        <p class="hint">Se desbloquean manejando y aportando datos a la comunidad.</p>

        <p class="section-caps" style="margin-top:8px">Datos de la cuenta</p>

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

          <div class="stat-grid" style="gap:10px">
            <div class="field">
              <label for="birthDate">Nacimiento</label>
              <!-- Va como fecha nativa: el telefono pone su selector y manda
                   AAAA-MM-DD, que es lo que el servidor espera. Solo la ve el
                   dueño; el carnet la muestra, el perfil publico no. -->
              <input class="input" id="birthDate" type="date"
                     value="${profile.birthDate ?? ''}" max="${new Date().toISOString().slice(0, 10)}">
            </div>

            <div class="field">
              <label for="nationality">Nacionalidad</label>
              <select class="input" id="nationality">
                <option value="">Sin declarar</option>
                ${raw(PAISES.map((pais) => `
                  <option value="${pais.code}" ${profile.nationality === pais.code ? 'selected' : ''}>
                    ${bandera(pais.code)} ${pais.name}
                  </option>`).join(''))}
              </select>
            </div>
          </div>

          <div class="field">
              <label for="activeTruck">Camión que exhibís</label>
              <select class="input" id="activeTruck">
                <option value="">Ninguno</option>
                ${raw(trucks.map((camion) => `
                  <option value="${camion.id}" ${profile.activeTruckId === camion.id ? 'selected' : ''}>
                    ${escapeHtml(camion.name)}
                  </option>`).join(''))}
              </select>
          </div>

          <div class="field">
            <label>Avatar</label>
            <div class="badges" id="avatars">
              ${raw(AVATARS.map((option) => `
                <button type="button" class="badge ${option.id === avatar.id ? 'badge-picked' : ''}"
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

      // La tarjeta de completar el perfil lleva al formulario, que esta mas abajo
      // en la misma pantalla. Enfoca el primer campo que falta: llevar hasta ahi y
      // dejar que el usuario busque cual era seria la mitad del trabajo.
      // Con "?": el boton existe solo mientras falten pasos del perfil.
      '#to-form?': () => {
        const primero = q(host, '#form')?.querySelector('input:placeholder-shown, select');
        q(host, '#form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        primero?.focus({ preventScroll: true });
      },

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
          avatarId: chosenAvatar,
          nationality: q(host, '#nationality').value || null,
          birthDate: q(host, '#birthDate').value || null,

          // El servidor rechaza un camion que no sea propio o del catalogo, asi
          // que aca no hace falta validar: alcanza con mandar lo elegido.
          activeTruckId: q(host, '#activeTruck').value || null
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
        .forEach((node) => node.classList.toggle('badge-picked', node === button));
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
