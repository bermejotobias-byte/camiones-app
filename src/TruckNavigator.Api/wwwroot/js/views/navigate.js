/**
 * La pantalla principal: mapa, destino, ruta y viaje.
 *
 * El mapa ocupa todo y la interfaz flota encima en una hoja inferior. Es al
 * reves de lo que hacia el prototipo, donde la cabecera de busqueda se comia un
 * tercio del alto: en un GPS lo que hay que ver es el mapa.
 *
 * La hoja tiene cuatro estados y siempre se ve uno solo:
 *   buscar   →  elegir destino
 *   ruta     →  resumen, restricciones y el boton de arrancar
 *   viaje    →  viaje en curso
 */

import { api } from '../api.js';
import { getPosition } from '../platform.js';
import * as gl from '../map.js';
import { state, setState, prefs, savePrefs, selectedTruck } from '../store.js';
import {
  html, raw, icon, wire, q, qa, render, debounce, withBusy,
  formatDistance, formatDuration, arrivalTime, toastOk, toastError
} from '../ui.js';

export function navigateView(host, { openDrawer, go }) {
  let origin = null;          // { lat, lng, label }
  let destination = null;
  let route = null;
  let stage = 'search';       // 'search' | 'route' | 'trip'
  let editing = 'destination';

  host.className = 'screen map-screen';
  host.innerHTML = html`
    <div id="map"></div>
    <div class="map-overlay">
      <div class="map-top">
        <button class="fab" id="menu" aria-label="Menú">${raw(icon('menu'))}</button>
        <div class="grow"></div>
        <button class="fab fab-panic" id="panic" aria-label="Emergencia">SOS</button>
      </div>

      <div class="map-side">
        <button class="fab" id="locate" aria-label="Mi ubicación">${raw(icon('gps'))}</button>
      </div>

      <div class="sheet" id="sheet"></div>
    </div>
  `;

  // Se le pasa el elemento y no el id: asi no depende de que este montado
  // en el documento en el momento exacto de la llamada.
  gl.createMap(q(host, '#map'), {
    onReady: () => locate({ silent: true }),
    onTap: () => hideSuggestions(),
    onLongPress: (point) => setPointFromMap(point)
  });

  wire(host, {
    '#menu': openDrawer,
    '#locate': () => locate({ silent: false }),
    '#panic': () => go('emergencia')
  });

  /* ------------------------------------------------------------------------
     Hoja inferior
  ------------------------------------------------------------------------ */

  const sheet = () => q(host, '#sheet');

  function drawSheet() {
    if (stage === 'trip') return drawTrip();
    if (stage === 'route') return drawRoute();
    drawSearch();
  }

  // --- buscar ---------------------------------------------------------------

  function drawSearch() {
    const truck = selectedTruck();

    render(sheet(), html`
      <div class="sheet-grab"></div>

      <button class="row card-tap" id="pick-truck"
              style="background:none;border:0;padding:4px 2px;color:inherit;width:100%">
        <span style="color:var(--brand)">${raw(icon('truck', 20))}</span>
        <span class="grow truncate" style="text-align:left;font-weight:600;font-size:14.5px">
          ${truck ? truck.name : 'Elegí un camión'}
        </span>
        <span class="muted">${truck ? formatTruck(truck) : 'Tocá para elegir'}</span>
      </button>

      <div class="waypoint">
        <span class="dot dot-a"></span>
        <input id="origin" placeholder="Origen" autocomplete="off"
               value="${origin?.label ?? ''}">
      </div>

      <div class="waypoint">
        <span class="dot dot-b"></span>
        <input id="destination" placeholder="¿A dónde vas?" autocomplete="off"
               value="${destination?.label ?? ''}">
      </div>

      <div id="suggestions"></div>

      <button class="btn btn-primary btn-block" id="calc"
              ${origin && destination && truck ? '' : 'disabled'}>
        Calcular ruta
      </button>

      <p class="hint" style="text-align:center">
        Mantené apretado el mapa para fijar un punto.
      </p>
    `);

    wire(sheet(), {
      '#pick-truck': () => go('camiones'),
      '#calc': (event) => calculate(event.currentTarget),
      '#origin@input': onType('origin'),
      '#destination@input': onType('destination'),
      '#origin@focus': () => { editing = 'origin'; },
      '#destination@focus': () => { editing = 'destination'; }
    });
  }

  // --- ruta calculada -------------------------------------------------------

  function drawRoute() {
    const share = Math.round(route.heavyNetworkSharePercent);
    const notes = groupNotes(route);

    render(sheet(), html`
      <div class="sheet-grab"></div>

      <div class="row-between">
        <div class="route-summary">
          <div class="route-figure">
            <b class="num">${formatDistance(route.distanceMeters)}</b>
            <span>Distancia</span>
          </div>
          <div class="route-figure">
            <b class="num">${formatDuration(route.durationSeconds)}</b>
            <span>Llegás ${arrivalTime(route.durationSeconds)}</span>
          </div>
        </div>
        <button class="fab" id="close-route" aria-label="Descartar">${raw(icon('close', 20))}</button>
      </div>

      <div class="stack-sm">
        <div class="network-bar"><i style="width:${share}%"></i></div>
        <p class="hint">
          <b style="color:var(--brand-ink)">${share}%</b> del recorrido va por la Red
          de Tránsito Pesado${route.truckName ? `, con ${route.truckName}` : ''}.
        </p>
      </div>

      ${notes.length ? raw(notesMarkup(notes)) : raw(`
        <div class="note" style="border-left-color:var(--ok)">
          <div class="note-title">Sin restricciones en el camino</div>
          <div class="note-body">Ningún tramo de esta ruta limita a tu vehículo.</div>
        </div>
      `)}

      <button class="btn btn-primary btn-block" id="start">Arrancar viaje</button>
    `);

    wire(sheet(), {
      '#close-route': () => {
        route = null;
        stage = 'search';
        gl.clearRoute();
        drawSheet();
      },
      '#start': (event) => startTrip(event.currentTarget)
    });
  }

  // --- viaje en curso -------------------------------------------------------

  function drawTrip() {
    const trip = state.activeTrip;

    render(sheet(), html`
      <div class="sheet-grab"></div>

      <div class="row">
        <span class="pill pill-brand">Viaje en curso</span>
        <span class="grow"></span>
        <span class="muted num">${formatDistance(trip.plannedDistanceMeters)}</span>
      </div>

      <div class="stack-sm">
        <div class="row">
          <span class="dot dot-b" style="width:10px;height:10px;border-radius:50%;background:var(--destination)"></span>
          <b class="grow truncate">${trip.destinationLabel ?? 'Destino marcado en el mapa'}</b>
        </div>
        <p class="hint">
          Con ${trip.truckName}. Estimado ${formatDuration(trip.plannedDurationSeconds)}.
        </p>
      </div>

      <div class="row" style="gap:10px">
        <button class="btn btn-ghost grow" id="cancel-trip">Abandonar</button>
        <button class="btn btn-primary grow" id="finish-trip">Llegué</button>
      </div>

      <p class="hint" style="text-align:center">
        Los kilómetros se acreditan al llegar.
      </p>
    `);

    wire(sheet(), {
      '#finish-trip': (event) => closeTrip(event.currentTarget, true),
      '#cancel-trip': (event) => closeTrip(event.currentTarget, false)
    });
  }

  /* ------------------------------------------------------------------------
     Busqueda de direcciones
  ------------------------------------------------------------------------ */

  const hideSuggestions = () => {
    const box = q(host, '#suggestions');
    if (box) box.innerHTML = '';
  };

  /**
   * Se espera a que deje de escribir y se exigen tres caracteres.
   *
   * El geocoder es un servicio publico y gratuito: consultar en cada tecla seria
   * abusar de el. Ver AD-10 en decisions.md.
   */
  const onType = (which) =>
    debounce(async (event) => {
      const text = event.target.value.trim();
      editing = which;

      if (text.length < 3) return hideSuggestions();

      try {
        const places = await api.searchPlaces(text);
        showSuggestions(places);
      } catch {
        hideSuggestions();
      }
    }, 350);

  function showSuggestions(places) {
    const box = q(host, '#suggestions');
    if (!box) return;

    if (!places.length) {
      render(box, html`<p class="hint" style="padding:8px 2px">No encontramos esa dirección.</p>`);
      return;
    }

    render(box, html`
      <ul class="suggestions">
        ${raw(places.map((place, index) => html`
          <li data-index="${index}">
            <span class="s-main truncate">${place.label}</span>
            ${place.secondary ? raw(`<span class="s-sub truncate">${escapeText(place.secondary)}</span>`) : ''}
          </li>
        `).join(''))}
      </ul>
    `);

    qa(box, 'li').forEach((node) => {
      node.addEventListener('click', () => {
        const place = places[Number(node.dataset.index)];
        setPoint(editing, { lat: place.latitude, lng: place.longitude, label: place.label });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Puntos
  ------------------------------------------------------------------------ */

  function setPoint(which, point) {
    if (which === 'origin') {
      origin = point;
      gl.setOrigin(point);
    } else {
      destination = point;
      gl.setDestination(point);
    }

    hideSuggestions();
    drawSheet();
    gl.flyTo(point);
  }

  /** Mantener apretado el mapa fija el punto que se este editando. */
  async function setPointFromMap(point) {
    const which = editing;

    setPoint(which, { ...point, label: 'Resolviendo dirección…' });

    try {
      const place = await api.reverseGeocode(point.lat, point.lng);
      const label = place?.label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
      setPoint(which, { ...point, label });
    } catch {
      setPoint(which, { ...point, label: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` });
    }
  }

  /**
   * Ubicacion actual como origen.
   *
   * Se dispara sola al abrir el mapa —el documento pide que el origen ya venga
   * cargado— y en silencio: si el permiso esta denegado no tiene sentido molestar
   * a alguien que todavia no pidio nada.
   */
  async function locate({ silent }) {
    let point;

    try {
      point = await getPosition();
    } catch (error) {
      if (!silent) toastError(error.message);
      return;
    }

    gl.setGpsPosition(point);

    // Solo se toma como origen si todavia no hay uno elegido a mano.
    if (origin) {
      gl.flyTo(point);
      return;
    }

    setPoint('origin', { ...point, label: 'Tu ubicación actual' });
    editing = 'destination';

    try {
      const place = await api.reverseGeocode(point.lat, point.lng);

      // Se comprueba que el usuario no haya cambiado el origen mientras tanto:
      // resolver la direccion tarda, y pisarle lo que eligio seria peor que no
      // mostrar la calle.
      if (place && origin?.label === 'Tu ubicación actual') {
        origin = { ...point, label: place.label };
        drawSheet();
      }
    } catch {
      // Queda "Tu ubicación actual", que igual sirve para rutear.
    }
  }

  /* ------------------------------------------------------------------------
     Ruta y viaje
  ------------------------------------------------------------------------ */

  async function calculate(button) {
    const truck = selectedTruck();
    if (!truck || !origin || !destination) return;

    await withBusy(button, 'Calculando', async () => {
      try {
        route = await api.route(
          truck.id,
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: destination.lat, longitude: destination.lng }
        );

        gl.drawRoute(route, route.accessLegs ?? []);
        stage = 'route';
        drawSheet();
      } catch (error) {
        toastError(error.message);
      }
    });
  }

  async function startTrip(button) {
    const truck = selectedTruck();

    await withBusy(button, 'Arrancando', async () => {
      try {
        const started = await api.startTrip({
          truckId: truck.id,
          origin: { latitude: origin.lat, longitude: origin.lng },
          destination: { latitude: destination.lat, longitude: destination.lng },
          originLabel: origin.label,
          destinationLabel: destination.label
        });

        setState({ activeTrip: started.trip });
        route = started.route;
        gl.drawRoute(started.route, started.route.accessLegs ?? []);
        stage = 'trip';
        drawSheet();
      } catch (error) {
        // 409: quedo un viaje abierto de antes. Se ofrece cerrarlo en vez de
        // dejar al usuario trabado sin saber por que.
        if (error.status === 409 && error.problem?.tripId) {
          if (confirm('Tenés un viaje sin terminar. ¿Lo cerramos para arrancar este?')) {
            await api.cancelTrip(error.problem.tripId);
            await startTrip(button);
            return;
          }
        }

        toastError(error.message);
      }
    });
  }

  async function closeTrip(button, arrived) {
    const trip = state.activeTrip;

    await withBusy(button, arrived ? 'Cerrando' : 'Abandonando', async () => {
      try {
        const closed = arrived
          ? await api.finishTrip(trip.id)
          : await api.cancelTrip(trip.id);

        setState({ activeTrip: null });
        stage = 'search';
        route = null;
        gl.clearRoute();
        drawSheet();

        if (arrived && closed.creditedDistanceMeters > 0) {
          toastOk(`Llegaste. Sumaste ${formatDistance(closed.creditedDistanceMeters)}.`);
        } else if (arrived) {
          toastOk('Viaje cerrado. No sumó kilómetros: pasó muy poco tiempo.');
        } else {
          toastOk('Viaje abandonado.');
        }
      } catch (error) {
        toastError(error.message);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Arranque
  ------------------------------------------------------------------------ */

  // Si quedo un viaje abierto de una sesion anterior, se retoma.
  if (state.activeTrip) {
    stage = 'trip';
  }

  drawSheet();

  return () => gl.destroyMap();
}

/* ---------------------------------------------------------------------------
   Restricciones
--------------------------------------------------------------------------- */

/**
 * Agrupa los hallazgos por regla en vez de listar tramo por tramo.
 *
 * Una ruta larga puede traer decenas de notas que dicen todas lo mismo. Al
 * camionero le sirve "salís de la Red en 3 tramos, 2,1 km en total", no treinta
 * renglones iguales.
 */
function groupNotes(route) {
  const all = [...(route.restrictionNotes ?? []), ...(route.accessLegs ?? [])];
  const groups = new Map();

  for (const note of all) {
    for (const finding of note.findings ?? []) {
      const key = finding.kind;

      if (!groups.has(key)) {
        groups.set(key, {
          kind: finding.kind,
          description: finding.description,
          ruleReference: finding.ruleReference,
          dataReference: finding.dataReference,
          isAccess: note.requiresAccessException,
          segments: 0,
          meters: 0,
          streets: new Set()
        });
      }

      const group = groups.get(key);
      group.segments += 1;
      group.meters += note.distanceMeters ?? 0;
      if (note.streetName) group.streets.add(note.streetName);
    }
  }

  return [...groups.values()];
}

const KIND_TITLES = {
  OutsideHeavyTrafficNetwork: 'Salís de la Red de Tránsito Pesado',
  MaxHeight: 'Altura limitada',
  MaxWeight: 'Peso limitado',
  MaxWidth: 'Ancho limitado',
  MaxLength: 'Largo limitado',
  HgvProhibited: 'Camiones prohibidos'
};

function notesMarkup(groups) {
  return `<div class="notes">${groups.map((group) => {
    const title = KIND_TITLES[group.kind] ?? group.kind;
    const streets = [...group.streets].slice(0, 3).join(', ');

    return `
      <div class="note ${group.isAccess ? 'note-access' : 'note-blocked'}">
        <div class="note-title">${escapeText(title)}</div>
        <div class="note-body">${escapeText(group.description)}</div>
        <div class="note-source">
          ${group.segments} ${group.segments === 1 ? 'tramo' : 'tramos'} ·
          ${formatDistance(group.meters)}${streets ? ` · ${escapeText(streets)}` : ''}
        </div>
        <details class="sources">
          <summary></summary>
          <div class="note-source">
            <b>Regla:</b> ${escapeText(group.ruleReference)}<br>
            <b>Dato:</b> ${escapeText(group.dataReference)}
          </div>
        </details>
      </div>
    `;
  }).join('')}</div>`;
}

const formatTruck = (truck) =>
  `${(truck.grossWeightKg / 1000).toFixed(1).replace('.0', '')} t · ${truck.heightMeters} m`;

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
