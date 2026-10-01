/**
 * El camion del invitado.
 *
 * Primera pantalla del que entra sin cuenta, y la pide el v3 §7: "selecciona que
 * tipo de camion maneja". No es un tramite: es el dato que decide por donde
 * puede pasar, y sin el el ruteo trabajaria con medidas de auto.
 *
 * Son las PLANTILLAS del catalogo —las que no tienen dueño (AD-19)—, que es lo
 * unico que puede leer alguien sin cuenta y con lo que POST /api/routes sabe
 * rutear sin sesion.
 *
 * NO lleva chip de paso: el prototipo fija "Paso 2 de 4" y esto ya paso la
 * puerta. Es la primera pantalla del invitado, no un quinto paso.
 */

import { html, raw, render, wire, qa, toastError } from '../ui.js';
import { icono } from '../iconos.js';
import { mascota } from '../mascota.js';
import { api } from '../api.js';

/** Un metro con coma y dos decimales, como lo dice el cartel del galibo. */
const metros = (n) => `${n.toFixed(2).replace('.', ',')} m`;

/**
 * Que se le muestra de una plantilla: solo lo que decide la ruta.
 *
 * El alto y el largo son los que mandan a un camion por otra calle, y el peso es
 * lo que lo saca de la Red. Lo que la plantilla no declara NO se inventa: decir
 * lo que falta es lo que vuelve confiable a lo que si esta.
 */
export function fichaDePlantilla(plantilla) {
  const partes = [];

  if (Number.isFinite(plantilla.heightMeters)) {
    partes.push(`${metros(plantilla.heightMeters)} de alto`);
  }

  // El largo del CONJUNTO, no el del tractor: un semi declara 6 m de tractor y
  // 12 de acoplado, y lo que decide por que calles puede doblar son los 18. El
  // dominio lo llama TotalLengthMeters, "la que se compara contra los limites de
  // la via".
  const largo = plantilla.totalLengthMeters ?? plantilla.lengthMeters;

  if (Number.isFinite(largo)) {
    partes.push(`${String(largo).replace('.', ',')} m de largo`);
  }

  return {
    nombre: plantilla.name,
    medidas: partes.length ? partes.join(' · ') : 'Sin medidas declaradas',
    peso: `${Math.round((plantilla.grossWeightKg ?? 0) / 1000)} t`
  };
}

export function camionInvitadoView(host, { onElegido }) {
  host.className = 'screen';

  let elegido = null;
  let plantillas = [];

  function dibujar(contenido) {
    render(host, html`
      <div class="pantalla-entrada">
        <div class="luz luz-tenue"></div>

        <div class="topbar"><h2>Tu camión</h2></div>

        <div class="entrada-scroll">
          <p class="entrada-bajada" style="text-align:left;max-width:none">
            ¿Cuál manejás? Con eso calculo por dónde podés pasar: los gálibos bajos,
            la Red de Tránsito Pesado y el peso.
          </p>

          ${raw(contenido)}
        </div>
      </div>
    `);
  }

  const filaDe = (plantilla) => {
    const ficha = fichaDePlantilla(plantilla);

    return `
      <button class="fila ${plantilla.id === elegido ? 'neon' : ''}" data-camion="${plantilla.id}">
        ${icono('camiones', 32)}
        <div class="grow">
          <b>${ficha.nombre}</b>
          <span class="sub">${ficha.medidas}</span>
        </div>
        <span class="pill pill-brand">${ficha.peso}</span>
      </button>`;
  };

  function pintarLista() {
    dibujar(`
      ${plantillas.map(filaDe).join('')}
      <div class="grow"></div>
      <button class="btn btn-primary btn-duo btn-block brillo" id="listo" ${elegido ? '' : 'disabled'}>Con este manejo</button>
    `);

    qa(host, '[data-camion]').forEach((boton) =>
      boton.addEventListener('click', () => {
        elegido = boton.dataset.camion;
        pintarLista();
      }));

    wire(host, { '#listo': () => elegido && onElegido(elegido) });
  }

  // Sin plantillas no hay ruteo posible, asi que el fallo se dice y se puede
  // reintentar. Quedarse con una lista vacia seria dejar al invitado mirando una
  // pantalla que no explica nada.
  async function traer() {
    dibujar('<p class="hint">Buscando los camiones…</p>');

    try {
      plantillas = (await api.trucks()).filter((camion) => camion.isTemplate);

      if (!plantillas.length) {
        throw new Error('El catálogo vino vacío.');
      }

      pintarLista();
    } catch (error) {
      toastError(error.message);

      dibujar(`
        ${mascota('error', { escala: 2 })}
        <p class="hint">No pude traer los camiones. Fijate si tenés conexión.</p>
        <div class="grow"></div>
        <button class="btn btn-primary btn-duo btn-block" id="reintentar">Probar de nuevo</button>
      `);

      wire(host, { '#reintentar': traer });
    }
  }

  traer();
}
