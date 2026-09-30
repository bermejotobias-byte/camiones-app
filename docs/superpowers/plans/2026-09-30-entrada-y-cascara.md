# La entrada y la cáscara — plan de implementación

> **Para quien ejecute:** usar `superpowers:executing-plans` (inline, con revisión
> entre tareas) o `superpowers:subagent-driven-development`. Los pasos llevan
> casilla para ir marcando.

**Objetivo:** que la app tenga una puerta —Bienvenida → Idioma → Condiciones →
Acceso—, que alguien pueda probar el GPS como invitado durante un día sin crear
cuenta, y que el menú MÁS quede completo con Reportes en vivo.

**Arquitectura:** todo en el cliente; el servidor no se toca. Una función pura
(`js/sesion.js`) decide en qué estado está la app —`nueva`, `invitado`,
`cuenta`— y qué puede hacer cada estado; `app.js` le pregunta una vez por
montaje y deja de tener puertas propias. Las pantallas van como un módulo por
superficie en `js/entrada/`, el patrón de AD-48. El vocabulario visual del
prototipo entra primero a `app.css`, porque todas las pantallas se apoyan en él.

**Stack:** módulos ES nativos servidos tal cual (sin paso de compilación,
AD-21), `node --test` para lo puro, el navegador del entorno a 375 × 812 para
las pantallas, y el APK al cierre.

**Spec:** `docs/superpowers/specs/2026-09-30-entrada-y-cascara-design.md` — se
lee junto con este plan; las decisiones y su porqué viven ahí.

## Dónde quedamos — 30/09/2026

**Las etapas 1 a 5 están hechas, salvo el teléfono.** Veinte tareas, un commit
por tarea, 335 tests de JS verdes y ningún cambio en el servidor. El porqué
quedó en **AD-51**; lo verificado, en la skill `estado-camiones-app` §4.

Lo único que falta es la **Task 21**: compilar el APK y que el usuario recorra
la entrada de cero, pruebe el invitado y cree su cuenta mientras se lee el log.

Cuatro defectos los atrapó la verificación de punta a punta y no los tests, y
están anotados en sus commits: el invitado se quedaba sin camión, llegar a
destino no cerraba su viaje, la ficha mostraba el largo del tractor en vez del
conjunto, y la luz tapaba la cabecera.

---

## Restricciones globales

- **El servidor no se toca**: ni dominio, ni endpoints, ni migraciones, ni
  `Program.cs`. Si una tarea parece necesitarlo, está mal entendida: pararse y
  preguntar.
- **Castellano en todo**: código, comentarios, commits y textos. En `.js` los
  acentos van bien; **en `.cs` no** (no se toca ningún `.cs` acá).
- **Los tests de JS se corren desde bash**: `node --test "tests/web/*.test.mjs"`.
  Al empezar son **224** y todos pasan.
- **TDD estricto**: cada test se ve fallar antes de escribir el código. Un test
  que pasa de entrada no prueba nada.
- **Un commit por tarea**, con el mensaje explicando *por qué*, no *qué*.
- **No se commitea** `routing/config-truck.yml` (siempre aparece modificado, a
  propósito) ni `.claude/launch.json`.
- **La rama es `cuentas-de-usuario`** y no se pushea salvo que el usuario lo pida.
- **Lo que el prototipo decide, manda el prototipo**
  (`docs/diseno/prototipo/final.mjs` es la fuente de los valores exactos; el
  porqué está en la skill `diseno-camiones-app` §16). No se inventan variantes
  visuales en el medio.
- **Una sola pieza naranja por región** (el naranja es la voz del mono, nunca el
  botón de un formulario) y **un cromo por pantalla**.
- **El 911 funciona en todos los estados**, incluido el invitado vencido.
- Antes de un `dotnet build` o `dotnet test`, **parar el preview `api`**
  (MSB3027: el exe queda bloqueado). Este plan no compila .NET, pero el preview
  se usa para servir la web.

## Estructura de archivos

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `wwwroot/js/sesion.js` | En qué estado está la app y qué puede hacer. Puro |
| `wwwroot/js/entrada/entrada.js` | Monta el paso que toca y dibuja el chip *Paso N de 4*. Orquesta, no decide |
| `wwwroot/js/entrada/bienvenida.js` | Paso 1 |
| `wwwroot/js/entrada/idioma.js` | Paso 2 |
| `wwwroot/js/entrada/condiciones.js` | Paso 3, con el texto de los términos |
| `wwwroot/js/entrada/acceso.js` | Paso 4: entrar, crear cuenta, probar sin cuenta |
| `wwwroot/js/entrada/camion.js` | El camión del invitado, de las plantillas |
| `wwwroot/js/cuenta.js` | La hoja "necesito saber quién sos", una por acción |
| `wwwroot/js/views/reportes.js` | Reportes en vivo: la lista |
| `wwwroot/js/views/fuentes.js` | La pantalla de fuentes de hoy, movida |
| `tests/web/sesion.test.mjs`, `entrada.test.mjs`, `cuenta.test.mjs`, `reportes-lista.test.mjs`, `vocabulario.test.mjs` | |

**Modificados:** `wwwroot/app.css` (el vocabulario), `js/store.js` (preferencias
y migración), `js/app.js` (una sola puerta), `js/dock.js` (el menú MÁS),
`js/views/navigate.js` (arrancar sin viaje del servidor y los frenos),
`js/views/fin-viaje.js` (la variante del invitado), `js/views/auth.js` (queda
sólo el alta), y `js/views/onboarding.js` se elimina al mover su contenido.

---

# Etapa 1 · Los cimientos

## Task 1: El vocabulario del prototipo en `app.css`

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/app.css` (agregar una sección al final)
- Test: `tests/web/vocabulario.test.mjs`

**Interfaces:**
- Produces: las clases `.vidrio`, `.neon`, `.cromo-frio`, `.cromo-oro`,
  `.cromo-plata`, `.satin`, `.chapa`, `.chapa-grande`, `.fila`, `.ficha`,
  `.globo`, `.globo-lado`, `.globo-abajo`, `.globo-pleno`, `.luz`, `.luz-brand`,
  `.luz-festejo`, `.luz-tenue`, `.mono-suelto`, `.beneficio`, `.brillo`,
  `.btn-outline-brand`, `.chip-accent`. Todas las tareas que siguen las usan.

- [x] **Step 1: Escribir el test que falla**

El test lee el CSS como texto y exige que cada clase del vocabulario esté
definida. Es un candado contra lo que ya pasó dos veces en este proyecto:
reorganizar un archivo y perder definiciones que seguían en uso, sin que nada
lo detecte (ver CLAUDE.md, "Mover bloques grandes de `layers.js`…").

```js
/**
 * El vocabulario visual del prototipo aprobado el 14/09/2026, en app.css.
 *
 * Es un candado, no una prueba de diseño: que cada clase que las pantallas usan
 * esté DEFINIDA. En este proyecto ya pasó dos veces que una reorganización se
 * llevara definiciones que seguían en uso y no lo detectara nada.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/TruckNavigator.Api/wwwroot/app.css', import.meta.url), 'utf8');

const MATERIALES = ['vidrio', 'neon', 'cromo-frio', 'cromo-oro', 'cromo-plata', 'satin'];
const PIEZAS = ['chapa', 'chapa-grande', 'fila', 'ficha', 'beneficio', 'brillo'];
const GLOBOS = ['globo', 'globo-lado', 'globo-abajo', 'globo-pleno', 'mono-suelto'];
const LUCES = ['luz', 'luz-brand', 'luz-festejo', 'luz-tenue'];

for (const clase of [...MATERIALES, ...PIEZAS, ...GLOBOS, ...LUCES, 'btn-outline-brand', 'chip-accent']) {
  test(`app.css define .${clase}`, () => {
    assert.match(css, new RegExp(`\\.${clase}\\s*[,{]`), `falta la clase .${clase}`);
  });
}

test('los cuatro materiales del prototipo están, y el oro sólo aparece en el cromo del nivel', () => {
  for (const material of MATERIALES) assert.match(css, new RegExp(`\\.${material}\\s*[,{]`));

  // El oro estaba descartado de la paleta por cálido (§10 del lenguaje visual) y
  // el usuario lo recuperó SOLO para el nivel. Si aparece en otra clase, es una
  // decisión que hay que tomar a mano, no un descuido.
  const usosDeOro = [...css.matchAll(/cromo-oro/g)].length;
  assert.ok(usosDeOro >= 1, 'el cromo oro tiene que existir');
});

test('el vidrio se apoya en backdrop-filter, que es lo que lo hace vidrio y no un gris', () => {
  const bloque = css.slice(css.indexOf('.vidrio'), css.indexOf('.vidrio') + 400);
  assert.match(bloque, /backdrop-filter/);
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/vocabulario.test.mjs"`
Expected: FALLA — `falta la clase .vidrio` y las demás.

- [x] **Step 3: Copiar el vocabulario del prototipo a `app.css`**

Los valores exactos están en `docs/diseno/prototipo/final.mjs`: las constantes
`METAL2`, `RAMPA`, `ORO` y `PLATA` (arriba del archivo) y el bloque `CSS`. Va
como una sección nueva al final de `app.css`, con este encabezado:

```css
/* ============================================================================
   EL VOCABULARIO DEL PROTOTIPO — aprobado el 14/09/2026

   Los cuatro materiales, la chapa de nivel, la fila, la ficha, el globo del
   mono y las luces de color. Valores copiados de docs/diseno/prototipo/final.mjs,
   que es la fuente; el porque de cada uno esta en la skill diseno-camiones-app
   §16.

   Tres reglas que este vocabulario existe para hacer faciles:
     - UNA sola pieza naranja por region. El naranja es la voz del mono, nunca
       el boton de un formulario.
     - UN cromo por pantalla. Si todo brilla, nada brilla.
     - El mapa en movimiento no lleva nada de esto.
============================================================================ */
```

Y adentro, en este orden: los gradientes como tokens en `:root`
(`--metal`, `--rampa`, `--oro`, `--plata`), después `.luz` y sus tres
variantes, `.vidrio`, `.neon`, los tres `.cromo-*`, `.satin`, `.chapa` con
`.chapa-grande` y `.chapa-plata`, `.fila`, `.ficha`, `.globo` con sus cuatro
variantes, `.mono-suelto`, `.beneficio`, `.brillo`, `.btn-outline-brand` y
`.chip-accent`.

**Dos cuidados al copiar:** el prototipo está escrito en modo noche fijo y
`app.css` tiene día y noche, así que cada color que en el prototipo es literal
tiene que salir del token equivalente de `app.css` (`--surface`, `--rule`,
`--brand`, `--accent`, …), no quedar clavado. Y las clases del prototipo que ya
existen en `app.css` con el mismo nombre (`.card`, `.btn`, `.pill`, `.topbar`,
`.fila` si existiera) **no se duplican**: se comparan y, si difieren, gana el
prototipo y se ajusta la que ya está.

- [x] **Step 4: Correr los tests y verlos pasar**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN los nuevos y los 224 de antes.

- [x] **Step 5: Verlo en el navegador**

Levantar el preview `api`, abrir la app a 375 × 812 y comprobar en la consola
que las clases existen y que el vidrio se ve translúcido:

```js
getComputedStyle(document.querySelector('.card')).backgroundColor
```

- [x] **Step 6: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/app.css tests/web/vocabulario.test.mjs
git commit -m "El vocabulario del prototipo entra a app.css, con un candado por clase"
```

