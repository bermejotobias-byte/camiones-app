# Reportes de la comunidad — diseño

Fecha: 19/09/2026. Es la Fase 5 del roadmap (`producto-camiones-app`), la que
el brainstorm v2 llamaba *"reportar y confirmar siniestros, radares y
retenes"*. El pedido del usuario, textual: *"un sistema de reportes
colaborativos inspirado en el funcionamiento de Waze. No quiero copiar su
diseño ni código propietario, sino aplicar la lógica funcional del sistema."*

La lógica general es una sola frase y todo lo que sigue la sirve:

> usuario reporta → el reporte aparece → otros lo confirman o rechazan → se
> actualiza su confiabilidad → permanece mientras siga siendo relevante →
> expira.

## 1. Decisiones del usuario

Vienen del pedido del 19/09/2026 y de la conversación de esa fecha. Lo que
no está en esta tabla lo decidí yo y va marcado como **propuesta** en su
sección: son números y formas, todos configurables en un solo lugar.

| Decisión | Elegido |
|---|---|
| Desde dónde se reporta | **Sólo en la posición GPS del usuario**, en reposo y en viaje. Descartado: marcar cualquier punto del mapa (abre la puerta a reportar desde el sillón e impide exigir cercanía para votar) |
| Qué guarda un reporte | Ubicación GPS, calle, sentido de circulación cuando venía en movimiento, fecha y hora, usuario y tipo |
| Tipos iniciales | accidente, tránsito, control, policía, cámara, obra, bache, peligro, calle cerrada; **más uno propio del camión: gálibo bajo, con los metros**. El 19/09 el usuario sacó del catálogo *vehículo detenido* y *límite de peso*. La arquitectura queda preparada para agregar tipos sin migración |
| Vida útil | Cada reporte es temporal, con una vida que depende del tipo (corta para el tránsito, larga para una obra); pierde vigencia progresivamente y desaparece al expirar |
| Lo que se vuelve fijo | **Una cámara muy confirmada es fija**: *"una cámara muy marcada es porque es fija, no tiene sentido que sólo dure 6 hs"*. Con **5 confirmaciones** deja de vencer y pasa a ser un dato de la app. **El mismo mecanismo rige para los lugares nuevos** (gomerías, estaciones de servicio, …): con 5 votos de apto, el lugar aportado se incorpora a la base. Textual: *"+5 es un principio"* — es una constante, no una verdad |
| Confirmar y rechazar | Quien pasa por el lugar puede decir *Sigue ahí* o *Ya no está*; eso modifica la confiabilidad |
| Confiabilidad | Fórmula **propia, simple y configurable**, que considera como mínimo confirmaciones, rechazos, antigüedad y reputación de quien lo creó |
| Información vs. ruteo | Separados. Accidente, control, policía, bache y obra son información y aviso; **calle cerrada y gálibo incompatible pueden afectar el cálculo de ruta**, y **un reporte solo nunca modifica el ruteo sin validación suficiente** |
| Adaptación al camión | Las restricciones físicas se comparan con el camión elegido: un gálibo de 3,80 m es incompatible para uno de 4,10 m y compatible para uno de 3,60 m |
| EXP y reputación | **Separadas.** La EXP es de la gamificación y se puede dar por reportar o validar información útil; la reputación mide qué tan confiable es el usuario como fuente. Nadie puede farmear EXP con reportes o confirmaciones falsas |
| Abuso | Protección básica: demasiados reportes en poco tiempo, repetidos o comportamiento anómalo generan límites o cooldowns |
| Manejando | Pocos toques, botones grandes, información clara, sin formularios |

Y dos reglas de la casa que también rigen acá: **un dato de la comunidad no
se muestra igual que uno oficial** (los radares del GCBA y los gálibos de OSM
siguen siendo lo que son; un reporte es un reporte), y **donde falta el dato
se dice que falta** (un reporte sin calle no inventa una).

## 2. Qué se reutiliza y qué es nuevo

Nada de lo existente cambia de forma; a cada pieza se le **agrega una
entrada**. Lo que ya está y se reutiliza tal cual:

