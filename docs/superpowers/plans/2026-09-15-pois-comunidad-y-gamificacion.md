# Validación comunitaria de lugares y su gamificación — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un camionero pueda votar un lugar (apto / no apto, con su tipo de camión) y agregar lugares nuevos, que la ficha muestre cuántos como él lo recomiendan, y que aportar pague EXP y avance una pista con sus skins — reutilizando el motor de progresión tal como está.

**Architecture:** una entidad de voto por (lugar, camionero) con el tipo de camión; dos columnas en el POI para lo aportado; un sello comunitario calculado en el dominio (función pura); dos motivos y dos constantes nuevas en el libro de EXP; una pista `lugares` en el catálogo; un método más en el único lugar que otorga (`ProgressionRecorder`); tres endpoints bajo `/api/pois`; el bloque `community` en el `PoiDto`. La interfaz de la ficha queda para la construcción de la UI de POIs.

**Tech Stack:** .NET 10 Minimal API, EF Core + SQLite (migración), xUnit (TDD estricto: ver cada test en rojo), JS nativo sin build (`node --test`).

**Spec:** `docs/superpowers/specs/2026-09-15-pois-comunidad-y-gamificacion-design.md`

## Global Constraints

- Español en código, comentarios, commits y docs. Comentarios con el porqué, como el resto del repo.
- **El cliente nunca informa lo que ganó**: todo pasa por `ProgressionRecorder`. Ningún endpoint recibe EXP.
- **Lo verificado no se toca**: los votos no escriben `VerificationLevel` ni `SuitableFor…`.
- Un lugar aportado nace `ManagedByDataset = false`, `IsSampleData = false`, `NotConfirmed`, evidencia `None`.
- Rectángulo del alcance: `-34.725…-34.505` / `-58.555…-58.315`. Duplicado: misma categoría a < 25 m.
- Umbrales del sello: 3 votos, relación 2 a 1. EXP: aporte 10, voto 2, escalón 100. Pista `lugares`: 1·3·7·15·30·60·120·250·500·1.000.
- Fechas en SQLite con el conversor `UtcTicks` (AD-20).
- Migraciones: `dotnet ef migrations add <Nombre> --project src/TruckNavigator.Infrastructure --startup-project src/TruckNavigator.Api --output-dir Persistence/Migrations`.
- Antes de `dotnet test`, ningún backend corriendo (bloquea las DLL).
- Commit por tarea. `routing/config-truck.yml` nunca se commitea.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/TruckNavigator.Domain/Pois/PoiVote.cs` (nuevo) | `PoiVote`, `PoiVerdict` |
| `src/TruckNavigator.Domain/Pois/CommunityStanding.cs` (nuevo) | `CommunityCount`, `CommunitySeal`, `CommunityStanding.SealFor` y sus umbrales |
| `src/TruckNavigator.Domain/Pois/PointOfInterest.cs` | `ContributedBy`, `ContributedAt` |
| `src/TruckNavigator.Domain/Pois/PoiContribution.cs` (nuevo) | cómo nace un lugar aportado (`PoiContribution.Create`) y el rectángulo de alcance |
| `src/TruckNavigator.Domain/Progression/LedgerEntry.cs` | `LedgerReason.PlaceAdded`, `PlaceVoted` |
| `src/TruckNavigator.Domain/Progression/ExperienceScale.cs` | `PlaceAdded`, `PlaceVote` |
| `src/TruckNavigator.Domain/Progression/TrackCatalog.cs` | pista `lugares` |
| `src/TruckNavigator.Domain/Progression/ContributionEarnings.cs` (nuevo) | lo que dejó un aporte |
| `src/TruckNavigator.Infrastructure/Persistence/AppDbContext.cs` | `PoiVotes`, columnas nuevas, índices, FKs |
| `src/TruckNavigator.Infrastructure/Persistence/Migrations/…_AddPoiCommunity.cs` | migración |
| `src/TruckNavigator.Infrastructure/Progression/ProgressionRecorder.cs` | `RecordContributionAsync` |
| `src/TruckNavigator.Infrastructure/Pois/CommunityReader.cs` (nuevo) | cuenta votos por lugar y por clase, en una consulta |
| `src/TruckNavigator.Api/Contracts/Dtos.cs` | `CommunityDto`, `CommunityCountDto`, `AddPoiRequest`, `VoteRequest`, `ContributionEarnedDto`, `PoiDto.Community` |
| `src/TruckNavigator.Api/Program.cs` | `POST /api/pois`, `PUT/DELETE /api/pois/{id}/vote`, `GET` con `community` |
| `src/TruckNavigator.Api/wwwroot/js/logros.js`, `api.js` | insignia `lugares`; `addPoi`, `votePoi`, `retirePoiVote` |
| `docs/pois.md`, `docs/data-sources.md`, `docs/decisions.md` (AD-46), skills, `CLAUDE.md` | documentación |

---

## Etapa 1 — Dominio

### Task 1: El sello comunitario

**Files:**
- Create: `src/TruckNavigator.Domain/Pois/CommunityStanding.cs`
- Test: `tests/TruckNavigator.UnitTests/CommunityStandingTests.cs`

**Interfaces:**
- Produces: `record CommunityCount(int Suitable, int NotSuitable)`, `enum CommunitySeal { NoVotesYet, Recommended, Disputed }`, `static CommunitySeal CommunityStanding.SealFor(CommunityCount)`, `const int MinimumVotes = 3`, `const int ApprovalRatio = 2`.

- [ ] **Step 1: Test en rojo**

```csharp
using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El sello de la comunidad: una señal aparte de lo verificado, con umbrales fijos.
/// </summary>
public class CommunityStandingTests
{
    [Theory]
    [InlineData(0, 0, CommunitySeal.NoVotesYet)]
    [InlineData(2, 0, CommunitySeal.NoVotesYet)]   // menos de tres votos no dice nada
    [InlineData(3, 0, CommunitySeal.Recommended)]
    [InlineData(2, 1, CommunitySeal.NoVotesYet)]   // tres votos pero sin el doble de aptos
    [InlineData(4, 2, CommunitySeal.Recommended)]
    [InlineData(5, 3, CommunitySeal.NoVotesYet)]
    [InlineData(3, 3, CommunitySeal.Disputed)]
    [InlineData(1, 4, CommunitySeal.Disputed)]
    [InlineData(0, 3, CommunitySeal.Disputed)]
    public void The_seal_follows_the_thresholds(int suitable, int notSuitable, CommunitySeal expected)
    {
        Assert.Equal(expected, CommunityStanding.SealFor(new CommunityCount(suitable, notSuitable)));
    }