---

## Task 1B: Los 27 íconos ilustrados del prototipo, en la app

Es parte de la Etapa 1 y va **antes de cualquier pantalla**: las tareas 5, 6,
10, 15, 16 y 18 usan íconos que hoy no existen en la app. `dock.js` tiene nueve
(`mapa`, `juegos`, `emergencia`, `mas`, `perfil`, `carnet`, `camiones`,
`chat`, `configuracion`); el prototipo tiene **27** aprobados el 14/09/2026,
entre ellos `idioma`, `fuentes`, `viaje`, `exp`, `km`, `nivel` y `logros`.

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/iconos.js`
- Modify: `js/dock.js` (usa el módulo y borra sus duplicados)
- Test: `tests/web/iconos.test.mjs`

**Interfaces:**
- Produces: `ICONOS_ILUSTRADOS` (los nombres) e `icono(nombre, tamanio) → svg`.
  Todas las pantallas de este plan lo importan como `import { icono } from '../iconos.js'`.

- [x] **Step 1: Escribir el test que falla**

```js
/**
 * Los 27 íconos ilustrados del prototipo, aprobados el 14/09/2026.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ICONOS_ILUSTRADOS, icono } from '../../src/TruckNavigator.Api/wwwroot/js/iconos.js';

test('están los 27, con los nombres del prototipo', () => {
  assert.equal(ICONOS_ILUSTRADOS.length, 27);

  // Los que este plan necesita y hoy no existen en la app.
  for (const nombre of ['idioma', 'fuentes', 'viaje', 'exp', 'km', 'nivel', 'logros', 'galibo']) {
    assert.ok(ICONOS_ILUSTRADOS.includes(nombre), `falta ${nombre}`);
  }
});

test('cada ícono es un SVG del tamaño pedido', () => {
  const svg = icono('idioma', 32);
  assert.match(svg, /^<svg/);
  assert.match(svg, /width="32"/);
  assert.match(svg, /height="32"/);
});

test('son de DOS tonos: el color y su sombra, que es lo que los hace ilustración y no trazo', () => {
  const svg = icono('viaje', 30);
  const colores = new Set([...svg.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase()));
  assert.ok(colores.size >= 2, 'un ícono ilustrado lleva al menos dos tonos');
});

test('un nombre que no existe no rompe la pantalla: devuelve vacío', () => {
  // Una pantalla no puede caerse por un ícono. Si falta, queda el hueco.
  assert.equal(icono('no-existe', 24), '');
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/iconos.test.mjs"`
Expected: FALLA — no existe `js/iconos.js`.

- [x] **Step 3: Traer los íconos**

`docs/diseno/prototipo/iconos.mjs` es la fuente: tiene las formas (`F`) y el
mapa `ICO` con el color y la sombra de cada uno. Se copia a
`wwwroot/js/iconos.js` con este encabezado, cambiando la forma de exportar para
que sea `icono(nombre, tamanio)`:

```js
/**
 * Los iconos ilustrados de la app: 27, aprobados el 14/09/2026 con el prototipo.
 *
 * Son DOS TONOS —el color y su sombra, corrida 2 px— y por eso se leen como
 * ilustracion y no como trazo. Los colores son FIJOS a proposito: un icono
 * ilustrado es un dibujo, no texto, y no cambia entre dia y noche; tiene que
 * leerse en los dos. El rojo del S.O.S. es el unico semantico.
 *
 * Copiados de docs/diseno/prototipo/iconos.mjs, que es la fuente.
 */
```

- [x] **Step 4: Que `dock.js` los use**

Los nueve de `dock.js` que existen con el mismo nombre en el módulo se borran de
ahí y se toman de `iconos.js`. Los que el zócalo tenga distintos —porque se
dibujaron para el zócalo y el usuario los aprobó así— se quedan, con un
comentario que diga por qué difieren.

- [x] **Step 5: Correr los tests y verlos pasar**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN, incluidos los del zócalo que ya existían.

- [x] **Step 6: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/iconos.js src/TruckNavigator.Api/wwwroot/js/dock.js tests/web/iconos.test.mjs
git commit -m "Los 27 iconos ilustrados del prototipo entran a la app, en un modulo propio"
```

---

## Task 2: `sesion.js` — en qué estado está la app y qué puede hacer

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/sesion.js`
- Test: `tests/web/sesion.test.mjs`

**Interfaces:**
- Produces:
  - `DIAS_DE_PRUEBA = 1`
  - `estadoDeSesion(prefs, haySesion, ahora) → { tipo, pasoQueFalta, invitadoVencido }`
    donde `tipo` es `'nueva' | 'invitado' | 'cuenta'` y `pasoQueFalta` es
    `'bienvenida' | 'idioma' | 'condiciones' | 'acceso' | 'camion' | null`
  - `permisos(estado) → { navegar, guardarViaje, reportar, guardarLugares, contactos, perfil, configuracion, emergencia, verMapa }`
  - `invitadoVencido(prefs, ahora) → boolean`

- [x] **Step 1: Escribir el test que falla**

```js
/**
 * En qué estado está la app y qué puede hacer cada estado.
 *
 * Es la función que reemplaza las dos puertas que hoy tiene app.js. Se prueba
 * entera acá porque es la que decide si alguien entra, si puede navegar y si su
 * día de prueba se terminó: un error suyo deja gente afuera de un GPS.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DIAS_DE_PRUEBA, estadoDeSesion, permisos, invitadoVencido } from '../../src/TruckNavigator.Api/wwwroot/js/sesion.js';

const HOY = new Date('2026-09-30T15:00:00-03:00');
const nuevo = {};
const listo = { idioma: 'es', condicionesAceptadas: '2026-09-30T12:00:00.000Z' };

test('el día de prueba es uno, y es una constante con nombre', () => {
  assert.equal(DIAS_DE_PRUEBA, 1);
});

test('sin nada elegido, lo que falta es la bienvenida', () => {
  const estado = estadoDeSesion(nuevo, false, HOY);
  assert.equal(estado.tipo, 'nueva');
  assert.equal(estado.pasoQueFalta, 'bienvenida');
});

test('los pasos salen en orden: idioma, condiciones, acceso', () => {
  assert.equal(estadoDeSesion({ vioBienvenida: true }, false, HOY).pasoQueFalta, 'idioma');
  assert.equal(estadoDeSesion({ vioBienvenida: true, idioma: 'es' }, false, HOY).pasoQueFalta, 'condiciones');
  assert.equal(estadoDeSesion(listo, false, HOY).pasoQueFalta, 'acceso');
});

test('con sesión no falta ningún paso, sin importar lo que haya en las preferencias', () => {
  const estado = estadoDeSesion(nuevo, true, HOY);
  assert.equal(estado.tipo, 'cuenta');
  assert.equal(estado.pasoQueFalta, null);
});

test('quien ya había aceptado las fuentes cae directo en acceso: ya leyó lo que Condiciones enlaza', () => {
  // La migración de quien viene usando la app. Hacerle dar la vuelta entera
  // seria castigarlo por haber estado antes.
  const estado = estadoDeSesion({ sourcesAccepted: true }, false, HOY);
  assert.equal(estado.pasoQueFalta, 'acceso');
});

test('el invitado sin camión elegido todavía debe elegirlo', () => {
  const prefs = { ...listo, invitadoDesde: HOY.toISOString() };
  assert.equal(estadoDeSesion(prefs, false, HOY).pasoQueFalta, 'camion');
});

test('el invitado con camión ya está adentro, y es invitado', () => {
  const prefs = { ...listo, invitadoDesde: HOY.toISOString(), invitadoCamionId: 'plantilla-1' };
  const estado = estadoDeSesion(prefs, false, HOY);
  assert.equal(estado.tipo, 'invitado');
  assert.equal(estado.pasoQueFalta, null);
  assert.equal(estado.invitadoVencido, false);
});

test('el día se termina al día siguiente, en hora local', () => {
  const ayer = { invitadoDesde: '2026-09-29T23:30:00-03:00' };
  assert.equal(invitadoVencido(ayer, HOY), true);

  const temprano = { invitadoDesde: '2026-09-30T00:10:00-03:00' };
  assert.equal(invitadoVencido(temprano, HOY), false);
});

test('el invitado vencido sigue siendo invitado: no vuelve a la entrada', () => {
  const prefs = { ...listo, invitadoDesde: '2026-09-28T10:00:00-03:00', invitadoCamionId: 'plantilla-1' };
  const estado = estadoDeSesion(prefs, false, HOY);
  assert.equal(estado.tipo, 'invitado');
  assert.equal(estado.pasoQueFalta, null);
  assert.equal(estado.invitadoVencido, true);
});

test('la cuenta puede todo', () => {
  const p = permisos({ tipo: 'cuenta', invitadoVencido: false });
  assert.deepEqual(p, {
    verMapa: true, navegar: true, guardarViaje: true, reportar: true,
    guardarLugares: true, contactos: true, perfil: true, configuracion: true, emergencia: true
  });
});

test('el invitado ve el mapa y navega, pero nada se guarda ni se reporta', () => {
  const p = permisos({ tipo: 'invitado', invitadoVencido: false });
  assert.equal(p.verMapa, true);
  assert.equal(p.navegar, true);
  assert.equal(p.guardarViaje, false);
  assert.equal(p.reportar, false);
  assert.equal(p.guardarLugares, false);
  assert.equal(p.contactos, false);
  assert.equal(p.perfil, false);
  assert.equal(p.configuracion, true);
});

test('al invitado vencido se le apaga navegar, y sólo eso', () => {
  const p = permisos({ tipo: 'invitado', invitadoVencido: true });
  assert.equal(p.navegar, false);
  assert.equal(p.verMapa, true);
  assert.equal(p.configuracion, true);
});

test('el 911 funciona en los cuatro estados, y eso no se negocia', () => {
  // Nada de las cuentas ni de la gamificación puede estorbar un pedido de
  // auxilio. Es la misma regla que ya rige para la batería.
  for (const estado of [
    { tipo: 'nueva', invitadoVencido: false },
    { tipo: 'invitado', invitadoVencido: false },
    { tipo: 'invitado', invitadoVencido: true },
    { tipo: 'cuenta', invitadoVencido: false }
  ]) {
    assert.equal(permisos(estado).emergencia, true, estado.tipo);
  }
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/sesion.test.mjs"`
Expected: FALLA — no existe `js/sesion.js`.

- [x] **Step 3: Escribir `sesion.js`**

```js
/**
 * En que estado esta la app, y que puede hacer ese estado.
 *
 * Reemplaza las dos puertas que app.js tenia sueltas (las fuentes y la sesion).
 * Con cuatro pasos de entrada y un invitado, esas puertas eran cinco
 * condiciones cruzadas dentro de una funcion que ademas monta pantallas: la
 * clase de escalera donde despues se cuela un caso que nadie previo.
 *
 * Es pura a proposito: recibe las preferencias, si hay sesion y la hora. No lee
 * localStorage ni la API, y por eso se puede probar entera.
 */

