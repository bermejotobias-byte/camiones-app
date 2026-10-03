# La Red primero — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la Red de Tránsito Pesado sea la vía que manda en el mapa —siempre visible,
con cromo que destella, nombres que crecen con el zoom— y que la ruta pinte la calle en
vez de flotar sobre ella.

**Architecture:** todo vive en el estilo del cliente; no se regeneran tiles. Los anchos
por zoom salen de una sola tabla (`PARADAS` en `js/mapa/estilo-mapa.js`), que ahora usan
también la Red y la ruta. Lo que sabe de la Red como dibujo —las cuatro capas del cromo,
su nombre, dónde se apila, el destello— pasa a un módulo puro nuevo, `js/mapa/red.js`,
con tests; `layers.js` sólo lo instala en el mapa y `map.js` sólo dibuja la ruta.

**Tech Stack:** MapLibre GL 5.6, módulos ES sin compilación, `node --test` sin
dependencias (AD-32), CSS con tokens en `app.css`.

**Spec:** `docs/superpowers/specs/2026-10-03-la-red-primero-design.md`

## Global Constraints

- Rama `la-red-primero`. **Antes de tocar código**, rebasada sobre `main` con el PR #2
  (parte A) fusionado: los dos tocan `js/map.js` (Tarea 0).
- Nunca commitear `routing/config-truck.yml` ni `.claude/launch.json`. Nunca empujar al
  remoto `hermano`. Nunca auto-merge: el PR lo fusiona el usuario.
- Código, comentarios, commits y docs en español. Los comentarios de `wwwroot/js` siguen el
  estilo del archivo: **sin tildes** en los `.js` existentes (`layers.js`, `map.js`,
  `estilo-mapa.js`); los tests (`.mjs`) sí llevan tildes.
- **`['zoom']` va sólo en el nivel superior de un `interpolate`** (CLAUDE.md, AD-36):
  escalar con `ancho(paradas, { por, mas })`, que corre las paradas ANTES de armar la
  expresión. Una expresión mal formada no tira excepción: la capa no aparece y el error
  sale por el evento `error` del mapa como `Mapa: …` en la consola.
- Tokens de color: noche en `:root { … }`, día en `:root[data-theme="light"] { … }`
  (`src/TruckNavigator.Api/wwwroot/app.css`). Valores exactos (spec §3.1):

  | Token | Noche | Día |
  |---|---|---|
  | `--map-calle` | `#354558` | `#ffffff` |
  | `--map-avenida` | `#3d4d61` | `#ffffff` |
  | `--map-autopista` | `#4a5f7a` | `#f1ead6` |
  | `--map-red` | `#8fb6de` | `#5b8cc4` |
  | `--map-red-canto` | `#3d5f85` | `#2f5a88` |
  | `--map-red-reflejo` | `#cfe4f8` | `#9fc3e8` |
  | `--map-red-brillo` | `#ffffff` | `#e8f3ff` |

- Anchos por zoom (13 / 15 / 17 / 19, curva exponencial 1,4): Red `6 / 10 / 22 / 48`;
  ruta `4 / 7 / 14 / 30`, canto de la ruta +3 px al 35 %.
- Nombres (`text-size`, lineal): calles `14:10, 16:12, 18:14, 19:15`; Red
  `13:10, 15:11.5, 16:13, 18:16, 19:18`; halo de la Red 2.
- Destello: opacidad de `red-brillo` entre 0,55 y 0,95, ciclo 2.500 ms (coseno), latido de
  100 ms (10 Hz), quieto en segundo plano, sin animación con `prefers-reduced-motion`.
- Tests web: `node --test "tests/web/*.test.mjs"` desde la raíz. Cada test nuevo se ve en
  rojo antes de escribir el código.
- Al iterar en el navegador, los módulos ES quedan cacheados: para probar una versión
  nueva de un módulo suelto, `import('/js/…?v=' + Date.now())`; para el mapa de la app,
  recargar la página.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `wwwroot/js/mapa/estilo-mapa.js` | Exporta `ancho` y `PARADAS` (con `red` y `ruta`), `ANCHO_DE_RUTA`, `TAMANO_DE_PUNTA` y `filtroCallesNombre`. Sale `autopista-centro`. Los nombres de calle crecen hasta 19 |
| `wwwroot/js/mapa/red.js` (nuevo) | Puro: `lineasDeLaRed`, `nombreDeLaRed`, `anclaDeLaRed`, `nombresDeLaRed`, `opacidadDelBrillo`, `destello` |
| `wwwroot/js/layers.js` | `addRedLayers` usa `red.js`; `red` sale de `GRUPOS`; filtra `calles-nombre`; enciende el destello |
| `wwwroot/js/mapa/capas.js` | Sale el cuadro de la Red; `capasActivas` ya no devuelve `red` |
| `wwwroot/js/map.js` | La ruta, su canto, el acceso y la flecha de la maniobra con ancho por zoom |
| `wwwroot/app.css` | Tokens de la tabla; sale `--map-centro` |
| `tests/web/red.test.mjs` (nuevo) | El cromo, la pila, los nombres de la Red, el destello |
| `tests/web/colores-mapa.test.mjs` (nuevo) | El contraste medido desde `app.css` |
| `tests/web/layers.test.mjs` (nuevo) | La Red no se apaga |
| `tests/web/estilo-mapa.test.mjs`, `tests/web/capas.test.mjs` | Casos nuevos y ajustados |
| `docs/decisions.md`, `CLAUDE.md`, skills de diseño y de estado | AD-53 y las trampas que cambian |

`wwwroot` = `src/TruckNavigator.Api/wwwroot`.

---

### Tarea 0: arrancar desde main con la parte A

**Files:** ninguno.

- [ ] **Paso 1: confirmar que el PR #2 está fusionado**

```bash
gh pr view 2 --json state,mergedAt
```

