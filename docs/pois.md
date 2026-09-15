# Puntos de interés para camiones

El ruteo resuelve *cómo llegar*. Esta capa responde *dónde parar*: playas,
estaciones de servicio, talleres, gomerías y auxilio mecánico pesado.

Se apoya en la misma disciplina que el resto del proyecto: cada punto declara de
dónde salió, y lo que la fuente no dice **queda como desconocido en lugar de
convertirse en una negativa**.

---

## Categorías

| Categoría | Enum | Ícono |
|---|---|---|
| Playas y estacionamientos | `TruckParking` | 🅿️ |
| Estaciones de servicio | `FuelStation` | ⛽ |
| Talleres | `RepairShop` | 🔧 |
| Gomerías | `TyreShop` | 🛞 |
| Auxilio mecánico pesado | `HeavyRoadsideAssistance` | 🚨 |
| Lugares para comer con lugar para el camión | `TruckFriendlyEatery` | 🍽️ |

En el mapa se dibujan como cuadrados de 22 px, distintos de los círculos de 26 px
que usan origen, destino y GPS, para que no se confundan de un vistazo.

Los puntos cuya aptitud **está confirmada** para el camión elegido llevan un ✓
verde. El resto va a color pleno: que la fuente no diga nada no los vuelve
sospechosos, y la ficha lo aclara con todas las letras.

> La primera versión hacía lo contrario —atenuaba los de aptitud desconocida— y
> quedó mal: como eran 75 de 78 (hoy 132 de 180), el mapa entero se veía lavado y la señal no
> distinguía nada. Se marca lo excepcional, no lo habitual.

## Modelo

`TruckNavigator.Domain/Pois/PointOfInterest.cs`. Los identificadores están en
inglés como el resto del código; la correspondencia con los campos pedidos es:

| Campo | Propiedad | Tipo |
|---|---|---|
| id | `Id` | `Guid` |
| nombre | `Name` | `string` |
| categoría | `Category` | `PoiCategory` |
| dirección | `Address` | `string?` |
| barrio | `Neighbourhood` | `string?` |
| latitud / longitud | `Latitude` / `Longitude` | `double` |
| teléfono | `Phone` | `string?` |
| web | `Website` | `string?` |
| horario | `OpeningHours` | `string?` |
| descripción | `Description` | `string?` |
| servicios | `Services` | `IReadOnlyList<string>` |
| apto_camion_liviano | `SuitableForLightTruck` | `bool?` |
| apto_camion_pesado | `SuitableForHeavyTruck` | `bool?` |
| apto_semirremolque | `SuitableForSemiTrailer` | `bool?` |
| apto_acoplado | `SuitableForTrailer` | `bool?` |
| fuente | `Source` + `SourceRetrievedOn` | `string` + `DateOnly` |
| nivel_verificacion | `VerificationLevel` | enum |
| evidencia | `SuitabilityEvidence` | `string?` — por qué es apto y desde cuándo |
| tipo_de_evidencia | `SuitabilityEvidenceKind` | enum: `None`, `Operator`, `Official`, `Reviews`, `Signals` |
| del_dataset | `ManagedByDataset` | `bool` — viene de los archivos embebidos |

### Por qué la aptitud es `bool?`

`null` significa "la fuente no lo dice". No es lo mismo que "no apto".

De los 78 puntos del dataset inicial, **75 no declaran aptitud para camión**:
OpenStreetMap ubica la estación o el taller pero no dice si recibe un
semirremolque. Colapsar eso en `false` sería inventar una restricción, que es
exactamente lo que el proyecto se prohíbe hacer con la normativa.

`PoiSuitability.Accepts` devuelve `bool?` por la misma razón: quien filtra decide
qué hacer con lo desconocido, en lugar de recibirlo ya convertido en negativa.

### Niveles de verificación

Significado desde el 15/09/2026 (decisión del usuario; antes, las reseñas daban
`Probable`):

| Nivel | Qué significa | Tipo de evidencia |
|---|---|---|
| `Confirmed` | Lo dice el **operador**, una **fuente oficial**, o **reseñas de conductores** que cuentan haber entrado con el camión | `Operator`, `Official`, `Reviews` |
| `Probable` | Señales indirectas sin declaración ni testimonio: el nombre, una etiqueta de OSM, fotos de la ficha | `Signals` |
| `NotConfirmed` | Existe, pero nadie dice si recibe camiones | `None` |

