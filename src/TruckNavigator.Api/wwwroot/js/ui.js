/**
 * Piezas de interfaz compartidas.
 *
 * No hay framework a proposito: la app se empaqueta sin paso de compilacion, asi
 * que lo que hay es un puñado de ayudas explicitas. `h` arma nodos, `el` los
 * declara con etiquetas de plantilla, y el resto son componentes sueltos.
 */

/** Escapa texto que viene de datos, para que no pueda inyectar marcado. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Arma un elemento desde HTML.
 *
 * Se usa con `html` (abajo), que escapa las interpolaciones. Escribir marcado a
 * mano sin pasar por ahi es responsabilidad de quien lo hace.
 */
export function fromHtml(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

/**
 * Etiqueta de plantilla que escapa cada interpolacion.
 *
 * Para insertar marcado ya armado, envolverlo en `raw()`.
 */
export function html(strings, ...values) {
  return strings.reduce((out, chunk, index) => {
    if (index === 0) return chunk;

    const value = values[index - 1];
    const rendered = Array.isArray(value)
      ? value.map(renderValue).join('')
      : renderValue(value);

    return out + rendered + chunk;
  }, '');
}

const RAW = Symbol('raw');

export const raw = (markup) => ({ [RAW]: String(markup ?? '') });

function renderValue(value) {
  if (value === null || value === undefined || value === false) return '';
  if (typeof value === 'object' && RAW in value) return value[RAW];
  return escapeHtml(value);
}

/** Reemplaza el contenido de un nodo. */
export function render(host, markup) {
  host.innerHTML = markup;
  return host;
}

/** Atajo para `querySelector` sobre un nodo. */
export const q = (root, selector) => root.querySelector(selector);
export const qa = (root, selector) => Array.from(root.querySelectorAll(selector));

/**
 * Conecta manejadores por selector.
 *
 * Evita repetir querySelector + addEventListener en cada vista, que es donde se
 * cuelan los nodos nulos sin que nadie avise.
 */
export function wire(root, handlers) {
  for (const [key, handler] of Object.entries(handlers)) {
    const [rawSelector, event = 'click'] = key.split('@');

    // Un "?" al final marca que el nodo puede no estar —una vista con dos modos
    // que comparten manejadores—. Sin esa marca, faltar es un error de tipeo y
    // conviene que avise.
    const optional = rawSelector.endsWith('?');
    const selector = optional ? rawSelector.slice(0, -1) : rawSelector;
    const nodes = qa(root, selector);

    if (nodes.length === 0 && !optional) {
      console.warn(`wire: no hay ningun nodo para "${selector}"`);
    }

    nodes.forEach((node) => node.addEventListener(event, handler));
  }

  return root;
}

// --- iconos -----------------------------------------------------------------
//
// Trazo de 2 px sobre una caja de 24. Se dibujan en linea y no como fuente de
// iconos para que hereden el color del texto y no dependan de otra descarga.

const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  gps: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h5a4 4 0 0 0 0-8h-3a4 4 0 0 1 0-8h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3.5 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  warning: '<path d="M12 3l9 17H3z"/><path d="M12 9v5M12 17.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  bridge: '<path d="M3 8h18M5 8v10M19 8v10M9 18v-5a3 3 0 0 1 6 0v5"/>'
};

export function icon(name, size = 22) {
  const path = ICONS[name];

  if (!path) {
    console.warn(`icon: no existe "${name}"`);
    return '';
  }

  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

// --- avisos -----------------------------------------------------------------

let toastHost = null;

/**
 * Aviso breve al pie.
 *
 * Se usa para lo que el usuario tiene que saber pero no decidir. Cuando hace
 * falta una decision, va una pantalla o una hoja, no esto.
 */
export function toast(message, kind = 'info', ms = 4200) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    document.body.appendChild(toastHost);
  }

  const node = fromHtml(html`<div class="toast toast-${raw(kind)}">${message}</div>`);
  toastHost.appendChild(node);

  setTimeout(() => {
    node.style.transition = 'opacity .25s ease';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 260);
  }, ms);
}

export const toastError = (message) => toast(message, 'error', 6000);
export const toastOk = (message) => toast(message, 'ok');

// --- decisiones -------------------------------------------------------------

