/**
 * La capa de lugares: los puntos de interes sobre el mapa como pines de 32
 * (el prototipo, tableros "Capas" y "Lugar"). Disco oscuro con un anillo de
 * 3 que dice de donde sale el dato —blanco lo verificado, celeste lo de la
 * comunidad con el contador de votos, gris lo que nadie confirmo— y la
 * calcomania de la categoria adentro. Lo comunitario no se ve igual que lo
 * verificado (AD-46), tampoco en el pin.
 *
 * Lo puro —que pin le toca a cada lugar, como viaja al mapa, como se pide,
 * que dice la ficha— esta probado en tests/web/lugares.test.mjs. Lo de
 * MapLibre va en el medio: `instalarLugares` deja la fuente y la capa listas
 * y `mostrarLugares` las llena; los pines se dibujan a pedido cuando el mapa
 * los reclama (`styleimagemissing`), asi que no hay que registrar 6 x 3
 * imagenes de antemano. Como los otros iconos del mapa, van con colores
 * fijos. Al final, la ficha y el voto; navigate.js los engancha.
 */

import { CALCOMANIAS, calcomania, dibujo, pildora, flechaIr } from './piezas.js';
import { escapeHtml } from '../ui.js';
import { CATEGORIAS } from './buscar.js';

/* ---------------------------------------------------------------------------
   Que pin le toca a cada lugar
--------------------------------------------------------------------------- */

const ANILLO = { verificado: '#ffffff', comunidad: '#32ccfe', sin: '#8b949e' };

const votos = (poi) => (poi.community?.suitable ?? 0) + (poi.community?.notSuitable ?? 0);

/**
 * 'verificado' si la fuente lo confirma (Confirmed: lo dice el operador, una
 * fuente oficial o las reseñas); 'comunidad' si lo aporto alguien o
 * si hay votos; 'sin' cuando nadie dijo nada todavia. Lo verificado manda:
 * los votos nunca tocan lo verificado.
 */
export function estadoDelPin(poi) {
  if (poi.verificationLevel === 'Confirmed') return 'verificado';
  if (poi.community?.contributed || votos(poi) > 0) return 'comunidad';
  return 'sin';
}

/** El total de votos, solo en los pines de la comunidad; null si no va contador. */
export function contadorDelPin(poi) {
  if (estadoDelPin(poi) !== 'comunidad') return null;
  const total = votos(poi);
  return total > 0 ? total : null;
}

/** La calcomania de una categoria del servidor (PoiCategory); el pin generico si no la conoce. */
export function calcomaniaDeCategoria(categoria) {
  return CATEGORIAS.find((c) => c.categoria === categoria)?.calcomania ?? 'lugar';
}

/* ---------------------------------------------------------------------------
   Al mapa y al servidor
--------------------------------------------------------------------------- */

/** Los lugares como GeoJSON de puntos, con lo que la capa necesita para dibujar cada pin. */
export function featuresDeLugares(pois) {
  return {
    type: 'FeatureCollection',
    features: (pois ?? []).map((poi) => {
      const estado = estadoDelPin(poi);
      const contador = contadorDelPin(poi);

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [poi.longitude, poi.latitude] },
        properties: {
          id: poi.id,
          nombre: poi.name,
          icono: `pin-${calcomaniaDeCategoria(poi.category)}-${estado}`,
          estado,
          contador: contador === null ? '' : String(contador)
        }
      };
    })
  };
}

/** Los ids de los chips como los nombres del servidor, en el orden de los chips. */
export function categoriasParaPedir(ids) {
  const activas = new Set(ids ?? []);
  return CATEGORIAS.filter((c) => activas.has(c.id)).map((c) => c.categoria).join(',');
}

/* ---------------------------------------------------------------------------
   El pin

   32 de ancho y 38 de alto con la cola, dibujado al doble para pantallas
   densas. El disco #2b3035 con el anillo de 3 y la calcomania de 18 adentro,
   como en el prototipo.
--------------------------------------------------------------------------- */

const PIN_ANCHO = 32;
const PIN_ALTO = 38;

export function pinSvg(calcomania, estado) {
  const anillo = ANILLO[estado] ?? ANILLO.sin;
  const inner = CALCOMANIAS[calcomania] ?? '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_ANCHO * 2}" height="${PIN_ALTO * 2}" viewBox="0 0 ${PIN_ANCHO} ${PIN_ALTO}">` +
    `<path d="M11 28l5 9 5-9z" fill="${anillo}"/>` +
    `<circle cx="16" cy="16" r="14.5" fill="#2b3035" stroke="${anillo}" stroke-width="3"/>` +
    `<svg x="7" y="7" width="18" height="18" viewBox="0 0 32 32" overflow="visible">${inner}</svg>` +
    '</svg>';
}