Aplica a **los datos del establecimiento, no a su existencia**: un punto de OSM
existe; que reciba camiones es otra pregunta.

**La evidencia se escribe** (`SuitabilityEvidence`): qué la respalda y la fecha,
en palabras propias — *"Según reseñas de conductores consultadas el 15/09/2026:
entran semis, playa amplia."* La aptitud se marca **sólo para los tipos de camión
que la evidencia menciona**; los demás quedan `null`.

`PoiDatasetTests` verifica que el nivel se corresponde con el tipo de evidencia,
que toda evidencia lleva fecha, que un punto importado crudo de OSM (`Source` que
empieza con "OpenStreetMap") nunca es `Confirmed`, y que gomerías y lugares para
comer no entran sin evidencia.

## Cómo se decide la aptitud para el camión elegido

`PoiSuitability.FieldFor` en `TruckNavigator.Domain/Pois/PoiSuitability.cs`:

| Vehículo | Campo consultado |
|---|---|
| `SemiTrailer` | `SuitableForSemiTrailer` |
| `TruckWithTrailer` | `SuitableForTrailer` |
| Rígido > 12 t | `SuitableForHeavyTruck` |
| Rígido ≤ 12 t | `SuitableForLightTruck` |

El umbral sale de `CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg`, con su
cita normativa; no se repite el número. **El tipo de vehículo manda sobre el
peso**: un semirremolque liviano sigue siendo un semirremolque, porque lo que
limita es la maniobra y no la balanza.

El cálculo lo hace el servidor y viaja en `suitableForSelectedTruck`, así que la
app no reimplementa la regla — mismo criterio que separa `CabaTruckRoutingPolicy`
de `CabaRestrictionEvaluator`.

## API

```
GET /api/pois?categories=FuelStation,TyreShop&truckId=<guid>&suitableOnly=true
```

| Parámetro | Efecto |
|---|---|
| `categories` | Lista separada por comas. Una categoría desconocida devuelve **400**, no se ignora. |
| `truckId` | Completa `suitableForSelectedTruck` y `community.forYourTruck`. Si el camión no existe, 404. |
| `suitableOnly` | Deja lo verificado apto para el camión **o** lo recomendado por la comunidad para su tipo cuando la fuente no dice nada. Requiere `truckId`. |

`suitableOnly` oculta **lo desconocido y lo discutido**: es la lectura estricta
del filtro, y por eso la app lo trae apagado y avisa cuántos puntos escondió. La
regla es `PoiFilter.PassesSuitableOnly`, en el dominio, con sus ocho casos: un
"no apto" verificado sigue afuera aunque la comunidad lo recomiende — la
comunidad completa, no contradice.

Leer no exige sesión, pero con sesión cada lugar trae `community.yourVote`.

## La comunidad

Desde el 15/09/2026 los usuarios **votan** un lugar como apto o no apto y
**agregan** lugares nuevos. Decisiones del usuario, con el porqué, en AD-46 y en
la spec `docs/superpowers/specs/2026-09-15-pois-comunidad-y-gamificacion-design.md`.

**La regla de fondo: la comunidad complementa lo verificado, no lo reemplaza.**
Los votos nunca escriben `verificationLevel` ni `suitableFor…`; viajan en un
bloque aparte del DTO, para que la ficha marque distinto cada origen:

```json
"community": {
  "suitable": 3, "notSuitable": 1, "seal": "Recommended",
  "forYourTruck": { "truckClass": "SemiTrailer", "suitable": 3, "notSuitable": 0, "seal": "Recommended" },
  "yourVote": "Suitable",
  "contributed": { "at": "2026-09-15", "byAlias": "demo" }
}
```