- **Votos con una fila por persona y cosa, sello por función pura, y el 409
  que ofrece votar el existente** (`PoiVote`, `CommunityStanding`,
  `PoiVoting`, AD-46). Mismo patrón, con nombres propios.
- **La EXP por una sola puerta** (`ProgressionRecorder`), el libro con su
  índice único y las pistas en `TrackCatalog`, que ya anticipa *"cuando
  existan los reportes"*.
- **Los avisos sobre la ruta** (`alertsAlongRoute` en `navigation.js`: corredor
  de 30 m, calle en ese punto, tarjeta, voz, vibración por tipo).
- **El custom model por pedido** a GraphHopper 11 en modo flexible
  (`CabaTruckRoutingPolicy`, `GraphHopperRouteCalculator`). **Medido el
  19/09/2026 contra el motor vivo**: un `areas` en el custom model con un
  cuadrado de ±11 m sobre la ruta y `if: in_cierre_1, multiply_by: 0` hizo que
  la ruta cambiara de Jufré a Loyola. Un cierre validado se manda así, sin
  tocar el grafo ni reiniciar nada.
- **La grilla "¿Qué hay acá?"** del botón amarillo del viaje (`mapa/aportar.js`),
  cuyo comentario ya reservaba el lugar; **las capas por grupo** (`GRUPOS` en
  `layers.js`, `capas.js`); **los pines como imagen** y la ficha por
  `data-accion` (`lugares.js`).

Lo nuevo, por capa:

| Capa | Piezas |
|---|---|
| Dominio (`Domain/Reports/`, puro, con tests) | `Report`, `ReportType` + `ReportCatalog`, `ReportVote`, `ReportStanding`, `ReportExpiry`, `ReportRelevance`, `ReportPromotion`, `PoiPromotion` (+ `SuitabilityEvidenceKind.Community`), `DriverReputation`, `ReportAbuseGuard`, `RouteBlockade`; `CustomModel.Areas`; `LedgerReason.ReportValidated` y `ReportVoted`; pista `reportes` |
| Infraestructura | tablas `Reports`, `ReportVotes`, `DriverReputations` (una migración, `AddCommunityReports`); `ReportReader`, `ReportWriter`, `RouteBlockades`; el calculador suma los bloqueos al custom model; `PoiVoting` aplica la promoción del lugar al votar |
| API | `GET /api/reports`, `POST /api/reports`, `PUT /api/reports/{id}/vote`, `DELETE /api/reports/{id}`; `ReportDto` |
| Web | `js/mapa/reportes.js` (la grilla, el valor, la ficha, el "¿Sigue ahí?", y lo puro) con `tests/web/reportes.test.mjs`; `navigate.js` sólo engancha; en `map.js`/`layers.js` la fuente y la capa `reporte`; en `navigation.js` los reportes como un dataset más de `alertsAlongRoute`; en `platform.js` dos patrones de vibración |
| Docs | `docs/reportes.md` (modelo, reglas, cómo se configuran), AD-49 en `decisions.md` (que además enmienda AD-46: lo aportado sí puede graduarse), `docs/pois.md`, CLAUDE.md, las skills |

## 3. El reporte

```
Report
  Id            Guid
  Type          ReportType        (enum; el catálogo dice qué es cada uno)
  Latitude, Longitude              la posición GPS al reportar
  Street        string?           la calle, si se supo (ver abajo)
  HeadingDegrees double?          rumbo 0–360 sólo si venía en movimiento (≥ 2 m/s)
  Value         double?           metros para gálibo; null en el resto
  CreatedBy     Guid              el camionero
  CreatedAt     DateTimeOffset
  ExpiresAt     DateTimeOffset?   nace en CreatedAt + vida del tipo; se mueve con los votos; null = fijo, no vence
  Status        Active | Validated | Fixed | Rejected | ClosedByAuthor   (vencido = ExpiresAt ya pasó; no se guarda)
  Confirmations int               votos "sigue ahí" de OTROS (contador; la verdad son las filas)
  Rejections    int               votos "ya no está" de OTROS
  ValidatedAt   DateTimeOffset?   la primera vez que cruzó el umbral

ReportVote      clave (ReportId, DriverId); Verdict StillThere | Gone; CastAt; UpdatedAt;
                DistanceMeters (a qué distancia del reporte se votó, para auditar)

DriverReputation  DriverId (PK); Score 0–100; UpdatedAt
```

