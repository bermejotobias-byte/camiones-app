/**
 * Fin de viaje: lo que el viaje dejo, y la mascota festejandolo.
 *
 * Es donde la progresion se VE ocurrir. Hasta esta pantalla el motor acreditaba
 * en silencio: el camionero cerraba el viaje y no veia nada. Estructura de la
 * pantalla de fin de actividad de Duolingo (skill de diseño §5): ilustracion
 * grande y centrada, titulo en color calido, tres fichas cada una con su color,
 * boton primario ancho.
 *
 * Decision del usuario del 10/09/2026: se muestran LAS ESTADISTICAS DEL VIAJE,
 * LA EXP GANADA Y LO DESBLOQUEADO — y no la progresion de escalones, que vive en
 * el perfil. Los escalones que este viaje completo si se muestran, porque son lo
 * desbloqueado.
 *
 * La secuencia, en orden y con retardos, es lo que la hace gratificante: entra la
 * mascota con rebote, cae el confeti, sube el titulo, suben las fichas de a una y
 * sus numeros cuentan hasta el valor. Con prefers-reduced-motion todo aparece
 * quieto y los numeros salen enteros.
 *
 * Los datos vienen del cierre del viaje (TripDto con `earned`), guardados en
 * state.cerrado por navigate.js antes de venir. Sin eso no hay nada que mostrar
 * y se vuelve al mapa.
 */

import { state, setState } from '../store.js';
import { mascota } from '../mascota.js';
import { insignia, PISTAS } from '../logros.js';
import { html, raw, wire, qa, render, escapeHtml, formatDuration } from '../ui.js';

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function finViajeView(host, { go }) {
  host.className = 'screen';

  const cerrado = state.cerrado;

  if (!cerrado) {
    go('mapa');
    return;
  }

  // Se consume: volver atras no tiene que volver a festejar el mismo viaje.
  setState({ cerrado: null });

  const earned = cerrado.earned ?? null;
  const acredito = (cerrado.creditedDistanceMeters ?? 0) > 0;
  const subioDeNivel = Boolean(earned?.leveledUp);
  const desbloqueados = earned?.completedTiers ?? [];

  const titulo = subioDeNivel
    ? `¡Subiste a ${escapeHtml(earned.levelAfter.name)}!`
    : acredito ? '¡Viaje completado!' : 'Llegaste';

  const km = Math.round((cerrado.creditedDistanceMeters ?? 0) / 100) / 10;
  const segundos = cerrado.elapsedSeconds ?? 0;
  const exp = earned?.totalExperience ?? 0;

  render(host, html`
    <div class="scroll fin-viaje ${reducido() ? 'fin-quieto' : ''}">
      <div class="fin-escena">
        ${raw(confeti(acredito ? 26 : 0))}
        ${raw(mascota(acredito ? (subioDeNivel ? 'nivel' : 'festejo') : 'error', { escala: 3, clase: 'fin-mascota' }))}
      </div>

      <h1 class="fin-titulo">${raw(titulo)}</h1>

      <p class="fin-bajada muted">
        ${raw(acredito
          ? `${escapeHtml(cerrado.originLabel ?? 'Origen')} → ${escapeHtml(cerrado.destinationLabel ?? 'Destino')}`
          : 'No sumó kilómetros: pasó menos de la mitad del tiempo estimado. Igual llegaste.')}
      </p>

      <div class="fichas">
        ${raw(ficha('Kilómetros', km, 'km', 'var(--cool-1)', 0))}
        ${raw(ficha('Al volante', segundos, 'tiempo', 'var(--cool-3)', 1))}
        ${raw(ficha('EXP ganada', exp, 'exp', 'var(--cool-4)', 2))}
      </div>

      ${raw(desbloqueados.length ? `
        <p class="section-caps fin-seccion">Desbloqueaste</p>
        <div class="fin-logros">
          ${desbloqueados.map((t, i) => `
            <div class="fin-logro" style="--demora:${700 + i * 120}ms">
              ${insignia(t.trackCode, t.tier, t.goal, { tamanio: 56 })}
              <div>
                <b>${escapeHtml(PISTAS[t.trackCode]?.nombre ?? t.trackCode)}</b>
                <span class="muted">Escalón ${t.tier} · ${Number(t.goal).toLocaleString('es-AR')}</span>
              </div>
            </div>`).join('')}
        </div>` : '')}

      ${raw(subioDeNivel ? `
        <div class="card fin-nivel">
          <span class="section-caps">Nivel ${earned.levelBefore.number} → ${earned.levelAfter.number}</span>
          <b>${escapeHtml(earned.levelBefore.name)} → ${escapeHtml(earned.levelAfter.name)}</b>
        </div>` : '')}

      <div class="grow"></div>

      <button class="btn btn-accent btn-duo btn-block fin-boton" id="seguir">Continuar</button>
    </div>
  `);

  wire(host, { '#seguir': () => go('mapa') });

  animarCifras(host);
}