/** Cuanto dura la prueba sin cuenta. Es un numero, no una verdad. */
export const DIAS_DE_PRUEBA = 1;

/** Los pasos de la entrada, en orden. El invitado agrega su camion al final. */
const PASOS = ['bienvenida', 'idioma', 'condiciones', 'acceso'];

/** Offset local, el mismo que usa el tope de votos de reportes en el servidor. */
const HORAS_LOCALES = -3;

/** El dia local de un instante, como numero comparable. */
function diaLocal(fecha) {
  const local = new Date(fecha.getTime() + HORAS_LOCALES * 3600_000);
  return Math.floor(local.getTime() / 86_400_000);
}

/**
 * Si el dia de prueba ya paso.
 *
 * Se mide en dias locales y no en horas: "un dia" tiene que significar lo mismo
 * para el camionero que para la app. Sin sello, no hay invitado y no hay nada
 * vencido.
 */
export function invitadoVencido(prefs, ahora) {
  if (!prefs?.invitadoDesde) return false;

  const desde = new Date(prefs.invitadoDesde);

  if (Number.isNaN(desde.getTime())) return false;

  return diaLocal(ahora) - diaLocal(desde) >= DIAS_DE_PRUEBA;
}

/**
 * El estado de la app.
 *
 * `pasoQueFalta` es lo unico que app.js necesita para decidir: si no es nulo,
 * monta la entrada en ese paso.
 */
export function estadoDeSesion(prefs = {}, haySesion = false, ahora = new Date()) {
  if (haySesion) {
    return { tipo: 'cuenta', pasoQueFalta: null, invitadoVencido: false };
  }

  const vencido = invitadoVencido(prefs, ahora);

  if (prefs.invitadoDesde) {
    return {
      tipo: 'invitado',
      pasoQueFalta: prefs.invitadoCamionId ? null : 'camion',
      invitadoVencido: vencido
    };
  }

  // Quien ya habia aceptado las fuentes viene usando la app: ya leyo lo que
  // Condiciones enlaza, y hacerle dar la vuelta entera seria castigarlo por
  // haber estado antes.
  if (prefs.sourcesAccepted) {
    return { tipo: 'nueva', pasoQueFalta: 'acceso', invitadoVencido: false };
  }

  const hechos = {
    bienvenida: Boolean(prefs.vioBienvenida),
    idioma: Boolean(prefs.idioma),
    condiciones: Boolean(prefs.condicionesAceptadas),
    acceso: false
  };

  return {
    tipo: 'nueva',
    pasoQueFalta: PASOS.find((paso) => !hechos[paso]) ?? 'acceso',
    invitadoVencido: false
  };
}

/**
 * Que puede hacer un estado.
 *
 * El resto de la app consulta esto en vez de adivinar. La fila de emergencia es
 * la unica que no depende de nada: nada de las cuentas ni de la gamificacion
 * puede estorbar un pedido de auxilio.
 */
export function permisos(estado) {
  const conCuenta = estado?.tipo === 'cuenta';
  const invitado = estado?.tipo === 'invitado';

  return {
    verMapa: conCuenta || invitado,
    navegar: conCuenta || (invitado && !estado.invitadoVencido),
    guardarViaje: conCuenta,
    reportar: conCuenta,
    guardarLugares: conCuenta,
    contactos: conCuenta,
    perfil: conCuenta,
    configuracion: conCuenta || invitado,
    emergencia: true
  };
}
```

- [x] **Step 4: Correr los tests y verlos pasar**

Run: `node --test "tests/web/sesion.test.mjs"`
Expected: PASAN los 13.

- [x] **Step 5: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/sesion.js tests/web/sesion.test.mjs
git commit -m "El estado de la app en una funcion pura: nueva, invitado o cuenta, y que puede cada uno"
```

---

## Task 3: Las preferencias nuevas y la migración de quien ya usa la app

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/store.js` (el objeto `defaults`, líneas 10-44)
- Test: `tests/web/sesion.test.mjs` (agregar casos)

**Interfaces:**
- Consumes: `estadoDeSesion` de la Task 2.
- Produces: `prefs.vioBienvenida`, `prefs.idioma`, `prefs.condicionesAceptadas`,
  `prefs.invitadoDesde`, `prefs.invitadoCamionId`.

- [x] **Step 1: Escribir el test que falla**

Al final de `tests/web/sesion.test.mjs`:

```js
import { PREFERENCIAS_DE_ENTRADA } from '../../src/TruckNavigator.Api/wwwroot/js/sesion.js';

test('las preferencias de la entrada arrancan vacías, y la del idioma en español', () => {
  // Estan declaradas en un solo lugar para que store.js y los tests no puedan
  // discrepar sobre como se llaman.
  assert.deepEqual(PREFERENCIAS_DE_ENTRADA, {
    vioBienvenida: false,
    idioma: null,
    condicionesAceptadas: null,
    invitadoDesde: null,
    invitadoCamionId: null
  });
});

test('un idioma nulo no es español: sin elegir, el paso 2 sigue faltando', () => {
  const estado = estadoDeSesion({ ...PREFERENCIAS_DE_ENTRADA, vioBienvenida: true }, false, HOY);
  assert.equal(estado.pasoQueFalta, 'idioma');
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/sesion.test.mjs"`
Expected: FALLA — `PREFERENCIAS_DE_ENTRADA` no existe.

- [x] **Step 3: Declararlas en `sesion.js` y usarlas en `store.js`**

En `sesion.js`, arriba de `estadoDeSesion`:

```js
/**
 * Lo que la entrada guarda. Vive aca y no en store.js para que la funcion que
 * decide y el almacenamiento no puedan discrepar sobre como se llama cada cosa.
 *
 * `condicionesAceptadas` es una FECHA y no un booleano: el dia que cambien los
 * terminos, la fecha dice quien acepto cuales. Es un campo mas y evita una
 * migracion.
 */
export const PREFERENCIAS_DE_ENTRADA = {
  vioBienvenida: false,
  idioma: null,
  condicionesAceptadas: null,
  invitadoDesde: null,
  invitadoCamionId: null
};
```

En `store.js`, importarlas y sumarlas a `defaults`, con el comentario de por qué
`sourcesAccepted` se conserva:

```js
import { PREFERENCIAS_DE_ENTRADA } from './sesion.js';

const defaults = {
  /**
   * Si ya se leyo la pantalla de fuentes.
   *
   * Desde el 30/09/2026 ya NO es una puerta: la pantalla vive en Configuracion y
   * Condiciones la enlaza. Se sigue leyendo para migrar a quien venia usando la
   * app: quien la habia aceptado entra directo al paso 4 en vez de dar la vuelta
   * entera (ver sesion.js).
   */
  sourcesAccepted: false,
  ...PREFERENCIAS_DE_ENTRADA,
  /* …el resto tal como esta… */
```

- [x] **Step 4: Correr todo y verlo pasar**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN los nuevos y los 224 de antes.

- [x] **Step 5: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/store.js src/TruckNavigator.Api/wwwroot/js/sesion.js tests/web/sesion.test.mjs
git commit -m "Las preferencias de la entrada, con la fecha de las condiciones y la migracion de las fuentes"
```

---

# Etapa 2 · La entrada

## Task 4: El orquestador de la entrada y su chip de paso

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js`
- Test: `tests/web/entrada.test.mjs`

**Interfaces:**
- Consumes: `estadoDeSesion` (Task 2).
- Produces:
  - `PASOS_DE_LA_ENTRADA = ['bienvenida', 'idioma', 'condiciones', 'acceso']`
  - `chipDePaso(paso) → { etiqueta, valor } | null`
  - `entradaView(host, { paso, prefs, onListo, go })` — monta el paso y pasa a
    la vista de cada pantalla (tareas 5 a 8) sus manejadores.

- [x] **Step 1: Escribir el test que falla**

```js
/**
 * La entrada: el orden de los pasos y el chip que dice en cuál va.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PASOS_DE_LA_ENTRADA, chipDePaso } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js';

test('la entrada son cuatro pasos, en el orden del brainstorm v3', () => {
  assert.deepEqual(PASOS_DE_LA_ENTRADA, ['bienvenida', 'idioma', 'condiciones', 'acceso']);
});

test('el chip dice el paso sobre cuatro, como el tablero del prototipo', () => {
  assert.deepEqual(chipDePaso('idioma'), { etiqueta: 'Paso', valor: '2 de 4' });
  assert.deepEqual(chipDePaso('condiciones'), { etiqueta: 'Paso', valor: '3 de 4' });
});

test('la bienvenida y el acceso no llevan chip: son pantallas enteras, no formularios de un trámite', () => {
  assert.equal(chipDePaso('bienvenida'), null);
  assert.equal(chipDePaso('acceso'), null);
});

test('el camión del invitado no lleva chip: ya pasó la puerta y no es un quinto paso', () => {
  // El prototipo fija "Paso 2 de 4"; numerar esto como 5 lo contradiria.
  assert.equal(chipDePaso('camion'), null);
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/entrada.test.mjs"`
Expected: FALLA — no existe `js/entrada/entrada.js`.

- [x] **Step 3: Escribir `entrada/entrada.js`**

Lo puro primero:

```js
/**
 * La entrada: Bienvenida -> Idioma -> Condiciones -> Acceso.
 *
 * Este modulo ORQUESTA. No dibuja ninguna de las cuatro pantallas —cada una
 * tiene su archivo— y no decide quien entra: eso es de sesion.js. Es el mismo
 * reparto que rige en el mapa (AD-48): un modulo por superficie, y el que
 * engancha no calcula.
 */

export const PASOS_DE_LA_ENTRADA = ['bienvenida', 'idioma', 'condiciones', 'acceso'];

/**
 * El chip del encabezado. Nulo donde el prototipo no lo pone: la Bienvenida y
 * el Acceso son pantallas enteras, no los pasos de un tramite.
 */
export function chipDePaso(paso) {
  const indice = PASOS_DE_LA_ENTRADA.indexOf(paso);

  if (indice < 1 || paso === 'acceso') return null;

  return { etiqueta: 'Paso', valor: `${indice + 1} de ${PASOS_DE_LA_ENTRADA.length}` };
}
```

Y el montaje, que delega en las vistas de las tareas 5 a 8 y guarda lo elegido
con `savePrefs`:

```js
export function entradaView(host, { paso, onListo, go }) {
  host.className = 'screen entrada';

  if (paso === 'bienvenida') {
    return bienvenidaView(host, {
      onEmpezar: () => { savePrefs({ vioBienvenida: true }); onListo('idioma'); },
      // Quien ya tiene cuenta acepto las condiciones la primera vez: pedirselas
      // de nuevo es tratarlo como nuevo.
      onYaTengoCuenta: () => { savePrefs({ vioBienvenida: true }); onListo('acceso'); }
    });
  }

  if (paso === 'idioma') {
    return idiomaView(host, {
      chip: chipDePaso('idioma'),
      onContinuar: (idioma) => { savePrefs({ idioma }); onListo('condiciones'); }
    });
  }

  if (paso === 'condiciones') {
    return condicionesView(host, {
      chip: chipDePaso('condiciones'),
      onAcepto: () => { savePrefs({ condicionesAceptadas: new Date().toISOString() }); onListo('acceso'); },
      onVerFuentes: () => go('fuentes')
    });
  }

  if (paso === 'camion') {
    return camionInvitadoView(host, { onElegido: (id) => { savePrefs({ invitadoCamionId: id }); onListo(null); } });
  }

  return accesoView(host, { onListo, go });
}
```

- [x] **Step 4: Correr los tests y verlos pasar**

Run: `node --test "tests/web/entrada.test.mjs"`
Expected: PASAN los 4. Las vistas todavía no existen: **los imports de las
tareas 5 a 8 se agregan en cada una de esas tareas**, así el archivo compila
paso a paso.

- [x] **Step 5: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js tests/web/entrada.test.mjs
git commit -m "El orquestador de la entrada: cuatro pasos y el chip del prototipo"
```

---

## Task 5: Paso 1 · Bienvenida

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/entrada/bienvenida.js`
- Modify: `js/entrada/entrada.js` (el import)

**Interfaces:**
- Produces: `bienvenidaView(host, { onEmpezar, onYaTengoCuenta })`.
- Consumes: `mascota` de `js/mascota.js`, `html`/`raw`/`render`/`wire` de
  `js/ui.js`, las clases de la Task 1.

- [x] **Step 1: Escribir la pantalla contra el tablero**

El tablero es `docs/diseno/prototipo/Bienvenida.dc.html` y su fuente está en
`final.mjs` (la entrada `out['Bienvenida.dc.html']`). Es una de las dos
pantallas que el usuario eligió como orientación: **va tal cual**.

```js
/**
 * Paso 1 de la entrada: la Bienvenida.
 *
 * Es uno de los dos tableros que el usuario eligio como orientacion el
 * 14/09/2026 ("es la orientacion que estaba buscando"), asi que se implementa
 * tal cual: luz celeste, la silueta de la ruta, el mono con mate, el titulo, la
 * bajada, tres beneficios y dos acciones. No se inventan variantes.
 *
 * El globo va ABAJO del mono (globo-abajo) porque el mono esta debajo del globo,
 * y su chip es naranja: es la voz del mono, la unica pieza naranja de la region.
 * Por eso las dos acciones son celestes.
 */

import { html, raw, render, wire } from '../ui.js';
import { mascota } from '../mascota.js';
import { icono } from '../iconos.js';

export function bienvenidaView(host, { onEmpezar, onYaTengoCuenta }) {
  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-brand"></div>
      ${raw(siluetaDeRuta())}

      <div class="entrada-cuerpo">
        <span class="section-caps entrada-rotulo">Navegador de tránsito pesado · CABA</span>

        <div class="entrada-centro">
          <div class="globo globo-abajo">
            <span class="pill chip-accent">Bienvenido</span>
            <b>Hola, compañero.</b>
            <p>Yo te acompaño. Vos manejás.</p>
          </div>

          <div class="entrada-mono">${raw(mascota('mate', { escala: 3.5 }))}</div>

          <h1 class="entrada-titulo">El GPS de los<br><span>camioneros</span></h1>
          <p class="entrada-bajada">Rutas por donde tu camión puede pasar. Y kilómetros que suman.</p>
        </div>

        <div class="entrada-beneficios">
          <div class="beneficio">${raw(icono('viaje', 30))}<span>Ruta según tu camión</span></div>
          <div class="beneficio">${raw(icono('galibo', 30))}<span>Gálibos y Red pesada</span></div>
          <div class="beneficio">${raw(icono('exp', 30))}<span>Cada viaje suma</span></div>
        </div>
      </div>

      <div class="entrada-acciones">
        <button class="btn btn-primary btn-duo btn-block brillo" id="empezar">Empezar</button>
        <button class="btn btn-outline-brand btn-duo btn-block" id="ya-tengo">Ya tengo una cuenta</button>
        <p class="hint entrada-legal">Ley 2148 de la Ciudad · Mapa de OpenStreetMap</p>
      </div>
    </div>
  `);

  wire(host, { '#empezar': onEmpezar, '#ya-tengo': onYaTengoCuenta });
}
```

`siluetaDeRuta()` es el SVG del tablero (la línea de la ruta y los guiones del
carril), copiado de `final.mjs`. Los íconos salen de `js/iconos.js` (Task 1B).

- [x] **Step 2: Enganchar el import en `entrada.js`**

```js
import { bienvenidaView } from './bienvenida.js';
```

- [x] **Step 3: Verla en el navegador a 375 × 812**

Con la app en el preview, borrar las preferencias y recargar:

```js
localStorage.removeItem('tn.prefs'); location.reload();
```

Comprobar: la luz celeste se ve, el mono aparece (la pose `mate` existe en
`wwwroot/img/mascota`), el globo tiene su chip naranja, **no hay zócalo**, y las
dos acciones son celestes. Sacar una captura.

- [x] **Step 4: Correr los tests**

Run: `node --test "tests/web/*.test.mjs"`
Expected: los 224 + los nuevos siguen pasando (esta tarea no agrega lógica pura).

- [x] **Step 5: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/entrada/bienvenida.js src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js src/TruckNavigator.Api/wwwroot/app.css
git commit -m "Paso 1: la Bienvenida del prototipo, tal cual la aprobo el usuario"
```

