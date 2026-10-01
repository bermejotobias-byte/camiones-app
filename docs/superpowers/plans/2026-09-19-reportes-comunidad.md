# Reportes de la comunidad — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un camionero reporte en un toque lo que ve en su posición, que otros lo confirmen o rechacen al pasar, que el reporte viva lo que su tipo dice y muera solo, que avise en la ruta a quien le importa, y que un cierre o un gálibo **validados** cambien la ruta del camión al que le tocan — con EXP separada de reputación y sin forma de farmear.

**Architecture:** todo lo que decide es una función pura del dominio con el reloj como parámetro (catálogo, confiabilidad, vencimiento, promoción, reputación, abuso, polígono del bloqueo). La infraestructura sólo lee y escribe (tres tablas nuevas) y le pasa los bloqueos validados al calculador, que los mete como `areas` en el custom model por pedido. La API expone cuatro endpoints con la forma de los de lugares. La web suma un módulo por superficie (`mapa/reportes.js`), los reportes entran a `alertsAlongRoute` como un dataset más, y `navigate.js` sólo engancha.

**Tech Stack:** .NET 10 Minimal API + EF Core/SQLite; GraphHopper 11 en modo flexible (`areas` verificado el 19/09/2026); módulos ES sin build; xUnit y `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-19-reportes-comunidad-design.md` — el plan argumenta desde ahí; cada tarea cita su sección.

## Global Constraints

- **TDD estricto**: cada tarea arranca con el test en rojo, se lo ve fallar por el motivo correcto, y recién ahí el código mínimo. Un commit por tarea; nunca dos arreglos en uno.
- **Después de cada tarea**: `dotnet test` (451 al arrancar) y `node --test "tests/web/*.test.mjs"` (189) **verdes**. Antes de `dotnet build/test`: parar el preview `api` (MSB3027).
- `Domain` sin dependencias externas. Nombres de tipo en inglés, comentarios y docs en español, sin acentos dentro de los `.cs`.
- Los números de la spec son **constantes con nombre** en un solo lugar por tema (`ReportCatalog`, `ReportStanding`, `ReportExpiry`, `ReputationScale`, `ReportAbuseGuard`, `ExperienceScale`), nunca literales sueltos en un endpoint.
- Sólo se reporta en la posición GPS (decisión del usuario). Sin *vehículo detenido* ni *límite de peso*. Umbral de lo fijo: **5**.
- Un dato de la comunidad **no se muestra igual** que uno oficial; donde falta el dato, se dice que falta.
- Tests de integración con SQLite en memoria (`PoiVotingTests` es el molde); los de GraphHopper con `[GraphHopperFact]`, que se saltean si el motor no está.
- `routing/config-truck.yml` y `.claude/launch.json` no se commitean nunca. Push sólo si el usuario lo pide.

---

## Etapa 1 · Dominio (puro)

### Task 1: El catálogo de tipos

**Files:**
- Create: `src/TruckNavigator.Domain/Reports/ReportType.cs` (`ReportType`, `ReportKind`)
- Create: `src/TruckNavigator.Domain/Reports/ReportCatalog.cs` (`ReportRule`, `ReportCatalog`)
- Test: `tests/TruckNavigator.UnitTests/ReportCatalogTests.cs`

**Interfaces:**
- Produces: `enum ReportType { Accident, Traffic, Checkpoint, Police, Camera, Roadworks, Pothole, Hazard, RoadClosed, LowClearance }`; `enum ReportKind { Information, Restriction }`; `record ReportRule(ReportType Type, ReportKind Kind, TimeSpan Lifetime, bool ExtendsWithConfirmation, (double Min, double Max)? ValueRange, int? FixedAfterConfirmations)`; `ReportCatalog.Get(ReportType)`, `ReportCatalog.All`, `ReportCatalog.FixedThreshold = 5`.

- [x] **Step 1: Tests en rojo** — (a) todo valor del enum tiene regla (`Enum.GetValues` contra `All`); (b) las vidas útiles de la spec §3: Traffic 45 min, Police 1 h, Accident/Checkpoint/Hazard 2 h, Camera 6 h, RoadClosed 12 h, Pothole/Roadworks 7 días, LowClearance 30 días; (c) sólo RoadClosed y LowClearance son `Restriction`; (d) sólo LowClearance tiene `ValueRange` y es (2.0, 6.0); (e) sólo Camera tiene `FixedAfterConfirmations` y vale 5.
- [x] **Step 2: Rojo. Step 3:** el catálogo como diccionario construido en estático, con el comentario de por qué cada número es una constante ahí. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: el catalogo de tipos, con vida util, clase y lo que se vuelve fijo`.

### Task 2: El reporte y su voto

**Files:**
- Create: `src/TruckNavigator.Domain/Reports/Report.cs` (`Report`, `ReportStatus`), `ReportVote.cs` (`ReportVote`, `ReportVerdict`), `NewReport.cs`
- Test: `tests/TruckNavigator.UnitTests/ReportTests.cs`

**Interfaces:**
- Produces: `Report` con las propiedades de la spec §3 (`ExpiresAt` **nullable**; `Status` `Active | Validated | Fixed | Rejected | ClosedByAuthor`); `record NewReport(ReportType Type, double Latitude, double Longitude, double? HeadingDegrees, double? SpeedMps, string? Street, double? Value)`; `Report.Create(Guid driverId, NewReport input, DateTimeOffset when)` que tira `ArgumentException` con el motivo para la persona; `ReportVote { ReportId, DriverId, Verdict, CastAt, UpdatedAt, DistanceMeters }`; `Report.MovingSpeedMps = 2`.

- [x] **Step 1: Tests en rojo** — (a) nace `Active`, `ExpiresAt = when + Lifetime`, contadores en 0; (b) fuera del rectángulo de `PoiContribution.IsInsideCoverage` → excepción "dentro de CABA o de su anillo"; (c) LowClearance sin valor → excepción; con 1,5 o 6,5 → excepción; con 3,8 → `Value = 3.8`; (d) un tipo sin valor recibe `Value` y lo ignora (queda `null`); (e) `HeadingDegrees` se guarda sólo si `SpeedMps >= 2`: a 1,5 m/s queda `null`; (f) el rumbo se normaliza a [0, 360); (g) la calle se recorta y vacía → `null`.
- [x] **Step 2: Rojo. Step 3:** implementar `Create` reutilizando `PoiContribution.IsInsideCoverage`. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: el reporte nace en la posicion GPS, con rumbo solo en movimiento`.

