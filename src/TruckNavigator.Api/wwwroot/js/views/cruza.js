/**
 * CRUZA, MONO: el Crossy Road porteño con el mono de la app
 * (spec 2026-10-04-cruza-mono).
 *
 * Pantalla completa sobre negro. El mundo, el motor y los dibujos viven en
 * js/juegos/cruza/; aca va el reloj, los gestos, la pausa y el servidor. El juego
 * se dibuja en un lienzo logico de 216 x 340 y se copia a escala entera en pixeles
 * fisicos: un pixel del juego nunca queda borroso.
 */

import { api } from '../api.js';
import { vibrate, VIBRACION } from '../platform.js';
import { rotulo } from '../juegos/viborita/dibujos.js';
import { crearPartida, pedirPaso, avanzar, puntaje } from '../juegos/cruza/motor.js';
import { ANCHO, ALTO, UMBRAL_DESLIZAR } from '../juegos/cruza/reglas.js';
import { lienzo } from '../juegos/cruza/sprites.js';
import {
  crearVisual, actualizarVisual, dibujarJuego, dibujarPausa, dibujarInicio, dibujarFin,
  BOTONES, botonEn, tamanoDelCampo, precalentar
} from '../juegos/cruza/pantallas.js';

const TECLAS = {
  ArrowUp: 'arr', ArrowDown: 'aba', ArrowLeft: 'izq', ArrowRight: 'der',
  w: 'arr', s: 'aba', a: 'izq', d: 'der', W: 'arr', S: 'aba', A: 'izq', D: 'der'
};
/** El motor avanza en pasos fijos: lo que choca no depende de los cuadros por segundo. */
const PASO_FIJO = 1000 / 60;
/** Un toque pensado para el juego, justo en el final, no tiene que reiniciar la partida. */
const MARGEN_FIN_MS = 600;

function imagen(pose) {
  const im = new Image();
  im.src = `/img/mascota/${pose}.png`;
  return im;
}

