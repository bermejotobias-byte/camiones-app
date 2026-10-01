/**
 * Los logros: la insignia de cada pista y el color de cada escalon.
 *
 * Decision del usuario del 12/09/2026: "el logro cambia de color al subir, como
 * el Duolingo", con la escala de Duolingo —rojo, violeta, dorado, celeste—. Hay
 * UN dibujo por pista y diez colores por escalon; la insignia no cambia, cambia
 * su color. Eso es lo que hace que un logro se lea como el mismo logro subiendo.
 *
 * ATENCION, es una excepcion deliberada a la paleta: el rojo esta reservado para
 * errores y peligro, y el oro estaba descartado por calido. Aca los dos son
 * COLORES DE ESCALON, y lo son porque el usuario eligio la escala de Duolingo con
 * esa consecuencia a la vista. No extender esta excepcion a nada que no sea la
 * insignia de un logro.
 *
 * Los dibujos van en pixel art, el lenguaje de la mascota: trazos de una unidad
 * sobre una grilla de 24, contorno oscuro y una luz arriba a la izquierda, con
 * shape-rendering crispEdges para que no se suavicen. Son provisorios en un
 * sentido preciso: el diseñador puede reemplazarlos por los suyos, en el mismo
 * lenguaje que el mono, sin tocar nada mas que estos trazos.
 */

/**
 * El color de cada escalon, 1 a 10. Lectura de las capturas de Duolingo: rojo en
 * los primeros, violeta despues, dorado en los altos, celeste al completar. El
 * indice 0 no existe: bloqueado es gris, y lo pone el CSS.
 */
export const TIER_COLORS = [
  null,
  '#e0554b',   // 1  rojo
  '#e8705f',   // 2  rojo claro
  '#b56ad6',   // 3  violeta rojizo
  '#a97bf0',   // 4  violeta
  '#8a86f2',   // 5  indigo
  '#d9a63a',   // 6  dorado oscuro
  '#f2c14e',   // 7  dorado
  '#ffd970',   // 8  dorado claro
  '#35b8e8',   // 9  celeste
  '#8fdcf7'    // 10 celeste brillante
];

/**
 * El color de una insignia con `alcanzados` escalones de `total`. Null = bloqueada.
 *
 * Va por FRACCION del recorrido y no por indice: la escala tiene diez colores,
 * pero kilometraje tiene setenta escalones. Por indice, el escalon 13 de 70 salia
 * celeste brillante —el color de "completo"— con menos de un quinto hecho. Para
 * las pistas de diez escalones la fraccion y el indice coinciden.
 */
export const tierColor = (alcanzados, total = 10) => {
  if (!alcanzados || alcanzados <= 0) return null;
  const paso = Math.ceil((alcanzados / Math.max(1, total)) * 10);
  return TIER_COLORS[Math.max(1, Math.min(10, paso))];
};

/**
 * Las pistas, con nombre y dibujo. El dibujo es el SIMBOLO que va dentro del
 * escudo; el escudo es comun. Trazos en la grilla de 24, en blanco.
 */
export const PISTAS = {
  kilometraje: {
    nombre: 'Kilómetros',
    total: 70,                      // sale de la escala de niveles: 7 niveles x 10 metas
    simbolo: `
      <rect x="6" y="9" width="8" height="6"/>
      <rect x="14" y="11" width="4" height="4"/>
      <rect x="7" y="15" width="2" height="2"/><rect x="15" y="15" width="2" height="2"/>`
  },
  viajes: {
    nombre: 'Viajes',
    total: 10,
    simbolo: `
      <rect x="8" y="6" width="2" height="12"/>
      <rect x="10" y="6" width="6" height="2"/><rect x="10" y="8" width="7" height="3"/><rect x="10" y="11" width="6" height="2"/>`
  },
  repartos: {
    nombre: 'Repartos',
    total: 10,
    simbolo: `
      <rect x="7" y="8" width="10" height="9"/>
      <rect x="11" y="8" width="2" height="9" class="logro-hueco"/><rect x="7" y="11" width="10" height="1" class="logro-hueco"/>`
  },
  nocturnos: {
    nombre: 'Nocturnos',
    total: 10,
    simbolo: `
      <rect x="9" y="6" width="5" height="1"/><rect x="8" y="7" width="2" height="1"/><rect x="7" y="8" width="2" height="3"/>
      <rect x="7" y="11" width="2" height="3"/><rect x="8" y="14" width="2" height="2"/><rect x="10" y="16" width="5" height="1"/>
      <rect x="14" y="15" width="3" height="1"/><rect x="15" y="14" width="2" height="1"/>`
  },
  // Los aportes a los lugares —votos y lugares nuevos—, la primera pista que no
  // avanza manejando (15/09/2026). El símbolo es un pin de mapa: cabeza redonda
  // con el hueco, y la punta hacia abajo.
  lugares: {
    nombre: 'Lugares',
    total: 10,
    simbolo: `
      <rect x="10" y="5" width="4" height="1"/><rect x="9" y="6" width="6" height="1"/><rect x="8" y="7" width="8" height="4"/>
      <rect x="9" y="11" width="6" height="1"/><rect x="10" y="12" width="4" height="2"/><rect x="11" y="14" width="2" height="3"/>
      <rect x="11" y="8" width="2" height="2" class="logro-hueco"/>`
  }
};

/**
 * La insignia de una pista, en el color de su escalon.
 *
 * `alcanzados` es cuantos escalones tiene; 0 es bloqueada. `objetivo` es el numero
 * que pisa el dibujo —el del escalon en curso, o el hecho si esta completa—.
 */
export function insignia(codigo, alcanzados, objetivo, { tamanio = 64 } = {}) {
  const pista = PISTAS[codigo];
  if (!pista) return '';

  const color = tierColor(alcanzados, pista.total);
  const estado = color ? 'logro-on' : 'logro-off';

  return `
    <div class="logro ${estado}" style="--tier:${color ?? 'var(--ink-3)'}" title="${pista.nombre}">
      <svg viewBox="0 0 24 24" width="${tamanio}" height="${tamanio}" shape-rendering="crispEdges" aria-hidden="true">
        <!-- el escudo: contorno, cuerpo, luz -->
        <path d="M3 3h18v11l-9 8-9-8z" class="logro-borde"/>
        <path d="M4 4h16v9.5l-8 7-8-7z" class="logro-cuerpo"/>
        <rect x="5" y="5" width="2" height="8" class="logro-luz"/><rect x="5" y="5" width="6" height="2" class="logro-luz"/>
        <!-- el simbolo -->
        <g class="logro-simbolo">${pista.simbolo}</g>
      </svg>
      ${objetivo != null ? `<b>${Number(objetivo).toLocaleString('es-AR')}</b>` : ''}
    </div>`;
}
