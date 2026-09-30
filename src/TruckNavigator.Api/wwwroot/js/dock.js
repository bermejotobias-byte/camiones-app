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
import { icono } from './iconos.js';

/**
 * Los cuatro accesos. `ruta` es a donde va cada uno; `cubre` son las pantallas
 * en las que ese acceso se marca como activo aunque no sea la suya —"mas"
 * queda prendido mientras se esta en cualquiera de sus pantallas, como en la
 * referencia.
 */
export const ACCESOS = [
  { id: 'mapa',       label: 'GPS',    ruta: 'mapa',       cubre: ['mapa'] },
  { id: 'juegos',     label: 'Juegos', ruta: 'juegos',     cubre: ['juegos'] },
  { id: 'emergencia', label: 'S.O.S.', ruta: 'emergencia', cubre: ['emergencia'] },
  { id: 'mas',        label: 'Más',    ruta: null,         cubre: ['perfil', 'resumen', 'reportes', 'carnet', 'camiones', 'configuracion', 'fuentes'] }
];

/**
 * Lo que abre "mas": las entradas del brainstorm v3 §12.
 *
 * Cada una lleva subtitulo porque la fila del prototipo es icono, titulo,
 * subtitulo y chevron: sin subtitulo es media fila, y el menu es justo la
 * pantalla que alguien abre para ver que sabe hacer la app.
 */
export const MENU_MAS = [
  { ruta: 'perfil',        label: 'Mi perfil',    sub: 'Tu nivel, tus metas y tus logros' },
  { ruta: 'resumen',       label: 'Resumen',      sub: 'El centro de tu progreso', pronto: true },
  { ruta: 'reportes',      label: 'Reportes',     sub: 'Lo que la comunidad reportó cerca' },
  { ruta: 'camiones',      label: 'Mis camiones', sub: 'Cargar, editar y elegir con cuál manejás' },
  { ruta: 'carnet',        label: 'Mi carnet',    sub: 'Tu carnet de camionero, frente y dorso' },
  { ruta: 'chat',          label: 'Chat',         sub: 'Hablar con otros camioneros', pronto: true },
  { ruta: 'configuracion', label: 'Configuración', sub: 'Tema, vibración, idioma y servidor' }
];

/**
 * El menu de un invitado: lo unico que puede abrir, mas la invitacion.
 *
 * Un menu lleno de filas que no puede abrir es una lista de frustraciones.
 * Configuracion no es un lujo para el: ahi estan el tema, la vibracion y la
 * direccion del servidor, que es lo que le permite arreglar la app si la IP
 * del backend cambio.
 */
export const menuParaInvitado = (menu) => [
  menu.find((entrada) => entrada.ruta === 'configuracion'),
  {
    ruta: 'cuenta-nueva',
    label: 'Crear mi cuenta',
    sub: 'Para que tus kilómetros sumen y puedas reportar',
    destacada: true
  }
];

/* ---------------------------------------------------------------------------
   Los dibujos viven en js/iconos.js
   ---------------------------------------------------------------------------
   Estaban aca desde el 12/09/2026, dibujados para el zocalo. Desde el
   30/09/2026 estan en el modulo de iconos junto con los del prototipo: una
   pantalla que necesitaba el icono de idioma no tenia de donde sacarlo, y dos
   juegos de dibujos en dos archivos se desincronizan.

   Los del zocalo se mudaron TAL CUAL: cada uno corre su sombra distinto y el
   usuario los aprobo asi.
--------------------------------------------------------------------------- */

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
  let permitido = false;         // antes de entrar (la entrada) no hay zocalo
  let invitado = false;          // sin cuenta, el menu es otro

  function draw() {
    render(nodo, html`
      <div class="dock-bar">
        ${raw(ACCESOS.map((a) => `
          <button class="dock-item ${a.id === activo ? 'is-active' : ''}" data-acceso="${a.id}"
                  aria-label="${a.label}" aria-current="${a.id === activo ? 'page' : 'false'}">
            ${icono(a.id, 30)}
          </button>`).join(''))}
      </div>

      <div class="dock-backdrop" id="dock-backdrop" ${hojaAbierta ? '' : 'hidden'}></div>
      <div class="dock-sheet ${hojaAbierta ? 'is-open' : ''}" id="dock-sheet" role="menu">
        ${raw((invitado ? menuParaInvitado(MENU_MAS) : MENU_MAS).map((m) => `
          <button class="dock-row ${m.destacada ? 'dock-row-destacada' : ''}" role="menuitem"
                  data-ruta="${m.ruta}" ${m.pronto ? 'disabled' : ''}>
            ${icono(m.ruta === 'cuenta-nueva' ? 'persona' : m.ruta, 28)}
            <span class="grow"><b>${m.label}</b><em class="sub">${m.sub}</em></span>
            ${m.pronto ? '<em class="pronto">Pronto</em>' : ''}
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

  /**
   * Quien esta mirando el zocalo.
   *
   * El invitado ve otro menu: solo lo que puede abrir, mas la invitacion. Se
   * redibuja solo si cambio, porque esto se llama en cada montaje.
   */
  function setInvitado(valor) {
    if (invitado === valor) return;

    invitado = valor;
    draw();
  }

  draw();

  return { nodo, setActive, setPermitido, setInvitado };
}