**La calle.** El cliente la manda si la sabe: en viaje es la del paso actual
(`navState.step.streetName`, la misma que va en la píldora negra). Si no la
sabe, el servidor la pide a Photon (`ReverseAsync`) **con tope de 1,5 s** y si
no llega queda `null`: la ficha dice "cerca de acá" y no inventa. Un reporte
no se demora ni se rechaza por la calle.

**El sentido.** Sale del `heading` del fix de GPS que ya cruza el puente
(`TN_setPosition(lat, lng, accuracy, speed, heading)`), y sólo si `speed ≥ 2
m/s`: el rumbo de un vehículo parado no significa nada. Se usa para dos cosas:
avisar sólo a quien va en el mismo sentido (±90°) y orientar el polígono del
bloqueo a lo largo de la calle.

**El catálogo** (`ReportCatalog`, dominio; **propuesta**, cada número es una
constante ahí):

| Tipo | Clase | Vida útil | Se estira con *Sigue ahí* | Valor |
|---|---|---|---|---|
| Tránsito | información | 45 min | sí | — |
| Policía | información | 1 h | sí | — |
| Accidente | información | 2 h | sí | — |
| Control | información | 2 h | sí | — |
| Peligro | información | 2 h | sí | — |
| Cámara | información | 6 h, y **fija con 5 confirmaciones** | sí | — |
| Calle cerrada | **restricción** | 12 h | sí | — |
| Bache | información | 7 días | sí | — |
| Obra | información | 7 días | sí | — |
| Gálibo bajo | **restricción** | 30 días | sí | metros, 2,0–6,0 |

Agregar un tipo es una fila del catálogo: no hay migración, porque el tipo se
guarda como entero y las reglas viven en el dominio. El restrictivo con
valor existe porque el usuario lo pidió como el caso que distingue a esta
app: *"si se reporta un gálibo de 3,80 m y el camión mide 4,10 m, debe
identificarse como incompatible"*.

## 4. Confiabilidad, validación y vencimiento

Todo se **calcula al leer**, con funciones puras del dominio y el reloj como
parámetro. No hay tareas de fondo ni cron: un reporte vencido es uno cuyo
`ExpiresAt` ya pasó, y la consulta lo filtra.

**Confiabilidad** (`ReportStanding.ScoreFor(report, reputation, now)`,
0–100; **propuesta**):

```
base      = 35 + 0,30 × reputación del creador        (50 de reputación → 50)
apoyo     = 12 × min(confirmaciones, 4)                (hasta +48)
castigo   = 18 × rechazos
frescura  = 1 − 0,40 × (edad / vida útil del tipo)     (recién creado 1,0; al vencer 0,6)
score     = clamp((base + apoyo − castigo) × frescura, 0, 100)
```

Ejemplos (recién creados, frescura 1): un reporte de alguien con reputación 50 vale 50; con dos
confirmaciones, 74; con dos confirmaciones y un rechazo, 56; de alguien con
reputación 90 sin votos, 62; de alguien con reputación 10, 38.

**Tres etiquetas a la vista**, porque un número no se lee manejando:
*En duda* (rechazos ≥ 1 y rechazos ≥ confirmaciones), *Confirmado* (al menos
una confirmación ajena y score ≥ 60), *Nuevo* (el resto: una reputación alta
sola no lo vuelve "confirmado", porque nadie lo confirmó). La app las muestra con la edad ("hace 12 min") y los
conteos.

**Validado** —lo único que habilita a tocar la ruta— exige las dos cosas:
**≥ 2 confirmaciones de personas distintas del creador y score ≥ 70**. Con
esta fórmula, dos confirmaciones y ningún rechazo dan 74 para un creador
promedio, y no alcanzan (62) para uno con reputación 10: a una fuente
desacreditada le hacen falta tres. Un solo reporte, sin nadie que lo
confirme, **nunca** bloquea nada.

