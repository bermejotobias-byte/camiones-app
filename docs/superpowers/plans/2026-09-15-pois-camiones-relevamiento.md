# Relevamiento de POIs aptos para camiones — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar la base de POIs con gomerías, estaciones de servicio y lugares para comer aptos para camiones, en CABA más el anillo de acceso, con evidencia escrita por punto y sin romper lo que existe.

**Architecture:** El subsistema de POIs ya existe (dominio → dataset JSON embebido → seed por upsert → `GET /api/pois`). Se le agregan una categoría, dos campos de evidencia y una bandera para que el seed distinga lo que viene de los archivos; después un script genera candidatos (OSM completo + registro oficial de estaciones) y la evidencia se releva a mano, por las tres vías, escribiéndola en un archivo JSON nuevo que la app consume sin más código.

**Tech Stack:** .NET 10 Minimal API, EF Core + SQLite (migraciones con `dotnet ef`), xUnit; PowerShell 7 para los scripts de datos; Overpass (OSM) y datos.energia.gob.ar (CC-BY-4.0); Google Maps y búsqueda web como referencia de verificación.

**Spec:** `docs/superpowers/specs/2026-09-15-pois-camiones-relevamiento-design.md`

## Global Constraints

- El proyecto está en español: código, comentarios, commits y docs en español (`CLAUDE.md`).
- `TruckNavigator.Domain` **sin dependencias externas**.
- Rectángulo del alcance: **`-34.725, -58.555` / `-34.505, -58.315`** (lat, lon) — spec §3.
- Regla de fuentes nueva, textual en spec §4: Google Maps es referencia de descubrimiento y verificación de POIs, **nunca base que se copia**; coordenadas de OSM o registro oficial; lo que sale de una ficha o de reseñas se guarda como **resumen propio con fecha**.
- Niveles (spec §5.3): `Confirmed` = operador, oficial **o reseñas de conductores**; `Probable` = señales indirectas; `NotConfirmed` = nada.
- Aptitud por tipo de camión, sólo la que la evidencia menciona; nunca `false` por ausencia (spec §5.4).
- Regla de entrada (spec §6.3): gomerías y comer **sólo con evidencia**; estaciones también `NotConfirmed` si están sobre la Red o un acceso.
- TDD estricto: cada test se ve fallar antes de escribir el código. Un commit por tarea. `routing/config-truck.yml` **nunca se commitea**.
- Migraciones: `dotnet ef migrations add <Nombre> --project src/TruckNavigator.Infrastructure --startup-project src/TruckNavigator.Api --output-dir Persistence/Migrations`.
- Antes de compilar o testear, si el backend está corriendo, pararlo (bloquea las DLL: `MSB3027`).
- En PowerShell, `$PSScriptRoot` viene vacío dentro de `param()`: calcular rutas en el cuerpo.

---

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `src/TruckNavigator.Domain/Pois/PointOfInterest.cs` | Modelo: categoría nueva, `SuitabilityEvidence`, `SuitabilityEvidenceKind`, `ManagedByDataset` | Modificar |
| `src/TruckNavigator.Infrastructure/Persistence/AppDbContext.cs` | Mapeo de los campos nuevos | Modificar |
| `src/TruckNavigator.Infrastructure/Persistence/Migrations/…_AddPoiSuitabilityEvidence.cs` | Migración | Crear (con `dotnet ef`) |
| `src/TruckNavigator.Infrastructure/Pois/PoiDataset.cs` | Lee los campos nuevos y marca `ManagedByDataset` | Modificar |
| `src/TruckNavigator.Infrastructure/Persistence/PointOfInterestSeed.cs` | Upsert por `ManagedByDataset`, con sobrecarga para tests | Modificar |
| `src/TruckNavigator.Infrastructure/Data/pois-caba-curados.json` | Los tres puntos de agosto con su evidencia y kind | Modificar |
| `src/TruckNavigator.Infrastructure/Data/pois-caba-relevamiento-2026-09.json` | El relevamiento nuevo, `isSampleData: false` | Crear |
| `src/TruckNavigator.Api/Contracts/Dtos.cs` | `PoiDto` con la evidencia | Modificar |
| `tests/TruckNavigator.UnitTests/PoiSuitabilityTests.cs` | La categoría nueva no altera la regla | Modificar |
| `tests/TruckNavigator.IntegrationTests/PoiPersistenceTests.cs` | Evidencia en la base; seed con datos no-sample | Modificar |
| `tests/TruckNavigator.IntegrationTests/PoiDatasetTests.cs` | Candados del dataset: evidencia, kinds, bbox, sample | Modificar |
| `tests/TruckNavigator.IntegrationTests/PoiContractsTests.cs` | El DTO cruza el JSON con la evidencia | Crear |
| `data/fetch-poi-candidatos.ps1` | Candidatos: OSM completo + registro oficial + cruce + flag de Red | Crear |
| `data/relevamiento/README.md`, `candidatos-osm.json`, `candidatos-energia.json` | Método y candidatos versionados | Crear |
| `CLAUDE.md`, `docs/data-sources.md`, `docs/pois.md` | La regla nueva, el modelo, los números | Modificar |

---

## Etapa 1 — Modelo, seed, API y regla

### Task 1: Dominio — categoría nueva y campos de evidencia

**Files:**
- Modify: `src/TruckNavigator.Domain/Pois/PointOfInterest.cs`
- Test: `tests/TruckNavigator.UnitTests/PoiSuitabilityTests.cs`

**Interfaces:**
- Produces: `PoiCategory.TruckFriendlyEatery = 5`; `enum SuitabilityEvidenceKind { None = 0, Operator = 1, Official = 2, Reviews = 3, Signals = 4 }`; en `PointOfInterest`: `string? SuitabilityEvidence`, `SuitabilityEvidenceKind SuitabilityEvidenceKind`, `bool ManagedByDataset`.

- [ ] **Step 1: Escribir el test que falla (no compila: la categoría no existe)**

Agregar al final de la clase en `tests/TruckNavigator.UnitTests/PoiSuitabilityTests.cs`, respetando el estilo de los tests vecinos:

```csharp
    /// <summary>
    /// Un lugar para comer se juzga con la misma regla que una estacion: el campo de
    /// aptitud que corresponde al vehiculo. La categoria no cambia el criterio.
    /// </summary>
    [Fact]
    public void An_eatery_is_judged_by_the_same_fields_as_any_other_point()
    {
        var eatery = new PointOfInterest
        {
            Name = "Parador con playa",
            Category = PoiCategory.TruckFriendlyEatery,
            SuitableForSemiTrailer = true,
            SuitabilityEvidenceKind = SuitabilityEvidenceKind.Reviews,
            SuitabilityEvidence = "Según reseñas de conductores consultadas el 15/09/2026: entran semis."
        };

        var semi = new TruckProfile
        {
            Name = "Semi",
            GrossWeightKg = 40_000,
            VehicleType = VehicleType.SemiTrailer,
            HasTrailer = true
        };

        Assert.True(PoiSuitability.Accepts(eatery, semi));
        Assert.Null(PoiSuitability.Accepts(eatery, new TruckProfile { Name = "Liviano", GrossWeightKg = 7_500, VehicleType = VehicleType.RigidTruck }));
    }
```

Si `VehicleType.RigidTruck` no existe con ese nombre, usar el que usan los tests vecinos de la misma clase (mirar `A_light_truck_is_judged_by_the_light_truck_field`).

- [ ] **Step 2: Verificar que falla**

Run: `dotnet test tests/TruckNavigator.UnitTests --filter "FullyQualifiedName~PoiSuitabilityTests" 2>&1 | tail -5`
Expected: error de compilación `'PoiCategory' does not contain a definition for 'TruckFriendlyEatery'`.

- [ ] **Step 3: Implementar en el dominio**

En `PointOfInterest.cs`, agregar al enum `PoiCategory`:

```csharp
    /// <summary>
    /// Lugares para comer con lugar para dejar el camion: paradores, comedores y
    /// restaurantes con playa. Entra SOLO con evidencia de que el camion entra;
    /// sin ella la categoria no dice nada (spec 15/09/2026, §6.3).
    /// </summary>
    TruckFriendlyEatery = 5
```

Reescribir los comentarios de `VerificationLevel` con el significado del 15/09/2026:

```csharp
public enum VerificationLevel
{
    /// <summary>Existe, pero nadie dice si recibe camiones.</summary>
    NotConfirmed = 0,

    /// <summary>
    /// Señales indirectas sin declaracion ni testimonio: el nombre ("Gomeria del
    /// Camionero"), una etiqueta de OSM, fotos de la ficha con camiones.
    /// </summary>
    Probable = 1,

    /// <summary>
    /// Lo dice el operador, una fuente oficial, o reseñas de conductores que
    /// cuentan haber entrado con el camion. Decision del usuario del 15/09/2026:
    /// con reseña, el punto esta aprobado.
    /// </summary>
    Confirmed = 2
}
```