    [Fact]
    public void The_thresholds_are_the_ones_the_user_approved()
    {
        Assert.Equal(3, CommunityStanding.MinimumVotes);
        Assert.Equal(2, CommunityStanding.ApprovalRatio);
    }
}
```

- [ ] **Step 2: Verlo fallar** — `dotnet test tests/TruckNavigator.UnitTests --filter CommunityStandingTests` → no compila (`CommunityStanding` no existe).

- [ ] **Step 3: Implementar**

```csharp
namespace TruckNavigator.Domain.Pois;

/// <summary>Cuantos dijeron apto y cuantos no.</summary>
public sealed record CommunityCount(int Suitable, int NotSuitable)
{
    public int Total => Suitable + NotSuitable;
}

/// <summary>
/// El sello de la comunidad sobre un lugar. Es una señal APARTE del nivel
/// verificado: nunca lo reemplaza (decision del usuario del 15/09/2026).
/// </summary>
public enum CommunitySeal
{
    NoVotesYet = 0,
    Recommended = 1,
    Disputed = 2
}

/// <summary>
/// Que sello le corresponde a un conteo de votos.
/// </summary>
/// <remarks>
/// <para>
/// Funcion pura con umbrales fijos, para que "recomendado" signifique lo mismo en
/// la API y en la ficha, y para que cambiar el umbral sea cambiar un numero aca.
/// </para>
/// <para>
/// Tres votos es poco y se sabe: es la señal minima para arrancar sin usuarios.
/// Se ajusta con datos.
/// </para>
/// </remarks>
public static class CommunityStanding
{
    /// <summary>Menos que esto, el sello no dice nada.</summary>
    public const int MinimumVotes = 3;

    /// <summary>Cuantos aptos por cada no apto hacen falta para recomendar.</summary>
    public const int ApprovalRatio = 2;

    public static CommunitySeal SealFor(CommunityCount count)
    {
        if (count.Total < MinimumVotes)
        {
            return CommunitySeal.NoVotesYet;
        }

        if (count.NotSuitable >= count.Suitable)
        {
            return CommunitySeal.Disputed;
        }

        // Entre "no apto iguala" y "el doble de aptos" el sello calla: 4 a 3 no es
        // una recomendacion, es una discusion que todavia no se dio.
        return count.Suitable >= ApprovalRatio * count.NotSuitable
            ? CommunitySeal.Recommended
            : CommunitySeal.NoVotesYet;
    }
}
```

- [ ] **Step 4: Verde** — mismo comando, 10 casos.
- [ ] **Step 5: Commit** — `git add src/TruckNavigator.Domain/Pois/CommunityStanding.cs tests/TruckNavigator.UnitTests/CommunityStandingTests.cs && git commit -m "Comunidad: el sello de los votos, una funcion pura con umbrales fijos"`

### Task 2: El voto y el lugar aportado

**Files:**
- Create: `src/TruckNavigator.Domain/Pois/PoiVote.cs`, `src/TruckNavigator.Domain/Pois/PoiContribution.cs`
- Modify: `src/TruckNavigator.Domain/Pois/PointOfInterest.cs`
- Test: `tests/TruckNavigator.UnitTests/PoiContributionTests.cs`

**Interfaces:**
- Produces: `class PoiVote { Guid PoiId; Guid DriverId; PoiSuitabilityField TruckClass; PoiVerdict Verdict; DateTimeOffset CastAt; DateTimeOffset UpdatedAt; }`, `enum PoiVerdict { Suitable = 0, NotSuitable = 1 }`; `PointOfInterest.ContributedBy (Guid?)`, `ContributedAt (DateTimeOffset?)`; `static PointOfInterest PoiContribution.Create(Guid driverId, string name, PoiCategory category, double lat, double lon, string? address, string? description, DateTimeOffset when)` que tira `ArgumentException` con motivo si el nombre no tiene 3–80 caracteres o la coordenada está fuera del rectángulo; `static bool PoiContribution.IsInsideCoverage(double lat, double lon)`; constantes del rectángulo.

- [ ] **Step 1: Test en rojo**

```csharp
using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

