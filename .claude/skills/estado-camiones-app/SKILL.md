---
name: estado-camiones-app
description: Estado vivo del proyecto GPS para camiones de CABA — dónde está el roadmap, qué está verificado y qué no, las decisiones tomadas con el usuario y las trampas del entorno de desarrollo. Invocar al retomar el trabajo en este repositorio, antes de planificar o escribir código.
---

# Estado del proyecto — Navegador de Tránsito Pesado (CABA)

Este archivo es **memoria de trabajo**, no documentación del producto. Lo que ya
está escrito en `docs/` no se repite acá: se indexa. Lo que hay acá es lo que no
vive en ningún otro lado — el estado del roadmap, qué se probó de verdad, y las
trampas del entorno que cuestan horas si se redescubren.

---

## 1. Qué es

GPS para camiones en CABA que **rutea según las medidas y el peso del vehículo**.
La restricción entra como *custom model* de GraphHopper **antes** de calcular la
ruta, no como advertencia posterior. Fuente regulatoria: Ley 2148, art. 9.10.1
(Red de Tránsito Pesado). Mapa: OpenStreetMap — **nunca Google Maps ni Waze**.

Objetivo declarado: *"El GPS de los camioneros de Buenos Aires"*. No sólo un
navegador: perfil, historial, gamificación, comunidad.

**Rama de trabajo:** `cuentas-de-usuario`. **`main` quedó en `a587041`**: la rama
está muy adelante y todavía no se fusionó.

**Punta al 15/09/2026: la comunidad vota y aporta lugares** (AD-46; doce
commits desde la spec `5298239`, uno por tarea), **sin pushear**. Antes, ese
mismo día, el relevamiento de POIs y los talleres de mecánica pesada
(`d0b6ddd`, diecisiete commits desde `b5dc4d3`, de la spec `c16cef1` al cierre en docs). Los
del 14/09: la mascota en la app (`5db5267`) y el prototipo de diseño
(`b5dc4d3`). Antes, **`ec20c58`** del 12/09 (el zócalo), pusheada a `origin`, sin nada
pendiente salvo `routing/config-truck.yml`. Antes, `91350da`. Los cinco commits del 12/09 —escalas y EXP,
campos de identidad, perfil, carnet, skills— son las sesiones del 10 al 12/09.
**Los de perfil (`8daf031`) y carnet (`81573e6`) llevan en el mensaje que el
diseño visual NO está aprobado**; lo funcional sí. Antes, la punta era `fdf8341`
del 10/09.

**Hay dos remotos.** `origin` es `bermejotobias-byte/camiones-app` y es el que se
usa; `hermano` es `bermejolautaro/camiones-app`, con su propia rama
`cuentas-de-usuario` en otra punta. **No empujar a `hermano`** sin que el usuario
lo pida.

---

## 2. Dónde está la verdad

**Leer siempre antes de decidir algo.** No duplicar su contenido acá.

| Documento | Qué tiene |
|---|---|
| `CLAUDE.md` | Convenciones, comandos, **trampas que ya costaron tiempo** |
| `docs/decisions.md` | **47 decisiones arquitectónicas (AD-01…AD-47)** con su porqué |
| `docs/data-sources.md` | Fuentes, licencias y limitaciones **L-1…L-11** (L-4 ya resuelta) |
| `docs/architecture.md` | Estructura y proyectos |
| `docs/routing.md`, `docs/restrictions.md`, `docs/pois.md`, `docs/deploy.md` | Por tema |
| `PLAN.md` | Especificación original del MVP |
| **skill `producto-camiones-app`** | **El alcance completo**: los **tres** brainstorms unificados y asignados a fase. Incluye el v3 textual en `references/brainstorm-v3.md` |
| **skill `diseno-camiones-app`** | **El lenguaje visual**, nueva del 09/09/2026: Duolingo + camioneros + arcade, extraído de 17 capturas reales. Invocarla antes de maquetar cualquier pantalla que no sea el mapa |
| `docs/superpowers/specs/` | Dos specs con su porqué: el **despliegue gratuito** (02/09) y el **motor de progresión** (08/09) |
| `docs/referencias/` | Las capturas de Duolingo y Preguntados, versionadas para poder revisar el análisis contra su fuente |
| Escritorio del usuario | `PUNTOS A TRABAJAR…docx` (33 requisitos, 22/08) y `ideas camionero app v2.docx` (31/08). Están **abiertos en Word**: para leerlos hay que copiarlos antes, si no el archivo está bloqueado |

**Las AD-17 a AD-45 son del trabajo reciente.** Las cuatro últimas, del
01–02/09/2026, son la sesión de la Fase 3 y salieron casi todas de defectos que
encontró el usuario tocando la app:

| AD | Qué resuelve | Por qué importa releerla |
|---|---|---|
| **AD-42** | Selector de contactos por `ACTION_PICK`, sin permiso de agenda | **Un Intent no es una dirección: es un pedido a un concurso de candidatos.** Y NO se pregunta con `ResolveActivity` |
| **AD-43** | Tres contactos de emergencia en el servidor | Rechazar un número válido es peor que aceptar uno raro. Guardar y **marcar** son dos cosas distintas |
| **AD-44** | La hoja se encoge; su acción va pegada abajo | `flex: none` la sacaba 112 px fuera de pantalla. Los bloques se separan con `gap`, **no** con `margin: auto` |
| **AD-45** | Arrancar el reparto, con sus paradas en el viaje | `/api/trips/active` **recalcula**: sin las paradas, 31 km volvían convertidos en 10 |

Las seis del 01/09/2026 por la mañana: **AD-36** (zonas del mapa comunitario —
cuando la cobertura de una fuente coincide con una frontera, el mapa dibuja la
frontera), **AD-37** (nombre de calle sobre el mapa base), **AD-38** (pasos a
nivel sin escala de color), **AD-39** (vibración con un patrón por aviso),
**AD-40** (alternativas por restricciones) y **AD-41** (orden del reparto con
distancias reales).

Y las cinco del 25–26/08/2026 siguen valiendo: **AD-30** (brújula del
magnetómetro — por qué NO se usa `Compass` de MAUI), **AD-31** (`Debug.WriteLine`
se borra en Release), **AD-32** (tests de JS sin dependencias), **AD-33** (una
dirección mal escrita dejaba la app inutilizable) y **AD-34** (cámara cenital fija
fuera del viaje).

---

## 3. Roadmap y estado

**El alcance completo vive en la skill `producto-camiones-app`**, que unifica los
dos brainstorms del usuario y asigna cada ítem a una fase. Acá va sólo el estado.

Prioridad declarada:
**navegación → usabilidad → seguridad → info para camiones → reportes de comunidad
→ experiencia y gamificación**

| Fase | Estado |
|---|---|
| **0 · Cimientos** | ✅ Completa — cuentas, camiones por usuario, viajes, mudanza del frontend |
| **1 · Navegación** | 🔨 **Todo lo construible está hecho** — guiado, voz, GPS en segundo plano, brújula, nombre verde de la calle, vibración por patrón, alternativas de ruta y reintento al conectar. Falta lo único que no se puede hacer acá: **manejar** |
| **2 · Usabilidad** | ✅ Completa — salió adelantada dentro de la mudanza del frontend |
| **3 · Seguridad** | 🔨 Están el 911, las zonas peligrosas y los **3 contactos de emergencia**. Queda **compartir viaje por WhatsApp** —necesita endpoint público, tokens que venzan y decisiones de privacidad— y el S.O.S. del reporte, que depende de la Fase 5 |
| **4 · Info para camiones** | 🔨 Capas, mapa base, avenidas destacadas, radares y **modo reparto completo** (calcula **y** navega, desde AD-45). **La base de POIs para camiones se relevó el 15/09/2026** (gomerías, estaciones, lugares para comer y talleres de mecánica pesada; 180 puntos, 48 con evidencia). Queda **la interfaz de POIs en la app web** y la conversación sobre **POIs valorados por usuarios** |
| **5 · Reportes de comunidad** | ⬜ **Fase nueva del v2** — reportar y confirmar siniestros, radares y retenes. Es un sistema, no una función |
| **6 · Experiencia y gamificación** | 🔨 **El motor está hecho y andando** (10/09): nivel, metas, logros, recompensas, inventario, equipamiento, récords y seis endpoints. Falta lo que se apoya en él: **las pantallas**, el avatar combinable, la batería y los juegos |
| **7 · Cáscara, entrada e idiomas** | 🔨 **El zócalo está** (12/09). Quedan intro → idioma → condiciones → acceso y el modo invitado. Ver `producto-camiones-app` |
| **Transversal** | ⬜ i18n (la pantalla existe, **sólo español** por decisión) · clave de firma de distribución · **límite de tasa en la API** |
| **Despliegue** | 🔨 Escrito y commiteado, **nunca ejecutado**: falta cupo de A1 en Oracle, el release del mapa base, SMTP y DuckDNS |

**El 31/08/2026 el usuario sumó un segundo brainstorm** (*"IDEAS PARA TBF 2.0"*)
que agranda el proyecto: abre la fase de reportes de comunidad, reabre la 4 y
convierte la de experiencia en algo mucho más grande de lo que parecía. Antes de
planificar, leer `producto-camiones-app`.

### Commits de la rama, en orden