Agregar el enum nuevo, después de `VerificationLevel`:

```csharp
/// <summary>
/// De que tipo es la evidencia de aptitud. Es lo que permite verificar, con un
/// test y sin leer texto, que el nivel de verificacion se corresponde con lo que
/// respalda al punto.
/// </summary>
public enum SuitabilityEvidenceKind
{
    /// <summary>No hay evidencia: el punto queda NotConfirmed.</summary>
    None = 0,

    /// <summary>El operador lo declara por escrito (sitio de la marca o del comercio).</summary>
    Operator = 1,

    /// <summary>Una fuente oficial lo declara.</summary>
    Official = 2,

    /// <summary>Reseñas de conductores que cuentan haber entrado con el camion.</summary>
    Reviews = 3,

    /// <summary>Señales indirectas: nombre, etiqueta de OSM, fotos. Da Probable, no Confirmed.</summary>
    Signals = 4
}
```

Y en la clase `PointOfInterest`, después de `VerificationLevel`:

```csharp
    /// <summary>
    /// Por que creemos que es apto y desde cuando. Va en la ficha del punto; es lo
    /// que hace defendible cada marca de aptitud. Resumen propio con fecha, nunca
    /// texto copiado de una reseña.
    /// </summary>
    public string? SuitabilityEvidence { get; set; }

    public SuitabilityEvidenceKind SuitabilityEvidenceKind { get; set; }

    /// <summary>
    /// <c>true</c> para toda fila que venga de los archivos embebidos, sea de muestra
    /// o de un relevamiento. Es lo que el seed usa para saber que filas le pertenecen:
    /// <see cref="IsSampleData"/> distingue el dato inicial del MVP de un relevamiento
    /// curado, y no sirve para eso.
    /// </summary>
    public bool ManagedByDataset { get; set; }
```

- [ ] **Step 4: Verificar que pasa**

Run: `dotnet test tests/TruckNavigator.UnitTests --filter "FullyQualifiedName~PoiSuitabilityTests" 2>&1 | tail -3`
Expected: `Passed!` con 8 tests (los 7 de antes más éste).

- [ ] **Step 5: Commit**

```bash
git add src/TruckNavigator.Domain/Pois/PointOfInterest.cs tests/TruckNavigator.UnitTests/PoiSuitabilityTests.cs
git commit -m "POIs: la categoria de lugares para comer, y la evidencia de aptitud como dato del punto"
```

---

### Task 2: Persistencia — mapeo y migración

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Persistence/AppDbContext.cs` (bloque `var poi = modelBuilder.Entity<PointOfInterest>();`)
- Create: migración `AddPoiSuitabilityEvidence` (con `dotnet ef`)
- Test: `tests/TruckNavigator.IntegrationTests/PoiPersistenceTests.cs`

**Interfaces:**
- Consumes: los campos de la Task 1.
- Produces: columnas `SuitabilityEvidence` (TEXT, 600), `SuitabilityEvidenceKind` (TEXT, 32), `ManagedByDataset` (INTEGER, default 0).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `PoiPersistenceTests`:

```csharp
    /// <summary>
    /// La evidencia y su tipo cruzan la base. Sin la migracion, SQLite no tiene la
    /// columna y esto revienta al guardar.
    /// </summary>
    [Fact]
    public async Task Suitability_evidence_survives_the_round_trip()
    {
        var point = new PointOfInterest
        {
            Name = "Gomeria con evidencia",
            Category = PoiCategory.TyreShop,
            Latitude = -34.65,
            Longitude = -58.45,
            Source = "https://ejemplo.test (consultado 2026-09-15)",
            SourceRetrievedOn = new DateOnly(2026, 9, 15),
            VerificationLevel = VerificationLevel.Confirmed,
            SuitabilityEvidenceKind = SuitabilityEvidenceKind.Reviews,
            SuitabilityEvidence = "Según reseñas de conductores consultadas el 15/09/2026: entran semis.",
            SuitableForSemiTrailer = true,
            ManagedByDataset = false
        };

        _db.PointsOfInterest.Add(point);
        await _db.SaveChangesAsync();

        var stored = await _db.PointsOfInterest.AsNoTracking().FirstAsync(p => p.Id == point.Id);

        Assert.Equal(SuitabilityEvidenceKind.Reviews, stored.SuitabilityEvidenceKind);
        Assert.Equal(point.SuitabilityEvidence, stored.SuitabilityEvidence);
        Assert.False(stored.ManagedByDataset);
    }
```

- [ ] **Step 2: Verificar que falla**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~Suitability_evidence_survives" 2>&1 | tail -8`
Expected: FAIL con `SQLite Error 1: 'table PointsOfInterest has no column named SuitabilityEvidence'` (o equivalente).

- [ ] **Step 3: Mapear y crear la migración**

En `AppDbContext.cs`, después de `poi.Property(p => p.Description).HasMaxLength(1000);`:

```csharp
        // La evidencia es texto corto con fecha; el tipo va como texto para que la
        // base se lea a simple vista, igual que la categoria y el nivel.
        poi.Property(p => p.SuitabilityEvidence).HasMaxLength(600);
        poi.Property(p => p.SuitabilityEvidenceKind).HasConversion<string>().HasMaxLength(32);

        // Las filas que ya existen en una base creada antes de esta columna quedan en
        // false; el seed las adopta por id en el primer arranque (ver PointOfInterestSeed).
        poi.Property(p => p.ManagedByDataset).HasDefaultValue(false);
```

Crear la migración (con el backend parado):

```powershell
dotnet ef migrations add AddPoiSuitabilityEvidence --project src/TruckNavigator.Infrastructure --startup-project src/TruckNavigator.Api --output-dir Persistence/Migrations
```

Abrir el archivo generado y verificar que `Up` agrega exactamente tres columnas a `PointsOfInterest` y nada más. Si agrega otra cosa, el snapshot estaba desactualizado: revisar antes de seguir.

- [ ] **Step 4: Verificar que pasa, y que todo lo demás sigue verde**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiPersistenceTests" 2>&1 | tail -3`
Expected: `Passed!`, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/TruckNavigator.Infrastructure/Persistence/AppDbContext.cs src/TruckNavigator.Infrastructure/Persistence/Migrations tests/TruckNavigator.IntegrationTests/PoiPersistenceTests.cs
git commit -m "POIs: la evidencia y la bandera del dataset llegan a la base (migracion AddPoiSuitabilityEvidence)"
```

---

### Task 3: Dataset — leer la evidencia, marcar lo que viene de archivos, y los candados nuevos

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Pois/PoiDataset.cs`
- Modify: `src/TruckNavigator.Infrastructure/Data/pois-caba-curados.json`
- Modify: `tests/TruckNavigator.IntegrationTests/PoiDatasetTests.cs`

**Interfaces:**
- Consumes: Task 1.
- Produces: `PoiDataset.Load()` devuelve puntos con `ManagedByDataset = true` y los campos de evidencia leídos del JSON (`suitabilityEvidence`, `suitabilityEvidenceKind`).

- [ ] **Step 1: Escribir los tests que fallan**

En `PoiDatasetTests`, **reemplazar** `The_initial_dataset_is_marked_as_sample_data`, `Every_point_falls_inside_the_amba_box` y `Confirmed_points_do_not_rest_on_community_data_alone` por estos, y **agregar** los otros dos:

