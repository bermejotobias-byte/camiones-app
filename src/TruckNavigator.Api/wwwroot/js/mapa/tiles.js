/**
 * El mapa que no se rompe (AD-54): cuando se cae al raster de respaldo, y como
 * se reintentan los tiles del mapa base que fallaron.
 *
 * Medido el 03/10/2026, simulando un corte en el navegador:
 *
 * · MapLibre NO reintenta un tile que fallo. Queda marcado `errored` y en su
 *   lugar se ve el fondo —o un tile de menos zoom estirado—: el cuadrado sin
 *   cargar de la prueba en la calle. Ni esperar ni mover el mapa lo recupera, y
 *   `reload()` de la fuente saltea a proposito los fallidos; `refreshTiles` si
 *   los vuelve a pedir.
 * · La regla del respaldo miraba solo el texto del error, y un corte en UN tile
 *   dice "Failed to fetch": el mapa entero pasaba al OpenStreetMap estandar, sin
 *   la Red ni nada nuestro, hasta reabrir la app.
 *
 * Lo puro esta probado en tests/web/tiles.test.mjs; map.js lo engancha.
 */

/** Las esperas entre reintentos: la misma escalera del freno de red de los reportes. */
export const ESCALERA_DE_TILES = [2000, 5000, 15000, 60000];

/** Sin fallas durante este rato, la escalera vuelve a empezar. */
const TRANQUILO_MS = 60000;

/** Lo que dice MapLibre cuando no pudo abrir el archivo del mapa base. */
const SIN_MAPA_BASE = /pmtiles|404|not found|failed to fetch/i;

/**
 * Si un error del mapa justifica pasar al raster de respaldo.
 *
 * Solo si falla la FUENTE del mapa base —el archivo no esta, o no se pudo
 * abrir—, que es cuando el error no trae tile. Un tile que falla es un pedido
 * que se reintenta, nunca un motivo para cambiar el mapa entero.
 *
 * @param {{sourceId?: string, tile?: object, error?: {message?: string}}} evento
 */
export function debeCaerAlRaster(evento) {
  if (evento?.sourceId !== 'base' || evento.tile) return false;
  return SIN_MAPA_BASE.test(evento.error?.message ?? '');
}

/**
 * La cola de tiles que fallaron, para volver a pedirlos.
 *
 * Los que fallan juntos se piden juntos. La espera crece si siguen fallando
 * —un servidor caido no se martilla—, y cuando el telefono avisa que volvio la
 * conexion se piden en el acto. El reloj se inyecta para probarlo sin navegador.
 *
 * @param {{reintentar: (tiles: {z: number, x: number, y: number}[]) => void}} opciones
 */
export function colaDeReintentos({
  reintentar,
  programar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (id) => clearTimeout(id),
  ahora = () => Date.now()
}) {
  const pendientes = new Map();
  let timer = null;
  let escalon = 0;
  let ultimoReintento = -Infinity;

  const disparar = () => {
    timer = null;
    if (!pendientes.size) return;

    const tiles = [...pendientes.values()];
    pendientes.clear();
    ultimoReintento = ahora();
    escalon++;
    reintentar(tiles);
  };

  return {
    fallo({ z, x, y }) {
      pendientes.set(`${z}/${x}/${y}`, { z, x, y });
      if (timer !== null) return;

      if (ahora() - ultimoReintento > TRANQUILO_MS) escalon = 0;
      const espera = ESCALERA_DE_TILES[Math.min(escalon, ESCALERA_DE_TILES.length - 1)];
      timer = programar(disparar, espera);
    },

    volvioLaRed() {
      if (timer !== null) cancelar(timer);
      timer = null;
      disparar();
      escalon = 0;
    },

    olvidar() {
      if (timer !== null) cancelar(timer);
      timer = null;
      pendientes.clear();
    }
  };
}
