# Validación comunitaria de lugares y su gamificación — diseño

Fecha: 15/09/2026. Decisiones tomadas con el usuario en la conversación de esa
fecha; las alternativas descartadas están en §2.

## 1. Por qué

La base de POIs para camiones quedó relevada el 15/09/2026 (180 puntos, 48 con
aptitud declarada por evidencia). Lo verificado tiene un techo: cuesta horas por
punto y envejece. El pedido del usuario es que **la comunidad complete lo que
falta sin reemplazar lo verificado**, y que aportar cuente en la progresión que
ya existe. El brainstorm v2 lo pedía así: *"lugares de interés valorados por
usuarios, que además confirmen si son aptos para tránsito pesado (y eso da
puntos)"*.

## 2. Decisiones del usuario

| Decisión | Elegido | Descartado |
|---|---|---|
| Cómo aparece un lugar agregado por un usuario | **(a)** enseguida en el mapa, marcado *aportado por la comunidad*, sin confirmar; los votos le suman confianza | (b) en espera hasta N confirmaciones; (c) visible sólo para quien lo cargó. Sin moderación ni volumen, dejaban lugares invisibles para siempre |
| Qué registra un voto | **(b)** apto / no apto **más el tipo de camión** con el que se vota (sale del camión elegido), y **la ficha muestra directamente los votos de camiones como el tuyo**, con el total al lado | (a) pulgar genérico sin tipo |
| Freno al abuso de la EXP por votar | **(b) sin tope**: se confía; el libro sólo impide cobrar dos veces el mismo lugar. *"Hoy por hoy, al arrancar, sirve la interacción de los usuarios por más que sea sin filtro."* Se revisa según cómo reaccione la gente | (a) tope diario de 10 votos pagos; (c) votos sin EXP suelta |
| Indicador de confiabilidad | **un segundo sello, el de la comunidad**, con umbrales fijos: recomendado (≥ 3 aptos y el doble de aptos que no aptos), en discusión (≥ 3 votos y los no aptos igualan o superan), sin votos (< 3). Lo verificado no se toca | — |

Y la regla de fondo, ya escrita en la skill de producto y ratificada acá: **un
dato aportado por usuarios nunca se muestra igual que uno oficial.** Un lugar de
la comunidad llega como mucho a *recomendado por la comunidad*; nunca a
`Confirmed` por votos. Un lugar verificado con sello *en discusión* sigue
verificado, y la ficha muestra las dos cosas.

## 3. Lo que ya existe y se reutiliza (sin mecánicas nuevas)

| Pieza | Dónde | Cómo se usa |
|---|---|---|
| Pistas y escalones | `TrackCatalog` (dominio, sin migración) | una pista nueva, `lugares`. Sus recompensas `lugares-01…10` salen solas del catálogo: **son las skins**, entran al inventario y al equipamiento como las demás |
| El libro de EXP | `LedgerEntry`, índice único `(DriverId, Denomination, Reason, SourceKey)` | dos motivos nuevos; el índice es lo que impide cobrar dos veces el mismo aporte |
| Cuánto paga cada cosa | `ExperienceScale` | dos constantes nuevas |
| El único lugar que otorga | `ProgressionRecorder` | un método más, `RecordContributionAsync`, con la misma forma que el de viajes |
| Qué escalones se completaron | `ProgressionEngine.Advance` (función pura) | igual |
| Lo ganado, para festejar | `TripEarnings` / `TripEarnedDto` | `ContributionEarnings` / `ContributionEarnedDto`, misma forma sin el nivel (el nivel es de kilómetros y no cambia por aportar) |
| Insignias | `js/logros.js` `PISTAS` | una entrada `lugares` con su símbolo |
| Tipo de camión | `PoiSuitability.FieldFor(truck)` → `PoiSuitabilityField` | es el tipo que lleva el voto |
| El seed no pisa lo del usuario | `PointOfInterestSeed` por `ManagedByDataset` | un lugar aportado nace con `ManagedByDataset = false` |

## 4. Modelo

### 4.1 El voto — `PoiVote` (dominio, `Pois/PoiVote.cs`)

| Campo | Tipo | Notas |
|---|---|---|
| `PoiId` | `Guid` | clave junto con `DriverId`: **un voto por camionero y lugar** |
| `DriverId` | `Guid` | quién |
| `TruckClass` | `PoiSuitabilityField` | con qué tipo de camión votó; sale de `PoiSuitability.FieldFor(camión elegido)` al votar |
| `Verdict` | `PoiVerdict { Suitable = 0, NotSuitable = 1 }` | apto / no apto |
| `CastAt` | `DateTimeOffset` | primera vez |
| `UpdatedAt` | `DateTimeOffset` | última modificación; cambiar el voto reescribe la fila, no agrega otra |

