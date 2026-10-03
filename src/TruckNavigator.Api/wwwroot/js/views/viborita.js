/**
 * VIBORITA TBF: el Snake del 1100 con un camion (spec 2026-10-03-viborita-tbf).
 *
 * La pantalla entera es el telefono de la epoca: la carcasa de plastico azul, el
 * frente plateado con TBF, la LCD verde y la cruceta de la referencia. Nada de la
 * estetica de la app (spec §2). El motor, las reglas y lo que dibuja cada pantalla
 * son puros y viven en js/juegos/viborita/; aca va el reloj, los controles y el
 * servidor.
 */

import { api } from '../api.js';
import { vibrate, VIBRACION } from '../platform.js';
import { crearPartida, girar, avanzar } from '../juegos/viborita/motor.js';
import { pasoMs } from '../juegos/viborita/reglas.js';
import { inicio, jugando, pausa, fin, AN, AL } from '../juegos/viborita/pantallas.js';
import { pintar } from '../juegos/viborita/lcd.js';
import { FUENTE, anchoDeTexto } from '../juegos/viborita/dibujos.js';

const FLECHA = '<svg viewBox="0 0 40 40" width="38" height="38"><path d="M20 6 L34 22 H25 V34 H15 V22 H6 Z" fill="#a9c07c" stroke="#1d2418" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const TECLAS = { ArrowUp: 'arr', ArrowDown: 'aba', ArrowLeft: 'izq', ArrowRight: 'der' };

/** Un texto en la fuente de pixel, como SVG: los epigrafes y el SALIR de afuera. */
function rotulo(t, color, k = 2) {
  const px = [];
  let cx = 0;
  for (const c of t) {
    (FUENTE[c] ?? FUENTE[' ']).forEach((f, j) => [...f].forEach((p, i) => p === '#' && px.push([cx + i, j])));
    cx += 6;
  }
  const W = anchoDeTexto(t) * k, H = 7 * k;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;shape-rendering:crispEdges" aria-label="${t}">${px.map(([x, y]) => `<rect x="${x * k}" y="${y * k}" width="${k}" height="${k}" fill="${color}"/>`).join('')}</svg>`;
}

