/**
 * El zocalo inferior: GPS · JUEGOS · S.O.S. · MAS.
 *
 * Es la navegacion principal de la app, decidida en el brainstorm v3 §11 y
 * construida el 12/09/2026 sobre la captura del perfil de Duolingo con el menu
 * "…" abierto. Leido de ahi: barra de ~68 px con filo claro arriba, iconos
 * ILUSTRADOS y a color sin texto, el activo dentro de un recuadro redondeado, y
 * "mas" que abre una hoja desde el zocalo atenuando lo de atras.
 *
 * Es una pieza PERSISTENTE de la cascara: no se redibuja al cambiar de pantalla.
 * Por eso vive fuera del contenedor de la vista y no adentro de ninguna.
 *
 * Dos decisiones del usuario del 12/09/2026:
 *   - Se ve en todas las pantallas, tambien en el mapa en reposo. Se esconde
 *     SOLO durante el viaje, y vuelve al salir. Manejando no hay nada mas
 *     importante que el mapa.
 *   - JUEGOS existe aunque no haya juegos todavia: abre una pantalla "pronto".
 *     Una pestaña apagada se lee como rota, y una que falta cambia la forma del
 *     zocalo mas adelante.
 *
 * Los iconos son SVG en linea, rellenos y a dos tonos —el color y su sombra—,
 * que es lo que los hace parecer ilustraciones y no trazos. Los colores son
 * fijos a proposito: un icono ilustrado es un dibujo, no texto, y no cambia con
 * el tema. El rojo del S.O.S. es el unico semantico: es emergencia.
 */

import { html, raw, render, wire, qa } from './ui.js';

/**
 * Los cuatro accesos. `ruta` es a donde va cada uno; `cubre` son las pantallas
 * en las que ese acceso se marca como activo aunque no sea la suya —"mas"
 * queda prendido mientras se esta en cualquiera de sus pantallas, como en la
 * referencia.
 */
const ACCESOS = [
  { id: 'mapa',       label: 'GPS',    ruta: 'mapa',       cubre: ['mapa'] },
  { id: 'juegos',     label: 'Juegos', ruta: 'juegos',     cubre: ['juegos'] },
  { id: 'emergencia', label: 'S.O.S.', ruta: 'emergencia', cubre: ['emergencia'] },
  { id: 'mas',        label: 'Más',    ruta: null,         cubre: ['perfil', 'carnet', 'camiones', 'configuracion', 'fuentes'] }
];

/** Lo que abre "mas". */
const MENU_MAS = [
  { ruta: 'perfil',        label: 'Mi perfil' },
  { ruta: 'carnet',        label: 'Mi carnet' },
  { ruta: 'camiones',      label: 'Mis camiones' },
  { ruta: 'chat',          label: 'Chat', pronto: true },
  { ruta: 'configuracion', label: 'Configuración' }
];

/* ---------------------------------------------------------------------------
   Los dibujos
   ---------------------------------------------------------------------------
   Cada uno en una caja de 32 x 32, con una capa de sombra —la misma forma en
   un tono mas oscuro, corrida 2 px hacia abajo— y encima la forma de color.
   Esa capa es lo que en la referencia hace que los iconos tengan cuerpo.
--------------------------------------------------------------------------- */