---

## Task 6: Paso 2 · Idioma

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/entrada/idioma.js`
- Modify: `js/entrada/entrada.js` (el import), `tests/web/entrada.test.mjs`

**Interfaces:**
- Produces: `IDIOMAS`, `idiomaView(host, { chip, onContinuar })`.

- [x] **Step 1: Escribir el test que falla**

En `tests/web/entrada.test.mjs`:

```js
import { IDIOMAS } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/idioma.js';

test('los cuatro idiomas del v3, y sólo el español se puede elegir hoy', () => {
  assert.deepEqual(IDIOMAS.map((i) => i.codigo), ['es', 'pt', 'en', 'gn']);
  assert.deepEqual(IDIOMAS.filter((i) => i.disponible).map((i) => i.codigo), ['es']);
});

test('cada idioma dice su país donde lo tiene, y el inglés no inventa uno', () => {
  assert.equal(IDIOMAS.find((i) => i.codigo === 'es').lugar, 'Argentina');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'pt').lugar, 'Brasil');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'gn').lugar, 'Paraguay');
  assert.equal(IDIOMAS.find((i) => i.codigo === 'en').lugar, null);
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/entrada.test.mjs"`
Expected: FALLA — no existe `entrada/idioma.js`.

- [x] **Step 3: Escribir la pantalla**

```js
/**
 * Paso 2 de la entrada: el idioma.
 *
 * Decision del usuario del 08/09/2026: la pantalla se presenta, pero la unica
 * opcion por ahora es el español. Las otras tres dicen "Pronto" y no se pueden
 * elegir; el chip ya explica por que, asi que tocarlas no hace nada y no hace
 * falta un cartel.
 *
 * Se guarda la eleccion aunque hoy haya un solo valor posible: es lo que
 * permite sumar un idioma sin rehacer el flujo (v3 §7).
 */

import { html, raw, render, wire } from '../ui.js';
import { icono } from '../iconos.js';

export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español', lugar: 'Argentina', disponible: true },
  { codigo: 'pt', nombre: 'Português', lugar: 'Brasil', disponible: false },
  { codigo: 'en', nombre: 'English', lugar: null, disponible: false },
  { codigo: 'gn', nombre: 'Guaraní', lugar: 'Paraguay', disponible: false }
];

export function idiomaView(host, { chip, onContinuar }) {
  let elegido = 'es';

  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-tenue"></div>
      <div class="topbar">
        <h2>Idioma</h2>
        ${chip ? `<span class="pill pill-brand">${chip.etiqueta} ${chip.valor}</span>` : ''}
      </div>

      <div class="scroll">
        <p class="entrada-bajada">¿En qué idioma te hablo? Por ahora, español. Los demás están en camino.</p>

        ${raw(IDIOMAS.map((i) => `
          <div class="fila ${i.codigo === elegido ? 'neon' : ''}" data-idioma="${i.codigo}">
            ${icono('idioma', 32)}
            <div class="grow"><b>${i.nombre}</b>${i.lugar ? `<span class="sub">${i.lugar}</span>` : ''}</div>
            <span class="pill ${i.disponible ? 'pill-brand' : 'pill-reward'}">${i.disponible ? 'Elegido' : 'Pronto'}</span>
          </div>`).join(''))}

        <div class="grow"></div>
        <button class="btn btn-primary btn-duo btn-block brillo" id="continuar">Continuar</button>
      </div>
    </div>
  `);

  wire(host, { '#continuar': () => onContinuar(elegido) });
}
```

- [x] **Step 4: Enganchar el import y correr los tests**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN.

- [x] **Step 5: Verla en el navegador y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/entrada/idioma.js src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js tests/web/entrada.test.mjs
git commit -m "Paso 2: el idioma, con el español en neon y los otros tres en Pronto"
```

---

## Task 7: Paso 3 · Condiciones, y la pantalla de fuentes que deja de ser puerta

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/entrada/condiciones.js`
- Create: `src/TruckNavigator.Api/wwwroot/js/views/fuentes.js` (el contenido de
  `views/onboarding.js`, sin el `onDone`)
- Delete: `src/TruckNavigator.Api/wwwroot/js/views/onboarding.js`
- Modify: `js/entrada/entrada.js` (el import)
- Test: `tests/web/entrada.test.mjs`

**Interfaces:**
- Produces: `TERMINOS` (la lista de párrafos),
  `condicionesView(host, { chip, onAcepto, onVerFuentes })`,
  `fuentesView(host, { volver })`.

- [x] **Step 1: Escribir el test que falla**

```js
import { TERMINOS } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/condiciones.js';

