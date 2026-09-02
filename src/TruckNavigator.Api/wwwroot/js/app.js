/**
 * Arranque, ruteo entre pantallas y menu lateral.
 *
 * El ruteo va por hash y no por path a proposito: asi la misma app funciona
 * igual servida por HTTP que cargada desde file:///android_asset/ adentro del
 * WebView, sin necesitar un fallback en el servidor ni un caso especial en la
 * cascara nativa.
 */

import { api, isSignedIn, signOut, setApiBase } from './api.js';
import { initPlatform, call, pickContact, canPickContact } from './platform.js';
import { prefs, state, setState, applyTheme, savePrefs } from './store.js';
import {
  html, raw, icon, wire, q, qa, render, toastError, toastOk,
  askConfirm, withBusy, escapeHtml
} from './ui.js';

import { onboardingView } from './views/onboarding.js';
import { authView } from './views/auth.js';
import { navigateView } from './views/navigate.js';
import { trucksView } from './views/trucks.js';
import { profileView } from './views/profile.js';

/* ---------------------------------------------------------------------------
   Que ningun error se pierda

   Adentro del APK la consola del WebView sale al log del sistema (`adb logcat
   -s Web`, ver AD-31). Para que eso sirva, lo que revienta tiene que llegar a la
   consola: un error sin atrapar y una promesa rechazada no pasan por ningun
   `catch` nuestro y, sin esto, se los traga el navegador.

   Va antes que todo lo demas a proposito: si falla el arranque mismo, tiene que
   quedar dicho.
--------------------------------------------------------------------------- */

// Una linea incondicional al arrancar. No es decorativa: es la unica prueba de
// que el puente de la consola esta vivo. Sin ella, "no hay mensajes" y "los
// mensajes no llegan" se ven exactamente igual desde afuera.
console.log(`interfaz cargada · ${location.href}`);

window.addEventListener('error', (event) => {
  console.error(
    `sin atrapar: ${event.message} en ${event.filename}:${event.lineno}`,
    event.error?.stack ?? '');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  console.error(`promesa rechazada: ${reason?.message ?? reason}`, reason?.stack ?? '');
});

const root = document.getElementById('app');

/** Limpieza que dejo la vista anterior, si dejo alguna. */
let teardown = null;

const ROUTES = {
  mapa: navigateView,
  camiones: trucksView,
  perfil: profileView
};

applyTheme();

/* ---------------------------------------------------------------------------
   Navegacion
--------------------------------------------------------------------------- */

function go(name) {
  closeDrawer();

  if (location.hash === `#${name}`) {
    mount();
    return;
  }

  location.hash = name;
}

window.addEventListener('hashchange', mount);

function mount() {
  teardown?.();
  teardown = null;

  const host = document.createElement("div");

  // El nodo tiene que estar en el documento ANTES de montar la vista: MapLibre
  // busca su contenedor y lo mide al construirse, y sobre un nodo suelto no
  // encuentra nada. Costo un "Container not found" con la pantalla en blanco.
  swap(host);

  // Puerta 1: las fuentes se leen una vez, antes que nada.
  if (!prefs.sourcesAccepted) {
    onboardingView(host, { onDone: () => go(isSignedIn() ? "mapa" : "cuenta") });
    return;
  }

  // Puerta 2: sin sesion no hay camiones ni viajes que mostrar.
  if (!isSignedIn()) {
    authView(host, { onSignedIn: () => boot().then(() => go("mapa")) });
    return;
  }

  const name = (location.hash || '#mapa').slice(1);

  if (name === 'emergencia') {
    emergencyView(host, { go });
    return;
  }

  if (name === 'configuracion') {
    settingsView(host, { go });
    return;
  }

  const view = ROUTES[name] ?? navigateView;
  teardown = view(host, { go, openDrawer }) ?? null;
}

function swap(host) {
  root.replaceChildren(host);
}

/* ---------------------------------------------------------------------------
   Menu lateral
--------------------------------------------------------------------------- */

let drawerNodes = null;

const MENU = [
  { name: 'mapa', label: 'Navegar', icon: 'route' },
  { name: 'camiones', label: 'Mis camiones', icon: 'truck' },
  { name: 'perfil', label: 'Mi perfil', icon: 'user' },
  { name: 'chat', label: 'Chat', icon: 'chat', soon: true },
  { name: 'configuracion', label: 'Configuración', icon: 'settings' }
];

