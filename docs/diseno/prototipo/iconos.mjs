import { ICONOS } from './shared.mjs';
export const ilu = (forma, color, sombra, detalle = '', t = 32) =>
  `<svg viewBox="0 0 32 32" width="${t}" height="${t}" class="ico"><g style="color:${sombra}" transform="translate(0 2)">${forma}</g><g style="color:${color}">${forma}</g>${detalle}</svg>`;

export const F = {
  camion:   `<path fill="currentColor" d="M3 9h15v12H3zM18 13h6l4 4v4h-10z"/>`,
  persona:  `<circle fill="currentColor" cx="16" cy="10" r="6"/><path fill="currentColor" d="M5 27c0-6 5-9 11-9s11 3 11 9z"/>`,
  telefono: `<path fill="currentColor" d="M9 4h5l2 6-3 2c1.6 3.2 4 5.6 7 7l2-3 6 2v5c0 1.2-1 2-2 2C13 25 7 19 5 6c0-1.2 1-2 4-2z"/>`,
  reloj:    `<circle fill="currentColor" cx="16" cy="16" r="12"/>`,
  pin:      `<path fill="currentColor" d="M16 3a9 9 0 0 1 9 9c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 9-9z"/>`,
  rayo:     `<path fill="currentColor" d="M18 3 6 18h8l-2 11 14-17h-8z"/>`,
  gauge:    `<path fill="currentColor" d="M4 24a12 12 0 0 1 24 0v3H4z"/>`,
  volante:  `<circle fill="currentColor" cx="16" cy="16" r="12"/>`,
  escudo:   `<path fill="currentColor" d="M16 3l11 4v9c0 7-5 11-11 13C10 27 5 23 5 16V7z"/>`,
  estrella: `<path fill="currentColor" d="M16 3l4 8 9 1-6.5 6 1.5 9-8-4.5L8 27l1.5-9L3 12l9-1z"/>`,
  sol:      `<circle fill="currentColor" cx="16" cy="16" r="7"/><path stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/>`,
  luna:     `<path fill="currentColor" d="M19 3a11 11 0 1 0 10 15A9 9 0 0 1 19 3z"/>`,
  globo:    `<path fill="currentColor" d="M5 5h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H14l-6 5v-5H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>`,
  doc:      `<path fill="currentColor" d="M8 3h11l7 7v19H8z"/>`,
  salir:    `<path fill="currentColor" d="M4 4h13v24H4z"/>`,
  serpiente:`<path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" d="M7 25c0-5 7-5 7-10S7 10 7 5M14 5h8a4 4 0 0 1 0 8h-4"/>`,
  bandera:  `<path fill="currentColor" d="M7 3h3v26H7zM10 4h16l-4 5.5 4 5.5H10z"/>`,
  mas:      `<circle fill="currentColor" cx="16" cy="16" r="12"/>`,
  engranaje:`<circle fill="currentColor" cx="16" cy="16" r="10"/><path stroke="currentColor" stroke-width="3.5" stroke-linecap="round" d="M16 4v4M16 24v4M4 16h4M24 16h4"/>`,
  chat:     `<path fill="currentColor" d="M28 15a10 10 0 0 1-10 10H6l3-4a10 10 0 1 1 19-6z"/>`,
  carnet:   `<rect fill="currentColor" x="3" y="8" width="26" height="18" rx="4"/>`
};

export const ICO = {
  camion:      (t) => ilu(F.camion, '#35b8e8', '#1a6f9a', `<circle cx="8" cy="23" r="2.8" fill="#0d1418"/><circle cx="22" cy="23" r="2.8" fill="#0d1418"/>`, t),
  persona:     (t) => ilu(F.persona, '#5b9cf2', '#2a5fb0', '', t),
  telefono:    (t) => ilu(F.telefono, '#35b8e8', '#1a6f9a', '', t),
  historial:   (t) => ilu(F.reloj, '#5b9cf2', '#2a5fb0', `<path d="M16 9v7l5 3" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/>`, t),
  viaje:       (t) => ilu(F.pin, '#35b8e8', '#1a6f9a', `<circle cx="16" cy="12" r="3.2" fill="#fff"/>`, t),
  exp:         (t) => ilu(F.rayo, '#a97bf0', '#6d46c4', '', t),
  km:          (t) => ilu(F.gauge, '#5b9cf2', '#2a5fb0', `<path d="M16 23l6-9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="23" r="2.2" fill="#fff"/>`, t),
  volante:     (t) => ilu(F.volante, '#8a86f2', '#5346c4', `<circle cx="16" cy="16" r="5.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M16 5v6M6.5 21l5-2.5M25.5 21l-5-2.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`, t),
  logros:      (t) => ilu(F.escudo, '#a97bf0', '#6d46c4', `<path d="M11 16l3.5 3.5L21 13" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`, t),
  nivel:       (t) => ilu(F.estrella, '#8a86f2', '#5346c4', '', t),
  dia:         (t) => ilu(F.sol, '#8fdcf7', '#1a6f9a', '', t),
  noche:       (t) => ilu(F.luna, '#8a86f2', '#5346c4', '', t),
  idioma:      (t) => ilu(F.globo, '#5b9cf2', '#2a5fb0', `<text x="16" y="18.5" font-size="12" font-weight="800" fill="#fff" text-anchor="middle" font-family="Nunito, sans-serif">A</text>`, t),
  fuentes:     (t) => ilu(F.doc, '#8aa3b3', '#4a6070', `<path d="M12 14h8M12 18h8M12 22h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`, t),
  salir:       (t) => ilu(F.salir, '#8aa3b3', '#4a6070', `<path d="M14 16h13M23 12l4 4-4 4" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`, t),
  trivia:      (t) => ilu(F.mas, '#a97bf0', '#6d46c4', `<text x="16" y="21" font-size="15" font-weight="900" fill="#fff" text-anchor="middle" font-family="Nunito, sans-serif">?</text>`, t),
  viborita:    (t) => ilu(F.serpiente, '#43c98b', '#1c7d51', `<circle cx="7" cy="25" r="2.2" fill="#fff"/>`, t),
  ranking:     (t) => ilu(F.bandera, '#5b9cf2', '#2a5fb0', '', t),
  agregar:     (t) => ilu(F.mas, '#35b8e8', '#1a6f9a', `<path d="M16 10v12M10 16h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`, t),
  config:      (t) => ilu(F.engranaje, '#8aa3b3', '#4a6070', `<circle cx="16" cy="16" r="3.5" fill="#fff"/>`, t),
  chat:        (t) => ilu(F.chat, '#a97bf0', '#6d46c4', '', t),
  carnet:      (t) => ilu(F.carnet, '#6b64d9', '#3f3aa0', `<circle cx="10.5" cy="16" r="3.2" fill="#fff"/><path d="M17 13h8M17 17.5h8M17 22h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`, t),
  gps:         (t) => `<svg viewBox="0 0 32 32" width="${t}" height="${t}" class="ico">${ICONOS.mapa}</svg>`,
  juegos:      (t) => `<svg viewBox="0 0 32 32" width="${t}" height="${t}" class="ico">${ICONOS.juegos}</svg>`,
  sos:         (t) => `<svg viewBox="0 0 32 32" width="${t}" height="${t}" class="ico">${ICONOS.emergencia}</svg>`,
  masmenu:     (t) => `<svg viewBox="0 0 32 32" width="${t}" height="${t}" class="ico">${ICONOS.mas}</svg>`
};

export const chip = (etiqueta, valor, clase = 'chip-dark') => `<span class="chip ${clase}">${etiqueta ? `<span>${etiqueta}</span>` : ''}${valor}</span>`;

