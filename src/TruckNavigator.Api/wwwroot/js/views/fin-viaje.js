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
  const desbloqueados = earned?.completedTiers ?? [];
  const dice = textoDeCierre(cerrado);
  const subioDeNivel = Boolean(earned?.leveledUp);

  const km = Math.round((cerrado.creditedDistanceMeters ?? 0) / 100) / 10;
  const segundos = cerrado.elapsedSeconds ?? 0;
  const exp = earned?.totalExperience ?? 0;

  // El invitado no festeja: sin cuenta no se acredito nada, y una pantalla
  // de festejo sobre cero kilometros seria una mentira amable. Lo que si hay
  // es el numero que acaba de andar y la unica frase que corresponde.
  if (cerrado.invitado) {
    render(host, html`
      <div class="scroll fin-viaje">
        <div class="fin-escena">
          ${raw(mascota('saludo', { escala: 3, clase: 'fin-mascota' }))}
        </div>

        <h1 class="fin-titulo">${dice.titulo}</h1>
        <p class="fin-bajada muted">${dice.bajada}</p>

        <div class="grow"></div>

        <button class="btn btn-primary btn-duo btn-block brillo" id="crear">Crear mi cuenta</button>
        <button class="btn btn-outline btn-duo btn-block" id="seguir">Seguir sin cuenta</button>
      </div>
    `);

    wire(host, { '#crear': () => go('cuenta-nueva'), '#seguir': () => go('mapa') });

    return;
  }

  render(host, html`
    <div class="scroll fin-viaje ${reducido() ? 'fin-quieto' : ''}">
      <div class="fin-escena">
        ${raw(confeti(dice.festeja ? 26 : 0))}
        ${raw(mascota(dice.festeja ? (subioDeNivel ? 'nivel' : 'festejo') : 'error', { escala: 3, clase: 'fin-mascota' }))}
      </div>

      <h1 class="fin-titulo">${raw(dice.titulo)}</h1>

      <p class="fin-bajada muted">${raw(dice.bajada)}</p>

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

/**
 * Que dice la pantalla al cerrar un viaje.
 *
 * El INVITADO no festeja: no hay EXP, no hay insignias y no hay confeti, porque
 * no hay nada que festejar y fingirlo seria mentir. Lo que si hay es el numero
 * —los kilometros que acaba de andar— y la frase que dice la verdad: no se
 * guardaron. Es el momento en que alguien acaba de comprobar que la app le
 * sirve, y por eso es donde se le ofrece la cuenta, y no con un cartel antes de
 * dejarlo probar.
 */
export function textoDeCierre(cerrado) {
  if (cerrado.invitado) {
    const km = Math.round((cerrado.distanceMeters ?? 0) / 100) / 10;

    return {
      titulo: `Hiciste ${km.toLocaleString('es-AR')} km`,
      bajada: 'No se guardaron. Con una cuenta, cada viaje suma kilómetros, sube tu nivel y te deja reportar.',
      acciones: ['crear-cuenta', 'seguir'],
      festeja: false
    };
  }

  const acredito = (cerrado.creditedDistanceMeters ?? 0) > 0;
  const subio = Boolean(cerrado.earned?.leveledUp);

  return {
    titulo: subio
      ? `¡Subiste a ${escapeHtml(cerrado.earned.levelAfter.name)}!`
      : acredito ? '¡Viaje completado!' : 'Llegaste',
    bajada: acredito
      ? `${escapeHtml(cerrado.originLabel ?? 'Origen')} → ${escapeHtml(cerrado.destinationLabel ?? 'Destino')}`
      : 'No sumó kilómetros: pasó menos de la mitad del tiempo estimado. Igual llegaste.',
    acciones: ['seguir'],
    festeja: acredito
  };
}