const ICONOS = {
  // La flecha de navegacion: el cursor del GPS.
  mapa: `
    <path d="M16 5 L26 27 L16 22 L6 27 Z" fill="#1a6f9a" transform="translate(0 2)"/>
    <path d="M16 5 L26 27 L16 22 L6 27 Z" fill="#35b8e8"/>
    <path d="M16 5 L26 27 L16 22 Z" fill="#8fdcf7" opacity=".55"/>`,

  // El mando de juego: cuerpo, cruceta y dos botones.
  juegos: `
    <path d="M9 10h14a6 6 0 0 1 6 6l-1 7a3.5 3.5 0 0 1-6 2l-2-3h-8l-2 3a3.5 3.5 0 0 1-6-2l-1-7a6 6 0 0 1 6-6z" fill="#6d46c4" transform="translate(0 2)"/>
    <path d="M9 10h14a6 6 0 0 1 6 6l-1 7a3.5 3.5 0 0 1-6 2l-2-3h-8l-2 3a3.5 3.5 0 0 1-6-2l-1-7a6 6 0 0 1 6-6z" fill="#a97bf0"/>
    <path d="M10.5 14v6M7.5 17h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="22" cy="15.5" r="1.6" fill="#fff"/><circle cx="25" cy="18.5" r="1.6" fill="#fff"/>`,

  // El salvavidas: el simbolo universal del auxilio. Rojo porque es emergencia.
  emergencia: `
    <circle cx="16" cy="18" r="11" fill="#b6362b"/>
    <circle cx="16" cy="16" r="11" fill="#f0736a"/>
    <circle cx="16" cy="16" r="5" fill="#fff"/>
    <path d="M16 5v6M16 21v6M5 16h6M21 16h6" stroke="#fff" stroke-width="3.2"/>
    <circle cx="16" cy="16" r="4" fill="#f0736a" opacity=".35"/>`,

  // Los tres puntos, como el "…" de la referencia.
  mas: `
    <circle cx="16" cy="18" r="12" fill="#3f3aa0"/>
    <circle cx="16" cy="16" r="12" fill="#6b64d9"/>
    <circle cx="10" cy="16" r="2.1" fill="#fff"/><circle cx="16" cy="16" r="2.1" fill="#fff"/><circle cx="22" cy="16" r="2.1" fill="#fff"/>`
};