### Task 3: La confiabilidad

**Files:**
- Create: `src/TruckNavigator.Domain/Reports/ReportStanding.cs`
- Test: `tests/TruckNavigator.UnitTests/ReportStandingTests.cs`

**Interfaces:**
- Produces: `enum ReliabilityLabel { New, Confirmed, Disputed }`; `ReportStanding.ScoreFor(Report report, int creatorReputation, DateTimeOffset now) : int` (0–100); `LabelFor(Report, int score) : ReliabilityLabel`; `IsValidated(Report, int score) : bool`; constantes `Base = 35`, `PerReputationPoint = 0.30`, `PerConfirmation = 12`, `MaxCountedConfirmations = 4`, `PerRejection = 18`, `FreshnessDrop = 0.40`, `ConfirmedFrom = 60`, `ValidatedFrom = 70`, `ValidatedConfirmations = 2`.

- [x] **Step 1: Tests en rojo** — los ejemplos exactos de la spec §4 con frescura 1 (recién creado): reputación 50 → 50; con 2 confirmaciones → 74; 2 y 1 rechazo → 56; reputación 90 → 62; reputación 10 → 38; reputación 10 con 2 confirmaciones → 62 (no validado), con 3 → 74 (validado); 5 confirmaciones cuentan como 4 (98 → tope 100 con reputación alta); frescura: a mitad de vida 50 → 40, al vencer 50 → 30; nunca fuera de 0–100; un reporte `Fixed` (sin `ExpiresAt`) tiene frescura 1 siempre.
- [x] Etiquetas: sin votos → `New` aunque la reputación sea 90; 1 confirmación y score 62 → `Confirmed`; 1 rechazo y 1 confirmación → `Disputed`; 1 rechazo y 0 confirmaciones → `Disputed`. Validado: 2 confirmaciones + score ≥ 70; 1 confirmación con score 80 → no.
- [x] **Step 2: Rojo. Step 3:** implementar como en la fórmula de §4, con `Math.Clamp` y `edad / vida útil` acotado a 1. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: la confiabilidad, con los ejemplos de la spec fijados por test`.

### Task 4: Vencimiento y promoción

**Files:**
- Create: `src/TruckNavigator.Domain/Reports/ReportExpiry.cs`, `ReportPromotion.cs`
- Test: `tests/TruckNavigator.UnitTests/ReportExpiryTests.cs`, `ReportPromotionTests.cs`

**Interfaces:**
- Produces: `ReportExpiry.IsExpired(Report, DateTimeOffset now)`; `ReportExpiry.Confirm(Report, now)` (estira: `max(ExpiresAt, now + Lifetime/2)` con tope `CreatedAt + 3 × Lifetime`; no toca un `Fixed`); `ReportExpiry.ShouldReject(Report)` (`Rejections >= 2 && Rejections > Confirmations`); `ReportExpiry.Reject(Report, now)` (`Status = Rejected`, `ExpiresAt = now`); `ReportExpiry.CloseByAuthor(Report, now)`; `ReportPromotion.ShouldFix(Report)` (tipo con umbral y `Confirmations >= 5`); `ReportPromotion.Fix(Report)` (`Status = Fixed`, `ExpiresAt = null`); `ReportPromotion.ShouldUnfix(Report)` (`Fixed && Rejections >= 5 && Rejections > Confirmations`). Constantes `ExtensionFraction = 0.5`, `MaxLifetimes = 3`, `RejectionsToKill = 2`.

- [x] **Step 1: Tests en rojo** — estirar una obra el día 6 → vence el día 10,5 (no antes de lo que ya tenía) con tope día 21; tránsito confirmado tres veces seguidas no pasa de 2 h 15; 2 rechazos y 1 confirmación → rechazado; 2 y 2 → no; cerrar el propio → `ClosedByAuthor` y vencido ya; una cámara con 5 confirmaciones → `Fixed` y `ExpiresAt null`, no vence nunca (`IsExpired` falso un año después); un accidente con 5 → no se fija; cámara fija con 5 rechazos y 4 confirmaciones → `ShouldUnfix`; con 5 y 6 → no.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: vencen solos, se estiran al confirmarlos y la camara muy confirmada es fija`.

### Task 5: Reputación y relevancia para el camión

**Files:**
- Create: `src/TruckNavigator.Domain/Reports/DriverReputation.cs` (entidad + `ReputationScale`), `ReportRelevance.cs`
- Test: `tests/TruckNavigator.UnitTests/ReputationScaleTests.cs`, `ReportRelevanceTests.cs`