public class PoiContributionTests
{
    private static readonly DateTimeOffset When = new(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3));

    [Fact]
    public void A_contributed_place_is_born_unverified_and_outside_the_dataset()
    {
        var driver = Guid.NewGuid();

        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, "Debenedetti 100", null, When);

        Assert.Equal(VerificationLevel.NotConfirmed, poi.VerificationLevel);
        Assert.Equal(SuitabilityEvidenceKind.None, poi.SuitabilityEvidenceKind);
        Assert.Null(poi.SuitableForLightTruck);
        Assert.Null(poi.SuitableForHeavyTruck);
        Assert.Null(poi.SuitableForSemiTrailer);
        Assert.Null(poi.SuitableForTrailer);
        Assert.False(poi.ManagedByDataset);
        Assert.False(poi.IsSampleData);
        Assert.Equal(driver, poi.ContributedBy);
        Assert.Equal(When, poi.ContributedAt);
        Assert.Equal(new DateOnly(2026, 9, 15), poi.SourceRetrievedOn);
        Assert.Contains("comunidad", poi.Source);
        Assert.NotEqual(Guid.Empty, poi.Id);
    }

    [Theory]
    [InlineData(-34.80, -58.40)]   // al sur del anillo
    [InlineData(-34.60, -58.60)]   // al oeste
    public void A_place_outside_caba_and_its_ring_is_refused(double lat, double lon)
    {
        var ex = Assert.Throws<ArgumentException>(() =>
            PoiContribution.Create(Guid.NewGuid(), "Afuera", PoiCategory.FuelStation, lat, lon, null, null, When));

        Assert.Contains("CABA", ex.Message);
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("   ")]
    public void A_name_that_is_too_short_is_refused(string name)
    {
        Assert.Throws<ArgumentException>(() =>
            PoiContribution.Create(Guid.NewGuid(), name, PoiCategory.FuelStation, -34.6, -58.4, null, null, When));
    }

    [Fact]
    public void The_name_is_trimmed_and_capped_at_eighty()
    {
        var poi = PoiContribution.Create(Guid.NewGuid(), "  Parador  ", PoiCategory.TruckFriendlyEatery, -34.6, -58.4, null, null, When);
        Assert.Equal("Parador", poi.Name);

        Assert.Throws<ArgumentException>(() =>
            PoiContribution.Create(Guid.NewGuid(), new string('x', 81), PoiCategory.FuelStation, -34.6, -58.4, null, null, When));
    }
}
```

- [ ] **Step 2: Verlo fallar** — no compila.

- [ ] **Step 3: Implementar**

`PoiVote.cs`:

```csharp
namespace TruckNavigator.Domain.Pois;

/// <summary>Lo que un camionero dice de un lugar.</summary>
public enum PoiVerdict
{
    Suitable = 0,
    NotSuitable = 1
}

/// <summary>
/// El voto de un camionero sobre un lugar: apto o no, y con que tipo de camion.
/// </summary>
/// <remarks>
/// <para>
/// Un voto por camionero y lugar —la clave compuesta lo garantiza—: cambiar de
/// opinion reescribe la fila. Se guarda el <b>tipo</b> de camion y no su id, para
/// que borrar el camion no borre el voto y para que el voto siga diciendo con que
/// clase de vehiculo se emitio (decision del usuario del 15/09/2026: la ficha
/// muestra los votos de camiones como el tuyo).
/// </para>
/// </remarks>
public sealed class PoiVote
{
    public Guid PoiId { get; set; }

    public Guid DriverId { get; set; }

    public PoiSuitabilityField TruckClass { get; set; }

    public PoiVerdict Verdict { get; set; }

    public DateTimeOffset CastAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
```

`PointOfInterest.cs` — agregar al final de la clase, con comentario:

```csharp
    /// <summary>Quien lo aporto, si vino de la comunidad; null en todo lo relevado.</summary>
    public Guid? ContributedBy { get; set; }

    /// <summary>Cuando lo aporto.</summary>
    public DateTimeOffset? ContributedAt { get; set; }
```

`PoiContribution.cs`:

```csharp
namespace TruckNavigator.Domain.Pois;

/// <summary>
/// Como nace un lugar que carga un camionero.
/// </summary>
/// <remarks>
/// <para>
/// Nace <b>sin aptitud verificada</b>: los cuatro campos en null y evidencia
/// <c>None</c>. La aptitud verificada la escribe un relevamiento con fuente; lo
/// que la comunidad opina va en los votos. Es lo que hace que lo aportado
/// complemente y no reemplace (decision del usuario del 15/09/2026).
/// </para>
/// <para>
/// Y nace fuera del dataset (<c>ManagedByDataset = false</c>): el seed no lo pisa
/// ni lo borra.
/// </para>
/// </remarks>
public static class PoiContribution
{
    // El mismo rectangulo del relevamiento: CABA mas un anillo de ~2 km. Afuera la
    // app no tiene mapa ni capas (L-11), y un lugar que nadie va a ver no sirve.
    public const double LatMin = -34.725;
    public const double LatMax = -34.505;
    public const double LonMin = -58.555;
    public const double LonMax = -58.315;

    public const int NameMinLength = 3;
    public const int NameMaxLength = 80;

    public static bool IsInsideCoverage(double latitude, double longitude) =>
        latitude >= LatMin && latitude <= LatMax && longitude >= LonMin && longitude <= LonMax;