**Vencimiento** (`ReportExpiry`):

- Nace en `CreatedAt + vida útil`.
- *Sigue ahí* → `ExpiresAt = max(ExpiresAt, ahora + vida útil / 2)`, con tope
  `CreatedAt + 3 × vida útil`: una obra confirmada cada día vive hasta 21
  días, un aviso de tránsito confirmado no pasa de dos horas y cuarto.
- *Ya no está* → cuando `rechazos ≥ 2` y `rechazos > confirmaciones`, vence
  ahora (`Rejected`). El creador puede cerrar el suyo cuando quiera
  (`ClosedByAuthor`).
- Cambiar el voto reescribe la fila y recalcula los contadores; **no** vuelve
  a estirar ni a pagar.

**Reputación** (`DriverReputation`; **propuesta**): arranca en **50**, se
mueve sólo por lo que la comunidad dice de tus reportes, y se guarda entre 0
y 100. `+3` la primera vez que un reporte tuyo queda *Validado*; `−5` cuando
uno queda *Rejected*. No se toca por votar: la reputación de los votantes es
una extensión posible (§11), no parte de esta versión. La reputación **no
se muestra** como número en la app: se ve en la etiqueta de lo que reportás.

**Lo que la comunidad vuelve fijo** (decisión del usuario del 19/09/2026;
el umbral **5** es una constante en cada catálogo, *"un principio"*):

- **Cámara** (`ReportPromotion`): con 5 confirmaciones de personas distintas
  del creador pasa a `Fixed`: `ExpiresAt = null`, no vence nunca, y desde ahí
  es un dato de la app. Se sirve por el mismo `GET`, se dibuja como **cámara
  de la comunidad** —distinta de la oficial del GCBA, porque un dato de la
  comunidad no se muestra igual que uno oficial— y se avisa en la ruta como
  los radares. Sigue aceptando votos: si junta 5 rechazos y superan las
  confirmaciones, deja de ser fija y vence (`Rejected`). Los demás tipos no
  se vuelven fijos en esta versión; agregar uno es marcarlo en el catálogo.
- **Lugar aportado** (`PoiPromotion`, sobre `PoiVoting`): un lugar con
  `ManagedByDataset = false` que junta 5 votos de **apto** de un mismo tipo de
  camión queda **establecido**: `VerificationLevel.Probable`,
  `SuitabilityEvidenceKind.Community` (valor nuevo), evidencia *"Confirmado
  apto para camión pesado por 5 camioneros de la comunidad (19/09/2026)"* y
  `SuitableFor<ese tipo> = true`. El pin deja de ser el de "aportado" y pasa a
  ser el de un lugar del mapa; el sello de la comunidad (AD-46) sigue a la
  vista. **Los lugares del dataset no se tocan**: AD-46 sigue valiendo para lo
  verificado y se enmienda sólo para lo aportado, que ahora puede graduarse.
  Con 5 de *no apto* de un tipo, ese campo queda en `false` por el mismo
  mecanismo; `Confirmed` sigue siendo exclusivo de una fuente.

Nada de esto paga EXP aparte: el reporte validado ya pagó, y el lugar pagó
al aportarse. Lo que cambia es el dato, no la cuenta.

## 5. Ruteo: información vs. restricción

Los diez tipos **avisan** (tarjeta, voz, vibración) cuando están sobre la ruta
y en el sentido de marcha. Sólo dos pueden **cambiar la ruta**, y sólo
validados:

| Tipo | Bloquea para… |
|---|---|
| Calle cerrada | todos los camiones |
| Gálibo bajo | los camiones con `HeightMeters > valor` |