**Interfaces:**
- Produces: `DriverReputation { DriverId, Score, UpdatedAt }`; `ReputationScale.Start = 50`, `OnValidated = +3`, `OnRejected = -5`, `Apply(int score, int delta) : int` (0–100); `enum TruckRelevance { NotApplicable, Compatible, Incompatible }`; `ReportRelevance.ForTruck(Report, TruckProfile) : TruckRelevance` (LowClearance: `truck.HeightMeters > Value` → Incompatible; RoadClosed → Incompatible para todos; el resto NotApplicable).

- [x] **Step 1: Tests en rojo** — 50 + 3 = 53; 2 − 5 = 0 (no negativo); 99 + 3 = 100; gálibo 3,80: camión 4,10 → Incompatible, 3,60 → Compatible, 3,80 → Compatible (igual pasa); accidente → NotApplicable; calle cerrada → Incompatible.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: reputacion del que reporta, y el galibo reportado contra el camion elegido`.

### Task 6: Contra el abuso

**Files:**
- Create: `src/TruckNavigator.Domain/Reports/ReportAbuseGuard.cs`
- Test: `tests/TruckNavigator.UnitTests/ReportAbuseGuardTests.cs`

**Interfaces:**
- Produces: `record RecentReport(ReportType Type, double Latitude, double Longitude, DateTimeOffset CreatedAt, Guid Id, bool Active)`; `record AbuseVerdict(bool Allowed, int RetryAfterSeconds, Guid? DuplicateOf, string? Reason)`; `ReportAbuseGuard.Check(NewReport input, IReadOnlyList<RecentReport> mine, IReadOnlyList<RecentReport> nearby, int reputation, DateTimeOffset now)`; constantes `Cooldown = 45 s`, `LowReputationBelow = 25` (cooldown × 2), `MaxPerHour = 20`, `DuplicateMeters = 150`, `DuplicateWindow = 15 min`.

- [x] **Step 1: Tests en rojo** — un reporte mío hace 20 s → no permitido, `RetryAfterSeconds = 25`; hace 50 s → permitido; reputación 20 y hace 60 s → no (espera 90); 20 míos en la última hora → no; 19 → sí; uno ajeno del mismo tipo a 100 m hace 10 min y activo → `DuplicateOf` con su id; a 200 m → no es duplicado; hace 20 min → no; de otro tipo → no; inactivo → no. `Reason` viene escrito para la persona.
- [x] **Step 2: Rojo. Step 3:** implementar con `GeoDistance.Meters`. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: espera entre reportes, tope por hora y duplicados cerca`.

### Task 7: El bloqueo en el custom model

**Files:**
- Create: `src/TruckNavigator.Domain/Routing/RouteBlockade.cs`, `IRouteBlockadeSource.cs`
- Modify: `src/TruckNavigator.Domain/Routing/CustomModel.cs` (`Areas`), `ITruckRoutingPolicy.cs` (sobrecarga), `CabaTruckRoutingPolicy.cs`
- Test: `tests/TruckNavigator.UnitTests/RouteBlockadeTests.cs`, `CabaTruckRoutingPolicyTests.cs` (+ casos)

**Interfaces:**
- Produces: `record RouteBlockade(string Id, double Latitude, double Longitude, double? HeadingDegrees)` con `Polygon() : IReadOnlyList<(double Lon, double Lat)>` cerrado (rectángulo 40 × 16 m a lo largo del rumbo; cuadrado de 24 m sin rumbo; matemática plana con `cos(lat)`); `CustomModel.Areas` (`GeoJsonFeatureCollection` con `Type`, `Features[]` de `Id`, `Properties {}`, `Geometry { Type = "Polygon", Coordinates }`, `JsonPropertyName` en minúscula, `WhenWritingNull`); `ITruckRoutingPolicy.BuildCustomModel(truck, when, IReadOnlyList<RouteBlockade>)` y la de dos parámetros llama con `[]`; `interface IRouteBlockadeSource { Task<IReadOnlyList<RouteBlockade>> ActiveAsync(TruckProfile, DateTimeOffset, CancellationToken); }` y `NoRouteBlockades` (lista vacía, `NoRouteBlockades.Instance`).

- [x] **Step 1: Tests en rojo** — el polígono sin rumbo tiene 5 puntos, el primero igual al último, ±12 m en las dos direcciones (tolerancia 0,5 m); con rumbo 90° el rectángulo se extiende ±20 m en longitud y ±8 m en latitud; con rumbo 0°, al revés; la política con dos bloqueos serializa `"areas"` con ids `r1`, `r2` y agrega `{"if":"in_r1","multiply_by":"0"}` y `in_r2` **después** de las reglas físicas; sin bloqueos el JSON no lleva `"areas"` y es idéntico al de hoy (los tests existentes de la política no cambian).
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde**, `dotnet test` entero.
- [x] **Step 5: Commit** — `Ruteo: un cierre validado entra al custom model como area bloqueada`.

### Task 8: EXP y pista de reportes

**Files:**
- Modify: `src/TruckNavigator.Domain/Progression/LedgerEntry.cs` (`ReportValidated = 4`, `ReportVoted = 5`), `ExperienceScale.cs` (`ReportValidated = 15`, `ReportVote = 2`, `ReportVotesPaidPerDay = 10`), `TrackCatalog.cs` (`Reports = "reportes"`, escalera de viajes)
- Test: `tests/TruckNavigator.UnitTests/ExperienceScaleTests.cs`, `TrackCatalogTests.cs` (+ casos)

