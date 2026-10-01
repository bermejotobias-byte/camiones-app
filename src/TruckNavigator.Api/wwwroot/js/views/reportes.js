/**
 * Reportes en vivo: la cara visible de la Fase 5.
 *
 * La pide el brainstorm v3 §12: "cada reporte debe mostrar tipo, ubicacion,
 * horario, usuario que lo realizo y estado".
 *
 * Es una LISTA, no un sistema: los datos son los mismos que dibuja el mapa y
 * salen del mismo GET /api/reports. Lo que se calcula aca es de donde se piden,
 * en que orden se muestran y que dice cada fila; el tipo, la edad y el estado
 * los resuelve mapa/reportes.js, que es donde ya viven.
 */

import { html, raw, render, wire, qa, toastError } from '../ui.js';
import { icon } from '../ui.js';
import { calcomania } from '../mapa/piezas.js';
import { tipoDeReporte, etiquetaEdad, estadoDelPin } from '../mapa/reportes.js';
import { mascota } from '../mascota.js';
import { api } from '../api.js';
import { hojaDeCuenta } from '../cuenta.js';

/**
 * El lado del recuadro que se pide.
 *
 * Unos 2,2 km: lo que un camion recorre en minutos, que es el alcance en el que
 * un reporte todavia le sirve a alguien que esta por pasar.
 */
export const GRADOS_DE_LA_LISTA = 0.02;

/** Lo que dice cada estado, para que la fila no muestre un codigo. */
const ESTADOS = {
  rojo: { texto: 'Tu camión no pasa', clase: 'estado-rojo' },
  fijo: { texto: 'Fijo', clase: 'estado-fijo' },
  duda: { texto: 'En discusión', clase: 'estado-duda' },
  confirmado: { texto: 'Confirmado', clase: 'estado-confirmado' },
  nuevo: { texto: 'Sin confirmar', clase: 'estado-nuevo' }
};

/**
 * De donde se piden, en este orden: el ultimo fix, el ultimo recuadro que se vio
 * en el mapa, o nada.
 *
 * Sin ninguno de los dos NO se inventa una posicion: la pantalla pide prender la
 * ubicacion, que es la verdad. Mostrar reportes del centro a alguien que esta en
 * Liniers es peor que no mostrar ninguno.
 */
export function recuadroDeLaLista(fix, ultimoBbox) {
  if (fix) {
    const lado = GRADOS_DE_LA_LISTA / 2;

    // Como CADENA y no como arreglo, que es la forma en que `bboxVisible`
    // guarda el recuadro del mapa y la unica que entiende `api.reports`. Con
    // dos formas para lo mismo, la lista andaba con GPS y reventaba sin el.
    return [fix.lng - lado, fix.lat - lado, fix.lng + lado, fix.lat + lado]
      .map((n) => n.toFixed(5))
      .join(',');
  }

  return ultimoBbox ?? null;
}

/** Las filas, mas nuevo primero: es el orden en que a uno le importan. */
export function filasDeReportes(reportes, ahora = Date.now()) {
  return [...reportes]
    .sort((uno, otro) => Date.parse(otro.createdAt) - Date.parse(uno.createdAt))
    .map((r) => {
      const estado = estadoDelPin(r);

      return {
        id: r.id,
        tipo: tipoDeReporte(r.type),
        // La calle que guardo el reporte. Si no la tiene, NO se inventa una.
        donde: r.street || 'Cerca de tu posición',
        cuando: etiquetaEdad(r.createdAt, ahora, { fija: Boolean(r.fixed) }),
        estado,
        dice: ESTADOS[estado] ?? ESTADOS.nuevo,
        quien: r.mine ? 'Vos' : (r.reportedBy?.alias ?? 'Alguien'),
        sePuedeCerrar: Boolean(r.mine)
      };
    });
}

/** El vacio vende la proxima accion: el mono pregunta, el boton responde. */
export function vacioDeLaLista(motivo) {
  if (motivo === 'sin-posicion') {
    return {
      titulo: 'No sé dónde estás',
      texto: 'Prendé la ubicación y te muestro lo que hay reportado cerca tuyo.'
    };
  }

  return {
    titulo: 'Por acá no hay nada reportado',
    texto: 'Si ves un control, un bache o una calle cerrada, contámelo desde el mapa.'
  };
}

/* ---------------------------------------------------------------------------
   La pantalla
--------------------------------------------------------------------------- */

/** Donde se deja el reporte que hay que mostrar en el mapa, para el salto. */
export const CLAVE_DEL_SALTO = 'tn.reporte-a-mostrar';