```csharp
    /// <summary>
    /// Los datasets de agosto de 2026 son el dato inicial del MVP; todo lo relevado
    /// desde septiembre es produccion. La fecha de consulta es lo que los separa.
    /// </summary>
    [Fact]
    public void Sample_data_is_the_august_2026_datasets_only()
    {
        var september = new DateOnly(2026, 9, 1);

        Assert.All(Dataset, poi => Assert.Equal(
            poi.SourceRetrievedOn < september,
            poi.IsSampleData));
    }

    /// <summary>
    /// Todo lo que sale de los archivos embebidos es del seed: sin esta marca, un
    /// archivo con isSampleData en false se reinsertaria en cada arranque.
    /// </summary>
    [Fact]
    public void Every_point_loaded_from_files_is_managed_by_the_dataset()
    {
        Assert.All(Dataset, poi => Assert.True(poi.ManagedByDataset, poi.Name));
    }

    /// <summary>
    /// El alcance es CABA mas el anillo de acceso (spec 15/09/2026, §3). Un punto
    /// mas lejos no le sirve a un viaje que empieza o termina en la Ciudad.
    /// </summary>
    [Fact]
    public void Every_point_falls_inside_caba_and_its_access_ring()
    {
        Assert.All(Dataset, poi =>
        {
            Assert.InRange(poi.Latitude, -34.725, -34.505);
            Assert.InRange(poi.Longitude, -58.555, -58.315);
        });
    }

    /// <summary>
    /// El nivel de verificacion tiene que corresponderse con el tipo de evidencia:
    /// Confirmed se apoya en el operador, una fuente oficial o el testimonio de
    /// conductores; Probable en señales indirectas; NotConfirmed en nada. Y toda
    /// evidencia lleva fecha, porque las reseñas envejecen.
    /// </summary>
    [Fact]
    public void The_verification_level_matches_the_kind_of_evidence()
    {
        Assert.All(Dataset, poi =>
        {
            var expected = poi.SuitabilityEvidenceKind switch
            {
                SuitabilityEvidenceKind.Operator or SuitabilityEvidenceKind.Official or SuitabilityEvidenceKind.Reviews
                    => VerificationLevel.Confirmed,
                SuitabilityEvidenceKind.Signals => VerificationLevel.Probable,
                _ => VerificationLevel.NotConfirmed
            };

            Assert.True(expected == poi.VerificationLevel,
                $"'{poi.Name}': evidencia {poi.SuitabilityEvidenceKind} pero nivel {poi.VerificationLevel}.");

            if (poi.SuitabilityEvidenceKind != SuitabilityEvidenceKind.None)
            {
                Assert.False(string.IsNullOrWhiteSpace(poi.SuitabilityEvidence), $"'{poi.Name}' no escribe su evidencia.");
                Assert.Matches(@"\d{1,2}/\d{2}/20\d{2}", poi.SuitabilityEvidence);
            }
        });
    }

    /// <summary>
    /// Una gomeria de autos o un restaurante sin playa no le sirven a nadie en esta
    /// app: esas dos categorias entran solo con evidencia (spec §6.3).
    /// </summary>
    [Fact]
    public void Tyre_shops_and_eateries_never_enter_without_evidence()
    {
        var strict = Dataset.Where(p =>
            p.Category is PoiCategory.TyreShop or PoiCategory.TruckFriendlyEatery
            && !p.IsSampleData);

        Assert.All(strict, poi => Assert.NotEqual(VerificationLevel.NotConfirmed, poi.VerificationLevel));
    }
```

`Points_imported_from_osm_are_never_marked_confirmed` queda como está: un punto cuya `Source` **empieza** con "OpenStreetMap" es una importación cruda. Los puntos del relevamiento citan primero la evidencia y después la coordenada de OSM (ver Task 8), así que no lo pisan.

- [ ] **Step 2: Verificar que fallan**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiDatasetTests" 2>&1 | grep -E "Failed |Passed!|Failed!"`
Expected: fallan `Every_point_loaded_from_files_is_managed_by_the_dataset` (todo `false`) y `The_verification_level_matches_the_kind_of_evidence` (los tres curados son Confirmed/Probable con kind `None`).

- [ ] **Step 3: Leer los campos nuevos en `PoiDataset`**

En el record `PoiEntry`, agregar antes de `bool IsSampleData`:

```csharp
        string? SuitabilityEvidence,
        SuitabilityEvidenceKind SuitabilityEvidenceKind,
```

En `ToPoint`, agregar a la inicialización:

```csharp
            SuitabilityEvidence = entry.SuitabilityEvidence,
            SuitabilityEvidenceKind = entry.SuitabilityEvidenceKind,
            ManagedByDataset = true,
```

(`System.Text.Json` deja el enum en `None` y el texto en `null` cuando el JSON no los trae, así que el archivo de OSM de agosto no cambia.)

- [ ] **Step 4: Darles evidencia a los tres puntos curados de agosto**

En `pois-caba-curados.json`, con el significado nuevo de los niveles (operador = Confirmed), cada entrada gana dos campos y los dos de auxilio suben a `Confirmed`:

- CTC: `"verificationLevel": "Confirmed"`, `"suitabilityEvidenceKind": "Official"`, `"suitabilityEvidence": "La Ciudad y la administradora del predio lo declaran centro de transferencia para unidades de gran porte (sitios oficiales consultados el 14/08/2026). No es playa de uso publico."`
- Auxilio Full Truck: `"verificationLevel": "Confirmed"`, `"suitabilityEvidenceKind": "Operator"`, `"suitabilityEvidence": "El operador declara remolque y asistencia para vehiculos pesados con cobertura en Buenos Aires (sitio del prestador, 14/08/2026)."`
- Grúas El Enganche: `"verificationLevel": "Confirmed"`, `"suitabilityEvidenceKind": "Operator"`, `"suitabilityEvidence": "El operador declara grua con sistema de tenedor para camiones y cobertura en Capital y GBA (sitio del prestador, 14/08/2026)."`

Actualizar `sourceNote` del archivo con una frase: *"El 15/09/2026 se agrego la evidencia y los dos prestadores pasaron a Confirmed, porque desde esa fecha lo que declara el operador confirma."*

- [ ] **Step 5: Verificar que pasa todo**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~Poi" 2>&1 | tail -3`
Expected: `Passed!`, 20 tests (10 dataset + 10 persistencia).

- [ ] **Step 6: Commit**

```bash
git add src/TruckNavigator.Infrastructure/Pois/PoiDataset.cs src/TruckNavigator.Infrastructure/Data/pois-caba-curados.json tests/TruckNavigator.IntegrationTests/PoiDatasetTests.cs
git commit -m "POIs: el dataset lee la evidencia, marca lo suyo, y los candados nuevos la exigen"
```

---

### Task 4: Seed — upsert por `ManagedByDataset`

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Persistence/PointOfInterestSeed.cs`
- Test: `tests/TruckNavigator.IntegrationTests/PoiPersistenceTests.cs`

**Interfaces:**
- Produces: `PointOfInterestSeed.ApplyAsync(AppDbContext db, CancellationToken ct = default)` (igual) y la sobrecarga `ApplyAsync(AppDbContext db, IReadOnlyList<PointOfInterest> dataset, CancellationToken ct = default)` para inyectar un dataset en tests.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `PoiPersistenceTests`:

```csharp
    private static PointOfInterest Relevado(string name, string source) => new()
    {
        Name = name,
        Category = PoiCategory.TyreShop,
        Latitude = -34.65,
        Longitude = -58.45,
        Source = source,
        SourceRetrievedOn = new DateOnly(2026, 9, 15),
        VerificationLevel = VerificationLevel.Confirmed,
        SuitabilityEvidenceKind = SuitabilityEvidenceKind.Reviews,
        SuitabilityEvidence = "Según reseñas de conductores consultadas el 15/09/2026: entran semis.",
        SuitableForSemiTrailer = true,
        IsSampleData = false,
        ManagedByDataset = true
    };

    /// <summary>
    /// El defecto que motivo la bandera: un archivo con isSampleData en false se
    /// reinsertaba en cada arranque y chocaba por clave en el segundo.
    /// </summary>
    [Fact]
    public async Task A_production_dataset_can_be_seeded_twice()
    {
        var dataset = new[] { Relevado("Gomeria A", "https://a.test (15/09/2026)") };

        await PointOfInterestSeed.ApplyAsync(_db, dataset);
        await PointOfInterestSeed.ApplyAsync(_db, dataset);

        Assert.Equal(1, await _db.PointsOfInterest.CountAsync(p => p.Name == "Gomeria A"));
    }

    [Fact]
    public async Task A_production_point_that_leaves_the_dataset_disappears()
    {
        await PointOfInterestSeed.ApplyAsync(_db, [Relevado("Gomeria A", "https://a.test"), Relevado("Gomeria B", "https://b.test")]);
        await PointOfInterestSeed.ApplyAsync(_db, [Relevado("Gomeria A", "https://a.test")]);

        Assert.Equal(0, await _db.PointsOfInterest.CountAsync(p => p.Name == "Gomeria B"));
    }

    /// <summary>
    /// Una base creada antes de la columna tiene las filas del dataset con la bandera
    /// en false. El seed las reconoce por id y las adopta, en vez de duplicarlas.
    /// </summary>
    [Fact]
    public async Task Rows_from_an_older_database_are_adopted_by_id()
    {
        var stored = await _db.PointsOfInterest.FirstAsync();
        stored.ManagedByDataset = false;
        await _db.SaveChangesAsync();
        var before = await _db.PointsOfInterest.CountAsync();

        await PointOfInterestSeed.ApplyAsync(_db);

        Assert.Equal(before, await _db.PointsOfInterest.CountAsync());
        Assert.True((await _db.PointsOfInterest.AsNoTracking().FirstAsync(p => p.Id == stored.Id)).ManagedByDataset);
    }