function openDrawer() {
  if (drawerNodes) return;

  const current = (location.hash || '#mapa').slice(1);
  const profile = state.profile;

  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';
  drawer.innerHTML = html`
    <div class="drawer-head">
      <div class="avatar">${profile?.avatarId ? avatarGlyph(profile.avatarId) : '🧢'}</div>
      <div class="grow" style="min-width:0">
        <b class="truncate" style="display:block">
          ${profile?.firstName || 'Camionero'}
        </b>
        <span class="muted truncate" style="display:block">
          ${profile?.alias ? `@${profile.alias}` : 'Completá tu perfil'}
        </span>
      </div>
    </div>

    <nav>
      ${raw(MENU.map((item) => `
        <button data-go="${item.name}" class="${item.name === current ? 'active' : ''}"
                ${item.soon ? 'data-soon="1"' : ''}>
          ${icon(item.icon)}
          <span class="grow">${item.label}</span>
          ${item.soon ? '<span class="pill pill-brand">Pronto</span>' : ''}
        </button>
      `).join(''))}
    </nav>

    <div class="drawer-foot">
      <p class="note-source">
        Datos © colaboradores de OpenStreetMap (ODbL).<br>
        Restricciones según Ley 2148 de CABA.
      </p>
    </div>
  `;

  document.body.append(backdrop, drawer);
  drawerNodes = [backdrop, drawer];

  backdrop.addEventListener('click', closeDrawer);

  drawer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-go]');
    if (!button) return;

    if (button.dataset.soon) {
      closeDrawer();
      toastError('El chat todavía no está. Llega con la comunidad.');
      return;
    }

    go(button.dataset.go);
  });
}

function closeDrawer() {
  drawerNodes?.forEach((node) => node.remove());
  drawerNodes = null;
}

const avatarGlyph = (id) =>
  ({ 'gorrita-1': '🧢', 'clasico-1': '👨🏻', 'clasico-2': '👨🏽', 'clasico-3': '👨🏿',
     'clasica-1': '👩🏽', 'formal-1': '🕴️', 'barba-1': '🧔🏽', 'mate-1': '🧉' })[id] ?? '🧢';

/* ---------------------------------------------------------------------------
   Pantallas chicas que no justifican archivo propio
--------------------------------------------------------------------------- */

/**
 * Emergencia: el 911 y hasta tres personas de confianza.
 *
 * Toda la pantalla esta pensada para usarse UNA vez cada mucho tiempo y en el
 * peor momento posible. De ahi tres decisiones:
 *
 *   · el 911 va primero, grande y sin depender de nada — es lo unico que no
 *     puede fallar, y funciona aunque no haya sesion ni contactos cargados;
 *   · los contactos se tocan enteros para llamar, no con un boton chico al
 *     costado: el dedo tiembla y la fila entera es un blanco mas grande;
 *   · llamar ABRE EL DISCADOR con el numero puesto, no llama solo. Un toque de
 *     manga no puede despertar a nadie a las cuatro de la mañana.
 *
 * Los contactos viven en el servidor. Uno que se pierde al reinstalar la app es
 * un contacto que no esta el dia que hace falta.
 */