```
213041b  Cuentas de usuario con verificacion por mail y perfil de camionero
96c5e42  Los camiones pertenecen a una cuenta; las plantillas no son de nadie
774c99c  Viajes: historial y kilometros que el cliente no puede falsificar
7ce55f9  La interfaz pasa a una aplicacion web mobile first, sin paso de compilacion
728b840  La app Android pasa a ser una cascara sobre la aplicacion web
54d5291  Navegacion paso a paso: motor de guiado en el cliente
49e7d88  El GPS sigue vivo en segundo plano mientras dura el viaje
53f8914  Arreglos del puente entre la cascara y la web, encontrados probando en el telefono
1710102  Capas de camion en el mapa: la Red, los galibos y los sapitos
257600e  Mapa base propio en PMTiles: minimalista, con dia y noche
a4eda3d  Actualiza la skill: Fase 4 cerrada y comandos de datos
5fb0ef3  Brujula del magnetometro, camara cenital fija, y una app que ya no queda varada
a587041  Actualiza la skill: el checkpoint y que config-truck.yml no se commitea   <- main
1b5cd5a  Zonas de riesgo y radares en el mapa, simbolos que se entienden, y un APK que se puede actualizar
145caec  Actualiza la skill: checkpoint 1b5cd5a, y dos cosas que decia y ya son falsas
1b631dc  Las zonas de riesgo cuentan robos a mano armada, y vuelven a ser un mapa de calor
5b7d0d6  Actualiza el roadmap: la Fase 4 estaba mas cerrada de lo que decia
9363092  El arranque insiste tres veces antes de rendirse, no una
82fc732  Las zonas peligrosas salen del mapa comunitario, con boton propio y sin numeros
0dea657  El nombre de la calle por la que vas: en verde, y ya no lo tapa la ruta
d19d650  El nombre verde se achica y deja de encimarse consigo mismo
727912d  Los sapitos solo durante el viaje y sin escala de color; el galibo usa el puente del boton
17c8417  Vibracion: un patron distinto por aviso, y avisos de lo que hay sobre la ruta
954dd28  Alternativas de ruta, ordenadas por restricciones y no por tiempo
907d5ed  Modo reparto: el backend ordena hasta 10 paradas por distancia real
b5bacd4  Modo reparto: la interfaz, con paradas numeradas en la lista y en el mapa
cd2499a  Actualiza las skills: la de estado decia seis cosas que ya eran falsas
2ed7a39  Saca de la skill un numero que se desactualiza solo
77f6e6f  L-11 pasa de pendiente a congelada por decision
c5796d6  Elegir un contacto de la agenda, sin pedir permiso sobre la agenda
a0dee91  Tres contactos de emergencia, y tres defectos que solo aparecieron en el telefono
2e9a6c3  La hoja se encoge en vez de salirse de la pantalla, y el boton de accion queda fijo
b496109  Los bloques de la capa del mapa se separan con gap, no con margenes automaticos
30f742d  El reparto se puede arrancar, y sus paradas viajan con el viaje
c9d3552  Actualiza las skills con la sesion de la Fase 3 y lo que dejo aprendido
686f1e9  El backend se construye en GitHub Actions y la VM solo baja imagenes
4be2241  Suma el brainstorm v3, la skill de diseno y las referencias visuales
a69019f  Motor de progresion: nivel, metas, logros y recompensas en el servidor
fdf8341  El nivel lo calcula el servidor: sale levelFor del cliente          <- punta
```

**Los cuatro últimos son del 10/09/2026** y cubren dos frentes: el **despliegue
por GitHub Actions** y el **motor de progresión** completo, del dominio al
cliente. `a69019f` es el más grande de la historia del proyecto: 31 archivos y
4.788 líneas.

**`30f742d` fue la punta del 02/09/2026.** Los seis commits desde `c5796d6` son la
**sesión de la Fase 3**, y su rasgo distintivo es que **seis de sus defectos los
encontró el usuario tocando la app, no los tests**:

- **Puente de la agenda** (AD-42) y **tres contactos de emergencia** (AD-43),
  guardados en el servidor.
- **La hoja se encoge** y su acción queda fija abajo (AD-44), más la separación
  de los controles del mapa con `gap`.
- **Arrancar el reparto** (AD-45), que además destapó que el viaje perdía sus
  paradas al recuperarse.
- **L-11 congelada por decisión** hasta tener la base del AMBA.

**Con AD-45 el modo reparto está completo por primera vez**: antes calculaba pero
no navegaba, o sea la mitad de la función. Se había declarado cerrado igual.

**`b5bacd4` fue la punta del 01/09/2026**, y con ella cerró todo lo construible de
la Fase 1. Los nueve commits desde `9363092` cubren:

- **Reintento al conectar** (apéndice de AD-33): 3 intentos, y sólo se reintenta
  lo que puede resolverse solo.
- **Zonas peligrosas rehechas desde el mapa comunitario** (AD-36). Ver abajo: el
  intento con el dato oficial **se descartó**.
- **Nombre de la calle en verde** sobre el mapa base, a 1,5× (AD-37).
- **Pasos a nivel sólo en viaje, sin escala de color**; gálibo con el puente del
  botón; radar como cámara de vigilancia (AD-38).
- **Vibración con un patrón por aviso** y avisos precalculados sobre la ruta (AD-39).
- **Alternativas de ruta** ordenadas por restricciones (AD-40).
- **Modo reparto**, backend e interfaz (AD-41).

**`1b5cd5a` fue el checkpoint anterior**: radares de velocidad (129 cinemómetros
oficiales), rediseño de los símbolos del mapa, **firma estable del APK** (AD-35) y
el encoding de Overpass. Trajo también una versión de las zonas de riesgo desde el
**Mapa del Delito del GCBA** que **ya no existe**: se descartó en `82fc732` y la
skill no debe volver a citarla como la fuente vigente.

**`5fb0ef3` es el checkpoint del 26/08/2026** —la skill lo llamaba `029794e`, hash
que ya no existe— y junta el trabajo que había quedado sin commitear (AD-27 a
AD-29) con el de esa sesión (AD-30 a AD-34).

**`routing/config-truck.yml` quedó deliberadamente fuera del commit**: el árbol de
trabajo apunta a `argentina-latest.osm.pbf` porque el recorte del AMBA no está en
disco, y sin ese cambio local GraphHopper no arranca. Va a seguir apareciendo como
modificado en cada `git status`; **no commitearlo**.

---

## 4. Qué está verificado — y qué NO

**Distinción crítica.** Mucho está probado a fondo; una franja específica no se
pudo probar y hay que decirlo cada vez.

### La comunidad vota y aporta lugares — 15/09/2026, más tarde

**490 tests en total**: 288 unitarios de .NET, 130 de integración (11 se saltean
sin GraphHopper) y 72 de JS. Todo verde al cierre. Spec y plan en
`docs/superpowers/*/2026-09-15-pois-comunidad-y-gamificacion*`; el porqué en
**AD-46**. Once tareas, un commit por tarea, cada test visto en rojo.

**Lo que quedó:** `PoiVote` (un voto por camionero y lugar, con el **tipo de
camión**), `CommunityStanding` (el sello: recomendado ≥ 3 aptos y 2 a 1; en
discusión ≥ 3 votos y los no aptos igualan), `PoiContribution` (cómo nace un
lugar aportado: `NotConfirmed`, sin aptitud verificada, fuera del dataset,
dentro del rectángulo), `PoiFilter` (el filtro "solo aptos": verificado apto o
recomendado por la comunidad para tu tipo cuando la fuente no dice nada), la
pista `lugares` con sus skins `lugares-01…10`, `RecordContributionAsync` en el
recorder, y tres endpoints: `GET /api/pois` con el bloque `community`,
`PUT/DELETE /api/pois/{id}/vote`, `POST /api/pois`.

**Verificado a mano con la cuenta demo, backend en Development:** el primer voto
paga 2 + 100 del escalón y deja `lugares-01` pendiente de festejo; cambiar el
voto no paga; retirar deja la EXP; agregar paga 10 y devuelve 201 con la ficha y
el alias; un duplicado a 10 m da 409 con `existingId`; fuera del área 400 con el
motivo limpio; el lugar aportado sobrevive a reiniciar el backend.

**Dos cosas que atraparon los tests:** el sello miraba el total y no los aptos
(2 a 1 daba recomendado); y `ArgumentException.Message` arrastra
"(Parameter 'x')", que no es para una persona. Y una trampa del entorno: `curl`
en Git Bash manda las tildes en Latin-1 y el JSON no es UTF-8 válido — el 500
era de la prueba, no de la app; el cuerpo va en un archivo.

**Lo que NO hay:** la ficha con el botón de votar y el formulario de agregar.
Van con la interfaz de POIs. `api.js` y la insignia ya están.

### El relevamiento de POIs — 15/09/2026

**432 tests en total** en ese momento: 256 unitarios de .NET, 108 de integración
(11 se saltean sin GraphHopper) y 68 de JS. Todo verde al cierre.

Spec `docs/superpowers/specs/2026-09-15-pois-camiones-relevamiento-design.md`,
plan `docs/superpowers/plans/2026-09-15-pois-camiones-relevamiento.md`, once
tareas ejecutadas en orden con commit por tanda. **Lo que quedó y cómo se
verificó:**

| Qué | Cómo se verificó |
|---|---|
| Modelo: `TruckFriendlyEatery`, `SuitabilityEvidence` + `Kind`, `ManagedByDataset`; migración `AddPoiSuitabilityEvidence`; DTO | Tests de dominio, persistencia (ida y vuelta por SQLite) y contrato |
| El seed reconoce lo suyo por `ManagedByDataset` y borra lo que sale del archivo | Tres tests del seed, incluido el que **adopta filas de una base vieja por id** |
| `pois-caba-relevamiento-2026-09.json`: **111 puntos** — 16 gomerías (14 `Confirmed`, 2 `Probable`), 1 auxilio pesado, 71 estaciones (5 `Confirmed`, 66 `NotConfirmed` sobre la Red), 1 lugar para comer, **22 talleres de mecánica pesada** (21 `Confirmed`: 14 por la red oficial de la marca o el operador, 7 por reseñas; 1 `Probable`) | **11 candados en `PoiDatasetTests`** y la API levantada en Development: `GET /api/pois?categories=…` devuelve 41 gomerías (16 relevadas), 87 estaciones (71), 1 comedor, 47 talleres (22). 180 POIs en total, por la API y en los archivos |
| Cada evidencia es un resumen propio con fecha; las coordenadas salen de OSM, del registro oficial o de Photon, y `source` lo dice | Test que exige fecha `DD/MM/AAAA` en toda evidencia; lectura a mano de las evidencias por la API |