```

En `The_seed_leaves_user_loaded_points_alone` no hace falta cambiar nada: `ManagedByDataset` queda en `false` por defecto, que es justo "cargado por el usuario".

En `Relevado`, el `Id` lo asigna `PointOfInterest` por defecto (`Guid.NewGuid()`), así que dos llamadas con el mismo `source` **no** comparten id. Para que los tests reflejen el id determinístico del dataset, agregar al helper: `Id = new Guid(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(source)))` — el mismo cálculo que `PoiDataset.DeterministicId`.

- [ ] **Step 2: Verificar que fallan**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiPersistenceTests" 2>&1 | grep -E "error|Failed |Passed!|Failed!"`
Expected: no compila (`ApplyAsync` no tiene sobrecarga con dataset).

- [ ] **Step 3: Implementar**

Reemplazar el cuerpo de `PointOfInterestSeed` por:

```csharp
public static class PointOfInterestSeed
{
    public static Task ApplyAsync(AppDbContext db, CancellationToken cancellationToken = default) =>
        ApplyAsync(db, PoiDataset.Load(), cancellationToken);

    /// <summary>
    /// Siembra un dataset dado. Los tests lo usan para inyectar puntos sin tocar los
    /// archivos embebidos.
    /// </summary>
    public static async Task ApplyAsync(
        AppDbContext db,
        IReadOnlyList<PointOfInterest> dataset,
        CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);

        var datasetIds = dataset.Select(p => p.Id).ToHashSet();

        // Las filas del seed son las marcadas como suyas, mas las que coinciden por id
        // con el dataset aunque no esten marcadas: son las de una base creada antes de
        // la columna, y se adoptan en vez de duplicarse.
        var existing = await db.PointsOfInterest
            .Where(p => p.ManagedByDataset || datasetIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        foreach (var point in dataset)
        {
            if (existing.TryGetValue(point.Id, out var stored))
            {
                Copy(from: point, to: stored);
            }
            else
            {
                point.ManagedByDataset = true;
                db.PointsOfInterest.Add(point);
            }
        }

        // Un punto que salio del dataset (cerro, o la fuente dejo de listarlo) tiene que
        // desaparecer del mapa, no quedar como fantasma de una corrida anterior.
        var removed = existing.Values.Where(p => !datasetIds.Contains(p.Id)).ToList();

        if (removed.Count > 0)
        {
            db.PointsOfInterest.RemoveRange(removed);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static void Copy(PointOfInterest from, PointOfInterest to)
    {
        to.Name = from.Name;
        to.Category = from.Category;
        to.Address = from.Address;
        to.Neighbourhood = from.Neighbourhood;
        to.Latitude = from.Latitude;
        to.Longitude = from.Longitude;
        to.Phone = from.Phone;
        to.Website = from.Website;
        to.OpeningHours = from.OpeningHours;
        to.Description = from.Description;
        to.Services = from.Services;
        to.SuitableForLightTruck = from.SuitableForLightTruck;
        to.SuitableForHeavyTruck = from.SuitableForHeavyTruck;
        to.SuitableForSemiTrailer = from.SuitableForSemiTrailer;
        to.SuitableForTrailer = from.SuitableForTrailer;
        to.Source = from.Source;
        to.SourceRetrievedOn = from.SourceRetrievedOn;
        to.VerificationLevel = from.VerificationLevel;
        to.SuitabilityEvidence = from.SuitabilityEvidence;
        to.SuitabilityEvidenceKind = from.SuitabilityEvidenceKind;
        to.IsSampleData = from.IsSampleData;
        to.ManagedByDataset = true;
    }
}
```

Actualizar el comentario `<remarks>` de la clase: el upsert va por `ManagedByDataset`, no por `IsSampleData`, y por qué (el defecto del segundo arranque).

- [ ] **Step 4: Verificar que pasa, y la suite entera**

Run: `dotnet test 2>&1 | grep -E "Passed!|Failed!|error"`
Expected: los dos proyectos `Passed!`; unitarios 256, integración 103 (11 se saltean sin GraphHopper). Si los números difieren, contar y explicar.

- [ ] **Step 5: Commit**

```bash
git add src/TruckNavigator.Infrastructure/Persistence/PointOfInterestSeed.cs tests/TruckNavigator.IntegrationTests/PoiPersistenceTests.cs
git commit -m "El seed de POIs reconoce lo suyo por ManagedByDataset: un relevamiento de produccion ya no choca en el segundo arranque"
```

---

### Task 5: API — la evidencia en el DTO, y la verificación de la etapa

**Files:**
- Modify: `src/TruckNavigator.Api/Contracts/Dtos.cs` (`PoiDto`)
- Create: `tests/TruckNavigator.IntegrationTests/PoiContractsTests.cs`

**Interfaces:**
- Produces: `PoiDto` con `string? SuitabilityEvidence` y `string SuitabilityEvidenceKind` (texto del enum), en ese orden, antes de `IsSampleData`.

- [ ] **Step 1: Escribir el test que falla**

```csharp
using System.Text.Json;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Pois;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El contrato de los POIs, tal como cruza el HTTP: la evidencia tiene que llegar
/// a la ficha con su tipo, en texto, como la categoria y el nivel.
/// </summary>
public class PoiContractsTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void The_evidence_and_its_kind_cross_the_wire_as_text()
    {
        var poi = new PointOfInterest
        {
            Name = "Gomeria del Camionero",
            Category = PoiCategory.TyreShop,
            Source = "https://ejemplo.test (15/09/2026)",
            SourceRetrievedOn = new DateOnly(2026, 9, 15),
            VerificationLevel = VerificationLevel.Confirmed,
            SuitabilityEvidenceKind = SuitabilityEvidenceKind.Reviews,
            SuitabilityEvidence = "Según reseñas de conductores consultadas el 15/09/2026: entran semis."
        };

        var json = JsonSerializer.Serialize(PoiDto.From(poi, truck: null), Web);

        Assert.Contains("\"suitabilityEvidenceKind\":\"Reviews\"", json);
        Assert.Contains("\"suitabilityEvidence\":\"Según reseñas", json);
        Assert.Contains("\"category\":\"TyreShop\"", json);
    }
}
```

- [ ] **Step 2: Verificar que falla**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiContractsTests" 2>&1 | tail -6`
Expected: FAIL — el JSON no contiene `suitabilityEvidenceKind`.

- [ ] **Step 3: Implementar**

En `PoiDto`, agregar los dos parámetros antes de `bool IsSampleData` y sus valores en `From`:

```csharp
    string VerificationLevel,
    string? SuitabilityEvidence,
    string SuitabilityEvidenceKind,
    bool IsSampleData,
```

```csharp
        poi.VerificationLevel.ToString(),
        poi.SuitabilityEvidence,
        poi.SuitabilityEvidenceKind.ToString(),
        poi.IsSampleData,
```

- [ ] **Step 4: Verificar que pasa**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiContractsTests" 2>&1 | tail -3`
Expected: `Passed!`, 1 test.

- [ ] **Step 5: Verificación de la etapa contra la API real**

Levantar el backend en Development (`$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet run --project src/TruckNavigator.Api`), esperar el arranque (migra y siembra), y:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5080/api/pois?categories=TruckFriendlyEatery"   # 200
curl -s "http://localhost:5080/api/pois?categories=TruckFriendlyEatery"                                     # []
curl -s "http://localhost:5080/api/pois" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.length, j.filter(p=>p.suitabilityEvidenceKind!=='None').length)})"   # 78 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5080/api/pois?categories=Inventada"              # 400
```

Después parar el backend. Si la base de desarrollo venía de antes, el primer arranque adopta las 78 filas (Task 4): verificar que no hay error de clave en el log.

- [ ] **Step 6: Commit**

```bash
git add src/TruckNavigator.Api/Contracts/Dtos.cs tests/TruckNavigator.IntegrationTests/PoiContractsTests.cs
git commit -m "La ficha del POI recibe la evidencia y su tipo"
```

---

### Task 6: La regla de fuentes y la documentación del modelo

**Files:**
- Modify: `CLAUDE.md` (sección "Qué es", y la tabla de tests)
- Modify: `docs/data-sources.md` (nueva subsección después de la de OSM; L-6)
- Modify: `docs/pois.md` (categorías, modelo, niveles, seed, datos)

- [ ] **Step 1: `CLAUDE.md`**

Reemplazar la frase *"Mapa base OpenStreetMap — nunca Google Maps ni Waze, ni datos derivados de ellos."* por:

```markdown
Mapa base y ruteo: OpenStreetMap — nunca Google Maps ni Waze. **Para los puntos de
interés, desde el 15/09/2026 Google Maps es referencia de descubrimiento y
verificación** (fichas públicas y reseñas de conductores), nunca base que se copia:
coordenadas de OSM o de un registro oficial, y lo que sale de una ficha o de reseñas
se guarda como resumen propio con fecha. Ver `docs/data-sources.md` §POIs.
```

Y en la tabla de tests de `CLAUDE.md`, agregar a la fila de integración: *"+ los candados del dataset de POIs y el seed por `ManagedByDataset`"* con los conteos que dio la Task 4.

- [ ] **Step 2: `docs/data-sources.md`**

Agregar, después de la sección de OpenStreetMap, una subsección:

```markdown
### Puntos de interés: las fuentes y la regla del 15/09/2026