- [x] **Step 1: Tests en rojo** — la pista `reportes` existe con los 10 escalones `1 · 3 · 7 · 15 · 30 · 60 · 120 · 250 · 500 · 1_000` y recompensas `reportes-01…10`; ninguna recompensa se repite entre pistas (el test de invariante que ya existe la cubre al agregar la pista); `ExperienceScale.ReportValidated == 15`, `ReportVote == 2`, `ReportVotesPaidPerDay == 10`; el escalón (100) sigue ganándole al reporte validado.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde.**
- [x] **Step 5: Commit** — `Progresion: la pista de reportes, y lo que paga validar y votar`.

### Task 9: El lugar aportado se gradúa

**Files:**
- Modify: `src/TruckNavigator.Domain/Pois/PointOfInterest.cs` (`SuitabilityEvidenceKind.Community = 5`)
- Create: `src/TruckNavigator.Domain/Pois/PoiPromotion.cs`
- Test: `tests/TruckNavigator.UnitTests/PoiPromotionTests.cs`

**Interfaces:**
- Produces: `PoiPromotion.Threshold = 5`; `PoiPromotion.Apply(PointOfInterest poi, PoiSuitabilityField field, int suitable, int notSuitable, DateTimeOffset when) : bool` (devuelve si cambió algo).

- [x] **Step 1: Tests en rojo** — lugar aportado (`ManagedByDataset = false`, `NotConfirmed`) con 5 aptos de `HeavyTruck` → `Probable`, `SuitableForHeavyTruck = true`, `SuitabilityEvidenceKind.Community`, evidencia `"Confirmado apto para camion pesado por 5 camioneros de la comunidad (19/09/2026)"` (fecha local); los otros tres campos siguen `null`; con 4 → nada; 5 de *no apto* → `SuitableForHeavyTruck = false` y `Probable`; **un lugar del dataset con 5 aptos no cambia nada** y devuelve `false`; un lugar ya `Confirmed` no baja a `Probable`; volver a aplicar no reescribe la fecha.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde.**
- [x] **Step 5: Commit** — `Lugares: con cinco votos de apto, el lugar aportado se incorpora a la base`.

---

## Etapa 2 · Infraestructura

### Task 10: Las tablas

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Persistence/AppDbContext.cs` (`Reports`, `ReportVotes`, `DriverReputations`; ticks en `CreatedAt`, `ExpiresAt` (nullable), `ValidatedAt`, `CastAt`, `UpdatedAt`; clave compuesta `(ReportId, DriverId)`; índices `Reports(ExpiresAt)`, `Reports(CreatedBy, CreatedAt)`, `Reports(Latitude, Longitude)`, `ReportVotes(ReportId)`)
- Create: migración `AddCommunityReports` (`dotnet ef migrations add AddCommunityReports --project src/TruckNavigator.Infrastructure --startup-project src/TruckNavigator.Api --output-dir Persistence/Migrations`; parar el preview antes)
- Test: `tests/TruckNavigator.IntegrationTests/ReportPersistenceTests.cs`

- [x] **Step 1: Tests en rojo** — ida y vuelta de un reporte con `ExpiresAt` null y con valor, fechas con offset −3 que vuelven iguales en UTC; dos votos del mismo camionero al mismo reporte → `DbUpdateException` (con `ChangeTracker.Clear()` antes, como enseñó el 10/09); la reputación se guarda por `DriverId`; ordenar por `ExpiresAt` no tira (`SQLite no ordena DateTimeOffset` es justamente lo que el conversor evita).
- [x] **Step 2: Rojo. Step 3:** configurar y generar la migración; revisar el `.cs` generado (que `ExpiresAt` sea `INTEGER NULL`). **Step 4: Verde**, y `dotnet run` arranca migrando sin error.
- [x] **Step 5: Commit** — `Reportes: las tres tablas, con las fechas en ticks`.

### Task 11: El recorder paga reportes

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Progression/ProgressionRecorder.cs` (`RecordReportValidatedAsync(Guid creatorId, Guid reportId, when)` → 15 + pista `reportes`; `RecordReportVoteAsync(Guid voterId, Guid reportId, when)` → 2 si los `ReportVoted` del día local son < 10, si no `null`)
- Test: `tests/TruckNavigator.IntegrationTests/ProgressionRecorderTests.cs` (+ casos)

- [x] **Step 1: Tests en rojo** — validar paga 15 y avanza `reportes` a 1 (escalón 1 → +100 y `reportes-01`); validar dos veces el mismo reporte → la segunda `null`; el voto paga 2; el voto 11 del día → `null` y no escribe; el voto 1 del día siguiente (23:30 → 00:30 hora local) → paga; votar el mismo reporte dos veces → la segunda `null`.
- [x] **Step 2: Rojo. Step 3:** implementar sobre `Apply` como los aportes; el día local con el offset −3 fijo, como `PoiContribution.LocalOffset`. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Progresion: validar un reporte paga al creador; votar paga con tope diario`.

### Task 12: Crear un reporte

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Reports/ReportWriter.cs` (`CreateAsync`), `ReportViews.cs` (`ReportView`)
- Modify: `src/TruckNavigator.Api/Program.cs` (DI: `AddScoped<ReportWriter>()`, `AddScoped<ReportReader>()`, `AddScoped<IRouteBlockadeSource, RouteBlockades>()` — el último en la Task 15)
- Test: `tests/TruckNavigator.IntegrationTests/ReportWriterTests.cs`