**Dos defectos que atraparon los tests, no el ojo:**

- **Dos puntos con la misma fuente son el mismo id** (MD5 de `source`), y la
  herramienta de armado pisaba uno con el otro sin avisar: Recapados Universal
  desapareció detrás de Auxilios Mecánicos Pesados. Ahora la fuente de una ficha
  pública lleva el nombre del comercio.
- **El registro oficial lista la misma boca dos veces** (líquidos y GNC con
  distinto `idempresa`): Zelarrayán 5530 salía encimada. El candado
  `No_two_points_of_the_same_category_share_the_same_spot` (25 m) lo vio
  primero; se fusionan.

**Y otro en los talleres:** la ficha pública de Volvo en Larrazábal 2742
quedó a 9 m del taller de Armando J. Ríos (Larrazábal 2750) que lista la red
oficial de Mercedes-Benz; el candado de 25 m lo vio, y el localizador oficial
de Volvo Trucks no tiene ningún punto en la Ciudad: **la ficha sobrevive al
comercio**, y la lista oficial de la marca manda sobre la ficha.

**Y uno que atrapó el cruce de fuentes:** el registro de la Secretaría de
Energía **conserva estaciones cerradas** (Antártida Argentina y Calle 10, Juan
B. Justo 8490 y 5940). Se cruzó cada una con el mapa oficial de su marca y la
ficha pública; cinco quedaron afuera. **La fecha del último precio informado NO
sirve como señal de cierre**: veinte estaciones abiertas dejaron de informar
en 2025-06 a la vez.

**Lo que NO se verificó:** nada en pantalla, porque **la app web no muestra los
POIs** (ninguna vista llama a `api.pois()`, no hay capa en `layers.js`). La
interfaz es lo siguiente, sobre el prototipo de diseño.

### El motor de progresión, verificado el 10/09/2026

**423 tests en total** en ese momento: 255 unitarios de .NET, 100 de
integración (11 se saltean sin GraphHopper) y 68 de JS. Venían de 147 + 56 + 62.

Todo el motor se construyó con **TDD estricto**: cada test se vio fallar antes de
escribir el código. Eso atajó tres defectos **antes de que existiera una sola línea
de interfaz**:

| Defecto | Qué habría pasado |
|---|---|
| Desborde del último nivel | Con 500.000 km el perfil decía **"meta 35 de 10"** |
| Kilometraje negativo | La escala devolvía **`-399`** como número de meta |
| Viaje que cruza dos metas | Pagaba sólo la última y **perdía una recompensa sin avisar** |

**Y verificado de punta a punta, no sólo con tests.** Contra la API real: arrancar
y cerrar un viaje acredita 120 de EXP y desbloquea dos recompensas. Una es
`nocturnos-01`, porque eran las 02:25 en Buenos Aires — **la regla de hora local
disparó bien sobre datos reales**, que es lo que un test sintético no puede probar.

En el navegador: entrar con la cuenta demo, ir al perfil, y ver *"Nivel 1 ·
Novato"*, *"0 km"* y *"Te faltan 2.500 km para Repartidor"*, los tres calculados
por el servidor. Sin errores nuevos en consola.

### Escalas del motor — decididas por el usuario el 10/09/2026

Estaban puestas por mí y marcadas como provisorias. Se le llevaron **opciones** y
eligió, así que **ahora son decisiones y los tests las fijan** (`TrackCatalogTests`
y `ExperienceScaleTests`): una decisión que se puede cambiar sin querer no está
tomada.

**Los escalones**, calibrados contra la cadencia real del oficio —2 viajes/día,
5 repartos/día, 1 nocturno/semana, 250 días de trabajo al año—:

| Pista | Escalones | Tope |
|---|---|---|
| `viajes` | 1 · 3 · 7 · 15 · 30 · 60 · 120 · 250 · 500 · 1.000 | ≈2 años |
| `repartos` | 1 · 5 · 15 · 40 · 100 · 250 · 500 · 1.000 · 1.750 · 2.500 | ≈2 años |
| `nocturnos` | 1 · 2 · 5 · 10 · 20 · 35 · 60 · 90 · 130 · 180 | ≈3,5 años |
| `kilometraje` | Sale de `LevelScale.GoalThresholds()`, no tiene números propios | — |

Los primeros tres escalones de cada una caen en la primera semana: ahí está el
enganche. **Toda pista contable empieza en 1** — la primera vez que hacés algo,
algo se prende.

**La EXP mide esfuerzo, no cantidad** (`ExperienceScale`, en el dominio):

    viaje  =  10 de base  +  1 cada 10 km      escalón = 100

Un viaje de 20 km paga 12, uno de 300 km paga 40. El piso de 10 existe para que un
reparto de cuatro cuadras no dé casi cero, y se **trunca**: 19 km pagan lo mismo
que 10, porque redondear hacia arriba le cobraría a un viaje de 5 km un tramo que
no hizo. El escalón tiene que ganarle al viaje más largo que lleva a él —hay un
test que lo fija contra los 300 km—; si no, el camino valdría más que llegar.

**No compite con el nivel aunque los dos miren la distancia**: el nivel se calcula
del total acumulado y no se puede perder ni comprar; la EXP se paga por viaje. Uno
dice hasta dónde llegaste, el otro cuánto hiciste.

**Lo ya acreditado no se reescribe.** El libro es un registro de hechos: las
entradas viejas conservan sus 20 y 50. La cuenta demo sigue mostrando 120 EXP.

### El carnet — 11/09/2026

Pantalla nueva, con **cuatro columnas nuevas en una migración** (`AddCarnetFields`):
`DriverProfile.BirthDate` (`DateOnly?`) y `TruckProfile.Brand/Model/Plate`. Reglas
en el dominio con sus tests: `LicensePlate` (formatos argentinos, canónica vs.
estampada) y `BirthDate` (plausibilidad, sin mínimo de edad). Los endpoints
devuelven **400 con el motivo** por `ValidationProblem`, y `api.js` ya lo muestra.

**Trampas que aparecieron:**

- **El transporte de la herramienta se come las barras invertidas** en los
  scripts: `̀` llegó como el carácter real y `p` como `p`. Para escribir
  una barra en un archivo desde un script, `String.fromCharCode(92)`. Para
  sacar acentos, `/p{M}/gu` y no un rango de combinantes.
- **Importar un módulo con cache-buster crea OTRA instancia**, sin la sesión.
  Para usar la `api` de la app desde la consola, `import('/js/api.js')` sin
  `?v=`: es la misma instancia, con su token.
- **La captura de pantalla del panel toca la página para enfocarla**, y si el
  toque cae sobre algo tocable —la tarjeta del carnet— lo activa. Verificar el
  estado por el DOM, no por la captura.
- **`DateOnly` cruza el JSON como `AAAA-MM-DD`** y SQLite lo guarda como texto sin
  conversor. Hay test que lo fija: lo que cruza una frontera se prueba cruzándola.
- **"Igual a la referencia" quiere decir copiar, no interpretar.** El primer carnet
  salió con la foto al 17% del ancho, el chip como un rectángulo con rayitas y
  dos tipografías, y el usuario lo devolvió. Antes de maquetar contra una
  imagen: **medir** qué fracción ocupa cada pieza, **contar** las tipografías, y
  reproducir la distribución. Ver `diseno-camiones-app` §7bis.

### La lección del 10/09: un test puede pasar por el motivo equivocado

Dos veces en la misma sesión, y las dos dan confianza falsa:

**El endpoint de equipar devolvía 500 y no equipaba nada.** Los siete tests del
lector pasaban porque le pasan el enum **ya construido y se saltean el JSON**. Por
HTTP, `System.Text.Json` no convierte la cadena a enum sin que se lo pidan. Es la
misma lección de las cinco fallas de la costura nativa-web, en una frontera nueva:
**lo que cruza una frontera hay que probarlo cruzándola.**

**Un test de clave duplicada probaba a EF, no al esquema.** EF detecta la clave
repetida en su **rastreador en memoria** y tira `InvalidOperationException` antes
de tocar la base. Para probar que el esquema lo impide hay que
`ChangeTracker.Clear()` primero, y entonces sí llega el `DbUpdateException`.

### Verificado en el teléfono el 01–02/09/2026 — el usuario tocando la app

**Esta tanda la probó una persona, no un script**, y por eso vale distinto:

| Qué | Resultado |
|---|---|
| Selector de la agenda de Android | abre la agenda y devuelve el contacto |
| Los 3 contactos guardados | **sobreviven a cerrar y abrir la app** — la razón por la que viven en el servidor |
| Tocar un contacto | abre el discador con el número puesto, sin llamar |
| Modo reparto de punta a punta | carga paradas, calcula, **arranca en modo GPS** |
| La hoja con muchas paradas y con alternativas | no se sale de la pantalla; la acción queda alcanzable |
| Separación de los controles del mapa | con aire, ya no amontonados |
| El formulario de contactos | con la estética del resto de la app |

**Y encontró seis defectos que ningún test habría atrapado**, todos ellos de "cómo
se ve y cómo responde en un teléfono concreto". Están enumerados en la lección de
más abajo.

### Verificado en el teléfono el 01/09/2026

APK de Release instalado con `adb install -r` (30,2 MB) sobre la versión anterior,
sin desinstalar:

| Qué | Evidencia |
|---|---|
| Arranque y conexión | `resultado: alcanzable=True motivo=ninguno` |
| Errores de JavaScript y crashes | **ninguno** |
| Zonas de riesgo, radares y símbolos rediseñados | vistos en el APK, no sólo en el navegador |

