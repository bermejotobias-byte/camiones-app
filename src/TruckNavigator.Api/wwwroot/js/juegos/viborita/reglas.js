/**
 * Las reglas de VIBORITA TBF (spec 2026-10-03-viborita-tbf, §4).
 *
 * Son los mismos numeros que usa el servidor para calcular los puntos y rechazar
 * lo imposible (Domain/Juegos/Viborita.cs). Si cambian, cambian en los dos lados:
 * los tests de cada lado los fijan.
 */

export const COLUMNAS = 10;
export const FILAS = 10;
export const ACOPLADOS_AL_ARRANCAR = 2;

/** Con el campo lleno no queda lugar para otra caja: 100 - 3. */
export const CAJAS_MAXIMAS = COLUMNAS * FILAS - (ACOPLADOS_AL_ARRANCAR + 1);

export const PASO_INICIAL_MS = 260;
export const PASO_MAS_RAPIDO_MS = 140;
const ACELERA_CADA_CAJAS = 5;
const ACELERA_MS = 20;

/** Dos toques rapidos se respetan los dos; el tercero se descarta. */
export const GIROS_EN_COLA = 2;

/** La caja vale los acoplados que llevas despues de levantarla: 2n + n(n+1)/2. */
export const puntos = (cajas) => (cajas <= 0 ? 0 : ACOPLADOS_AL_ARRANCAR * cajas + (cajas * (cajas + 1)) / 2);

/** Cuanto dura un paso con tantas cajas levantadas. */
export const pasoMs = (cajas) =>
  Math.max(PASO_MAS_RAPIDO_MS, PASO_INICIAL_MS - Math.floor(cajas / ACELERA_CADA_CAJAS) * ACELERA_MS);
