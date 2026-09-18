/**
 * La mascota: el mono camionero, por momentos.
 *
 * Es el sistema, no el dibujo. El brief del usuario (skill de diseño,
 * references/mascota.md) fija la regla: UN personaje, y las variaciones salen de
 * pose + expresion + accesorio + situacion. Este modulo traduce los MOMENTOS de la
 * app —fin de viaje, subir de nivel, error, alerta— a la POSE que corresponde, y
 * dibuja la pose si el asset existe o deja el lugar reservado si no.
 *
 * LOS PNG SALEN DE LAS HOJAS DE REFERENCIA, uno por pose, en /img/mascota/<pose>.png.
 * El usuario les saco el fondo el 12/09/2026 y el script las corto en poses,
 * normalizando el alto del mono parado y dejandolo con los pies al piso en un
 * lienzo cuadrado. Solo entran las hojas con gorra TBF: las de gorra MACK son
 * una marca ajena. No se dibuja el mono desde el codigo, ni como provisorio: un
 * mono aproximado en el codigo termina siendo el mono, y la regla de
 * consistencia lo prohibe. Una pose que falta muestra el hueco.
 *
 * Son renders de un dibujo con aire de pixel art, de 326 a 512 px de lado, no
 * pixel art a resolucion nativa: se muestran con el suavizado normal del
 * navegador y al tamaño que pide cada pantalla (NATIVO x escala, en px CSS).
 * Nada de image-rendering pixelated, que al achicarlos los llena de escalones.
 */

/**
 * Las poses que existen en las hojas de referencia, por nombre de archivo. Los
 * momentos apuntan a estas. Cuando el diseñador entregue una, se agrega a
 * DISPONIBLES y aparece sola en todos los momentos que la usan.
 */
export const POSES = {
  festejo:     'Brazos arriba, gorro de fiesta y confeti',
  neutro:      'Parado, sonriendo',
  mate:        'Tomando mate',
  cafe:        'Tomando cafe',
  mapa:        'Leyendo el mapa',
  binoculares: 'Mirando con binoculares',
  radar:       'Con el radar en la mano, serio',
  rueda:       'Cambiando la rueda con la llave',
  combustible: 'Cargando combustible',
  comiendo:    'Comiendo',
  joystick:    'Con el joystick',
  cartas:      'Con las cartas del truco',
  durmiendo:   'Durmiendo en pijama',
  torta:       'Con la torta de cumpleanios'
};

/**
 * Los momentos de la app y la pose de cada uno. La emocion es la del brief.
 *
 * Dos momentos apuntan a la misma pose a proposito: "nivel" usa el festejo hasta
 * que exista una pose propia de subir de nivel, y "motivar" usa el neutro hasta
 * que exista la de fuerza. Pedirselas al diseñador; no inventarlas.
 */
export const MOMENTOS = {
  festejo:  { pose: 'festejo',     alt: 'El mono festeja con los brazos arriba' },          // 🎉
  nivel:    { pose: 'festejo',     alt: 'El mono festeja tu nuevo nivel' },                 // 😎
  racha:    { pose: 'mate',        alt: 'El mono toma un mate: un dia mas de racha' },      // 🔥
  alerta:   { pose: 'binoculares', alt: 'El mono mira adelante con binoculares' },          // 👀
  ruta:     { pose: 'mapa',        alt: 'El mono lee el mapa: la ruta esta lista' },        // 🗺️
  radar:    { pose: 'radar',       alt: 'El mono avisa que hay un radar adelante' },        // 👀
  error:    { pose: 'rueda',       alt: 'El mono cambia una rueda: esto se arregla' },      // 😅
  motivar:  { pose: 'neutro',      alt: 'El mono te acompaña' },                            // 💪
  perfil:   { pose: 'neutro',      alt: 'El mono te invita a completar tu perfil' },
  juegos:   { pose: 'joystick',    alt: 'El mono con el joystick' },
  nocturno: { pose: 'durmiendo',   alt: 'El mono duerme: viaje nocturno' },
  cumple:   { pose: 'torta',       alt: 'El mono trae la torta de tu cumpleanios' }
};

/**
 * Poses con PNG en la carpeta. Falta "neutro": la unica hoja con el mono parado
 * sin hacer nada lleva gorra MACK. Hay un test que cruza esta lista con la carpeta.
 */
export const DISPONIBLES = new Set([
  'festejo', 'mate', 'cafe', 'mapa', 'binoculares', 'radar', 'rueda',
  'combustible', 'comiendo', 'joystick', 'cartas', 'durmiendo', 'torta'
]);

/** Lado base en px CSS; cada pantalla lo multiplica por su escala. */
export const NATIVO = 64;

/**
 * El marcado de la mascota en un momento. Si la pose no esta, deja el hueco del
 * mismo tamaño: las pantallas se componen previendo donde va, y no se rompen sin
 * el dibujo.
 */
export function mascota(momento, { escala = 2, clase = '' } = {}) {
  const m = MOMENTOS[momento] ?? MOMENTOS.motivar;
  const lado = Math.round(NATIVO * Math.max(0.5, escala));
  const hay = DISPONIBLES.has(m.pose);

  return `
    <figure class="mascota mascota-${momento} ${hay ? 'mascota-con-pose' : 'mascota-sin-pose'} ${clase}"
            style="--mascota-lado:${lado}px" data-pose="${m.pose}" aria-label="${m.alt}">
      ${hay ? `<img src="/img/mascota/${m.pose}.png" width="${lado}" height="${lado}" alt="">` : ''}
    </figure>`;
}