**Lo que quedó sin ver en el teléfono de esa tanda**: el modo reparto, el selector
de alternativas y los pasos a nivel entrando y saliendo del viaje. Se verificaron
end-to-end **en el navegador** — reparto con cuatro paradas reordenadas a
Caseros → Corrientes 5500 → Rivadavia 11000 → Cabildo 2000, con sus marcadores
numerados — pero no se tocaron en el APK.

### Verificado en el teléfono el 31/08/2026 — barrido completo

Con la app instalada de cero y el log limpio, sin un solo error:

| Qué | Evidencia |
|---|---|
| Conecta sin dirección escrita a mano | `fijada a mano: False`, 84 ms |
| Interfaz | `interfaz cargada`, **cero errores de JavaScript** |
| Crashes nativos | ninguno |
| Brújula | `rot_vec registrado=True`, `declinacion=-10.3` (correcta para CABA) |
| GPS | permiso OK, última conocida + alta precisión, un solo ciclo de registro |
| Actualizar sin desinstalar | `adb install -r` → `Success` (AD-35) |
| Viajes abiertos colgados | 0 de 28 |

Confirmado además por el usuario tocando: botón *Salir*, arrastre del mapa, zoom
con + y −, y las cruces de origen y destino.

**`Token expired` en el log del backend NO es un bug**: el cliente pide un
`refresh`, reintenta una vez y sólo cierra sesión si eso falla, con guarda contra
bucles. Los otros dos avisos del backend —SMTP sin configurar y el *override* del
bind a `0.0.0.0:5080`— también son esperados.

### Verificado en el teléfono el 26/08/2026

- **La app entra y conecta.** Costó una noche: ver AD-33, cuatro fallas
  encadenadas que la dejaban inutilizable con una dirección mal escrita.
- **El ruteo desde el teléfono funciona end-to-end**: GraphHopper sirvió cinco
  rutas de camión con el custom model completo, en 7–78 ms.

### Verificado con rigor

- **Motor de navegación** (`wwwroot/js/navigation.js`): recorrido sintético de
  1051 posiciones sobre ruta real; distancia calculada 26.260 m contra 26.256 m
  de GraphHopper (**4 m de error en 26 km**); robusto a ±30 m de ruido; detección
  de desvío 0→1→2→3 strikes con enfriamiento; avisos de 35 apelotonados a 26 con
  220 m de separación mínima.
- **Backend completo**: **216 tests unitarios + 79 de integración** (11 contra
  GraphHopper real). Flujos end-to-end por HTTP: alta, verificación, login,
  perfil, alias único, camiones, propiedad, viajes, acreditación de km, contactos
  de emergencia y paradas del reparto. Los unitarios incluyen 17 de la política de
  reintentos, 11 del orden de alternativas, 14 del orden del reparto y 20 de los
  contactos; **tres de esos grupos enlazan archivos de Mobile**, que a propósito no
  depende de MAUI.
- **62 tests de JS** (`node --test`): motor de guiado, avisos de ruta, el puente de
  la agenda y el número listo para marcar. Fue un test —y no el teléfono— el que
  encontró que `Number(null)` es 0 y no `NaN`, con lo que un gálibo sin altura
  declarada se habría avisado como *"puente de 0,00 m, no pasás"*.

**Lo que los tests SÍ atrapan y lo que no.** Los 265 cubren reglas de dominio y
lógica pura, y ahí son buenos. **No cubren nada de lo que cruza hacia Android ni
de cómo se ve una pantalla**, y esa frontera es más ancha de lo que parece: no es
sólo "el puente", es también qué apps existen en *ese* teléfono, qué acepta *ese*
discador y cómo cae el layout en *esa* pantalla. Ver la lección de más abajo.
- **Datos del mapa**: medidos contra Overpass el 24/08/2026, dentro del límite
  administrativo de CABA.

### NO verificado

- **El despliegue, a medias.** El workflow **corrió por primera vez el 10/09/2026**
  (`16febd3`) y el resultado fue el mejor posible dadas las circunstancias:

  | Trabajo | Resultado |
  |---|---|
  | **Recortar el AMBA** | ✅ **todos los pasos**, 4 min 39 s |
  | Construir y publicar (arm64) | ❌ cortó en `Bajar el mapa base`, 9 s |

  **Probado de verdad**: la verificación del `config-truck.yml`, los 408 MB de
  Geofabrik con su caché, **Osmosis corriendo en Linux** —que era el cambio
  riesgoso, de `.bat` a script de shell—, el recorte, el control de tamaño, el
  traspaso del artefacto entre trabajos, el runner ARM y el jar de GraphHopper.

  **Sin probar todavía**: la importación del grafo adentro del `docker build` y el
  push a GHCR. Las dos están detrás del mismo bloqueo: **falta publicar
  `amba.pmtiles` como release con el tag `mapa-base-amba`**. Es un paso manual de
  dos minutos y desbloquea el resto del workflow.

  Y `deploy/` **nunca se levantó**: esta máquina no tiene Docker.
- **El disparador incluye `cuentas-de-usuario` a propósito y es temporal.**
  Disparando sólo en `main` el workflow no podía correr nunca, y el botón de *Run
  workflow* tampoco aparece —GitHub sólo lo muestra para workflows que existen en
  la rama por defecto—. **Al fusionar a `main`, sacar esa línea.**
- **La instancia de Oracle no existe todavía**: A1 respondió *out of capacity*.
  Sin ella no hay backend público.
- **La progresión con kilómetros de verdad.** El viaje de prueba acreditó **0 km**
  porque se cerró al instante y `TripCrediting` exige que pase la mitad de la
  duración estimada. Que la barra de nivel se mueva de verdad hay que verlo
  manejando, como todo lo demás.
- **Nada de la progresión se probó en el teléfono.** Todo fue por API y por el
  navegador de escritorio, que es exactamente la franja donde este proyecto ya se
  equivocó once veces.
- **Navegación manejando.** Nunca se probó en movimiento, y a esta altura es
  **lo único que falta para cerrar la Fase 1**: que la flecha siga al camión, que
  hable en los giros, que el servicio sobreviva a apagar la pantalla, que el
  nombre verde se lea a velocidad, y que el **modo reparto** y el **selector de
  alternativas** se usen con las manos ocupadas.
- **La vibración nunca se sintió.** Compila, instala y no rompe nada, pero que el
  teléfono efectivamente vibre y que los cuatro patrones se distingan sólo se
  comprueba manejando (AD-39).
- **El APK instalado apunta a una IP de la red de casa.** En la calle no va a
  tener backend: hace falta `demo-up.ps1` y recompilar con esa URL de túnel, o
  quedarse en la red de casa para la primera vuelta.
- **La brújula en el soporte del camión.** El usuario la probó en el teléfono el
  26/08/2026 y reportó que **funciona** —dial, cardinal y cono—, pero con el
  aparato en la mano. Falta el caso que motivó no usar `Compass` de MAUI: el
  teléfono **parado en un soporte de parabrisas** (AD-30). Ahí es donde el eje
  cambia, y ahí es donde se sabrá si el trabajo extra valió la pena.
- **La app en el teléfono, salvo lo que reportó el usuario** — que al 02/09/2026
  ya es bastante: ver la tabla de arriba.
- **Las alternativas y los pasos a nivel dentro y fuera del viaje**, probados en
  el navegador y no en el APK.
- **Los tres contactos de emergencia, EN una emergencia.** Se probó que guardan,
  sobreviven a reinstalar y abren el discador. No se probó lo único que importa:
  que alguien pueda usarlos con las manos temblando y sin mirar. Eso tampoco se
  prueba manejando — se prueba el día que hace falta, y ahí no hay segunda vuelta.
  Es un argumento para no complicar esa pantalla nunca.

**Cuando el pedido es visual, la referencia visual manda.** El usuario pidió dos
veces inspirarse en un mapa que compartió, y las dos veces el trabajo se fue a la
metodología del dato —qué contar, cómo normalizar— antes que al aspecto. Textual:
*"tenías que orientarte más en lo visual del mapa de maps que en los datos de
robo"*. Costó rehacer las zonas enteras. Es la lección más cara de la sesión del
01/09/2026 y no es sobre zonas de riesgo: es sobre cómo leer un pedido.

**Ya no es cierto que el mapa no se pueda ver.** Esta skill decía que el panel de
navegador no componía frames y que las capas estaban "servidas pero no vistas".
El 01/09/2026 el mapa renderizó, cargó tiles y se pudo iterar el diseño a fuerza
de capturas. **Dos cuidados** al hacerlo:

- El mapa tarda en componer: una captura tomada enseguida sale a medio dibujar y
  se lee como "el cambio no funcionó". Esperar y volver a capturar.
- El **módulo ES queda cacheado** aunque se edite el archivo y se haga
  Ctrl+Shift+R. Se calibra a ciegas contra código que ya no existe. Para
  verificar de verdad: `import('/js/layers.js?v=' + Date.now())`.

Para inspeccionar el estado real del mapa desde la consola, el objeto no está
expuesto; se captura parcheando el prototipo:

```js
const orig = maplibregl.Map.prototype.setPaintProperty;
maplibregl.Map.prototype.setPaintProperty = function (...a) { window.__map = this; return orig.apply(this, a); };
(await import('/js/map.js')).refreshColors();   // dispara la captura
maplibregl.Map.prototype.setPaintProperty = orig;
```

Con `window.__map` se puede leer `getStyle().layers`, escuchar `map.on('error')`
—que es por donde MapLibre reporta los estilos inválidos, **no por excepción**— y
probar valores en vivo con `setPaintProperty` sin recompilar nada.

### La lección más cara del proyecto, y ya se pagó once veces

**Todo lo que es "cómo se ve y cómo responde en un teléfono concreto" hay que
hacerlo tocar por una persona.** No es una recomendación de prolijidad: es
estadística de este proyecto.

Los seis del 01–02/09/2026, todos con los tests en verde:

| Defecto | Qué pasaba |
|---|---|
| El selector abría **el explorador de archivos** | `ACTION_PICK` sobre el URI de contactos ni ofrecía la agenda en ese equipo |
| `ResolveActivity` decía "no hay agenda" | Con la agenda instalada. **El chequeo defensivo introdujo el fallo que venía a evitar** |
| El discador **no se abría nunca**, ni con el 911 | `PhoneDialer` de MAUI no hacía nada, sin excepción y sin rastro |
| El formulario sin estilos | Faltaban las clases `.field`/`.input` que ya existían |
| La hoja **112 px fuera de pantalla** | `flex: none` no la dejaba encogerse |
| Los controles del mapa **pegados, 0 px** | La separación era un resto de `margin: auto`, no una separación |

Y los cinco anteriores estuvieron **todos en la costura entre la cáscara nativa y
la web**. Cuando se toque esa costura, asumir que va a fallar y **pedirle al
usuario el mensaje de error textual**: cada uno descartó una capa.

**Tres reglas que salieron de esta tanda:**

1. **Loguear ANTES de la acción, no sólo el resultado.** El discador no dejaba
   rastro hasta que alguien elegía, así que cuando abrió la app equivocada el log
   estaba vacío y no había por dónde empezar. Hoy `call()` loguea el pedido y la
   cáscara loguea antes y después del Intent: el próximo fallo dice si se cortó en
   el JavaScript, en el puente o en Android.
2. **No mezclar un arreglo verificado con una mejora no pedida.** El
   `ResolveActivity` se agregó "ya que estoy" junto al arreglo del Intent, y rompió
   el arreglo. Si el arreglo después falla, no se sabe cuál de los dos fue.
3. **No inferir lo que el usuario no dijo.** Se dio por hecho que el 911 funcionaba
   —sólo porque no lo había mencionado— y sobre esa inferencia se construyó una
   explicación completa y elegante del espacio en el URI, que encajaba perfecto
   porque el 911 es el único número sin espacios. **Era falso.** El razonamiento
   era bueno y la evidencia, inventada. Ver AD-43.

La cuarta (25/08/2026) fue `confirm()`: el WebView no lo dibuja y devuelve `false`
en silencio, así que *Terminar viaje*, *Cerrar sesión* y *Borrar camión* parecían
botones muertos. **Nada en el navegador de escritorio lo delata**: ahí funciona.
Al escribir código para la web que corre adentro del APK, preguntarse siempre qué
API del navegador se está dando por sentada. Ver AD-28.

La quinta (25/08/2026) fue el GPS: proveedor crudo en vez del combinado, sin usar
la última posición conocida, y una pantalla que no cambiaba nada hasta el primer
fix. Ver AD-29.

### `dumpsys location` es la herramienta de diagnóstico del GPS

Lo que cerró el caso del arranque lento, y sirve para cualquier duda de ubicación:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "dumpsys location | grep -E 'provider|trucknavigator'"
```

Da, sin ambigüedad: **qué proveedores están habilitados** en ese teléfono
—`network provider: enabled=false` fue el hallazgo—, **cuántas posiciones recibió
cada cliente** (`locations = 0` contra `locations = 465`), la **última posición
conocida**, y un historial con marca de tiempo de cada alta y baja de registro.
Dos altas seguidas separadas por exactamente 15 s con cero posiciones es la firma
de un `GetLocationAsync` expirando.

Complementos: `dumpsys activity services <paquete>` para ver si el servicio en
primer plano está vivo y desde cuándo, y `ls -lt /data/anr/` para ANRs.

### "No se pudo conectar al servidor": probar desde el teléfono, no deducir

Confirmado el 26/08/2026. El síntoma casi siempre es la **IP vieja grabada en el
APK** tras un cambio de red, pero antes de recompilar conviene probar de verdad,
porque hay dos espejismos que llevan por el camino equivocado:

- **`ping` desde el teléfono a la máquina falla SIEMPRE**, aunque todo ande:
  Windows bloquea ICMP por defecto en todos los perfiles. Un 100% de pérdida
  **no prueba nada**.
- **El perfil de red suele ser "Public"** al entrar a una WiFi nueva, lo que
  asusta, pero la regla `TruckNavigator API 5080 (dev)` ya cubre ese perfil.
  Verificar con `Get-NetFirewallProfile` que `DefaultInboundAction` no esté en
  `Block` y con `Get-NetFirewallAddressFilter` que el `RemoteAddress` de la regla
  incluya la subred de hoy — está limitado a una subred, así que **cambiar de red
  puede dejarlo afuera**.

La prueba que sí sirve es TCP desde el propio teléfono, con `toybox nc`
(`curl` no existe en Android):

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "toybox nc -w 5 192.168.100.106 5080 < /dev/null; echo `$?"
```

`0` es que llegó, distinto de `0` es que no. **Y validá el instrumento**: la misma
prueba contra un puerto cerrado (`9999`) y una IP inexistente tiene que dar `1`.
Sin ese control, un `nc` que siempre devuelve 0 lleva a una conclusión falsa.

No usar `echo -e 'GET ...'` para armar el pedido HTTP: el shell de Android no
interpreta esos escapes y `nc` conecta pero manda basura, con lo que parece que
el servidor no contesta. Va `printf`.

### Cuando la WiFi no sea opción: túnel por USB

```powershell
& $adb reverse tcp:5080 tcp:5080
& $adb reverse tcp:8989 tcp:8989
```

El `localhost` del teléfono pasa a ser el de la máquina. Se configura la app con
`http://127.0.0.1:5080` y anda sin depender de la red ni del firewall — sirve
para probar de escritorio, no para manejar.

### Adentro del APK ahora SÍ hay log — usalo antes que nada

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb logcat -c                          # limpiar antes de reproducir
& $adb logcat -s Web Cascara Brujula
```

| Etiqueta | Qué trae |
|---|---|
| `Web` | **la consola del WebView**, o sea la interfaz entera, con archivo y línea |
| `Cascara` | el puente nativo: configuración, posiciones, brújula, fallos al evaluar JS |
| `Brujula` | cada rumbo calculado, con inclinación y declinación |

Esto no existía hasta el 25/08/2026 y **es la causa de fondo de que las cinco
fallas de la costura nativa-web costaran tanto**: MAUI no instala
`WebChromeClient`, y sin uno Android descarta los mensajes de consola en
silencio. Ver AD-31.

**Verificado andando el 28/08/2026** en el Xiaomi de prueba. La sospecha de que
MIUI filtraba los logs de terceros —que quedó anotada un día en la
documentación— **era falsa**: el 26/08 la app no pasaba de la pantalla de
conexión, así que no llegaba a ejecutarse ninguna línea que logueara. Ausencia de
salida no era ausencia de puente. Lo que lo descartó fue reproducir con el log
limpio (`logcat -c`, `am force-stop`, `am start`), no razonar mejor.

**Y no diagnostiques con `Debug.WriteLine`**: lleva `[Conditional("DEBUG")]`, el
compilador borra las llamadas en Release y los mensajes desaparecen justo en el
APK que se instala en el teléfono. Va `Android.Util.Log`.

### `dumpsys sensorservice` es el equivalente para la brújula

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "dumpsys sensorservice | grep -B1 -A1 trucknavigator"
```

Tres secciones sirven, y conviene mirarlas en este orden:

- **`Sensor List`** dice qué trae el equipo. En el teléfono de prueba (Xiaomi
  `24117RN76L`, medido el 25/08/2026) están los tres que importan: `mmc5603`
  (`magnetic_field`), `rot_vec` (`rotation_vector`, 5–200 Hz) y `geo_rotvec`
  (`geomagnetic_rotation_vector`, el respaldo). Con giróscopo, así que el vector
  de rotación es el fusionado.
- **`Active sensors` / `Connection Number`** dice si la app está enganchada
  **ahora**: tiene que aparecer una conexión de `ar.com.trucknavigator.caba` con
  `rot_vec`. Si no aparece con el mapa abierto, el sensor nunca arrancó.
- **`Previous Registrations`** es el historial con hora, en formato
  `(sensor, package)`. Altas y bajas sin lecturas en el medio son la firma de un
  registro que falla.

---

## 5. Decisiones tomadas con el usuario

- **Móvil primero.** Se corrigió a mitad de camino: la versión web es el
  subproducto, no el objetivo. Diseño mobile-first, artefacto primario el APK.
- **Sin paso de compilación** en el frontend. Módulos ES nativos, sin npm ni
  empaquetador. No agregar uno sin motivo fuerte.
- **Dos registros de comunicación.** El usuario lleva producto y tiene
  conocimientos básicos; un programador lee el detalle. Toda devolución larga
  debe separar visiblemente ambos.
- **Verificar, no especular.** Textual: *"no quiero que especules, prefiero que
  busques y confirmes"*. Medir contra la fuente y decir la fecha.
- **Google Maps es referencia para los POIs, nunca base que se copia
  (15/09/2026).** Cambió la regla que decía "nunca Google": textual, *"no es
  copiarle la base de datos, es solo la referencia que tenemos para usarlo de
  dato. Usa todas las líneas de acceso a la información que se te ocurra"*.
  Sólo para los POIs; mapa base y ruteo siguen siendo OSM. Coordenadas de OSM o
  de un registro oficial; lo que sale de una ficha o de reseñas, resumen propio
  con fecha. **Las reseñas de conductores cuentan como confirmación** —*"si hay
  reseña lo contamos como aprobado"*—, con la condición de decir *"según
  reseñas de conductores, consultadas el <fecha>"* y marcar apto sólo el tipo
  de camión que las reseñas mencionan. Alcance: **CABA más un anillo de ~2 km**
  (colectoras de la General Paz, Mercado Central, Dock Sud); no es tocar el AMBA.
  Ver `data-sources.md` "Puntos de interés" y la spec del 15/09.