    public static PointOfInterest Create(
        Guid driverId,
        string name,
        PoiCategory category,
        double latitude,
        double longitude,
        string? address,
        string? description,
        DateTimeOffset when)
    {
        var cleanName = (name ?? string.Empty).Trim();

        if (cleanName.Length < NameMinLength || cleanName.Length > NameMaxLength)
        {
            throw new ArgumentException(
                $"El nombre tiene que tener entre {NameMinLength} y {NameMaxLength} caracteres.", nameof(name));
        }

        if (!IsInsideCoverage(latitude, longitude))
        {
            throw new ArgumentException(
                "El lugar tiene que estar dentro de CABA o su anillo de acceso: afuera la app todavia no tiene mapa.",
                nameof(latitude));
        }

        var local = when.ToOffset(TimeSpan.FromHours(-3));

        return new PointOfInterest
        {
            Id = Guid.NewGuid(),
            Name = cleanName,
            Category = category,
            Latitude = latitude,
            Longitude = longitude,
            Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Services = [],
            Source = $"Aporte de la comunidad ({local:dd/MM/yyyy})",
            SourceRetrievedOn = DateOnly.FromDateTime(local.DateTime),
            VerificationLevel = VerificationLevel.NotConfirmed,
            SuitabilityEvidenceKind = SuitabilityEvidenceKind.None,
            ManagedByDataset = false,
            IsSampleData = false,
            ContributedBy = driverId,
            ContributedAt = when
        };
    }
}
```

(Ajustar los nombres de propiedades a los reales de `PointOfInterest`: `Services` es `IReadOnlyList<string>`; verificar `Id` con setter.)

- [ ] **Step 4: Verde** — `dotnet test tests/TruckNavigator.UnitTests --filter PoiContributionTests`.
- [ ] **Step 5: Commit** — `"Comunidad: el voto con su tipo de camion, y como nace un lugar aportado"`

### Task 3: La progresión sabe de aportes

**Files:**
- Modify: `LedgerEntry.cs` (motivos), `ExperienceScale.cs` (constantes), `TrackCatalog.cs` (pista `lugares`)
- Create: `src/TruckNavigator.Domain/Progression/ContributionEarnings.cs`
- Test: `tests/TruckNavigator.UnitTests/ExperienceScaleTests.cs`, `TrackCatalogTests.cs`

**Interfaces:**
- Produces: `LedgerReason.PlaceAdded = 2`, `LedgerReason.PlaceVoted = 3`; `ExperienceScale.PlaceAdded = 10`, `ExperienceScale.PlaceVote = 2`; `TrackCatalog.Places = "lugares"`; `record ContributionEarnings(int ContributionExperience, int TierExperience, IReadOnlyList<CompletedTier> CompletedTiers) { int TotalExperience }`.

- [ ] **Step 1: Tests en rojo** — en `ExperienceScaleTests`:

```csharp
    /// <remarks>
    /// Aportar no puede competir con manejar: un voto vale menos que el viaje mas
    /// corto y un aporte no mas que el. Decision del usuario del 15/09/2026.
    /// </remarks>
    [Fact]
    public void Contributing_pays_less_than_driving()
    {
        Assert.Equal(2, ExperienceScale.PlaceVote);
        Assert.Equal(10, ExperienceScale.PlaceAdded);
        Assert.True(ExperienceScale.PlaceVote < ExperienceScale.TripBase);
        Assert.True(ExperienceScale.PlaceAdded <= ExperienceScale.TripBase);
    }
```

En `TrackCatalogTests`: cambiar `The_catalog_only_has_tracks_the_server_can_already_measure` a `["kilometraje", "viajes", "repartos", "nocturnos", "lugares"]` y agregar el `InlineData("lugares", new long[] { 1, 3, 7, 15, 30, 60, 120, 250, 500, 1_000 })` a la Theory de escaleras.

- [ ] **Step 2: Verlo fallar** — `dotnet test tests/TruckNavigator.UnitTests --filter "ExperienceScaleTests|TrackCatalogTests"`: no compila (constantes) y el de códigos falla.

- [ ] **Step 3: Implementar**

`LedgerEntry.cs`: en `LedgerReason` agregar `PlaceAdded = 2, PlaceVoted = 3` y actualizar el `<remarks>` (ya no son dos motivos: "todo lo que no es un viaje ni un escalón es un aporte a los lugares, y el motivo dice cuál").

`ExperienceScale.cs`:

```csharp
    /// <summary>EXP por agregar un lugar: como un viaje corto, porque hay que cargar
    /// nombre, categoria, ubicacion y camion.</summary>
    public const int PlaceAdded = 10;

    /// <summary>EXP por votar un lugar, una sola vez por lugar. Sin tope diario por
    /// decision del usuario del 15/09/2026: se revisa con datos.</summary>
    public const int PlaceVote = 2;
```

`TrackCatalog.cs`: `public const string Places = "lugares";` y en `Build()`:

```csharp
            // Los votos y los lugares aportados, con la escalera de viajes: los tres
            // primeros escalones caen en la primera semana. Decision del usuario del
            // 15/09/2026.
            Make(Places,      [1, 3, 7, 15, 30, 60, 120, 250, 500, 1_000])
```

`ContributionEarnings.cs`:

```csharp
namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Lo que un aporte a los lugares le dejo al camionero.
/// </summary>
/// <remarks>
/// La misma forma que <see cref="TripEarnings"/> sin el nivel: el nivel es de
/// kilometros y aportar no lo mueve.
/// </remarks>
public sealed record ContributionEarnings(
    int ContributionExperience,
    int TierExperience,
    IReadOnlyList<CompletedTier> CompletedTiers)
{
    public int TotalExperience => ContributionExperience + TierExperience;
}
```

- [ ] **Step 4: Verde** — la suite unitaria completa (`dotnet test tests/TruckNavigator.UnitTests`): el test de recompensas únicas cubre la pista nueva.
- [ ] **Step 5: Commit** — `"Progresion: la pista lugares, y cuanto pagan un voto y un aporte"`

---

## Etapa 2 — Persistencia y el que otorga

### Task 4: Migración `AddPoiCommunity`

**Files:**
- Modify: `AppDbContext.cs`
- Create: migración
- Test: `tests/TruckNavigator.IntegrationTests/PoiVotePersistenceTests.cs`

**Interfaces:**
- Produces: `DbSet<PoiVote> PoiVotes`; clave `(PoiId, DriverId)`; índice `PoiId`; `TruckClass` y `Verdict` como texto; `CastAt`/`UpdatedAt`/`ContributedAt` con `UtcTicks`; FK a `PointsOfInterest` (cascade) y a `AppUser` (cascade); `ContributedBy` FK a `AppUser` con `SetNull`.

- [ ] **Step 1: Test en rojo** — mismo esqueleto de `ProgressionRecorderTests` (SQLite en memoria, `MigrateAsync`, `CreateDriverAsync`):

```csharp
    [Fact]
    public async Task A_vote_survives_the_round_trip()
    {
        var driver = await CreateDriverAsync();
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null, When);
        _db.PointsOfInterest.Add(poi);
        _db.PoiVotes.Add(new PoiVote { PoiId = poi.Id, DriverId = driver, TruckClass = PoiSuitabilityField.SemiTrailer, Verdict = PoiVerdict.Suitable, CastAt = When, UpdatedAt = When });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var stored = await _db.PoiVotes.SingleAsync(v => v.PoiId == poi.Id && v.DriverId == driver);
        Assert.Equal(PoiSuitabilityField.SemiTrailer, stored.TruckClass);
        Assert.Equal(PoiVerdict.Suitable, stored.Verdict);
        Assert.Equal(When, stored.CastAt);