| Pieza | Dónde | Qué hace |
|---|---|---|
| `PoiVote` | `Domain/Pois/PoiVote.cs` | un voto por camionero y lugar, con el **tipo de camión** (`PoiSuitabilityField`, el mismo de la aptitud) y el veredicto. Se guarda el tipo y no el id del camión: borrar el camión no borra el voto |
| `CommunityStanding` | `Domain/Pois/CommunityStanding.cs` | el sello, función pura: **recomendado** con al menos 3 aptos y el doble de aptos que no aptos; **en discusión** con al menos 3 votos y los no aptos igualando o superando; **sin votos** en el resto. Se calcula sobre todos y sobre los del tipo del camión que consulta |
| `PoiContribution` | `Domain/Pois/PoiContribution.cs` | cómo nace un lugar aportado: `NotConfirmed`, evidencia `None`, los cuatro campos de aptitud en `null`, `ManagedByDataset = false` (el seed no lo toca), dentro de CABA y su anillo, con `contributedBy` |
| `PoiFilter` | `Domain/Pois/PoiFilter.cs` | qué deja pasar `suitableOnly` |
| `GeoDistance` | `Domain/Pois/GeoDistance.cs` | los 25 m del duplicado, los mismos del candado del dataset |
| `CommunityReader`, `PoiVoting`, `PoiContributing` | `Infrastructure/Pois/` | contar votos por lote; votar y retirar; agregar. Probados contra SQLite real |

```
PUT    /api/pois/{id}/vote   { truckId, verdict: "Suitable" | "NotSuitable" }   → { community, earned }
DELETE /api/pois/{id}/vote                                                     → 204
POST   /api/pois             { name, category, latitude, longitude, address?, description?, truckId }
                             → 201 { poi, earned } · 400 con el motivo · 409 con existingId (misma categoría a < 25 m)
```

Votar y agregar piden sesión. **El aporte trae su primer voto**: quien carga un
lugar vota apto con su camión en la misma operación.

### Lo que paga, y por qué no se puede abusar del libro

Todo pasa por `ProgressionRecorder.RecordContributionAsync`, la misma puerta que
los viajes: el cliente nunca informa lo que ganó.

| Aporte | EXP | Pista `lugares` |
|---|---|---|
| Agregar un lugar | 10 (`ExperienceScale.PlaceAdded`) | +1 |
| Votar un lugar | 2 (`ExperienceScale.PlaceVote`), **una vez por lugar** | +1 |
| Completar un escalón de `lugares` | 100, como toda pista | recompensa `lugares-NN` (las skins) |

El índice único del libro sobre `(camionero, motivo, lugar)` es lo que hace que
cambiar el voto no pague, que retirarlo no devuelva —el libro no resta— y que
volver a votar no cobre. **Sin tope diario** por decisión del usuario del
15/09/2026: se revisa con datos.

### Lo que todavía no hay

La ficha con el botón de votar y el formulario para agregar: van con la
interfaz de POIs, que hoy no existe. `api.js` ya tiene `pois`, `addPoi`,
`votePoi` y `retirePoiVote`, y `logros.js` la insignia de `lugares`. Tampoco hay
moderación ni edición de lo aportado: un lugar mal puesto queda mal puesto
hasta que exista.

## Los datos

Archivos JSON versionados en `src/TruckNavigator.Infrastructure/Data/`, embebidos
en el ensamblado. `PoiDataset` levanta **todos** los `pois-*.json`, así que sumar
un relevamiento de producción es agregar un archivo con `isSampleData: false`, sin
tocar código.

| Archivo | Origen | Puntos |
|---|---|---|
| `pois-caba-osm.json` | Generado por `data/fetch-caba-pois.ps1` (dato inicial, `isSampleData: true`). Tenía 75; nueve estaciones se mudaron al relevamiento el 15/09/2026 | 66 |
| `pois-caba-curados.json` | Relevamiento manual de agosto de 2026 con URL por entrada | 3 |
| `pois-caba-relevamiento-2026-09.json` | Relevamiento del 15/09/2026 con evidencia por las tres vías (`isSampleData: false`): 16 gomerías (14 `Confirmed`, 2 `Probable`), 1 auxilio pesado (`Probable`), 71 estaciones (5 `Confirmed`, 66 `NotConfirmed` sobre la Red de Tránsito Pesado), 1 lugar para comer (`Probable`), 22 talleres de mecánica pesada (21 `Confirmed`, 1 `Probable`). Método, búsquedas y descartes en `data/relevamiento/README.md` | 111 |

**180 puntos en total, 48 con aptitud declarada** (L-6 en
[data-sources.md](data-sources.md)). Los candados del dataset viven en
`PoiDatasetTests`: fuente y fecha en cada punto, ids únicos, ningún par de la
misma categoría a menos de 25 m, todo adentro de CABA y su anillo, el nivel
coherente con el tipo de evidencia, evidencia con fecha, y gomerías, talleres
y lugares para comer nunca sin evidencia.