**Cómo**: `RouteBlockades.ActiveAsync(truck, now)` (infraestructura) lee los
reportes restrictivos validados y vigentes que le tocan a ese camión y los
convierte en `RouteBlockade` (dominio). Cada uno se vuelve un polígono en
`CustomModel.Areas` (GeoJSON `FeatureCollection`, ids `r1`, `r2`, …) con una
sentencia `Block("in_r1")` en `priority`. El polígono es un **rectángulo de 40
m a lo largo del rumbo por 16 m de ancho** cuando hay rumbo, y un cuadrado de
24 m de lado cuando no lo hay: menos que la distancia entre calles paralelas
en CABA (~100 m), así que bloquea esa cuadra y no la de al lado. La
geometría la calcula el dominio con matemática plana (a esta escala alcanza,
y no mete dependencias).

`ITruckRoutingPolicy.BuildCustomModel(truck, when)` gana una sobrecarga con
`IReadOnlyList<RouteBlockade>`; la de dos parámetros llama a la nueva con la
lista vacía, así que los 451 tests de hoy siguen igual. El calculador pide los
bloqueos una vez por pedido y los pasa. **`RouteOffer` y AD-47 no cambian**:
lo que el motor excluyó no se ofrece, igual que antes. Y `/api/trips/active`,
que recalcula, pasa por el mismo calculador: el viaje recuperado también
esquiva el cierre.

**Lo que no hace esta versión**: si un cierre se valida mientras estás en
viaje sobre esa calle, la app **avisa** ("Calle cerrada confirmada a 400 m")
pero no recalcula sola; recalcular en viaje es una decisión de producto
aparte (§11). El aviso de un cierre **no validado** dice que no está
confirmado.

**El gálibo con el camión.** `ReportRelevance.ForTruck(report, truck)`
(dominio, puro) devuelve `Compatible`, `Incompatible` o `NotApplicable`.
Incompatible pinta el pin en rojo, el aviso dice "Gálibo reportado de 3,80 m,
tu camión no pasa" con el patrón de vibración de peligro, y si además está
validado, la ruta lo esquiva. Compatible se ve como información gris.
Como con la aptitud de los lugares, la comparación vive en un solo lugar y
tiene sus tests con 3,60 / 3,80 / 4,10.

## 6. EXP y reputación, separadas

**La EXP se paga sólo con validación ajena** (**propuesta**; los montos en
`ExperienceScale`):

| Hecho | EXP | Clave del libro | Condición |
|---|---|---|---|
| Un reporte tuyo queda *Validado* | **15** al creador | `report-validated:{id}` | lo validan otros; se paga una sola vez por reporte |
| Votar un reporte ajeno | **2** | `report-vote:{id}` | llevás **menos de 10 votos pagos hoy** (día local, UTC−3); la cercanía ya la exige el voto (§7) |
| Crear un reporte | **0** | — | reportar solo no paga: es lo que impide farmear sin cómplices |

Los dos motivos nuevos entran por `ProgressionRecorder` como los aportes a los
lugares, con el mismo índice único, y una **pista nueva `reportes`** en
`TrackCatalog` cuenta reportes validados con la escalera de viajes (1 · 3 · 7
· 15 · 30 · 60 · 120 · 250 · 500 · 1.000) y recompensas `reportes-01…10`,
códigos sistemáticos como los demás. Cambiar el voto, retirarlo o que el
reporte muera después **no devuelve ni resta**: el libro no resta.

Por qué así y no de otra forma: pagar al crear invita a reportar cualquier
cosa; pagar al votar sin exigir cercanía invita a votar desde el sillón; sin
tope diario dos cuentas se turnan. Con esto, farmear necesita cómplices
presentes en el lugar, y a esos los frena la reputación cuando la comunidad
rechaza lo que reportan.

## 7. Contra el abuso

`ReportAbuseGuard` (dominio, puro: recibe el historial reciente y el reloj) y
las consultas que lo alimentan (**propuesta**):