/**
 * Hoja de decision.
 *
 * Reemplaza a `confirm()`, que **no existe adentro de la aplicacion Android**: el
 * WebView no dibuja los dialogos de JavaScript salvo que la cascara nativa
 * instale un WebChromeClient que los atienda, y MAUI no instala ninguno. Sin el,
 * `confirm()` devuelve false sin mostrar nada — la app parecia ignorar el boton.
 * Cerrar un viaje, abandonarlo y borrar un camion pasaban todos por ahi.
 *
 * Ademas es la forma correcta aca aunque funcionara: los botones del sistema son
 * chicos para una mano en un camion, y esta hoja se puede tocar sin apuntar.
 *
 * @param {{title:string, message?:string, options:Array<{id:string,label:string,kind?:'primary'|'danger'|'ghost'}>}} spec
 * @returns {Promise<string|null>} el id elegido, o null si se descarto
 */
export function askChoice({ title, message, options }) {
  return new Promise((resolve) => {
    const backdrop = fromHtml(html`
      <div class="ask-backdrop" role="dialog" aria-modal="true">
        <div class="ask">
          <div class="ask-title">${title}</div>
          ${message ? raw(`<p class="ask-message">${escapeHtml(message)}</p>`) : ''}
          <div class="ask-actions">
            ${raw(options.map((option) => `
              <button class="btn btn-block btn-${option.kind ?? 'ghost'}" data-id="${escapeHtml(option.id)}">
                ${escapeHtml(option.label)}
              </button>
            `).join(''))}
          </div>
        </div>
      </div>
    `);

    let settled = false;

    function close(result) {
      if (settled) return;
      settled = true;

      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }

    function onKey(event) {
      if (event.key === 'Escape') close(null);
    }

    backdrop.addEventListener('click', (event) => {
      // Tocar fuera de la hoja descarta. Adentro no: un pulgar que roza el
      // borde no puede cancelar una decision sobre un viaje.
      if (event.target === backdrop) close(null);

      const button = event.target.closest('button[data-id]');
      if (button) close(button.dataset.id);
    });

    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);

    // El foco arranca en la primera opcion para que el teclado y el lector de
    // pantalla entren en la hoja y no queden atras, en la pantalla.
    backdrop.querySelector('button')?.focus();
  });
}

/** Caso de dos salidas: la habitual y la que confirma. */
export async function askConfirm({
  title,
  message,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  danger = false
}) {
  const choice = await askChoice({
    title,
    message,
    options: [
      { id: 'ok', label: confirmLabel, kind: danger ? 'danger' : 'primary' },
      { id: 'cancel', label: cancelLabel, kind: 'ghost' }
    ]
  });

  return choice === 'ok';
}

// --- formato ----------------------------------------------------------------

export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;

  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';

  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

export function formatDate(iso) {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/* --- puntos cardinales ------------------------------------------------------
   Ocho y no dieciseis: "nornoreste" no se lee de reojo manejando, y con la
   precision que da un magnetometro de telefono tampoco seria honesto.
---------------------------------------------------------------------------- */

const CARDINAL_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const CARDINAL_LONG = [
  'norte', 'noreste', 'este', 'sudeste',
  'sur', 'sudoeste', 'oeste', 'noroeste'
];

const cardinalIndex = (degrees) =>
  Math.round((((degrees % 360) + 360) % 360) / 45) % 8;

/** El punto cardinal abreviado de un rumbo: `NE`, `SO`. */
export const cardinal = (degrees) =>
  Number.isFinite(degrees) ? CARDINAL_SHORT[cardinalIndex(degrees)] : '—';

/** El punto cardinal escrito, para decirlo en una frase. */
export const cardinalName = (degrees) =>
  Number.isFinite(degrees) ? CARDINAL_LONG[cardinalIndex(degrees)] : '';

/** Hora de llegada estimada a partir de ahora. */
export function arrivalTime(seconds) {
  const at = new Date(Date.now() + seconds * 1000);
  return at.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// --- utilidades -------------------------------------------------------------

/** Retrasa la ejecucion hasta que pasen `ms` sin llamadas nuevas. */
export function debounce(fn, ms) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Envuelve un manejador para que muestre el error en vez de perderlo en consola. */
export function guard(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(error);
      toastError(error.message || 'Algo salio mal.');
    }
  };
}

/** Marca un boton como ocupado mientras corre una promesa. */
export async function withBusy(button, label, work) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> ${escapeHtml(label)}`;

  try {
    return await work();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}