- **Regla de acreditación de km aprobada.** Media duración estimada. Textual:
  *"preferible ese abuso antes que romper la app"*. Revisar en Fase 1 con el
  trazado del GPS.
- **Estética:** seria pero dopamínica. Resuelto como **dos intensidades**: el
  mapa es sobrio, la progresión trae el color. No es sólo estético — impide que
  lo gamificado se filtre a la pantalla que se mira manejando.
- **El AMBA entra cuando esté su base de datos, y hasta entonces no se toca
  nada de ese sector.** Textual (01/09/2026): *"no quiero tocar ni romper nada en
  ese sector hasta tener la base de datos"*. Al salir al público la app tiene que
  cubrir el AMBA; la información está en recopilación. **L-11 está congelada por
  esto, no por olvido.**
- **Cuando algo se pospone por tamaño, vale preguntar si adentro hay una pieza
  compartida y chica.** La Fase 3 se descartó por esfuerzo, pero el usuario pidió
  igual el **puente de la agenda** —que lo necesitan sus dos ítems grandes—, y en
  cuanto lo vio funcionar en el teléfono pidió la funcionalidad completa. La pieza
  chica andando destrabó el trabajo grande.
- **La prueba manejando es del usuario y no se puede sustituir.** Lo dice él y lo
  confirma el registro: *"falta probarlo en viaje como todo lo demás que incluye
  probar andando"*. No proponerla como tarea propia ni darla por hecha.
- **Cuando el pedido es VISUAL, la referencia visual manda.** Pasó dos veces con
  las zonas de riesgo: el usuario pidió inspirarse en un mapa que compartió y el
  trabajo se fue a la metodología del dato. Textual: *"tenías que orientarte más
  en lo visual del mapa de maps que en los datos de robo"*. Y una tercera con el
  formulario de contactos, que salió sin las clases que ya existían: **antes de
  inventar estilo, mirar cómo se ve el resto de la app**.
- **Una función está lista cuando cierra el trabajo de la persona, no cuando la
  pantalla responde.** El modo reparto se declaró completo en AD-41 y **calculaba
  pero no navegaba** — o sea la mitad. Se había probado end-to-end en el navegador,
  pero ese ciclo terminaba donde termina la pantalla, no donde termina el trabajo
  del camionero. Ver AD-45.
- **Identidad de git del repo:** `Tobias Bermejo <bermejotobias@gmail.com>`
  (verificado el 01/09/2026 con `git config user.name`; esta skill decía
  `bermejolautaro <tarolau97@hotmail.com>`, que es el dueño del remoto `hermano`).
- **Convención de código:** nombres de tipo **en inglés**, comentarios y docs en
  español, **sin acentos dentro de los `.cs`**. Rutas de API en inglés.
- **La clave de firma de desarrollo se queda como está, y no se respalda todavía.**
  Decisión del usuario, 10/09/2026. Hoy la app está instalada en **un solo
  dispositivo**, el del equipo que prueba, así que perder la keystore cuesta una
  desinstalación y nada más.

  Los datos, para no volver a averiguarlos: vive en
  `%LOCALAPPDATA%\TruckNavigator\firma-desarrollo.keystore`, alias
  `trucknavigator`, y su contraseña es `camiones-dev` — **el valor por defecto
  escrito en `build-apk.ps1`, o sea que está en el repositorio, que es público**.
  Por eso esta clave sirve para continuidad pero **no para distribuir**.

  **Generar otra es trivial** (`build-apk.ps1` acepta `-Keystore` y
  `-KeystorePassword`, o la variable `TRUCKNAVIGATOR_KEYSTORE_PASS`). Lo que
  cuesta no es generarla: es que cambiar de clave obliga a **desinstalar** a todo
  el que ya la tenga. Por eso el momento a cuidar **no es publicar en Play, es el
  primer reparto**. Hasta entonces cambiar es gratis.

  Y si algún día va a Google Play, **Play App Signing** reduce mucho el escenario
  catastrófico: Google guarda la clave final y puede resetear la de subida.

  **No volver a proponer respaldarla**: ya se planteó y se decidió con motivo.
- **El v3 trajo doce decisiones de producto y NO se repiten acá.** Viven en
  `producto-camiones-app` §2 bis: la escala de niveles, el zócalo que se esconde en
  el GPS, la batería sólo en juegos, el idioma único, el invitado que no escribe en
  el servidor, los logros por escalones, los récords personales, el vocabulario de
  reportes, y que los cofres quedan guardados como concepto. Duplicarlas acá sería
  pedir que diverjan.
- **Preguntar en vez de intuir.** Textual del usuario (09/09/2026): *"preguntame
  si necesitas detalles y no estes intuyendo"*. Vino después de presentar como
  propuestas cosas que eran invenciones —las ranuras del avatar, el modelo de
  metas, la retroactividad—. Lo que se decide solo hay que **marcarlo como tal**, y
  lo que es de producto se pregunta.
- **Los escalones y la EXP ya no son provisorios: los eligió el usuario el
  10/09/2026**, sobre opciones. Ver "Escalas del motor" abajo.
- **Una escala hay que calibrarla contra la realidad que mide, no contra las otras
  escalas.** Las tres escaleras contables tenían la misma forma, y eso las dejaba
  mal calibradas en direcciones opuestas: con una cadencia real de oficio,
  `repartos` se agotaba en cuatro meses y `nocturnos` tardaba más de seis años.
  **La misma escala para actividades de cadencia distinta no es coherencia, es no
  haber mirado.** Lo mismo valía para la EXP: un viaje de 300 km y uno de 20 km
  pagaban los dos 20.
- **Los códigos de recompensa son sistemáticos** (`viajes-01`, `nocturnos-01`), no
  objetos diseñados. Es a propósito: la extensión del v3 §7 prohíbe aproximar nada
  visual antes de tener las referencias del usuario. Cuando existan los dibujos, el
  catálogo mapea código a asset sin tocar arquitectura.

---

## 6. Trampas del entorno — releer antes de perder tiempo

### La máquina

- **Node 24.19 y npm 11.17 SÍ están instalados** (verificado el 26/08/2026; la
  nota anterior decía lo contrario y estaba vieja, y esa creencia costó no tener
  tests sobre el motor de guiado). No hay Python. **Ya hay 62 tests de JS**:
  `node --test "tests/web/*.test.mjs"`, con el runner que trae Node, **sin una
  sola dependencia** — no hay `node_modules` ni `npm install`, y el `wwwroot` que
  se sirve y se empaqueta es idéntico con o sin ellos. Ver AD-32. Cubren
  `navigation.js`, que es puro; los módulos que tocan el DOM quedan afuera porque
  necesitarían un DOM simulado, o sea una dependencia.
- **El SDK de Android puede perder la plataforma que el proyecto necesita.** El
  28/08/2026 el build murió con `XA5207: no se encuentra android.jar para el nivel
  API 36`: en `%LOCALAPPDATA%\Android\Sdk\platforms` sólo quedaba `android-37.0`,
  porque una actualización del SDK Manager reemplazó la 36. **No retargetear el
  proyecto para esquivarlo** —`targetSdk` cambia el comportamiento del servicio en
  primer plano y sus permisos (AD-24), y el workload instalado es el de la 36—. Se
  reinstala la que falta:

  ```powershell
  dotnet build src/TruckNavigator.Mobile -t:InstallAndroidDependencies -f net10.0-android `
    -p:AndroidSdkDirectory="$env:LOCALAPPDATA\Android\Sdk" -p:AcceptAndroidSDKLicenses=True
  ```

  Tarda ~30 s. No hay `sdkmanager` en `cmdline-tools/latest/bin`, así que este es
  el camino.

- **PowerShell 7**, no 5.1 — la skill decía 5.1 y era falso. Verificado el
  10/09/2026: `&&`, `||`, el operador ternario y `??` funcionan. Los avisos sobre
  `$PSScriptRoot` y el desenrollado de arrays que siguen abajo **valen igual**,
  porque no dependen de la versión.
- **El backend corriendo BLOQUEA los DLL y el build falla.** Costó dos veces en la
  misma sesión: `MSB3027 ... El archivo se ha bloqueado por: "TruckNavigator.Api"`.
  Antes de compilar hay que pararlo. Se mata buscando el proceso por su línea de
  comando:

  ```powershell
  Get-Process -Name dotnet | ForEach-Object {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    if ($cmd -like "*TruckNavigator.Api*") { Stop-Process -Id $_.Id -Force }
  }
  ```

- **Los mensajes de commit largos van por archivo, con `git commit -F`.** El
  guardián del entorno **lee rutas dentro del texto del mensaje** y aborta el
  comando entero con un falso positivo (`Remove-Item on system path ... is
  blocked`) si el mensaje menciona algo que parece una ruta. Se escribe el mensaje
  a un archivo del scratchpad y se commitea con `-F`.
- **No se puede leer la base SQLite desde PowerShell.** El proveedor necesita su
  DLL nativa `e_sqlite3` y no resuelve por más que se carguen los ensamblados a
  mano. Para inspeccionar datos reales, el camino que sí funciona es **levantar el
  backend y pegarle a la API**.
- **`dotnet-ef` está instalado** en `~/.dotnet/tools`, versión 10.0.11. Las
  migraciones se crean con:

  ```powershell
  dotnet ef migrations add <Nombre> --project src/TruckNavigator.Infrastructure `
    --startup-project src/TruckNavigator.Api --output-dir Persistence/Migrations
  ```
- **`$PSScriptRoot` viene vacío dentro del bloque `param()`** → una ruta relativa
  con `..` se ancla en la raíz del disco y el script escribe en `C:\src\...`
  informando éxito. Calcular la ruta en el cuerpo, con `$PSCommandPath`.
- **`Select-Object -First N` corta el pipeline y MATA el proceso de arriba.** Se
  usó para acortar la salida de `build-apk.ps1` y PowerShell abortó la compilación
  a mitad de camino **saliendo con código 0**: parecía que había compilado, y se
  instaló el APK viejo. Para recortar salida sin cortar el proceso va
  `Out-String -Stream | Where-Object`, o `| Select-Object -First N` **después** de
  que el comando terminó.