/** Los dibujos chicos de la hoja de "mas", en el mismo lenguaje. */
const ICONOS_MENU = {
  perfil: `
    <circle cx="16" cy="11" r="6" fill="#1a6f9a" transform="translate(0 1.5)"/><circle cx="16" cy="11" r="6" fill="#35b8e8"/>
    <path d="M5 27c0-6 5-9 11-9s11 3 11 9z" fill="#1a6f9a" transform="translate(0 1.5)"/><path d="M5 27c0-6 5-9 11-9s11 3 11 9z" fill="#35b8e8"/>`,
  carnet: `
    <rect x="3" y="8" width="26" height="18" rx="4" fill="#3f3aa0" transform="translate(0 1.5)"/><rect x="3" y="8" width="26" height="18" rx="4" fill="#6b64d9"/>
    <circle cx="10.5" cy="16" r="3.2" fill="#fff"/><path d="M17 13h8M17 17.5h8M17 22h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  camiones: `
    <path d="M3 9h15v12H3zM18 13h6l4 4v4h-10z" fill="#1a6f9a" transform="translate(0 1.5)"/><path d="M3 9h15v12H3zM18 13h6l4 4v4h-10z" fill="#35b8e8"/>
    <circle cx="8" cy="23" r="2.8" fill="#0d1418"/><circle cx="22" cy="23" r="2.8" fill="#0d1418"/>`,
  chat: `
    <path d="M28 15a10 10 0 0 1-10 10H6l3-4a10 10 0 1 1 19-6z" fill="#6d46c4" transform="translate(0 1.5)"/><path d="M28 15a10 10 0 0 1-10 10H6l3-4a10 10 0 1 1 19-6z" fill="#a97bf0"/>`,
  configuracion: `
    <circle cx="16" cy="16" r="10" fill="#4a6070" transform="translate(0 1.5)"/><circle cx="16" cy="16" r="10" fill="#8aa3b3"/>
    <circle cx="16" cy="16" r="3.5" fill="#fff"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke="#8aa3b3" stroke-width="3.5" stroke-linecap="round"/>`
};

const dibujo = (paths, tamanio) =>
  `<svg viewBox="0 0 32 32" width="${tamanio}" height="${tamanio}" aria-hidden="true">${paths}</svg>`;

/* ---------------------------------------------------------------------------
   El zocalo
--------------------------------------------------------------------------- */

/**
 * Crea el zocalo y devuelve el nodo mas dos manejadores. `go` es el del router.
 */
export function createDock({ go }) {
  const nodo = document.createElement('nav');
  nodo.id = 'dock';
  nodo.setAttribute('aria-label', 'Navegación principal');

  let hojaAbierta = false;
  let activo = 'mapa';
  let enViaje = false;
  let permitido = false;         // antes de entrar (fuentes, sesion) no hay zocalo

  function draw() {
    render(nodo, html`
      <div class="dock-bar">
        ${raw(ACCESOS.map((a) => `
          <button class="dock-item ${a.id === activo ? 'is-active' : ''}" data-acceso="${a.id}"
                  aria-label="${a.label}" aria-current="${a.id === activo ? 'page' : 'false'}">
            ${dibujo(ICONOS[a.id], 30)}
          </button>`).join(''))}
      </div>

      <div class="dock-backdrop" id="dock-backdrop" ${hojaAbierta ? '' : 'hidden'}></div>
      <div class="dock-sheet ${hojaAbierta ? 'is-open' : ''}" id="dock-sheet" role="menu">
        ${raw(MENU_MAS.map((m) => `
          <button class="dock-row" role="menuitem" data-ruta="${m.ruta}" ${m.pronto ? 'disabled' : ''}>
            ${dibujo(ICONOS_MENU[m.ruta], 28)}
            <span>${m.label}</span>
            ${m.pronto ? '<em>Pronto</em>' : ''}
          </button>`).join(''))}
      </div>
    `);

    wire(nodo, {
      '#dock-backdrop': cerrarHoja
    });

    qa(nodo, '[data-acceso]').forEach((boton) =>
      boton.addEventListener('click', () => tocar(boton.dataset.acceso)));

    qa(nodo, '[data-ruta]').forEach((boton) =>
      boton.addEventListener('click', () => {
        if (boton.disabled) return;
        cerrarHoja();
        go(boton.dataset.ruta);
      }));

    aplicarVisibilidad();
  }

  function tocar(id) {
    const acceso = ACCESOS.find((a) => a.id === id);

    if (!acceso) return;

    // "Mas" no navega: abre o cierra su hoja. Los otros tres van derecho, y
    // cierran la hoja si estaba abierta.
    if (acceso.ruta === null) {
      hojaAbierta = !hojaAbierta;
      draw();
      return;
    }

    cerrarHoja();
    go(acceso.ruta);
  }

  function cerrarHoja() {
    if (!hojaAbierta) return;
    hojaAbierta = false;
    draw();
  }

  function aplicarVisibilidad() {
    // Oculto = fuera del layout, no invisible: la pantalla de abajo tiene que
    // recuperar el alto. En el mapa eso es lo que devuelve el espacio al viaje.
    nodo.hidden = !permitido || enViaje;
  }

  /** La pantalla que esta montada. Marca el acceso que la cubre. */
  function setActive(ruta) {
    const acceso = ACCESOS.find((a) => a.cubre.includes(ruta));
    activo = acceso?.id ?? null;
    hojaAbierta = false;
    draw();
  }

  /** Si la app ya paso las puertas de entrada. Antes no hay zocalo. */
  function setPermitido(valor) {
    permitido = valor;
    aplicarVisibilidad();
  }

  // Durante el viaje el zocalo se va. Lo avisa navigate.js con un evento y no
  // con una llamada, para que el mapa no tenga que conocer al zocalo.
  document.addEventListener('viaje', (e) => {
    enViaje = Boolean(e.detail?.enCurso);
    if (enViaje) hojaAbierta = false;
    draw();
  });

  draw();

  return { nodo, setActive, setPermitido };
}