Esperado: `"state":"MERGED"`. Si sigue `OPEN`, **parar y avisarle al usuario**: B toca
`js/map.js` igual que A, y construir encima de un `main` sin A obliga a resolver
conflictos después. (El #3 no comparte código con B; da igual si está fusionado o no.)

- [ ] **Paso 2: traer main y rebasar**

```bash
git checkout main && git pull origin main && git checkout la-red-primero && git rebase main
```

Esperado: el rebase aplica los commits de la spec y del plan sin conflictos (sólo agregan
archivos en `docs/superpowers/`).

- [ ] **Paso 3: la base en verde**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`. Anotar el número de `# pass` (con A fusionado, 350): es la base para
el conteo de CLAUDE.md en la Tarea 10.

---

### Tarea 1: las fotos de ANTES

Las fotos de antes se sacan antes de tocar el estilo: después ya no se pueden sacar.

**Files:**
- Create (scratchpad, no se commitea): `comparar-la-red.ps1`

- [ ] **Paso 1: levantar la API y abrir el mapa**

Hace falta GraphHopper en `:8989` para dibujar la ruta (`cd routing; .\run-graphhopper.ps1`,
si no está arriba). Después `preview_start` con `{name: "api"}` (de `.claude/launch.json`),
`resize_window` a 375 × 812, entrar a la app como invitado o con
`demo@camiones.test` / `camion2026` hasta el mapa. `window.tnMap` existe en localhost.

Si el panel del navegador está oculto, `requestAnimationFrame` no corre y el mapa no se
dibuja. Antes de las fotos:

```js
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
```

- [ ] **Paso 2: el guion de una foto**

En `javascript_tool`, una vez por lugar y tema:

```js
const SEMI = '6f0f1f9c-1a2b-4c3d-8e4f-000000000003';
const LUGARES = {
  // La transversal llegando a Av. Juan B. Justo (Palermo).
  jbj: { centro: [-58.433683, -34.584495], origen: [-58.4290, -34.5900], destino: [-58.4420, -34.5790] },
  // Barragán llegando a la Autopista Perito Moreno.
  pm: { centro: [-58.487523, -34.644771], origen: [-58.4885, -34.6540], destino: [-58.4600, -34.6420] }
};

async function preparar(lugar, tema) {
  const { buildBasemapStyle } = await import('/js/mapa/estilo-mapa.js');
  if (tema === 'dia') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  tnMap.setStyle(buildBasemapStyle(''));
  await new Promise((r) => tnMap.once('idle', r));

  const { origen, destino, centro } = LUGARES[lugar];
  const punto = ([lng, lat]) => ({ latitude: lat, longitude: lng });
  const ruta = await (await fetch('/api/routes', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ truckId: SEMI, origin: punto(origen), destination: punto(destino) })
  })).json();
  // Queda a mano para las tareas 8 y 9.
  window.ruta = ruta;
  (await import('/js/map.js')).drawRoute(ruta, ruta.accessLegs ?? []);
  tnMap.jumpTo({ center: centro, zoom: 13 });
  return ruta.distanceMeters;
}
```

Para cada zoom (13, 15, 17, 19): `tnMap.jumpTo({ center: LUGARES[lugar].centro, zoom })`,
esperar `idle` y sacar la foto con `computer {action: "screenshot"}`. Si la ruta no entra a
la Red por una transversal, mover el origen una cuadra y repetir. Si el screenshot vence,
reintentar con una espera de 2 s.

- [ ] **Paso 3: sacar las 16 fotos**

`jbj` y `pm`, `noche` y `dia`, zoom 13, 15, 17 y 19. Anotar el archivo de cada foto, en el
orden en que salieron. Las fotos quedan en la carpeta `tool-results` de la sesión.

- [ ] **Paso 4: el armador de comparaciones**

Crear `comparar-la-red.ps1` en el scratchpad (el mismo método de `comparar-jerarquia.ps1`
de la sesión anterior: System.Drawing, sin dependencias):

```powershell
param(
  [Parameter(Mandatory)] [string] $Titulo,
  [Parameter(Mandatory)] [string[]] $Antes,     # 4 archivos: zoom 13, 15, 17, 19
  [string[]] $Despues = @(),                    # 4 archivos o ninguno
  [Parameter(Mandatory)] [string] $Salida
)
Add-Type -AssemblyName System.Drawing

$zooms = 13, 15, 17, 19
$ancho = 300; $alto = 650; $sep = 12; $borde = 14; $cabeza = 56; $rotulo = 30
$filas = @(@{ nombre = 'ANTES'; fotos = $Antes })
if ($Despues.Count) { $filas += @{ nombre = 'DESPUES'; fotos = $Despues } }

$total = $borde * 2 + 4 * $ancho + 3 * $sep
$altoTotal = $borde * 2 + $cabeza + $filas.Count * ($rotulo + $alto + $sep)
$lienzo = New-Object System.Drawing.Bitmap $total, $altoTotal
$g = [System.Drawing.Graphics]::FromImage($lienzo)
$g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(14, 17, 22))
$fT = New-Object System.Drawing.Font 'Segoe UI', 18, ([System.Drawing.FontStyle]::Bold)
$fR = New-Object System.Drawing.Font 'Segoe UI', 11, ([System.Drawing.FontStyle]::Bold)
$g.DrawString($Titulo, $fT, [System.Drawing.Brushes]::White, $borde, $borde)

for ($f = 0; $f -lt $filas.Count; $f++) {
  $y = $borde + $cabeza + $f * ($rotulo + $alto + $sep)
  for ($i = 0; $i -lt 4; $i++) {
    $x = $borde + $i * ($ancho + $sep)
    $g.DrawString("$($filas[$f].nombre) · zoom $($zooms[$i])", $fR, [System.Drawing.Brushes]::Gainsboro, $x, $y)
    $img = [System.Drawing.Image]::FromFile($filas[$f].fotos[$i])
    $fuente = New-Object System.Drawing.Rectangle 0, 0, $img.Width, ([int]($img.Height * 0.92))
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle $x, ($y + $rotulo), $ancho, $alto), $fuente, [System.Drawing.GraphicsUnit]::Pixel)
    $img.Dispose()
  }
}
$lienzo.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $lienzo.Dispose()
"guardada: $Salida"
```

Correrlo una vez por lugar y tema con sólo `-Antes`, para confirmar que arma bien. Las
comparaciones finales se arman en la Tarea 9.

- [ ] **Paso 5: dejar el tema como estaba**

```js
document.documentElement.removeAttribute('data-theme');
```

Sin commit: nada de esto va al repo.

---

### Tarea 2: la autopista sin punteado

**Files:**
- Modify: `wwwroot/js/mapa/estilo-mapa.js` (capa `autopista-centro`, token `centro`, comentario del encabezado)
- Modify: `wwwroot/app.css` (sale `--map-centro` de los dos bloques)
- Test: `tests/web/estilo-mapa.test.mjs`

- [ ] **Paso 1: el test que falla**

Agregar al final de `tests/web/estilo-mapa.test.mjs`:

```js
test('la autopista no lleva línea punteada: la banda y los dos carriles alcanzan', () => {
  const punteadas = buildBasemapStyle('').layers
    .filter((l) => l.paint?.['line-dasharray'] && JSON.stringify(l.filter).includes('highway'))
    .map((l) => l.id);

  assert.deepEqual(punteadas, []);
  assert.ok(capa('autopista-carril-a') && capa('autopista-carril-b'));
});
```

- [ ] **Paso 2: verlo fallar**

```bash
node --test tests/web/estilo-mapa.test.mjs
```

Esperado: FAIL, `[ 'autopista-centro' ]` contra `[]`.

- [ ] **Paso 3: sacar la capa**

En `estilo-mapa.js`, borrar la línea
`linea('autopista-centro', esAutopista, t.centro, 1.2, { 'line-dasharray': [4, 5], 'line-opacity': 0.9 }),`,
la entrada `centro: token('--map-centro'),` de `t`, y cambiar el comentario de la sección:

```js
      /* -- la autopista: banda clara y dos carriles ------------------------- */
```

En el encabezado, la viñeta de la autopista queda:

```js
 * · **la autopista** es una banda clara con dos lineas de carril (waze-08). La
 *   linea central punteada se saco el 03/10/2026 (AD-53): de lejos se leia como
 *   un tramo cortado;
```

En `app.css`, borrar las dos líneas `--map-centro:` (noche `#c8d3df`, día `#ffffff`).

- [ ] **Paso 4: verlo pasar**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 5: commit**

```bash
git add tests/web/estilo-mapa.test.mjs src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js src/TruckNavigator.Api/wwwroot/app.css
git commit -m "La autopista sin linea punteada en el centro"
```

---

### Tarea 3: los colores — la Red arriba, el resto un escalón abajo

**Files:**
- Modify: `wwwroot/app.css` (bloques `:root` y `:root[data-theme="light"]`)
- Create: `tests/web/colores-mapa.test.mjs`

- [ ] **Paso 1: el test que falla**

Crear `tests/web/colores-mapa.test.mjs`:

```js
/**
 * La jerarquía del mapa medida como contraste contra el fondo, con los colores
 * que de verdad están en app.css (spec 2026-10-03-la-red-primero, §3.1).
 *
 * Antes de la parte B, de noche la autopista (4,36) le ganaba a la Red (3,81) y
 * entre la Red y una avenida había 1,75: fuera de la ruta la Red no se
 * distinguía. De noche la jerarquía es una escalera; de día las calles son
 * blancas y la jerarquía la da la Red sola.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/TruckNavigator.Api/wwwroot/app.css', import.meta.url), 'utf8');

function bloque(selector) {
  const inicio = css.indexOf(`${selector} {`);
  assert.ok(inicio >= 0, `no está el bloque ${selector}`);
  return css.slice(inicio, css.indexOf('\n}', inicio));
}

const tokens = (texto) => Object.fromEntries(
  [...texto.matchAll(/--(map-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));

const noche = tokens(bloque(':root'));
const dia = { ...noche, ...tokens(bloque(':root[data-theme="light"]')) };

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

const contraFondo = (t, nombre) => contraste(t[`map-${nombre}`], t['map-tierra']);

test('de noche la jerarquía es una escalera: Red, autopista, avenida, calle', () => {
  const [red, autopista, avenida, calle] = ['red', 'autopista', 'avenida', 'calle'].map((n) => contraFondo(noche, n));

  assert.ok(red > autopista, `Red ${red.toFixed(2)} ≤ autopista ${autopista.toFixed(2)}`);
  assert.ok(autopista > avenida, `autopista ${autopista.toFixed(2)} ≤ avenida ${avenida.toFixed(2)}`);
  assert.ok(avenida > calle, `avenida ${avenida.toFixed(2)} ≤ calle ${calle.toFixed(2)}`);
  assert.ok(red >= 2 * autopista, `la Red (${red.toFixed(2)}) tiene que duplicar a la autopista (${autopista.toFixed(2)})`);
});

test('de día la Red es la única vía que se despega del fondo', () => {
  const red = contraFondo(dia, 'red');

  for (const via of ['autopista', 'avenida', 'calle']) {
    assert.ok(red > 2 * contraFondo(dia, via), `${via}: ${contraFondo(dia, via).toFixed(2)} contra la Red ${red.toFixed(2)}`);
  }
  assert.ok(red >= 3, `la Red de día mide ${red.toFixed(2)}`);
});

test('el cromo: el canto es más oscuro que el cuerpo, y el reflejo y el brillo más claros', () => {
  for (const [tema, t] of [['noche', noche], ['día', dia]]) {
    const l = (n) => luminancia(t[`map-${n}`]);

    assert.ok(t['map-red-canto'] && t['map-red-reflejo'] && t['map-red-brillo'], `faltan los tokens del cromo de ${tema}`);
    assert.ok(l('red-canto') < l('red'), `${tema}: canto`);
    assert.ok(l('red-reflejo') > l('red'), `${tema}: reflejo`);
    assert.ok(l('red-brillo') > l('red-reflejo'), `${tema}: brillo`);
  }

  assert.ok(contraste(noche['map-red-brillo'], noche['map-red']) >= 2, 'de noche el brillo tiene que verse sobre el cuerpo');
});
```

- [ ] **Paso 2: verlo fallar**

```bash
node --test tests/web/colores-mapa.test.mjs
```

Esperado: FAIL en los tres. El primero con `Red 3.81 ≤ autopista 4.36`; el tercero con
`faltan los tokens del cromo de noche`.

- [ ] **Paso 3: los tokens**

En `app.css`, bloque `:root` (noche), reemplazar las cuatro líneas y sumar las tres nuevas
debajo de `--map-red`:

```css
  --map-calle:         #354558;
  --map-calle-borde:   rgba(0, 0, 0, 0);   /* de noche no hay borde; de dia si */
  --map-avenida:       #3d4d61;
  --map-red:           #8fb6de;   /* la Red de Transito Pesado: el cuerpo del tubo, la via mas clara y ancha */
  --map-red-canto:     #3d5f85;   /* el borde de acero del cromo */
  --map-red-reflejo:   #cfe4f8;   /* la banda clara del cromo */
  --map-red-brillo:    #ffffff;   /* el especular, que destella */
  --map-autopista:     #4a5f7a;
```

En `:root[data-theme="light"]` (día):

```css
  --map-red:           #5b8cc4;
  --map-red-canto:     #2f5a88;
  --map-red-reflejo:   #9fc3e8;
  --map-red-brillo:    #e8f3ff;
  --map-autopista:     #f1ead6;
```

(`--map-calle` y `--map-avenida` de día quedan en `#ffffff`.) Actualizar el comentario de
la sección de día que dice *"la Red en azul acero claro y la autopista en amarillo
palido"* a: *"la Red en azul acero —la unica via saturada, con su cromo— y la autopista en
un crema apenas distinto del blanco (AD-53)"*.

- [ ] **Paso 4: verlo pasar**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 5: commit**

```bash
git add tests/web/colores-mapa.test.mjs src/TruckNavigator.Api/wwwroot/app.css
git commit -m "La Red encabeza la jerarquia del mapa; las demas vias bajan un escalon"
```

---

### Tarea 4: el cromo de la Red, en su propio módulo

**Files:**
- Modify: `wwwroot/js/mapa/estilo-mapa.js` (exportar `ancho` y `PARADAS`; `PARADAS.red`)
- Create: `wwwroot/js/mapa/red.js`
- Modify: `wwwroot/js/layers.js` (`addRedLayers`, `refreshLayerColors`, el comentario de la sección)
- Create: `tests/web/red.test.mjs`

**Interfaces:**
- Produces (`estilo-mapa.js`): `export const ancho = ([z13, z15, z17, z19], { por = 1, mas = 0 } = {}) => expresión`;
  `export const PARADAS` con `red: [6, 10, 22, 48]`.
- Produces (`red.js`):
  - `lineasDeLaRed(colores)` → arreglo de 4 especificaciones de capa `line`, ids `red-canto`,
    `red-linea`, `red-reflejo`, `red-brillo`, fuente `red`;
  - `nombreDeLaRed(colores)` → la especificación de `red-nombre`;
  - `anclaDeLaRed(existe)` → `'route-casing' | 'calles-nombre' | undefined`;
  - `BRILLO_REPOSO = 0.75`.
  - `colores` es `{ canto, cuerpo, reflejo, brillo, rotulo, halo }`.

- [ ] **Paso 1: el test que falla**

Crear `tests/web/red.test.mjs`:

```js
/**
 * La Red de Tránsito Pesado como dibujo (spec 2026-10-03-la-red-primero):
 * cuatro capas de la misma fuente que se leen como un tubo de cromo, la vía
 * más ancha del mapa, y siempre debajo de la ruta.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const { PARADAS } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js');
const { lineasDeLaRed, anclaDeLaRed } = await import('../../src/TruckNavigator.Api/wwwroot/js/mapa/red.js');

const COLORES = { canto: '#111111', cuerpo: '#222222', reflejo: '#333333', brillo: '#444444', rotulo: '#555555', halo: '#666666' };

/** Las paradas de un `interpolate` sobre el zoom: { 13: 5, 15: 10, … }. */
const paradas = (expr) => {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['exponential', 1.4], ['zoom']], 'el zoom va en el nivel superior');
  const pares = {};
  for (let i = 3; i < expr.length; i += 2) pares[expr[i]] = expr[i + 1];
  return pares;
};

const capa = (id) => lineasDeLaRed(COLORES).find((c) => c.id === id);

test('la Red es la vía más ancha del mapa en cada zoom', () => {
  assert.deepEqual(PARADAS.red, [6, 10, 22, 48]);

  for (const [clase, otra] of Object.entries(PARADAS)) {
    if (clase === 'red') continue;
    otra.forEach((px, i) => assert.ok(PARADAS.red[i] > px, `${clase} mide ${px} y la Red ${PARADAS.red[i]}`));
  }
});

test('el cromo son cuatro capas de la misma fuente, de abajo hacia arriba: canto, cuerpo, reflejo, brillo', () => {
  const capas = lineasDeLaRed(COLORES);

  assert.deepEqual(capas.map((c) => c.id), ['red-canto', 'red-linea', 'red-reflejo', 'red-brillo']);
  for (const c of capas) {
    assert.equal(c.type, 'line');
    assert.equal(c.source, 'red');
  }
  assert.deepEqual(capas.map((c) => c.paint['line-color']), ['#111111', '#222222', '#333333', '#444444']);
});

test('el canto rodea al cuerpo por 3 px; el reflejo y el brillo son una fracción del cuerpo', () => {
  const cuerpo = paradas(capa('red-linea').paint['line-width']);
  const canto = paradas(capa('red-canto').paint['line-width']);
  const reflejo = paradas(capa('red-reflejo').paint['line-width']);
  const brillo = paradas(capa('red-brillo').paint['line-width']);

  assert.deepEqual(cuerpo, { 13: 6, 15: 10, 17: 22, 19: 48 });
  for (const z of [13, 15, 17, 19]) {
    assert.equal(canto[z], cuerpo[z] + 3);
    assert.ok(Math.abs(reflejo[z] - cuerpo[z] * 0.55) < 1e-9);
    assert.ok(Math.abs(brillo[z] - cuerpo[z] * 0.18) < 1e-9);
  }
  assert.equal(capa('red-reflejo').paint['line-opacity'], 0.55);
});

test('el brillo va centrado: ninguna capa de la Red se corre de su eje', () => {
  // Con line-offset el especular quedaría a la izquierda del sentido de cada
  // tramo, y como los tramos van en sentidos distintos saltaría de borde a borde.
  for (const c of lineasDeLaRed(COLORES)) assert.equal(c.paint['line-offset'], undefined, c.id);
});

test('la Red se apila debajo de la ruta si hay ruta, y si no debajo de los nombres de calle', () => {
  assert.equal(anclaDeLaRed((id) => ['route-casing', 'calles-nombre'].includes(id)), 'route-casing');
  assert.equal(anclaDeLaRed((id) => id === 'calles-nombre'), 'calles-nombre');
  // El raster de respaldo no tiene ninguna de las dos: va arriba de todo.
  assert.equal(anclaDeLaRed(() => false), undefined);
});
```

- [ ] **Paso 2: verlo fallar**

```bash
node --test tests/web/red.test.mjs
```

Esperado: FAIL al importar `red.js` (`Cannot find module`).

- [ ] **Paso 3: exportar los anchos y sumar la Red**

En `estilo-mapa.js`:

```js
export const ancho = ([z13, z15, z17, z19], { por = 1, mas = 0 } = {}) =>
  ['interpolate', ['exponential', 1.4], ['zoom'],
    13, z13 * por + mas, 15, z15 * por + mas, 17, z17 * por + mas, 19, z19 * por + mas];

export const PARADAS = {
  calle: [1, 2.6, 10, 26],
  avenida: [2.2, 4.5, 12, 30],
  principal: [3, 6, 14, 34],
  autopista: [5, 8, 16, 38],
  sendero: [0.4, 0.8, 2, 4],
  ferrocarril: [1.2, 2, 4, 8],
  // La Red de Transito Pesado (la pinta red.js): la via mas ancha en todo zoom.
  red: [6, 10, 22, 48]
};

const ANCHO = Object.fromEntries(Object.entries(PARADAS).map(([k, p]) => [k, ancho(p)]));
```

(`ANCHO.red` queda sin uso en el estilo base: no molesta y evita filtrar claves.)

- [ ] **Paso 4: el módulo de la Red**

Crear `wwwroot/js/mapa/red.js`:

```js
/**
 * La Red de Transito Pesado como dibujo (AD-53, spec 2026-10-03-la-red-primero).
 *
 * La Red es la via que manda en el mapa: siempre visible, la mas ancha y la mas
 * clara. Se pinta como un tubo de cromo —el metal se lee por la curva del
 * brillo, no por el color—: cuatro capas de la misma fuente, de abajo hacia
 * arriba un canto oscuro, el cuerpo, una banda clara y un especular angosto en
 * el centro, que destella despacio.
 *
 * Todo lo de aca es puro y esta probado en tests/web/red.test.mjs; layers.js lo
 * instala en el mapa.
 */

import { ancho, PARADAS } from './estilo-mapa.js';

/** La opacidad del brillo cuando no destella (y el punto medio del destello). */
export const BRILLO_REPOSO = 0.75;

const linea = (id, color, width, extra = {}) => ({
  id,
  type: 'line',
  source: 'red',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': color, 'line-width': width, ...extra }
});

/**
 * Las cuatro capas del cromo, en el orden en que se apilan.
 *
 * El brillo va CENTRADO, sin line-offset: los tramos de OSM y las dos manos de
 * una avenida van en sentidos distintos, y un especular corrido saltaria de un
 * borde al otro de tramo en tramo.
 *
 * @param {{canto: string, cuerpo: string, reflejo: string, brillo: string}} c
 */
export function lineasDeLaRed(c) {
  return [
    linea('red-canto', c.canto, ancho(PARADAS.red, { mas: 3 })),
    linea('red-linea', c.cuerpo, ancho(PARADAS.red)),
    linea('red-reflejo', c.reflejo, ancho(PARADAS.red, { por: 0.55 }), { 'line-opacity': 0.55 }),
    linea('red-brillo', c.brillo, ancho(PARADAS.red, { por: 0.18 }), { 'line-opacity': BRILLO_REPOSO })
  ];
}

/**
 * El nombre de la avenida, en mayusculas y negrita sobre el tubo.
 *
 * @param {{rotulo: string, halo: string}} c
 */
export function nombreDeLaRed(c) {
  return {
    id: 'red-nombre',
    type: 'symbol',
    source: 'red',
    // Sin nombre no hay nada que mostrar, y la linea ya la dibujan las de arriba.
    filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], null]],
    minzoom: 13,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.1,
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 10.5, 18, 12],
      'text-font': ['NotoSans-Bold'],
      // Se repite a lo largo de la avenida: sirve de referencia en cualquier
      // punto, no solo donde arranca el tramo.
      'symbol-spacing': 320,
      'text-max-angle': 35,
      'text-allow-overlap': false,
      'text-padding': 6
    },
    paint: {
      'text-color': c.rotulo,
      'text-halo-color': c.halo,
      'text-halo-width': 1.6
    }
  };
}

/**
 * Antes de que capa se apilan las lineas de la Red.
 *
 * Siempre DEBAJO de la ruta: la ruta manda. El orden no puede depender de quien
 * se instalo primero, porque createMap reinstala las capas en cada 'style.load'
 * y una Red reinstalada con la ruta ya dibujada quedaria encima. Sin ruta, debajo
 * de los nombres de calle; en el raster de respaldo no hay ninguna de las dos y
 * va arriba de todo, que es lo unico posible.
 *
 * @param {(id: string) => boolean} existe
 */
export function anclaDeLaRed(existe) {
  return ['route-casing', 'calles-nombre'].find((id) => existe(id));
}
```

(La Tarea 6 cambia los tamaños y el halo de `nombreDeLaRed` con su propio test; acá se
mudan tal como están hoy.)

- [ ] **Paso 5: `layers.js` instala lo de `red.js`**

Agregar el import arriba de `layers.js`:

```js
import { lineasDeLaRed, nombreDeLaRed, anclaDeLaRed } from './mapa/red.js';
```

Reemplazar el comentario de la sección "Red de Transito Pesado" y `addRedLayers` entera:

```js
/* ---------------------------------------------------------------------------
   Red de Transito Pesado

   La via que manda en el mapa (AD-53): siempre visible, la mas ancha y la mas
   clara, pintada como un tubo de cromo. El dibujo vive en mapa/red.js; aca
   solo se instala. Antes (AD-48) era una linea gris apenas perceptible con el
   nombre como protagonista, y en la calle se perdia entre las avenidas.
--------------------------------------------------------------------------- */

const coloresDeLaRed = () => ({
  canto: token('--map-red-canto'),
  cuerpo: token('--map-red'),
  reflejo: token('--map-red-reflejo'),
  brillo: token('--map-red-brillo'),
  rotulo: token('--map-rotulo-red'),
  halo: token('--map-halo')
});

function addRedLayers(map) {
  if (!map.getSource('red') || map.getLayer('red-linea')) return;

  const colores = coloresDeLaRed();
  const ancla = anclaDeLaRed((id) => Boolean(map.getLayer(id)));

  // Cada una se agrega antes del ancla, asi que quedan en el orden del arreglo.
  for (const capa of lineasDeLaRed(colores)) map.addLayer(capa, ancla);
  map.addLayer(nombreDeLaRed(colores));
}
```

En `GRUPOS`, `red` pasa a listar las cuatro líneas (la Tarea 5 lo saca entero):

```js
  red: ['red-canto', 'red-linea', 'red-reflejo', 'red-brillo', 'red-nombre'],
```

En `refreshLayerColors`, reemplazar el bloque de `red-linea` por:

```js
  const colores = coloresDeLaRed();
  for (const capa of lineasDeLaRed(colores)) {
    if (map.getLayer(capa.id)) map.setPaintProperty(capa.id, 'line-color', capa.paint['line-color']);
  }
```

- [ ] **Paso 6: verlo pasar**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 7: mirarlo en el navegador**

Recargar la app (preview `api`), ir a la Juan B. Justo a zoom 17 y leer la consola con
`read_console_messages` filtrando `Mapa:`: **ninguna línea**. Después:

```js
tnMap.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('red-') || id.startsWith('route-') || id === 'calles-nombre')
```

Esperado sin ruta: `red-canto, red-linea, red-reflejo, red-brillo, calles-nombre, red-nombre`.

- [ ] **Paso 8: commit**

```bash
git add tests/web/red.test.mjs src/TruckNavigator.Api/wwwroot/js/mapa/red.js src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js src/TruckNavigator.Api/wwwroot/js/layers.js
git commit -m "La Red como tubo de cromo: cuatro capas, la via mas ancha, siempre debajo de la ruta"
```

---

### Tarea 5: la Red siempre visible

**Files:**
- Modify: `wwwroot/js/layers.js` (`GRUPOS`, `visibles`, comentario de `applyLayerGroups`)
- Modify: `wwwroot/js/mapa/capas.js` (`CAPAS_DEL_CAMION`, `capasActivas`)
- Create: `tests/web/layers.test.mjs`
- Modify: `tests/web/capas.test.mjs`

**Interfaces:**
- Produces: `capasActivas(prefs)` → `{ galibo, paso, radar, zona, reporte }` (sin `red`);
  `CAPAS_DEL_CAMION` con 5 entradas.

- [ ] **Paso 1: los tests que fallan**

Crear `tests/web/layers.test.mjs`:

```js
/**
 * La Red de Tránsito Pesado no se apaga (AD-53): es la referencia permanente
 * del mapa. Ni la hoja de capas ni una preferencia guardada de antes —con la
 * Red apagada desde el cuadro o desde el botón viejo de "capas de camión"— la
 * pueden esconder; las demás capas siguen respetando lo elegido.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLayerGroups, setLayerGroupVisible } from '../../src/TruckNavigator.Api/wwwroot/js/layers.js';

function mapaDePrueba() {
  const llamadas = [];
  return {
    llamadas,
    getLayer: () => true,
    setLayoutProperty: (id, propiedad, valor) => llamadas.push([id, propiedad, valor])
  };
}

test('la hoja de capas con la Red apagada no la esconde, y las demás capas sí obedecen', () => {
  const map = mapaDePrueba();

  applyLayerGroups(map, { red: false, galibo: false });

  assert.deepEqual(map.llamadas.filter(([id]) => id.startsWith('red-')), []);
  assert.ok(map.llamadas.some(([id, , valor]) => id === 'altura-senal' && valor === 'none'));
});

test('pedir que se apague la Red no hace nada', () => {
  const map = mapaDePrueba();

  setLayerGroupVisible(map, 'red', false);

  assert.deepEqual(map.llamadas, []);
});
```

En `tests/web/capas.test.mjs`, reemplazar los cuatro primeros tests y ajustar los de la
hoja:

```js
test('las cinco capas del camión, con su calcomanía; la Red no está porque no se apaga', () => {
  assert.deepEqual(CAPAS_DEL_CAMION.map((c) => c.id), ['galibo', 'paso', 'radar', 'zona', 'reporte']);
  for (const c of CAPAS_DEL_CAMION) assert.ok(c.calcomania && c.nombre, c.id);
  assert.equal(CAPAS_DEL_CAMION.find((c) => c.id === 'paso').nota, 'sólo en viaje');
  assert.equal(CAPAS_DEL_CAMION.find((c) => c.id === 'zona').nota, 'comunidad');
  assert.equal(CAPAS_DEL_CAMION.find((c) => c.id === 'reporte').nota, 'comunidad');
});

test('sin nada guardado: todo prendido salvo las zonas peligrosas, que arrancan apagadas; los reportes prendidos', () => {
  assert.deepEqual(capasActivas({}), { galibo: true, paso: true, radar: true, zona: false, reporte: true });
});

test('lo guardado con los dos botones viejos se respeta: capas de camión apagadas, zonas prendidas', () => {
  assert.deepEqual(capasActivas({ truckLayers: false, riskZones: true }), { galibo: false, paso: false, radar: true, zona: true, reporte: true });
});

test('lo guardado por capa manda sobre lo viejo, y lo que falta cae en el defecto', () => {
  assert.deepEqual(capasActivas({ truckLayers: false, capas: { galibo: false, zona: true } }), { galibo: false, paso: true, radar: true, zona: true, reporte: true });
});

test('una Red apagada guardada antes de AD-53 se ignora: la Red no es una preferencia', () => {
  assert.equal('red' in capasActivas({ capas: { red: false } }), false);
  assert.equal('red' in capasActivas({ truckLayers: false }), false);
});
```

En el test `'la hoja: un cuadro por capa y por categoría, …'`: el estado pasa a
`capas: { galibo: false, paso: true, radar: true, zona: false }`, el conteo de cuadros a
`assert.equal(cuadros.length, 5);`, y las líneas de `red`/`galibo` se cambian por:

```js
  assert.ok(!html.includes('data-id="red"'), 'la Red no tiene cuadro');
  const paso = html.match(/<button[^>]*data-id="paso"[^>]*>/)[0];
  const galibo = html.match(/<button[^>]*data-id="galibo"[^>]*>/)[0];
  const gomeria = html.match(/<button[^>]*data-accion="categoria" data-id="gomeria"[^>]*>/)[0];
  const taller = html.match(/<button[^>]*data-accion="categoria" data-id="taller"[^>]*>/)[0];
  assert.ok(paso.includes('is-on') && !galibo.includes('is-on'));
  assert.ok(gomeria.includes('is-on') && !taller.includes('is-on'));
```

- [ ] **Paso 2: verlos fallar**

```bash
node --test tests/web/layers.test.mjs tests/web/capas.test.mjs
```

Esperado: FAIL en los dos de `layers.test.mjs` (aparecen `red-canto … none`) y en los de
`capas.test.mjs` que miran `red`.

- [ ] **Paso 3: sacar la Red de los grupos**

En `layers.js`:

```js
/**
 * Las capas que se prenden y apagan desde la hoja de capas, por grupo: cada
 * cuadro de la hoja es uno de estos. Antes habia dos botones —"capas de
 * camion" y "zonas"— y los radares no se apagaban; ahora cada dato va solo.
 *
 * La Red NO esta: es la referencia permanente del mapa y no se apaga (AD-53).
 * Lo que llegue para ella —un cuadro viejo, una preferencia guardada antes— se
 * ignora porque solo se recorren estas claves.
 *
 * Los pasos a nivel dependen de DOS cosas a la vez: de su cuadro y ademas de
 * que haya un viaje en curso. Se guardan los dos estados por separado porque
 * cada uno llega por su lado y ninguno sabe del otro; si el bucle generico
 * los tocara, prender la capa los haria aparecer fuera del viaje.
 */
const GRUPOS = {
  galibo: ['altura-senal'],
  paso: ['paso-senal'],
  radar: ['radar-punto'],
  zona: ['zona-riesgo-calor', 'zona-riesgo', 'zona-riesgo-senal'],
  reporte: ['reporte-pin']
};

/** Lo ultimo que se pidio para cada grupo: se vuelve a aplicar al reinstalar. */
const visibles = { galibo: true, paso: true, radar: true, zona: false, reporte: true };
```

Y el comentario de `applyLayerGroups`:
`/** Aplica de una vez lo que dice la hoja de capas: { galibo, paso, radar, zona, reporte }. */`

- [ ] **Paso 4: sacar el cuadro**

En `capas.js`, borrar la entrada `{ id: 'red', … }` de `CAPAS_DEL_CAMION` y reemplazar
`capasActivas`:

```js
/**
 * Que capas estan prendidas segun lo guardado.
 *
 * Todo arranca prendido salvo las zonas peligrosas: son un dato de la
 * comunidad, cubren area y no hacen falta para manejar. Lo que se guardo con
 * los dos botones viejos (`truckLayers`, `riskZones`) se respeta hasta que
 * se toque una capa por separado.
 *
 * La Red no esta: no se apaga (AD-53). Una `red` guardada antes se descarta.
 */
export function capasActivas(prefs = {}) {
  // Los reportes arrancan prendidos: son lo que hay ahora en la calle.
  const defecto = { galibo: true, paso: true, radar: true, zona: false, reporte: true };

  if (prefs.capas) {
    const { red, ...guardadas } = prefs.capas;
    return { ...defecto, ...guardadas };
  }

  const camion = prefs.truckLayers ?? true;
  return { ...defecto, galibo: camion, paso: camion, zona: prefs.riskZones ?? false };
}
```

`red` queda sin usar: renombrar a `red: _red` si el editor lo marca, o dejarlo; no hay
linter.

- [ ] **Paso 5: verlo pasar**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 6: mirarlo en el navegador**

Recargar, abrir la hoja de capas: cinco cuadros arriba, ninguno de la Red. Con
`localStorage` guardando `capas.red = false` de antes (si la app guarda prefs ahí;
`js/store.js`), recargar: la Red se ve igual.

- [ ] **Paso 7: commit**

```bash
git add tests/web/layers.test.mjs tests/web/capas.test.mjs src/TruckNavigator.Api/wwwroot/js/layers.js src/TruckNavigator.Api/wwwroot/js/mapa/capas.js
git commit -m "La Red siempre visible: sale su cuadro de la hoja y lo guardado no la apaga"
```

---

### Tarea 6: los nombres crecen con el zoom, y uno solo por calle

**Files:**
- Modify: `wwwroot/js/mapa/estilo-mapa.js` (filtros a nivel de módulo, `filtroCallesNombre`, `text-size` de `calles-nombre`)
- Modify: `wwwroot/js/mapa/red.js` (`nombreDeLaRed`: tamaños y halo; `nombresDeLaRed`)
- Modify: `wwwroot/js/layers.js` (aplicar el filtro al instalar)
- Test: `tests/web/red.test.mjs`, `tests/web/estilo-mapa.test.mjs`

**Interfaces:**
- Produces: `filtroCallesNombre(nombresDeLaRed = [])` → expresión de filtro (estilo-mapa.js);
  `nombresDeLaRed(geojson)` → `string[]` sin repetidos, ordenado, sin vacíos (red.js).

- [ ] **Paso 1: los tests que fallan**

En `tests/web/red.test.mjs`: arriba de todo, **antes** de los imports, el documento de
mentira (el estilo base lee tokens con `getComputedStyle`); el import de `red.js` pasa a
`const { lineasDeLaRed, nombreDeLaRed, anclaDeLaRed, nombresDeLaRed } = await import(…);`
y el de `estilo-mapa.js` a
`const { PARADAS, buildBasemapStyle, filtroCallesNombre } = await import(…);`
(uno solo, no dos). Después, agregar:

```js
globalThis.document = { documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#123456' });
```

```js
/** El valor de un `interpolate` lineal sobre el zoom, como lo calcula MapLibre (con tope en las puntas). */
function valorEn(expr, z) {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['linear'], ['zoom']]);
  const p = [];
  for (let i = 3; i < expr.length; i += 2) p.push([expr[i], expr[i + 1]]);
  if (z <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [z0, v0] = p[i - 1];
    const [z1, v1] = p[i];
    if (z <= z1) return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
  }
  return p.at(-1)[1];
}

const callesNombre = () => buildBasemapStyle('').layers.find((l) => l.id === 'calles-nombre');

test('los nombres crecen hasta el zoom 19, y los de la Red nunca son más chicos que los de una calle', () => {
  const calles = callesNombre().layout['text-size'];
  const red = nombreDeLaRed(COLORES).layout['text-size'];

  assert.equal(valorEn(calles, 14), 10);
  assert.equal(valorEn(calles, 19), 15);
  assert.equal(valorEn(red, 13), 10);
  assert.equal(valorEn(red, 19), 18);

  for (let z = 14; z <= 19; z += 0.25) {
    assert.ok(valorEn(red, z) > valorEn(calles, z), `zoom ${z}: Red ${valorEn(red, z)}, calle ${valorEn(calles, z)}`);
  }
});

test('el nombre de la Red se lee sobre el tubo: negrita, mayúsculas y halo de 2', () => {
  const nombre = nombreDeLaRed(COLORES);

  assert.equal(nombre.paint['text-halo-width'], 2);
  assert.equal(nombre.paint['text-halo-color'], COLORES.halo);
  assert.deepEqual(nombre.layout['text-font'], ['NotoSans-Bold']);
  assert.equal(nombre.layout['text-transform'], 'uppercase');
});

test('los nombres de la Red: sin repetir, sin vacíos y en orden', () => {
  const geojson = {
    features: [
      { properties: { name: 'Avenida Juan Bautista Justo' } },
      { properties: { name: 'Avenida General Paz' } },
      { properties: { name: 'Avenida Juan Bautista Justo' } },
      { properties: { name: null } },
      { properties: {} },
      { properties: { name: '' } }
    ]
  };

  assert.deepEqual(nombresDeLaRed(geojson), ['Avenida General Paz', 'Avenida Juan Bautista Justo']);
  assert.deepEqual(nombresDeLaRed(null), []);
});

test('una calle de la Red tiene un solo nombre: el del mapa base se filtra', () => {
  const sinRed = filtroCallesNombre([]);
  const conRed = filtroCallesNombre(['Avenida General Paz']);

  // Sin nombres de la Red, el filtro es el de siempre, el que trae el estilo.
  assert.deepEqual(callesNombre().filter, sinRed);
  // Con nombres, el mismo filtro y además "el name no está en la lista".
  assert.deepEqual(conRed, ['all', sinRed, ['!', ['in', ['get', 'name'], ['literal', ['Avenida General Paz']]]]]);
});
```

- [ ] **Paso 2: verlos fallar**

```bash
node --test tests/web/red.test.mjs
```

Esperado: FAIL — `filtroCallesNombre` y `nombresDeLaRed` no existen; los tamaños no
coinciden.

- [ ] **Paso 3: el filtro de `calles-nombre`**

En `estilo-mapa.js`, mover los filtros de clase **fuera** de `buildBasemapStyle` (son
constantes, no leen tokens), justo antes de su JSDoc:

```js
const esAutopista = ['==', ['get', 'kind'], 'highway'];
const esPrincipal = ['all', ['==', ['get', 'kind'], 'major_road'], esDetalle(['primary', 'primary_link', 'trunk', 'trunk_link'])];
const esAvenida = ['all', ['==', ['get', 'kind'], 'major_road'], esDetalle(['secondary', 'secondary_link', 'tertiary', 'tertiary_link'])];
const esCalle = ['==', ['get', 'kind'], 'minor_road'];
const esSendero = ['==', ['get', 'kind'], 'path'];
const esFerrocarril = ['all', ['==', ['get', 'kind'], 'rail'], esDetalle(['rail'])];

/**
 * Que nombres de calle dibuja el mapa base.
 *
 * Una avenida de la Red salia dos veces: en mayusculas desde la capa de la Red
 * y en minusculas desde aca. Con la lista de nombres de la Red, este filtro deja
 * afuera los suyos (por igualdad exacta del `name` de OSM, que es el mismo en
 * los dos lados). La lista llega cuando se descarga la Red; hasta entonces van
 * todos.
 *
 * @param {string[]} nombresDeLaRed
 */
export function filtroCallesNombre(nombresDeLaRed = []) {
  const deUnaVia = ['any', esCalle, esAvenida, esPrincipal, esAutopista];
  if (!nombresDeLaRed.length) return deUnaVia;

  return ['all', deUnaVia, ['!', ['in', ['get', 'name'], ['literal', nombresDeLaRed]]]];
}
```

Y en la capa `calles-nombre`:

```js
        filter: filtroCallesNombre(),
        layout: {
          'symbol-placement': 'line',
          'text-field': NOMBRE,
          'text-font': ['NotoSans-Regular'],
          // 12 sp en 16 (waze-03), y siguen creciendo al acercarse: congelados en
          // 12 desde el zoom 16 no se leian con el mapa a 19 (AD-53).
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 12, 18, 14, 19, 15],
```

- [ ] **Paso 4: el nombre de la Red y la lista**

En `red.js`, en `nombreDeLaRed`:

```js
      // Siempre un escalon arriba de los nombres de calle (estilo-mapa.js), y
      // creciendo hasta el zoom 19 (AD-53).
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 15, 11.5, 16, 13, 18, 16, 19, 18],
```

```js
    paint: {
      'text-color': c.rotulo,
      'text-halo-color': c.halo,
      // Mas ancho que el de una calle: el nombre va encima del tubo claro.
      'text-halo-width': 2
    }
```

Y al final del archivo:

```js
/**
 * Los nombres de las calles de la Red, sin repetir, para que el mapa base no
 * los dibuje una segunda vez (`filtroCallesNombre`).
 *
 * @param {{features: {properties: {name?: string|null}}[]}|null} geojson
 */
export function nombresDeLaRed(geojson) {
  const nombres = new Set();
  for (const f of geojson?.features ?? []) {
    const nombre = f.properties?.name;
    if (nombre) nombres.add(nombre);
  }
  return [...nombres].sort();
}
```

- [ ] **Paso 5: aplicarlo al instalar**

En `layers.js`, sumar `nombresDeLaRed` al import de `./mapa/red.js` y
`import { filtroCallesNombre } from './mapa/estilo-mapa.js';`. En `installTruckLayers`,
después del bucle que instala las capas y antes de aplicar los grupos:

```js
  // Una calle de la Red lleva un solo nombre: el de la Red. Se aplica en cada
  // instalacion porque un estilo nuevo trae calles-nombre sin filtrar.
  if (descargados.red && map.getLayer('calles-nombre')) {
    try {
      map.setFilter('calles-nombre', filtroCallesNombre(nombresDeLaRed(descargados.red)));
    } catch (error) {
      console.error(`No se pudo filtrar los nombres de la Red: ${error.message}`);
    }
  }
```

- [ ] **Paso 6: verlo pasar**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 7: mirarlo en el navegador**

Recargar; consola sin `Mapa:`. Comprobar que MapLibre aceptó el filtro:

```js
JSON.stringify(tnMap.getFilter('calles-nombre')).slice(0, 120)
```

Esperado: empieza con `["all",["any",…` y tiene `"literal"`. En la Juan B. Justo a zoom
17, el nombre de la avenida sale **una** vez, en mayúsculas.

- [ ] **Paso 8: commit**

```bash
git add tests/web/red.test.mjs src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js src/TruckNavigator.Api/wwwroot/js/mapa/red.js src/TruckNavigator.Api/wwwroot/js/layers.js
git commit -m "Los nombres crecen con el zoom, los de la Red un escalon arriba y una sola vez"
```

---

### Tarea 7: el destello

**Files:**
- Modify: `wwwroot/js/mapa/red.js` (`opacidadDelBrillo`, `destello` y sus constantes)
- Modify: `wwwroot/js/layers.js` (`encenderDestello`, la medición)
- Test: `tests/web/red.test.mjs`

**Interfaces:**
- Produces: `CICLO_DESTELLO_MS = 2500`, `LATIDO_DESTELLO_MS = 100`, `BRILLO_MIN = 0.55`,
  `BRILLO_MAX = 0.95`; `opacidadDelBrillo(ms)` → número;
  `destello({ aplicar, quieto = false, ahora, cada, parar, documento })` → función que lo apaga.

- [ ] **Paso 1: los tests que fallan**

Sumar al import de `red.js` en `tests/web/red.test.mjs`:
`opacidadDelBrillo, destello, CICLO_DESTELLO_MS, LATIDO_DESTELLO_MS, BRILLO_REPOSO`, y
agregar:

```js
test('el brillo va de 0,55 a 0,95 y vuelve en 2,5 s', () => {
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;

  assert.equal(CICLO_DESTELLO_MS, 2500);
  assert.ok(cerca(opacidadDelBrillo(0), 0.55));
  assert.ok(cerca(opacidadDelBrillo(1250), 0.95));
  assert.ok(cerca(opacidadDelBrillo(2500), 0.55));
  assert.ok(cerca(opacidadDelBrillo(625), BRILLO_REPOSO));

  for (let ms = 0; ms < 10_000; ms += 37) {
    const o = opacidadDelBrillo(ms);
    assert.ok(o >= 0.55 - 1e-9 && o <= 0.95 + 1e-9, `${ms} ms: ${o}`);
  }
});

/** Un documento y un reloj de mentira para el destello. */
function escenario({ oculto = false } = {}) {
  const oyentes = new Set();
  const intervalos = new Map();
  let siguiente = 1;
  const aplicados = [];

  const documento = {
    hidden: oculto,
    addEventListener: (tipo, fn) => tipo === 'visibilitychange' && oyentes.add(fn),
    removeEventListener: (tipo, fn) => oyentes.delete(fn)
  };

  return {
    aplicados,
    intervalos,
    oyentes,
    documento,
    cambiar(hidden) {
      documento.hidden = hidden;
      for (const fn of oyentes) fn();
    },
    opciones: {
      aplicar: (o) => aplicados.push(o),
      ahora: () => 1250,
      cada: (fn, ms) => { const id = siguiente++; intervalos.set(id, { fn, ms }); return id; },
      parar: (id) => intervalos.delete(id),
      documento
    }
  };
}

test('el destello late a 10 Hz con la página a la vista', () => {
  const e = escenario();

  destello(e.opciones);

  assert.equal(LATIDO_DESTELLO_MS, 100);
  assert.deepEqual([...e.intervalos.values()].map((i) => i.ms), [100]);
  // Late una vez al arrancar, sin esperar el primer intervalo.
  assert.equal(e.aplicados.length, 1);
  assert.ok(Math.abs(e.aplicados[0] - 0.95) < 1e-9, `${e.aplicados[0]}`);
});

test('en segundo plano se frena, y vuelve al volver', () => {
  const e = escenario();
  destello(e.opciones);

  e.cambiar(true);
  assert.equal(e.intervalos.size, 0);

  e.cambiar(false);
  assert.equal(e.intervalos.size, 1);
});

test('si arranca con la página oculta, no late hasta que se vea', () => {
  const e = escenario({ oculto: true });

  destello(e.opciones);

  assert.equal(e.intervalos.size, 0);
  assert.deepEqual(e.aplicados, []);
});

test('apagarlo frena el latido y suelta al documento', () => {
  const e = escenario();
  const apagar = destello(e.opciones);

  apagar();

  assert.equal(e.intervalos.size, 0);
  assert.equal(e.oyentes.size, 0);
});

test('con movimiento reducido el brillo queda quieto en su punto medio', () => {
  const e = escenario();

  destello({ ...e.opciones, quieto: true });

  assert.equal(e.intervalos.size, 0);
  assert.deepEqual(e.aplicados, [BRILLO_REPOSO]);
});
```

- [ ] **Paso 2: verlos fallar**

```bash
node --test tests/web/red.test.mjs
```

Esperado: FAIL — `opacidadDelBrillo is not a function`.

- [ ] **Paso 3: el destello**

En `red.js`, debajo de `BRILLO_REPOSO`:

```js
/** El destello del brillo: va y viene entre estas opacidades. */
export const BRILLO_MIN = 0.55;
export const BRILLO_MAX = 0.95;

/** Cuanto tarda en ir y volver. */
export const CICLO_DESTELLO_MS = 2500;

/**
 * Cada cuanto se actualiza: 10 veces por segundo, no en cada cuadro. Es un solo
 * valor por capa —lo mas barato que permite MapLibre— y si en el telefono
 * cuesta, se baja a 200 (spec §3.3).
 */
export const LATIDO_DESTELLO_MS = 100;

/** La opacidad del brillo en el instante `ms`: una curva coseno, de 0,55 a 0,95 y de vuelta. */
export function opacidadDelBrillo(ms) {
  const fase = (ms % CICLO_DESTELLO_MS) / CICLO_DESTELLO_MS;
  return BRILLO_REPOSO - ((BRILLO_MAX - BRILLO_MIN) / 2) * Math.cos(2 * Math.PI * fase);
}

/**
 * Hace destellar el brillo de la Red. Devuelve la funcion que lo apaga.
 *
 * Late solo con la pagina a la vista: en segundo plano no hay nadie mirando y
 * cada latido es un redibujo del mapa. Con movimiento reducido no late; el
 * brillo queda en su punto medio.
 *
 * El reloj y el documento se inyectan para poder probarlo sin navegador.
 *
 * @param {{aplicar: (opacidad: number) => void, quieto?: boolean}} opciones
 */
export function destello({
  aplicar,
  quieto = false,
  ahora = () => performance.now(),
  cada = (fn, ms) => setInterval(fn, ms),
  parar = (id) => clearInterval(id),
  documento = globalThis.document
}) {
  if (quieto) {
    aplicar(BRILLO_REPOSO);
    return () => {};
  }

  let latido = null;
  const latir = () => aplicar(opacidadDelBrillo(ahora()));

  const arrancar = () => {
    if (latido !== null) return;
    latir();
    latido = cada(latir, LATIDO_DESTELLO_MS);
  };

  const frenar = () => {
    if (latido === null) return;
    parar(latido);
    latido = null;
  };

  const alCambiar = () => (documento?.hidden ? frenar() : arrancar());

  documento?.addEventListener?.('visibilitychange', alCambiar);
  if (!documento?.hidden) arrancar();

  return () => {
    frenar();
    documento?.removeEventListener?.('visibilitychange', alCambiar);
  };
}
```

- [ ] **Paso 4: verlo pasar**

```bash
node --test tests/web/red.test.mjs
```

Esperado: PASS.

- [ ] **Paso 5: encenderlo en el mapa, con su medición**

En `layers.js`, sumar `destello` al import de `./mapa/red.js` y, debajo de
`addRedLayers`:

```js
/** Un destello por mapa: se apaga cuando el mapa se destruye. */
const destellos = new WeakMap();

/**
 * Enciende el destello del brillo de la Red, una vez por mapa.
 *
 * Deja ademas UNA linea en la consola —en el telefono, `adb logcat -s Web`— al
 * minuto de arrancar: cuanto tarda cada latido y cuanto se separan los cuadros
 * del mapa. Es la medicion que pide la spec (§3.3) antes de dar el destello por
 * bueno, y sirve igual despues si el mapa se traba.
 */
function encenderDestello(map) {
  if (destellos.has(map)) return;

  const medicion = { latidos: 0, total: 0, maximo: 0, cuadros: 0, hueco: 0, ultimo: null };
  const desde = performance.now();

  const contarCuadro = () => {
    const ahora = performance.now();
    if (medicion.ultimo !== null) medicion.hueco = Math.max(medicion.hueco, ahora - medicion.ultimo);
    medicion.ultimo = ahora;
    medicion.cuadros++;
  };
  map.on('render', contarCuadro);

  const quieto = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const apagar = destello({
    quieto,
    aplicar: (opacidad) => {
      if (!map.getLayer('red-brillo')) return;

      const t0 = performance.now();
      map.setPaintProperty('red-brillo', 'line-opacity', opacidad);
      const costo = performance.now() - t0;

      medicion.latidos++;
      medicion.total += costo;
      medicion.maximo = Math.max(medicion.maximo, costo);

      if (medicion.latidos === 600) {
        map.off('render', contarCuadro);
        const segundos = (performance.now() - desde) / 1000;
        console.info(
          `Destello: ${medicion.latidos} latidos en ${segundos.toFixed(0)} s, ` +
          `cada uno ${(medicion.total / medicion.latidos).toFixed(2)} ms (max ${medicion.maximo.toFixed(2)}); ` +
          `el mapa dibujo ${medicion.cuadros} cuadros, el hueco mas largo ${medicion.hueco.toFixed(0)} ms`);
      }
    }
  });

  destellos.set(map, apagar);
  map.once('remove', () => {
    apagar();
    map.off('render', contarCuadro);
    destellos.delete(map);
  });
}
```

Y al final de `addRedLayers`: `encenderDestello(map);`.

- [ ] **Paso 6: todo en verde**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 7: mirarlo en el navegador**

Recargar con el panel visible. A zoom 18 sobre la Juan B. Justo, dos fotos con un segundo
de diferencia: el centro del tubo cambia de intensidad. Al minuto, `read_console_messages`
con `pattern: "Destello"` muestra la línea de medición. Lo de frenarse en segundo plano
no se puede forzar desde el navegador (`document.hidden` es de sólo lectura): lo cubren los
tests del Paso 1.

- [ ] **Paso 8: commit**

```bash
git add tests/web/red.test.mjs src/TruckNavigator.Api/wwwroot/js/mapa/red.js src/TruckNavigator.Api/wwwroot/js/layers.js
git commit -m "El brillo de la Red destella a 10 Hz, quieto en segundo plano, y deja su medicion"
```

---

### Tarea 8: la ruta pinta la calle

**Files:**
- Modify: `wwwroot/js/mapa/estilo-mapa.js` (`PARADAS.ruta`, `ANCHO_DE_RUTA`, `TAMANO_DE_PUNTA`)
- Modify: `wwwroot/js/map.js` (`ROUTE_WIDTH`/`ROUTE_CASING` salen; ruta, acceso, flecha y punta)
- Test: `tests/web/estilo-mapa.test.mjs`

**Interfaces:**
- Produces: `PARADAS.ruta = [4, 7, 14, 30]`;
  `ANCHO_DE_RUTA = { linea, canto, flecha, flechaCanto }` (expresiones);
  `TAMANO_DE_PUNTA` (expresión para `icon-size`).

- [ ] **Paso 1: el test que falla**

En `tests/web/estilo-mapa.test.mjs`, cambiar el import a
`const { buildBasemapStyle, PARADAS, ANCHO_DE_RUTA, TAMANO_DE_PUNTA } = await import(…);`
y agregar:

```js
const paradas = (expr) => {
  assert.deepEqual(expr.slice(0, 3), ['interpolate', ['exponential', 1.4], ['zoom']], 'el zoom va en el nivel superior');
  const pares = {};
  for (let i = 3; i < expr.length; i += 2) pares[expr[i]] = expr[i + 1];
  return pares;
};

test('la ruta crece con el zoom como las calles: no tapa a las vecinas de lejos ni flota de cerca', () => {
  assert.deepEqual(paradas(ANCHO_DE_RUTA.linea), { 13: 4, 15: 7, 17: 14, 19: 30 });
  assert.deepEqual(paradas(ANCHO_DE_RUTA.canto), { 13: 7, 15: 10, 17: 17, 19: 33 });
});

test('la ruta es más angosta que la Red: se ve el tubo a los costados', () => {
  PARADAS.ruta.forEach((px, i) => assert.ok(px < PARADAS.red[i], `zoom ${[13, 15, 17, 19][i]}`));
});

test('la flecha de la maniobra acompaña a la ruta: tres cuartos de su ancho, canto +3, y la punta escala igual', () => {
  const ruta = paradas(ANCHO_DE_RUTA.linea);
  const flecha = paradas(ANCHO_DE_RUTA.flecha);
  const canto = paradas(ANCHO_DE_RUTA.flechaCanto);
  const punta = paradas(TAMANO_DE_PUNTA);

  for (const z of [13, 15, 17, 19]) {
    assert.ok(Math.abs(flecha[z] - ruta[z] * 0.75) < 1e-9, `flecha en ${z}`);
    assert.ok(Math.abs(canto[z] - (flecha[z] + 3)) < 1e-9, `canto en ${z}`);
    // La punta se dibujo para una linea de 6 px.
    assert.ok(Math.abs(punta[z] - flecha[z] / 6) < 1e-9, `punta en ${z}`);
  }
});
```

- [ ] **Paso 2: verlo fallar**

```bash
node --test tests/web/estilo-mapa.test.mjs
```

Esperado: FAIL — `ANCHO_DE_RUTA` es `undefined`.

- [ ] **Paso 3: los anchos de la ruta**

En `estilo-mapa.js`, sumar a `PARADAS`:

```js
  // La ruta (la dibuja map.js): la misma curva que las calles, para que pinte
  // la calzada en vez de flotar como un hilo de 8 px fijos (AD-53).
  ruta: [4, 7, 14, 30]
```

y debajo de `conBorde`:

```js
/**
 * Los anchos de la ruta y de la flecha de la maniobra, que dibuja map.js.
 *
 * El canto blanco es 3 px mas ancho. La flecha mide tres cuartos de la ruta,
 * con su propio canto, y la punta se dibujo para una linea de 6 px: escala en
 * la misma proporcion para no quedar mas angosta que la linea que marca.
 */
export const ANCHO_DE_RUTA = {
  linea: ancho(PARADAS.ruta),
  canto: ancho(PARADAS.ruta, { mas: 3 }),
  flecha: ancho(PARADAS.ruta, { por: 0.75 }),
  flechaCanto: ancho(PARADAS.ruta, { por: 0.75, mas: 3 })
};

export const TAMANO_DE_PUNTA = ancho(PARADAS.ruta, { por: 0.75 / 6 });
```

- [ ] **Paso 4: verlo pasar**

```bash
node --test tests/web/estilo-mapa.test.mjs
```

Esperado: PASS.

- [ ] **Paso 5: `map.js` los usa**

Cambiar el import de `estilo-mapa.js` en `map.js`:

```js
import { registerPmtilesProtocol, buildBasemapStyle, ANCHO_DE_RUTA, TAMANO_DE_PUNTA } from './mapa/estilo-mapa.js';
```

Borrar `ROUTE_WIDTH` y `ROUTE_CASING` con su comentario y, en su lugar, nada (los anchos
vienen de `ANCHO_DE_RUTA`). Reemplazos dentro de `drawRoute`:

- `route-casing`: `paint: { 'line-color': '#ffffff', 'line-width': ANCHO_DE_RUTA.canto, 'line-opacity': .35 }`
- `route-line`: `paint: { 'line-color': token('--gps-ruta'), 'line-width': ANCHO_DE_RUTA.linea }`
- `route-access`: `paint: { 'line-color': token('--gps-amarillo'), 'line-width': ANCHO_DE_RUTA.linea }`

Antes de `map.addLayer({ id: 'route-casing', …`, ampliar el comentario existente con:

```js
  // El ancho sigue al zoom (ANCHO_DE_RUTA, AD-53): con 8 px fijos tapaba a las
  // calles vecinas de lejos y era un hilo en el medio de la calzada de cerca.
  // La Red se instala SIEMPRE debajo de route-casing (anclaDeLaRed).
```

En `showManeuver`:

- `maniobra-canto`: `'line-width': ANCHO_DE_RUTA.flechaCanto,`
- `maniobra-linea`: `'line-width': ANCHO_DE_RUTA.flecha,`
- `maniobra-punta`: `'icon-size': TAMANO_DE_PUNTA,`

En `ensureArrowHead`, que la punta no se vea borrosa a zoom 19 (se estira hasta 3,75
veces): dibujarla a cuatro veces la resolución.

```js
  // A cuatro veces la densidad de la pantalla: TAMANO_DE_PUNTA la estira hasta
  // 3,75 veces a zoom 19 y una imagen de 22 px quedaria borrosa.
  const escala = (window.devicePixelRatio || 1) * 4;
```

(El resto de la función ya usa `escala` para el canvas y para `pixelRatio`, así que el
tamaño lógico sigue siendo 22 × 18.)

- [ ] **Paso 6: buscar restos**

```bash
grep -rn "ROUTE_WIDTH\|ROUTE_CASING" src/TruckNavigator.Api/wwwroot/js
```

Esperado: sin salida.

- [ ] **Paso 7: todo en verde**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

Esperado: `# fail 0`.

- [ ] **Paso 8: mirarlo en el navegador**

Recargar; con el guion `preparar('jbj', 'noche')` de la Tarea 1, zoom 13 y 19: de lejos la
ruta no tapa las calles vecinas; de cerca llena la calzada y el tubo de la Red se ve a los
dos lados cuando la ruta va por la Red. Consola sin `Mapa:`. Para la flecha, simular un
viaje corto o llamar a mano:

```js
const nav = await import('/js/navigation.js');
const gl = await import('/js/map.js');
// `window.ruta` lo dejó preparar() (Tarea 1)
const flecha = nav.maneuverArrowPath(nav.prepareRoute(window.ruta), 3, { before: 25, after: 45 });
gl.showManeuver(flecha, 3);
```

A zoom 17 y 19 la flecha mide tres cuartos de la ruta y la punta no está pixelada.

- [ ] **Paso 9: commit**

```bash
git add tests/web/estilo-mapa.test.mjs src/TruckNavigator.Api/wwwroot/js/mapa/estilo-mapa.js src/TruckNavigator.Api/wwwroot/js/map.js
git commit -m "La ruta pinta la calle: su ancho y el de la flecha siguen al zoom"
```

---

### Tarea 9: las fotos de DESPUÉS y el orden después de cambiar de estilo

**Files:** ninguno del repo.

- [ ] **Paso 1: las 16 fotos de después**

Recargar la app y repetir la Tarea 1, Pasos 2 y 3, con los mismos lugares, temas y zooms.

- [ ] **Paso 2: la Red queda debajo de la ruta aunque se reinstale después**

Con una ruta dibujada, forzar el caso que cuidaba §3.2: cambiar de estilo, dibujar la ruta
**antes** de que la Red termine de reinstalarse, y mirar el orden.

```js
const { buildBasemapStyle } = await import('/js/mapa/estilo-mapa.js');
const gl = await import('/js/map.js');
tnMap.setStyle(buildBasemapStyle(''));
tnMap.once('style.load', () => gl.drawRoute(window.ruta, window.ruta.accessLegs ?? []));
await new Promise((r) => setTimeout(r, 4000));
const ids = tnMap.getStyle().layers.map((l) => l.id);
[ids.indexOf('red-brillo'), ids.indexOf('route-casing'), ids.indexOf('calles-nombre')]
```

Esperado: los tres índices existen y `red-brillo` < `route-casing` < `calles-nombre`.
Si `red-brillo` queda arriba de `route-casing`, el ancla no está funcionando: volver a la
Tarea 4.

- [ ] **Paso 3: armar las cuatro comparaciones**

```powershell
# a13…a19 y d13…d19: las rutas de las fotos anotadas en la Tarea 1 y en el Paso 1
& "$scratch\comparar-la-red.ps1" -Titulo 'Juan B. Justo · noche' -Antes a13,a15,a17,a19 -Despues d13,d15,d17,d19 -Salida "$scratch\la-red-jbj-noche.png"
```

Una por lugar y tema: `la-red-jbj-noche.png`, `la-red-jbj-dia.png`, `la-red-pm-noche.png`,
`la-red-pm-dia.png`. Abrir cada una con `Read` y mirarla antes de mandarla: la Red se
distingue de la autopista y de las avenidas, el nombre de la Red sale una vez y es más
grande que el de la transversal, no hay punteado en la autopista, la ruta llena la calzada
a zoom 19.

- [ ] **Paso 4: mandárselas al usuario**

`SendUserFile` con las cuatro, `display: "render"`, y una línea por foto con lo que se ve.
Si el usuario pide ajustes de color o ancho, volver a la tarea que corresponda (los tests
fijan los números: cambiarlos es cambiar el test primero).

---

### Tarea 10: la documentación

**Files:**
- Modify: `docs/decisions.md` (AD-53 nueva)
- Modify: `CLAUDE.md`
- Modify: `.claude/skills/diseno-camiones-app/SKILL.md` (§17)
- Modify: `.claude/skills/estado-camiones-app/SKILL.md` (la tabla A/B/C)

- [ ] **Paso 1: AD-53**

Agregar al final de `docs/decisions.md`, con el formato de AD-52:

```markdown
## AD-53 · La Red primero: siempre visible, la vía que manda, con cromo (03/10/2026)

**Contexto.** En la prueba en la calle del 02/10/2026 el usuario pidió que la Red de
Tránsito Pesado se viera siempre, como referencia permanente —"uno de los puntos MÁS
IMPORTANTES"—, y fuera de la ruta casi no se distinguía. Medido: de noche la autopista
(contraste 4,36 contra el fondo) le ganaba a la Red (3,81), y entre la Red y una avenida
había 1,75. Los nombres de la Red eran más chicos que los de cualquier calle y se
congelaban en zoom 16. La ruta medía 8 px fijos: tapaba a las vecinas de lejos y flotaba
como un hilo de cerca (la hipótesis de los tiles de zoom 15 se midió y era falsa: 0,3 m
de desvío máximo).

**Decisión.** Enmienda AD-48 en el color de la Red y la decisión de la hoja de capas del
17/09/2026 en que la Red ya no se apaga.

- La Red es la vía más clara y la más ancha en todo zoom (6 / 10 / 22 / 48 px); las demás
  bajan a una variante apagada del mismo azul. De día las calles siguen blancas y la Red
  es la única vía saturada.
- Se pinta como un tubo de cromo: cuatro capas de la misma fuente (canto, cuerpo, reflejo,
  brillo centrado). El brillo destella entre 0,55 y 0,95 cada 2,5 s, a 10 Hz, quieto en
  segundo plano y con movimiento reducido. Se eligió cromo sobre un halo difuminado al
  verlo: "ese brillo buscamos".
- Siempre visible: sale de `GRUPOS` y de la hoja de capas; lo guardado antes se ignora.
  Siempre debajo de la ruta, aunque se reinstale después (`anclaDeLaRed`).
- Los nombres crecen hasta zoom 19 y los de la Red van siempre un escalón arriba; una
  calle de la Red lleva un solo nombre.
- La ruta y la flecha de la maniobra siguen al zoom (4 / 7 / 14 / 30 px).
- Sale la línea punteada del centro de la autopista.

**Descartado.** Hornear la pertenencia a la Red en el mapa base (rehace 55 MB y el workflow
sin nada que se vea) y un reflejo que avance por la Red: son 2.426 tramos de 94 m de
mediana y avanzaría a saltos; habría que unirlos por calle y pagar un degradado por cuadro.

**Medición en el teléfono.** <completar en la Tarea 11 con la línea `Destello:` del log y la
decisión: 10 Hz, 5 Hz o quieto>.
```

(El último párrafo se completa en la Tarea 11 con números reales; si la Tarea 11 todavía
no corrió cuando se commitea esto, el commit de la Tarea 11 lo completa.)

- [ ] **Paso 2: CLAUDE.md**

- En la tabla de comandos, el conteo de `node --test` con el número que da ahora
  `node --test "tests/web/*.test.mjs" 2>&1 | grep "^# pass"`, y en su lista de temas
  sumar "la Red (cromo, destello, nombres)".
- La trampa **"Las capas del mapa se prenden una por una desde la hoja de capas"**: los
  grupos pasan a ser `galibo, paso, radar, zona, reporte`; agregar *"**La Red no está**:
  no se apaga desde el 03/10/2026 (AD-53) y una `red` guardada antes se descarta en
  `capasActivas`."*
- La trampa **"La ruta se dibuja DEBAJO de `calles-nombre`"**: cambiar *"la línea de 8 dp
  con su canto"* por *"la línea con su canto"* y agregar al final: *"**Y ENCIMA de la
  Red**: `createMap` reinstala las capas en cada `style.load`, así que la Red se apila
  antes de `route-casing` si hay ruta (`anclaDeLaRed`, `mapa/red.js`) — por orden de
  instalación quedaba bien de casualidad. El ancho de la ruta y de la flecha sigue al
  zoom (`ANCHO_DE_RUTA`)."*
- En la tabla de módulos de `js/mapa/` (trampa de AD-48), sumar `red.js` (la Red como
  dibujo).

- [ ] **Paso 3: las skills**

En `diseno-camiones-app` §17 (alrededor de las líneas 917–924): la ruta deja de ser "de 8
dp" y pasa a "4 / 7 / 14 / 30 por zoom"; la Red deja de ser `#6d89a8` y pasa a "el tubo de
cromo: cuerpo `#8fb6de`, canto, reflejo y brillo que destella (AD-53)"; calle `#354558`,
avenida `#3d4d61`, autopista `#4a5f7a` sin línea punteada. En `estado-camiones-app`, la
fila de la parte B pasa a "hecha, falta el teléfono" (o "hecha" después de la Tarea 11).

- [ ] **Paso 4: buscar lo que quedó viejo**

```bash
grep -rn "autopista-centro\|--map-centro\|ROUTE_WIDTH\|8 dp\|#6d89a8\|red-linea'\]" CLAUDE.md docs .claude/skills src/TruckNavigator.Api/wwwroot/js
```

Esperado: sólo menciones históricas (AD-48, la spec). Corregir lo que describa el
presente.

- [ ] **Paso 5: commit**

```bash
git add docs/decisions.md CLAUDE.md .claude/skills/diseno-camiones-app/SKILL.md .claude/skills/estado-camiones-app/SKILL.md
git commit -m "Docs de la parte B: AD-53, las trampas de la Red y la ruta, y las skills"
```

---

### Tarea 11: el destello en el teléfono

Necesita al usuario con el teléfono conectado por USB.

- [ ] **Paso 1: levantar todo y compilar**

```powershell
.\demo-up.ps1
.\build-apk.ps1 -ApiUrl <la URL del túnel que imprime demo-up> -Push
git checkout -- src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs
```

- [ ] **Paso 2: medir con un viaje en curso**

Con el log corriendo en un proceso aparte (`adb logcat -s Web Cascara` redirigido a un
archivo del scratchpad), el usuario arranca un viaje y lo deja andar al menos un minuto.
Buscar la línea:

```bash
grep "Destello:" <archivo del log>
```

Criterio, con la línea a la vista:

| Lo que dice | Qué se hace |
|---|---|
| cada latido < 2 ms y el hueco más largo < 100 ms, y el usuario no ve el mapa trabado | queda en 10 Hz |
| el hueco más largo ≥ 100 ms, o el usuario ve tirones | `LATIDO_DESTELLO_MS = 200` (test de la Tarea 7 primero), recompilar y medir otra vez |
| a 5 Hz sigue trabando | el brillo queda quieto: `destello` con `quieto: true` siempre (test primero) |

- [ ] **Paso 3: anotar el resultado**

Completar el párrafo "Medición en el teléfono" de AD-53 con la línea del log y la decisión,
y commitear:

```bash
git add docs/decisions.md
git commit -m "AD-53: el destello medido en el telefono"
```

---

### Tarea 12: el PR

- [ ] **Paso 1: todo en verde**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | tail -8
```

(Los tests de .NET no cambian en B; correrlos sólo si se tocó algo fuera de `wwwroot`.)

- [ ] **Paso 2: empujar y abrir el PR**

```bash
git push -u origin la-red-primero
gh pr create --base main --title "La Red primero: siempre visible, con cromo, y la ruta que pinta la calle (AD-53)" --body-file <archivo del scratchpad>
```

El cuerpo: qué pidió el usuario (puntos 4, 7, 8, 9, 10 y 11 de la prueba en la calle), qué
se midió, qué cambió, las cuatro comparaciones de fotos, la línea `Destello:` del teléfono
y el conteo de tests. Termina con la línea de atribución de Claude Code. **No fusionar**:
lo fusiona el usuario.