Se guarda el **tipo**, no el id del camión: borrar un camión no borra votos, y el
voto sigue diciendo con qué clase de vehículo se emitió.

### 4.2 El lugar aportado — columnas nuevas en `PointOfInterest`

| Campo | Tipo | Notas |
|---|---|---|
| `ContributedBy` | `Guid?` | quién lo cargó; `null` en todo lo que viene de los datasets |
| `ContributedAt` | `DateTimeOffset?` | cuándo (conversor a ticks UTC como toda fecha, AD-20) |

Un lugar aportado nace con: `VerificationLevel = NotConfirmed`,
`SuitabilityEvidenceKind = None`, los cuatro `SuitableFor…` en `null` (**la
aptitud verificada no la escribe un usuario**), `ManagedByDataset = false`,
`IsSampleData = false`, `Source = "Aporte de la comunidad (DD/MM/AAAA)"`,
`SourceRetrievedOn` = ese día, `Id = Guid.NewGuid()`. **El aporte trae su primer
voto**: quien lo carga vota *apto* con su camión en la misma operación — no lo
cargaría si no lo fuera.

### 4.3 El sello comunitario — `CommunityStanding` (dominio, función pura)

```
record CommunityCount(int Suitable, int NotSuitable)
enum CommunitySeal { NoVotesYet, Recommended, Disputed }

static CommunitySeal CommunityStanding.SealFor(CommunityCount c)
  total < MinimumVotes (3)               → NoVotesYet
  c.NotSuitable >= c.Suitable            → Disputed
  c.Suitable >= ApprovalRatio (2) × c.NotSuitable → Recommended
  si no                                  → NoVotesYet   // 4 a 3: todavía no dice nada
```

Los dos umbrales son constantes públicas con su porqué en el comentario. Se
calcula **dos veces por lugar**: sobre todos los votos, y sobre los votos del
tipo de camión del que consulta.

### 4.4 Progresión

- `LedgerReason.PlaceAdded = 2` (clave `poi-added:{poiId}`) y
  `LedgerReason.PlaceVoted = 3` (clave `poi-vote:{poiId}`). Dos motivos y no uno
  para que "por qué tengo 1.200 de EXP" tenga respuesta.
- `ExperienceScale.PlaceAdded = 10` (como un viaje corto: hay que cargar nombre,
  categoría, ubicación y camión) y `ExperienceScale.PlaceVote = 2`. Un test fija
  que un voto vale menos que un viaje y un aporte no más que uno: aportar no
  puede competir con manejar.
- Pista `lugares` en `TrackCatalog`: escalones `1 · 3 · 7 · 15 · 30 · 60 · 120 ·
  250 · 500 · 1.000` (los de `viajes`: los tres primeros caen en la primera
  semana). Cada voto y cada aporte suman 1. Recompensas `lugares-01…10`.
- **Nada se paga dos veces**: retirar el voto no devuelve (el libro no resta),
  volver a votar el mismo lugar no vuelve a cobrar (el índice único lo impide),
  cambiar el voto tampoco. El aporte paga una vez por lugar creado.
- `ProgressionRecorder.RecordContributionAsync(driverId, reason, sourceKey, when)`:
  si el libro ya tiene ese hecho devuelve `null` (igual que un viaje ya
  acreditado); si no, asienta la EXP, avanza `lugares`, asienta los escalones
  con sus recompensas en la misma operación, y devuelve
  `ContributionEarnings(ContributionExperience, TierExperience, CompletedTiers)`.

## 5. API

