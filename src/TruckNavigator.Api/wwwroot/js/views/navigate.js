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
import {
  getPosition, watchPosition, watchHeading, speak, keepScreenAwake, onTrackingFailed
} from '../platform.js';
import {
  prepareRoute, advance, shouldReroute, pendingAnnouncement,
  speakableInstruction, maneuverArrow
} from '../navigation.js';
import * as gl from '../map.js';
import { state, setState, prefs, savePrefs, selectedTruck } from '../store.js';
import {
  html, raw, icon, wire, q, qa, render, debounce, withBusy,
  formatDistance, formatDuration, arrivalTime, toast, toastOk, toastError,
  cardinal, cardinalName, askChoice, askConfirm
} from '../ui.js';

export function navigateView(host, { openDrawer, go }) {
  let origin = null;          // { lat, lng, label }
  let destination = null;
  let route = null;
  let stage = 'search';       // 'search' | 'route' | 'navigation'
  let editing = 'destination';

  // --- estado de la navegacion en curso ---
  let prepared = null;        // ruta preparada por el motor
  let navState = null;        // ultimo estado calculado
  let previousNav = null;     // el anterior, para saber que umbral se cruzo
  let announced = new Set();  // avisos ya dichos
  let stopWatching = null;    // corta el seguimiento del GPS
  let rerouting = false;
  let lastRerouteAt = null;

  // Si el viaje arranco pero todavia no llego ninguna posicion. Lo unico que
  // cambia es lo que dice la pantalla, y no es poco: sin esto mostraba un guion
  // y nada mas, indistinguible de una app trabada.
  let waitingForGps = false;
  let trackingProblem = null;

  const host0 = host;

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
        <!--
            Zoom con botones, no solo con pellizco: el pellizco pide dos dedos y
            una mano libre, y arriba de un camión suele haber una sola.
            Se esconden durante el viaje, donde la cámara sigue al vehículo y
            cualquier zoom manual quedaría deshecho en el próximo latido del GPS.
        -->
        <div class="zoom-pair" id="zoom">
          <button id="zoom-in" aria-label="Acercar">+</button>
          <button id="zoom-out" aria-label="Alejar">−</button>
        </div>

        <div class="compass" id="compass" hidden>
          <button class="fab compass-dial" id="compass-dial"
                  aria-label="Brújula: hacia dónde estás mirando">
            <svg class="compass-needle" viewBox="0 0 40 40" aria-hidden="true">
              <path class="compass-n" d="M20 4 L25.5 22 L20 19 L14.5 22 Z"/>
              <path class="compass-s" d="M20 36 L14.5 18 L20 21 L25.5 18 Z"/>
            </svg>
          </button>
          <span class="compass-facing" id="compass-facing">—</span>
        </div>

        <button class="fab" id="layers" aria-label="Capas de camión">${raw(icon('bridge'))}</button>
        <button class="fab" id="locate" aria-label="Mi ubicación">${raw(icon('gps'))}</button>
      </div>

      <div class="sheet" id="sheet"></div>
    </div>
  `;

  // Se le pasa el elemento y no el id: asi no depende de que este montado
  // en el documento en el momento exacto de la llamada.
  gl.createMap(q(host, '#map'), {
    onReady: () => {
      // Las capas de camion ya estan puestas. Se aplican la preferencia
      // guardada y la altura del camion elegido, que es la que decide de que
      // color se pinta cada galibo.
      gl.showTruckLayers(prefs.truckLayers);
      gl.useTruckHeight(selectedTruck()?.heightMeters);
      updateLayerButton();
      locate({ silent: true });
    },
    onTap: (feature) => { hideSuggestions(); explicarSimbolo(feature); },
    onLongPress: (point) => setPointFromMap(point)
  });

  /**
   * Tocar un simbolo del mapa dice, en palabras, que es.
   *
   * Un icono chico no puede explicarse solo, y una leyenda fija ocupa pantalla y
   * nadie la lee. Es lo que hacen Maps y Waze: el mapa muestra el simbolo, el
   * toque lo explica.
   */
  function explicarSimbolo(feature) {
    if (!feature) return;

    const p = feature.properties ?? {};

    if (feature.layer?.id === 'altura-senal') {
      const altura = Number(p.metres).toFixed(2).replace('.', ',');
      const camion = selectedTruck();
      const donde = p.name ? ` en ${p.name}` : '';

      if (camion && p.metres < camion.heightMeters) {
        toastError(`Altura máxima ${altura} m${donde}. No pasás: tu camión mide ${camion.heightMeters} m.`);
      } else {
        toast(`Puente con altura máxima de ${altura} m${donde}.`, 'info');
      }

      return;
    }

    if (feature.layer?.id === 'paso-senal') {
      const barrera = {
        no: 'sin barrera',
        yes: 'con barrera', full: 'con barrera completa',
        half: 'con media barrera', double_half: 'con doble media barrera'
      }[p.barrier];

      toast(`Paso a nivel ${barrera ?? '— la fuente no dice si tiene barrera'}.`, 'info');
      return;
    }

    if (feature.layer?.id === 'radar-punto') {
      toast(`Radar de velocidad · ${p.ubicacion}`, 'info');
      return;
    }

    if (feature.layer?.id === 'zona-riesgo' || feature.layer?.id === 'zona-riesgo-senal') {
      const nivel = { alta: 'alta', 'muy-alta': 'muy alta', extrema: 'extrema' }[p.nivel] ?? p.nivel;
      const veces = String(p.veces).replace('.', ',');
      const barrio = p.barrio ? `${p.barrio} · ` : '';

      // Se dice el numero crudo y contra que se compara. "Zona peligrosa" a
      // secas no se puede discutir ni verificar; "87 robos denunciados, el
      // quintuple del promedio" si — y deja claro que es un dato de denuncias
      // de un anio, no un veredicto sobre el barrio.
      const vehiculos = p.automotor > 0 ? ` ${p.automotor} fueron de vehículos.` : '';

      toast(
        `${barrio}zona de riesgo ${nivel}: ${p.hechos} robos denunciados en ${p.anio}, ` +
        `${veces} veces el promedio de la Ciudad.${vehiculos}`,
        p.nivel === 'alta' ? 'info' : 'warn',
        7000
      );
    }
  }

  wire(host, {
    '#menu': openDrawer,
    '#locate': () => locate({ silent: false }),
    '#panic': () => go('emergencia'),
    '#layers': () => toggleTruckLayers(),
    '#compass-dial': () => explainHeading(),
    '#zoom-in': () => gl.zoomIn(),
    '#zoom-out': () => gl.zoomOut()
  });

  /**
   * Prende y apaga las capas de camion.
   *
   * Se puede apagar a proposito: con la Red, los galibos y los pasos a nivel
   * encendidos el mapa dice mucho, y a veces lo que hace falta es ver la calle
   * limpia. La eleccion se recuerda.
   */
  function toggleTruckLayers() {
    savePrefs({ truckLayers: !prefs.truckLayers });
    gl.showTruckLayers(prefs.truckLayers);
    updateLayerButton();

    toastOk(prefs.truckLayers
      ? 'Red, puentes y pasos a nivel a la vista.'
      : 'Capas de camión apagadas.');
  }

  /** El boton se pinta segun si las capas estan encendidas. */
  function updateLayerButton() {
    const button = q(host, '#layers');
    if (button) button.style.color = prefs.truckLayers ? 'var(--brand)' : 'var(--ink-3)';
  }

  /* ------------------------------------------------------------------------
     Brujula

     Dos lecturas del mismo dato, porque responden preguntas distintas:

       · la aguja del dial dice DONDE QUEDA EL NORTE respecto del telefono. Es
         una brujula de verdad, y sirve igual con el mapa girado.
       · el cono sobre el punto de la ubicacion dice HACIA DONDE SE ESTA
         MIRANDO, pero dibujado sobre el mapa, que es donde estan las calles.

     El cartelito de abajo dice el punto cardinal en letras, porque leer "SO" es
     instantaneo y deducirlo de una aguja no lo es.
  ------------------------------------------------------------------------ */

  let heading = null;

  // Los grados se acumulan sin envolver en 360. Si la aguja saltara de 359 a 1,
  // la animacion CSS la haria dar la vuelta entera por el lado largo.
  let needleTurn = 0;

  function onHeading(reading) {
    heading = reading;

    // Sin brujula el cono se esconde: una flecha clavada al norte seria peor que
    // no mostrar nada, porque parece un dato.
    gl.setGpsHeading(reading ? reading.degrees : null);

    const compass = q(host0, '#compass');
    if (!compass) return;

    compass.hidden = !reading;
    if (!reading) return;

    compass.classList.toggle('compass-rough', !reading.reliable);

    const needle = q(host0, '.compass-needle');

    if (needle) {
      const previous = ((needleTurn % 360) + 360) % 360;
      let step = reading.degrees - previous;

      if (step > 180) step -= 360;
      else if (step < -180) step += 360;

      needleTurn += step;

      // La aguja apunta al norte, o sea al reves de hacia donde apunta el
      // telefono: mirando al este, el norte queda a la izquierda.
      needle.style.transform = `rotate(${-needleTurn}deg)`;
    }

    setText(compass, '.compass-facing', cardinal(reading.degrees));
  }

  /** Tocar el dial dice el rumbo con todas las letras. */
  function explainHeading() {
    if (!heading) return;

    if (!heading.reliable) {
      toast(
        'La brújula está sin calibrar. Movés el teléfono dibujando un ocho en el aire ' +
        'y se acomoda sola.',
        'warn');

      return;
    }

    toastOk(`Estás mirando al ${cardinalName(heading.degrees)} · ${Math.round(heading.degrees)}°`);
  }

  /* ------------------------------------------------------------------------
     Hoja inferior
  ------------------------------------------------------------------------ */

  const sheet = () => q(host, '#sheet');

  /**
   * La hoja cambia de forma segun el estado: hoja inferior para buscar y
   * planificar, barra angosta durante el viaje.
   *
   * Es siempre el mismo nodo y lo que cambia es la clase. Antes la pantalla de
   * viaje reemplazaba el nodo por otro y le copiaba el id, asi que al cerrar el
   * viaje el buscador se dibujaba adentro de un contenedor que seguia siendo la
   * barra de navegacion, con sus estilos puestos.
   */
  function sheetAs(className) {
    const node = sheet();
    node.className = className;
    return node;
  }

  function drawSheet() {
    if (stage === 'navigation') return drawNavigation();
    if (stage === 'route') return drawRoute();
    drawSearch();
  }

  // --- buscar ---------------------------------------------------------------

  function drawSearch() {
    const truck = selectedTruck();

    // El mismo puente pasa de informativo a peligroso al cambiar de vehiculo, y
    // esa es justamente la informacion que importa. Se repinta cada vez que se
    // vuelve a esta pantalla, que es por donde se pasa despues de elegir camion.
    gl.useTruckHeight(truck?.heightMeters);

    render(sheetAs('sheet'), html`
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
        <button class="waypoint-clear" id="clear-origin" type="button"
                aria-label="Borrar el origen"
                ${origin?.label ? '' : 'hidden'}>${raw(icon('close', 16))}</button>
      </div>

      <div class="waypoint">
        <span class="dot dot-b"></span>
        <input id="destination" placeholder="¿A dónde vas?" autocomplete="off"
               value="${destination?.label ?? ''}">
        <button class="waypoint-clear" id="clear-destination" type="button"
                aria-label="Borrar el destino"
                ${destination?.label ? '' : 'hidden'}>${raw(icon('close', 16))}</button>
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
      '#origin@input': onInput('origin'),
      '#destination@input': onInput('destination'),
      '#origin@focus': () => { editing = 'origin'; },
      '#destination@focus': () => { editing = 'destination'; },
      '#clear-origin': () => clearPoint('origin'),
      '#clear-destination': () => clearPoint('destination')
    });
  }

  /**
   * Escribir hace dos cosas, y a distinto ritmo.
   *
   * La cruz aparece y desaparece **en la tecla**, porque un boton que tarda
   * medio segundo en aparecer se siente roto. La busqueda va con espera, que es
   * lo que evita consultarle al geocoder en cada letra.
   */
  const onInput = (which) => {
    const search = onType(which);

    return (event) => {
      showClear(which, event.target.value.length > 0);
      search(event);
    };
  };

  /**
   * Los botones de zoom, solo fuera del viaje.
   *
   * Durante el viaje la camara sigue al vehiculo y se reencuadra en cada
   * posicion: un zoom manual quedaria deshecho al segundo siguiente. Ofrecer un
   * boton que no hace efecto es peor que no ofrecerlo.
   */
  function showZoomControls(visible) {
    const node = q(host0, '#zoom');
    if (node) node.hidden = !visible;
  }

  function showClear(which, visible) {
    const button = q(host0, `#clear-${which}`);
    if (button) button.hidden = !visible;
  }

  /**
   * Borra un extremo del viaje.
   *
   * Borra las tres cosas que forman ese extremo —el texto, el punto guardado y
   * el marcador del mapa—, no solo la que se ve. Borrar el texto y dejar el
   * marcador puesto seria peor que no borrar nada: la pantalla diria una cosa y
   * el mapa otra.
   *
   * No hace falta ocuparse de la ruta: con una calculada la hoja muestra el
   * resumen, que no tiene estos campos. Para volver acá hay que descartarla
   * antes, y de eso se encarga su propio boton.
   */
  function clearPoint(which) {
    editing = which;
    setPoint(which, null);

    // El teclado queda listo para escribir el reemplazo. Borrar casi siempre es
    // el primer paso de corregir, no un fin en si mismo.
    q(host0, `#${which}`)?.focus();
  }

  // --- ruta calculada -------------------------------------------------------

  function drawRoute() {
    const share = Math.round(route.heavyNetworkSharePercent);
    const notes = groupNotes(route);

    render(sheetAs('sheet'), html`
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

  // --- viaje en curso: navegacion -------------------------------------------

  /**
   * Pantalla de navegacion.
   *
   * Se mira de reojo, a sesenta por hora. Una sola maniobra, enorme, y la
   * distancia mas grande que todo lo demas: es el dato que se lee de un vistazo.
   * El resto —restricciones, fuentes, kilometros— se corre de en medio.
   */
  function drawNavigation() {
    const trip = state.activeTrip;
    const nav = navState;

    if (rerouting) {
      render(sheetAs('nav-bar'), '');
      renderOverlay(html`
        <div class="rerouting">
          <span class="spinner"></span>
          <span>Te saliste de la ruta. Buscando otra…</span>
        </div>
      `);
      return;
    }

    // Todavia sin posicion: se dice que se esta buscando, en vez de un guion.
    // Es la diferencia entre "esperá, está enganchando" y "esto no anda".
    if (waitingForGps && !nav) {
      renderOverlay(html`
        <div class="maneuver">
          <div class="maneuver-arrow"><span class="spinner"></span></div>
          <div class="maneuver-body">
            <div class="maneuver-street" style="font-size:15px">
              ${trackingProblem ?? 'Buscando señal de GPS…'}
            </div>
            <div class="maneuver-substreet">
              ${trackingProblem
                ? 'El viaje quedó abierto: podés cerrarlo desde Salir.'
                : 'Bajo techo puede tardar. Al aire libre engancha enseguida.'}
            </div>
          </div>
        </div>
      `);
    } else {
      const upcoming = nav?.next ?? null;
      const arrow = upcoming ? maneuverArrow(upcoming.kind) : '↑';
      const distance = nav ? formatDistance(nav.distanceToManeuver) : '—';

      renderOverlay(html`
        <div class="maneuver">
          <div class="maneuver-arrow">${arrow}</div>
          <div class="maneuver-body">
            <div class="maneuver-distance num">${distance}</div>
            <div class="maneuver-street">
              ${upcoming ? (upcoming.streetName || upcoming.text) : 'Seguí la ruta'}
            </div>
          </div>
        </div>

        ${raw(restrictionAheadMarkup(nav))}
      `);
    }

    const bar = sheetAs('nav-bar');
    bar.innerHTML = html`
      <div class="nav-eta">
        <b>${nav ? arrivalTime(nav.remainingSeconds) : arrivalTime(trip.plannedDurationSeconds)}</b>
        <span>Llegada</span>
      </div>
      <div class="nav-eta">
        <b class="num">${nav ? formatDistance(nav.remainingMeters) : formatDistance(trip.plannedDistanceMeters)}</b>
        <span>Restante</span>
      </div>
      <div class="grow"></div>
      <button class="btn btn-ghost" id="stop-nav">Salir</button>
    `;

    wire(bar, { '#stop-nav': () => askToStop() });
  }

  /**
   * Aviso de restriccion, solo cuando esta cerca.
   *
   * Mostrar la lista entera de restricciones mientras se maneja es ruido: lo
   * util es saber que el puente bajo esta a doscientos metros, no que la ruta
   * tiene nueve tramos fuera de la Red.
   */
  function restrictionAheadMarkup(nav) {
    if (!nav || !route) return '';

    const ahead = (route.restrictionNotes ?? []).find((note) => {
      if (note.requiresAccessException) return false;
      if (note.fromPointIndex < nav.index) return false;
      return note.fromPointIndex - nav.index <= 6;
    });

    if (!ahead) return '';

    const finding = ahead.findings?.[0];
    if (!finding) return '';

    return `<div class="maneuver-alert"><span>⚠</span><span>${escapeText(finding.description)}</span></div>`;
  }

  /**
   * Salir del viaje.
   *
   * Las tres salidas se muestran juntas en vez de encadenar dos preguntas: al
   * camionero le importa la diferencia —llegar acredita kilometros y abandonar
   * no— y encadenarlas hacia que "no" a la primera pareciera cancelar todo.
   */
  async function askToStop() {
    const choice = await askChoice({
      title: '¿Salís del viaje?',
      message: 'Si llegaste, se acreditan los kilómetros. Si lo abandonás, no suma nada.',
      options: [
        { id: 'arrived', label: 'Llegué a destino', kind: 'primary' },
        { id: 'abandon', label: 'Abandonar el viaje', kind: 'danger' },
        { id: 'stay', label: 'Seguir viaje', kind: 'ghost' }
      ]
    });

    if (choice === 'stay' || choice === null) return;

    closeTrip(document.getElementById('stop-nav'), choice === 'arrived');
  }

  /** Capa de maniobra por encima del mapa, encima de la barra superior. */
  function renderOverlay(markup) {
    let host = q(host0, '#nav-overlay');

    if (!host) {
      host = document.createElement('div');
      host.id = 'nav-overlay';
      host.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;z-index:3';
      q(host0, '.map-overlay').after(host);
    }

    host.innerHTML = markup;
  }

  function clearOverlay() {
    q(host0, '#nav-overlay')?.remove();
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
      // Unico lugar que fuerza un acercamiento, y solo si el mapa esta mas
      // lejos: "Mi ubicacion" con la ciudad entera en pantalla no mostraria
      // nada. Del resto de la app el zoom del usuario no se toca.
      gl.flyTo(point, { minZoom: 15 });
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

        // La ruta se guarda en el estado compartido, no solo en la variable de
        // la vista: es lo que permite retomar el viaje si la app se cierra.
        setState({ activeTrip: started.trip, activeRoute: started.route });
        route = started.route;
        gl.drawRoute(started.route, started.route.accessLegs ?? []);
        stage = 'navigation';
        startNavigating();
      } catch (error) {
        // 409: quedo un viaje abierto de antes. Se ofrece cerrarlo en vez de
        // dejar al usuario trabado sin saber por que.
        //
        // Con el viaje abierto ya recuperado al entrar, llegar aca es raro: pasa
        // si quedo abierto en otro telefono. Se mantiene igual, porque el
        // servidor es el que manda sobre que viajes hay.
        if (error.status === 409 && error.problem?.tripId) {
          const cerrar = await askConfirm({
            title: 'Tenés un viaje sin terminar',
            message: 'Para arrancar este hay que abandonar el anterior. No suma kilómetros.',
            confirmLabel: 'Abandonar el anterior y arrancar',
            cancelLabel: 'Dejarlo como está',
            danger: true
          });

          if (cerrar) {
            await api.cancelTrip(error.problem.tripId);
            setState({ activeTrip: null, activeRoute: null });
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

        // Primero se apaga la navegacion y despues se cambia de pantalla.
        //
        // Sin esto el viaje se cerraba en el servidor pero la app seguia
        // navegando: el GPS seguia observado —y con el, el servicio en primer
        // plano de Android y su notificacion de viaje—, la pantalla seguia sin
        // poder apagarse y el cartel de la proxima maniobra quedaba encima del
        // mapa. Visto desde afuera, el viaje "seguia abierto".
        //
        // Llegar a destino ya lo hacia bien; salir a mano, no.
        stopNavigating();

        setState({ activeTrip: null, activeRoute: null });
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
     El bucle de navegacion

     Cada posicion del GPS entra por aca. No hay temporizador propio: el ritmo lo
     marca el GPS, que es la unica fuente de verdad sobre donde esta el camion.
     Un temporizador ademas seguiria latiendo con la pantalla apagada sin nada
     nuevo que decir.
  ------------------------------------------------------------------------ */

  function startNavigating() {
    prepared = prepareRoute(route);

    navState = null;
    previousNav = null;
    announced = new Set();
    rerouting = false;
    lastRerouteAt = null;

    // La camara se inclina ya, en el origen del viaje. No espera al GPS: entre
    // tocar el boton y el primer fix pueden pasar decenas de segundos, y sin
    // ningun cambio en pantalla la app parece no haber hecho nada.
    gl.enterNavigationMode(origin);
    showZoomControls(false);
    keepScreenAwake(true);

    waitingForGps = true;
    drawSheet();

    // La primera instruccion se dice al arrancar y no por umbral: el camion ya
    // esta encima de ella, asi que nunca llega a cruzar uno.
    const first = prepared?.instructions?.[1] ?? prepared?.instructions?.[0];

    if (first) {
      speak(speakableInstruction(first, first.distanceMeters));
    }

    stopWatching = watchPosition(onPosition, destination?.label);
  }

  function stopNavigating() {
    stopWatching?.();
    stopWatching = null;

    keepScreenAwake(false);
    gl.exitNavigationMode();
    showZoomControls(true);
    clearOverlay();

    prepared = null;
    navState = null;
    previousNav = null;
    announced = new Set();
    rerouting = false;
    waitingForGps = false;
    trackingProblem = null;
  }

  async function onPosition(fix) {
    if (!prepared || rerouting) return;

    // Primera posicion del viaje: se sale del cartel de "buscando" y se rehace
    // la pantalla entera, porque el bloque de maniobra tiene otra forma. Los
    // latidos siguientes solo tocan los numeros.
    const wasWaiting = waitingForGps;
    waitingForGps = false;
    trackingProblem = null;

    previousNav = navState;
    navState = advance(prepared, fix, navState);

    gl.followVehicle(navState.snapped, navState.bearing);
    gl.trimRoute(route.geometry.coordinates, navState.index, navState.snapped);

    const announcement = pendingAnnouncement(navState, previousNav, announced);

    if (announcement) {
      announced.add(announcement.key);
      speak(speakableInstruction(navState.next, navState.distanceToManeuver));
    }

    // El primer fix cambia la forma de la pantalla —del cartel de "buscando" al
    // bloque de maniobra—, asi que se rehace entera. Los demas latidos solo
    // tocan los numeros, que es lo que evita tirar el trabajo del navegador una
    // vez por segundo.
    if (wasWaiting) {
      drawSheet();
    } else {
      updateNavigationUi();
    }

    if (navState.hasArrived) {
      await arrive();
      return;
    }

    if (shouldReroute(navState, lastRerouteAt)) {
      await reroute(fix);
    }
  }

  /**
   * Actualiza los numeros sin volver a dibujar la pantalla.
   *
   * Rehacer el marcado en cada latido del GPS tira el trabajo del navegador una
   * vez por segundo y, sobre todo, corta cualquier animacion en curso. Se tocan
   * solo los tres nodos que cambian.
   */
  function updateNavigationUi() {
    const overlay = q(host0, '#nav-overlay');

    if (!overlay || rerouting) {
      drawSheet();
      return;
    }

    const upcoming = navState?.next ?? null;

    setText(overlay, '.maneuver-distance', formatDistance(navState.distanceToManeuver));
    setText(overlay, '.maneuver-arrow', upcoming ? maneuverArrow(upcoming.kind) : '↑');
    setText(overlay, '.maneuver-street',
      upcoming ? (upcoming.streetName || upcoming.text) : 'Seguí la ruta');

    const bar = q(host0, '#sheet');
    const figures = bar ? bar.querySelectorAll('.nav-eta b') : [];

    if (figures.length === 2) {
      figures[0].textContent = arrivalTime(navState.remainingSeconds);
      figures[1].textContent = formatDistance(navState.remainingMeters);
    }
  }

  function setText(root, selector, text) {
    const node = root.querySelector(selector);
    if (node && node.textContent !== text) node.textContent = text;
  }

  /**
   * Recalcula desde donde esta el camion hasta el mismo destino.
   *
   * El viaje NO se cierra ni se abre otro: el que se registro sigue siendo el
   * mismo y sus kilometros previstos tambien. Cambiar el viaje porque el
   * conductor se salio de la ruta convertiria cada desvio en un viaje nuevo y
   * partiria el historial en pedazos.
   */
  async function reroute(fix) {
    rerouting = true;
    lastRerouteAt = Date.now();
    drawSheet();

    speak('Recalculando.');

    try {
      const truck = selectedTruck();

      const fresh = await api.route(
        truck.id,
        { latitude: fix.lat, longitude: fix.lng },
        { latitude: destination.lat, longitude: destination.lng }
      );

      route = fresh;
      prepared = prepareRoute(fresh);

      // El estado arranca de cero: los indices de la ruta vieja no significan
      // nada sobre la nueva, y los avisos ya dichos son de otras maniobras.
      navState = null;
      previousNav = null;
      announced = new Set();

      gl.drawRoute(fresh, fresh.accessLegs ?? []);
      origin = { ...fix, label: 'Tu ubicación actual' };
    } catch (error) {
      toastError(`No se pudo recalcular: ${error.message}`);
    } finally {
      rerouting = false;
      drawSheet();
    }
  }

  /**
   * Retoma el viaje que quedo abierto.
   *
   * El viaje vive en el servidor y sobrevive a cerrar la aplicacion; esta
   * pantalla no. Al volver, el estado de la vista arranca vacio: sin esto la app
   * mostraba la busqueda como si no pasara nada, dejaba elegir otro destino y
   * recien al arrancar el servidor devolvia 409, con un mensaje que desde afuera
   * es incomprensible porque en pantalla no habia ningun viaje.
   *
   * El origen y el destino salen del viaje registrado, no de lo que hubiera
   * quedado escrito en los campos de busqueda.
   */
  function resumeTrip() {
    const trip = state.activeTrip;

    origin = {
      lat: trip.originLatitude,
      lng: trip.originLongitude,
      label: trip.originLabel ?? 'Donde arrancaste'
    };

    destination = {
      lat: trip.destinationLatitude,
      lng: trip.destinationLongitude,
      label: trip.destinationLabel ?? 'Tu destino'
    };

    stage = 'navigation';

    // Sin ruta no se puede guiar, pero el viaje sigue abierto y cerrarlo no
    // necesita rutear. Se entra igual a la pantalla de viaje: es la unica que
    // tiene el boton para salir.
    if (!state.activeRoute) {
      toastError('Retomamos tu viaje, pero no se pudo recuperar la ruta. Podés cerrarlo desde "Salir".');
      return;
    }

    route = state.activeRoute;

    gl.drawRoute(route, route.accessLegs ?? []);
    startNavigating();
  }

  async function arrive() {
    const trip = state.activeTrip;
    if (!trip) return;

    stopNavigating();
    speak('Llegaste a destino.');

    try {
      const closed = await api.finishTrip(trip.id);
      setState({ activeTrip: null, activeRoute: null });

      toastOk(closed.creditedDistanceMeters > 0
        ? `Llegaste. Sumaste ${formatDistance(closed.creditedDistanceMeters)}.`
        : 'Llegaste. No sumó kilómetros: pasó muy poco tiempo.');
    } catch (error) {
      toastError(error.message);
    }

    stage = 'search';
    route = null;
    gl.clearRoute();
    drawSheet();
  }

  /* ------------------------------------------------------------------------
     Arranque
  ------------------------------------------------------------------------ */

  // La cascara avisa por su propio canal si no pudo arrancar el seguimiento.
  // Sin esto la pantalla se quedaba diciendo "buscando señal" para siempre,
  // aunque el motivo real fuera un permiso denegado.
  const stopListeningTracking = onTrackingFailed((message) => {
    trackingProblem = message;
    if (stage === 'navigation') drawSheet();
  });

  // La brujula se lee solo mientras el mapa esta a la vista: los sensores gastan
  // bateria y ninguna otra pantalla la muestra.
  const stopListeningHeading = watchHeading(onHeading);

  // Si quedo un viaje abierto de una sesion anterior, se retoma.
  if (state.activeTrip) {
    resumeTrip();
  }

  drawSheet();

  return () => {
    stopListeningTracking();
    stopListeningHeading();
    stopNavigating();
    gl.destroyMap();
  };
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
