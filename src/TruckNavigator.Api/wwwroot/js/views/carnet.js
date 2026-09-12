/**
 * El carnet digital: frente y dorso, se da vuelta al tocarlo.
 *
 * Es una pantalla DISTINTA del perfil, aunque compartan datos. El perfil muestra
 * logros, metas y avatares; el carnet es el documento.
 *
 * LOS ELEMENTOS SON LOS DE LA REFERENCIA DEL 12/09/2026 —titulo, firma, chip,
 * campos, foto, numero, MRZ; banda, huella, marca/modelo/patente, clase con la
 * silueta, codigo de barras—. LA EJECUCION ES LA DE UNA TARJETA PROFESIONAL:
 * pedido del usuario del 12/09/2026, "orientate en los diseños profesionales de
 * las grandes empresas". Se tomo de las tarjetas de Apple Wallet y de las
 * credenciales bancarias:
 *
 *   - Jerarquia: etiqueta chica en mayusculas espaciadas y apagada, valor grande
 *     en caja mixta. Nunca "ETIQUETA:VALOR" en mayusculas, que es convencion de
 *     ilustracion de stock, no de producto.
 *   - Dos tipografias con roles: Nunito para todo lo que se lee; la mono SOLO
 *     para lo que se copia —el numero, la patente, el MRZ—, como el numero de
 *     una tarjeta de credito.
 *   - Cada dato en su celda, dentro de un panel translucido; separacion por
 *     aire y hairlines, no por cajas de color.
 *   - Un matiz dominante con pasos tonales y UN acento (la chapa de nivel).
 *     Oro solo en el chip, porque es metal.
 *   - Profundidad real: degradado, luz radial, sombra en dos capas, filo claro
 *     arriba, y sombra propia en la foto y el chip.
 *
 * Todo lo dibujado es SVG en linea. La silueta y las ruedas cambian con el
 * camion elegido. El carnet es un OBJETO: sus colores son fijos.
 */

import { api } from '../api.js';
import { VEHICLE_TYPES, typeValue } from './trucks.js';
import { html, raw, icon, wire, q, render, escapeHtml } from '../ui.js';

/* ---------------------------------------------------------------------------
   Piezas dibujadas
--------------------------------------------------------------------------- */

/**
 * El chip EMV. Dorado con degradado metalico, bisel y un brillo arriba: es el
 * unico oro del carnet y esta porque un chip es metal.
 */
const chip = () => `
  <svg class="carnet-chip" viewBox="0 0 62 50" aria-hidden="true">
    <defs>
      <linearGradient id="carnet-oro" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0"   stop-color="#f9e3a1"/>
        <stop offset=".45" stop-color="#e5b64a"/>
        <stop offset="1"   stop-color="#c9922a"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="60" height="48" rx="8" fill="url(#carnet-oro)" stroke="#a87a1f" stroke-width="1"/>
    <rect x="21" y="15" width="20" height="20" rx="5" fill="none" stroke="#a87a1f" stroke-width="1.1"/>
    <path d="M1 19h20M1 31h20M41 19h20M41 31h20M31 1v14M31 35v14M21 25H1M41 25h20"
          fill="none" stroke="#a87a1f" stroke-width="1.1"/>
    <path d="M6 5h18" stroke="rgba(255,255,255,.65)" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

/**
 * La firma: un garabato en blanco. No es la firma de nadie —la app no tiene
 * firmas—, es el dibujo que dice "firma".
 */
const firma = () => `
  <svg class="carnet-firma" viewBox="0 0 70 30" aria-hidden="true">
    <path d="M6 22 C 12 4, 26 2, 22 14 S 16 30, 28 22 S 46 6, 42 16 S 40 26, 64 10"
          fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

/**
 * La huella de la referencia: un ovalo de anillos concentricos con cortes, en
 * azul sobre el fondo, sin caja. No es una huella de nadie.
 */
const huella = () => {
  const anillos = Array.from({ length: 11 }, (_, i) => {
    const rx = 3 + i * 3.3;
    const ry = 4.5 + i * 4.5;
    const corte = i === 0 ? '' : `stroke-dasharray="${12 + i * 6} ${3 + (i % 3) * 2}" stroke-dashoffset="${i * 9}"`;
    return `<ellipse cx="40" cy="54" rx="${rx}" ry="${ry}" ${corte}/>`;
  }).join('');

  return `
    <svg class="carnet-huella" viewBox="0 0 80 108" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${anillos}</g>
    </svg>`;
};