- **PowerShell desenrolla los arrays anidados de un nivel.** `, $geometry.coordinates`
  no preserva la anidación de un polígono, y el síntoma fue "ninguna zona toca
  CABA" con el dato perfectamente bien. Escribir los casos aparte, y **poner un
  control del instrumento**: `fetch-zonas-riesgo.ps1` prueba cuatro puntos de
  coordenadas conocidas —Obelisco y Villa Soldati adentro, Avellaneda y Vicente
  López afuera— y **tira excepción** si el límite no los clasifica bien. Sin ese
  control, un filtro geográfico roto se ve igual que un dataset vacío.
- **Archivos con CRLF.** Los regex de perl con `$` al final o `\n` multilínea
  **no matchean**. Usar `\r?$`, o reconstruir el archivo con `head`/`sed`.
- **perl con acentos** rompe: `ó` son dos bytes y `(.)` matchea uno solo. Para
  texto acentuado usar `printf` con bytes explícitos o la herramienta de edición.
- **Heredocs de bash** pueden fallar con ciertos contenidos JS/C#. Ante un
  `unexpected EOF`, usar la herramienta de escritura directa.

### El navegador de la sesión

- **Sí compone frames y sí hay capturas** — la nota anterior decía lo contrario y
  quedó vieja. Pero `map.on('load')` puede no disparar y los clicks son poco
  confiables: para flujos largos conviene manejar la app por `javascript_tool`.
  Y el mapa **tarda en componer**: una captura tomada enseguida sale a medio
  dibujar y se lee como "el cambio no funcionó". Esperar y volver a capturar.
- **Cachea módulos ES agresivamente**, incluso con `no-cache`. Para probar un
  módulo recién editado, importarlo con `?f=<timestamp>`.
- **Límite de 30 s por ejecución.** Partir los flujos largos.
- **No avanza las animaciones CSS con el panel oculto: quedan congeladas en su
  primer frame.** Costó perseguir un desfase de 14 px que no existía: la hoja
  tiene `animation: sheet-in`, que arranca en `translateY(14px)`, y al medir
  aparecía siempre corrida hacia abajo. Anulando la animación caía exactamente
  donde debía. **Antes de perseguir una diferencia de pocos píxeles, fijarse si el
  elemento tiene animación de entrada.**
- **Las coordenadas de un `screenshot` envejecen.** Un clic por coordenada tomada
  de una captura anterior puede caer en el botón de al lado —pasó: cayó en
  *Cancelar* en vez de *Guardar*, y pareció que el alta estaba rota—. Para
  interactuar, `find` / `read_page` y clic **por `ref`**, que no se desplaza.

### Overpass

- Rate limit frecuente (429). Reintentar con espera; `https://overpass-api.de/api/status`
  informa los slots.
- El query va como **campo `data` de un formulario**, no como cuerpo crudo (si no, 406).
- Consultar contra el **límite administrativo** (`admin_level=4`), no un
  rectángulo: el rectángulo mete conurbano (501 pasos a nivel contra 312 reales).

### ASP.NET Core y MapLibre

- **No sirve extensiones desconocidas**: `.geojson` y `.pbf` dan 404 con el
  archivo en su lugar. Declarar el tipo MIME.
- **Sin `glyphs` MapLibre no dibuja ni una letra.** Fuentes vendorizadas en
  `wwwroot/fonts`, carpetas **sin espacios**.
- **`Style is not done loading`**: agregar capas antes de que cargue el estilo
  falla. Esperar `once('idle')`. Y **no envolver el alta de capas en el mismo
  `catch` que la descarga** — confundirlas oculta el problema.

### MapLibre: los marcadores y su `position`

La biblioteca le pone `position: absolute` al elemento del marcador y lo ubica por
`transform`. **Declararle `position: relative` se lo pisa** y el marcador se cae
del mapa: queda apilado en el flujo del contenedor junto a los demás pines. Con un
solo marcador en pantalla la posición coincide igual, así que no se nota hasta que
hay dos. Para apilar cosas adentro de un marcador —un cono debajo de un punto— va
una grilla con `grid-area: 1 / 1`, no `position: absolute`.

### Android

- `targetSdk 36`. Un servicio en primer plano necesita
  `FOREGROUND_SERVICE_LOCATION`, `foregroundServiceType="location"` en el
  manifiesto **y** el tipo en `startForeground(...)`. Falta alguno → compila
  igual y el sistema lo mata.
- **No existe servicio en primer plano sin notificación.** No es opcional.
- El WebView sirve desde un **origen virtual `https`** → todo pedido al backend
  es cross-origin (CORS) y contenido mixto. Ambos hay que habilitarlos.
- **`_framework/hybridwebview.js` tiene que estar en el `index.html`.** Sin él no
  existe `window.HybridWebView`, la app cree estar en un navegador y le pega al
  origen virtual: **404 en todo**. Servido por HTTP ese archivo da 404 y está bien.
- **La página pide la configuración con `ready`**; el nativo no la empuja. El
  chequeo de conexión tarda menos que la carga del WebView y el mensaje se pierde.

---

## 7. Cómo levantar todo

```powershell
cd routing; .\run-graphhopper.ps1        # motor de ruteo en :8989
dotnet run --project src/TruckNavigator.Api   # backend + web en :5080
dotnet test                              # 295 tests (.NET)
node --test "tests/web/*.test.mjs"       # 62 tests de JS — correr desde bash
.\build-apk.ps1 -Push                    # APK de Release al teléfono
.\data\fetch-caba-map-layers.ps1         # regenera las capas del mapa
```

**Para probar desde el teléfono el backend debe escuchar en `0.0.0.0`**, no en
`localhost`. Sin `ASPNETCORE_URLS` usa el `appsettings` (`0.0.0.0:5080`), que es
lo correcto.

- El mail **no se envía** (sin SMTP): el enlace de verificación aparece en el log
  del backend. En `Production` el arranque corta si falta SMTP.
- **Cuenta de prueba en desarrollo**: `demo@camiones.test` / `camion2026`, sembrada
  por `DevUserSeed` sólo en `Development`. Mail confirmado y perfil completo
  (alias `demo`): entra directo al mapa sin buscar el enlace en el log.
- **La IP de la máquina cambia todo el tiempo. Verificarla SIEMPRE**, es lo
  primero de cada sesión:

  ```powershell
  (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' }).IPAddress
  ```

  Historial medido: `192.168.100.106` (24/08) → `192.168.1.78` (25/08) →
  `192.168.100.106` (26/08, a mitad de una sesión de pruebas) → `192.168.1.52`
  (28/08). La app deja corregirla desde *Configurar servidor*, y
  `network_security_config.xml` permite HTTP en claro a cualquier dirección, así
  que **no obliga a recompilar** — pero recompilar con `-ApiUrl` es más cómodo y
  se instala solo.

- **La regla de firewall `TruckNavigator API 5080 (dev)` está limitada a una
  subred**, y el 28/08 seguía apuntando a `192.168.100.0/24` estando la máquina en
  `192.168.1.x`. **Aun así el teléfono llegaba**, así que no dar por hecho que
  bloquea: medirlo con `toybox nc` antes de perseguir ese fantasma.
  Cambiar la regla es configuración de seguridad del sistema: pedírselo al
  usuario, no hacerlo.

- **Con el teléfono por USB hay un camino que no depende de la red ni del
  firewall**: `adb reverse tcp:5080 tcp:5080` y configurar la app con
  `http://127.0.0.1:5080`. Sirve para probar de escritorio; para manejar hace
  falta la IP de red.
- **`adb` está en `%LOCALAPPDATA%\Android\Sdk\platform-tools`**, no en el SDK de
  Visual Studio. `build-apk.ps1 -Push` busca en ambos desde el 25/08/2026.