export function viboritaView(host, { go }) {
  host.className = 'viborita';
  host.innerHTML = `
    <button type="button" class="vb-salir" aria-label="Salir">${rotulo('< SALIR', '#9aa6b8')}</button>
    <div class="vb-carcasa"><span class="vb-canto"></span><span class="vb-veta"></span>
      <div class="vb-frente">
        <div class="vb-parlante"><i></i></div>
        <div class="vb-marca">TBF</div>
        <div class="vb-marco"><div class="vb-hundido"><canvas class="vb-lcd" aria-label="Pantalla del juego"></canvas></div></div>
      </div>
    </div>
    <div class="vb-cruceta">
      <button type="button" class="vb-k vb-arr" data-dir="arr" aria-label="Arriba">${FLECHA}</button>
      <button type="button" class="vb-k vb-izq" data-dir="izq" aria-label="Izquierda">${FLECHA}</button>
      <button type="button" class="vb-k vb-centro" aria-label="Centro"><span class="vb-aro"></span></button>
      <button type="button" class="vb-k vb-der" data-dir="der" aria-label="Derecha">${FLECHA}</button>
      <button type="button" class="vb-k vb-aba" data-dir="aba" aria-label="Abajo">${FLECHA}</button>
    </div>
    <div class="vb-epigrafe"></div>`;

  document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: true } }));

  const canvas = host.querySelector('.vb-lcd');
  const epigrafe = host.querySelector('.vb-epigrafe');
  const carcasa = host.querySelector('.vb-carcasa');

  let modo = 'inicio';             // inicio | jugando | pausa | fin
  let partida = crearPartida();
  let record = null;               // el valor, o null si nunca jugo
  let resultado = null;            // lo que devolvio el servidor al terminar
  let reloj = null;
  let jugadoMs = 0;                // sin contar las pausas
  let desde = 0;
  let generacion = 0;              // una por partida: descarta la respuesta de una anterior
  let finDesde = 0;                // cuando termino la ultima, para el margen del centro

  // La escala del pixel: entera (un pixel de LCD nunca borroso), la mas grande que
  // entra a lo ancho y a lo alto. Lo alto se mide: todo lo que no es la LCD
  // (salir, carcasa, cruceta, epigrafe) ocupa lo que ocupa, y la LCD toma el resto.
  let p = 3;
  const escala = () => p;
  function medir() {
    // El cromo es lo que ocupa el contenido menos la LCD. No se mide con scrollHeight:
    // con espacio libre vale lo mismo que clientHeight y la escala nunca volveria a crecer.
    const contenido = epigrafe.getBoundingClientRect().bottom - host.getBoundingClientRect().top
      + parseFloat(getComputedStyle(host).paddingBottom);
    const cromo = contenido - canvas.clientHeight;
    const porAlto = Math.floor((window.innerHeight - cromo) / AL);
    // Lo mismo a lo ancho: lo que la carcasa ocupa de mas que la LCD (los bordes cambian
    // con el media query de los telefonos angostos), no un numero fijo.
    const cromoAncho = carcasa.getBoundingClientRect().width - canvas.clientWidth;
    const porAncho = Math.floor((Math.min(window.innerWidth, 520) - cromoAncho) / AN);
    const nueva = Math.max(2, Math.min(5, porAlto, porAncho));
    if (nueva !== p) { p = nueva; dibujar(); }
  }

  function dibujar() {
    const pant = modo === 'inicio' ? inicio({ record })
      : modo === 'jugando' ? jugando(partida, { record })
      : modo === 'pausa' ? pausa(partida, { record })
      : fin(partida, { record: resultado?.record?.valor ?? record, nuevoRecord: Boolean(resultado?.nuevoRecord), guardado: resultado ? resultado.guardado !== false : undefined });
    pintar(canvas, pant.ordenes, escala());
    epigrafe.innerHTML = pant.epigrafe.map((t) => rotulo(t, modo === 'jugando' || modo === 'pausa' ? '#9aa6b8' : '#e6ead8')).join('');
  }

  function programar() {
    clearTimeout(reloj);
    reloj = setTimeout(paso, pasoMs(partida.cajas));
  }

  function paso() {
    const { partida: siguiente, evento } = avanzar(partida);
    partida = siguiente;
    if (evento === 'caja') vibrate(VIBRACION.caja);
    if (evento === 'choque' || evento === 'gano') {
      vibrate(evento === 'gano' ? VIBRACION.caja : VIBRACION.choque);
      terminar();
      return;
    }
    dibujar();
    programar();
  }

  function empezar() {
    generacion++;
    partida = crearPartida();
    resultado = null;
    jugadoMs = 0;
    desde = performance.now();
    modo = 'jugando';
    dibujar();
    programar();
  }

  function pausar() {
    if (modo !== 'jugando') return;
    clearTimeout(reloj);
    jugadoMs += performance.now() - desde;
    modo = 'pausa';
    dibujar();
  }

  function seguir() {
    desde = performance.now();
    modo = 'jugando';
    dibujar();
    programar();
  }

  async function terminar() {
    clearTimeout(reloj);
    jugadoMs += performance.now() - desde;
    finDesde = performance.now();
    modo = 'fin';
    dibujar();
    const esta = generacion;
    try {
      const r = await api.viboritaPartida(partida.cajas, Math.round(jugadoMs));
      if (esta !== generacion) return;
      resultado = { ...r, guardado: true };
      if (r.record) record = r.record.valor;
    } catch {
      if (esta !== generacion) return;
      resultado = { guardado: false };
    }
    if (modo === 'fin') dibujar();
  }

  // Un toque pensado como pausa, justo en el choque, no tiene que reiniciar la partida.
  const MARGEN_FIN_MS = 600;
  const centro = () => {
    if (modo === 'fin' && performance.now() - finDesde < MARGEN_FIN_MS) return;
    ({ inicio: empezar, jugando: pausar, pausa: seguir, fin: empezar }[modo])();
  };
  const doblar = (dir) => { if (modo === 'jugando') partida = girar(partida, dir); };

  host.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); doblar(b.dataset.dir); }));
  host.querySelector('.vb-centro').addEventListener('pointerdown', (e) => { e.preventDefault(); centro(); });
  host.querySelector('.vb-salir').addEventListener('click', () => (modo === 'jugando' ? pausar() : go('juegos')));

  // Deslizar el dedo sobre la LCD tambien gira: solo adentro de la pantalla, para
  // no pelearse con el gesto de volver de Android.
  const pantalla = host.querySelector('.vb-hundido');
  let toque = null;
  pantalla.addEventListener('touchstart', (e) => { toque = e.touches[0]; }, { passive: true });
  pantalla.addEventListener('touchend', (e) => {
    if (!toque) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toque.clientX, dy = t.clientY - toque.clientY;
    toque = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    doblar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'der' : 'izq') : (dy > 0 ? 'aba' : 'arr'));
  });

  const alTeclado = (e) => {
    if (TECLAS[e.key]) { e.preventDefault(); doblar(TECLAS[e.key]); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); centro(); }
  };
  document.addEventListener('keydown', alTeclado);

  // Se pausa sola si la app pasa a segundo plano.
  const alOcultar = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', alOcultar);

  api.progressRecords()
    .then((lista) => {
      const r = lista.find((x) => x.code === 'viborita');
      record = r ? r.value : null;
      if (modo === 'inicio') dibujar();
    })
    .catch(() => {});

  dibujar();
  medir();
  window.addEventListener('resize', medir);

  return () => {
    clearTimeout(reloj);
    window.removeEventListener('resize', medir);
    document.removeEventListener('keydown', alTeclado);
    document.removeEventListener('visibilitychange', alOcultar);
    document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: false } }));
  };
}