Todo bajo `/api/pois`. Leer sigue siendo anónimo; aportar y votar piden sesión.

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /api/pois?categories=&truckId=&suitableOnly=` | como hoy, y cada punto trae además el bloque `community` (§5.1) | 200 |
| `POST /api/pois` | agrega un lugar (§5.2) | 201 con el `PoiDto` y `earned`; 400 si falta algo o está fuera del área; 409 si ya hay un lugar de la misma categoría a menos de 25 m (trae el id del existente para ofrecer votarlo) |
| `PUT /api/pois/{id}/vote` | emite o cambia el voto: `{ truckId, verdict }` | 200 con el `community` actualizado y `earned` (null si ya había cobrado ese lugar); 404 lugar o camión inexistente |
| `DELETE /api/pois/{id}/vote` | retira el voto | 204; no devuelve EXP |

### 5.1 El bloque `community` del `PoiDto`

```
community: {
  suitable: 12, notSuitable: 2, seal: "Recommended",            // todos los votos
  forYourTruck: { class: "SemiTrailer", suitable: 3, notSuitable: 0, seal: "Recommended" } | null,  // sólo con truckId
  yourVote: "Suitable" | "NotSuitable" | null,                    // sólo con sesión
  contributed: { at: "2026-09-15", byAlias: "tobi" } | null       // sólo en lugares aportados
}
```

Y **`suitableOnly=true` deja pasar dos cosas**: lo verificado apto para el
camión (como hoy) **o** lo *recomendado por la comunidad* para el tipo de ese
camión. El `PoiDto` sigue diciendo por separado `suitableForSelectedTruck`
(verificado) y `community.forYourTruck.seal` (comunidad), para que la interfaz
los marque distinto. Es la decisión (b): "que se muestre el dato ya filtrado para
ver directamente los votos de un camión como el de uno".

### 5.2 Agregar un lugar — `AddPoiRequest`

`{ name, category, latitude, longitude, address?, description?, truckId }`.
Validaciones, todas con motivo en el 400:

- `name` de 3 a 80 caracteres; `category` uno de `PoiCategory`.
- La coordenada **dentro de CABA y su anillo** (`-34.725…-34.505` /
  `-58.555…-58.315`, el mismo rectángulo del relevamiento). Fuera de ahí la app
  no tiene ni mapa ni capas (L-11), y un lugar que nadie va a ver no sirve.
- `truckId` de un camión propio o plantilla, como en el resto de la API: da el
  tipo del primer voto.
- Duplicado: misma categoría a menos de 25 m de un lugar existente → 409 con
  `existingId`. Es el mismo umbral que el candado del dataset.

## 6. Interfaz — qué entra y qué no

Este diseño entrega **el sistema**: dominio, persistencia, API, progresión,
tests, y del lado web `api.js` (`addPoi`, `votePoi`, `retirePoiVote`, `pois` con
`truckId`) y la insignia `lugares` en `logros.js`. **La ficha del lugar con sus
votos, el botón de votar y el formulario de agregar van con la interfaz de POIs**,
que hoy no existe (la app web no muestra ningún POI) y es la construcción
siguiente, sobre el prototipo de diseño cuando el usuario lo pida. Cuando esa
interfaz exista, la ficha muestra: el sello verificado con su evidencia, el sello
comunitario con "N camioneros como vos lo recomiendan" (y el total al lado), el
propio voto, y "aportado por la comunidad" cuando corresponda.

## 7. Tests

Todo por TDD, viendo cada uno fallar primero.

**Dominio (unitarios):** `CommunityStanding` — los tres sellos y sus bordes (2
votos → sin votos; 3 a 0 → recomendado; 2 a 1 → sin votos; 3 a 3 → en discusión;
4 a 2 → recomendado; 5 a 3 → sin votos). `TrackCatalog` — `lugares` existe con
diez escalones y recompensas únicas (el test de unicidad de recompensas ya
existe y la cubre). `ExperienceScale` — un voto vale menos que un viaje y un
aporte no más que uno.

**Integración:** persistencia del voto (ida y vuelta, unicidad por camionero y
lugar); el recorder no cobra dos veces el mismo voto ni el mismo aporte;
retirar y volver a votar no vuelve a pagar; un escalón de `lugares` desbloquea
`lugares-01`; el seed no borra un lugar aportado (`ManagedByDataset = false`);
`GET /api/pois` con `truckId` trae `forYourTruck` filtrado por la clase del
camión; `suitableOnly` deja pasar lo recomendado por la comunidad para esa
clase y no lo recomendado para otra; `POST /api/pois` rechaza fuera del
rectángulo y el duplicado a 25 m; el aporte deja el primer voto y paga 10.

**JS:** `logros.js` — `insignia('lugares', …)` dibuja.

## 8. Fuera de alcance

- Moderación, denuncias y borrado de lugares aportados. Se anota como lo
  siguiente si aparece abuso.
- Tope diario de EXP por votos: decisión (b), se revisa con datos.
- Editar un lugar aportado (nombre, categoría, posición).
- La interfaz de POIs (§6).
- Los reportes de la Fase 5 (siniestros, radares, retenes): otro sistema,
  aunque el día que exista entra por la misma puerta (`RecordContributionAsync`
  con su motivo y su pista).

## 9. Limitaciones que quedan dichas

- Sin tope, la EXP por votos es abusable a propósito (decisión del usuario).
- El sello comunitario con 3 votos es una señal débil; los umbrales son
  constantes y se ajustan con datos.
- Un lugar aportado con coordenada mal puesta queda mal puesto hasta que exista
  edición o moderación.