        var place = await _db.PointsOfInterest.SingleAsync(p => p.Id == poi.Id);
        Assert.Equal(driver, place.ContributedBy);
        Assert.Equal(When, place.ContributedAt);
    }

    [Fact]
    public async Task One_vote_per_driver_and_place()
    {
        // ... dos votos con la misma clave → DbUpdateException; ChangeTracker.Clear() entre medio,
        // como enseño la leccion del 10/09 (el rastreador de EF lo ve antes que el esquema).
    }

    [Fact]
    public async Task A_contributed_place_is_not_deleted_by_the_seed()
    {
        // PoiContribution.Create → Add → PointOfInterestSeed.ApplyAsync(_db, dataset: []) → sigue estando.
    }
```

- [ ] **Step 2: Verlo fallar** — no compila (`PoiVotes`).
- [ ] **Step 3: Implementar** — en `AppDbContext`: `public DbSet<PoiVote> PoiVotes => Set<PoiVote>();`; en `OnModelCreating`, junto al POI: `poi.Property(p => p.ContributedAt).HasConversion(UtcTicks);` (nullable: usar el conversor nullable que ya exista o `HasConversion(new ValueConverter<DateTimeOffset?, long?>(...))` — mirar cómo está hecho `Trip.FinishedAt`, que ya es `DateTimeOffset?`), `poi.HasOne<AppUser>().WithMany().HasForeignKey(p => p.ContributedBy).OnDelete(DeleteBehavior.SetNull);` y la entidad:

```csharp
        var vote = modelBuilder.Entity<PoiVote>();

        // Un voto por camionero y lugar: la clave compuesta lo hace imposible de
        // duplicar por construccion. Cambiar de opinion es reescribir la fila.
        vote.HasKey(v => new { v.PoiId, v.DriverId });
        vote.Property(v => v.TruckClass).HasConversion<string>().HasMaxLength(16);
        vote.Property(v => v.Verdict).HasConversion<string>().HasMaxLength(16);
        vote.Property(v => v.CastAt).HasConversion(UtcTicks);
        vote.Property(v => v.UpdatedAt).HasConversion(UtcTicks);

        // La ficha cuenta los votos de un lugar; el indice es por lugar.
        vote.HasIndex(v => v.PoiId);

        vote.HasOne<PointOfInterest>().WithMany().HasForeignKey(v => v.PoiId).OnDelete(DeleteBehavior.Cascade);
        vote.HasOne<AppUser>().WithMany().HasForeignKey(v => v.DriverId).OnDelete(DeleteBehavior.Cascade);
```

Migración: `dotnet ef migrations add AddPoiCommunity …`. Revisar que tenga `CreateTable PoiVotes` y dos `AddColumn` en `PointsOfInterest`.

- [ ] **Step 4: Verde** — `dotnet test tests/TruckNavigator.IntegrationTests --filter "PoiVotePersistenceTests|PoiDatasetTests|PointOfInterestSeed"`.
- [ ] **Step 5: Commit** — `"Comunidad: los votos y lo aportado llegan a la base (migracion AddPoiCommunity)"`

### Task 5: `RecordContributionAsync`

**Files:**
- Modify: `ProgressionRecorder.cs`
- Test: `tests/TruckNavigator.IntegrationTests/ProgressionRecorderTests.cs`

**Interfaces:**
- Produces: `Task<ContributionEarnings?> RecordContributionAsync(Guid driverId, LedgerReason reason, string sourceKey, DateTimeOffset when, CancellationToken ct = default)` — `reason` sólo `PlaceAdded` o `PlaceVoted` (si no, `ArgumentException`); paga `ExperienceScale.PlaceAdded` o `PlaceVote`; avanza `lugares` en 1; asienta escalones y recompensas; `null` si ya estaba cobrado.

- [ ] **Step 1: Tests en rojo**

```csharp
    [Fact]
    public async Task A_vote_pays_two_and_lights_the_first_tier_of_places()
    {
        var driver = await CreateDriverAsync();
        var poi = Guid.NewGuid();

        var earned = await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, $"poi-vote:{poi}", When);

        Assert.NotNull(earned);
        Assert.Equal(ExperienceScale.PlaceVote, earned!.ContributionExperience);
        Assert.Single(earned.CompletedTiers);
        Assert.Equal("lugares", earned.CompletedTiers[0].TrackCode);
        Assert.Equal(ExperienceScale.PerTier, earned.TierExperience);
        Assert.Contains(await _db.Rewards.Where(r => r.DriverId == driver).Select(r => r.RewardCode).ToListAsync(), code => code == "lugares-01");
        Assert.Equal(1, (await _db.TrackProgress.SingleAsync(t => t.DriverId == driver && t.TrackCode == "lugares")).Count);
    }

    [Fact]
    public async Task The_same_place_never_pays_twice()
    {
        var driver = await CreateDriverAsync();
        var key = $"poi-vote:{Guid.NewGuid()}";

        Assert.NotNull(await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, key, When));
        Assert.Null(await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, key, When.AddDays(1)));

        Assert.Equal(1, (await _db.TrackProgress.SingleAsync(t => t.DriverId == driver && t.TrackCode == "lugares")).Count);
    }

    [Fact]
    public async Task Adding_a_place_pays_ten()
    {
        var driver = await CreateDriverAsync();
        var earned = await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceAdded, $"poi-added:{Guid.NewGuid()}", When);
        Assert.Equal(ExperienceScale.PlaceAdded, earned!.ContributionExperience);
    }

    [Fact]
    public async Task Only_contribution_reasons_are_accepted()
    {
        var driver = await CreateDriverAsync();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _recorder.RecordContributionAsync(driver, LedgerReason.TripCompleted, "x", When));
    }
