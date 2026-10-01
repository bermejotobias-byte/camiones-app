/**
 * Paso 3 de la entrada: las condiciones.
 *
 * El prototipo no la boceto a proposito ("Condiciones no se bocetó: texto y un
 * boton"), asi que se arma con el vocabulario ya aprobado: la cabecera compacta
 * con su chip, el texto en una tarjeta que scrollea, la fila de Configuracion
 * como enlace a las fuentes, y una sola accion.
 *
 * Hasta el 30/09/2026 la pantalla de fuentes era la PUERTA de la app: cuatro
 * tarjetas obligatorias antes de ver el mapa. Ahora vive en Configuracion y esta
 * pantalla la enlaza, que es la decision del usuario de ese dia.
 *
 * El texto cubre SOLO lo que esta app hace hoy. Una clausula que la app no
 * cumple es peor que no tenerla: es letra chica falsa, y este producto se apoya
 * justamente en decir lo que no sabe.
 *
 * Se guarda la FECHA en que se aceptaron, no un booleano: el dia que cambien los
 * terminos, la fecha dice quien acepto cuales.
 */

import { html, raw, render, wire, icon } from '../ui.js';
import { icono } from '../iconos.js';

export const TERMINOS = [
  'Esta aplicación calcula rutas para camiones en la Ciudad de Buenos Aires con datos abiertos de OpenStreetMap y con la Ley 2148, que define la Red de Tránsito Pesado. Esos datos pueden estar incompletos o desactualizados.',
  'La responsabilidad de circular es siempre del conductor: la ruta es una sugerencia. La señalización de la calle y las indicaciones de la autoridad valen más que lo que muestre la pantalla.',
  'Los reportes, los votos y los lugares nuevos los escribe la comunidad de camioneros. No están verificados por nosotros, y la aplicación los muestra siempre marcados como lo que son.',
  'De vos guardamos tu correo, tu alias, y la fecha de nacimiento y la nacionalidad si las cargás; también los camiones que declarás y los viajes que hacés con la app. No los vendemos ni los usamos para publicidad.',
  'Podés borrar tu cuenta cuando quieras: se borran con ella tu perfil, tus camiones, tus viajes y tus contactos de emergencia.'
];

export function condicionesView(host, { chip, onAcepto, onVerFuentes }) {
  host.className = 'screen';

  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-tenue"></div>

      <div class="topbar">
        <h2>Condiciones</h2>
        ${raw(chip ? `<span class="pill pill-brand">${chip.etiqueta} ${chip.valor}</span>` : '')}
      </div>

      <div class="entrada-scroll">
        <div class="card condiciones-texto">
          ${raw(TERMINOS.map((parrafo) => `<p>${parrafo}</p>`).join(''))}
        </div>

        <button class="fila" id="ver-fuentes">
          ${raw(icono('fuentes', 32))}
          <div class="grow">
            <b>De dónde salen los datos</b>
            <span class="sub">La Ley 2148, OpenStreetMap y lo que la app no sabe</span>
          </div>
          ${raw(icon('chevron', 18))}
        </button>

        <div class="grow"></div>
        <button class="btn btn-primary btn-duo btn-block brillo" id="acepto">Acepto</button>
      </div>
    </div>
  `);

  wire(host, { '#acepto': onAcepto, '#ver-fuentes': onVerFuentes });
}