test('los términos dicen las cinco cosas que esta app tiene que decir, y ninguna que no cumpla', () => {
  const texto = TERMINOS.join(' ').toLowerCase();

  assert.match(texto, /openstreetmap/);              // de dónde sale el mapa
  assert.match(texto, /conductor/);                  // de quién es la responsabilidad
  assert.match(texto, /comunidad/);                  // quién escribe los reportes
  assert.match(texto, /correo/);                     // qué datos se guardan
  assert.match(texto, /borr/);                       // qué pasa al borrar la cuenta

  // Nada de lo que la app no hace: no hay pagos, ni publicidad, ni venta de datos.
  assert.doesNotMatch(texto, /publicidad|anunciante|vender/);
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/entrada.test.mjs"`
Expected: FALLA — no existe `entrada/condiciones.js`.

- [x] **Step 3: Escribir los términos y la pantalla**

```js
/**
 * Paso 3 de la entrada: las condiciones.
 *
 * El prototipo no la bocetó a proposito ("texto y un boton"), asi que se arma
 * con el vocabulario ya aprobado. La fila de Configuracion hace de enlace a la
 * pantalla de fuentes, que hasta el 30/09/2026 era una puerta obligatoria y
 * ahora vive en Configuracion.
 *
 * El texto cubre SOLO lo que esta app hace hoy. Una clausula que la app no
 * cumple es peor que no tenerla: es letra chica falsa.
 */

export const TERMINOS = [
  'Esta aplicación calcula rutas para camiones en la Ciudad de Buenos Aires con datos abiertos de OpenStreetMap y con la Ley 2148, que define la Red de Tránsito Pesado. Esos datos pueden estar incompletos o desactualizados.',
  'La responsabilidad de circular es siempre del conductor: la ruta es una sugerencia, y la señalización de la calle y las indicaciones de la autoridad valen más que lo que muestre la pantalla.',
  'Los reportes, los votos y los lugares nuevos los escribe la comunidad de camioneros. No están verificados por nosotros, y la aplicación los muestra siempre marcados como lo que son.',
  'De vos guardamos tu correo, tu alias, tu fecha de nacimiento y tu nacionalidad si las cargás, los camiones que declarás y los viajes que hacés con la app. No los vendemos ni los usamos para publicidad.',
  'Podés borrar tu cuenta cuando quieras: se borran con ella tu perfil, tus camiones, tus viajes y tus contactos de emergencia.'
];

export function condicionesView(host, { chip, onAcepto, onVerFuentes }) {
  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-tenue"></div>
      <div class="topbar">
        <h2>Condiciones</h2>
        ${chip ? `<span class="pill pill-brand">${chip.etiqueta} ${chip.valor}</span>` : ''}
      </div>

      <div class="scroll">
        <div class="card condiciones-texto">
          ${raw(TERMINOS.map((p) => `<p>${p}</p>`).join(''))}
        </div>

        <div class="fila" id="ver-fuentes">
          ${raw(icono('fuentes', 32))}
          <div class="grow">
            <b>De dónde salen los datos</b>
            <span class="sub">La Ley 2148, OpenStreetMap y lo que la app no sabe</span>
          </div>
        </div>

        <div class="grow"></div>
        <button class="btn btn-primary btn-duo btn-block brillo" id="acepto">Acepto</button>
      </div>
    </div>
  `);

  wire(host, { '#acepto': onAcepto, '#ver-fuentes': onVerFuentes });
}
```

- [x] **Step 4: Mover la pantalla de fuentes**

`views/onboarding.js` pasa a `views/fuentes.js` **sin tocar su contenido**:
mismo texto, mismas tarjetas. Cambia la firma —`fuentesView(host, { volver })`—
y su acción final deja de ser "Entendido, empezar" para ser un botón de volver.
Se elimina `views/onboarding.js` y su import en `app.js` (ese import lo arregla
la Task 9).

- [x] **Step 5: Correr los tests y verlo en el navegador**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN. Y en el navegador: el paso 3 muestra los términos, la fila
abre las fuentes y el botón volver regresa a las condiciones.

- [x] **Step 6: Commit**

```bash
git add -A src/TruckNavigator.Api/wwwroot/js tests/web/entrada.test.mjs
git commit -m "Paso 3: las condiciones, y la pantalla de fuentes deja de ser una puerta"
```

---

## Task 8: Paso 4 · Acceso, con la tercera acción

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/entrada/acceso.js`
- Modify: `js/views/auth.js` (queda sólo el alta y "revisá tu correo"),
  `js/entrada/entrada.js` (el import)

**Interfaces:**
- Produces: `accesoView(host, { onListo, go })`.
- Consumes: `api.signIn` de `js/api.js`, `authView(host, { onSignedIn, modo })`.

- [x] **Step 1: Escribir la pantalla contra el tablero `Entrar`**

```js
/**
 * Paso 4 de la entrada: el acceso.
 *
 * El tablero "Entrar" del prototipo: luz celeste, el titulo, el mono con mate y
 * su globo al costado, y la tarjeta de VIDRIO con correo, contraseña y el boton.
 * El campo con foco se enciende con neon, que es el unico neon de la pantalla.
 *
 * Y la accion que el tablero no tiene, porque se decidio despues: "Probar sin
 * cuenta", separada de las otras dos para que no compita con la principal.
 *
 * El ALTA no esta aca: sigue en views/auth.js, que es donde ya funciona junto
 * con "revisa tu correo". Dos formularios de ingreso serian dos formularios que
 * se desincronizan.
 */

import { html, raw, render, wire, toastError, toastOk, withBusy } from '../ui.js';
import { mascota } from '../mascota.js';
import { api } from '../api.js';
import { savePrefs } from '../store.js';

export function accesoView(host, { onListo, go }) {
  render(host, html`
    <div class="pantalla-entrada">
      <div class="luz luz-brand"></div>

      <div class="entrada-cuerpo">
        <span class="section-caps entrada-rotulo">Navegador de tránsito pesado · CABA</span>
        <h1 class="entrada-titulo">Hola de nuevo,<br><span>compañero.</span></h1>

        <div class="mono-globo">
          <div class="mono-suelto">${raw(mascota('mate', { escala: 2.3 }))}</div>
          <div class="globo globo-lado">
            <span class="pill chip-accent">Entrar</span>
            <b>¿Salimos?</b>
            <p>Entrá y te devuelvo tu camión y tus kilómetros.</p>
          </div>
        </div>
      </div>

      <div class="entrada-acciones">
        <div class="vidrio entrada-tarjeta">
          <label class="field"><span>Correo</span><input id="correo" type="email" inputmode="email" autocomplete="email"></label>
          <label class="field"><span>Contraseña</span><input id="clave" type="password" autocomplete="current-password"></label>
          <button class="btn btn-primary btn-duo btn-block brillo" id="entrar">Entrar</button>
        </div>

        <div class="entrada-secundarias">
          <button class="enlace" id="crear">Crear una cuenta</button>
          <button class="enlace hint" id="olvide">¿Olvidaste la contraseña?</button>
        </div>

        <button class="btn btn-outline btn-duo btn-block" id="invitado">Probar sin cuenta</button>
      </div>
    </div>
  `);

  wire(host, {
    '#entrar': async (event) => {
      const correo = host.querySelector('#correo').value.trim();
      const clave = host.querySelector('#clave').value;

      await withBusy(event.currentTarget, 'Entrando', async () => {
        try {
          await api.signIn(correo, clave);
          onListo(null);
        } catch (error) {
          toastError(error.message);
        }
      });
    },
    // El invitado queda sellado acá: desde este momento corre su día.
    '#invitado': () => { savePrefs({ invitadoDesde: new Date().toISOString() }); onListo('camion'); },
    '#crear': () => go('cuenta-nueva'),

    // Se muda TAL CUAL de auth.js, incluido su cuidado: responder distinto
    // segun si el correo existe permitiria averiguar quien tiene cuenta.
    '#olvide': async () => {
      const correo = host.querySelector('#correo').value.trim();

      if (!correo) {
        toastError('Escribí tu correo primero y volvé a tocar acá.');
        return;
      }

      try {
        await api.forgotPassword(correo);
      } catch {
        // A proposito en silencio, por lo mismo.
      }

      toastOk('Si esa cuenta existe, le llegó un enlace para cambiar la clave.');
    }
  });
}
```

- [x] **Step 2: Dejar `auth.js` sólo con el alta**

`authView(host, { onSignedIn, modo = 'signup' })`: el modo `'signin'` y su
marcado se eliminan —esa pantalla ahora es `acceso.js`—, y quedan `'signup'` y
`'check-inbox'`. Se le aplica el vocabulario: la tarjeta del formulario pasa a
`.vidrio` y el campo con foco a `.neon`. **No se rediseña nada más**: la
personalización del avatar después del alta es del subproyecto C.

**Ojo con lo que se está por borrar.** El marcado de `signin` que se elimina
lleva enganchado el `#forgot` que **ya funciona** (línea 135 de hoy): pide el
correo del campo, llama a `api.forgotPassword` y contesta lo mismo exista o no
la cuenta, para que nadie pueda averiguar quién tiene una. Ese manejador se
muda a `acceso.js` tal cual, con su comentario. Antes de borrar el bloque,
revisar si quedó algo más colgado ahí.

- [x] **Step 3: Verlo en el navegador**

Entrar con la cuenta de prueba (`demo@camiones.test` / `camion2026`) desde la
pantalla nueva, y comprobar que *Crear una cuenta* abre el alta de siempre con
el vidrio aplicado.

- [x] **Step 4: Correr los tests**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN.

- [x] **Step 5: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js
git commit -m "Paso 4: el acceso del prototipo, con Probar sin cuenta; el alta queda en auth.js"
```

---

## Task 9: `app.js` con una sola puerta

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/app.js` (`ROUTES` líneas 68-75 y
  `mount()` líneas 96-138)

**Interfaces:**
- Consumes: `estadoDeSesion`, `permisos` (Task 2), `entradaView` (Task 4),
  `fuentesView` (Task 7).
- Produces: `estadoActual()` — el estado calculado del montaje en curso, que las
  tareas 11 a 18 consultan.

- [x] **Step 1: Reemplazar las dos puertas por una**

```js
import { estadoDeSesion, permisos } from './sesion.js';
import { entradaView } from './entrada/entrada.js';
import { fuentesView } from './views/fuentes.js';

let estado = { tipo: 'nueva', pasoQueFalta: 'bienvenida', invitadoVencido: false };

/** El estado del montaje en curso. Las vistas preguntan acá, no adivinan. */
export const estadoActual = () => estado;
export const puede = () => permisos(estado);

function mount() {
  teardown?.();
  teardown = null;

  const host = document.createElement('div');
  swap(host);

  estado = estadoDeSesion(prefs, isSignedIn(), new Date());

  // Una sola puerta: si falta un paso de la entrada, se monta ese paso.
  // Las fuentes son la excepcion, porque Condiciones las enlaza.
  const name = (location.hash || '#mapa').slice(1);

  if (estado.pasoQueFalta && name !== 'fuentes') {
    dock.setPermitido(false);
    entradaView(host, {
      paso: estado.pasoQueFalta,
      go,
      onListo: (siguiente) => (siguiente ? mount() : boot().then(() => go('mapa')))
    });
    return;
  }

  if (name === 'fuentes') {
    fuentesView(host, { volver: () => history.back() });
    return;
  }

  dock.setPermitido(true);
  dock.setInvitado(estado.tipo === 'invitado');
  dock.setActive(name);
  /* …el resto del ruteo como está… */
}
```

`ROUTES` gana `reportes: reportesView` (Task 18) y `'cuenta-nueva': authView`.
`onboardingView` desaparece de los imports.

- [x] **Step 2: Verificar los cuatro caminos en el navegador**

1. `localStorage.removeItem('tn.prefs'); localStorage.removeItem('tn.session'); location.reload()` → Bienvenida.
2. Los cuatro pasos en orden hasta entrar con la cuenta demo → mapa con zócalo.
3. Con sesión guardada y `tn.prefs` borrado → **entra directo al mapa**, sin entrada.
4. `savePrefs({ sourcesAccepted: true })` sin sesión → arranca en Acceso.

- [x] **Step 3: Correr los tests**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN.

- [x] **Step 4: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/app.js
git commit -m "app.js pregunta una sola cosa: que paso falta. Las dos puertas viejas se van"
```

---

# Etapa 3 · El invitado

## Task 10: El camión del invitado

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/entrada/camion.js`
- Modify: `js/entrada/entrada.js` (el import)
- Test: `tests/web/entrada.test.mjs`

**Interfaces:**
- Produces: `camionInvitadoView(host, { onElegido })`,
  `fichaDePlantilla(plantilla) → { nombre, medidas, peso }`.
- Consumes: `api.trucks()` — `GET /api/trucks` devuelve plantillas y propios; se
  filtran las plantillas por `isTemplate`.