El `Id` se deriva de `Source`, así que es estable entre corridas sin escribir
GUIDs a mano. Por eso dos puntos con la misma cadena de fuente son el mismo
punto: las fichas públicas llevan el nombre del comercio en la fuente.

### Regenerar el dataset de OSM

```powershell
./data/fetch-caba-pois.ps1 -MaxPerCategory 25
```

Consulta Overpass **en tiempo de autoría**, nunca en tiempo de ejecución. El
script marca aptitud sólo cuando el objeto tiene una etiqueta `hgv` explícita, y
descarta lo que no tiene nombre. De los cientos de objetos disponibles conserva
los mejor documentados de cada categoría; el criterio de corte es la cantidad de
tags útiles (dirección, horario, teléfono, web, operador).

`PointOfInterestSeed` hace *upsert* por id en cada arranque, no "sembrar si está
vacío": regenerar el dataset tiene que reflejarse en una base ya creada. Reconoce
lo suyo por `ManagedByDataset` —todo lo que sale de los archivos embebidos, sea de
muestra o de relevamiento— y borra lo que salió del archivo; lo que cargue el
usuario no se pisa. Hasta el 15/09/2026 filtraba por `IsSampleData`, y un archivo
de producción se reinsertaba en cada arranque: chocaba por clave en el segundo.

### Lo que se dejó afuera a propósito

**Lugares para comer con lugar para el camión: uno solo, y afuera de la
Ciudad.** El 15/09/2026 se buscó en Google Maps —comedor camioneros, parador
camiones, parrilla camioneros, comedores del Mercado Central— y en la web.
Dentro de CABA no apareció ningún restaurante con evidencia de lugar para el
camión: "Los Camioneros" (Parque Patricios) tiene el nombre y nada más. Lo que
hay son las estaciones Full de la Riccheri y los comedores adentro del Mercado
Central; entró el Comedor San Cayetano como `Probable`. Los paradores de verdad
están en las rutas, fuera del rectángulo.

**Estaciones cerradas que el registro oficial todavía lista.** El registro de la
Secretaría de Energía conserva bocas inactivas; cinco de las que estaban sobre la
Red se descartaron cruzándolas con el mapa de la marca y la ficha pública. Y una
misma boca puede figurar dos veces (líquidos y GNC con distinto `idempresa`):
se fusionan, y hay un test que atrapa el duplicado.

**PinkGrúas** y **Remolques del Norte** ofrecen auxilio en CABA pero no publican
domicilio ni base. Sin ubicación no hay marcador posible, y ponerles una
coordenada inventada sería exactamente lo que este documento dice que no se hace.
Remolques del Norte, además, no confirma remolque de camiones de carga.

**Grúas El Enganche** sí entró, con una salvedad que viaja en su propia
descripción: la fuente declara base en Villa Lugano pero no publica domicilio, así
que el marcador está en el centro del barrio. La imprecisión está dicha en el
registro, no escondida.

**Auxilio Full Truck** tiene base en San Martín, fuera de CABA, y cobertura
declarada que la incluye. Se carga igual, con el marcador en la base: dejar la
categoría vacía escondería un dato que el camionero necesita. Ver L-5 en
[data-sources.md](data-sources.md).

## En la pantalla

> **Hoy la app web no muestra los POIs.** Lo que sigue describe la interfaz MAUI
> anterior a la mudanza a `wwwroot`; `api.js` conserva `pois()` pero ninguna
> vista lo llama y no hay capa en `layers.js`. La interfaz es la construcción
> siguiente al relevamiento, sobre el prototipo de diseño.

- Botón **Lugares** abajo a la derecha del mapa: abre los filtros por categoría,
  más "Solo aptos para mi camión" y el contador de ocultos.
- Tocar un marcador abre la ficha con todo lo disponible, la fuente, y los botones
  **Usar como destino**, **Llamar** y **Web** (los dos últimos sólo si el dato
  existe).
- El estado de los filtros se guarda en `Preferences`, igual que la URL de la API.

**Usar como destino** pasa por `SetEntryText` y `SetPointAsync`. No es un detalle
de estilo: un punto sólo vale si el texto del campo sigue siendo exactamente la
etiqueta registrada al fijarlo (ver AD-12), así que escribir el `Entry` por fuera
rompería el cálculo de ruta.
