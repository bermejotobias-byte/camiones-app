/**
 * Mis camiones.
 *
 * Dos listas separadas y no una sola con etiquetas: arriba los camiones
 * propios, que son con los que se rutea, y abajo el catalogo. La distincion
 * importa porque el catalogo no se edita ni se borra, y mezclarlos haria que
 * cada toque tuviera que explicarse.
 *
 * El catalogo cumple el pedido de "mostrar las caracteristicas principales de
 * cada tipo de transporte la primera vez": tocar una plantilla abre el alta con
 * sus medidas ya cargadas, para ajustarlas en vez de escribirlas de cero.
 */

import { api } from '../api.js';
import { state, setState, prefs, savePrefs, selectedTruck } from '../store.js';
import {
  html, raw, icon, wire, q, qa, render, withBusy, toastOk, toastError
} from '../ui.js';

const VEHICLE_TYPES = [
  { value: 0, label: 'Chasis rígido', hint: 'Camión simple, sin acoplado' },
  { value: 1, label: 'Con acoplado', hint: 'Camión más acoplado' },
  { value: 2, label: 'Semirremolque', hint: 'Tractor más semirremolque' }
];

export function trucksView(host, { go }) {
  let templates = [];
  let editing = null;         // null | { ...camion } cuando se esta editando

  host.className = 'screen';

  async function load() {
    render(host, shell(html`<div class="center-note"><span class="spinner"></span></div>`));
    attachTop();

    try {
      const [mine, catalog] = await Promise.all([api.trucks(), api.truckTemplates()]);
      setState({ trucks: mine });
      templates = catalog;
      draw();
    } catch (error) {
      render(host, shell(html`<div class="center-note">${error.message}</div>`));
      attachTop();
    }
  }

  const shell = (body) => html`
    <div class="topbar">
      <button class="fab" id="back" aria-label="Volver">${raw(icon('back', 20))}</button>
      <h2>${editing ? (editing.id ? 'Editar camión' : 'Nuevo camión') : 'Mis camiones'}</h2>
    </div>
    ${raw(body)}
  `;

  function attachTop() {
    wire(host, {
      '#back': () => {
        if (editing) {
          editing = null;
          draw();
          return;
        }
        go('mapa');
      }
    });
  }

  /* ------------------------------------------------------------------------
     Listado
  ------------------------------------------------------------------------ */

  function draw() {
    if (editing) return drawForm();

    const mine = state.trucks.filter((truck) => !truck.isTemplate);
    const chosen = selectedTruck();

    render(host, shell(html`
      <div class="scroll">
        <button class="btn btn-primary btn-block" id="new">
          ${raw(icon('plus', 20))} Cargar un camión
        </button>

        ${mine.length ? raw(`
          <h3>Tus camiones</h3>
          ${mine.map((truck) => truckCard(truck, truck.id === chosen?.id)).join('')}
        `) : raw(`
          <div class="empty">
            ${icon('truck', 40)}
            <b>Todavía no cargaste ninguno</b>
            <p class="hint">Cargá tu camión con sus medidas reales. Es lo que hace que
            la ruta sea la que podés hacer, y no la del auto.</p>
          </div>
        `)}

        <h3 style="margin-top:8px">Tipos de transporte</h3>
        <p class="hint" style="margin-top:-6px">
          Medidas de referencia. Tocá uno para partir de él y ajustar las tuyas.
        </p>
        ${raw(templates.map((truck) => templateCard(truck)).join(''))}

        <p class="note-source" style="text-align:center;margin-top:8px">
          Los valores del catálogo son de referencia y no representan límites legales.
        </p>
      </div>
    `));

    attachTop();

    wire(host, {
      '#new': () => {
        editing = blankTruck();
        draw();
      }
    });

    qa(host, '[data-pick]').forEach((node) =>
      node.addEventListener('click', () => {
        savePrefs({ selectedTruckId: node.dataset.pick });
        toastOk('Listo, vas a rutear con ese camión.');
        draw();
      })
    );

    qa(host, '[data-edit]').forEach((node) =>
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        editing = { ...state.trucks.find((truck) => truck.id === node.dataset.edit) };
        draw();
      })
    );

    qa(host, '[data-template]').forEach((node) =>
      node.addEventListener('click', () => {
        const source = templates.find((truck) => truck.id === node.dataset.template);

        // Se copia el molde pero no la identidad: queda como camion nuevo, sin id.
        editing = {
          ...blankTruck(),
          name: source.name,
          grossWeightKg: source.grossWeightKg,
          heightMeters: source.heightMeters,
          widthMeters: source.widthMeters,
          lengthMeters: source.lengthMeters,
          numberOfAxles: source.numberOfAxles,
          vehicleType: VEHICLE_TYPES.find((type) => type.label === source.vehicleType)?.value
            ?? typeValue(source.vehicleType),
          hasTrailer: source.hasTrailer,
          trailerLengthMeters: source.trailerLengthMeters
        };

        draw();
      })
    );
  }

  const truckCard = (truck, isChosen) => `
    <div class="card card-tap ${isChosen ? 'card-selected' : ''}" data-pick="${truck.id}">
      <div class="row">
        <span style="color:var(--brand)">${icon('truck', 22)}</span>
        <b class="grow truncate">${escapeText(truck.name)}</b>
        ${isChosen ? '<span class="pill pill-brand">En uso</span>' : ''}
      </div>
      ${specs(truck)}
      <div class="row" style="gap:8px">
        <button class="btn btn-ghost grow" data-edit="${truck.id}">Editar</button>
      </div>
    </div>
  `;

  const templateCard = (truck) => `
    <div class="card card-tap" data-template="${truck.id}">
      <div class="row">
        <b class="grow truncate">${escapeText(truck.name)}</b>
        <span class="pill pill-brand">Catálogo</span>
      </div>
      ${specs(truck)}
    </div>
  `;

  /** Las cuatro medidas que decidieron la ruta, siempre en el mismo orden. */
  const specs = (truck) => `
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);gap:6px">
      ${spec('Peso', `${(truck.grossWeightKg / 1000).toFixed(1).replace('.0', '')} t`)}
      ${spec('Alto', `${truck.heightMeters} m`)}
      ${spec('Ancho', `${truck.widthMeters} m`)}
      ${spec('Largo', `${truck.totalLengthMeters} m`)}
    </div>
  `;

  const spec = (label, value) => `
    <div class="stat" style="padding:8px 10px">
      <b class="num" style="font-size:15px">${escapeText(value)}</b>
      <span>${escapeText(label)}</span>
    </div>
  `;

  /* ------------------------------------------------------------------------
     Alta y edicion
  ------------------------------------------------------------------------ */

  function drawForm() {
    const truck = editing;

    render(host, shell(html`
      <div class="scroll">
        <form class="stack" id="form" novalidate>
          <div class="field">
            <label for="name">Nombre</label>
            <input class="input" id="name" value="${truck.name}"
                   placeholder="El Scania, El de la empresa…" maxlength="120">
            <p class="hint">Para reconocerlo cuando tengas varios.</p>
          </div>

          <div class="field">
            <label>Tipo</label>
            <div class="stack-sm">
              ${raw(VEHICLE_TYPES.map((type) => `
                <label class="row card" style="padding:12px 14px;cursor:pointer;gap:10px">
                  <input type="radio" name="vehicleType" value="${type.value}"
                         ${Number(truck.vehicleType) === type.value ? 'checked' : ''}
                         style="width:20px;height:20px;accent-color:var(--brand)">
                  <span class="grow">
                    <b style="display:block;font-size:14.5px">${type.label}</b>
                    <span class="hint">${type.hint}</span>
                  </span>
                </label>
              `).join(''))}
            </div>
          </div>

          <div class="stat-grid">
            ${raw(numberField('grossWeightKg', 'Peso total (kg)', truck.grossWeightKg, 500, 100000, 100))}
            ${raw(numberField('numberOfAxles', 'Ejes', truck.numberOfAxles, 2, 12, 1))}
            ${raw(numberField('heightMeters', 'Alto (m)', truck.heightMeters, 1, 6, 0.05))}
            ${raw(numberField('widthMeters', 'Ancho (m)', truck.widthMeters, 1, 4, 0.05))}
          </div>

          ${raw(numberField('lengthMeters', 'Largo del chasis (m)', truck.lengthMeters, 1, 40, 0.1))}

          <label class="row card" style="padding:12px 14px;cursor:pointer;gap:10px">
            <input type="checkbox" id="hasTrailer" ${truck.hasTrailer ? 'checked' : ''}
                   style="width:20px;height:20px;accent-color:var(--brand)">
            <span class="grow"><b style="font-size:14.5px">Lleva acoplado</b></span>
          </label>

          <div id="trailer-wrap" ${truck.hasTrailer ? '' : 'hidden'}>
            ${raw(numberField('trailerLengthMeters', 'Largo del acoplado (m)',
                  truck.trailerLengthMeters ?? 0, 0, 30, 0.1))}
          </div>

          <div class="card" style="border-color:var(--warn);background:var(--warn-soft)">
            <p style="font-size:14px;color:var(--warn)">
              <b>Cargá las medidas reales.</b> Con el camión cargado y con la altura
              del punto más alto. La ruta se calcula con estos números.
            </p>
          </div>

          <p class="error" id="error" hidden></p>

          <button class="btn btn-primary btn-block" type="submit" id="save">Guardar</button>

          ${truck.id ? raw(`
            <button class="btn btn-danger btn-block" type="button" id="delete">
              ${icon('trash', 20)} Borrar este camión
            </button>
            <p class="hint" style="text-align:center">
              Borrarlo no borra los viajes que hiciste con él.
            </p>
          `) : ''}
        </form>
      </div>
    `));

    attachTop();

    wire(host, {
      '#hasTrailer@change': (event) => {
        q(host, '#trailer-wrap').hidden = !event.target.checked;
      },
      '#form@submit': (event) => {
        event.preventDefault();
        save(q(host, '#save'));
      },
      '#delete?': (event) => remove(event.currentTarget)
    });
  }

  const numberField = (id, label, value, min, max, step) => `
    <div class="field">
      <label for="${id}">${label}</label>
      <input class="input num" id="${id}" type="number" inputmode="decimal"
             value="${value ?? ''}" min="${min}" max="${max}" step="${step}">
    </div>
  `;

  function collect() {
    const number = (id) => Number(q(host, `#${id}`).value);
    const hasTrailer = q(host, '#hasTrailer').checked;

    return {
      name: q(host, '#name').value.trim(),
      vehicleType: Number(q(host, 'input[name="vehicleType"]:checked')?.value ?? 0),
      grossWeightKg: number('grossWeightKg'),
      heightMeters: number('heightMeters'),
      widthMeters: number('widthMeters'),
      lengthMeters: number('lengthMeters'),
      numberOfAxles: number('numberOfAxles'),
      hasTrailer,
      trailerLengthMeters: hasTrailer ? number('trailerLengthMeters') : null
    };
  }

  async function save(button) {
    const data = collect();
    const error = q(host, '#error');
    error.hidden = true;

    if (!data.name) {
      error.textContent = 'Poné un nombre para reconocerlo.';
      error.hidden = false;
      return;
    }

    await withBusy(button, 'Guardando', async () => {
      try {
        const saved = editing.id
          ? await api.updateTruck(editing.id, data)
          : await api.createTruck(data);

        // Un camion recien cargado pasa a ser el elegido: es lo que el usuario
        // vino a hacer, y obligarlo a elegirlo despues es un paso de mas.
        savePrefs({ selectedTruckId: saved.id });

        editing = null;
        toastOk('Camión guardado.');
        await load();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  }

  async function remove(button) {
    if (!confirm('¿Borrar este camión? Los viajes que hiciste con él se conservan.')) return;

    await withBusy(button, 'Borrando', async () => {
      try {
        await api.deleteTruck(editing.id);

        if (prefs.selectedTruckId === editing.id) savePrefs({ selectedTruckId: null });

        editing = null;
        toastOk('Camión borrado.');
        await load();
      } catch (err) {
        toastError(err.message);
      }
    });
  }

  load();
}

const blankTruck = () => ({
  id: null,
  name: '',
  vehicleType: 0,
  grossWeightKg: 18000,
  heightMeters: 3.8,
  widthMeters: 2.5,
  lengthMeters: 12,
  numberOfAxles: 3,
  hasTrailer: false,
  trailerLengthMeters: null
});

const typeValue = (name) =>
  ({ RigidTruck: 0, TruckWithTrailer: 1, SemiTrailer: 2 })[name] ?? 0;

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