/**
 * Un codigo de barras, como el de las tres referencias. Es DECORATIVO: los anchos
 * salen de los caracteres del texto para que sea estable, pero no codifica nada
 * que un lector pueda leer.
 */
const codigoDeBarras = (texto, ancho = 300) => {
  const bytes = [...String(texto || 'CAMIONERO')].map((c) => c.charCodeAt(0));
  let x = 0;
  let barras = '';
  let i = 0;

  while (x < ancho) {
    const b = bytes[i % bytes.length];
    const w = 1 + (b % 3);            // 1 a 3 de ancho
    const gap = 1 + ((b >> 2) % 2);   // 1 o 2 de hueco
    barras += `<rect x="${x}" y="0" width="${w}" height="24"/>`;
    x += w + gap;
    i++;
  }

  return `
    <svg class="carnet-barras" viewBox="0 0 ${ancho} 24" preserveAspectRatio="none" aria-hidden="true">
      <g fill="#1a1a1a">${barras}</g>
    </svg>`;
};

/**
 * Posicion horizontal de las ruedas, por tipo de vehiculo, en orden de
 * IMPORTANCIA y no de izquierda a derecha: el primero es siempre el eje de
 * direccion, el segundo el de traccion, el tercero el del acoplado o el
 * semirremolque. Asi un camion de 3 ejes sale con una rueda en cada parte, y
 * uno de 6 rellena los tandems. Se toman las primeras `ejes` posiciones.
 *
 * El dibujo mira a la derecha: la cabina esta en x alto.
 */
const RUEDAS = {
  0: [130, 94, 78, 62, 46, 30],          // chasis rigido
  1: [130, 96, 38, 80, 22, 54],          // con acoplado
  2: [142, 110, 50, 96, 36, 22]          // semirremolque
};

/** Los cuerpos, por tipo. Tambien miran a la derecha. */
const CUERPOS = {
  0: `<rect x="14" y="16" width="98" height="30" rx="3"/>
      <path d="M112 22h20a4 4 0 0 1 3 1.5l7 9V46h-30z"/>
      <rect x="128" y="25" width="10" height="8" rx="1.5" class="carnet-vidrio"/>`,
  1: `<rect x="4" y="16" width="52" height="30" rx="3"/>
      <path d="M56 38h12" stroke-width="3"/>
      <rect x="68" y="16" width="44" height="30" rx="3"/>
      <path d="M112 22h20a4 4 0 0 1 3 1.5l7 9V46h-30z"/>
      <rect x="128" y="25" width="10" height="8" rx="1.5" class="carnet-vidrio"/>`,
  2: `<rect x="6" y="12" width="104" height="30" rx="3"/>
      <rect x="96" y="40" width="30" height="6" rx="1"/>
      <path d="M126 20h16a4 4 0 0 1 3 1.5l7 9V46h-26z"/>
      <rect x="140" y="23" width="9" height="8" rx="1.5" class="carnet-vidrio"/>`
};

/**
 * La silueta del camion del usuario, blanca sobre el bloque azul, como el auto de
 * la primera referencia. Cambia con el tipo y con la cantidad de ejes.
 */
const silueta = (tipo, ejes) => {
  const ruedas = (RUEDAS[tipo] ?? RUEDAS[0])
    .slice(0, Math.max(2, Math.min(6, ejes)))
    .map((x) => `<circle cx="${x}" cy="48" r="7"/><circle cx="${x}" cy="48" r="2.5" class="carnet-llanta"/>`)
    .join('');

  return `
    <svg class="carnet-silueta" viewBox="0 0 160 58" aria-hidden="true">
      <g fill="currentColor" stroke="currentColor" stroke-linejoin="round">${CUERPOS[tipo] ?? CUERPOS[0]}</g>
      <g fill="currentColor">${ruedas}</g>
    </svg>`;
};

/* ---------------------------------------------------------------------------
   Datos
--------------------------------------------------------------------------- */

const PAISES = {
  AR: 'Argentina', UY: 'Uruguay', PY: 'Paraguay', BR: 'Brasil',
  CL: 'Chile', BO: 'Bolivia', PE: 'Perú'
};

/**
 * Bandera a partir del codigo de pais: dos indicadores regionales. En Windows se
 * ven las letras; en Android, la bandera.
 */