function emergencyView(host, { go }) {
  host.className = 'screen';

  let contacts = [];
  let loading = true;
  let adding = false;

  function draw() {
    const lleno = contacts.length >= 3;

    render(host, html`
      <div class="topbar">
        <button class="fab" id="back" aria-label="Volver">${raw(icon('back', 20))}</button>
        <h2>Emergencia</h2>
      </div>
      <div class="scroll">
        <button class="btn btn-danger btn-block" id="call-911"
                style="min-height:64px;font-size:18px">
          Llamar al 911
        </button>

        <div class="card">
          <h3>Mis contactos</h3>

          ${loading ? raw('<p class="hint">Buscando tus contactos…</p>') : raw(`
            ${contacts.length ? `<ul class="contact-list">${contacts.map((c) => `
              <li>
                <button class="contact-call" data-llamar="${escapeHtml(c.phone)}" type="button">
                  <span class="contact-name">${escapeHtml(c.name)}</span>
                  <span class="contact-phone">${escapeHtml(c.phone)}</span>
                </button>
                <button class="waypoint-clear" data-borrar="${c.id}" type="button"
                        aria-label="Borrar a ${escapeHtml(c.name)}">${icon('close', 16)}</button>
              </li>`).join('')}</ul>` : `
              <p class="hint">
                Todavía no cargaste ninguno. Poné hasta tres personas a las que
                quieras poder llamar de un toque.
              </p>`}
          `)}

          ${loading || lleno ? '' : raw(`
            ${adding ? `
              <div class="stack">
                <div class="field">
                  <label for="c-name">Nombre</label>
                  <input class="input" id="c-name" placeholder="Mi vieja"
                         autocomplete="off" maxlength="80">
                </div>

                <div class="field">
                  <label for="c-phone">Teléfono</label>
                  <input class="input" id="c-phone" placeholder="11 4567-8900"
                         inputmode="tel" autocomplete="off" maxlength="40">
                  <p class="hint">
                    Como lo tengas anotado. Los espacios y guiones no molestan.
                  </p>
                </div>

                <div class="row-buttons">
                  <button class="btn btn-primary" id="c-save">Guardar</button>
                  <button class="btn btn-ghost" id="c-cancel">Cancelar</button>
                </div>
              </div>` : `
              <div class="row-buttons">
                ${canPickContact
                  ? '<button class="btn btn-primary" id="c-agenda">Elegir de la agenda</button>'
                  : ''}
                <button class="btn btn-ghost" id="c-manual">Escribirlo a mano</button>
              </div>`}
          `)}

          ${lleno ? raw(`
            <p class="hint">
              Llegaste a los tres. Borrá uno si querés cambiarlo.
            </p>`) : ''}
        </div>

        <div class="card">
          <h3>Todavía en camino</h3>
          <p class="hint">
            Compartir el viaje en tiempo real por WhatsApp se agrega más adelante.
          </p>
        </div>
      </div>
    `);

    wire(host, {
      '#back': () => go('mapa'),
      // Adentro del WebView un `tel:` no abre el discador solo: lo resuelve la
      // cascara nativa por el puente.
      '#call-911': () => call('911'),
      '#c-agenda': (event) => desdeLaAgenda(event.currentTarget),
      '#c-manual': () => { adding = true; draw(); },
      '#c-cancel': () => { adding = false; draw(); },
      '#c-save': (event) => guardar(event.currentTarget)
    });

    for (const boton of qa(host, '[data-llamar]')) {
      boton.addEventListener('click', () => call(boton.dataset.llamar));
    }

    for (const boton of qa(host, '[data-borrar]')) {
      boton.addEventListener('click', () => borrar(boton.dataset.borrar));
    }
  }

  async function cargar() {
    try {
      contacts = await api.emergencyContacts();
    } catch (error) {
      // Sin contactos la pantalla sigue sirviendo: el 911 no depende de esto.
      toastError(error.message);
    } finally {
      loading = false;
      draw();
    }
  }

  /**
   * Trae un contacto de la libreta del telefono y lo guarda.
   *
   * Si la persona sale sin elegir no pasa nada y no se le dice nada: cancelar es
   * una respuesta, no un error. Ver AD-42.
   */
  async function desdeLaAgenda(button) {
    try {
      const elegido = await pickContact();

      if (!elegido) return;

      await withBusy(button, 'Guardando', () => alta(elegido.name, elegido.phone));
    } catch (error) {
      toastError(error.message);
    }
  }

  async function guardar(button) {
    const name = q(host, '#c-name')?.value ?? '';
    const phone = q(host, '#c-phone')?.value ?? '';

    await withBusy(button, 'Guardando', () => alta(name, phone));
  }

  async function alta(name, phone) {
    try {
      const guardado = await api.addEmergencyContact(name, phone);

      contacts = [...contacts, guardado];
      adding = false;
      draw();

      // "Guardaste a X" y no "X quedó guardado": el nombre lo escribe el usuario
      // y puede ser de cualquier genero — "Mi vieja quedo guardado" se lee mal.
      // Esta forma no concuerda con el nombre, asi que no puede fallar.
      toastOk(`Guardaste a ${guardado.name}.`);
    } catch (error) {
      // El servidor valida con las mismas reglas del dominio, asi que su mensaje
      // ya viene escrito para mostrarse. No se duplica la validacion aca.
      toastError(error.message);
    }
  }

  async function borrar(id) {
    const contacto = contacts.find((c) => c.id === id);

    // askConfirm y no confirm(): el WebView de Android no dibuja los dialogos de
    // JavaScript y confirm() devuelve false sin mostrar nada. Ver AD-28.
    const seguro = await askConfirm({
      title: 'Borrar contacto',
      message: `¿Sacamos a ${contacto?.name ?? 'este contacto'} de tus contactos de emergencia?`,
      confirmLabel: 'Borrar',
      danger: true
    });

    if (!seguro) return;

    try {
      await api.deleteEmergencyContact(id);

      contacts = contacts.filter((c) => c.id !== id);
      draw();
    } catch (error) {
      toastError(error.message);
    }
  }

  draw();
  cargar();
}