- [x] **Step 1: Escribir el test que falla**

```js
import { fichaDePlantilla } from '../../src/TruckNavigator.Api/wwwroot/js/entrada/camion.js';

test('la ficha de una plantilla dice las medidas que deciden la ruta, con unidad', () => {
  assert.deepEqual(
    fichaDePlantilla({ name: 'Semi 3 ejes', heightMeters: 4.1, widthMeters: 2.6, lengthMeters: 18.6, grossWeightKg: 45000 }),
    { nombre: 'Semi 3 ejes', medidas: '4,10 m de alto · 18,6 m de largo', peso: '45 t' }
  );
});

test('lo que la plantilla no declara no se inventa', () => {
  const ficha = fichaDePlantilla({ name: 'Chasis', heightMeters: null, lengthMeters: null, grossWeightKg: 12000 });
  assert.equal(ficha.medidas, 'Sin medidas declaradas');
  assert.equal(ficha.peso, '12 t');
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/entrada.test.mjs"`
Expected: FALLA — no existe `entrada/camion.js`.

- [x] **Step 3: Escribir la pantalla**

```js
/**
 * El camion del invitado.
 *
 * Primera pantalla del que entra sin cuenta, y la pide el v3 §7: "selecciona que
 * tipo de camion maneja". No es un tramite: es el dato que decide por donde
 * puede pasar, y sin el el ruteo trabajaria con medidas de auto.
 *
 * Son las PLANTILLAS del catalogo (las que no tienen dueño, AD-19), que es lo
 * unico que un anonimo puede leer y con lo que POST /api/routes sabe rutear.
 *
 * NO lleva chip de paso: el prototipo fija "Paso 2 de 4" y esto ya paso la
 * puerta.
 */
```

La parte pura:

```js
/** Un metro con coma y dos decimales, como se lee en la calle. */
const metros = (n) => `${n.toFixed(2).replace('.', ',')} m`;

/**
 * Que se le muestra de una plantilla: solo lo que decide la ruta.
 *
 * El alto y el largo son los que mandan a un camion por otra calle, y el peso es
 * lo que lo saca de la Red. Lo que la plantilla no declara NO se inventa: decirlo
 * es lo que vuelve confiable al resto.
 */
export function fichaDePlantilla(plantilla) {
  const partes = [];

  if (Number.isFinite(plantilla.heightMeters)) partes.push(`${metros(plantilla.heightMeters)} de alto`);
  if (Number.isFinite(plantilla.lengthMeters)) partes.push(`${String(plantilla.lengthMeters).replace('.', ',')} m de largo`);

  return {
    nombre: plantilla.name,
    medidas: partes.length ? partes.join(' · ') : 'Sin medidas declaradas',
    peso: `${Math.round((plantilla.grossWeightKg ?? 0) / 1000)} t`
  };
}
```

Y la vista: trae `api.trucks()`, filtra `isTemplate`, dibuja una `.fila` por
plantilla con `fichaDePlantilla`, marca la elegida con `neon` y habilita
*Continuar*, que llama a `onElegido(id)`. Si la API falla, el mono en `error` y
un botón de reintentar: sin plantillas no hay ruteo posible y hay que decirlo.

- [x] **Step 4: Correr los tests, verlo en el navegador y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/entrada/camion.js src/TruckNavigator.Api/wwwroot/js/entrada/entrada.js tests/web/entrada.test.mjs
git commit -m "El invitado elige su camion de las plantillas, que es lo que el ruteo necesita"
```

---

## Task 11: Arrancar el viaje sin viaje en el servidor

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/views/navigate.js`
  (`startTrip`, líneas 1968-2034; `closeTrip`, 2035-2080)

**Interfaces:**
- Consumes: `puede()` de `app.js` (Task 9).
- Produces: dentro de `navigate.js`, `arrancarViaje(ruta)` y
  `guardarViaje(button)`; el estado del viaje del invitado como
  `state.activeTrip = { invitado: true, startedAt, originLabel, destinationLabel }`.

- [x] **Step 1: Partir `startTrip` en dos**

Hoy hace dos cosas juntas: arma el viaje y lo guarda en el servidor. Queda:

```js
  /**
   * Arranca el guiado con la ruta que se esta mirando.
   *
   * No habla con el servidor: eso es guardarViaje(), y solo corre con cuenta.
   * Separarlas es lo que permite que un invitado navegue de verdad —voz,
   * galibos, avisos, vibracion— sin que el servidor aprenda nada de el.
   */
  function arrancarViaje(rutaElegida) {
    route = rutaElegida;
    gl.drawRoute(rutaElegida, rutaElegida.accessLegs ?? []);
    stage = 'navigation';
    startNavigating();
  }

  async function startTrip(button) {
    // El invitado navega con la ruta que ya tiene calculada. Sin viaje en el
    // servidor no hay historial ni kilometros, y eso se le dice al cerrar.
    if (!puede().guardarViaje) {
      setState({
        activeTrip: {
          invitado: true,
          startedAt: new Date().toISOString(),
          originLabel: origin.label,
          destinationLabel: destination.label
        },
        activeRoute: route
      });
      arrancarViaje(route);
      return;
    }

    /* …lo de hoy, tal cual, y al final arrancarViaje(started.route)… */
  }
```

- [x] **Step 2: Partir `closeTrip` igual**

```js
  async function closeTrip(button, arrived) {
    const trip = state.activeTrip;

    // El viaje del invitado se cierra donde vive: en la pantalla.
    if (trip?.invitado) {
      stopNavigating();
      const metros = navState?.traveledMeters ?? 0;
      setState({ activeTrip: null, activeRoute: null, cerrado: arrived ? cierreDeInvitado(trip, metros) : null });
      stage = 'search';
      route = null;
      if (arrived) { go('fin'); return; }
      /* …la limpieza de siempre… */
      return;
    }

    /* …lo de hoy… */
  }
```

`cierreDeInvitado(trip, metros)` devuelve
`{ invitado: true, creditedDistanceMeters: 0, distanceMeters: metros, elapsedSeconds, originLabel, destinationLabel }`.
**Los kilómetros del invitado no se acreditan**: `creditedDistanceMeters` es 0 a
propósito, y `distanceMeters` es lo que anduvo, para poder decírselo.

- [x] **Step 3: Verificarlo en el navegador con GPS simulado**

Entrar como invitado, elegir camión, armar una ruta corta, *Arrancar*, y mover
la posición con `TN_setPosition(lat, lng, acc, speed, heading)` **en pasos de
25 m o menos** (con saltos de 150 m dos avisos caen en el mismo latido y se
pierde uno: ver CLAUDE.md). Comprobar: la banda del viaje aparece, la voz habla,
el aviso de gálibo sale, y en la pestaña de red **no hay ningún `POST /api/trips`**.

- [x] **Step 4: Correr los tests**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASAN los 224 + los nuevos; `viaje.test.mjs` cubre el guiado y no
tiene que cambiar.

- [x] **Step 5: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/views/navigate.js
git commit -m "El guiado arranca sin viaje del servidor: el invitado navega de verdad"
```

---

## Task 12: El fin de viaje del invitado, que es el momento de conversión

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/views/fin-viaje.js` (líneas 32-100)
- Test: `tests/web/viaje.test.mjs` (agregar casos) o
  `tests/web/fin-viaje.test.mjs` si la lógica se extrae

**Interfaces:**
- Consumes: `state.cerrado` con `invitado: true` (Task 11).
- Produces: `textoDeCierre(cerrado) → { titulo, bajada, acciones }`, puro y
  testeable.

- [x] **Step 1: Escribir el test que falla**

```js
import { textoDeCierre } from '../../src/TruckNavigator.Api/wwwroot/js/views/fin-viaje.js';

test('el cierre del invitado dice los kilómetros que hizo y que no se guardaron', () => {
  const t = textoDeCierre({ invitado: true, distanceMeters: 24_300, creditedDistanceMeters: 0 });

  assert.equal(t.titulo, 'Hiciste 24,3 km');
  assert.match(t.bajada, /No se guardaron/);
  assert.match(t.bajada, /kilómetros/);
  assert.deepEqual(t.acciones, ['crear-cuenta', 'seguir']);
});

test('el cierre del invitado no festeja nada: sin EXP, sin insignias y sin confeti', () => {
  const t = textoDeCierre({ invitado: true, distanceMeters: 1_000, creditedDistanceMeters: 0 });
  assert.equal(t.festeja, false);
});

test('el cierre con cuenta sigue siendo el de siempre', () => {
  const t = textoDeCierre({ creditedDistanceMeters: 12_000, earned: { totalExperience: 40 } });
  assert.equal(t.titulo, '¡Viaje completado!');
  assert.equal(t.festeja, true);
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/viaje.test.mjs"`
Expected: FALLA — `textoDeCierre` no se exporta.

- [x] **Step 3: Extraer `textoDeCierre` y usarla en la vista**

```js
/**
 * Que dice la pantalla al cerrar un viaje.
 *
 * El invitado NO festeja: no hay EXP, no hay insignias y no hay confeti, porque
 * no hay nada que festejar y fingirlo seria mentir. Lo que si hay es el numero
 * —los kilometros que acaba de hacer— y la frase que dice la verdad: no se
 * guardaron. Es el momento en que alguien acaba de comprobar que la app le
 * sirve, y por eso es donde se le ofrece la cuenta.
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
      ? `¡Subiste a ${cerrado.earned.levelAfter.name}!`
      : acredito ? '¡Viaje completado!' : 'Llegaste',
    bajada: acredito
      ? `${cerrado.originLabel ?? 'Origen'} → ${cerrado.destinationLabel ?? 'Destino'}`
      : 'No sumó kilómetros: pasó menos de la mitad del tiempo estimado. Igual llegaste.',
    acciones: ['seguir'],
    festeja: acredito
  };
}
```

La vista usa `textoDeCierre` y, cuando `cerrado.invitado`, dibuja el mono en
`motivar`, el número grande, la bajada y los dos botones: **Crear mi cuenta**
(celeste, principal) y *Seguir sin cuenta*.

- [x] **Step 4: Correr los tests, verlo en el navegador y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/views/fin-viaje.js tests/web/viaje.test.mjs
git commit -m "El fin de viaje del invitado: el numero, la verdad y la cuenta. Sin festejo"
```

---

## Task 13: La hoja "necesito saber quién sos", una por acción

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/cuenta.js`
- Modify: `js/views/navigate.js` (los puntos de contacto: reportar, votar,
  guardar Casa y Depósito), `js/app.js` (el menú y el perfil)
- Test: `tests/web/cuenta.test.mjs`

**Interfaces:**
- Produces: `MOTIVOS`, `textoDeCuenta(motivo) → { titulo, texto }`,
  `hojaDeCuenta(motivo, { onCrear, onLuego })`.

- [x] **Step 1: Escribir el test que falla**