Los POIs (gomerías, estaciones, lugares para comer, playas, auxilio) se relevan
con **tres vías de evidencia**, en este orden:

1. **El operador** — el sitio de la marca o del comercio. Da `Confirmed`.
2. **Señales** — el nombre, etiquetas de OSM (`hgv`, `fuel:HGV_diesel`), fotos y
   descripción de la ficha pública. Da `Probable`.
3. **Reseñas de conductores** — lo que cuentan en la ficha pública. **Da
   `Confirmed`** (decisión del usuario, 15/09/2026), con la condición de que la
   evidencia diga *"según reseñas de conductores, consultadas el <fecha>"* y se
   marque apto sólo para el tipo de camión que las reseñas mencionan.

**Google Maps** se usa para (2) y (3) como referencia de descubrimiento y
verificación. **No se copia su base**: cada dato cita su origen, las coordenadas
salen de OSM o del registro oficial, y lo que sale de una ficha o de reseñas se
escribe como resumen propio con fecha de consulta, nunca como texto copiado.
Esto reemplaza, sólo para los POIs, la regla anterior de no usar Google; el mapa
base y el ruteo siguen siendo OSM.

| Fuente | Qué aporta | Licencia |
|---|---|---|
| OpenStreetMap (Overpass, en tiempo de autoría) | Candidatos completos: estaciones, gomerías, talleres, playas; coordenadas y datos de contacto | ODbL |
| Secretaría de Energía — *Precios en surtidor, Res. 314/2016* (datos.energia.gob.ar) | Registro completo de estaciones con coordenadas, bandera, dirección y productos (gasoil grado 2 y 3, GNC) | CC-BY-4.0 |
| Sitios de operadores y marcas | Redes de estaciones para camiones, servicios declarados | Cita, no copia |
| Fichas públicas y reseñas (Google Maps) | Verificación y testimonio de conductores | Resumen propio con fecha |

Alcance: CABA más un anillo de ~2 km (`-34.725, -58.555` / `-34.505, -58.315`).
```

Y en L-6, agregar al final: *"El 15/09/2026 empezó el relevamiento con evidencia; los números se actualizan al cerrarlo."*

- [ ] **Step 3: `docs/pois.md`**

- Tabla de categorías: fila `Lugares para comer con lugar para el camión | TruckFriendlyEatery | 🍽️`.
- Tabla del modelo: filas `evidencia | SuitabilityEvidence | string?` y `tipo_de_evidencia | SuitabilityEvidenceKind | enum` y `del_dataset | ManagedByDataset | bool`.
- Reescribir la tabla de niveles con el significado del 15/09 (operador/oficial/**reseñas** → Confirmed; señales → Probable).
- En "Los datos", agregar la fila `pois-caba-relevamiento-2026-09.json | Relevamiento con evidencia por punto | (se completa al cerrar)` y explicar que el seed reconoce lo suyo por `ManagedByDataset`.
- Corregir la sección "En la pantalla": decir que **hoy la app web no muestra los POIs** (el botón *Lugares* era de la interfaz MAUI) y que la interfaz es la construcción siguiente.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/data-sources.md docs/pois.md
git commit -m "La regla de fuentes para POIs: Google Maps como referencia, nunca como base; y el modelo documentado"
```

---

## Etapa 2 — Candidatos

### Task 7: `data/fetch-poi-candidatos.ps1`

**Files:**
- Create: `data/fetch-poi-candidatos.ps1`
- Create: `data/relevamiento/README.md`, `data/relevamiento/candidatos-osm.json`, `data/relevamiento/candidatos-energia.json`

**Interfaces:**
- Produces: dos JSON con la forma de abajo. Cada candidato de OSM: `{ osm, name, category, lat, lon, address, suburb, phone, website, openingHours, brand, operator, hgv, fuelHgvDiesel, services[], enRedPesada, calleRed }`. Cada estación oficial: `{ idempresa, empresa, bandera, address, localidad, lat, lon, productos[], osm (id del candidato OSM a ≤ 80 m o null), enRedPesada, calleRed }`.

- [ ] **Step 1: Escribir el script**