**Interfaces:**
- Produces: `record ReportView(Report Report, int Score, ReliabilityLabel Label, bool Validated, TruckRelevance Relevance, string? ReportedByAlias, ReportVerdict? YourVote, bool Mine)` (la arma `ReportViews.Build(report, reputation, truck, viewerId, alias, vote, now)`, pura sobre el dominio); `record CreateReportResult(Report? Report, Guid? DuplicateOf, int RetryAfterSeconds, string? Error)`; `ReportWriter(AppDbContext db, ProgressionRecorder progression, IPlaceSearch places)`; `CreateAsync(Guid driverId, NewReport input, DateTimeOffset when, CancellationToken ct)`; la calle: si `input.Street` es null, `places.ReverseAsync` con `CancellationTokenSource` de **1,5 s** enlazado a `ct`, y `null` si falla o tarda.

- [x] **Step 1: Tests en rojo** — crea y devuelve el reporte con `Status Active`; el segundo a los 10 s → `RetryAfterSeconds 35` y sin fila; mismo tipo a 50 m de otro activo → `DuplicateOf`; la calle viene de un `IPlaceSearch` falso (`"Av. Corrientes 5500"`); si el falso tarda 3 s, la calle queda `null` y el reporte igual se crea; fuera del área → `Error` con el motivo; la reputación de un usuario nuevo se lee como 50 sin fila.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: crear, con la calle de Photon si llega a tiempo y sin duplicar`.

### Task 13: Votar, validar, fijar, cerrar

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Reports/ReportWriter.cs` (`VoteAsync`, `CloseAsync`)
- Test: `tests/TruckNavigator.IntegrationTests/ReportVotingTests.cs`

**Interfaces:**
- Produces: `enum VoteOutcome { Ok, OwnReport, TooFar, NotFound, Expired }`; `record ReportVoteResult(VoteOutcome Outcome, ReportView? View, ContributionEarnings? Earned)`; `VoteAsync(Guid driverId, Guid reportId, ReportVerdict verdict, double latitude, double longitude, TruckProfile? truck, DateTimeOffset when, ct)`; `CloseAsync(Guid driverId, Guid reportId, when, ct) : bool`; `ReportWriter.VoteMaxMeters = 500`.

- [x] **Step 1: Tests en rojo** — votar el propio → `OwnReport`; a 800 m → `TooFar`; vencido → `Expired`; *sigue ahí* de dos personas → `Validated`, `ValidatedAt` puesto, el creador cobra 15 **una vez** y su reputación pasa a 53, cada votante cobra 2; cambiar el voto de uno de ellos a *ya no está* → contadores 1/1, nada se paga, el status queda `Validated` (no se degrada por un cambio); dos *ya no está* contra uno → `Rejected`, `ExpiresAt = now`, reputación del creador 50 − 5; una cámara con 5 *sigue ahí* → `Fixed`, `ExpiresAt null`; cerrar el propio → `true` y `ClosedByAuthor`; cerrar el ajeno → `false`; el `DistanceMeters` del voto se guarda.
- [x] **Step 2: Rojo. Step 3:** implementar: upsert del voto, recuento desde las filas (no `++`), `ReportStanding` + `ReportExpiry` + `ReportPromotion`, reputación con `ReputationScale`, EXP por el recorder, todo en un `SaveChangesAsync`. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: sigue ahi / ya no esta, con validacion, reputacion y EXP en una sola escritura`.

### Task 14: Leer por bbox

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Reports/ReportReader.cs`
- Test: `tests/TruckNavigator.IntegrationTests/ReportReaderTests.cs`

**Interfaces:**
- Consumes: `ReportView` (Task 12).
- Produces: `ReportReader.InBoxAsync(double minLon, double minLat, double maxLon, double maxLat, TruckProfile? truck, Guid? viewerId, DateTimeOffset now, ct)`; `ReportReader.MaxBoxDegrees = 0.25`; `ForOneAsync(Guid id, …)`.

- [x] **Step 1: Tests en rojo** — devuelve los activos del bbox (vigentes y los `Fixed`), no los vencidos ni los `Rejected`/`ClosedByAuthor`, no los de afuera; el alias del creador viene (`null` si no tiene); `YourVote` y `Mine` con `viewerId`; `Relevance` según el camión (gálibo 3,8 con camión de 4,1 → Incompatible); un bbox mayor a 0,25° se recorta al centro; ordenados por `CreatedAt` descendente.
- [x] **Step 2: Rojo. Step 3:** implementar; las reputaciones de los creadores en una sola consulta (`ContributorAliasesAsync` es el molde). **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes: los vigentes del recuadro, con confiabilidad y relevancia para el camion`.

### Task 15: Los bloqueos llegan al calculador

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Routing/RouteBlockades.cs` (`IRouteBlockadeSource` sobre la base)
- Modify: `src/TruckNavigator.Infrastructure/Routing/GraphHopperRouteCalculator.cs` (parámetro opcional `IRouteBlockadeSource? blockades = null`; en `RequestAsync`: `var activos = await (blockades ?? NoRouteBlockades.Instance).ActiveAsync(truck, departure, ct)` y `routingPolicy.BuildCustomModel(truck, departure, activos)`), `DependencyInjection.cs` o `Program.cs` (DI)
- Test: `tests/TruckNavigator.IntegrationTests/RouteBlockadesTests.cs` (SQLite) y `TruckRoutingTests.cs` (+ un `[GraphHopperFact]`)

- [x] **Step 1: Tests en rojo** — (SQLite) sólo los `Validated`/`Fixed` vigentes de tipo restricción entran; un gálibo 3,8 entra para un camión de 4,1 y no para uno de 3,6; una calle cerrada entra para los dos; un cierre `Active` sin validar no entra; el id es `r{n}`. (GraphHopper) la ruta de prueba entre dos puntos fijos pasa por una cuadra conocida; con un bloqueo validado en el punto medio de su geometría, la ruta nueva **no pasa a menos de 15 m** de ese punto y es más larga o igual; con el mismo reporte sin validar, la ruta es idéntica.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde** (los tres tests que construyen el calculador a mano siguen compilando por el parámetro opcional).
- [x] **Step 5: Commit** — `Ruteo: los cierres y galibos validados esquivan la cuadra, medido contra GraphHopper`.