```

- [ ] **Step 2: Verlo fallar** — no compila.
- [ ] **Step 3: Implementar** — en `ProgressionRecorder`, extraer de `RecordAsync` lo compartido (leer filas, `Advance`, asentar escalones y recompensas, avanzar contadores) a un método privado `ApplyAsync(driverId, when, increments, rows)` que devuelva el `ProgressionOutcome`, y escribir:

```csharp
    /// <summary>
    /// Acredita un aporte a los lugares —un voto o un lugar nuevo— y devuelve lo
    /// que dejo, o <c>null</c> si ese hecho ya estaba cobrado.
    /// </summary>
    /// <remarks>
    /// Es la misma puerta que los viajes: el cliente pide, el servidor decide. Y el
    /// mismo indice unico impide que un voto cambiado o un reintento cobren dos
    /// veces. Retirar un voto no devuelve nada: el libro no resta.
    /// </remarks>
    public async Task<ContributionEarnings?> RecordContributionAsync(
        Guid driverId, LedgerReason reason, string sourceKey, DateTimeOffset when, CancellationToken ct = default)
    {
        var amount = reason switch
        {
            LedgerReason.PlaceAdded => ExperienceScale.PlaceAdded,
            LedgerReason.PlaceVoted => ExperienceScale.PlaceVote,
            _ => throw new ArgumentException("Solo los aportes a los lugares pasan por aca.", nameof(reason))
        };

        var alreadyCredited = await db.LedgerEntries.AnyAsync(
            e => e.DriverId == driverId && e.Reason == reason && e.SourceKey == sourceKey, ct);

        if (alreadyCredited)
        {
            return null;
        }

        var rows = await db.TrackProgress.Where(t => t.DriverId == driverId).ToDictionaryAsync(t => t.TrackCode, ct);
        var increments = new Dictionary<string, long> { [TrackCatalog.Places] = 1 };

        db.LedgerEntries.Add(Entry(driverId, when, reason, amount, sourceKey));

        var outcome = ApplyAsync(driverId, when, increments, rows);   // asienta escalones, recompensas y contadores

        await db.SaveChangesAsync(ct);

        return new ContributionEarnings(amount, outcome.CompletedTiers.Count * ExperienceScale.PerTier, outcome.CompletedTiers);
    }
```

`RecordAsync` pasa a usar `ApplyAsync` también; sus tests existentes tienen que seguir verdes sin tocarlos.

- [ ] **Step 4: Verde** — `dotnet test tests/TruckNavigator.IntegrationTests --filter ProgressionRecorderTests` (los viejos y los nuevos).
- [ ] **Step 5: Commit** — `"Progresion: un voto o un lugar aportado pasan por la misma puerta que los viajes"`

### Task 6: `CommunityReader` — contar votos

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Pois/CommunityReader.cs`
- Test: `tests/TruckNavigator.IntegrationTests/CommunityReaderTests.cs`

**Interfaces:**
- Produces: `record CommunityView(CommunityCount All, CommunitySeal Seal, PoiSuitabilityField? TruckClass, CommunityCount? ForTruck, CommunitySeal? SealForTruck, PoiVerdict? YourVote)`; `Task<IReadOnlyDictionary<Guid, CommunityView>> ForPlacesAsync(IReadOnlyCollection<Guid> poiIds, PoiSuitabilityField? truckClass, Guid? driverId, CancellationToken ct)` — una sola consulta de votos por lote de lugares, agrupada en memoria.

- [ ] **Step 1: Test en rojo** — con tres camioneros (crear usuarios como en el recorder), un lugar, votos: semi apto, semi apto, semi apto, pesado no apto → `All = (3,1)`, `Seal = Recommended`, `ForTruck(SemiTrailer) = (3,0)` Recommended, `ForTruck(HeavyTruck) = (0,1)` NoVotesYet, `YourVote` del primero = Suitable; un lugar sin votos → `(0,0)` NoVotesYet y `YourVote = null`.
- [ ] **Step 2: Verlo fallar** — no compila.
- [ ] **Step 3: Implementar** — `db.PoiVotes.Where(v => poiIds.Contains(v.PoiId)).AsNoTracking().ToListAsync()` y agrupar por `PoiId`; construir `CommunityView` para **cada** id pedido (los sin votos también). Sin `truckClass` → `ForTruck`/`SealForTruck` null; sin `driverId` → `YourVote` null.
- [ ] **Step 4: Verde.**
- [ ] **Step 5: Commit** — `"Comunidad: contar los votos de un lote de lugares, en total y para un tipo de camion"`

---

## Etapa 3 — API

### Task 7: `GET /api/pois` trae `community`

**Files:**
- Modify: `Dtos.cs` (`CommunityCountDto`, `CommunityForTruckDto`, `ContributedDto`, `CommunityDto`, `PoiDto` + `Community`), `Program.cs` (`GET`), `PoiContractsTests.cs`
- Test: `tests/TruckNavigator.IntegrationTests/PoiContractsTests.cs` (DTO), `PoiCommunityEndpointTests.cs` (nuevo, con `WebApplicationFactory<Program>` si ya se usa en el repo; si no, probar el ensamblado del DTO y el filtro en un test de reader + un test manual por curl)

**Interfaces:**
- Produces: `PoiDto` gana `CommunityDto Community` al final:

```csharp
public sealed record CommunityCountDto(int Suitable, int NotSuitable, string Seal);
public sealed record CommunityForTruckDto(string TruckClass, int Suitable, int NotSuitable, string Seal);
public sealed record ContributedDto(DateOnly At, string? ByAlias);
public sealed record CommunityDto(int Suitable, int NotSuitable, string Seal, CommunityForTruckDto? ForYourTruck, string? YourVote, ContributedDto? Contributed);
```

y `PoiDto.From(poi, truck, community, contributedAlias)`.

- [ ] **Step 1: Test en rojo** — en `PoiContractsTests`: un POI aportado con `CommunityView` → el DTO trae `Community.Suitable`, `Seal`, `ForYourTruck.TruckClass == "SemiTrailer"`, `Contributed.ByAlias`. Y el filtro: `suitableOnly` deja pasar un POI sin aptitud verificada pero con `SealForTruck == Recommended`, y no uno recomendado sólo para otra clase (probar la función pura que decida el filtro: `static bool PoiFilter.PassesSuitableOnly(bool? verified, CommunitySeal? sealForTruck)` en el Api o en el dominio — ponerla en el dominio, `Pois/PoiFilter.cs`, con test unitario).
- [ ] **Step 2: Verlo fallar.**
- [ ] **Step 3: Implementar** — en el `GET`: después de traer `points`, `var community = await communityReader.ForPlacesAsync(ids, truck is null ? null : PoiSuitability.FieldFor(truck), CurrentUserId(principal), ct);` y los alias de los `ContributedBy` distintos en una consulta a `DriverProfiles`. Registrar `CommunityReader` en DI (`AddScoped`). Filtro: `results.Where(p => PoiFilter.PassesSuitableOnly(p.SuitableForSelectedTruck, seal))`.
- [ ] **Step 4: Verde**, y a mano: backend en Development, `curl "http://localhost:5080/api/pois?categories=TyreShop"` → cada punto trae `community` con `seal: "NoVotesYet"`.
- [ ] **Step 5: Commit** — `"POIs: cada lugar trae su sello comunitario, filtrado por el camion del que consulta"`

### Task 8: `PUT` y `DELETE /api/pois/{id}/vote`

**Files:**
- Modify: `Dtos.cs` (`VoteRequest(Guid TruckId, string Verdict)`, `VoteResultDto(CommunityDto Community, ContributionEarnedDto? Earned)`, `ContributionEarnedDto`), `Program.cs`
- Test: endpoint (o el flujo con `AppDbContext` + `ProgressionRecorder` + `CommunityReader` en un test de integración que reproduzca lo que hace el endpoint)

- [ ] **Step 1: Tests en rojo** — votar apto con un semi: queda la fila con `TruckClass = SemiTrailer`, `Earned.ContributionExperience == 2`, `Community.YourVote == "Suitable"`; cambiar a no apto: la fila se reescribe, `Earned == null`; retirar: la fila desaparece, la EXP queda; volver a votar: `Earned == null`. Camión ajeno → 404. Lugar inexistente → 404. Verdict inválido → 400.
- [ ] **Step 2: Verlo fallar.**
- [ ] **Step 3: Implementar**

```csharp
pois.MapPut("/{id:guid}/vote", async (Guid id, VoteRequest request, ClaimsPrincipal principal, AppDbContext db,
    ProgressionRecorder progression, CommunityReader community, CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);
    if (userId is null) return Results.Unauthorized();
    if (!Enum.TryParse<PoiVerdict>(request.Verdict, true, out var verdict))
        return Results.ValidationProblem(new() { ["verdict"] = ["Vale Suitable o NotSuitable."] });

    var poi = await db.PointsOfInterest.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
    if (poi is null) return Results.NotFound();

    var truck = await FindUsableTruckAsync(db, request.TruckId, userId, ct);
    if (truck is null) return Results.Problem(title: "Camion inexistente", statusCode: 404);

    var now = DateTimeOffset.UtcNow;
    var vote = await db.PoiVotes.FirstOrDefaultAsync(v => v.PoiId == id && v.DriverId == userId, ct);
    if (vote is null)
    {
        vote = new PoiVote { PoiId = id, DriverId = userId.Value, CastAt = now };
        db.PoiVotes.Add(vote);
    }
    vote.TruckClass = PoiSuitability.FieldFor(truck);
    vote.Verdict = verdict;
    vote.UpdatedAt = now;
    await db.SaveChangesAsync(ct);

    // La EXP se cobra una vez por lugar: el recorder devuelve null si ya estaba.
    var earned = await progression.RecordContributionAsync(userId.Value, LedgerReason.PlaceVoted, $"poi-vote:{id}", now, ct);
    var view = (await community.ForPlacesAsync([id], vote.TruckClass, userId, ct))[id];
    return Results.Ok(new VoteResultDto(CommunityDto.From(view, null), earned is null ? null : ContributionEarnedDto.From(earned)));
})
.RequireAuthorization()
.WithSummary("Vota un lugar como apto o no apto para el camion elegido.");
```

`DELETE`: borra la fila si existe, 204 siempre. Se aclara en el comentario que **no devuelve EXP**: el libro no resta y el voto ya se cobró una vez.

- [ ] **Step 4: Verde**, y a mano con la cuenta demo: login, `PUT` → 200 con `earned.contributionExperience: 2`; segundo `PUT` → `earned: null`; `GET /api/progress` muestra la EXP y `GET /api/progress/tracks` la pista `lugares` en 1/1.
- [ ] **Step 5: Commit** — `"POIs: votar y retirar el voto; el voto paga una vez y avanza la pista lugares"`

### Task 9: `POST /api/pois` — agregar un lugar