function settingsView(host, { go }) {
  host.className = 'screen';

  const option = (value, label) => `
    <label class="row card" style="padding:12px 14px;cursor:pointer;gap:10px">
      <input type="radio" name="theme" value="${value}" ${prefs.theme === value ? 'checked' : ''}
             style="width:20px;height:20px;accent-color:var(--brand)">
      <span class="grow"><b style="font-size:14.5px">${label}</b></span>
    </label>
  `;

  host.innerHTML = html`
    <div class="topbar">
      <button class="fab" id="back" aria-label="Volver">${raw(icon('back', 20))}</button>
      <h2>Configuración</h2>
    </div>
    <div class="scroll">
      <div class="field">
        <label>Apariencia</label>
        <div class="stack-sm" id="theme">
          ${raw(option('auto', 'Automático — sigue al teléfono'))}
          ${raw(option('light', 'Modo día'))}
          ${raw(option('dark', 'Modo noche'))}
        </div>
      </div>

      <div class="field">
        <label>Idioma</label>
        <div class="card">
          <p class="hint">
            Por ahora sólo español. Portugués, guaraní e inglés llegan más adelante.
          </p>
        </div>
      </div>

      <div class="card">
        <h3>Fuentes de los datos</h3>
        <p class="hint">
          Mapa y atributos: OpenStreetMap (ODbL). Normativa: Ley 2148 de la Ciudad,
          artículos 9.10.1 y 9.10.5. Qué calle pertenece a la Red lo aporta la
          comunidad de OpenStreetMap, no una capa oficial.
        </p>
        <button class="btn btn-ghost btn-block" id="review">Volver a leer el aviso</button>
      </div>
    </div>
  `;

  wire(host, {
    '#back': () => go('mapa'),
    '#review': () => {
      savePrefs({ sourcesAccepted: false });
      mount();
    },
    '#theme@change': (event) => {
      savePrefs({ theme: event.target.value });
      applyTheme();
    }
  });
}

/* ---------------------------------------------------------------------------
   Arranque
--------------------------------------------------------------------------- */

/** Carga lo que varias pantallas necesitan tener a mano. */
async function boot() {
  if (!isSignedIn()) return;

  try {
    const [profile, trucks] = await Promise.all([api.profile(), api.trucks()]);
    setState({ profile, trucks });
  } catch (error) {
    // Un token vencido que ya no se pudo renovar deja al usuario afuera; se
    // limpia la sesion para que vea la pantalla de ingreso en vez de una app
    // vacia sin explicacion.
    if (error.status === 401) {
      signOut();
    } else {
      console.error(error);
    }

    return;
  }

  await loadActiveTrip();
}

/**
 * Recupera el viaje que haya quedado abierto.
 *
 * El viaje vive en el servidor y sobrevive a cerrar la aplicacion; el estado de
 * la pantalla no. Sin esta consulta la app arranca creyendo que no hay viaje,
 * deja planificar otro y recien al arrancarlo el servidor lo rechaza, con un
 * mensaje que desde afuera no se entiende.
 *
 * Va aparte del resto y con su propio catch: si esta consulta falla el usuario
 * tiene que poder usar la app igual, aunque sea sin retomar el viaje.
 */
async function loadActiveTrip() {
  try {
    const active = await api.activeTrip();

    setState({
      activeTrip: active?.trip ?? null,
      activeRoute: active?.route ?? null
    });

    if (active && !active.route) {
      console.warn('Viaje abierto sin ruta:', active.routeUnavailableReason);
    }
  } catch (error) {
    console.error('No se pudo consultar el viaje abierto:', error);
  }
}

/**
 * Arranque.
 *
 * Primero se resuelve la plataforma, porque hasta no saber la URL del backend no
 * se puede pedir nada. En el navegador eso es inmediato; adentro de la app
 * Android es una vuelta por el puente.
 */
(async () => {
  const { apiBase, reason } = await initPlatform();

  if (apiBase === null) {
    root.innerHTML = html`
      <div class="center-note">
        <div class="stack-sm">
          <b>No se pudo contactar al servidor</b>
          <p class="hint">${reason ?? 'La aplicación no recibió la dirección del backend.'}</p>
          <p class="hint">Cerrá la aplicación y volvé a abrirla.</p>
        </div>
      </div>
    `;
    return;
  }

  setApiBase(apiBase);

  await boot();
  mount();
})();