### Task 16: `PoiVoting` gradúa el lugar

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Pois/PoiVoting.cs` (después de guardar el voto, contar por `TruckClass` y `Verdict` para ese lugar y `PoiPromotion.Apply`)
- Test: `tests/TruckNavigator.IntegrationTests/PoiVotingTests.cs` (+ casos)

- [x] **Step 1: Tests en rojo** — cinco camioneros con camión pesado votan apto un lugar aportado → `Probable`, `SuitableForHeavyTruck true`, `Community`; el mismo caso sobre un lugar del dataset → sin cambios; cuatro → sin cambios; el `CommunityView` que vuelve sigue diciendo el sello de siempre.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde.**
- [x] **Step 5: Commit** — `Lugares: el quinto voto de apto gradua el lugar aportado`.

---

## Etapa 3 · API

### Task 17: `GET` y `POST /api/reports`

**Files:**
- Modify: `src/TruckNavigator.Api/Contracts/Dtos.cs` (`ReportDto` con la forma de la spec §9, `ReportDto.From(ReportView, now)`; `CreateReportRequest`), `Program.cs` (grupo `/api/reports`, `.WithTags("Reports")`)
- Test: `tests/TruckNavigator.IntegrationTests/ReportContractsTests.cs`

- [x] **Step 1: Tests en rojo** — el DTO serializa `kind` como `"info"`/`"restriction"`, `reliability.label` como `"new" | "confirmed" | "disputed"`, `forYourTruck` como `"compatible" | "incompatible" | null`, `expiresAt` null en una fija, `fixed true`, `yourVote` `"StillThere"`; `CreateReportRequest` deserializa `type` por nombre (`"LowClearance"`) y rechaza uno desconocido con 400 legible.
- [x] **Step 2: Rojo. Step 3:** `GET` anónimo con `bbox` (400 si no tiene cuatro números o está fuera de rango) y `truckId` opcional (`FindUsableTruckAsync`); `POST` con sesión: 201 con `Location`, 400 `ValidationProblem` con el motivo, 409 con `existingId` en `extensions`, **429** con `retryAfterSeconds` en `extensions` y cabecera `Retry-After`. **Step 4: Verde** y probado a mano con `curl` (el cuerpo en archivo UTF-8) contra la API en Development.
- [x] **Step 5: Commit** — `API: leer y crear reportes, con 409 para el duplicado y 429 para la espera`.

### Task 18: Votar y cerrar

**Files:**
- Modify: `src/TruckNavigator.Api/Program.cs` (`PUT /api/reports/{id}/vote`, `DELETE /api/reports/{id}`), `Dtos.cs` (`ReportVoteRequest`, `ReportVoteResponse(ReportDto Report, ContributionEarningsDto? Earned)`)
- Test: `tests/TruckNavigator.IntegrationTests/ReportContractsTests.cs` (+ casos)

- [x] **Step 1: Tests en rojo** — `ReportVoteRequest` deserializa `verdict` por nombre; la respuesta lleva `earned` con la misma forma que la del voto de lugares.
- [x] **Step 2: Rojo. Step 3:** `PUT` → 200 / 400 "Tenés que estar cerca para confirmarlo" / 403 / 404 / 410; `DELETE` → 204 / 403 / 404. **Step 4: Verde**, `curl` a mano: dos cuentas (demo y una segunda sembrada a mano en Development) validan un reporte y el `GET` lo devuelve `validated: true`.
- [x] **Step 5: Commit** — `API: sigue ahi / ya no esta, y cerrar el reporte propio`.

---

## Etapa 4 · Web

### Task 19: Lo puro de `reportes.js`

**Files:**
- Create: `src/TruckNavigator.Api/wwwroot/js/mapa/reportes.js`
- Modify: `src/TruckNavigator.Api/wwwroot/js/api.js` (`reports(bbox, truckId)`, `addReport(body)`, `voteReport(id, body)`, `closeReport(id)`)
- Test: `tests/web/reportes.test.mjs`

**Interfaces:**
- Produces: `TIPOS` (los diez, en el orden de la grilla: accidente, tránsito, control, policía, cámara, obra, bache, peligro, calle cerrada, gálibo; cada uno `{ id, tipo (nombre del enum), nombre, calcomania, restriccion, pideValor }`); `etiquetaEdad(createdAt, ahora)` ("recién", "hace 12 min", "hace 3 h", "hace 2 días", y `null` para una fija); `mismoSentido(rumboReporte, rumboRuta)` (null → true; diferencia angular ≤ 90 → true); `featuresDeReportes(reportes)` (geojson con `tipo`, `estado` ∈ nuevo/confirmado/duda/rojo/fijo, `id`); `estadoDelPin(r)`; `textoDelToast(r)` ("Reportado · Accidente en Av. Corrientes" / "Reportado · Accidente"); `deberiaPreguntar({ reporte, distancia, distanciaAnterior, yaPreguntado, mio, votado })` (true sólo cuando estuvo a ≤ 60 m y ahora se aleja, una vez); `bboxDeRuta(coords, margenMetros = 500)` y `bboxVisible(bounds)` como cadena `minLon,minLat,maxLon,maxLat`.

- [x] **Step 1: Tests en rojo** — uno por función con los casos de arriba; `TIPOS` tiene diez, ninguno repetido, sólo gálibo `pideValor`, sólo calle cerrada y gálibo `restriccion`.
- [x] **Step 2: Rojo. Step 3: implementar. Step 4: Verde** (`node --test`).
- [x] **Step 5: Commit** — `Reportes (web): el catalogo, la edad, el sentido y cuando preguntar si sigue ahi`.

### Task 20: Las hojas

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/mapa/reportes.js` (`seccionReportar()`, `hojaGalibo({ valor })`, `fichaReporte(r, { ahora })`, `promptSigueAhi(r)`), `mapa/aportar.js` (`hojaAportar()` arranca con `seccionReportar()` y el título pasa a "¿Qué ves?"), `mapa/piezas.js` (calcomanías propias: `accidente`, `transito`, `control`, `policia`, `camaraComunidad`, `obra`, `bache`, `peligro`, `calleCerrada`, `galiboReporte`, y `nombresDeCalcomanias` si existe la lista), `app.css` (`.gps-reportar-*`, el prompt de dos botones, sobre los tokens `--gps-*`)
- Test: `tests/web/reportes.test.mjs`, `tests/web/aportar.test.mjs` (+ casos), `tests/web/piezas.test.mjs` (+ casos)