export function cruzaView(host, { go }) {
  host.className = 'cruza';
  host.innerHTML = `
    <button type="button" class="cz-salir" aria-label="Salir">${rotulo('< SALIR', '#9aa6b8')}</button>
    <div class="cz-campo"><canvas class="cz-lienzo" aria-label="CRUZÁ, MONO"></canvas></div>`;

  const caja = host.querySelector('.cz-campo');
  const canvas = host.querySelector('.cz-lienzo');
  const pantalla = canvas.getContext('2d');
  const escena = lienzo(ANCHO, ALTO);
  const c = escena.getContext('2d');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const imagenes = { joystick: imagen('joystick'), rueda: imagen('rueda'), festejo: imagen('festejo') };
  const t0 = performance.now();

  let modo = 'inicio';             // inicio | jugando | pausa | fin
  let partida = null;
  let vis = crearVisual();
  let record = null;               // el HI-SCORE del servidor, o null si nunca jugo
  let resumen = null;              // lo que muestra el final
  let generacion = 0;              // una por partida: descarta la respuesta de una anterior
  let jugadoMs = 0;                // sin contar las pausas
  let finDesde = 0;
  let cuadro = 0;
  let ultimo = null;
  let acumulado = 0;

  function medir() {
    const dpr = globalThis.devicePixelRatio || 1;
    const { ancho, alto, anchoCss, altoCss } = tamanoDelCampo(caja.clientWidth, caja.clientHeight, dpr);
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho;
      canvas.height = alto;
    }
    canvas.style.width = `${anchoCss}px`;
    canvas.style.height = `${altoCss}px`;
  }

  function pintar() {
    const ahora = performance.now();
    const t = quieto ? 1.3 : (ahora - t0) / 1000;
    const hi = record ?? 0;
    if (modo === 'inicio') dibujarInicio(c, t, { hi, imagenes, quieto });
    else if (modo === 'jugando') dibujarJuego(c, partida, vis, t, { hi, quieto });
    else if (modo === 'pausa') dibujarPausa(c, partida, vis, t, { hi });
    else dibujarFin(c, t, { ...resumen, imagenes, quieto, tFin: (ahora - finDesde) / 1000 });
    pantalla.imageSmoothingEnabled = false;
    pantalla.drawImage(escena, 0, 0, canvas.width, canvas.height);
  }

  function bucle(ahora) {
    cuadro = requestAnimationFrame(bucle);
    const dt = ultimo === null ? 0 : Math.min(100, ahora - ultimo);
    ultimo = ahora;
    if (modo === 'jugando') {
      jugadoMs += dt;
      acumulado += dt;
      while (acumulado >= PASO_FIJO && modo === 'jugando') {
        acumulado -= PASO_FIJO;
        const eventos = avanzar(partida, PASO_FIJO);
        actualizarVisual(vis, partida, eventos, PASO_FIJO);
        for (const e of eventos) {
          if (e.tipo === 'caja') vibrate(VIBRACION.caja);
          if (e.tipo === 'golpe') vibrate(VIBRACION.choque);
          if (e.tipo === 'fin') terminar();
        }
      }
    }
    pintar();
  }

  function empezar() {
    generacion++;
    partida = crearPartida((Math.random() * 2 ** 32) >>> 0);
    vis = crearVisual();
    resumen = null;
    jugadoMs = 0;
    acumulado = 0;
    modo = 'jugando';
  }

  const pausar = () => { if (modo === 'jugando') modo = 'pausa'; };
  const seguir = () => { if (modo === 'pausa') { modo = 'jugando'; ultimo = null; acumulado = 0; } };

  async function terminar() {
    modo = 'fin';
    finDesde = performance.now();
    const { maxFila: filas, cajas } = partida;
    const score = puntaje(partida);
    resumen = { score, hi: Math.max(record ?? 0, score), filas, cajas, nuevoRecord: false, guardado: undefined };
    const esta = generacion;
    try {
      const r = await api.cruzaPartida(filas, cajas, Math.round(jugadoMs));
      if (esta !== generacion) return;
      if (r.record) record = r.record.valor;
      resumen = { ...resumen, hi: Math.max(record ?? 0, score), nuevoRecord: Boolean(r.nuevoRecord), guardado: true };
    } catch {
      if (esta !== generacion) return;
      resumen = { ...resumen, guardado: false };
    }
  }

  function accion(nombre) {
    if (nombre === 'seguir') seguir();
    if (nombre === 'otra') empezar();
    if (nombre === 'salir') go('juegos');
  }

  const paso = (dir) => { if (modo === 'jugando') pedirPaso(partida, dir); };

  /** Un toque: arrancar, un paso adelante, o el boton que haya abajo del dedo. */
  function tocar(xCss, yCss) {
    if (modo === 'inicio') return empezar();
    if (modo === 'jugando') return paso('arr');
    if (modo === 'fin' && performance.now() - finDesde < MARGEN_FIN_MS) return;
    const r = canvas.getBoundingClientRect();
    const x = ((xCss - r.left) * ANCHO) / r.width;
    const y = ((yCss - r.top) * ALTO) / r.height;
    accion(botonEn(BOTONES[modo], x, y));
  }

  // Un gesto es un paso: el deslizamiento se decide al cruzar el umbral, sin
  // esperar a que se levante el dedo, y lo que siga del mismo gesto no cuenta.
  let gesto = null;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gesto = { x: e.clientX, y: e.clientY, deslizo: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!gesto || gesto.deslizo) return;
    const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL_DESLIZAR) return;
    gesto.deslizo = true;
    paso(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'der' : 'izq') : dy > 0 ? 'aba' : 'arr');
  });
  canvas.addEventListener('pointerup', (e) => {
    if (gesto && !gesto.deslizo) tocar(e.clientX, e.clientY);
    gesto = null;
  });
  canvas.addEventListener('pointercancel', () => { gesto = null; });

  host.querySelector('.cz-salir').addEventListener('click', () => (modo === 'jugando' ? pausar() : go('juegos')));

  const alTeclado = (e) => {
    if (TECLAS[e.key] && modo === 'jugando') { e.preventDefault(); paso(TECLAS[e.key]); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (modo === 'inicio') empezar();
    else if (modo === 'pausa') seguir();
    else if (modo === 'fin' && performance.now() - finDesde >= MARGEN_FIN_MS) empezar();
  };
  document.addEventListener('keydown', alTeclado);

  // Se pausa sola si la app pasa a segundo plano.
  const alOcultar = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', alOcultar);

  api.progressRecords()
    .then((lista) => {
      const r = lista.find((x) => x.code === 'cruza');
      record = r ? r.value : null;
    })
    .catch(() => {});

  precalentar();

  const observador = new ResizeObserver(medir);
  observador.observe(caja);
  medir();
  cuadro = requestAnimationFrame(bucle);

  // Al final del montaje: si algo de arriba falla, el zocalo de la app no queda oculto.
  document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: true } }));

  return () => {
    cancelAnimationFrame(cuadro);
    observador.disconnect();
    document.removeEventListener('keydown', alTeclado);
    document.removeEventListener('visibilitychange', alOcultar);
    document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: false } }));
  };
}