/**
 * Una ficha de estadistica (skill §4): borde de su color, etiqueta arriba en
 * mayusculas chicas, valor grande abajo. `tipo` dice como se formatea el numero
 * mientras cuenta.
 */
const ficha = (etiqueta, valor, tipo, color, orden) => `
  <div class="ficha" style="--ficha:${color};--demora:${350 + orden * 110}ms">
    <span>${etiqueta}</span>
    <b class="num" data-cuenta="${valor}" data-tipo="${tipo}">${formatear(0, tipo)}</b>
  </div>`;

const formatear = (n, tipo) => {
  if (tipo === 'km') return `${(Math.round(n * 10) / 10).toLocaleString('es-AR')} km`;
  if (tipo === 'tiempo') return formatDuration(Math.round(n));
  return `+${Math.round(n).toLocaleString('es-AR')}`;
};

/**
 * Los numeros cuentan desde cero hasta su valor, con salida suave. Arrancan
 * despues de que la ficha entro, y con movimiento reducido salen enteros.
 */
function animarCifras(host) {
  const cifras = qa(host, '[data-cuenta]');

  if (reducido()) {
    cifras.forEach((n) => { n.textContent = formatear(Number(n.dataset.cuenta), n.dataset.tipo); });
    return;
  }

  cifras.forEach((n, i) => {
    const objetivo = Number(n.dataset.cuenta);
    const tipo = n.dataset.tipo;
    const duracion = 900;
    const arranque = performance.now() + 450 + i * 110;

    const paso = (ahora) => {
      const t = Math.min(1, Math.max(0, (ahora - arranque) / duracion));
      const suave = 1 - Math.pow(1 - t, 3);          // sale rapido, frena al llegar
      n.textContent = formatear(objetivo * suave, tipo);
      if (t < 1) requestAnimationFrame(paso);
    };

    requestAnimationFrame(paso);

    // Seguro: si la pestaña esta oculta, requestAnimationFrame no corre y el
    // numero se quedaria en cero. Pase lo que pase, al final esta el valor.
    setTimeout(() => { n.textContent = formatear(objetivo, tipo); }, 450 + i * 110 + duracion + 100);
  });
}

/**
 * El confeti: papelitos que caen, cada uno con su color, su posicion y su
 * demora, todo por variables CSS. Colores de la paleta fria mas el acento —es
 * la excepcion que la paleta si permite, porque es festejo—.
 */
function confeti(cuantos) {
  const colores = ['var(--brand)', 'var(--reward)', 'var(--cool-2)', 'var(--accent)', 'var(--cool-3)'];
  let s = '';

  for (let i = 0; i < cuantos; i++) {
    const x = Math.round((i / cuantos) * 100 + (i % 3) * 3);
    const demora = Math.round((i * 37) % 900);
    const giro = (i % 2 ? 1 : -1) * (180 + (i * 53) % 360);
    s += `<i class="papelito" style="--x:${x}%;--demora:${demora}ms;--giro:${giro}deg;--color:${colores[i % colores.length]}"></i>`;
  }

  return s;
}