- [x] **Step 1: Tests en rojo** — `seccionReportar()` tiene diez botones `data-accion="reportar"` con `data-tipo`; `hojaAportar()` los incluye antes de las seis categorías; `hojaGalibo` tiene las cinco pastillas (3,5 · 3,8 · 4,0 · 4,3 · 4,5) y "Otro"; `fichaReporte` muestra tipo, calle o "cerca de acá", "hace 12 min · 2 confirmaciones", `@alias` o `@anónimo`, los dos botones (`data-accion="voto"` con `data-veredicto`), *Cerrar reporte* sólo si es mío, "sin confirmar" cuando no está validado y es restricción, y "Tu camión no pasa" si es incompatible; `promptSigueAhi` tiene los dos botones y el id; cada calcomanía nueva devuelve SVG.
- [x] **Step 2: Rojo. Step 3: implementar** (medidas de la spec del GPS: círculos de 75, rótulo debajo, píldoras de 48). **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes (web): la grilla de reportar, el galibo, la ficha y el "sigue ahi"`.

### Task 21: La capa en el mapa

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/mapa/reportes.js` (`pinReporteSvg(calcomania, estado)`, `nombresDePinesDeReporte()`, `instalarReportes(map)`, `mostrarReportes(map, reportes)`, `CAPA_REPORTES = 'reporte-pin'`), `layers.js` (`GRUPOS.reporte = ['reporte-pin']`, visible por defecto), `map.js` (`export const showReports = (r) => mostrarReportes(map, r)`, `onReportTap(fn)`, `viewportBounds()`, instalación en `load`/`style.load` con la guardia `sigueVivo`), `mapa/capas.js` (cuadro "Reportes · comunidad"), `mapa/lugares.js` sólo si el pin fijo comparte el generador
- Test: `tests/web/reportes.test.mjs`, `tests/web/capas.test.mjs` (+ caso)

- [x] **Step 1: Tests en rojo** — `pinReporteSvg` distingue los cinco estados (el rojo lleva `--gps-rojo`, el fijo no lleva borde de edad); `nombresDePinesDeReporte()` son 10 × 5; la hoja de capas lista "Reportes"; `mostrarReportes` con lista vacía no rompe con `map` nulo (la lección del 18/09).
- [x] **Step 2: Rojo. Step 3: implementar** con `styleimagemissing` como los lugares y los pines precalentados. **Step 4: Verde**, y en el navegador a 360 × 800 se ven tres pines de prueba (`showReports` desde la consola con `import('/js/map.js')`).
- [x] **Step 5: Commit** — `Reportes (web): pines por tipo y estado, y su cuadro en la hoja de capas`.

### Task 22: Los reportes avisan en la ruta

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/navigation.js` (`alertsAlongRoute(prepared, features, opciones)`: `features.reportes` con corredor 30 m, filtro de sentido con el rumbo del tramo de la ruta, `tipo: 'reporte'` + `subtipo`, `nombre`, `restriccion`, `validado`, `forYourTruck`; `speakableAlert` para reportes: "Accidente a 300 metros", "Calle cerrada reportada, sin confirmar", "Gálibo reportado de 3,80 metros: tu camión no pasa"), `mapa/viaje.js` (`textoDeAviso` para `reporte`), `platform.js` (`VIBRACION.reporte = [40, 60, 40]`, `VIBRACION.peligro = [120, 80, 120, 80, 120]`), `views/navigate.js` (la vibración elige `peligro` si `forYourTruck === 'incompatible'`)
- Test: `tests/web/alerts.test.mjs`, `tests/web/viaje.test.mjs` (+ casos)

- [x] **Step 1: Tests en rojo** — un reporte a 10 m de la ruta entra, a 50 m no; con rumbo opuesto al tramo no entra, sin rumbo entra; el texto hablado de cada uno de los tres casos; la tarjeta dice "sin confirmar" en un cierre no validado; los dos patrones existen y son distintos de los cuatro que había.
- [x] **Step 2: Rojo. Step 3:** implementar; el rumbo del tramo con `bearing(points[i-1], points[i])`. **Step 4: Verde.**
- [x] **Step 5: Commit** — `Reportes (web): avisan en la ruta, en el sentido de marcha y con voz propia`.

### Task 23: `navigate.js` engancha

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/views/navigate.js`: (a) traer reportes al preparar la ruta y **cada 60 s** en viaje (bbox de la ruta + 500 m) y en reposo al `idle` con 1 s de espera (bbox visible), y `gl.showReports`; (b) `data-accion="reportar"`: posición = último fix de GPS (`ultimaPosicion`/`navState.position`), `heading` y `speed` del fix, `street` del paso actual en viaje; si no hay posición, toast "Sin GPS no se puede reportar"; `api.addReport` → cerrar la hoja, toast con *Deshacer* (`closeReport`), refrescar; 409 → `askConfirm` "Ya hay uno igual cerca. ¿Sigue ahí?" → `voteReport`; 429 → toast con los segundos; (c) tocar un pin → `fichaReporte` en `#sheet` clavada abajo (como la ficha de lugar); voto desde la ficha con la posición actual; (d) en viaje, en cada latido `deberiaPreguntar` por los reportes cercanos → `promptSigueAhi` 10 s con `setTimeout`; (e) el botón amarillo en reposo (`.map-side`, `pointer-events: auto`), oculto en `is-buscando`/`is-eligiendo`; (f) refrescar los avisos (`routeAlerts = alertsAlongRoute(...)`) al llegar reportes nuevos sin perder `alerted`.
- Modify: `app.css` (el botón en reposo y el prompt), `mapa/reposo.js` si el botón vive en el marcado de reposo
- Test: lo puro ya está testeado; acá se verifica en el navegador

