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

import { fuentesView } from './views/fuentes.js';
import { estadoDeSesion, permisos } from './sesion.js';
import { entradaView } from './entrada/entrada.js';
import { hojaDeCuenta } from './cuenta.js';
import { icono } from './iconos.js';
import { idiomaView } from './entrada/idioma.js';
import { reportesView } from './views/reportes.js';
import { authView } from './views/auth.js';
import { navigateView } from './views/navigate.js';
import { trucksView } from './views/trucks.js';
import { profileView } from './views/profile.js';
import { carnetView } from './views/carnet.js';
import { juegosView } from './views/juegos.js';
import { viboritaView } from './views/viborita.js';
import { finViajeView } from './views/fin-viaje.js';
import { createDock } from './dock.js';

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

// La cascara tiene dos piezas: la vista, que cambia con cada navegacion, y el
// zocalo, que es persistente. Antes swap() reemplazaba todo el #app; ahora
// reemplaza solo el contenedor de la vista, y el zocalo queda al lado.
const viewRoot = document.createElement('div');
viewRoot.id = 'view';
root.replaceChildren(viewRoot);

/** Limpieza que dejo la vista anterior, si dejo alguna. */
let teardown = null;

/**
 * En que estado esta la app, recalculado en cada montaje.
 *
 * Las vistas preguntan por `puede()` en vez de por `isSignedIn()`: el
 * invitado es una sesion que en el servidor NO existe, asi que una pantalla
 * que pregunta por la sesion no lo ve y lo trata como si estuviera afuera.
 */
let estado = { tipo: 'nueva', pasoQueFalta: 'bienvenida', invitadoVencido: false };

export const estadoActual = () => estado;
export const puede = () => permisos(estado);

const ROUTES = {
  mapa: navigateView,
  camiones: trucksView,
  perfil: profileView,
  carnet: carnetView,
  juegos: juegosView,
  viborita: viboritaView,
  fin: finViajeView,

  // Los reportes vigentes cerca: la cara visible de la Fase 5 (v3 §12).
  reportes: reportesView,

  // El alta de una cuenta: se llega desde el acceso y desde las hojas que le
  // ofrecen la cuenta a un invitado.
  'cuenta-nueva': (host, { go }) => authView(host, {
    onSignedIn: () => boot().then(() => go('mapa')),
    onVolverAEntrar: () => go('acceso')
  }),

  // De donde salen los datos. Hasta el 30/09/2026 era la puerta de la app.
  fuentes: (host) => fuentesView(host, { alVolver: () => history.back() }),

  // El idioma, fuera de la entrada: la misma pantalla, con lo elegido puesto.
  idioma: (host) => idiomaView(host, {
    chip: null,
    onContinuar: (elegido) => {
      savePrefs({ idioma: elegido });
      history.back();
    }
  })
};

/**
 * Que pantallas no existen sin cuenta, y con que motivo se le explica.
 *
 * El S.O.S. NO esta en esta lista y no puede estarlo: nada de las cuentas ni
 * de la gamificacion puede estorbar un pedido de auxilio.
 */
