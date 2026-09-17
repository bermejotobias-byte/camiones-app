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
  getPosition, watchPosition, watchHeading, speak, keepScreenAwake, onTrackingFailed,
  vibrate, VIBRACION
} from '../platform.js';
import {
  prepareRoute, advance, shouldReroute, pendingAnnouncement,
  speakableInstruction, ANNOUNCE_VIBRATE_AT,
  alertsAlongRoute, pendingRouteAlert, speakableAlert, maneuverArrowPath
} from '../navigation.js';
import * as gl from '../map.js';
import { montarViaje, estadoDeBanda } from '../mapa/viaje.js';
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
  let routeOptions = [];      // la recomendada y sus alternativas, ya ordenadas
  let chosenRoute = 0;        // cuál de todas se está mirando
  let stage = 'search';       // 'search' | 'route' | 'delivery' | 'navigation'

  // --- modo reparto ---
  let stops = [];             // paradas como las cargó el usuario
  let deliveryOrder = null;   // índices sobre `stops`, en el orden de visita
  let editing = 'destination';

  // --- estado de la navegacion en curso ---
  let prepared = null;        // ruta preparada por el motor
  let navState = null;        // ultimo estado calculado
  let previousNav = null;     // el anterior, para saber que umbral se cruzo
  let announced = new Set();  // avisos de maniobra ya dichos
  let routeAlerts = [];       // galibos, pasos a nivel y radares sobre la ruta
  let alerted = new Set();    // avisos de ruta ya dados
  let stopWatching = null;    // corta el seguimiento del GPS
  let rerouting = false;
  let lastRerouteAt = null;
  let viaje = null;           // la pantalla del viaje (js/mapa/viaje.js), mientras dura

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
        <button class="fab" id="risk" aria-label="Zonas peligrosas">${raw(icon('warning'))}</button>
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
      gl.showRiskZones(prefs.riskZones);
      gl.useTruckHeight(selectedTruck()?.heightMeters);
      updateLayerButton();
      updateRiskButton();
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
      // Sin números, a propósito. Antes decía cuántos robos hubo y cuántas veces
      // el promedio de la Ciudad: era un dato que el conductor no puede usar
      // manejando y que además invitaba a comparar zonas con una precisión que
      // la fuente no tiene. Lo único accionable es si conviene parar acá o no.
      //
      // Y no dice "segura" en ningún caso: este mapa marca lo peligroso, así que
      // lo que no está marcado es lo que nadie marcó, no lo que alguien revisó.
      const donde = p.barrio ? ` · ${p.barrio}` : '';

      toast(`Zona peligrosa${donde}. Marcada por conductores, no es un dato oficial.`, 'warn', 6000);
    }
  }

  wire(host, {
    '#menu': openDrawer,
    '#locate': () => locate({ silent: false }),
    '#panic': () => go('emergencia'),
    '#layers': () => toggleTruckLayers(),
    '#risk': () => toggleRiskZones(),
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

  /**
   * Prende y apaga el mapa de zonas peligrosas.
   *
   * Va aparte de las capas de camión a propósito: son datos de naturaleza
   * distinta. La Red y los gálibos son oficiales y dicen por dónde puede pasar
   * el vehículo; las zonas peligrosas son el juicio de gente que trabaja en la
   * calle sobre dónde no conviene parar. Quien quiere una no necesariamente
   * quiere la otra, y el sombreado cubre área, así que es lo primero que uno
   * quiere sacar del medio para leer el mapa.
   */
  function toggleRiskZones() {
    savePrefs({ riskZones: !prefs.riskZones });
    gl.showRiskZones(prefs.riskZones);
    updateRiskButton();

    toastOk(prefs.riskZones
      ? 'Zonas peligrosas a la vista.'
      : 'Zonas peligrosas apagadas.');
  }

  function updateRiskButton() {
    const button = q(host, '#risk');
    if (button) button.style.color = prefs.riskZones ? 'var(--danger)' : 'var(--ink-3)';
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
    if (stage === 'delivery') return drawDelivery();
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

      <button class="btn btn-ghost btn-block" id="delivery-mode">
        Modo reparto · hasta 10 paradas
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
      '#clear-destination': () => clearPoint('destination'),
      '#delivery-mode': () => entrarEnReparto()
    });
  }

  /* ------------------------------------------------------------------------
     Modo reparto

     Hasta diez paradas, y el servidor decide en qué orden conviene visitarlas.
     El orden NO es el que uno carga: se calcula con distancias reales de ruta
     —no en línea recta— porque en una ciudad con un río y autopistas la ruta
     real llega a ser 1,67 veces la recta, y ahí el orden cambia. Ver AD-41.
  ------------------------------------------------------------------------ */

  function entrarEnReparto() {
    stage = 'delivery';

    // El destino de un viaje simple pasa a ser la primera parada: si uno ya lo
    // había cargado, perderlo al cambiar de modo es tirarle el trabajo.
    if (destination && !stops.length) {
      stops = [destination];
      destination = null;
      gl.setDestination(null);
    }

    editing = 'stop';
    deliveryOrder = null;
    drawSheet();
  }

  function salirDelReparto() {
    stage = 'search';
    stops = [];
    deliveryOrder = null;
    editing = 'destination';

    gl.setDeliveryStops([]);
    gl.clearRoute();
    drawSheet();
  }

  /** Las paradas en el orden en que se visitan, o como se cargaron si no se calculó. */
  const paradasEnOrden = () =>
    deliveryOrder ? deliveryOrder.map((i) => stops[i]) : stops;

  function drawDelivery() {
    const truck = selectedTruck();
    const orden = paradasEnOrden();
    const lleno = stops.length >= 10;

    render(sheetAs('sheet'), html`
      <div class="sheet-grab"></div>

      <div class="row-between">
        <b style="font-size:15px">Reparto</b>
        <button class="fab" id="close-delivery" aria-label="Salir del reparto">${raw(icon('close', 20))}</button>
      </div>

      <div class="waypoint">
        <span class="dot dot-a"></span>
        <input id="origin" placeholder="Origen" autocomplete="off"
               value="${origin?.label ?? ''}">
      </div>

      ${orden.length ? raw(`<ol class="stop-list">${orden.map((parada, i) => `
        <li>
          <span class="stop-number">${i + 1}</span>
          <span class="stop-label truncate">${escapeText(parada.label ?? 'Parada')}</span>
          <button class="waypoint-clear" data-quitar="${stops.indexOf(parada)}"
                  type="button" aria-label="Quitar esta parada">${icon('close', 16)}</button>
        </li>`).join('')}</ol>`) : raw(`
        <p class="hint">Agregá las paradas del día. El orden lo resolvemos nosotros.</p>
      `)}

      ${raw(lleno
        ? '<p class="hint">Llegaste a las 10 paradas.</p>'
        : `<div class="waypoint">
             <span class="dot dot-b"></span>
             <input id="new-stop" placeholder="Agregar parada" autocomplete="off" value="">
           </div>`)}

      <div id="suggestions"></div>

      ${deliveryOrder ? raw(`
        <div class="stack-sm">
          <div class="network-bar"><i style="width:${Math.round(route.heavyNetworkSharePercent)}%"></i></div>
          <p class="hint">
            <b class="num">${formatDistance(route.distanceMeters)}</b> ·
            <b class="num">${formatDuration(route.durationSeconds)}</b> ·
            <b style="color:var(--brand-ink)">${Math.round(route.heavyNetworkSharePercent)}%</b> por la Red
          </p>
        </div>`) : ''}

      <div class="sheet-action">
        ${deliveryOrder ? raw(`
          <button class="btn btn-primary btn-block" id="start-delivery">
            Arrancar reparto
          </button>
          <button class="btn btn-ghost btn-block" id="calc-delivery"
                  style="margin-top:8px">
            Recalcular
          </button>
        `) : raw(`
          <button class="btn btn-primary btn-block" id="calc-delivery"
                  ${stops.length && origin && truck ? '' : 'disabled'}>
            Calcular reparto
          </button>
        `)}
      </div>
    `);

    wire(sheet(), {
      '#close-delivery': () => salirDelReparto(),
      '#calc-delivery': (event) => calcularReparto(event.currentTarget),
      '#start-delivery': (event) => startTrip(event.currentTarget),
      '#origin@input': onInput('origin'),
      '#origin@focus': () => { editing = 'origin'; },
      '#new-stop@input': onInput('stop'),
      '#new-stop@focus': () => { editing = 'stop'; }
    });

    for (const boton of qa(sheet(), '[data-quitar]')) {
      boton.addEventListener('click', () => quitarParada(Number(boton.dataset.quitar)));
    }
  }

  function quitarParada(index) {
    if (!Number.isInteger(index) || index < 0 || index >= stops.length) return;

    stops.splice(index, 1);

    // El orden calculado apunta a los índices viejos: sacar una parada lo
    // invalida entero. Mostrarlo igual haría que los números de la lista y los
    // del mapa dejaran de corresponderse con la ruta dibujada.
    deliveryOrder = null;

    gl.setDeliveryStops(stops);
    gl.clearRoute();
    drawSheet();
  }

  async function calcularReparto(button) {
    const truck = selectedTruck();
    if (!truck || !origin || !stops.length) return;

    await withBusy(button, 'Ordenando paradas', async () => {
      try {
        const resultado = await api.delivery(
          truck.id,
          { latitude: origin.lat, longitude: origin.lng },
          stops.map((p) => ({ latitude: p.lat, longitude: p.lng })));

        route = resultado.route;
        deliveryOrder = resultado.stopOrder;

        gl.drawRoute(route, route.accessLegs ?? []);
        gl.setDeliveryStops(paradasEnOrden());
        drawSheet();

        toastOk(`${stops.length} paradas ordenadas.`);
      } catch (error) {
        toastError(error.message);
      }
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

      ${routeOptions.length > 1 ? raw(alternativesMarkup()) : ''}

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

      <div class="sheet-action">
        <button class="btn btn-primary btn-block" id="start">Arrancar viaje</button>
      </div>
    `);

    wire(sheet(), {
      '#close-route': () => {
        route = null;
        routeOptions = [];
        chosenRoute = 0;
        stage = 'search';
        gl.clearRoute();
        drawSheet();
      },
      '#start': (event) => startTrip(event.currentTarget)
    });

    for (const boton of qa(sheet(), '.route-option')) {
      boton.addEventListener('click', () => elegirRuta(Number(boton.dataset.index)));
    }
  }

  /**
   * Las rutas posibles, para elegir mirando el mapa.
   *
   * Cada opción dice lo que decide: si obliga a pasar por donde el camión no
   * puede, cuánto tarda y cuánto va por la Red. **El tiempo no va primero** —
   * es lo que mira un GPS de auto, y acá una ruta cinco minutos más larga que
   * no obliga a salir de la Red es mejor.
   */
  function alternativesMarkup() {
    return routeOptions.map((opcion, i) => {
      const bloqueos = (opcion.restrictionNotes ?? []).filter((n) => !n.requiresAccessException).length;
      const red = Math.round(opcion.heavyNetworkSharePercent);
      const elegida = i === chosenRoute;

      const estado = bloqueos > 0
        ? `<span style="color:var(--danger)">${bloqueos} tramo${bloqueos > 1 ? 's' : ''} que no podés transitar</span>`
        : `<span style="color:var(--ok)">Sin tramos prohibidos</span>`;

      return `
        <button class="route-option${elegida ? ' is-chosen' : ''}" data-index="${i}">
          <div class="route-option-head">
            <b>${i === 0 ? 'Recomendada' : `Alternativa ${i}`}</b>
            <span>${formatDuration(opcion.durationSeconds)} · ${formatDistance(opcion.distanceMeters)}</span>
          </div>
          <div class="route-option-note">${estado} · ${red}% por la Red</div>
        </button>`;
    }).join('');
  }

  /** Cambia la ruta que se está mirando, y la dibuja. */
  function elegirRuta(index) {
    if (!Number.isInteger(index) || !routeOptions[index] || index === chosenRoute) return;

    chosenRoute = index;
    route = routeOptions[index];

    gl.drawRoute(route, route.accessLegs ?? []);
    drawSheet();
  }

  // --- viaje en curso: navegacion -------------------------------------------

  /**
   * Pantalla de navegacion.
   *
   * Se mira de reojo, a sesenta por hora. Una sola maniobra, enorme, y la
   * distancia mas grande que todo lo demas: es el dato que se lee de un vistazo.
   *
   * La dibuja `js/mapa/viaje.js` con las medidas de Waze; aca solo se le dice
   * que mostrar. Mientras dura el viaje, la capa de controles del reposo se
   * esconde entera (`is-viaje`): la pantalla del viaje tiene los suyos.
   */
  function drawNavigation() {
    if (!viaje) {
      host0.classList.add('is-viaje');

      viaje = montarViaje(host0, {
        alSalir: () => askToStop(),
        alVistaGeneral: () => toast('La vista general llega en la próxima etapa.'),
        alAportar: () => toast('Aportar un lugar llega en la próxima etapa.'),
        alSos: () => go('emergencia'),
        alVoz: () => alternarVoz(),
        vozApagada: prefs.voz === false
      });
    }

    pintarViaje();
  }

  /** Lo que muestra la pantalla del viaje, a partir del estado de la vista. */
  function pintarViaje() {
    if (!viaje) return;

    const trip = state.activeTrip;

    viaje.banda(estadoDeBanda({
      recalculando: rerouting,
      esperandoGps: waitingForGps,
      problema: trackingProblem,
      nav: navState
    }));

    viaje.hoja(navState
      ? { segundos: navState.remainingSeconds, metros: navState.remainingMeters }
      : { segundos: trip?.plannedDurationSeconds ?? null, metros: trip?.plannedDistanceMeters ?? null });

    viaje.calle(navState?.step?.streetName ?? null);
  }

  /**
   * La voz se puede silenciar desde el viaje, como en Waze. Se recuerda: quien
   * la apaga una vez no quiere volver a apagarla en cada viaje. La vibracion
   * sigue: es el canal que no compite con el ruido de la cabina (AD-39).
   */
  function alternarVoz() {
    savePrefs({ voz: prefs.voz === false });
    viaje?.voz(prefs.voz === false);
    toast(prefs.voz === false ? 'Voz silenciada. Las vibraciones siguen.' : 'Voz activada.');
  }

  /** Dice una frase, salvo que la voz este silenciada. */
  function decir(texto) {
    if (prefs.voz === false) return;
    speak(texto);
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

    // Sin boton: la accion sale de un circulo con una cruz, donde no cabe un
    // "Cerrando…". El cartel de eleccion ya se cerro; lo que sigue es rapido.
    closeTrip(null, choice === 'arrived');
  }

  /** Saca la pantalla del viaje y devuelve los controles del reposo. */
  function desmontarViaje() {
    viaje?.destruir();
    viaje = null;
    host0.classList.remove('is-viaje');
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
    if (which === 'stop') {
      // Una parada más del reparto. El orden calculado deja de valer: sus
      // índices son sobre la lista anterior.
      if (stops.length < 10) stops.push(point);

      deliveryOrder = null;
      gl.setDeliveryStops(stops);
      gl.clearRoute();

      hideSuggestions();
      drawSheet();
      gl.flyTo(point);
      return;
    }

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
        const calculada = await api.route(
          truck.id,
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: destination.lat, longitude: destination.lng }
        );

        // El backend manda la recomendada en la raíz y las otras en
        // `alternatives`, ya ordenadas por lo que le conviene a un camión:
        // primero las que menos tramos prohibidos tienen, después las que
        // menos dependen de la excepción de acceso, y recién ahí por tiempo.
        routeOptions = [calculada, ...(calculada.alternatives ?? [])];
        chosenRoute = 0;
        route = calculada;

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

    // Desde el reparto el viaje es el mismo, con una diferencia: el destino es la
    // ULTIMA parada del orden calculado y las demas viajan como intermedias. Sin
    // esto el servidor recalcularia una ruta directa y se perderian las paradas
    // —el camion saldria a hacer el reparto por un camino que no es el que se le
    // mostro—. Ver AD-45.
    const enReparto = stage === 'delivery' && deliveryOrder;
    const orden = enReparto ? paradasEnOrden() : null;

    const destino = enReparto ? orden[orden.length - 1] : destination;
    const intermedias = enReparto ? orden.slice(0, -1) : [];

    await withBusy(button, 'Arrancando', async () => {
      try {
        const started = await api.startTrip({
          truckId: truck.id,
          origin: { latitude: origin.lat, longitude: origin.lng },
          destination: { latitude: destino.lat, longitude: destino.lng },
          originLabel: origin.label,
          destinationLabel: destino.label,

          // Campo opcional: sin paradas el pedido queda igual que siempre.
          ...(intermedias.length
            ? { stops: intermedias.map((p) => ({ latitude: p.lat, longitude: p.lng })) }
            // La ruta que se está mirando es la que arranca: el servidor la
            // vuelve a calcular por el mismo camino y toma la de esta posición.
            : { routeIndex: chosenRoute })
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

        // Tambien se limpia el reparto, si el viaje venia de uno. Sin esto las
        // paradas quedaban en memoria y sus marcadores numerados en el mapa,
        // mientras la hoja mostraba la busqueda vacia: puntos en la pantalla que
        // ya no pertenecen a ningun viaje ni figuran en ninguna lista.
        stops = [];

        // Si llego, la pantalla de fin de viaje: es donde se ve lo que dejo.
        // Abandonar no festeja nada.
        if (arrived) {
          setState({ cerrado: closed });
          go('fin');
          return;
        }
        deliveryOrder = null;
        gl.setDeliveryStops([]);

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

    // Lo que hay sobre el camino se calcula UNA vez, acá, y no en cada latido
    // del GPS: cruzar la posición contra 685 gálibos, 312 pasos a nivel y 129
    // radares una vez por segundo es trabajo de sobra para un teléfono que
    // además está dibujando el mapa.
    routeAlerts = alertsAlongRoute(prepared, gl.datasets());
    alerted = new Set();

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
    avisarViaje(true);

    waitingForGps = true;
    drawSheet();

    // La primera instruccion se dice al arrancar y no por umbral: el camion ya
    // esta encima de ella, asi que nunca llega a cruzar uno.
    const first = prepared?.instructions?.[1] ?? prepared?.instructions?.[0];

    if (first) {
      decir(speakableInstruction(first, first.distanceMeters));
    }

    stopWatching = watchPosition(onPosition, destination?.label);
  }

  /**
   * Le avisa a la cascara que el viaje empieza o termina. Es un evento y no una
   * llamada para que el mapa no tenga que conocer al zocalo: el zocalo se
   * esconde durante el viaje (decision del usuario del 12/09/2026) y al irse le
   * devuelve su alto al mapa, que hay que redimensionar al frame siguiente,
   * cuando el layout ya cambio.
   */
  function avisarViaje(enCurso) {
    document.dispatchEvent(new CustomEvent('viaje', { detail: { enCurso } }));
    requestAnimationFrame(() => gl.resize());
  }

  function stopNavigating() {
    stopWatching?.();
    stopWatching = null;

    keepScreenAwake(false);
    gl.exitNavigationMode();
    showZoomControls(true);
    desmontarViaje();
    avisarViaje(false);

    prepared = null;
    routeAlerts = [];
    alerted = new Set();
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
    marcarManiobra();

    const announcement = pendingAnnouncement(navState, previousNav, announced);

    if (announcement) {
      announced.add(announcement.key);
      decir(speakableInstruction(navState.next, navState.distanceToManeuver));

      // Vibra sólo en el último aviso, el de 80 m, y no en los tres. Vibrar en
      // cada umbral convierte la maniobra en tres sacudones desde 800 m antes,
      // y a esa altura uno deja de prestarles atención — que es justo lo que la
      // vibración no se puede permitir.
      if (announcement.meters === ANNOUNCE_VIBRATE_AT) {
        vibrate(VIBRACION.maniobra);
      }
    }

    avisarLoQueViene();

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
   * Avisa de lo que viene sobre el camino: un puente que no da, un paso a nivel
   * o un radar.
   *
   * Cada tipo vibra distinto. Si todo vibrara igual, lo único que se sabría es
   * "algo pasa" y habría que mirar la pantalla — que es justo lo que la
   * vibración vino a evitar.
   */
  function avisarLoQueViene() {
    if (!navState) return;

    const alerta = pendingRouteAlert(
      routeAlerts, navState.travelledMeters, previousNav?.travelledMeters ?? null, alerted);

    if (!alerta) return;

    alerted.add(alerta.key);

    vibrate(VIBRACION[alerta.tipo] ?? VIBRACION.maniobra);

    const frase = speakableAlert(alerta);
    if (frase) decir(frase);

    // Además del sonido y la vibración, queda escrito: si el teléfono está en
    // silencio o el motor tapó la voz, el aviso tiene que poder leerse. Es
    // informativo —el motor ya excluyó los gálibos que no se pasan—, así que
    // va como aviso y no como error.
    if (alerta.tipo === 'galibo') {
      toast(`Gálibo de ${alerta.metres.toFixed(2).replace('.', ',')} m a ${alerta.meters} m. Pasás.`);
    }
  }

  /**
   * La flecha blanca sobre la calle, en la proxima maniobra.
   *
   * Se calcula sobre la ruta preparada y el mapa la redibuja solo cuando la
   * maniobra cambia (la clave es su vertice). La llegada no lleva flecha: ahi
   * lo que se ve es la bandera del destino.
   */
  function marcarManiobra() {
    const proxima = navState?.next;

    if (!proxima || proxima.kind === 'Finish') {
      gl.showManeuver(null);
      return;
    }

    gl.showManeuver(maneuverArrowPath(prepared, proxima.fromPointIndex), proxima.fromPointIndex);
  }

  /**
   * Actualiza los numeros sin volver a dibujar la pantalla.
   *
   * La pantalla del viaje toca solo los nodos que cambian: rehacer el marcado
   * en cada latido del GPS tira el trabajo del navegador una vez por segundo
   * y corta cualquier animacion en curso.
   */
  function updateNavigationUi() {
    if (!viaje) {
      drawSheet();
      return;
    }

    pintarViaje();
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

    decir('Recalculando.');

    try {
      const truck = selectedTruck();

      const fresh = await api.route(
        truck.id,
        { latitude: fix.lat, longitude: fix.lng },
        { latitude: destination.lat, longitude: destination.lng }
      );

      route = fresh;
      prepared = prepareRoute(fresh);

      // La ruta nueva pasa por otro lado: lo que había sobre la anterior no
      // sirve, y las claves de los avisos ya dados apuntan a otros índices.
      routeAlerts = alertsAlongRoute(prepared, gl.datasets());
      alerted = new Set();

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
    decir('Llegaste a destino.');

    try {
      const closed = await api.finishTrip(trip.id);
      setState({ activeTrip: null, activeRoute: null, cerrado: closed });

      stage = 'search';
      route = null;
      gl.clearRoute();

      // La pantalla de fin de viaje reemplaza al aviso de antes: ahi se ven los
      // kilometros, la EXP y lo desbloqueado, y ahi esta la mascota.
      go('fin');
      return;
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