/** El disco del contador de votos: 17 dp, gris con borde blanco; el numero lo pone la capa. */
const badgeSvg = () =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 18 18">' +
  '<circle cx="9" cy="9" r="7.5" fill="#6e7378" stroke="#ffffff" stroke-width="2"/></svg>';

/* ---------------------------------------------------------------------------
   MapLibre
--------------------------------------------------------------------------- */

export const CAPA_LUGARES = 'lugar-pin';
const CAPA_CONTADOR = 'lugar-contador';
const FUENTE = 'lugares';

const pendientes = new Set();

/** Los mapas que ya escuchan los iconos que faltan: el oyente va una sola vez por mapa. */
const escuchando = new WeakSet();

/** Carga un SVG como imagen y la registra; se llama cuando el mapa pide un icono que no tiene. */
function registrarImagen(map, nombre, svg) {
  if (map.hasImage(nombre) || pendientes.has(nombre)) return;
  pendientes.add(nombre);

  const img = new Image();
  img.onload = () => {
    pendientes.delete(nombre);
    if (!map.hasImage(nombre)) map.addImage(nombre, img, { pixelRatio: 2 });
  };
  img.onerror = () => pendientes.delete(nombre);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Deja la fuente y las capas listas, vacias. Idempotente: con estilo vectorial,
 * cambiar de estilo vuelve a disparar 'load' y hay que reinstalar.
 */
export function instalarLugares(map) {
  if (!escuchando.has(map)) {
    escuchando.add(map);

    map.on('styleimagemissing', ({ id }) => {
      if (id === 'lugar-badge') return registrarImagen(map, id, badgeSvg());

      const partes = /^pin-([a-z]+)-(verificado|comunidad|sin)$/i.exec(id);
      if (partes) registrarImagen(map, id, pinSvg(partes[1], partes[2]));
    });
  }

  if (map.getSource(FUENTE)) return;

  map.addSource(FUENTE, { type: 'geojson', data: featuresDeLugares([]) });

  map.addLayer({
    id: CAPA_LUGARES,
    type: 'symbol',
    source: FUENTE,
    layout: {
      'icon-image': ['get', 'icono'],
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    },
    paint: {
      // Lo que nadie confirmo se ve, pero apagado.
      'icon-opacity': ['match', ['get', 'estado'], 'sin', 0.72, 1]
    }
  });

  // El contador de votos, arriba a la derecha del pin, solo donde hay.
  map.addLayer({
    id: CAPA_CONTADOR,
    type: 'symbol',
    source: FUENTE,
    filter: ['!=', ['get', 'contador'], ''],
    layout: {
      'icon-image': 'lugar-badge',
      'icon-size': 1,
      'icon-anchor': 'center',
      'icon-offset': [13, -33],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'contador'],
      'text-font': ['NotoSans-Bold'],
      'text-size': 11,
      'text-anchor': 'center',
      'text-offset': [1.18, -3],
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: { 'text-color': '#ffffff' }
  });
}

/** Pone estos lugares en el mapa (o ninguno). */
export function mostrarLugares(map, pois) {
  map.getSource(FUENTE)?.setData(featuresDeLugares(pois));
}

/* ---------------------------------------------------------------------------
   La ficha (el prototipo, tableros "Lugar verificado" y "Lugar de la comunidad")

   La tarjeta de Waze: la calcomania en una caja de 48, el nombre en 22
   negrita, la categoria, la distancia y la direccion en 14 gris, y "Ir"
   celeste. Lo que Waze no tiene: lo verificado separado de lo comunitario.
   Arriba la evidencia con su fecha —en verde porque es un si; en rojo si la
   fuente dice que NO recibe tu camion; en gris lo probable—, abajo cuantos
   camioneros con un camion como el tuyo lo recomiendan, el total y tu voto.
   Los votos nunca tocan lo verificado (AD-46).
--------------------------------------------------------------------------- */

const CATEGORIA_EN_SINGULAR = {
  TyreShop: 'Gomería',
  RepairShop: 'Taller',
  FuelStation: 'Estación de servicio',
  TruckFriendlyEatery: 'Comida',
  HeavyRoadsideAssistance: 'Auxilio pesado',
  TruckParking: 'Playa de camiones'
};

const EVIDENCIA = {
  Operator: 'Lo declara el comercio',
  Official: 'Lo dice una fuente oficial',
  Reviews: 'Lo cuentan conductores en reseñas'
};

const RECIBE = [
  ['suitableForLightTruck', 'livianos'],
  ['suitableForHeavyTruck', 'pesados'],
  ['suitableForSemiTrailer', 'semis'],
  ['suitableForTrailer', 'acoplados']
];

/** La distancia en linea recta entre dos puntos {lat, lng}, en metros. */
export function metrosEntre(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const distanciaLegible = (metros) => (metros < 1000
  ? `a ${Math.round(metros)} m`
  : `a ${(metros / 1000).toFixed(1).replace('.', ',')} km`);

/** "2026-09-15" → "15/09/2026". */
const fechaLegible = (iso) => {
  const [a, m, d] = String(iso ?? '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
};

/** "camiones livianos y pesados", "camiones pesados, semis y acoplados", "semis". */
function loQueRecibe(poi) {
  const tipos = RECIBE.filter(([campo]) => poi[campo] === true).map(([, nombre]) => nombre);
  if (tipos.length === RECIBE.length) return 'todo tipo de camión';
  if (tipos.length === 0) return 'camiones';

  // "camiones" va una sola vez, adelante, si lo que recibe son camiones
  // livianos o pesados; semis y acoplados se nombran solos.
  const lista = tipos.length === 1 ? tipos[0] : `${tipos.slice(0, -1).join(', ')} y ${tipos.at(-1)}`;
  return /^(livianos|pesados)/.test(lista) ? `camiones ${lista}` : lista;
}

const conFecha = (texto, poi) => {
  const fecha = fechaLegible(poi.sourceRetrievedOn);
  return fecha ? `${texto} · ${fecha}` : texto;
};

/** El bloque de lo verificado, o null si nadie confirmo nada. */
function bloqueVerificado(poi) {
  if (poi.verificationLevel === 'Probable') {
    return {
      nivel: 'probable',
      titulo: 'Probable · hay señales de que recibe camiones',
      sub: conFecha('Por el nombre, una etiqueta o fotos; nadie lo confirmó', poi)
    };
  }

  if (poi.verificationLevel !== 'Confirmed') return null;

  const evidencia = EVIDENCIA[poi.suitabilityEvidenceKind] ?? 'Lo confirma la fuente';

  if (poi.suitableForSelectedTruck === false) {
    const recibe = loQueRecibe(poi);
    return {
      nivel: 'no-apto',
      titulo: 'Verificado · no recibe tu camión',
      sub: conFecha(`Recibe ${recibe} · ${evidencia.charAt(0).toLowerCase()}${evidencia.slice(1)}`, poi)
    };
  }

  return { nivel: 'confirmado', titulo: `Verificado · recibe ${loQueRecibe(poi)}`, sub: conFecha(evidencia, poi) };
}

const camioneros = (n) => `${n} ${n === 1 ? 'camionero' : 'camioneros'}`;

/** Lo que dice la comunidad, con los votos de camiones como el tuyo adelante. */
function bloqueComunidad(poi) {
  const c = poi.community ?? {};
  const total = (c.suitable ?? 0) + (c.notSuitable ?? 0);
  const tuyo = c.forYourTruck;

  if (total === 0) return { titulo: 'Nadie votó todavía', sub: 'Sé el primero: ¿es apto para tu camión?' };

  let titulo;
  if (!tuyo) {
    titulo = c.suitable > 0
      ? `${camioneros(c.suitable)} lo ${c.suitable === 1 ? 'recomienda' : 'recomiendan'}`
      : `${camioneros(c.notSuitable)} lo ${c.notSuitable === 1 ? 'desaconseja' : 'desaconsejan'}`;
  } else if (tuyo.suitable > 0) {
    titulo = `${camioneros(tuyo.suitable)} con un camión como el tuyo lo ${tuyo.suitable === 1 ? 'recomienda' : 'recomiendan'}`;
  } else if (tuyo.notSuitable > 0) {
    titulo = `${camioneros(tuyo.notSuitable)} con un camión como el tuyo lo ${tuyo.notSuitable === 1 ? 'desaconseja' : 'desaconsejan'}`;
  } else {
    titulo = 'Nadie con un camión como el tuyo votó todavía';
  }

  const enContra = c.notSuitable > 0 ? `${c.notSuitable} lo ${c.notSuitable === 1 ? 'desaconseja' : 'desaconsejan'}` : 'nadie lo desaconseja';
  const sinVerificar = poi.verificationLevel === 'Confirmed' || poi.verificationLevel === 'Probable'
    ? ''
    : (c.notSuitable > 0 ? ' · sin verificar' : ' · sin verificar: nadie confirmó el dato todavía');

  const sub = c.notSuitable > 0 || !sinVerificar
    ? `${total} en total · ${enContra}${sinVerificar}`
    : `${total} en total${sinVerificar}`;

  return { titulo, sub };
}

/**
 * Lo que dice la ficha de un lugar, listo para dibujar.
 *
 * @param {object} poi                            el PoiDto
 * @param {{camion?: object, desde?: {lat, lng}}} contexto  el camion elegido y donde esta uno
 */
export function fichaDeLugar(poi, { camion = null, desde = null } = {}) {
  const partes = [CATEGORIA_EN_SINGULAR[poi.category] ?? 'Lugar'];
  if (desde) partes.push(distanciaLegible(metrosEntre(desde, { lat: poi.latitude, lng: poi.longitude })));
  if (poi.address) partes.push(poi.address);

  const aporte = poi.community?.contributed;

  return {
    id: poi.id,
    calcomania: calcomaniaDeCategoria(poi.category),
    nombre: poi.name,
    sub: partes.join(' · '),
    aportado: aporte ? `Aportado por la comunidad · @${aporte.byAlias ?? 'anónimo'} · ${fechaLegible(aporte.at)}` : null,
    verificado: bloqueVerificado(poi),
    comunidad: bloqueComunidad(poi),
    voto: poi.community?.yourVote ?? null,
    pregunta: camion ? `¿Es apto para ${camion.name}?` : '¿Es apto para tu camión?',
    telefono: poi.phone ?? null
  };
}

/** La ficha dibujada; navigate.js la engancha por data-accion. */
export function fichaLugar(f) {
  const voto = (veredicto, texto) => pildora(texto, {
    clase: f.voto === veredicto ? 'celeste chica' : 'chica',
    icono: f.voto === veredicto ? dibujo('check', 16, 3) : '',
    datos: `data-accion="votar" data-veredicto="${veredicto}"`
  });

  return `
  <div class="gps-manija"></div>
  <div class="gps-ficha-cabeza">
    <div class="gps-ficha-ico">${calcomania(f.calcomania, 32)}</div>
    <div class="gps-ficha-titulo"><b>${escapeHtml(f.nombre)}</b><span>${escapeHtml(f.sub)}</span></div>
    <button type="button" class="gps-ficha-cerrar" data-accion="cerrar" aria-label="Cerrar">${dibujo('cerrar', 22, 2.4)}</button>
  </div>
  ${f.aportado ? `<div class="gps-etiqueta-comunidad">${calcomania('comunidad', 16)}<span>${escapeHtml(f.aportado)}</span></div>` : ''}
  ${f.verificado ? `
  <div class="gps-bloque gps-bloque-${f.verificado.nivel}">
    <div class="gps-bloque-titulo"><i>${dibujo(f.verificado.nivel === 'no-apto' ? 'cerrar' : 'check', 14, 3.2)}</i><b>${escapeHtml(f.verificado.titulo)}</b></div>
    <span>${escapeHtml(f.verificado.sub)}</span>
  </div>` : ''}
  <div class="gps-bloque gps-bloque-comunidad">
    <div class="gps-bloque-titulo">${calcomania('comunidad', 20)}<b>${escapeHtml(f.comunidad.titulo)}</b></div>
    <span>${escapeHtml(f.comunidad.sub)}</span>
  </div>
  <div class="gps-voto">
    <span>${escapeHtml(f.pregunta)}</span>
    <div class="gps-voto-botones">${voto('Suitable', 'Apto')}${voto('NotSuitable', 'No apto')}</div>
  </div>
  <div class="gps-acciones">
    ${f.telefono ? pildora('Llamar', { icono: dibujo('telefono', 18, 2.4), datos: 'data-accion="llamar"' }) : ''}
    ${pildora('Ir', { clase: 'celeste', icono: flechaIr(16), datos: 'data-accion="ir"' })}
  </div>`;
}
