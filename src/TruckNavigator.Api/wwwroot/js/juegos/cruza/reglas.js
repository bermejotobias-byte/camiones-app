/**
 * Las reglas de CRUZA, MONO (spec 2026-10-04-cruza-mono, §3 y §5).
 *
 * Todos los numeros del juego, con nombre. Los de los puntos y lo posible son los
 * mismos que usa el servidor (Domain/Juegos/Cruza.cs): si cambian, cambian en los
 * dos lados, y los tests de cada lado los fijan.
 */

// --- el campo
export const COLUMNAS = 9;
export const CEL = 24;
export const FILAS_VISIBLES = 13;
export const HUD = 28;
export const ANCHO = COLUMNAS * CEL;
export const ALTO = HUD + FILAS_VISIBLES * CEL;

// --- el mono
export const PASO_MS = 140;
export const VIDAS = 3;
export const GOLPE_MS = 900;
export const INVULNERABLE_MS = 1500;
export const COLUMNA_DE_LARGADA = 4;
export const FILAS_DE_LARGADA = 3;
/** La camara sigue al mono: nunca queda mas arriba que esto desde el borde de abajo. */
export const MONO_MAX_DESDE_ABAJO = 6;
/** Las filas que quedan mas abajo que esto de la camara se olvidan. */
export const OLVIDAR_DEBAJO = 4;
/** Un deslizamiento da su paso al cruzar estos pixeles de pantalla. */
export const UMBRAL_DESLIZAR = 24;

// --- los puntos (los mismos del servidor)
export const PUNTOS_POR_FILA = 10;
export const PUNTOS_POR_CAJA = 50;

/** SCORE = 10 x la fila mas lejana + 50 x las cajas. */
export const puntos = (filas, cajas) => PUNTOS_POR_FILA * Math.max(0, filas) + PUNTOS_POR_CAJA * Math.max(0, cajas);

// --- el mundo
export const CADA_PLAYON = 25;
export const FILA_OBELISCO = 100;
export const PROB_RIO = 0.3;
export const PROB_GALPONES = 0.18;
export const PROB_PLAZA = 0.35;
export const PROB_CARTEL_BOCA = 0.85;
export const PROB_ADOQUIN = 0.2;
export const PROB_CAJA = { segura: 0.15, calle: 0.1, rio: 0.1 };
export const LIBRES_MINIMAS = 4;
export const BLOQUEADAS_MAXIMAS_GALPONES = 5;
/** La franja que empieza con conventillos tiene al menos estas filas. */
export const FILAS_DESPUES_DE_BOCA = 2;

// --- el transito
/** El lazo de cada carril de calle: el campo mas lo que queda afuera. */
export const LAZO = ANCHO + 130;
/** Cuanto queda afuera a la izquierda: un vehiculo de 96 entra entero. */
export const AFUERA = 110;
export const VELOCIDAD_MINIMA = 0.8;
export const FACTOR_LARGOS = 0.75;
export const LARGOS_POR_CARRIL = 2;
export const AUTOS_POR_CARRIL = 3;
export const HUECO_CELDAS = 2;
export const HUECO_SEGUNDOS = 0.5;

// --- el rio
/** El lazo de un carril de rio: tres troncos cada cinco celdas. */
export const LAZO_RIO = 15 * CEL;
export const TRONCOS_POR_CARRIL = 3;
export const TRONCO_CADA = 5;

export const AUTOS = ['torino', 'uno', 'fitito', '504', 'taxi'];
export const FLOTA = ['celeste', 'violeta', 'naranja', 'amarillo', 'verde', 'rojo', 'azul', 'jaula', 'cisterna'];
export const LINEAS = ['152', '60', '29', '39', '64', '12'];

const LARGO_AUTO = { torino: 50, uno: 44, fitito: 38, 504: 50, taxi: 50 };
/** El largo en pixeles de un modelo: los autos el suyo, camiones y colectivos 96. */
export const largoDe = (modelo) => LARGO_AUTO[modelo] ?? 96;

/**
 * Las bandas de dificultad (spec §5.5). `calle` y `rio` son los carriles por bloque,
 * `troncos` las celdas de cada tronco, `velocidad` la maxima en celdas por segundo,
 * `camara` los segundos que tarda en subir una fila y `reparto` la probabilidad de
 * autos, Red y colectivos.
 */
export const BANDAS = [
  { desde: 0, calle: [1, 2], rio: [1, 2], troncos: [3, 4], velocidad: 1.5, camara: 4, reparto: [0.8, 0.2, 0] },
  { desde: 20, calle: [1, 3], rio: [1, 3], troncos: [2, 3], velocidad: 2.5, camara: 3, reparto: [0.55, 0.3, 0.15] },
  { desde: 60, calle: [2, 4], rio: [2, 3], troncos: [2, 2], velocidad: 3.5, camara: 2.5, reparto: [0.55, 0.3, 0.15] },
  { desde: 120, calle: [2, 5], rio: [2, 4], troncos: [2, 2], velocidad: 4.5, camara: 2, reparto: [0.55, 0.3, 0.15] }
];

/** La banda de una fila. */
export const banda = (fila) => BANDAS.filter((b) => b.desde <= Math.max(0, fila)).pop();