```powershell
<#
.SYNOPSIS
    Genera los candidatos del relevamiento de POIs para camiones.

.DESCRIPTION
    Escribe en data/relevamiento/:
      - candidatos-osm.json      todo lo que OpenStreetMap tiene en el rectangulo
                                 de CABA + anillo para las categorias del relevamiento,
                                 SIN corte por cantidad.
      - candidatos-energia.json  el registro oficial de estaciones (Secretaria de
                                 Energia, Res. 314/2016, CC-BY-4.0), una fila por
                                 estacion con sus productos, cruzado con OSM por
                                 cercania (<= 80 m).

    Ademas marca en los dos si el punto esta a <= 40 m de un tramo de la Red de
    Transito Pesado (wwwroot/data/red-transito-pesado.geojson) y sobre que calle.
    Son candidatos, no el dataset: la evidencia de aptitud se releva a mano y se
    escribe en pois-caba-relevamiento-*.json. Ver data/relevamiento/README.md.

.EXAMPLE
    ./data/fetch-poi-candidatos.ps1
#>
[CmdletBinding()]
param(
    [string] $Endpoint = 'https://overpass.kumi.systems/api/interpreter',
    [string] $EnergiaCsv = 'http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/precios-en-surtidor-resolucin-3142016.csv'
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot viene vacio dentro de param(): las rutas se calculan aca.
$raiz = Split-Path (Split-Path $PSCommandPath -Parent) -Parent
$salida = Join-Path $raiz 'data\relevamiento'
$redPath = Join-Path $raiz 'src\TruckNavigator.Api\wwwroot\data\red-transito-pesado.geojson'
New-Item -ItemType Directory -Force $salida | Out-Null

# El rectangulo del alcance (spec 15/09/2026, §3): CABA mas el anillo de acceso.
$latMin = -34.725; $latMax = -34.505; $lonMin = -58.555; $lonMax = -58.315
$retrievedOn = (Get-Date).ToString('yyyy-MM-dd')

# ---------------------------------------------------------------------------
# La Red de Transito Pesado, para marcar que candidatos estan sobre ella
# ---------------------------------------------------------------------------
$red = (Get-Content $redPath -Raw | ConvertFrom-Json).features
$metrosPorGradoLat = 111320.0
$metrosPorGradoLon = 111320.0 * [math]::Cos(-34.6 * [math]::PI / 180)

function Get-DistanciaASegmento([double] $px, [double] $py, [double] $ax, [double] $ay, [double] $bx, [double] $by) {
    $dx = $bx - $ax; $dy = $by - $ay
    $l2 = $dx * $dx + $dy * $dy
    if ($l2 -eq 0) { return [math]::Sqrt(($px - $ax) * ($px - $ax) + ($py - $ay) * ($py - $ay)) }
    $t = (($px - $ax) * $dx + ($py - $ay) * $dy) / $l2
    if ($t -lt 0) { $t = 0 } elseif ($t -gt 1) { $t = 1 }
    $cx = $ax + $t * $dx; $cy = $ay + $t * $dy
    return [math]::Sqrt(($px - $cx) * ($px - $cx) + ($py - $cy) * ($py - $cy))
}

# Devuelve el nombre del tramo de la Red a <= 40 m, o $null. Coordenadas a metros
# con una proyeccion plana: a esta escala el error es de centimetros.
function Get-CalleRed([double] $lat, [double] $lon) {
    $px = $lon * $metrosPorGradoLon; $py = $lat * $metrosPorGradoLat
    foreach ($f in $red) {
        $c = $f.geometry.coordinates
        for ($i = 0; $i -lt $c.Count - 1; $i++) {
            # descarte rapido por caja: 40 m son ~0.0004 grados
            if ([math]::Abs($c[$i][1] - $lat) -gt 0.001 -or [math]::Abs($c[$i][0] - $lon) -gt 0.001) { continue }
            $d = Get-DistanciaASegmento $px $py ($c[$i][0] * $metrosPorGradoLon) ($c[$i][1] * $metrosPorGradoLat) ($c[$i + 1][0] * $metrosPorGradoLon) ($c[$i + 1][1] * $metrosPorGradoLat)
            if ($d -le 40) { return ($f.properties.name ?? $f.properties.ref ?? 'sin nombre') }
        }
    }
    return $null
}

# ---------------------------------------------------------------------------
# OSM: todo lo que hay, sin corte
# ---------------------------------------------------------------------------
$bbox = "$latMin,$lonMin,$latMax,$lonMax"
$query = @"
[out:json][timeout:180];
(
  nwr["amenity"="fuel"]($bbox);
  nwr["shop"="tyres"]($bbox);
  nwr["shop"~"^(truck_repair|truck)$"]($bbox);
  nwr["amenity"="truck_stop"]($bbox);
  nwr["amenity"="parking"]["hgv"]($bbox);
  nwr["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]["hgv"]($bbox);
);
out center tags;
"@

Write-Host "Consultando Overpass ($Endpoint)..." -ForegroundColor Cyan
$osm = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $query -TimeoutSec 300

function Get-CategoriaOsm($tags) {
    if ($tags.amenity -eq 'truck_stop') { return 'TruckParking' }
    if ($tags.amenity -eq 'parking') { return 'TruckParking' }
    if ($tags.amenity -eq 'fuel') { return 'FuelStation' }
    if ($tags.shop -eq 'tyres') { return 'TyreShop' }
    if ($tags.shop -in @('truck_repair', 'truck')) { return 'RepairShop' }
    if ($tags.amenity -in @('restaurant', 'fast_food', 'cafe', 'food_court')) { return 'TruckFriendlyEatery' }
    return $null
}

$candidatosOsm = New-Object System.Collections.Generic.List[object]
foreach ($e in $osm.elements) {
    $t = $e.tags
    if (-not $t) { continue }
    $lat = if ($e.center) { $e.center.lat } else { $e.lat }
    $lon = if ($e.center) { $e.center.lon } else { $e.lon }
    if ($null -eq $lat) { continue }
    $cat = Get-CategoriaOsm $t
    if (-not $cat) { continue }

    $services = New-Object System.Collections.Generic.List[string]
    if ($t.'fuel:diesel' -eq 'yes') { $services.Add('Gasoil') }
    if ($t.'fuel:HGV_diesel' -eq 'yes') { $services.Add('Gasoil para camiones') }
    if ($t.'fuel:GNC' -eq 'yes' -or $t.'fuel:cng' -eq 'yes') { $services.Add('GNC') }
    if ($t.'fuel:adblue' -eq 'yes') { $services.Add('AdBlue') }
    if ($t.compressed_air -eq 'yes') { $services.Add('Aire comprimido') }
    if ($t.car_wash -eq 'yes') { $services.Add('Lavadero') }

    $calle = Get-CalleRed $lat $lon
    $candidatosOsm.Add([ordered]@{
        osm           = "$($e.type)/$($e.id)"
        name          = $t.name
        category      = $cat
        lat           = [math]::Round($lat, 6)
        lon           = [math]::Round($lon, 6)
        address       = if ($t.'addr:street') { "$($t.'addr:street') $($t.'addr:housenumber')".Trim() } else { $null }
        suburb        = $t.'addr:suburb'
        phone         = if ($t.phone) { $t.phone } else { $t.'contact:phone' }
        website       = if ($t.website) { $t.website } else { $t.'contact:website' }
        openingHours  = $t.opening_hours
        brand         = $t.brand
        operator      = $t.operator
        hgv           = if ($t.hgv) { $t.hgv } else { $t.'access:hgv' }
        fuelHgvDiesel = $t.'fuel:HGV_diesel'
        services      = $services.ToArray()
        enRedPesada   = [bool] $calle
        calleRed      = $calle
    })
}

# ---------------------------------------------------------------------------
# El registro oficial de estaciones: una fila por estacion, con sus productos
# ---------------------------------------------------------------------------
Write-Host "Bajando el registro de estaciones ($EnergiaCsv)..." -ForegroundColor Cyan
$csvPath = Join-Path $env:TEMP 'precios-en-surtidor.csv'
Invoke-WebRequest -Uri $EnergiaCsv -OutFile $csvPath -TimeoutSec 300
$filas = Import-Csv $csvPath -Encoding UTF8

$estaciones = @{}
foreach ($r in $filas) {
    $lat = [double]::Parse($r.latitud, [cultureinfo]::InvariantCulture)
    $lon = [double]::Parse($r.longitud, [cultureinfo]::InvariantCulture)
    if ($lat -lt $latMin -or $lat -gt $latMax -or $lon -lt $lonMin -or $lon -gt $lonMax) { continue }
    $clave = $r.idempresa
    if (-not $estaciones.ContainsKey($clave)) {
        $estaciones[$clave] = [ordered]@{
            idempresa = $r.idempresa
            empresa   = $r.empresa
            bandera   = $r.empresabandera
            address   = $r.direccion
            localidad = $r.localidad
            lat       = [math]::Round($lat, 6)
            lon       = [math]::Round($lon, 6)
            productos = New-Object System.Collections.Generic.List[string]
            osm       = $null
            enRedPesada = $false
            calleRed  = $null
        }
    }
    if ($r.producto -and -not $estaciones[$clave].productos.Contains($r.producto)) {
        $estaciones[$clave].productos.Add($r.producto)
    }
}

# Cruce con OSM por cercania: <= 80 m es la misma estacion.
$fuelOsm = $candidatosOsm | Where-Object { $_.category -eq 'FuelStation' }
$cruzadas = 0
foreach ($s in $estaciones.Values) {
    $mejor = $null; $mejorD = 81
    foreach ($o in $fuelOsm) {
        $d = [math]::Sqrt((($o.lon - $s.lon) * $metrosPorGradoLon) * (($o.lon - $s.lon) * $metrosPorGradoLon) + (($o.lat - $s.lat) * $metrosPorGradoLat) * (($o.lat - $s.lat) * $metrosPorGradoLat))
        if ($d -lt $mejorD) { $mejorD = $d; $mejor = $o }
    }
    if ($mejor) { $s.osm = $mejor.osm; $cruzadas++ }
    $calle = Get-CalleRed $s.lat $s.lon
    $s.enRedPesada = [bool] $calle
    $s.calleRed = $calle
    $s.productos = $s.productos.ToArray()
}

# ---------------------------------------------------------------------------
# Salida y conteos
# ---------------------------------------------------------------------------
$porCategoria = $candidatosOsm | Group-Object category | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host "OSM: $($candidatosOsm.Count) candidatos ($($porCategoria -join ', ')); con nombre: $(($candidatosOsm | Where-Object name).Count); sobre la Red: $(($candidatosOsm | Where-Object enRedPesada).Count)" -ForegroundColor Green
Write-Host "Energia: $($estaciones.Count) estaciones en el rectangulo; cruzadas con OSM: $cruzadas; sobre la Red: $(($estaciones.Values | Where-Object enRedPesada).Count); con GNC: $(($estaciones.Values | Where-Object { $_.productos -contains 'GNC' }).Count)" -ForegroundColor Green

[ordered]@{ generatedOn = $retrievedOn; bbox = @($latMin, $lonMin, $latMax, $lonMax); source = 'OpenStreetMap via Overpass (ODbL)'; candidatos = $candidatosOsm.ToArray() } |
    ConvertTo-Json -Depth 6 | Set-Content (Join-Path $salida 'candidatos-osm.json') -Encoding UTF8
[ordered]@{ generatedOn = $retrievedOn; bbox = @($latMin, $lonMin, $latMax, $lonMax); source = 'Secretaria de Energia, Precios en surtidor Res. 314/2016 (CC-BY-4.0)'; estaciones = @($estaciones.Values | Sort-Object localidad, empresa) } |
    ConvertTo-Json -Depth 6 | Set-Content (Join-Path $salida 'candidatos-energia.json') -Encoding UTF8

Write-Host "Escrito en $salida" -ForegroundColor Green
```

- [ ] **Step 2: Correrlo y verificar**

Run: `./data/fetch-poi-candidatos.ps1`
Expected: dos líneas de conteo (OSM del orden de 600 candidatos: ~435 estaciones, ~174 gomerías; Energía del orden de 300–400 estaciones, con la mayoría cruzada con OSM), y los dos archivos. Si Overpass da timeout, reintentar con `-Endpoint 'https://overpass-api.de/api/interpreter'`.