const bandera = (codigo) =>
  typeof codigo === 'string' && codigo.length === 2
    ? String.fromCodePoint(...[...codigo.toUpperCase()].map((l) => 0x1F1E6 + l.charCodeAt(0) - 65))
    : '';

/** DD.MM.AAAA. */
const fecha = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}.${m}.${a}`;
};

/**
 * El numero del documento. Sale del identificador de la cuenta, asi que es
 * estable y no expone nada: no se puede volver del numero a la persona.
 */
const numeroDocumento = (id) => {
  const hex = String(id ?? '').replace(/-/g, '').toUpperCase().slice(0, 8);
  return hex ? `${hex.slice(0, 4)}-${hex.slice(4)}` : '—';
};

/** Texto tal como va en el MRZ: mayusculas, sin acentos, sin nada que no sea A-Z0-9. */
const mrzTexto = (t) => (t ?? '').toUpperCase().normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/[^A-Z0-9]/g, '');

/**
 * La linea tipo MRZ, al pie del dorso. Decorativa: no codifica nada. Se arma con
 * datos reales, no con relleno.
 */
const mrz = (profile, numero) =>
  `${mrzTexto(profile.nationality) || 'XX'}<<${mrzTexto(profile.lastName) || 'APELLIDO'}<<${
    mrzTexto(profile.firstName) || 'NOMBRE'}<<${numero.replace('-', '')}`.padEnd(44, '<');

// El servidor manda el tipo por su nombre de enum ("SemiTrailer"). De ahi al
// numero lo traduce trucks.js, y del numero a la etiqueta, el catalogo.
const tipoNumero = (nombre) => typeValue(nombre);

const tipoDeCamion = (nombre) =>
  VEHICLE_TYPES.find((t) => t.value === typeValue(nombre))?.label ?? '';

/**
 * El avatar del carnet. Es el mismo catalogo que el del perfil; se resuelve aca
 * por identificador para no arrastrar todo profile.js por un glifo.
 */
const AVATAR_GLYPHS = {
  'gorrita-1': '🧢', 'clasico-1': '👨🏻', 'clasico-2': '👨🏽', 'clasico-3': '👨🏿',
  'clasica-1': '👩🏽', 'formal-1': '🕴️', 'barba-1': '🧔🏽', 'mate-1': '🧉'
};

const avatarGlyph = (id) => AVATAR_GLYPHS[id] ?? '🧢';

/**
 * Un campo del carnet: etiqueta chica arriba, valor abajo. La jerarquia de las
 * tarjetas profesionales. El valor ya viene escapado; `mono` lo pone en la
 * tipografia de lo que se copia (numero, patente).
 */
const campo = (etiqueta, valor, mono = false) => `
  <div class="carnet-campo">
    <span>${etiqueta}</span>
    <b class="${mono ? 'carnet-mono' : ''}">${valor}</b>
  </div>`;

/* ---------------------------------------------------------------------------
   La vista
--------------------------------------------------------------------------- */

export function carnetView(host, { go }) {
  let profile = null;
  let progress = null;
  let camion = null;
  let dorso = false;

  host.className = 'screen';

  const shell = (body) => html`
    <div class="topbar">
      <button class="fab" id="back" aria-label="Volver">${raw(icon('back', 20))}</button>
      <h2>Carnet</h2>
    </div>
    ${raw(body)}
  `;

  async function load() {
    render(host, shell(html`<div class="center-note"><span class="spinner"></span></div>`));
    wire(host, { '#back': () => go('mapa') });

    try {
      const [p, pr, trucks] = await Promise.all([api.profile(), api.progress(), api.trucks()]);
      profile = p;
      progress = pr;
      camion = trucks.find((t) => t.id === p.activeTruckId) ?? null;
      draw();
    } catch (error) {
      render(host, shell(html`<div class="center-note">${error.message}</div>`));
      wire(host, { '#back': () => go('mapa') });
    }
  }

  function draw() {
    render(host, shell(markup()));

    wire(host, {
      '#back': () => go('mapa'),
      '#carnet': () => { dorso = !dorso; q(host, '#carnet').classList.toggle('is-flipped', dorso); },
      '#to-perfil?': () => go('perfil')      // solo existe cuando no hay camion
    });

    // Tambien con el teclado: es un boton, aunque no lo parezca.
    q(host, '#carnet')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q(host, '#carnet').click(); }
    });
  }

  function markup() {
    const nombre = escapeHtml(`${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.alias || '—');
    const pais = profile.nationality
      ? `${bandera(profile.nationality)} ${escapeHtml(PAISES[profile.nationality] ?? profile.nationality)}`
      : '—';
    const numero = numeroDocumento(profile.id);

    return html`
      <div class="scroll">
        <div class="carnet-scene">
          <div class="carnet-card ${dorso ? 'is-flipped' : ''}" id="carnet" role="button" tabindex="0"
               aria-label="Carnet de camionero. Tocá para ver el ${dorso ? 'frente' : 'dorso'}">

            <!-- ===================== FRENTE ===================== -->
            <div class="carnet-face carnet-frente">
              <div class="carnet-titulo">
                <span>${raw(icon('truck', 14))} Carnet de camionero</span>
                <em>Nivel ${progress.level} · ${escapeHtml(progress.levelName)}</em>
              </div>

              <div class="carnet-f-foto">${profile.avatarId ? avatarGlyph(profile.avatarId) : '🧢'}</div>

              <div class="carnet-panel carnet-f-panel">
                ${raw(campo('Nombre', nombre))}
                ${raw(campo('Alias', profile.alias ? `@${escapeHtml(profile.alias)}` : '—'))}
                ${raw(campo('Nacimiento', fecha(profile.birthDate)))}
                ${raw(campo('Nacionalidad', pais))}
                ${raw(campo('Experiencia', `${(progress.experience ?? 0).toLocaleString('es-AR')} EXP`))}
                <div class="carnet-campo carnet-campo-firma">
                  <span>Firma</span>
                  ${raw(firma())}
                </div>
              </div>

              <div class="carnet-f-chip">${raw(chip())}</div>
              <div class="carnet-f-numero">
                <span>Nro. de carnet</span>
                <b class="carnet-mono">${numero.replace('-', ' ')}</b>
              </div>
              <div class="carnet-f-emisor">CABA · Argentina<br>Desde ${new Date(profile.createdAt).getFullYear()}</div>
            </div>

            <!-- ===================== DORSO ===================== -->
            <div class="carnet-face carnet-dorso">
              <div class="carnet-d-banda"></div>

              ${raw(camion ? dorsoConCamion() : dorsoSinCamion())}

              <div class="carnet-d-huella">${raw(huella())}<span>Huella</span></div>
              <div class="carnet-d-barras">${raw(codigoDeBarras(camion?.plate || profile.alias))}</div>
              <div class="carnet-d-chip">${raw(chip())}</div>
              <div class="carnet-d-mrz" aria-hidden="true">${mrz(profile, numero)}</div>
            </div>
          </div>
        </div>

        <p class="hint" style="text-align:center">Tocá el carnet para darlo vuelta.</p>

        ${raw(camion ? '' : `
          <div class="card stack-sm">
            <b>El dorso está vacío</b>
            <p class="muted">Elegí en tu perfil el camión que exhibís y aparece acá, con su silueta y sus ejes.</p>
            <button class="btn btn-outline btn-duo btn-block" id="to-perfil">Ir a mi perfil</button>
          </div>`)}
      </div>
    `;
  }

  function dorsoConCamion() {
    const tipo = tipoNumero(camion.vehicleType);

    return `
      <div class="carnet-titulo carnet-d-titulo">
        <span>${escapeHtml(camion.name)}</span>
        <em class="carnet-em-suave">${escapeHtml(tipoDeCamion(camion.vehicleType))}</em>
      </div>

      <div class="carnet-panel carnet-d-panel">
        ${campo('Marca', camion.brand ? escapeHtml(camion.brand) : '—')}
        ${campo('Modelo', camion.model ? escapeHtml(camion.model) : '—')}
        ${campo('Patente', camion.plateDisplay ? escapeHtml(camion.plateDisplay) : 'Sin patente', true)}
        ${campo('Ejes', String(camion.numberOfAxles))}
        <div class="carnet-campo carnet-campo-silueta">
          <span>Silueta</span>
          ${silueta(tipo, camion.numberOfAxles)}
        </div>
      </div>`;
  }

  function dorsoSinCamion() {
    return `
      <div class="carnet-titulo carnet-d-titulo">
        <span>Sin camión elegido</span>
      </div>
      <div class="carnet-panel carnet-d-panel">
        ${campo('Marca', '—')}
        ${campo('Modelo', '—')}
        ${campo('Patente', '—')}
        ${campo('Ejes', '—')}
      </div>`;
  }

  load();
}
