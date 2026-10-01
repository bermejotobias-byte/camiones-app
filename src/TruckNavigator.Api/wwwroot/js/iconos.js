/**
 * Los iconos ilustrados de la app.
 *
 * Aprobados con el prototipo el 14/09/2026 (skill diseno-camiones-app §16, "27,
 * en docs/diseno/prototipo/iconos.mjs"). Son DOS TONOS —la forma en un tono mas
 * oscuro corrida 2 px hacia abajo, y encima la misma forma en su color—, y esa
 * capa de sombra es lo que les da cuerpo: es lo que los hace parecer una
 * ilustracion y no un trazo.
 *
 * Los colores son FIJOS a proposito y no salen de tokens del tema: un icono
 * ilustrado es un dibujo, no texto, y tiene que leerse igual de dia y de noche.
 * El rojo del S.O.S. es el unico semantico, porque es emergencia.
 *
 * Los nueve del zocalo estaban aca desde el 12/09/2026, dibujados para el
 * zocalo y aprobados asi; se mudaron sin tocarlos. Los demas vienen del
 * prototipo. Un solo lugar para los dos grupos: antes una pantalla que queria el
 * icono de idioma no tenia de donde sacarlo.
 *
 * Si falta un nombre, `icono` devuelve cadena vacia. Una pantalla no puede
 * caerse por un dibujo: queda el hueco, y hay un test que cruza los nombres.
 */

/** Envuelve unos trazos en su caja de 32. Decorativo: el texto de al lado manda. */
const caja = (trazos, tamanio) =>
  `<svg viewBox="0 0 32 32" width="${tamanio}" height="${tamanio}" class="ico" aria-hidden="true">${trazos}</svg>`;

/**
 * Un icono ilustrado: la forma dos veces —sombra y color— mas su detalle blanco.
 * El `translate(0 2)` de la sombra es lo que se ve como grosor.
 */
const ilu = (forma, color, sombra, detalle = '') => (tamanio) => caja(
  `<g style="color:${sombra}" transform="translate(0 2)">${forma}</g>` +
  `<g style="color:${color}">${forma}</g>${detalle}`,
  tamanio);

/** Las formas, compartidas entre varios iconos. */
const F = {
  camion:    `<path fill="currentColor" d="M3 9h15v12H3zM18 13h6l4 4v4h-10z"/>`,
  persona:   `<circle fill="currentColor" cx="16" cy="10" r="6"/><path fill="currentColor" d="M5 27c0-6 5-9 11-9s11 3 11 9z"/>`,
  telefono:  `<path fill="currentColor" d="M9 4h5l2 6-3 2c1.6 3.2 4 5.6 7 7l2-3 6 2v5c0 1.2-1 2-2 2C13 25 7 19 5 6c0-1.2 1-2 4-2z"/>`,
  reloj:     `<circle fill="currentColor" cx="16" cy="16" r="12"/>`,
  pin:       `<path fill="currentColor" d="M16 3a9 9 0 0 1 9 9c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 9-9z"/>`,
  rayo:      `<path fill="currentColor" d="M18 3 6 18h8l-2 11 14-17h-8z"/>`,
  gauge:     `<path fill="currentColor" d="M4 24a12 12 0 0 1 24 0v3H4z"/>`,
  volante:   `<circle fill="currentColor" cx="16" cy="16" r="12"/>`,
  escudo:    `<path fill="currentColor" d="M16 3l11 4v9c0 7-5 11-11 13C10 27 5 23 5 16V7z"/>`,
  estrella:  `<path fill="currentColor" d="M16 3l4 8 9 1-6.5 6 1.5 9-8-4.5L8 27l1.5-9L3 12l9-1z"/>`,
  sol:       `<circle fill="currentColor" cx="16" cy="16" r="7"/><path stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/>`,
  luna:      `<path fill="currentColor" d="M19 3a11 11 0 1 0 10 15A9 9 0 0 1 19 3z"/>`,
  globo:     `<path fill="currentColor" d="M5 5h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H14l-6 5v-5H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>`,
  doc:       `<path fill="currentColor" d="M8 3h11l7 7v19H8z"/>`,
  salir:     `<path fill="currentColor" d="M4 4h13v24H4z"/>`,
  serpiente: `<path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" d="M7 25c0-5 7-5 7-10S7 10 7 5M14 5h8a4 4 0 0 1 0 8h-4"/>`,
  bandera:   `<path fill="currentColor" d="M7 3h3v26H7zM10 4h16l-4 5.5 4 5.5H10z"/>`,
  circulo:   `<circle fill="currentColor" cx="16" cy="16" r="12"/>`,
  engranaje: `<circle fill="currentColor" cx="16" cy="16" r="10"/><path stroke="currentColor" stroke-width="3.5" stroke-linecap="round" d="M16 4v4M16 24v4M4 16h4M24 16h4"/>`,
  chat:      `<path fill="currentColor" d="M28 15a10 10 0 0 1-10 10H6l3-4a10 10 0 1 1 19-6z"/>`,
  carnet:    `<rect fill="currentColor" x="3" y="8" width="26" height="18" rx="4"/>`,
  barras:    `<path fill="currentColor" d="M5 19h5v10H5zM13.5 12h5v17h-5zM22 5h5v24h-5z"/>`,
  triangulo: `<path fill="currentColor" d="M16 3.5 30 27H2z"/>`
};