Revisar a mano 10 candidatos (5 de cada archivo) contra el mapa: que la coordenada caiga donde dice la dirección. Anotar en el README cuántos de los 10 coincidieron.

- [ ] **Step 3: El README del método**

`data/relevamiento/README.md`:

```markdown
# Relevamiento de POIs para camiones — método

Es el registro de cómo se armó `pois-caba-relevamiento-2026-09.json`, para que
el próximo relevamiento parta de acá y no de cero. Spec:
`docs/superpowers/specs/2026-09-15-pois-camiones-relevamiento-design.md`.

## Candidatos

`../fetch-poi-candidatos.ps1` genera `candidatos-osm.json` (OSM completo en el
rectángulo, sin corte) y `candidatos-energia.json` (registro oficial de estaciones,
cruzado con OSM a ≤ 80 m). Los dos marcan `enRedPesada` (a ≤ 40 m de un tramo de la
Red de Tránsito Pesado) y `calleRed`.

Corrida del <fecha>: <conteos que imprimió el script>. Muestra de 10 revisada a
mano: <n> coincidencias.

## Evidencia, por las tres vías

Para cada candidato, en este orden y hasta encontrar evidencia:

1. **Operador** — el sitio de la marca o del comercio (`Operator` / `Official` → Confirmed).
2. **Señales** — nombre, etiquetas de OSM, fotos y descripción de la ficha pública (`Signals` → Probable).
3. **Reseñas** — lo que cuentan los conductores en la ficha pública, resumido con fecha (`Reviews` → Confirmed).

Google Maps se usa como referencia para 2 y 3. No se copia texto: la evidencia
es un resumen propio y dice la fecha. Las coordenadas salen de OSM o del registro
oficial; si un lugar no está en ninguno, se geocodifica la dirección con Photon y
se dice en `source`.

## Regla de entrada

- Gomerías y lugares para comer: sólo con evidencia (`Confirmed` o `Probable`).
- Estaciones: con evidencia, y también `NotConfirmed` si `enRedPesada` es true.

## Formato de cada entrada

Ver la plantilla en el plan (`docs/superpowers/plans/2026-09-15-pois-camiones-relevamiento.md`, Task 8).

## Búsquedas de descubrimiento hechas

<lista de búsquedas en Google Maps y web, con fecha, para que se puedan repetir>
```

- [ ] **Step 4: Commit**

```bash
git add data/fetch-poi-candidatos.ps1 data/relevamiento/
git commit -m "Candidatos del relevamiento de POIs: OSM completo y el registro oficial de estaciones, marcados contra la Red"
```

---

## Etapas 3, 4 y 5 — La pasada de evidencia

Las tres etapas usan el **mismo procedimiento** con distinta categoría; se repite en cada una a propósito, para que cada tarea se pueda ejecutar sola.

### Task 8: Gomerías

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Data/pois-caba-relevamiento-2026-09.json`
- Modify: `data/relevamiento/README.md` (búsquedas hechas)
- Modify (si corresponde): `src/TruckNavigator.Infrastructure/Data/pois-caba-osm.json` — una gomería de agosto que gane evidencia **se saca de ahí** y entra al archivo nuevo con el **mismo `source` de OSM al final** del campo, para que el id no cambie.

**Interfaces:**
- Produces: el archivo nuevo, con esta cabecera y esta plantilla por punto.

- [ ] **Step 1: Crear el archivo con la cabecera y ningún punto, y ver que el candado exige evidencia**

```json
{
  "generatedOn": "2026-09-15",
  "generatedBy": "relevamiento manual con evidencia por las tres vias (operador, señales, reseñas)",
  "sourceNote": "Relevamiento de gomerias, estaciones de servicio y lugares para comer aptos para camiones, en CABA mas el anillo de acceso. Metodo en data/relevamiento/README.md. Google Maps se uso como referencia de descubrimiento y verificacion, nunca como base: cada dato cita su origen, las coordenadas salen de OSM o del registro oficial de estaciones, y lo que sale de una ficha o de reseñas es resumen propio con fecha.",
  "pois": []
}
```

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiDatasetTests" 2>&1 | tail -3`
Expected: `Passed!` (el archivo vacío parsea). Agregar **una** entrada de prueba `TyreShop` con `verificationLevel: NotConfirmed` y volver a correr: tiene que fallar `Tyre_shops_and_eateries_never_enter_without_evidence`. Borrarla. Ese es el candado que gobierna la etapa.

- [ ] **Step 2: La plantilla de cada entrada**

```json
    {
      "name": "<nombre como lo publica el comercio>",
      "category": "TyreShop",
      "address": "<calle y numero; si esta fuera de CABA, agregar la localidad y 'Provincia de Buenos Aires'>",
      "neighbourhood": "<barrio de CABA, o null fuera de la Ciudad>",
      "latitude": -34.000000,
      "longitude": -58.000000,
      "phone": "<como lo publica el comercio, o null>",
      "website": "<url, o null>",
      "openingHours": "<como lo publica, o null>",
      "description": "<que es y que hace, en una o dos frases propias>",
      "services": ["<Cubiertas para camion>", "<Alineacion>", "<Servicio en ruta>"],
      "suitableForLightTruck": true,
      "suitableForHeavyTruck": true,
      "suitableForSemiTrailer": null,
      "suitableForTrailer": null,
      "source": "<URL del operador o 'ficha publica del comercio en Google Maps' (consultado DD/MM/AAAA)>; coordenada: OpenStreetMap <tipo/id> (consultado DD/MM/AAAA)",
      "sourceRetrievedOn": "2026-09-15",
      "verificationLevel": "Confirmed",
      "suitabilityEvidenceKind": "Reviews",
      "suitabilityEvidence": "Según reseñas de conductores consultadas el 15/09/2026: <que dicen, resumido: entran semis / hay lugar para maniobrar / atienden camiones de noche>.",
      "isSampleData": false
    }
```

Reglas de la plantilla:
- `source` **empieza** por la evidencia (operador o ficha) y termina con la coordenada de OSM. Nunca empieza con "OpenStreetMap": eso es una importación cruda y el test lo marca.
- `suitableFor…` sólo `true` para los tipos que la evidencia menciona. "Camiones" sin más → liviano y pesado. "Semis"/"equipos" → semirremolque. "Acoplado" → trailer. Lo demás `null`.
- `suitabilityEvidenceKind` y `verificationLevel` van juntos: `Operator`/`Official`/`Reviews` → `Confirmed`; `Signals` → `Probable`.
- `suitabilityEvidence` lleva la fecha con formato `DD/MM/AAAA`.
- Si la coordenada no está en OSM, geocodificar la dirección con Photon (`https://photon.komoot.io/api/?q=<direccion>, Buenos Aires&limit=1`) y escribir en `source`: *"coordenada: Photon sobre la direccion (consultado DD/MM/AAAA)"*.

- [ ] **Step 3: Descubrir y verificar, por tandas de 10**

Para cada tanda:

1. Tomar candidatos de `candidatos-osm.json` con `category = TyreShop`, priorizando `enRedPesada = true`, los barrios del sur y oeste (Barracas, Pompeya, Mataderos, Soldati, Lugano, Liniers), y los que tengan "camión", "pesados", "semi", "truck" en el nombre.
2. Sumar descubrimiento: en Google Maps, en el navegador, buscar `gomería camiones` y `gomería pesados` centrado en cada zona prioritaria (spec §6.4) y anotar los que no estén en OSM.
3. Para cada uno, por las tres vías: (a) buscar el sitio del comercio (`WebSearch "<nombre> gomería"`), leer si declara camiones; (b) abrir la ficha en Google Maps y leer descripción, categoría declarada y fotos; (c) leer las reseñas y anotar, en palabras propias, si cuentan camiones y de qué tipo.
4. Escribir la entrada con la plantilla. Si no hay evidencia por ninguna vía, **no entra**, y se anota en el README como descartada por falta de evidencia.
5. Correr `dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiDatasetTests"` → verde.
6. Commit de la tanda: `git commit -m "Relevamiento de gomerias: tanda N, <cuantas> con evidencia"`.

Registrar en el README cada búsqueda de descubrimiento hecha (texto, zona, fecha).

- [ ] **Step 4: Verificación de la etapa**

Levantar el backend y:

```bash
curl -s "http://localhost:5080/api/pois?categories=TyreShop" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const n=j.filter(p=>!p.isSampleData);console.log('gomerias total',j.length,'relevadas',n.length,'confirmadas',n.filter(p=>p.verificationLevel==='Confirmed').length,'probables',n.filter(p=>p.verificationLevel==='Probable').length)})"
```