| Regla | Valor | Respuesta |
|---|---|---|
| Espera entre reportes de la misma cuenta | 45 s | **429** con `retryAfterSeconds` |
| Tope por hora | 20 reportes | 429 |
| Duplicado: mismo tipo, activo, a ≤ 150 m y ≤ 15 min | — | **409** con `existingId`; la app ofrece *Sigue ahí* en vez de duplicar |
| Reputación baja (< 25) | la espera se duplica | 429 |
| Votar lo propio | — | 403 |
| Votar lejos | > 500 m del reporte | 400 "Tenés que estar cerca para confirmarlo" |
| Fuera del área | el rectángulo de `PoiContribution` | 400 |
| Valor fuera de rango | gálibo 2,0–6,0 m | 400 |

La posición que acompaña un voto es la del GPS del cliente y el servidor
**la confía**: la app es el único cliente y una posición falsa exige
modificarla. Se anota como límite conocido (§11), no se disimula.

## 8. La experiencia manejando

**Reportar: un toque.** El botón amarillo del viaje abre la grilla, que pasa
a tener dos secciones: **Reportar** arriba (los diez tipos en círculos de 75
con su calcomanía, dibujos propios) y **Agregar un lugar** abajo (las seis
categorías de hoy). Tocar un tipo **crea el reporte en tu posición y cierra
la hoja**; un toast de dos segundos dice "Reportado · Accidente en Av.
Corrientes" y ofrece *Deshacer* (que lo cierra como autor). El gálibo pide
los metros en un segundo toque, con valores grandes prearmados (3,5 · 3,8 ·
4,0 · 4,3 · 4,5) y "otro" para escribirlo. Sin posición GPS no se puede
reportar y el botón lo dice.

En **reposo** aparece el mismo botón amarillo abajo a la derecha, sobre la
hoja, como en Waze (**propuesta**): reportar no es sólo cosa del viaje.

**Ver.** Los reportes activos se dibujan como pines por tipo (grupo `reporte`
en la hoja de capas, prendido por defecto), con el estado a la vista: gris
*nuevo*, blanco *confirmado*, tachado *en duda*, **rojo** el que a tu camión
no le sirve, y la **cámara fija** con su dibujo propio, sin edad. Tocarlo
abre una ficha corta: tipo, calle, "hace 12 min · 2
confirmaciones", quién lo reportó (`@alias`, como los lugares), y los dos
botones grandes *Sigue ahí* / *Ya no está*; si es tuyo, *Cerrar reporte*.