- [x] **Step 1:** en el navegador a 360 × 800 con la cuenta demo: reportar un accidente desde reposo (con `TN_setPosition` en Palermo) → aparece el pin y el toast; volver a reportar a los 5 s → toast con la espera; un segundo del mismo tipo desde otra cuenta a 50 m → ofrece *Sigue ahí*; abrir la ficha, votar, ver el conteo; arrancar un viaje que pasa por el reporte → tarjeta, voz y vibración en el log; el prompt aparece al alejarse. Sin errores en consola.
- [x] **Step 2:** revisar que los `wire` de botones de un solo modo lleven `?` (la lección del 18/09), y que `desmontarViaje` apague el temporizador del prompt y el de los 60 s.
- [x] **Step 3: Commit** — `Reportes (web): un toque reporta en tu posicion, la ficha vota y el viaje pregunta si sigue ahi`.

### Task 24: El pin rojo y la ruta que esquiva, de punta a punta

- [x] **Step 1:** con GraphHopper y la API levantados: dos cuentas validan un gálibo de 3,8 sobre una calle; con el camión de 4,1 el `GET` lo devuelve `incompatible`, el pin sale rojo, y una ruta por esa calle **la esquiva**; con el de 3,6 pasa. Un cierre sin validar: aviso "sin confirmar" y la ruta no cambia.
- [x] **Step 2:** anotar en el plan lo que apareció; **no** mezclar arreglos con mejoras. *Apareció:* nada que arreglar. Medido el 19/09 con tres cuentas: antes de validar, El Rayo (4,2 m) ve el gálibo `incompatible` y la ruta pasa a 0 m de él (11.524 m); con dos confirmaciones queda `Validated` (score 75) y la ruta pasa a 1.771 m (6.875 m); el Camión pesado (3,8 m) lo ve `compatible` y su ruta no cambia. El pin sale rojo y la ficha dice "Tu camión no pasa · Confirmado: la ruta lo esquiva". Un detalle de simulación, no de la app: con saltos de 150 m por latido, dos avisos que cruzan su umbral en el mismo latido pierden uno (`pendingRouteAlert` avisa del más cercano); con pasos de 25 m —lo que hace un GPS real— salen los dos.
- [x] **Step 3: Commit** (si hubo arreglos, uno por arreglo, cada uno con su test en rojo primero).

---

## Etapa 5 · Docs y cierre

### Task 25: Documentar y contar

**Files:**
- Create: `docs/reportes.md` (modelo, catálogo, la fórmula con sus ejemplos, validación, vencimiento, lo fijo, EXP y reputación, abuso, contratos, cómo se configuran los números)
- Modify: `docs/decisions.md` (AD-49: reportes de la comunidad; enmienda a AD-46: lo aportado se gradúa con cinco; por qué `areas` y no el grafo; por qué la EXP sólo con validación ajena), `docs/pois.md` (la graduación), `docs/routing.md` (`areas`), `CLAUDE.md` (tabla de proyectos, comandos con los conteos nuevos, y las trampas que hayan aparecido), `.claude/skills/estado-camiones-app/SKILL.md` (§3 Fase 5, §4 verificado, §8), `.claude/skills/producto-camiones-app/SKILL.md` (Fase 5)
- Verify: `dotnet test` y `node --test` con los conteos finales anotados; `.\build-apk.ps1 -ApiUrl http://<ip del día>:5080` e instalar con `adb install -r`

- [x] **Step 1:** escribir los docs con los conteos medidos, no estimados (608 .NET = 427 + 181, 14 contra GraphHopper; 224 web).
- [ ] **Step 2:** compilar e instalar el APK (compilado el 19/09 a las 22:04 con -ApiUrl http://192.168.100.106:5080, 31,4 MB; el teléfono no estaba por USB: queda servido en http://192.168.100.106:8081/ y por `adb install -r` cuando aparezca); el usuario reporta y confirma desde el teléfono con su cuenta mientras se lee el log (`adb logcat -v time -s Web:V Cascara:V Brujula:V`, sin `touchmove` ni *Mixed Content*).
- [ ] **Step 3: Commit** — `Docs: los reportes de la comunidad (AD-49), y los conteos`.