**Files:**
- Modify: `Dtos.cs` (`AddPoiRequest(string Name, string Category, double Latitude, double Longitude, string? Address, string? Description, Guid TruckId)`, `AddedPoiDto(PoiDto Poi, ContributionEarnedDto? Earned)`), `Program.cs`
- Test: integración del flujo

- [ ] **Step 1: Tests en rojo** — agregar con un camión pesado: el POI queda con `ContributedBy`, `ManagedByDataset = false`, `NotConfirmed`; existe el voto `Suitable` con `HeavyTruck`; `Earned.ContributionExperience == 10`; el libro tiene `PlaceAdded` y **no** `PlaceVoted` (el primer voto va con el aporte, no paga aparte). Fuera del rectángulo → 400 con "CABA". Misma categoría a 20 m de uno existente → 409 con `existingId`. Nombre corto → 400. Categoría inválida → 400.
- [ ] **Step 2: Verlo fallar.**
- [ ] **Step 3: Implementar** — `PoiContribution.Create` dentro de try/catch de `ArgumentException` → 400 con el mensaje; duplicado: traer los POIs de esa categoría (índice por categoría) y medir con la misma haversine que el test del dataset (mover `Metros` a `Domain/Pois/GeoDistance.cs` y que el test la use también); guardar POI + voto; `RecordContributionAsync(PlaceAdded, $"poi-added:{poi.Id}")`; 201 `Created($"/api/pois/{poi.Id}", …)`.
- [ ] **Step 4: Verde**, y a mano: `POST` con la cuenta demo → 201; `GET` lo trae con `community.contributed.byAlias` y `seal: "NoVotesYet"` (1 voto); reiniciar el backend → sigue estando (el seed no lo borró).
- [ ] **Step 5: Commit** — `"POIs: agregar un lugar, que nace de la comunidad con su primer voto y paga como un viaje corto"`

---

## Etapa 4 — Web y cierre

### Task 10: `api.js` y la insignia `lugares`

**Files:**
- Modify: `src/TruckNavigator.Api/wwwroot/js/api.js`, `js/logros.js`
- Test: `tests/web/logros.test.mjs` (existe; agregar el caso) 

- [ ] **Step 1: Test en rojo** — `insignia('lugares', 1, 3)` contiene `logro-on` y `Lugares`; `PISTAS.lugares.total === 10`.
- [ ] **Step 2: Verlo fallar** — `node --test tests/web/logros.test.mjs`.
- [ ] **Step 3: Implementar** — en `PISTAS`: `lugares: { nombre: 'Lugares', total: 10, simbolo: <un pin de mapa en pixel art, grilla de 24, mismo lenguaje que los otros> }`. En `api.js`: 

```js
  pois: (categories, truckId, suitableOnly) =>
    request('GET', `/api/pois${query({ categories, truckId, suitableOnly })}`, { auth: 'optional' }),   // con sesion manda el token para traer yourVote; revisar como expresa api.js "auth opcional"
  addPoi: (body) => request('POST', '/api/pois', { body }),
  votePoi: (id, truckId, verdict) => request('PUT', `/api/pois/${id}/vote`, { body: { truckId, verdict } }),
  retirePoiVote: (id) => request('DELETE', `/api/pois/${id}/vote`),
```

- [ ] **Step 4: Verde** — `node --test "tests/web/*.test.mjs"`.
- [ ] **Step 5: Commit** — `"Web: la insignia de lugares y el cliente de votos y aportes"`

### Task 11: Documentación, AD-46 y skills

**Files:**
- Modify: `docs/pois.md` (sección "La comunidad": votos, sello, aportes, la regla de convivencia, los endpoints), `docs/decisions.md` (AD-46: por qué el sello es aparte, por qué sin tope, por qué el voto guarda el tipo), `docs/data-sources.md` (L-6: la comunidad como vía para lo indeclarado, con la marca de que no es oficial), `CLAUDE.md` (endpoints, conteo de tests, trampa: el voto no devuelve EXP), skills de estado (§4 verificado, §8 lo que sigue: la UI de POIs ahora muestra votos) y producto (Fase 4: POIs valorados por usuarios 🔨 → base hecha, falta la interfaz), `data/relevamiento/README.md` (una línea: lo aportado por usuarios no pasa por acá).

- [ ] **Step 1: Escribir**, con los números que dé `dotnet test` y `node --test`.
- [ ] **Step 2: Verificar** — `dotnet test` completo verde, `node --test` verde, backend arriba y los tres endpoints probados a mano con la cuenta demo (dejar la salida en el mensaje del commit).
- [ ] **Step 3: Commit** — `"Comunidad y gamificacion de lugares: docs, AD-46 y skills"`

---

## Self-review

**Cobertura de la spec:** §2 decisiones → Tasks 1 (umbrales), 2 (voto con tipo, lugar aportado), 5 (sin tope: no hay tope en el recorder), 7–9 (aparece enseguida, marcado); §3 reutilización → Tasks 3, 5, 10; §4.1 → Task 2, 4; §4.2 → Task 2, 4, 9; §4.3 → Task 1, 6; §4.4 → Tasks 3, 5; §5 → Tasks 7–9; §6 → Task 10 y fuera de alcance la ficha; §7 tests → cada tarea; §8/§9 → Task 11.

**Sin placeholders:** los fragmentos "como en el recorder" remiten a código que existe en el repo y se cita por archivo; el símbolo del pin y el conversor nullable de fecha se resuelven mirando `logros.js` y `Trip.FinishedAt`, indicados.

**Consistencia de tipos:** `PoiVerdict`, `PoiSuitabilityField`, `CommunityCount`, `CommunitySeal`, `CommunityView`, `ContributionEarnings`, `LedgerReason.PlaceAdded/PlaceVoted`, `TrackCatalog.Places` se llaman igual en todas las tareas; las claves del libro son `poi-vote:{id}` y `poi-added:{id}` en 5, 8 y 9.