export function reportesView(host, { go, puede }) {
  host.className = 'screen';

  let filas = [];
  let crudos = [];

  function dibujar(contenido) {
    render(host, html`
      <div class="pantalla-entrada">
        <div class="luz luz-tenue"></div>

        <div class="topbar">
          <button class="fab" id="volver" aria-label="Volver">${raw(icon('back', 20))}</button>
          <h2>Reportes</h2>
        </div>

        <div class="entrada-scroll">${raw(contenido)}</div>
      </div>
    `);

    wire(host, { '#volver': () => go('mapa') });
  }

  const filaDe = (f) => `
    <div class="fila fila-reporte" data-reporte="${f.id}">
      ${calcomania(f.tipo.calcomania, 32)}
      <div class="grow">
        <b>${f.tipo.nombre}</b>
        <span class="sub">${f.donde}${f.cuando ? ` · ${f.cuando}` : ''}</span>
        <span class="sub">${f.quien}</span>
      </div>
      <span class="pill ${f.dice.clase}">${f.dice.texto}</span>
      ${f.sePuedeCerrar ? `<button class="enlace" data-cerrar="${f.id}">Cerrar</button>` : ''}
    </div>`;

  function pintar() {
    if (!filas.length) {
      const vacio = vacioDeLaLista('sin-reportes');

      dibujar(`
        ${mascota('alerta', { escala: 2.2 })}
        <h3 style="text-align:center">${vacio.titulo}</h3>
        <p class="hint" style="text-align:center">${vacio.texto}</p>
      `);

      return;
    }

    dibujar(filas.map(filaDe).join(''));

    // Tocar una fila abre el mapa centrado ahi: la lista dice que hay, el mapa
    // dice donde.
    qa(host, '[data-reporte]').forEach((nodo) =>
      nodo.addEventListener('click', (evento) => {
        if (evento.target.closest('[data-cerrar]')) return;

        // Van tambien las coordenadas: asi el mapa puede volar ahi de una, sin
        // esperar a tener los reportes cargados.
        const r = crudos.find((uno) => uno.id === nodo.dataset.reporte);

        sessionStorage.setItem(CLAVE_DEL_SALTO, JSON.stringify({
          id: nodo.dataset.reporte,
          lat: r?.latitude ?? null,
          lng: r?.longitude ?? null
        }));
        go('mapa');
      }));

    qa(host, '[data-cerrar]').forEach((boton) =>
      boton.addEventListener('click', () => cerrar(boton.dataset.cerrar)));
  }

  async function cerrar(id) {
    // El invitado ve la lista entera —es informacion util de la comunidad— pero
    // cerrar es de quien lo reporto.
    if (!puede?.().reportar) {
      if (await hojaDeCuenta('votar')) go('cuenta-nueva');
      return;
    }

    try {
      await api.closeReport(id);
      filas = filas.filter((f) => f.id !== id);
      pintar();
    } catch (error) {
      toastError(error.message);
    }
  }

  async function traer() {
    dibujar('<p class="hint">Buscando lo que hay cerca…</p>');

    const fix = ultimaPosicion();
    const bbox = recuadroDeLaLista(fix, ultimoRecuadro());

    if (!bbox) {
      const vacio = vacioDeLaLista('sin-posicion');

      dibujar(`
        ${mascota('alerta', { escala: 2.2 })}
        <h3 style="text-align:center">${vacio.titulo}</h3>
        <p class="hint" style="text-align:center">${vacio.texto}</p>
      `);

      return;
    }

    try {
      crudos = await api.reports(bbox);
      filas = filasDeReportes(crudos, Date.now());
      pintar();
    } catch (error) {
      toastError(`No se pudieron traer los reportes: ${error.message}`);
      dibujar('<p class="hint">No pude traerlos. Fijate si tenés conexión.</p>');
    }
  }

  traer();
}

/**
 * La ultima posicion conocida y el ultimo recuadro visto en el mapa.
 *
 * Los deja el mapa en sessionStorage al moverse: esta pantalla no tiene mapa
 * propio y no puede pedir el GPS de nuevo solo para armar una lista.
 */
export const CLAVE_DE_POSICION = 'tn.ultima-posicion';
export const CLAVE_DE_RECUADRO = 'tn.ultimo-recuadro';

function leer(clave) {
  try {
    return JSON.parse(sessionStorage.getItem(clave) ?? 'null');
  } catch {
    return null;
  }
}

const ultimaPosicion = () => leer(CLAVE_DE_POSICION);
const ultimoRecuadro = () => leer(CLAVE_DE_RECUADRO);
