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
  vibrate, VIBRACION, call
} from '../platform.js';
import {
  prepareRoute, advance, shouldReroute, pendingAnnouncement,
  speakableInstruction, ANNOUNCE_VIBRATE_AT,
  alertsAlongRoute, pendingRouteAlert, speakableAlert, maneuverArrowPath
} from '../navigation.js';
import * as gl from '../map.js';
import { montarViaje, estadoDeBanda, globosDeRuta, textoDeAviso } from '../mapa/viaje.js';
import {
  porDonde, lineaDeTiempo, opcionesDeRuta, elegirAlternativa, mismaRuta,
  textoDeEstado, chipsDeRuta, cabeceraDeRutas, pildoraDelCamion, hojaRutas,
  cabeceraSimple, hojaDetalles, loQueImporta, filasDelCamino, fuentesDeLaRuta
} from '../mapa/rutas.js';
import { hojaReposo } from '../mapa/reposo.js';
import { hojaBuscar, cuerpoDeBusqueda } from '../mapa/buscar.js';
import { categoriasParaPedir, fichaDeLugar, fichaLugar } from '../mapa/lugares.js';
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
  let avisosPorOpcion = [];   // lo que hay en el camino de cada una: radares, galibos, pasos
  let chosenRoute = 0;        // cuál de todas se está mirando
  let stage = 'search';       // 'search' (reposo) | 'buscar' | 'route' | 'detalles' | 'ficha' | 'delivery' | 'navigation'

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
      cargarLugares();
      cargarLugaresDelMapa();
    },
    onTap: (feature) => { hideSuggestions(); explicarSimbolo(feature); },
    onLongPress: (point) => setPointFromMap(point),
    // El usuario movio el mapa durante el viaje: la camara deja de seguir al
    // camion y aparece "Volver a centrar" (waze-08).
    onPan: () => viaje?.movido(true)
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

    if (feature.layer?.id === 'lugar-pin') {
      abrirFicha(p.id);
      return;
    }

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
    // Mientras se elige ruta, los controles del mapa se van: la pantalla es
    // la cabecera, la tira de mapa y la lista.
    host0.classList.toggle('is-eligiendo', stage === 'route' || stage === 'detalles');

    if (stage === 'navigation') return drawNavigation();
    if (stage === 'route') return drawRutas();
    if (stage === 'detalles') return drawDetalles();
    if (stage === 'ficha') return drawFicha();
    if (stage === 'delivery') return drawDelivery();
    if (stage === 'buscar') return drawBuscar();
    drawReposo();
  }

  /* ------------------------------------------------------------------------
     Reposo y busqueda (waze-03 y waze-05)

     En reposo hay una hoja de 150 con la pildora "¿Adónde vas?" y los atajos
     de Casa, Deposito y Nuevo. Tocar cualquiera abre la busqueda, que cubre el
     mapa: categorias, Casa y Deposito, recientes, mas opciones y, desde la
     tercera letra, las sugerencias del geocoder (AD-10). Elegir un destino
     calcula la ruta directo: no hay boton de "Calcular".
  ------------------------------------------------------------------------ */

  // Casa y Deposito viven en el servidor (AD-43); los recientes salen de los viajes.
  let lugares = { Home: null, Depot: null };
  let recientes = [];
  let busqueda = null;   // { objetivo, texto, sugerencias } mientras la hoja esta abierta

  /* ------------------------------------------------------------------------
     La capa de lugares (js/mapa/lugares.js)

     Los puntos de interes de las categorias que el camionero tiene
     prendidas (prefs.lugares.categorias, los chips de la busqueda) como pines
     sobre el mapa. Se piden con el camion elegido: asi cada lugar vuelve con
     los votos de camiones como el suyo y con el voto propio. "Solo aptos"
     arranca apagado; la hoja de capas lo prende (tarea 24).
  ------------------------------------------------------------------------ */

  let lugaresEnMapa = [];   // los ultimos pedidos, para abrir la ficha por id

  async function cargarLugaresDelMapa() {
    const categorias = categoriasParaPedir(prefs.lugares?.categorias ?? []);

    if (!categorias) {
      lugaresEnMapa = [];
      gl.showPlaces([]);
      return;
    }

    try {
      lugaresEnMapa = await api.pois(categorias, selectedTruck()?.id, prefs.lugares?.soloAptos ? true : undefined);
      gl.showPlaces(lugaresEnMapa);
    } catch (error) {
      toastError(`No se pudieron traer los lugares: ${error.message}`);
    }
  }

  /* ------------------------------------------------------------------------
     La ficha de un lugar y el voto (el prototipo, tableros "Lugar")

     Tocar un pin en reposo abre la ficha como hoja inferior: lo verificado
     separado de lo comunitario, el voto propio, Llamar e Ir. Votar de nuevo
     cambia el voto; tocar el voto que ya esta lo retira. Lo que paga lo dice
     el servidor (`earned`): el toast del voto es lo unico que dice EXP en el
     mapa. Los votos nunca tocan lo verificado (AD-46).
  ------------------------------------------------------------------------ */

  let ficha = null;   // el lugar abierto, mientras la hoja esta
  let ultimaPosicion = null;

  function abrirFicha(id) {
    const lugar = lugaresEnMapa.find((p) => p.id === id);
    if (!lugar) return;

    // Con una ruta en pantalla o en viaje el pin solo se nombra: la ficha
    // taparia lo que se esta mirando.
    if (stage !== 'search' && stage !== 'ficha') {
      toast(lugar.name, 'info');
      return;
    }

    ficha = lugar;
    stage = 'ficha';
    drawSheet();
  }

  function cerrarFicha() {
    ficha = null;
    stage = 'search';
    drawSheet();
  }

  function drawFicha() {
    const hoja = sheetAs('gps-hoja-ficha');
    hoja.innerHTML = fichaLugar(fichaDeLugar(ficha, { camion: selectedTruck(), desde: ultimaPosicion }));

    hoja.onclick = (event) => {
      const boton = event.target.closest('[data-accion]');
      if (!boton) return;

      const { accion, veredicto } = boton.dataset;
      if (accion === 'cerrar') cerrarFicha();
      if (accion === 'votar') votarLugar(veredicto, boton);
      if (accion === 'llamar') call(ficha.phone);
      if (accion === 'ir') irAlLugar();
    };
  }

  async function votarLugar(veredicto, boton) {
    const camion = selectedTruck();
    if (!camion) { toast('Elegí un camión para votar: el voto dice para qué tipo vale.'); return; }

    const lugar = ficha;
    const retirar = lugar.community?.yourVote === veredicto;

    await withBusy(boton, retirar ? 'Retirando' : 'Guardando', async () => {
      try {
        if (retirar) {
          await api.retirePoiVote(lugar.id);
          lugar.community = await comunidadActualizada(lugar);
          toast('Voto retirado.');
        } else {
          const { community, earned } = await api.votePoi(lugar.id, camion.id, veredicto);
          lugar.community = community;
          toast(earned?.contributionExperience ? `Voto guardado • +${earned.contributionExperience} EXP` : 'Voto guardado.');
        }
      } catch (error) {
        toastError(`No se pudo votar: ${error.message}`);
        return;
      }

      // El pin puede cambiar de estado (de "sin confirmar" a "de la comunidad").
      gl.showPlaces(lugaresEnMapa);
      if (ficha === lugar) drawFicha();
    });
  }

  /** Despues de retirar el voto el servidor no devuelve la ficha: se vuelve a pedir. */
  async function comunidadActualizada(lugar) {
    const actual = (await api.pois(lugar.category, selectedTruck()?.id)).find((p) => p.id === lugar.id);
    return actual?.community ?? { ...lugar.community, yourVote: null };
  }

  function irAlLugar() {
    const destino = { label: ficha.name, latitude: ficha.latitude, longitude: ficha.longitude };
    cerrarFicha();
    elegirLugar(destino);
  }

  async function cargarLugares() {
    try {
      const [guardados, ultimos] = await Promise.all([api.savedPlaces(), api.recentPlaces()]);
      lugares = { Home: null, Depot: null };
      for (const lugar of guardados ?? []) lugares[lugar.kind] = lugar;
      recientes = ultimos ?? [];
    } catch {
      // Sin sesion o sin red: la hoja anda igual, sin atajos.
    }

    if (stage === 'search' || stage === 'buscar') drawSheet();
  }

  function drawReposo() {
    const truck = selectedTruck();

    // El mismo puente pasa de informativo a peligroso al cambiar de vehiculo, y
    // esa es justamente la informacion que importa. Se repinta cada vez que se
    // vuelve a esta pantalla, que es por donde se pasa despues de elegir camion.
    gl.useTruckHeight(truck?.heightMeters);

    const hoja = sheetAs('gps-hoja-reposo');
    hoja.innerHTML = hojaReposo({ casa: lugares.Home, deposito: lugares.Depot });

    hoja.onclick = (event) => {
      const boton = event.target.closest('[data-accion]');
      if (!boton) return;

      const { accion, kind } = boton.dataset;
      if (accion === 'buscar') abrirBusqueda('destination');
      if (accion === 'fijar-guardado') abrirBusqueda(kind);
      if (accion === 'ir-a-guardado') elegirLugar(lugares[kind]);
    };
  }

  function abrirBusqueda(objetivo) {
    stage = 'buscar';
    busqueda = { objetivo, texto: '', sugerencias: null };
    host0.classList.add('is-buscando');
    drawSheet();
    q(host0, '#gps-buscar-texto')?.focus();
  }

  function cerrarBusqueda() {
    busqueda = null;
    stage = 'search';
    host0.classList.remove('is-buscando');
    drawSheet();
  }

  const estadoDeBusqueda = () => ({
    ...busqueda,
    casa: lugares.Home,
    deposito: lugares.Depot,
    recientes,
    origen: origin?.label ?? null,
    categorias: prefs.lugares?.categorias ?? []
  });

  function drawBuscar() {
    const hoja = sheetAs('gps-hoja-buscar');
    hoja.innerHTML = hojaBuscar(estadoDeBusqueda());

    const input = q(hoja, '#gps-buscar-texto');

    // Mientras se escribe se rehace solo el cuerpo: rehacer la pildora le
    // sacaria el foco al teclado en cada letra.
    input.addEventListener('input', () => {
      busqueda.texto = input.value;
      q(hoja, '.gps-buscar-borrar').hidden = !input.value;
      buscarSugerencias(input.value);
      pintarCuerpoDeBusqueda();
    });

    hoja.onclick = (event) => {
      const boton = event.target.closest('[data-accion]');
      if (!boton) return;

      const { accion, kind, indice, id } = boton.dataset;

      if (accion === 'volver') cerrarBusqueda();
      if (accion === 'borrar') { input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); }
      if (accion === 'sugerencia') elegirLugar(busqueda.sugerencias?.[Number(indice)]);
      if (accion === 'reciente') elegirLugar(recientes[Number(indice)]);
      if (accion === 'ir-a-guardado') elegirLugar(lugares[kind]);
      if (accion === 'fijar-guardado') abrirBusqueda(kind);
      if (accion === 'origen') abrirBusqueda('origin');
      if (accion === 'reparto') { cerrarBusqueda(); entrarEnReparto(); }
      if (accion === 'fijar-en-mapa') { cerrarBusqueda(); toast('Mantené apretado el mapa donde querés ir.'); }

      if (accion === 'categoria') {
        // Las categorias que mira el camionero se recuerdan, y la capa de
        // lugares las prende sobre el mapa.
        const activas = new Set(prefs.lugares?.categorias ?? []);
        activas.has(id) ? activas.delete(id) : activas.add(id);
        savePrefs({ lugares: { ...(prefs.lugares ?? {}), categorias: [...activas] } });
        cargarLugaresDelMapa();
        pintarCuerpoDeBusqueda();
      }
    };
  }

  function pintarCuerpoDeBusqueda() {
    const cuerpo = q(host0, '.gps-buscar-cuerpo');
    if (cuerpo && busqueda) cuerpo.innerHTML = cuerpoDeBusqueda(estadoDeBusqueda());
  }

  /**
   * Se espera a que deje de escribir y se exigen tres caracteres: el geocoder
   * es un servicio publico y gratuito, consultar en cada tecla seria abusar
   * de el (AD-10). Si la respuesta llega para un texto que ya no es el que
   * esta escrito, se descarta.
   */
  const buscarSugerencias = debounce(async (texto) => {
    const consulta = texto.trim();
    if (!busqueda || consulta.length < 3) return;

    busqueda.sugerencias = null;

    try {
      const lugares = await api.searchPlaces(consulta);
      if (busqueda?.texto.trim() !== consulta) return;
      busqueda.sugerencias = lugares.map((p) => ({ label: p.label, secondary: p.secondary, latitude: p.latitude, longitude: p.longitude }));
    } catch {
      if (busqueda) busqueda.sugerencias = [];
    }

    pintarCuerpoDeBusqueda();
  }, 350);

  /**
   * Un lugar elegido en la busqueda, segun que se buscaba: el destino se
   * rutea directo; el origen se fija y se sigue buscando el destino; Casa y
   * Deposito se guardan una vez y se va ("Establecer una vez e ir").
   */
  async function elegirLugar(lugar) {
    if (!lugar) return;

    const punto = { lat: lugar.latitude, lng: lugar.longitude, label: lugar.label };
    const objetivo = busqueda?.objetivo ?? 'destination';

    if (objetivo === 'origin') {
      origin = punto;
      gl.setOrigin(punto);
      abrirBusqueda('destination');
      return;
    }

    if (objetivo === 'Home' || objetivo === 'Depot') {
      try {
        lugares[objetivo] = await api.savePlace(objetivo, { label: lugar.label, latitude: lugar.latitude, longitude: lugar.longitude });
        toastOk(objetivo === 'Home' ? 'Casa guardada.' : 'Depósito guardado.');
      } catch (error) {
        toastError(`No se pudo guardar: ${error.message}`);
        return;
      }
    }

    cerrarBusqueda();
    setPoint('destination', punto);
    await calculate(null);
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

  /* ------------------------------------------------------------------------
     Elegir ruta (el prototipo, tablero "Rutas")

     Cabecera negra con "origen → destino", la tira de mapa con la ruta que se
     esta mirando y la pildora del camion, y una fila por ruta: el tiempo
     manda, y debajo por donde va, cuanto va por la Red y que hay en el
     camino. Tocar una fila la dibuja en el mapa; "Arrancar" arranca por la
     que se esta mirando. Las rutas vienen del servidor ya ordenadas para
     camion y filtradas (AD-47): la primera es la recomendada.

     La hoja es transparente en el medio: la tira de mapa es el mapa mismo,
     encuadrado para que la ruta entre entre la cabecera y la lista.
  ------------------------------------------------------------------------ */

  /** Lo que dice la fila de una opcion. */
  function filaDeOpcion(ruta, indice) {
    return {
      tiempo: formatDuration(ruta.durationSeconds),
      km: formatDistance(ruta.distanceMeters),
      por: porDonde(ruta.instructions),
      estado: textoDeEstado(ruta, indice === 0),
      chips: chipsDeRuta(avisosPorOpcion[indice] ?? [], ruta)
    };
  }

  function drawRutas() {
    const hoja = sheetAs('gps-eligiendo');
    hoja.innerHTML = `
      ${cabeceraDeRutas({ origen: origin, destino: destination })}
      ${pildoraDelCamion(selectedTruck())}
      <div class="gps-hoja-rutas">${hojaRutas({ rutas: routeOptions.map(filaDeOpcion), elegida: chosenRoute })}</div>`;

    hoja.onclick = (event) => {
      const boton = event.target.closest('[data-accion]');
      if (!boton) return;

      const { accion, indice } = boton.dataset;
      if (accion === 'volver') descartarRuta();
      if (accion === 'camion') go('camiones');
      if (accion === 'elegir') elegirRuta(Number(indice));
      if (accion === 'detalles') abrirDetalles();
      if (accion === 'arrancar') startTrip(boton);
    };

    gl.drawRoute(route, route.accessLegs ?? [], encuadreDeLaTira());
  }

  /**
   * El aire alrededor de la ruta para que entre en la tira de mapa: lo que
   * tapan la cabecera y la hoja, medido en el DOM, mas un margen.
   */
  function encuadreDeLaTira() {
    const pantalla = host0.getBoundingClientRect();
    const cabecera = q(host0, '.gps-cabecera')?.getBoundingClientRect();
    const hoja = q(host0, '.gps-hoja-rutas')?.getBoundingClientRect();
    if (!cabecera || !hoja) return undefined;

    return {
      top: cabecera.bottom - pantalla.top + 12,
      bottom: pantalla.bottom - hoja.top + 12,
      left: 30,
      right: 30
    };
  }

  /** Volver atras: la ruta se descarta y queda el mapa en reposo. */
  function descartarRuta() {
    route = null;
    routeOptions = [];
    avisosPorOpcion = [];
    chosenRoute = 0;
    stage = 'search';
    gl.clearRoute();
    drawSheet();
  }

  /** Cambia la ruta que se está mirando, y la dibuja. */
  function elegirRuta(index) {
    if (!Number.isInteger(index) || !routeOptions[index] || index === chosenRoute) return;

    chosenRoute = index;
    route = routeOptions[index];
    drawSheet();
  }

  /* ------------------------------------------------------------------------
     Los detalles de la ruta (el prototipo, tablero "Detalles")

     Las cifras, el mono diciendo lo unico que importa de esta ruta —habla
     una vez, aca, antes de arrancar—, lo que hay en el camino con la calle
     y el km de cada cosa, y las fuentes. "Arrancar" arranca por esta ruta.
  ------------------------------------------------------------------------ */

  function abrirDetalles() {
    stage = 'detalles';
    drawSheet();
  }

  function drawDetalles() {
    const camion = selectedTruck();
    const avisos = avisosPorOpcion[chosenRoute] ?? [];

    const hoja = sheetAs('gps-detallando');
    hoja.innerHTML = `
      ${cabeceraSimple('Detalles de la ruta')}
      ${hojaDetalles({
        tiempo: formatDuration(route.durationSeconds),
        hora: `llegás ${arrivalTime(route.durationSeconds)}`,
        km: formatDistance(route.distanceMeters),
        red: textoDeEstado(route, chosenRoute === 0).replace(/^Mejor ruta, /, ''),
        mono: loQueImporta(route, avisos, camion),
        camino: filasDelCamino(route, avisos, camion),
        fuentes: fuentesDeLaRuta(route, avisos)
      })}`;

    hoja.onclick = (event) => {
      const boton = event.target.closest('[data-accion]');
      if (!boton) return;

      const { accion } = boton.dataset;
      if (accion === 'volver') { stage = 'route'; drawSheet(); }
      if (accion === 'arrancar') startTrip(boton);
    };
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
        alVistaGeneral: () => entrarVistaGeneral(),
        alModo: (modo) => cambiarModoGeneral(modo),
        alReanudar: () => salirVistaGeneral(),
        alIr: (indice) => irPorOpcion(indice),
        alAportar: () => toast('Aportar un lugar llega en la próxima etapa.'),
        alSos: () => go('emergencia'),
        alVoz: () => alternarVoz(),
        alRecentrar: () => { gl.setFollowing(true); viaje?.movido(false); },
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
      // Sin posicion todavia, lo que dice la ruta que se sigue (o el viaje, si
      // tampoco hay ruta): asi cambiar de ruta se refleja antes del primer fix.
      : { segundos: route?.durationSeconds ?? trip?.plannedDurationSeconds ?? null, metros: route?.distanceMeters ?? trip?.plannedDistanceMeters ?? null });

    viaje.calle(navState?.step?.streetName ?? null);

    if (vistaGeneral) pintarVistaGeneral();
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

  /* ------------------------------------------------------------------------
     La vista general del viaje (waze-02 y waze-01)

     La ruta entera, cenital, con la tarjeta de lo que falta; o la lista con
     las otras rutas posibles desde donde esta el camion, cada una con "Ir".
     Cambiar de ruta no cierra el viaje: el viaje guarda origen, destino y
     paradas, no la ruta (AD-45).
  ------------------------------------------------------------------------ */

  let vistaGeneral = null;   // { modo: 'mapa' | 'lista', opciones: [...] } mientras esta abierta

  function entrarVistaGeneral() {
    if (!viaje || !route) return;

    gl.setFollowing(false);
    viaje.movido(false);
    vistaGeneral = { modo: 'mapa', opciones: [] };
    pintarVistaGeneral();

    // Aire para la banda compacta y el conmutador arriba, y la tarjeta abajo.
    gl.fitRoute(route.geometry.coordinates, { top: 150, bottom: 260, left: 40, right: 40 });
  }

  function salirVistaGeneral() {
    vistaGeneral = null;
    viaje?.general(null);
    gl.setFollowing(true);
  }

  async function cambiarModoGeneral(modo) {
    if (!vistaGeneral) return;

    vistaGeneral.modo = modo;
    pintarVistaGeneral();

    if (modo === 'lista' && vistaGeneral.opciones.length === 0) {
      await cargarOpcionesDeRuta();
    }
  }

  /** La tarjeta de la ruta que se esta siguiendo, con lo que falta. */
  function tarjetaDeLaRutaActual() {
    const segundos = navState?.remainingSeconds ?? state.activeTrip?.plannedDurationSeconds ?? null;
    const metros = navState?.remainingMeters ?? state.activeTrip?.plannedDistanceMeters ?? null;

    return {
      accion: 'reanudar',
      tiempo: formatDuration(segundos),
      hora: segundos === null ? '—' : arrivalTime(segundos),
      km: formatDistance(metros),
      por: porDonde(route.instructions, navState?.stepIndex ?? 0),
      linea: lineaDeTiempo(prepared, {
        travelled: navState?.travelledMeters ?? 0,
        alerts: routeAlerts,
        accessLegs: route.accessLegs ?? []
      })
    };
  }

  /** La tarjeta de una ruta alternativa calculada desde donde esta el camion. */
  function tarjetaDeOpcion(opcion, indice) {
    const preparada = prepareRoute(opcion);

    return {
      accion: 'ir',
      indice,
      tiempo: formatDuration(opcion.durationSeconds),
      hora: arrivalTime(opcion.durationSeconds),
      km: formatDistance(opcion.distanceMeters),
      por: porDonde(opcion.instructions),
      linea: lineaDeTiempo(preparada, {
        alerts: alertsAlongRoute(preparada, gl.datasets()),
        accessLegs: opcion.accessLegs ?? []
      })
    };
  }

  function pintarVistaGeneral() {
    if (!viaje || !vistaGeneral) return;

    const tarjetas = [tarjetaDeLaRutaActual()];

    if (vistaGeneral.modo === 'lista') {
      tarjetas.push(...vistaGeneral.opciones.map(({ ruta, indice }) => tarjetaDeOpcion(ruta, indice)));
    }

    viaje.general({ modo: vistaGeneral.modo, tarjetas });
  }

  /**
   * Las otras rutas posibles desde donde esta el camion, para la lista.
   *
   * Se piden recien al abrir la lista, y desde la posicion actual: las
   * alternativas que se calcularon al planificar salian del origen y ya no
   * dicen nada. El servidor las devuelve ordenadas para camion y filtradas
   * (AD-47), como siempre.
   */
  async function cargarOpcionesDeRuta() {
    const desde = navState?.snapped ?? origin;
    if (!desde || !destination) return;

    try {
      const respuesta = await api.route(
        selectedTruck().id,
        { latitude: desde.lat, longitude: desde.lng },
        { latitude: destination.lat, longitude: destination.lng }
      );

      if (!vistaGeneral) return;   // se cerro mientras se calculaba

      // La recomendada desde aca suele ser la ruta que ya se sigue: ofrecer
      // "Ir" por ella seria ofrecer nada. Se la reconoce por sus vias y su
      // largo, y se la deja afuera; las demas conservan su posicion.
      const actual = {
        por: porDonde(route.instructions, navState?.stepIndex ?? 0),
        metros: navState?.remainingMeters ?? route.distanceMeters
      };

      vistaGeneral.opciones = opcionesDeRuta(respuesta)
        .map((ruta, indice) => ({ ruta, indice }))
        .filter(({ ruta }) => !mismaRuta(actual, { por: porDonde(ruta.instructions), metros: ruta.distanceMeters }));
      vistaGeneral.respuesta = respuesta;
      pintarVistaGeneral();
    } catch (error) {
      toastError(`No se pudieron calcular otras rutas: ${error.message}`);
    }
  }

  /**
   * "Ir" por otra ruta, sin cerrar el viaje.
   *
   * Es el mismo movimiento que recalcular al salirse de la ruta, con la ruta
   * elegida en vez de la recomendada: todo lo que estaba calculado sobre la
   * ruta anterior deja de valer.
   */
  function irPorOpcion(indice) {
    const elegida = elegirAlternativa(vistaGeneral?.respuesta, indice);
    if (!elegida) return;

    seguirRuta(elegida, navState?.snapped ?? origin);
    setState({ activeRoute: elegida });
    salirVistaGeneral();
    pintarViaje();
    decir('Nueva ruta.');
  }

  /** Pasa a guiar por otra ruta desde un punto dado. */
  function seguirRuta(nueva, desde) {
    route = nueva;
    prepared = prepareRoute(nueva);

    // La ruta nueva pasa por otro lado: lo que había sobre la anterior no
    // sirve, y las claves de los avisos ya dados apuntan a otros índices.
    routeAlerts = alertsAlongRoute(prepared, gl.datasets());
    alerted = new Set();

    // El estado arranca de cero: los indices de la ruta vieja no significan
    // nada sobre la nueva, y los avisos ya dichos son de otras maniobras.
    navState = null;
    previousNav = null;
    announced = new Set();

    gl.drawRoute(nueva, nueva.accessLegs ?? []);

    if (desde) origin = { lat: desde.lat, lng: desde.lng, label: 'Tu ubicación actual' };
  }

  /** Saca la pantalla del viaje y devuelve los controles del reposo. */
  function desmontarViaje() {
    vistaGeneral = null;
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

    // En reposo no hay boton de calcular: el destino fijado se rutea directo.
    if (which === 'destination' && stage === 'search' && origin) {
      await calculate(null);
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
    ultimaPosicion = point;

    // Solo se toma como origen si todavia no hay uno elegido a mano.
    if (origin) {
      // Unico lugar que fuerza un acercamiento, y solo si el mapa esta mas
      // lejos: "Mi ubicacion" con la ciudad entera en pantalla no mostraria
      // nada. Del resto de la app el zoom del usuario no se toca.
      gl.flyTo(point, { minZoom: 15 });
      return;
    }

    // `actual` marca que el origen es la posicion del GPS: la lista de rutas
    // lo llama "Mi ubicación" aunque ya tenga direccion.
    setPoint('origin', { ...point, label: 'Tu ubicación actual', actual: true });
    editing = 'destination';

    try {
      const place = await api.reverseGeocode(point.lat, point.lng);

      // Se comprueba que el usuario no haya cambiado el origen mientras tanto:
      // resolver la direccion tarda, y pisarle lo que eligio seria peor que no
      // mostrar la calle.
      if (place && origin?.label === 'Tu ubicación actual') {
        origin = { ...point, label: place.label, actual: true };
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
        routeOptions = opcionesDeRuta(calculada);
        chosenRoute = 0;
        route = calculada;

        // Lo que hay en el camino de cada una se cruza una sola vez, aca: es
        // lo que cuentan los chips de la lista y los detalles.
        avisosPorOpcion = routeOptions.map((ruta) => alertsAlongRoute(prepareRoute(ruta), gl.datasets()));

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

    // En viaje el destino es la bandera a cuadros (waze-02) y el pin del
    // origen sobra: el camion ya arranco de ahi.
    gl.setOrigin(null);
    gl.setDestination(null);
    gl.setDestinationFlag(destination);
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
    gl.setDestinationFlag(null);
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

    ultimaPosicion = { lat: fix.lat, lng: fix.lng };
    previousNav = navState;
    navState = advance(prepared, fix, navState);

    gl.followVehicle(navState.snapped, navState.bearing);
    gl.trimRoute(route.geometry.coordinates, navState.index, navState.snapped);
    marcarManiobra();
    gl.showBalloons(globosDeRuta(route, navState), navState.stepIndex);

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
    // silencio o el motor tapó la voz, el aviso tiene que poder leerse. Va en
    // la tarjeta del viaje, como las alertas de Waze, y se va sola. Es
    // informativo —el motor ya excluyó los gálibos que no se pasan (AD-47)—.
    const tarjeta = textoDeAviso(alerta, selectedTruck());
    if (tarjeta) viaje?.avisar(tarjeta);
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

      seguirRuta(fresh, fix);
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
   Utilidades
--------------------------------------------------------------------------- */

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
