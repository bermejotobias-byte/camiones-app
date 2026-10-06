/**
 * El motor de VIBORITA TBF: el Snake, paso a paso (spec §4).
 *
 * Puro: recibe una partida y devuelve otra, sin reloj ni pantalla. El azar se
 * inyecta, asi los tests son exactos. El reloj y los controles los pone la vista.
 */

import { COLUMNAS, FILAS, GIROS_EN_COLA } from './reglas.js';

const DIRECCION = { arr: { x: 0, y: -1 }, aba: { x: 0, y: 1 }, izq: { x: -1, y: 0 }, der: { x: 1, y: 0 } };
const OPUESTO = { arr: 'aba', aba: 'arr', izq: 'der', der: 'izq' };

const igual = (a, b) => a.x === b.x && a.y === b.y;

/** Una celda libre al azar, o null si el camion ya ocupa todo el campo. */
export function ponerCaja(cuerpo, azar) {
  const libres = [];
  for (let y = 0; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS; x++) {
      if (!cuerpo.some((c) => c.x === x && c.y === y)) libres.push({ x, y });
    }
  }
  return libres.length ? libres[Math.floor(azar() * libres.length)] : null;
}

/** La cabina y dos acoplados en la fila del medio, yendo a la derecha. */
export function crearPartida(azar = Math.random) {
  const fila = Math.floor(FILAS / 2);
  const cuerpo = [{ x: 2, y: fila }, { x: 1, y: fila }, { x: 0, y: fila }];
  return { cuerpo, rumbo: 'der', giros: [], caja: ponerCaja(cuerpo, azar), cajas: 0, estado: 'jugando', motivo: null };
}

/**
 * Encola un giro. Se compara contra el ultimo giro pendiente, no contra el rumbo:
 * asi dos toques rapidos (abajo, izquierda) se respetan los dos, y el segundo no
 * se toma como un giro en U del primero.
 */
export function girar(partida, dir) {
  if (!DIRECCION[dir] || partida.estado !== 'jugando') return partida;
  const ultimo = partida.giros.at(-1) ?? partida.rumbo;
  if (dir === ultimo || dir === OPUESTO[ultimo] || partida.giros.length >= GIROS_EN_COLA) return partida;
  return { ...partida, giros: [...partida.giros, dir] };
}

/** Un paso: mueve, levanta la caja, choca o gana. */
export function avanzar(partida, azar = Math.random) {
  if (partida.estado !== 'jugando') return { partida, evento: null };

  const [giro, ...giros] = partida.giros;
  const rumbo = giro ?? partida.rumbo;
  const d = DIRECCION[rumbo];
  const cabeza = partida.cuerpo[0];
  const siguiente = { x: cabeza.x + d.x, y: cabeza.y + d.y };

  const choco = (motivo) => ({ partida: { ...partida, rumbo, giros, estado: 'choco', motivo }, evento: 'choque' });

  if (siguiente.x < 0 || siguiente.x >= COLUMNAS || siguiente.y < 0 || siguiente.y >= FILAS) return choco('borde');

  const levanta = partida.caja !== null && igual(siguiente, partida.caja);
  // La celda que deja la cola en este mismo paso esta libre: perseguirse la cola no es choque.
  const resto = levanta ? partida.cuerpo : partida.cuerpo.slice(0, -1);
  if (resto.some((c) => igual(c, siguiente))) return choco('cola');

  const cuerpo = [siguiente, ...resto];

  if (!levanta) return { partida: { ...partida, cuerpo, rumbo, giros }, evento: null };

  const caja = ponerCaja(cuerpo, azar);
  const cajas = partida.cajas + 1;

  if (caja === null) return { partida: { ...partida, cuerpo, rumbo, giros, caja, cajas, estado: 'gano' }, evento: 'gano' };
  return { partida: { ...partida, cuerpo, rumbo, giros, caja, cajas }, evento: 'caja' };
}