**En viaje.** Los reportes del bbox de la ruta (más 500 m) se traen al
preparar la ruta y **cada 60 s**; en reposo, al quedar quieto el mapa
(`idle`, con un segundo de espera) para el bbox visible. Cada refresco pasa
por `alertsAlongRoute` como un dataset más (`features.reportes`), con dos
filtros propios: el sentido (±90° respecto del rumbo de la ruta en ese punto,
si el reporte lo tiene) y la relevancia para el camión. Los avisos salen
como los demás: tarjeta, voz ("Accidente a 300 metros", "Gálibo reportado de
3,80 metros, tu camión no pasa") y vibración con dos patrones nuevos en
`VIBRACION`: `reporte` (información) y `peligro` (restricción incompatible o
calle cerrada), distintos de `maniobra`, `galibo` y `radar`.

**"¿Sigue ahí?"** Al pasar a menos de 60 m de un reporte activo que no es
tuyo y que no votaste, y una vez que te alejás de él, aparecen durante 10 s
dos botones grandes en la parte baja: *Sigue ahí* y *Ya no está*. Un toque o
nada: si no tocás, no pasa nada. Una vez por reporte y viaje.

Todo lo de esta sección sigue las medidas del GPS de Waze
(`docs/superpowers/specs/2026-09-16-gps-waze-design.md`, tokens `--gps-*`) y
la regla de las dos intensidades: el reporte es sobrio, la EXP la festeja
el toast y el fin de viaje, nunca la pantalla que se mira manejando.

## 9. Contratos de la API

```
GET /api/reports?bbox=minLon,minLat,maxLon,maxLat&truckId={guid?}
  anónimo (yourVote y mine sólo con sesión). bbox de hasta 0,25° por lado.
  200 → ReportDto[]

POST /api/reports                                  (sesión)
  { type, latitude, longitude, headingDegrees?, speedMps?, street?, value? }
  201 → ReportDto        400 motivo        409 { existingId }        429 { retryAfterSeconds }

PUT /api/reports/{id}/vote                         (sesión)
  { verdict: "StillThere" | "Gone", latitude, longitude }
  200 → { report: ReportDto, earned: ContributionEarnings? }
  400 lejos   403 propio   404 no existe   410 vencido

DELETE /api/reports/{id}                           (sesión, sólo el creador)
  204

ReportDto
  id, type, kind ("info" | "restriction"), latitude, longitude, street,
  headingDegrees, value, createdAt, expiresAt (null si es fija), status, fixed,
  reliability { score, label: "new" | "confirmed" | "disputed" },
  confirmations, rejections, validated,
  reportedBy { alias }, mine, yourVote,
  forYourTruck ("compatible" | "incompatible" | null)
```

Los errores van como `ProblemDetails` con el motivo escrito para la persona,
igual que en los lugares; el 409 lleva `existingId` en `extensions`.

## 10. Verificación

- **Dominio**: catálogo (vida útil por tipo, restricción vs. información),
  `ReportStanding` con los ejemplos de §4 exactos, validación (2 + 70; el caso
  de reputación 10 que no alcanza), vencimiento (estirar, tope de 3×, morir por
  rechazos, cerrar el propio), reputación (+3/−5 con topes 0 y 100), relevancia
  para el camión (3,60 / 3,80 / 4,10), abuso (45 s, 20/h, duplicado a 150
  m/15 min, reputación baja), la promoción (la cámara se vuelve fija a las 5
  y deja de serlo con 5 rechazos que superan; el lugar aportado queda
  establecido con 5 aptos de un tipo; un lugar del dataset no se toca), y
  el polígono del bloqueo (con y sin rumbo, tamaño).
- **Integración** (SQLite en memoria, como `PoiVotingTests`): crear, duplicado
  409, cooldown 429, votar y cambiar el voto sin pagar dos veces, validar y
  acreditar 15 al creador una sola vez, tope de 10 votos pagos por día, votar
  lejos, votar lo propio, vencer, la cámara que con 5 confirmaciones vuelve
  en el GET después de su vida útil, el lugar aportado que con 5 aptos de
  camión pesado queda `Probable` y apto para pesado, y **contra GraphHopper
  vivo** (se saltea si
  no está): una ruta que pasa por una cuadra, el mismo pedido con el bloqueo
  validado la esquiva, y con el mismo reporte **sin validar** no cambia.
- **Web** (`node --test`): la grilla, la etiqueta de edad, el filtro por
  sentido, la relevancia para el camión, el geojson de la capa, el texto
  hablado y el "¿Sigue ahí?" (aparece al alejarse, una vez por reporte).
- **Navegador a 360 × 800**: reposo y viaje con reportes simulados por
  `TN_setPosition`; el pin rojo para un gálibo incompatible.
- **Teléfono**: el usuario reporta y confirma con su cuenta; yo leo el log.
  Lo que sólo se ve en movimiento —el "¿Sigue ahí?" al pasar— queda con el
  resto de las pruebas en calle.

Y como siempre: cada tarea con su test en rojo primero, un commit por tarea,
y los 451 + 189 tests de hoy verdes en cada una.

## 11. Fuera de esta versión

Anotado para no reabrirlo por accidente:

- Recalcular la ruta sola cuando un cierre se valida en viaje.
- Reputación de los votantes (hoy sólo de quien crea).
- Reportar desde un punto arbitrario del mapa.
- Moderación humana, fotos, comentarios, notificaciones.
- Confiar en una posición que el cliente podría falsear: se acepta el riesgo
  porque la app es el único cliente.
- Que un gálibo o una calle cerrada muy confirmados se vuelvan fijos o
  pasen al dataset verificado: la cámara y los lugares sí se gradúan (§4);
  el gálibo es un relevamiento, no un voto. Y volcar las cámaras fijas al
  archivo de radares con un script de `data/`: es una tanda más de datos,
  cuando haya cámaras fijas que volcar.