/** El texto blanco de un icono, en la tipografia de la app. */
const letra = (t, y = 18.5, tamanio = 12) =>
  `<text x="16" y="${y}" font-size="${tamanio}" font-weight="900" fill="#fff" text-anchor="middle" font-family="Nunito, sans-serif">${t}</text>`;

/* ---------------------------------------------------------------------------
   Los del zocalo — dibujados para el zocalo el 12/09/2026 y aprobados asi.
   Se mudaron de dock.js tal cual: llevan su propia capa de sombra escrita a
   mano porque cada uno la corre distinto.
--------------------------------------------------------------------------- */

const DEL_ZOCALO = {
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
    <circle cx="10" cy="16" r="2.1" fill="#fff"/><circle cx="16" cy="16" r="2.1" fill="#fff"/><circle cx="22" cy="16" r="2.1" fill="#fff"/>`,

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

/* ---------------------------------------------------------------------------
   Todos los dibujos, por nombre
--------------------------------------------------------------------------- */

const DIBUJOS = {
  // Los del prototipo.
  camion:    ilu(F.camion, '#35b8e8', '#1a6f9a', `<circle cx="8" cy="23" r="2.8" fill="#0d1418"/><circle cx="22" cy="23" r="2.8" fill="#0d1418"/>`),
  persona:   ilu(F.persona, '#5b9cf2', '#2a5fb0'),
  telefono:  ilu(F.telefono, '#35b8e8', '#1a6f9a'),
  historial: ilu(F.reloj, '#5b9cf2', '#2a5fb0', `<path d="M16 9v7l5 3" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/>`),
  viaje:     ilu(F.pin, '#35b8e8', '#1a6f9a', `<circle cx="16" cy="12" r="3.2" fill="#fff"/>`),
  exp:       ilu(F.rayo, '#a97bf0', '#6d46c4'),
  km:        ilu(F.gauge, '#5b9cf2', '#2a5fb0', `<path d="M16 23l6-9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="23" r="2.2" fill="#fff"/>`),
  volante:   ilu(F.volante, '#8a86f2', '#5346c4', `<circle cx="16" cy="16" r="5.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M16 5v6M6.5 21l5-2.5M25.5 21l-5-2.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`),
  logros:    ilu(F.escudo, '#a97bf0', '#6d46c4', `<path d="M11 16l3.5 3.5L21 13" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  nivel:     ilu(F.estrella, '#8a86f2', '#5346c4'),
  dia:       ilu(F.sol, '#8fdcf7', '#1a6f9a'),
  noche:     ilu(F.luna, '#8a86f2', '#5346c4'),
  idioma:    ilu(F.globo, '#5b9cf2', '#2a5fb0', letra('A')),
  fuentes:   ilu(F.doc, '#8aa3b3', '#4a6070', `<path d="M12 14h8M12 18h8M12 22h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
  salir:     ilu(F.salir, '#8aa3b3', '#4a6070', `<path d="M14 16h13M23 12l4 4-4 4" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  trivia:    ilu(F.circulo, '#a97bf0', '#6d46c4', letra('?', 21, 15)),
  viborita:  ilu(F.serpiente, '#43c98b', '#1c7d51', `<circle cx="7" cy="25" r="2.2" fill="#fff"/>`),
  ranking:   ilu(F.bandera, '#5b9cf2', '#2a5fb0'),
  agregar:   ilu(F.circulo, '#35b8e8', '#1a6f9a', `<path d="M16 10v12M10 16h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  config:    ilu(F.engranaje, '#8aa3b3', '#4a6070', `<circle cx="16" cy="16" r="3.5" fill="#fff"/>`),

  // Las dos filas del menu MAS que salieron sin dibujo: el progreso en el
  // violeta de nivel y EXP, y el reporte en el ambar de su chapa.
  resumen:   ilu(F.barras, '#a97bf0', '#6d46c4'),
  reportes:  ilu(F.triangulo, '#f5a524', '#9a6508', `<path d="M16 13v5.5" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><circle cx="16" cy="22.8" r="1.7" fill="#fff"/>`),

  // Los del zocalo, tal como estaban.
  ...Object.fromEntries(Object.entries(DEL_ZOCALO).map(([nombre, trazos]) => [nombre, (t) => caja(trazos, t)]))
};

/** Los nombres que existen. Hay un test que los cruza con lo que usan las pantallas. */
export const ICONOS_ILUSTRADOS = Object.keys(DIBUJOS);

/**
 * El dibujo de un icono, listo para insertar.
 *
 * Cadena vacia si el nombre no existe: una pantalla no puede caerse por un
 * dibujo. Queda el hueco del mismo tamanio y el texto de al lado sigue diciendo
 * de que se trata.
 */
export function icono(nombre, tamanio = 30) {
  return DIBUJOS[nombre]?.(tamanio) ?? '';
}