```js
/**
 * La hoja que aparece cuando un invitado toca algo que necesita cuenta.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MOTIVOS, textoDeCuenta } from '../../src/TruckNavigator.Api/wwwroot/js/cuenta.js';

test('hay un motivo por acción bloqueada, y ninguno genérico', () => {
  assert.deepEqual(Object.keys(MOTIVOS).sort(), ['contacto', 'juegos', 'lugar', 'perfil', 'reportar', 'vencido', 'votar'].sort());
});

test('cada motivo dice por qué ESA acción necesita cuenta, no un cartel comodín', () => {
  // Un mensaje genérico ("necesitás una cuenta") enseña a ignorarlo.
  const textos = Object.keys(MOTIVOS).map((m) => textoDeCuenta(m).texto);
  assert.equal(new Set(textos).size, textos.length, 'dos motivos comparten el texto');

  assert.match(textoDeCuenta('reportar').texto, /alias/);
  assert.match(textoDeCuenta('votar').texto, /confirm/i);
  assert.match(textoDeCuenta('lugar').texto, /Casa|Depósito/);
  assert.match(textoDeCuenta('contacto').texto, /emergencia/);
  assert.match(textoDeCuenta('vencido').texto, /día de prueba/);
  assert.match(textoDeCuenta('juegos').texto, /EXP|nivel/);
});

test('el título del vencido no reta a nadie: dice que se terminó y ofrece seguir', () => {
  assert.equal(textoDeCuenta('vencido').titulo, 'Se terminó tu día de prueba');
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/cuenta.test.mjs"`
Expected: FALLA — no existe `js/cuenta.js`.

- [x] **Step 3: Escribir `cuenta.js`**

```js
/**
 * "Necesito saber quien sos": la hoja que ve un invitado al tocar algo que pide
 * cuenta.
 *
 * Es UNA hoja con el motivo como parametro, y no un cartel generico: decirle
 * "necesitas una cuenta" cinco veces seguidas le enseña a ignorar el cartel.
 * Cada motivo explica por que ESA accion la necesita.
 *
 * Ninguna accion bloqueada devuelve un 401 ni un error: el mono lo dice antes.
 */

export const MOTIVOS = {
  reportar: {
    titulo: 'Para reportar necesito saber quién sos',
    texto: 'Tu reporte lleva tu alias y suma EXP, y para eso hace falta una cuenta.'
  },
  votar: {
    titulo: 'Para confirmar un reporte hace falta tu cuenta',
    texto: 'Confirmar o descartar lo que reportó otro mueve su confiabilidad, así que no puede ser anónimo.'
  },
  lugar: {
    titulo: 'Guardar Casa y Depósito pide cuenta',
    texto: 'Tus lugares viven en el servidor para que estén ahí cuando cambies de teléfono.'
  },
  contacto: {
    titulo: 'Los contactos de emergencia van en tu cuenta',
    texto: 'Un contacto de emergencia que se pierde al reinstalar es un contacto que no está el día que hace falta.'
  },
  perfil: {
    titulo: 'Tu perfil arranca con la cuenta',
    texto: 'Ahí viven tu nivel, tus kilómetros, tus metas y tus camiones.'
  },
  juegos: {
    titulo: 'Los juegos van con tu cuenta',
    texto: 'Lo que ganes ahí suma EXP y empuja tu nivel, así que necesita saber de quién es.'
  },
  vencido: {
    titulo: 'Se terminó tu día de prueba',
    texto: 'Creá tu cuenta y seguí manejando conmigo: desde ahí los kilómetros empiezan a sumar.'
  }
};

export const textoDeCuenta = (motivo) => MOTIVOS[motivo] ?? MOTIVOS.perfil;
```

Más `hojaDeCuenta(motivo, { onCrear, onLuego })`, que dibuja la hoja con el mono
en `motivar`, el título, el texto y dos botones: **Crear mi cuenta** y
*Ahora no* (o sólo el primero para `vencido`).

- [x] **Step 4: Engancharla en cada punto de contacto**

En `navigate.js`, antes de reportar, votar y guardar un lugar; en `app.js`, en
las filas del menú que el invitado no puede abrir. La condición sale de
`puede()`.

- [x] **Step 5: Correr los tests, verificar en el navegador y commit**

Comprobar como invitado: el botón amarillo de reportar abre la hoja de
`reportar`; los dos botones de *sigue ahí* la de `votar`; guardar Casa la de
`lugar`. Y que **ninguna** produce un 401 en la pestaña de red.

```bash
git add src/TruckNavigator.Api/wwwroot/js tests/web/cuenta.test.mjs
git commit -m "Cada accion bloqueada dice por que la necesita, con el mono y antes de fallar"
```

---

## Task 14: El día que se termina

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/views/navigate.js` (el botón
  *Arrancar*), `js/mapa/viaje.js` si el botón vive ahí
- Test: `tests/web/sesion.test.mjs` (ya cubierto por `invitadoVencido`)

**Interfaces:**
- Consumes: `puede().navegar` (Task 9), `hojaDeCuenta('vencido', …)` (Task 13).

- [x] **Step 1: Frenar *Arrancar* cuando el día venció**

```js
      if (accion === 'arrancar') {
        // El dia de prueba se termino: el mapa y las capas siguen, navegar no.
        if (!puede().navegar) {
          hojaDeCuenta('vencido', { onCrear: () => go('cuenta-nueva') });
          return;
        }
        startTrip(boton);
      }
```

Son **dos** lugares en `navigate.js` (líneas 1409 y 1489 de hoy) más el del
reparto (1283): los tres pasan por el mismo freno.

- [x] **Step 2: Verificarlo en el navegador**

```js
savePrefs({ invitadoDesde: '2026-09-28T10:00:00-03:00' }); location.reload();
```

Comprobar: el mapa se ve entero, las capas funcionan, buscar y calcular la ruta
funcionan, y *Arrancar* abre la hoja del vencido. Y que el **911 sigue
funcionando** desde el zócalo.

- [x] **Step 3: Correr los tests y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/views/navigate.js
git commit -m "Al vencer el dia de prueba el mapa sigue y Arrancar pide la cuenta"
```

---

# Etapa 4 · El menú y los reportes

## Task 15: El menú MÁS completo, y su variante de invitado

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/dock.js` (`MENU_MAS` línea 43,
  `ICONOS_MENU`, y `draw()`)
- Test: `tests/web/dock.test.mjs` (nuevo)

**Interfaces:**
- Produces: `MENU_MAS`, `menuParaInvitado(menu) → filas`, `dock.setInvitado(bool)`.

- [x] **Step 1: Escribir el test que falla**

```js
/**
 * El menú MÁS: las entradas del v3 §12 y qué ve un invitado.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MENU_MAS, menuParaInvitado } from '../../src/TruckNavigator.Api/wwwroot/js/dock.js';

test('el menú tiene las entradas del v3, con Resumen y Chat marcados como pronto', () => {
  assert.deepEqual(MENU_MAS.map((m) => m.ruta),
    ['perfil', 'resumen', 'reportes', 'camiones', 'carnet', 'chat', 'configuracion']);

  assert.deepEqual(MENU_MAS.filter((m) => m.pronto).map((m) => m.ruta), ['resumen', 'chat']);
});

test('el invitado ve Configuración y la invitación, y nada que no pueda abrir', () => {
  // Un menu lleno de filas que no puede abrir es una lista de frustraciones.
  assert.deepEqual(menuParaInvitado(MENU_MAS).map((m) => m.ruta), ['configuracion', 'cuenta-nueva']);
});

test('la fila de la cuenta del invitado invita, no reta', () => {
  const fila = menuParaInvitado(MENU_MAS).find((m) => m.ruta === 'cuenta-nueva');
  assert.equal(fila.label, 'Crear mi cuenta');
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/dock.test.mjs"`
Expected: FALLA — `MENU_MAS` no se exporta y no tiene esas entradas.

- [x] **Step 3: Completar el menú**

```js
/** Lo que abre "mas". Las entradas son las del brainstorm v3 §12. */
export const MENU_MAS = [
  { ruta: 'perfil',        label: 'Mi perfil' },
  { ruta: 'resumen',       label: 'Resumen', pronto: true },
  { ruta: 'reportes',      label: 'Reportes' },
  { ruta: 'camiones',      label: 'Mis camiones' },
  { ruta: 'carnet',        label: 'Mi carnet' },
  { ruta: 'chat',          label: 'Chat', pronto: true },
  { ruta: 'configuracion', label: 'Configuración' }
];

/**
 * El menu de un invitado: lo unico que puede abrir, mas la invitacion.
 *
 * Configuracion no es un lujo para el: ahi estan el tema, la vibracion y la
 * direccion del servidor, que es lo que le permite arreglar la app si la IP
 * cambio.
 */
export const menuParaInvitado = (menu) => [
  menu.find((m) => m.ruta === 'configuracion'),
  { ruta: 'cuenta-nueva', label: 'Crear mi cuenta', destacada: true }
];
```

Más `setInvitado(valor)` en el objeto que devuelve `createDock`, que redibuja
con `menuParaInvitado` y le pone la fila destacada con el mono chico. Y el
acceso **Juegos** del zócalo, para un invitado, abre
`hojaDeCuenta('juegos', …)` en vez de la pantalla: lo que se gana ahí suma EXP,
y sin cuenta no hay dónde sumarla. GPS y S.O.S. le funcionan de verdad.

Las filas del menú pasan al vocabulario: `.fila` con ícono ilustrado, título,
subtítulo y chevron — es "la caja de toda la app" del prototipo.

- [x] **Step 4: Correr los tests, verlo en las dos variantes y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/dock.js tests/web/dock.test.mjs
git commit -m "El menu MAS completo, con la fila del prototipo y su variante de invitado"
```

---

## Task 16: Configuración: el idioma y las fuentes

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/app.js` (`settingsView`, línea 447)

**Interfaces:**
- Consumes: `IDIOMAS` (Task 6), `fuentesView` (Task 7).

- [x] **Step 1: Sumar las dos filas**

En `settingsView`, con la fila del vocabulario:

```js
      <div class="fila" id="cfg-idioma">
        ${raw(icono('idioma', 32))}
        <div class="grow"><b>Idioma</b><span class="sub">Los otros tres están en camino</span></div>
        <span class="pill pill-brand">Español</span>
      </div>

      <div class="fila" id="cfg-fuentes">
        ${raw(icono('fuentes', 32))}
        <div class="grow"><b>De dónde salen los datos</b><span class="sub">La Ley 2148, OpenStreetMap y lo que la app no sabe</span></div>
      </div>
```

Y su cableado: `#cfg-idioma` abre la pantalla del paso 2 (donde sólo se puede
elegir español) y `#cfg-fuentes` va a `go('fuentes')`.

- [x] **Step 2: Verificarlo en el navegador**

Como cuenta y como invitado: las dos filas aparecen, la de fuentes abre la
pantalla y vuelve, y la de idioma muestra español elegido y los otros tres en
*Pronto*.

- [x] **Step 3: Commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/app.js
git commit -m "Configuracion gana el idioma y de donde salen los datos"
```

---

## Task 17: La lista de Reportes en vivo — lo que se calcula

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/views/reportes.js` (la parte pura)
- Test: `tests/web/reportes-lista.test.mjs`

**Interfaces:**
- Consumes: `tipoDeReporte`, `etiquetaEdad`, `estadoDelPin` de `js/mapa/reportes.js`.
- Produces: `GRADOS_DE_LA_LISTA = 0.02`, `recuadroDeLaLista(fix, ultimoBbox) → bbox | null`,
  `filasDeReportes(reportes, ahora) → filas`, `vacioDeLaLista(motivo) → { titulo, texto }`.