const NECESITAN_CUENTA = {
  perfil: 'perfil',
  carnet: 'perfil',
  camiones: 'perfil',
  juegos: 'juegos',
  viborita: 'juegos'
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

  const name = (location.hash || '#mapa').slice(1);

  estado = estadoDeSesion(prefs, isSignedIn(), new Date());

  // UNA sola puerta: si falta un paso de la entrada, se monta ese paso. Las
  // fuentes y el alta son las dos excepciones, porque se llega a ellas DESDE
  // la entrada y tienen que poder abrirse sin haberla terminado.
  const desdeLaEntrada = name === 'fuentes' || name === 'cuenta-nueva';

  if (estado.pasoQueFalta && !desdeLaEntrada) {
    dock.setPermitido(false);

    entradaView(host, {
      paso: estado.pasoQueFalta,
      verFuentes: () => go('fuentes'),
      crearCuenta: () => go('cuenta-nueva'),

      // Cada pantalla ya guardo lo suyo: volver a montar recalcula el estado y
      // cae solo en el paso que sigue. Con null, la entrada termino.
      onListo: (siguiente) => (siguiente ? mount() : boot().then(() => go('mapa')))
    });

    return;
  }

  // Pasada la puerta hay zocalo. Las pantallas a las que se llega desde la
  // entrada no lo llevan: todavia no se entro a la app.
  dock.setPermitido(!desdeLaEntrada);
  dock.setInvitado(estado.tipo === 'invitado');
  dock.setActive(name);

  // Las pantallas que no existen sin cuenta. El invitado no se choca con una
  // pantalla vacia ni con un 401: el mono le dice por que, con el motivo de
  // ESA pantalla, y decide.
  const motivo = NECESITAN_CUENTA[name];

  if (motivo && !puede().perfil) {
    go('mapa');
    hojaDeCuenta(motivo).then((crear) => crear && go('cuenta-nueva'));
    return;
  }

  if (name === 'emergencia') {
    emergencyView(host, { go });
    return;
  }

  if (name === 'configuracion') {
    settingsView(host, { go });
    return;
  }

  const view = ROUTES[name] ?? navigateView;

  // `puede` viaja como parametro y no se importa: app.js ya importa las
  // vistas, asi que importarlo al reves seria un ciclo. Ademas deja explicito
  // que una vista no decide sobre permisos, los recibe.
  teardown = view(host, { go, openDrawer, puede }) ?? null;
}

function swap(host) {
  viewRoot.replaceChildren(host);
}

// El zocalo se crea una sola vez y va despues de la vista, o sea abajo.
const dock = createDock({ go });
root.append(dock.nodo);

/* ---------------------------------------------------------------------------
   Menu lateral
--------------------------------------------------------------------------- */

let drawerNodes = null;

const MENU = [
  { name: 'mapa', label: 'Navegar', icon: 'route' },
  { name: 'camiones', label: 'Mis camiones', icon: 'truck' },
  { name: 'perfil', label: 'Mi perfil', icon: 'user' },
  { name: 'carnet', label: 'Mi carnet', icon: 'carnet' },
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
      // Con "?": la pantalla tiene dos modos (lista y alta) y cada boton existe
      // en uno solo; sin la marca, wire avisaba por consola en cada dibujo.
      '#c-agenda?': (event) => desdeLaAgenda(event.currentTarget),
      '#c-manual?': () => { adding = true; draw(); },
      '#c-cancel?': () => { adding = false; draw(); },
      '#c-save?': (event) => guardar(event.currentTarget)
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

      <button class="fila" id="cfg-idioma">
        ${raw(icono('idioma', 32))}
        <div class="grow">
          <b>Idioma</b>
          <span class="sub">Los otros tres están en camino</span>
        </div>
        <span class="pill pill-brand">Español</span>
        ${raw(icon('chevron', 18))}
      </button>

      <button class="fila" id="cfg-fuentes">
        ${raw(icono('fuentes', 32))}
        <div class="grow">
          <b>De dónde salen los datos</b>
          <span class="sub">La Ley 2148, OpenStreetMap y lo que la app no sabe</span>
        </div>
        ${raw(icon('chevron', 18))}
      </button>
    </div>
  `;

  wire(host, {
    '#back': () => go('mapa'),
    // Ya no hay puerta que reabrir: desde el 30/09/2026 las fuentes son una
    // pantalla mas y se va a ella. Antes esto apagaba la preferencia para que
    // la puerta volviera a aparecer.
    '#cfg-fuentes': () => go('fuentes'),

    // La misma pantalla del paso 2 de la entrada. Hoy solo se puede elegir
    // español, y esa es justamente la razon de mostrarla: que se vea que el
    // lugar existe y que los otros tres estan en camino.
    '#cfg-idioma': () => go('idioma'),
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
  if (!isSignedIn()) {
    // Sin sesion no hay perfil ni viajes, pero los camiones del catalogo SI son
    // anonimos, y el invitado los necesita: sin ellos selectedTruck() devuelve
    // null y no se puede calcular NINGUNA ruta. Medido el 30/09/2026: el
    // invitado elegia su camion y el mapa se quedaba sin ninguno, asi que
    // tocar un destino volvia a la hoja de siempre sin decir nada.
    try {
      setState({ trucks: await api.trucks() });
    } catch (error) {
      console.error(error);
    }

    return;
  }

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