Leer 5 evidencias al azar de la respuesta y comprobar que se entienden solas (qué, por qué, cuándo). Parar el backend.

- [ ] **Step 5: Commit final de la etapa**

```bash
git add src/TruckNavigator.Infrastructure/Data/ data/relevamiento/README.md
git commit -m "Relevamiento de gomerias para camiones: <N> puntos con evidencia"
```

---

### Task 9: Estaciones de servicio

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Data/pois-caba-relevamiento-2026-09.json`
- Modify: `data/relevamiento/README.md`
- Modify (si corresponde): `pois-caba-osm.json` — una estación de agosto que gane evidencia se mueve, mismo `source` de OSM al final.

- [ ] **Step 1: Las redes de las marcas, verificadas en sus sitios**

Antes de mirar estaciones sueltas, buscar y leer las páginas oficiales de las redes para camiones: `WebSearch "YPF Ruta estaciones camiones"`, `"Axion Energy estaciones para transporte pesado"`, `"Shell estaciones truck"`, `"Puma Energy estaciones camiones"`. Anotar en el README qué red existe, qué declara (playa, gasoil grado 3, AdBlue, atención de camiones) y la URL con fecha. Una estación que figura en una red oficial de la marca es `Operator` → `Confirmed`.

- [ ] **Step 2: Tandas de 10, con el registro oficial como lista**

Partir de `candidatos-energia.json` (es la lista completa y con licencia), priorizando `enRedPesada = true`, bandera con red de camiones, y `productos` con GNC o gasoil grado 3. Cruzar con el candidato OSM (`osm`) para nombre, horario y teléfono. Por cada una, las tres vías igual que en la Task 8. Plantilla igual, con `category: FuelStation`, `services` con los productos del registro (`Gasoil grado 2`, `Gasoil grado 3`, `GNC`) más lo que declare el operador (`Playa para camiones`, `AdBlue`, `Lavadero`), y `source` que cite **el registro oficial** (*"Secretaria de Energia, Precios en surtidor Res. 314/2016, idempresa <n> (consultado DD/MM/AAAA)"*) más la evidencia.

**Regla de esta categoría:** una estación **sin evidencia** entra igual si `enRedPesada = true`, como `NotConfirmed`, `suitabilityEvidenceKind: None`, con los cuatro `suitableFor…` en `null` y `description` que diga sobre qué calle de la Red está. Una estación sin evidencia y fuera de la Red **no entra**.

Tests y commit por tanda como en la Task 8.

- [ ] **Step 3: Verificación de la etapa**

Igual que en la Task 8 con `categories=FuelStation`, y además contar cuántas quedaron `NotConfirmed` y sobre qué calles. Anotar los tres números (confirmadas, probables, no confirmadas) en el README.

- [ ] **Step 4: Commit final de la etapa**

```bash
git commit -am "Relevamiento de estaciones de servicio para camiones: <N> con evidencia, <M> sobre la Red sin evidencia"
```

---

### Task 10: Lugares para comer con lugar para el camión

**Files:**
- Modify: `src/TruckNavigator.Infrastructure/Data/pois-caba-relevamiento-2026-09.json`
- Modify: `data/relevamiento/README.md`

- [ ] **Step 1: Descubrimiento, porque OSM no tiene nada**

No hay candidatos de OSM (0 con `hgv`). Buscar en Google Maps, en el navegador, centrado en cada zona prioritaria y en las estaciones de la Task 9 que declaren playa: `parador camiones`, `comedor camioneros`, `restaurante estacionamiento camiones`, `parrilla camiones`. Buscar también en la web: `WebSearch "parador para camioneros Capital Federal"`, `"comedor de camioneros Mercado Central"`, `"donde comen los camioneros en Buenos Aires"`. Y el sitio del Mercado Central, que publica los servicios del predio.

- [ ] **Step 2: Verificar y escribir**

Las tres vías igual que en la Task 8. Plantilla con `category: TruckFriendlyEatery`, `services` como `Playa para camiones`, `Comida al paso`, `Abierto de noche`. **Sólo entra con evidencia de lugar para el camión**: un restaurante bueno sin playa no es de esta categoría. Para la coordenada, OSM si el local existe como `amenity=restaurant` (buscarlo por nombre en Overpass o en el mapa), si no, Photon sobre la dirección, dicho en `source`.

Tests y commit por tanda.

- [ ] **Step 3: Verificación de la etapa**

Igual que en la Task 8 con `categories=TruckFriendlyEatery`. **El número final se escribe en el README aunque sea chico**, con la lista de zonas buscadas sin resultado.

- [ ] **Step 4: Commit final de la etapa**

```bash
git commit -am "Relevamiento de lugares para comer con lugar para el camion: <N> puntos"
```

---

## Etapa 6 — Cierre

### Task 11: Los números en los docs y las skills

**Files:**
- Modify: `docs/data-sources.md` (L-5 sin cambios; L-6 con los números nuevos)
- Modify: `docs/pois.md` (tabla "Los datos" con el archivo nuevo y sus conteos; L-6)
- Modify: `.claude/skills/estado-camiones-app/SKILL.md` (sección 4 "verificado" y sección 8 "lo que sigue"), `.claude/skills/producto-camiones-app/SKILL.md` (Fase 4, la fila de POIs)
- Modify: `CLAUDE.md` (conteo de tests)

- [ ] **Step 1: Sacar los conteos del dataset, no de memoria**

```bash
dotnet test tests/TruckNavigator.IntegrationTests --filter "FullyQualifiedName~PoiDatasetTests" 2>&1 | tail -2
node -e "
const fs=require('fs');const dir='src/TruckNavigator.Infrastructure/Data/';
for(const f of fs.readdirSync(dir).filter(f=>f.startsWith('pois-'))){const d=JSON.parse(fs.readFileSync(dir+f,'utf8'));const by={};for(const p of d.pois){const k=p.category+'/'+p.verificationLevel;by[k]=(by[k]||0)+1;}console.log(f,d.pois.length,by);}"
```

- [ ] **Step 2: Escribir los números**

- L-6: reemplazar *"75 de los 78 puntos… en null"* por los números nuevos: cuántos puntos hay, cuántos con aptitud declarada por categoría, y que la aptitud por reseñas lleva fecha.
- `docs/pois.md`, tabla "Los datos": la fila del relevamiento con su conteo, y en "Lo que se dejó afuera a propósito" las zonas buscadas sin resultado para comer.
- Skill de estado: en §4 un bloque *"El relevamiento de POIs — 15/09/2026"* con qué se verificó y cómo (tests + API), y en §8 el ítem de POIs actualizado: base hecha, **interfaz pendiente**.
- Skill de producto: la fila de POIs de la Fase 4 pasa a 🔨 con *"base relevada el 15/09/2026; falta la interfaz"*.
- `CLAUDE.md`: el conteo de tests que dio `dotnet test`.

- [ ] **Step 3: Verificar que los docs coinciden con el dataset**

Los conteos citados en `docs/pois.md` y en L-6 tienen que ser los mismos que imprimió el Step 1. Comprobar a mano, número por número.

- [ ] **Step 4: Commit**

```bash
git add docs/ .claude/skills/ CLAUDE.md
git commit -m "POIs: los numeros del relevamiento en los docs y las skills; la interfaz queda como lo siguiente"
```

---

## Self-review

**Cobertura de la spec:** §3 alcance → Task 3 (test del bbox) y Task 7 (bbox del script); §4 regla → Task 6; §5.1 categoría → Task 1; §5.2 evidencia → Tasks 1–3, 5; §5.3 niveles → Tasks 1, 3, 6; §5.4 aptitud por tipo → plantilla de la Task 8; §5.5 seed → Tasks 2, 4; §6.1 candidatos → Task 7; §6.2 tres vías → Tasks 8–10; §6.3 regla de entrada → Task 3 (test) y Tasks 8–9; §6.4 zonas → Tasks 8–10; §7 archivo → Task 8; §8 tests → Tasks 1–5; §9 etapas → estructura del plan; §10 fuera de alcance → nada de interfaz; §11 → Task 10 (número chico escrito), Task 11 (fechas), plantilla (Photon).

**Sin placeholders:** los `<…>` que quedan son valores que sólo se conocen al ejecutar (nombres, conteos, fechas de corrida), no pasos sin definir.

**Consistencia de tipos:** `SuitabilityEvidenceKind` (enum) y `SuitabilityEvidence` (string?) se llaman igual en dominio, contexto, dataset, seed, DTO y tests; `ManagedByDataset` idem; la sobrecarga `ApplyAsync(db, dataset, ct)` de la Task 4 es la que usan los tests de esa tarea; `TruckFriendlyEatery` se escribe igual en el enum, los tests y el script.