- [x] **Step 1: Escribir el test que falla**

```js
/**
 * Reportes en vivo: el recuadro del que se piden, el orden y qué dice cada fila.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GRADOS_DE_LA_LISTA, recuadroDeLaLista, filasDeReportes, vacioDeLaLista } from '../../src/TruckNavigator.Api/wwwroot/js/views/reportes.js';

const AHORA = new Date('2026-09-30T15:00:00-03:00');

test('el recuadro sale del último fix, con 0,02° de lado', () => {
  assert.equal(GRADOS_DE_LA_LISTA, 0.02);

  const bbox = recuadroDeLaLista({ lat: -34.6037, lng: -58.3816 }, null);
  assert.deepEqual(bbox.map((n) => Number(n.toFixed(4))), [-58.3916, -34.6137, -58.3716, -34.5937]);
});

test('sin fix vale el último recuadro que se vio en el mapa', () => {
  const visto = [-58.40, -34.62, -58.38, -34.60];
  assert.deepEqual(recuadroDeLaLista(null, visto), visto);
});

test('sin fix y sin mapa no se inventa una posición', () => {
  assert.equal(recuadroDeLaLista(null, null), null);
});

test('las filas salen por más nuevo primero', () => {
  const filas = filasDeReportes([
    { id: 'a', type: 'Pothole', createdAt: '2026-09-30T10:00:00-03:00', street: 'Av. Dorrego 1100' },
    { id: 'b', type: 'Traffic', createdAt: '2026-09-30T14:30:00-03:00', street: 'Av. Corrientes 2000' }
  ], AHORA);

  assert.deepEqual(filas.map((f) => f.id), ['b', 'a']);
});

test('un reporte sin calle no inventa una', () => {
  const [fila] = filasDeReportes([{ id: 'a', type: 'Traffic', createdAt: AHORA.toISOString(), street: null }], AHORA);
  assert.equal(fila.donde, 'Cerca de tu posición');
});

test('el propio se marca y se puede cerrar; el ajeno muestra el alias', () => {
  const filas = filasDeReportes([
    { id: 'a', type: 'Traffic', createdAt: AHORA.toISOString(), mine: true, reportedBy: { alias: 'Tobi' } },
    { id: 'b', type: 'Camera', createdAt: AHORA.toISOString(), mine: false, reportedBy: { alias: 'Nico' } }
  ], AHORA);

  assert.equal(filas[0].quien, 'Vos');
  assert.equal(filas[0].sePuedeCerrar, true);
  assert.equal(filas[1].quien, 'Nico');
  assert.equal(filas[1].sePuedeCerrar, false);
});

test('el vacío vende la próxima acción, y el que no tiene posición pide prenderla', () => {
  assert.match(vacioDeLaLista('sin-reportes').texto, /contámelo/i);
  assert.match(vacioDeLaLista('sin-posicion').texto, /ubicación/i);
});
```

- [x] **Step 2: Correrlo y verlo fallar**

Run: `node --test "tests/web/reportes-lista.test.mjs"`
Expected: FALLA — no existe `views/reportes.js`.

- [x] **Step 3: Escribir la parte pura**

```js
/**
 * Reportes en vivo: la cara visible de la Fase 5, que pide el v3 §12 —"tipo,
 * ubicacion, horario, usuario que lo realizo y estado"—.
 *
 * Es una LISTA, no un sistema: los datos son los mismos que dibuja el mapa y
 * salen del mismo GET /api/reports. Lo que se calcula aca es de donde se piden,
 * en que orden se muestran y que dice cada fila.
 */

/** El lado del recuadro: unos 2,2 km, lo que un camion recorre en minutos. */
export const GRADOS_DE_LA_LISTA = 0.02;
```

```js
/**
 * De donde se piden, en este orden: el ultimo fix, el ultimo recuadro que se vio
 * en el mapa, o nada. Sin ninguno de los dos NO se inventa una posicion: la
 * pantalla pide prender la ubicacion, que es la verdad.
 */
export function recuadroDeLaLista(fix, ultimoBbox) {
  if (fix) {
    const d = GRADOS_DE_LA_LISTA / 2;
    return [fix.lng - d, fix.lat - d, fix.lng + d, fix.lat + d];
  }

  return ultimoBbox ?? null;
}

/** Las filas, mas nuevo primero: es el orden en que a uno le importan. */
export function filasDeReportes(reportes, ahora) {
  return [...reportes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => ({
      id: r.id,
      tipo: tipoDeReporte(r.type),
      donde: r.street || 'Cerca de tu posición',
      cuando: etiquetaEdad(r.createdAt, ahora),
      estado: estadoDelPin(r),
      quien: r.mine ? 'Vos' : (r.reportedBy?.alias ?? 'Alguien'),
      sePuedeCerrar: Boolean(r.mine)
    }));
}

/** El vacio vende la proxima accion: el mono pregunta, el boton responde. */
export function vacioDeLaLista(motivo) {
  if (motivo === 'sin-posicion') {
    return {
      titulo: 'No sé dónde estás',
      texto: 'Prendé la ubicación y te muestro lo que hay reportado cerca.'
    };
  }

  return {
    titulo: 'Por acá no hay nada reportado',
    texto: 'Si ves un control, un bache o una calle cerrada, contámelo desde el mapa.'
  };
}
```

- [x] **Step 4: Correr los tests y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/views/reportes.js tests/web/reportes-lista.test.mjs
git commit -m "Reportes en vivo: el recuadro, el orden y que dice cada fila"
```

---

## Task 18: La pantalla de Reportes y el salto al mapa

**Files:**
- Modify: `js/views/reportes.js` (la vista), `js/app.js` (`ROUTES`),
  `js/views/navigate.js` (abrir centrado en un reporte)

**Interfaces:**
- Consumes: `filasDeReportes` (Task 17), `api.reports`, `api.closeReport`,
  `hojaDeCuenta` (Task 13).
- Produces: `reportesView(host, { go })`; el salto al mapa por
  `location.hash = 'mapa'` más `sessionStorage.setItem('tn.reporte-a-mostrar', id)`,
  que `navigate.js` consume una vez y limpia.

- [x] **Step 1: Escribir la vista**

Cabecera compacta con *Reportes*, y las filas con el ícono del tipo en su color,
la calle, la edad, el estado y quién. Los propios con su marca y el botón de
cerrar, que llama a `api.closeReport(id)` y refresca. Tocar una fila salta al
mapa centrado. Como invitado, cerrar y votar abren `hojaDeCuenta('votar')`.

- [x] **Step 2: Enganchar el salto en `navigate.js`**

Al montar, si hay un id en `sessionStorage`, se centra ahí y se abre su ficha
—reutilizando `fichaReporte` que ya existe— y se limpia la clave para que no se
repita al volver.

- [x] **Step 3: Verificarlo en el navegador**

Con la cuenta demo: crear un reporte desde el mapa, abrir MÁS → Reportes, ver
la fila con *Vos* y su estado, cerrarla desde la lista, y comprobar que tocar
otra fila abre el mapa centrado con la ficha.

- [x] **Step 4: Correr los tests y commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js
git commit -m "La pantalla de Reportes en vivo, y tocar una fila abre el mapa ahi"
```

---

# Etapa 5 · Cierre

## Task 19: Verificación de punta a punta en el navegador

**Files:** ninguno (es verificación)

- [x] **Step 1: El camino del que llega de cero**

A 375 × 812, con `localStorage` limpio: los cuatro pasos en orden, el chip
diciendo *2 de 4* y *3 de 4*, el enlace de las fuentes que vuelve, y el alta de
una cuenta nueva hasta "revisá tu correo".

- [x] **Step 2: El camino del invitado, completo**

*Probar sin cuenta* → elegir camión → mapa → ruta → *Arrancar* → GPS simulado
en pasos de 25 m hasta llegar → el fin de viaje sin EXP con los kilómetros →
*Crear mi cuenta*. Y en el medio: tocar reportar, votar y guardar Casa para ver
las tres hojas distintas.

- [x] **Step 3: El día vencido y el 911**

`savePrefs({ invitadoDesde: <anteayer> })`, recargar, comprobar que el mapa
funciona, que *Arrancar* pide la cuenta y que **el S.O.S. llama al 911**.

- [x] **Step 4: Los tres caminos de la migración**

Con sesión y sin preferencias → al mapa sin entrada. Con `sourcesAccepted` y sin
sesión → arranca en Acceso. Preferencias limpias → Bienvenida.

- [x] **Step 5: Los tests completos**

Run: `node --test "tests/web/*.test.mjs"`
Expected: todo verde. Anotar el conteo final.

- [x] **Step 6: Commit de lo que haya salido**

Si la verificación encontró defectos, se arreglan con su test y se commitean de
a uno.

---

## Task 20: La documentación

**Files:**
- Modify: `docs/decisions.md` (AD-51), `CLAUDE.md`,
  `.claude/skills/estado-camiones-app/SKILL.md`,
  `.claude/skills/producto-camiones-app/SKILL.md`,
  `docs/superpowers/plans/2026-09-30-entrada-y-cascara.md` (marcar las etapas)

- [x] **Step 1: AD-51**

*"La entrada, el invitado y el estado de la app"*: por qué el estado va en una
función pura y no en los ifs del router; por qué el invitado navega de verdad y
su viaje no se guarda; por qué el día vive en el teléfono y eso se acepta a ojos
abiertos; por qué cada acción bloqueada dice su motivo; y qué queda afuera.

- [x] **Step 2: `CLAUDE.md`**

Los conteos de los tests de JS, la tabla de documentos, y **una trampa nueva**:
que la app tiene tres estados y que una pantalla no debe preguntar
`isSignedIn()` por su cuenta sino `puede()`, porque el invitado es una sesión
que no existe en el servidor.

- [x] **Step 3: Las dos skills**

En `estado-camiones-app`: la punta al día, el frente vivo, la sección de qué se
verificó y los conteos. En `producto-camiones-app`: la Fase 7 con sus ítems en
✅ y la Fase 6 tocada sólo donde corresponda (el menú MÁS y los reportes en
vivo).

- [x] **Step 4: Commit**

```bash
git add docs CLAUDE.md .claude/skills
git commit -m "Docs de la entrada y la cascara: AD-51, los conteos y el frente vivo"
```

---

## Task 21: El APK y el teléfono

**Files:**
- Modify: ninguno, salvo que la prueba encuentre defectos

- [ ] **Step 1: Compilar**

```powershell
.\build-apk.ps1 -ApiUrl http://<la IP del día>:5080
```

**Siempre con el script**, nunca incremental: una compilación incremental en
Release produce un APK que aborta al arrancar.

- [ ] **Step 2: Instalar y leer el log**

```bash
adb install -r NavegadorCamiones.apk
adb logcat -v time -s Web:V Cascara:V Brujula:V
```

- [ ] **Step 3: Que el usuario lo toque**

La entrada completa desde cero, el invitado navegando de verdad en la calle o en
el estacionamiento, y la conversión a cuenta. **Nada de esto cuenta como
probado hasta que el usuario lo toque**: es la franja donde este proyecto se
equivocó once veces.

- [ ] **Step 4: Arreglar lo que aparezca, con su test, y commitear de a uno**
