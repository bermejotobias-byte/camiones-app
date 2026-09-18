# GPS con la piel de Waze — diseño

**Fecha:** 16/09/2026 · **Rama:** `cuentas-de-usuario` · **Estado:** aprobado por el usuario el 16/09/2026 sobre el lienzo `docs/diseno/prototipo-gps/` (https://claude.ai/artifact/42KH4a8piCQSCb5xez2K4H).

## 1. Qué se construye

La pantalla del mapa entera —reposo, búsqueda, elegir ruta, viaje, vista general,
capas, lugares, aportar, reanudar— rehecha con la estructura, las medidas y los
colores de Waze, **medidos sobre las capturas** de `docs/referencias/waze/`, y
adaptada a lo nuestro: la Red de Tránsito Pesado, los gálibos, los lugares para
camiones con su comunidad, el camión elegido, el S.O.S., el zócalo y el mono.

Antes de la piel, **la lógica de ruteo se corrige en su origen** (§3): el usuario
lo puso primero y de eso dependen los avisos del viaje.

Lo que NO entra: velocímetro y límite de velocidad, micrófono, tráfico (no hay
dato), reportes de la Fase 5 (la hoja "¿Qué hay acá?" nace con las categorías de
lugar y queda lista para crecer), la identidad y los logos (diseño aparte, después).

## 2. Fuente de verdad visual

El prototipo es la referencia: `docs/diseno/prototipo-gps/gps.mjs` lleva cada
medida con la captura de la que sale (`waze-NN`). Las que rigen:

| Pieza | Medida |
|---|---|
| Banda de instrucción | 127 dp con la barra de estado (92 compacta); flecha 40 × 46, trazo 5; distancia **27 sp / 400**; calle **24 sp / 500** en celeste de texto |
| Hoja del viaje | 137 dp; manija 45 × 4; hora **25 sp / 700**; "39 min • 32 km" 20 sp gris claro; dos círculos de 45 en `#3c4043` |
| Píldora de la calle actual | negra, **20 sp / 700 blanca**, radio total, a 155 del borde |
| Botón de aportar | 63 dp, radio 16, `#4e411e`, calcomanía amarilla |
| Botones flotantes | círculos negros de 52; el S.O.S. en rojo `#e9463f` |
| Ruta | 8 dp `#2ddcff`, canto blanco al 35 % de 1 dp; accesos fuera de la Red en amarillo `#f9c531` |
| Globo de calle | 30 dp (48 en dos líneas), radio 7, `#1d7699`, **18 sp / 700**, clavado con punto blanco en la calle |
| Chevrón | 40 × 39, `#00b5d0`, contorno blanco 3, base clara, disco de 82 al 6 % blanco |
| Lista de rutas | filas de 145; tiempo **27 sp / 700** (celeste y borde celeste de 4 sobre negro en la elegida); km 18 gris; "Por…" 18; estado 16 gris; chips de 25 con punto y 14 sp |
| Píldoras de acción | 48 dp, **16 sp / 700**; gris `#3c4043` con texto celeste, celeste `#32ccfe` con texto `#0a1f2a` |
| Tarjeta de ruta (general) | radio 16, `#202125`; tiempo 27 / 700; "Reanudar" 134 × 44; línea de tiempo de 3 dp con pines de 25 |
| Recentrar | 62 dp, radio 20; círculo `#e8e9ed` de 36; 20 sp; píldora 132 × 37 con 16 sp celeste |
| Conmutador Mapa/Lista | 155 × 40 a 112 del borde; activo `#164a7a` con texto celeste |
| Reposo | hoja de 150: píldora de 50 con 16 sp gris; atajos de 45 con 17 sp |
| Buscar | píldora 52; chips 82 × 65 con 14 sp; filas de 65 con 18 / 700 y 14 celeste |
| "¿Qué hay acá?" | título 21 / 700; círculos de 75 en `#3c4043` con calcomanía de 40; 14 sp |
| Pines de lugar | 32 dp, anillo 3 (blanco verificado, celeste comunidad con contador, gris apagado sin confirmar) |
| Chapas de dato fijo | cuadrado blanco de 24, radio 5; el radar con su semáforo chico |
| Mapa de noche | tierra `#272d39`; manzanas `#252e3d` / `#233041`; predios `#2e3d50`; agua `#22467a`; parque `#216a4f`; calle `#40546c` (10 dp de cerca, 2,5 de lejos); avenida `#4d6179`; **la Red `#6d89a8`**, la más ancha; autopista `#7494b4` con carriles `#4a5c74` y centro punteado `#c8d3df`; ferrocarril `#3a4553` a rayas; rótulos de calle 12 sp `#d9e5ee` con halo; barrios 17 sp `#8b95a5`; parques 12 sp `#6fc48a`; lugares 12 sp `#8fb8e8`; flechas de mano `#8fb3d9` |
| Tipografía | **Roboto (la del sistema) sólo dentro del GPS**; Nunito en el zócalo y el resto |
| Día | **Derivado, no medido** — y **aprobado así por el usuario el 18/09/2026**: "el tema claro está bien así, no hace falta la captura de Waze". Banda y hojas blancas con tinta oscura, el celeste oscurecido para el contraste, la fila elegida en gris claro `#eef1f4`; el mapa con calles blancas y filete gris, la Red en azul acero claro y la autopista en amarillo pálido. Los tokens de día están en `app.css` (`:root[data-theme="light"]`); lo de color fijo (bloques verde, rojo y celeste de la ficha, globos, chapas) lleva tinta fija, que es lo que lo hace leerse en los dos temas |

Reglas que el prototipo fija:

1. Una cifra manda por pantalla. 2. El celeste es acción y ruta; amarillo es
salir de la Red; **el rojo nunca está sobre una ruta**. 3. La Red se lee sola:
la vía más clara y más ancha, con nombre en mayúsculas. 4. Lo de la comunidad no
se ve igual que lo verificado. 5. Nada del registro expresivo en movimiento; el
mono habla una vez, en los detalles de la ruta. 6. Donde falta el dato, se dice.

Se copian patrones y medidas; **no** la marca de Waze, sus Wazers, sus
ilustraciones ni su tipografía de marca. Las calcomanías son dibujos propios.

## 3. Ruteo seguro — corrección en el origen

Diagnóstico del 15/09/2026 (informe al usuario):

- El motor ya bloquea alto, ancho, largo y peso (`CabaTruckRoutingPolicy`) y
  `hgv=no`; GraphHopper no engancha a tramos bloqueados. **Una ruta no pasa por
  un gálibo que el camión no clara.**
- **Defecto 1:** el aviso de gálibo del viaje sale de la capa (Overpass, otra foto
  del mapa) por corredor de 30 m, no de la ruta: yendo por arriba de un puente,
  el bajo vía queda a 0 m y suena "no pasás" en una ruta legal.
- **Defecto 2:** el evaluador ignora `max_weight_except`, que el motor sí respeta:
  una ruta legal aparece con "1 tramo que no podés transitar".
- **Defecto 3:** la interfaz ofrece rutas con tramos bloqueados como opción.
- **Defecto 4:** `fetch-caba-map-layers.ps1` parsea alturas con la cultura de la
  máquina: "1,53" y "6,0" quedaron como 153 y 60 m.
- Ejes: ninguna fuente lo soporta; no se rutea por ejes y se dice.

Decisiones:

- **Los avisos de gálibo salen de la ruta**: `RouteResponse.hazards` lista los
  tramos con `max_height` declarado (valor, calle, índices), del mismo dato con
  que el motor calculó. El cliente no cruza gálibos de la capa contra la ruta.
  Sobre una ruta correcta el aviso es siempre informativo ("gálibo de 4,50 m,
  pasás"); si un tramo tuviera un límite menor que el camión, la ruta **no se
  ofrece** (ver abajo).
- **El evaluador imita al motor en peso**: se pide `max_weight_except` en los
  detalles; con excepción declarada el tramo no se marca como bloqueado, se
  marca como acceso condicionado.
- **Ninguna ruta con tramo bloqueado se ofrece.** Las alternativas con un
  hallazgo bloqueante se descartan; si la recomendada lo tiene, `/api/routes`
  responde 422 con el hallazgo. La interfaz deja de tener "N tramos que no podés
  transitar".
- **Radares y pasos a nivel** siguen por corredor, pero el radar se cruza además
  con el nombre de la calle de la ruta en ese punto (el dataset trae
  `ubicacion` con la calle); el paso a nivel usa un corredor de 12 m.
- El script de capas parsea con cultura invariante, acepta coma decimal y
  descarta alturas fuera de 1,5–8 m con aviso.

## 4. Arquitectura del cliente

`navigate.js` queda como anfitrión (estado, mapa, GPS, viaje) y cada superficie
es un módulo en `wwwroot/js/mapa/`:

| Módulo | Qué dibuja |
|---|---|
| `estilo-mapa.js` | los tokens del mapa (noche y día) y el estilo de MapLibre con la jerarquía de Waze |
| `reposo.js` | la hoja de reposo (píldora + atajos) y los controles |
| `buscar.js` | la hoja de búsqueda (chips, Casa/Depósito, recientes, sugerencias) |
| `rutas.js` | la lista de rutas y los detalles |
| `viaje.js` | banda, hoja del viaje, píldora de calle, avisos, recentrar, vista general y lista |
| `capas.js` | la hoja de capas |
| `lugares.js` | la capa de lugares, la ficha y el voto |
| `aportar.js` | "¿Qué hay acá?" y marcar el lugar |
| `piezas.js` | lo compartido: píldoras, chips, círculos, calcomanías, flecha de maniobra, línea de tiempo |

Lo que se calcula sale a funciones puras con tests en `tests/web/`:
`porDonde(instrucciones)` ("Por Av. X; Av. Y"), `chipsDeRuta(alerts, notes)`,
`marcasDeLineaDeTiempo(alerts, total)`, `iconoDeManiobra(kind)`,
`textoDeEstado(route)`.

Todo el GPS va en Roboto (`--gps-ui`) y con sus tokens propios (`--gps-*`,
`--map-*`) en `app.css`, separados del registro expresivo.

## 5. Contratos nuevos de la API

- `RouteResponse.hazards: RouteHazardDto[]` — `Kind` ("galibo"), `Metres`,
  `StreetName`, `FromPointIndex`, `ToPointIndex`.
- `/api/routes` → 422 `Problem` cuando la ruta recomendada tiene un tramo
  bloqueado; las alternativas bloqueadas se filtran.
- `GET/PUT /api/profile/places` — lugares guardados: `{ home, work }` con
  `{ label, latitude, longitude }`; `GET /api/profile/recent-places` — los últimos
  8 destinos, que el servidor registra al arrancar un viaje.

## 6. Verificación

- .NET: tests unitarios del evaluador, de la política, del filtro de rutas y de
  los hazards; de integración para lugares guardados y recientes.
- JS: `node --test` para las funciones puras nuevas y para `alertsAlongRoute`
  con hazards y con nombre de calle.
- Visual: cada pantalla se mira en el navegador a 360 × 800, noche y día,
  contra su tablero del prototipo; sin errores en consola; después, el teléfono.
- Ninguna funcionalidad existente se rompe: viaje, reparto, alternativas,
  contactos, progresión siguen con sus tests en verde.