- **El túnel de `demo-up.ps1`: si el hostname no resuelve, reabrirlo.** Confirmado
  el 25/08/2026. El DNS del ISP (vía router `192.168.1.1`) devolvió **NXDOMAIN**
  para el hostname nuevo de `trycloudflare.com`, mientras 1.1.1.1 y 8.8.8.8 sí lo
  resolvían — y `ipconfig /flushdns` no lo arregló, porque el caché negativo está
  río arriba. **Matar `cloudflared` y relanzarlo dio otro nombre que resolvió al
  instante.** Para separar DNS de conectividad sin adivinar:
  `curl --resolve <host>:443:104.16.230.132 https://<host>/api/health` — si eso
  responde, el túnel está bien y el problema es sólo de nombres.
  `cloudflared` se instala con `winget install --id Cloudflare.cloudflared` y
  queda en `C:\Program Files (x86)\cloudflared\`, que es donde el script lo busca.
- **`routing/config-truck.yml` apunta en el árbol de trabajo a
  `argentina-latest.osm.pbf`** y no a `amba-latest.osm.pbf` como en el commit: el
  recorte del AMBA no está en disco. Sin ese cambio local GraphHopper no arranca.

---

## 8. Lo que sigue

**Ya no hay nada de la Fase 1 que se pueda construir acá.** Lo único que queda es
probarla en movimiento, y eso es del usuario. Orden que más rápido descarta
problemas: ¿carga la interfaz? → ¿el GPS ubica? → **¿el dial de la brújula marca
bien con el teléfono en el soporte?** → ¿aparece la notificación al arrancar el
viaje? → **¿avanza la flecha tras apagar la pantalla un minuto?** → ¿habla en los
giros? → **¿vibra, y se distingue el patrón del gálibo del de doblar?**

Y el log, que es lo que va a decir dónde atacar sin tener que reproducir:
`adb logcat -s Web Cascara Brujula`.

**Lo acordado el 01/09/2026 ya se hizo**, y el resultado corrigió una prioridad:

- **L-11 quedó CONGELADA por decisión del usuario**, no hecha. No tocar nada del
  sector AMBA hasta tener su base de datos: el aviso de cobertura y la ampliación
  son el mismo trabajo, y hacerlo ahora significa escribir el límite en el código
  para reescribirlo entero después. **No volver a proponerlo**: ya se ofreció y se
  rechazó con motivo. Ver `data-sources.md` L-11.
- **Los 3 contactos de emergencia están hechos** (AD-42, AD-43) y verificados en
  el teléfono.

**Lo que queda, al 14/09/2026:**

**Del despliegue** — nada de esto depende de programar, y todo está bloqueando:

1. **Conseguir la instancia A1 en Oracle.** Respondió *out of capacity*. El stack
   está guardado, así que reintentar son dos clicks. Si no aparece, el plan B son
   los dos micros x86, que ya está pensado.
2. **Publicar `routing/amba.pmtiles` como release con el tag exacto
   `mapa-base-amba`.** El workflow lo busca por ese nombre y corta si no está.
3. **SMTP y DuckDNS.**

**De la gamificación** — el motor está, y de las pantallas:

4. ~~Elegir la tipografía~~ — **Nunito**, vendorizada el 10/09. Más **Space Mono**
   sólo para el carnet.
5. ~~El perfil~~ — **hecho el 10/09**, con la estructura de Duolingo. Absorbió el
   resumen. Lo que le falta: la recompensa dibujada junto a cada barra de meta
   (no hay arte) y el chevron de logros (no hay pantalla).
6. **La pantalla de Logros** (`diseno-camiones-app` §13): récords personales en
   fila horizontal y la grilla de 3 de la colección. Cuando exista, la fila de
   logros del perfil recupera su chevron, que hoy está sacado a propósito.
7. **El carnet está construido pero NO aprobado** (12/09): *"no me gusta pero por
   el momento vamos a dejarlo así"*. Cuando se retome, preguntar primero qué no
   le gusta. Quedan además la **vista pública** (endpoint + proyección sin la
   fecha de nacimiento) y **compartirlo como imagen**.
8. **De la Fase 7, el zócalo está hecho** (12/09, `js/dock.js`): cuatro accesos,
   se esconde durante el viaje, "Más" abre su hoja, y hay pantalla `juegos`
   "pronto". Ver `diseno-camiones-app` §4. **Queda** el flujo de entrada (intro →
   idioma → condiciones → acceso) y el **modo invitado**. Y una decisión chica:
   el **hamburguesa del mapa duplica a "Más"**; sacarlo es una línea.
9. ~~La pantalla de fin de viaje~~ — **hecha el 12/09** (`views/fin-viaje.js`),
   con el sistema de momentos de la mascota (`js/mascota.js`) y las insignias
   en pixel art con la escala de Duolingo (`js/logros.js`). El cierre del viaje
   ahora devuelve `earned`. **La mascota se ve y está aprobada (14/09)**: el
   usuario convirtió las hojas a PNG y `data/cortar-mascota.ps1` las cortó en
   **13 poses** (964 KB). Falta `neutro` —sólo existe con gorra MACK, marca
   ajena— y las hojas mezclan botas y descalzo. Ver `diseno-camiones-app` §12.
   **Falta verla en el teléfono al cerrar un viaje real.**
9b. **El prototipo de diseño está aprobado como dirección y NO se codifica
   todavía** (14/09). Está en `docs/diseno/prototipo/` y en el lienzo que
   enlaza su README. Ver `diseno-camiones-app` §16. Cuando el usuario diga,
   el orden es: vocabulario en `app.css` (vidrio, neón, cromo en tres tonos,
   chapa, globo, fichas, fila) → Bienvenida y Entrar → Perfil sin banda →
   festejos → el resto. **Racha, Metas y Logros no existen en código**: el
   prototipo es su primera definición.
10. **La vista pública del perfil** — endpoint para ver el perfil de otro
    usuario. El perfil se diseñó como público (*"visible para el resto de los
    usuarios"*), pero **no existe forma de que otro lo vea**. Sin esto, la
    comunidad no tiene con qué empezar.

**De antes, sin cambios:**

11. **Compartir viaje por WhatsApp** — lo último construible de la Fase 3. Necesita
   endpoint público de seguimiento, tokens que venzan y decisiones de privacidad:
   es un trabajo grande disfrazado de botón. **El puente de la agenda ya existe.**
12. **Fase 5 (reportes) y POIs valorados** — bloqueadas por decisiones del usuario,
   no por código: cuánto dura un reporte, cuántas confirmaciones lo validan, qué
   pasa con los falsos. Con el motor hecho, sumarlas es **una pista más en el
   catálogo**.
12b. **La interfaz de POIs en la app web** — la base está (15/09/2026, ver §4),
   **el sistema de votos y aportes también**, y **ninguna vista los muestra**:
   `api.js` tiene `pois`, `addPoi`, `votePoi` y `retirePoiVote`; no hay capa en
   `layers.js`. Lo que hay que construir: el botón *Lugares* con filtros por
   categoría, "solo aptos para mi camión" con el contador de ocultos, la ficha
   con la evidencia y su fecha **y el bloque de la comunidad** ("N camioneros
   como vos lo recomiendan", el voto propio, *aportado por la comunidad*), el
   botón de votar, el formulario de agregar (con el 409 que ofrece votar el
   existente), el festejo del aporte con `earned`, y marcadores distintos para
   lo verificado, lo recomendado por la comunidad y lo sin confirmar — un dato
   de la comunidad **no se ve igual** que uno oficial. Va sobre el prototipo
   de diseño cuando el usuario lo pida.
   **Cómo seguir relevando** está en `data/relevamiento/README.md`: la
   herramienta de armado quedó en el scratchpad de la sesión, no en el repo;
   si hace falta otra tanda, rehacerla desde la plantilla del plan (Task 8).
13. **Los cinco juegos** — proyecto aparte. La trivia es la más definida y sería la
   primera.

**Dos cosas menores que quedaron anotadas y sin hacer, a propósito:**

- **Ampliar la hoja en modo reparto.** Medido: se limita en 472 px y su
  `max-height` permite 584, así que el tope **no es el `max-height` sino los
  botones del mapa**. Ampliarla exige sacarle controles al mapa durante el
  reparto, y eso es decisión de producto (AD-44).
- **La hoja re-dispara su animación de entrada en cada redibujo**, así que salta
  14 px cada vez que se agrega o quita una parada. En el navegador no se nota
  porque las animaciones quedan congeladas; en el teléfono sí. Es un cambio de una
  línea, pero **no se hizo porque no se pidió** — la lección de esta sesión fue
  justamente lo que cuesta mezclar una mejora no pedida con un arreglo.

**Las zonas peligrosas están hechas, y NO salen del dato oficial.** Esta skill
afirmó primero que no había fuente, después que era el Mapa del Delito del GCBA, y
las dos veces se equivocó. Lo vigente: el **mapa colaborativo del AMBA**, 19 zonas
que tocan CABA, 8,8 km², el 4,3% de la Ciudad. El dato oficial se probó y **se
descartó**: contar hechos mide dónde hay gente —Palermo encabezaba la Ciudad— y
como el dataset cubre exactamente CABA, el mapa de calor dibujaba la silueta del
límite administrativo. Ver AD-36 y `data-sources.md` §7.

---

## 9. La regla que gobierna todo

**Donde falta el dato, se dice que falta.** No se rellena.

Está en el código (`bool?` de tres estados para aptitud), en el generador de
capas (`maxheight=default` no es una altura; barrera sin declarar no es barrera
ausente), y en la documentación (L-1 a L-11). Es lo que hace auditable al sistema
y defendible al producto frente a Waze y Google Maps.

Si hace falta un dato que no existe: **decirlo, no rellenarlo.**

---

## 10. Comandos de datos y mapa

```powershell
.\data\build-basemap.ps1             # mapa base del AMBA (53 MB) -> routing/amba.pmtiles
.\data\fetch-caba-map-layers.ps1     # Red, gálibos y sapitos -> wwwroot/data/*.geojson
.\data\fetch-radares-velocidad.ps1   # 129 cinemómetros, dato oficial del GCBA
.\data\fetch-zonas-riesgo.ps1        # zonas peligrosas, del mapa comunitario del AMBA
```

**Los radares salen de Buenos Aires Data** (oficial, CC-BY), no de OSM: otra
licencia y otra cadencia, y por eso vive en un script propio. **Las zonas
peligrosas salen del KML de un mapa colaborativo**, que no es oficial y no tiene
grados: hay dos estados, marcada y no marcada, y **la app nunca dice "zona
segura"** — que un lugar no aparezca significa que nadie lo marcó.

**El heatmap se alimenta con PUNTOS, nunca con una grilla.** Normaliza por
densidad de puntos: con una grilla regular la redibuja como lunares alineados, y
agrandar el radio sólo da lunares más grandes. El script rellena cada zona con
puntos cada 60 m y los publica en **un solo MultiPoint** — la envoltura de miles
de features pesa más que las coordenadas.

**El encoding cambia según el portal y hay que verificarlo, no suponerlo.** El CSV
de cámaras viene en **Latin-1**; los datasets del portal de delitos, en **UTF-8**;
Overpass no declara charset y PowerShell 5.1 lo asume ISO-8859-1. Cada uno costó
su tanda de mojibake.

El **mapa base no se versiona ni entra en el APK** y se sirve bajo `/tiles`; si
falta, el mapa cae al raster de OSM con un aviso en consola. Las **capas de
camión sí se versionan** (761 KB) y viajan dentro del APK.

**Al estilar el mapa, verificar los valores de `kind`, no suponerlos.** El
esquema de Protomaps usa `highway`, `major_road`, `minor_road`, `other`, `path`:
no existe `medium_road`. Una rama con un valor inexistente no da error, sólo no
coincide nunca.
