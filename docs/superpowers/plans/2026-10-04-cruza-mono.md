# CRUZÁ, MONO — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el Crossy Road porteño con el mono de la app, jugable dentro de Juegos, con un mundo
sin fin y el HI-SCORE guardado en el servidor como el récord de la Viborita.

**Architecture:** en el cliente, un módulo por responsabilidad en `wwwroot/js/juegos/cruza/`.
Las reglas, el mundo con semilla y el motor son puros, con tests; los dibujos se portan del
prototipo aprobado. Una vista anfitriona, `views/cruza.js`, pone el reloj, los gestos, la pausa
y el servidor. El juego se dibuja en un lienzo lógico de 216 × 340 y se copia a escala entera
en píxeles físicos. En el servidor, el dominio (`Domain/Juegos/Cruza.cs`) calcula los puntos y
rechaza lo imposible. Un servicio de Infrastructure mejora el récord en `DriverRecord` con el
código `cruza`, y un endpoint fino lo expone, igual que la Viborita.

**Tech Stack:** módulos ES sin compilación, `node --test`, Canvas 2D; .NET 10 Minimal API,
EF Core + SQLite, xUnit.

**Spec:** `docs/superpowers/specs/2026-10-04-cruza-mono-design.md`. Prototipo aprobado:
`docs/diseno/prototipo-cruza/` (commit `39f4181`): `sprites.js` (fuente, paleta, mono, caja),
`escena.js` (rasterizador, vehículos, piso, barrio, carteles, HUD, pantallas) y `demo.js` (el
mundo sin fin y el dibujo de una partida).

## Global Constraints

- **Antes de la Task 1:** la Viborita tiene que estar fusionada en `main`. `main` se fusiona con
  squash, así que la rama se rebasa con `git rebase --onto main viborita-tbf cruza-mono`. Después,
  `git log --oneline main..cruza-mono` muestra sólo los commits de Cruza (spec, prototipo y este
  plan). Si la Viborita todavía no está en `main`, se para y se le avisa al usuario.
- Rama `cruza-mono`. Un commit por tarea, en español, que termina con
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No commitear
  `routing/config-truck.yml`, `.claude/launch.json` ni `.superpowers/`. No empujar a `hermano`.
  El push y el PR, sólo cuando el usuario lo pida; el PR lo fusiona el usuario.
- Código, comentarios, commits y docs en español. **Comentarios sin tildes** en `.cs` y en los
  `.js` de la app; los tests `.mjs` sí llevan tildes. Los títulos `### Task N` de este plan
  están así para que los encuentre `task-brief`.
- Sin npm ni empaquetador: módulos ES nativos (AD-21). El dominio, sin dependencias.
- Reglas (spec §5), idénticas en cliente y servidor: **SCORE = 10 × filas + 50 × cajas**;
  código del récord **`cruza`**; paso de **140 ms**; lo imposible es filas o cajas negativas,
  **más cajas que filas** o **filas × 140 ms más que la duración**.
- El campo (spec §2.1): **216 × 340** lógicos, HUD de **28**, **13** filas visibles de **24**,
  **9** columnas. Negro puro `#000000`. El rojo `#FF2E3A` es sólo del golpe.
- Lo que se ve se **porta del prototipo, no se redibuja** (spec §4 y §11). Los números de
  `escena.js` citados por línea son los del commit `39f4181`
  (`git show 39f4181:docs/diseno/prototipo-cruza/escena.js`).
- Tests web: `node --test "tests/web/*.test.mjs"` desde la raíz. .NET: `dotnet test` (antes,
  parar cualquier API corriendo: bloquea los .exe).
- Al verificar en el navegador del panel oculto: `window.requestAnimationFrame = (cb) =>
  setTimeout(() => cb(performance.now()), 16)` y forzar recarga con `location.reload()`. Un
  módulo ES queda cacheado: `import('/js/...?v=' + Date.now())` para ver el código nuevo.

---

## Mapa de archivos

| Archivo | Qué |
|---|---|
| `src/TruckNavigator.Domain/Juegos/Cruza.cs` (nuevo) | Constantes, `Puntos`, `EsPosible` |
| `src/TruckNavigator.Infrastructure/Juegos/CruzaPartidas.cs` (nuevo) | Registra una partida y mejora el récord |
| `src/TruckNavigator.Api/Contracts/Dtos.cs` | `PartidaDeCruzaRequest`, `RecordDeCruzaDto`, `PartidaDeCruzaDto` |
| `src/TruckNavigator.Api/Program.cs` | `POST /api/juegos/cruza/partidas` y el registro del servicio |
| `tests/TruckNavigator.UnitTests/CruzaTests.cs` (nuevo) | Reglas del dominio |
| `tests/TruckNavigator.IntegrationTests/CruzaPartidasTests.cs` (nuevo) | El récord contra SQLite |
| `wwwroot/js/juegos/cruza/reglas.js` (nuevo) | Los números del juego, `puntos`, `banda`, `largoDe` |
| `wwwroot/js/juegos/cruza/mundo.js` (nuevo) | El mundo sin fin, puro y con semilla |
| `wwwroot/js/juegos/cruza/motor.js` (nuevo) | Pasos, cámara, colisiones, vidas, puntos |
| `wwwroot/js/juegos/viborita/dibujos.js` | Tres glifos nuevos (`-`, `+`, `,`) y `rotulo`, que sale de la vista de la Viborita |
| `wwwroot/js/juegos/cruza/sprites.js` (nuevo) | Ayudas de dibujo, paleta, mono, cabezas, caja, texto 5 × 7 |
| `wwwroot/js/juegos/cruza/vehiculos.js` (nuevo) | El rasterizador de siluetas y los 21 modelos |
| `wwwroot/js/juegos/cruza/escenario.js` (nuevo) | Piso, barrio, galpones, conventillos, la letra gruesa, los tres carteles, el mono animado, troncos y cajas, y el caché por fila |
| `wwwroot/js/juegos/cruza/pantallas.js` (nuevo) | Dibujar la partida, HUD, inicio, pausa, final; el estado visual; botones; tamaño |
| `wwwroot/js/views/cruza.js` (nuevo) | La pantalla: reloj, gestos, pausa, servidor |
| `wwwroot/js/views/viborita.js` | Importa `rotulo` de `dibujos.js` |
| `wwwroot/js/api.js`, `dock.js`, `app.js`, `views/juegos.js`, `wwwroot/app.css` | Engancharla |
| `tests/web/cruza-*.test.mjs` (nuevos), `tests/web/viborita-dibujos.test.mjs` | Tests |

`wwwroot` = `src/TruckNavigator.Api/wwwroot`.

---

### Task 1 · Las reglas en el dominio

**Files:**
- Create: `src/TruckNavigator.Domain/Juegos/Cruza.cs`
- Test: `tests/TruckNavigator.UnitTests/CruzaTests.cs`

**Interfaces:**
- Produces: `Cruza.RecordCode` (`"cruza"`), `Cruza.PuntosPorFila` (10), `Cruza.PuntosPorCaja`
  (50), `Cruza.PasoMs` (140), `Cruza.Puntos(int filas, int cajas) : long`,
  `Cruza.EsPosible(int filas, int cajas, long duracionMs) : bool`.

- [ ] **Paso 1: el test que falla**

```csharp
using TruckNavigator.Domain.Juegos;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Las reglas de Cruza, Mono que necesita el servidor: cuanto vale una partida y que
/// partidas son posibles. El cliente usa los mismos numeros (reglas.js).
/// </summary>
public class CruzaTests
{
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 0, 10)]
    [InlineData(73, 4, 930)]
    [InlineData(312, 20, 4120)]
    public void The_score_is_ten_per_row_and_fifty_per_box(int filas, int cajas, long puntos)
    {
        Assert.Equal(puntos, Cruza.Puntos(filas, cajas));
    }

    [Fact]
    public void The_numbers_are_the_ones_of_the_client()
    {
        Assert.Equal("cruza", Cruza.RecordCode);
        Assert.Equal(10, Cruza.PuntosPorFila);
        Assert.Equal(50, Cruza.PuntosPorCaja);
        Assert.Equal(140, Cruza.PasoMs);
    }

    [Fact]
    public void Negative_rows_or_boxes_are_impossible()
    {
        Assert.False(Cruza.EsPosible(-1, 0, 60_000));
        Assert.False(Cruza.EsPosible(10, -1, 60_000));
        Assert.Equal(0, Cruza.Puntos(-3, -1));
    }

    [Fact]
    public void Each_box_needs_its_own_row()
    {
        Assert.True(Cruza.EsPosible(5, 5, 60_000));
        Assert.False(Cruza.EsPosible(5, 6, 60_000));
    }

    [Fact]
    public void Each_row_takes_at_least_one_step()
    {
        Assert.True(Cruza.EsPosible(10, 0, 10 * 140));
        Assert.False(Cruza.EsPosible(10, 0, 10 * 140 - 1));
        Assert.True(Cruza.EsPosible(0, 0, 0));
        Assert.False(Cruza.EsPosible(0, 0, -1));
    }
}
```

- [ ] **Paso 2: ver que falla**

Run: `dotnet test tests/TruckNavigator.UnitTests --filter CruzaTests`
Expected: no compila, `Cruza` no existe.

- [ ] **Paso 3: el dominio**

```csharp
namespace TruckNavigator.Domain.Juegos;

/// <summary>
/// Las reglas de Cruza, Mono que le importan al servidor: cuanto vale una partida y
/// cuales son posibles.
/// </summary>
/// <remarks>
/// <para>
/// El servidor calcula los puntos a partir de las filas y las cajas: no los recibe.
/// Asi el numero que se guarda como record no lo inventa el telefono.
/// </para>
/// <para>
/// Rechazar lo imposible no defiende contra un tramposo decidido —el telefono igual
/// informa filas y cajas— pero descarta lo absurdo. Hay una caja por fila como
/// maximo, asi que no puede haber mas cajas que filas, y cada fila necesita al menos
/// un paso. Los mismos numeros viven en el cliente (js/juegos/cruza/reglas.js).
/// </para>
/// </remarks>
public static class Cruza
{
    /// <summary>El codigo del record en la tabla de records personales.</summary>
    public const string RecordCode = "cruza";

    public const int PuntosPorFila = 10;
    public const int PuntosPorCaja = 50;

    /// <summary>Lo que tarda un paso, en milisegundos.</summary>
    public const int PasoMs = 140;

    /// <summary>10 por la fila mas lejana y 50 por caja. Nada negativo suma.</summary>
    public static long Puntos(int filas, int cajas) =>
        (long)PuntosPorFila * Math.Max(0, filas) + (long)PuntosPorCaja * Math.Max(0, cajas);

    /// <summary>
    /// Si una partida asi pudo existir: nada negativo, no mas cajas que filas, y cada
    /// fila con al menos un paso.
    /// </summary>
    public static bool EsPosible(int filas, int cajas, long duracionMs) =>
        filas >= 0
        && cajas >= 0
        && cajas <= filas
        && duracionMs >= 0
        && (long)filas * PasoMs <= duracionMs;
}
```

- [ ] **Paso 4: ver que pasa**

Run: `dotnet test tests/TruckNavigator.UnitTests --filter CruzaTests`
Expected: PASS, 8 tests.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Domain/Juegos/Cruza.cs tests/TruckNavigator.UnitTests/CruzaTests.cs
git commit -m "Cruza, Mono: los puntos y lo posible, en el dominio"
```

---

### Task 2 · El récord en el servidor

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Juegos/CruzaPartidas.cs`
- Modify: `src/TruckNavigator.Api/Contracts/Dtos.cs` (después de `PartidaDeViboritaDto`, ~l. 973)
- Modify: `src/TruckNavigator.Api/Program.cs` (registro junto a `AddScoped<ViboritaPartidas>`, ~l. 114; endpoint después del de la Viborita, ~l. 1717)
- Test: `tests/TruckNavigator.IntegrationTests/CruzaPartidasTests.cs`

**Interfaces:**
- Consumes: `Cruza.EsPosible`, `Cruza.Puntos`, `Cruza.RecordCode` (Task 1);
  `ResultadoDePartida(long Puntos, RecordStanding? Record, bool NuevoRecord)` de
  `ViboritaPartidas.cs`, que se reusa tal cual.
- Produces: `CruzaPartidas.RegistrarAsync(Guid driverId, int filas, int cajas, long duracionMs,
  DateTimeOffset cuando, CancellationToken ct = default) : Task<ResultadoDePartida?>` (null si
  es imposible); `POST /api/juegos/cruza/partidas` con `{ filas, cajas, duracionMs }` que
  devuelve `{ puntos, record: { valor, fecha } | null, nuevoRecord }`, o 422.

- [ ] **Paso 1: el test que falla**

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Juegos;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Juegos;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El record de Cruza, Mono: el segundo en la tabla de records personales, al lado del
/// de la Viborita. El servidor calcula los puntos; igualar no mueve la fecha.
/// </summary>
public sealed class CruzaPartidasTests : IAsyncLifetime
{
    private static readonly DateTimeOffset Antes = new(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Ahora = new(2026, 10, 4, 12, 0, 0, TimeSpan.Zero);

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private CruzaPartidas _partidas = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        await _db.Database.MigrateAsync();
        _partidas = new CruzaPartidas(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> CrearCamioneroAsync()
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "cruza@camiones.test",
            NormalizedEmail = "CRUZA@CAMIONES.TEST",
            UserName = "cruza@camiones.test",
            NormalizedUserName = "CRUZA@CAMIONES.TEST",
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user.Id;
    }

    [Fact]
    public async Task The_server_computes_the_points_and_the_first_game_sets_the_record()
    {
        var id = await CrearCamioneroAsync();

        var resultado = await _partidas.RegistrarAsync(id, filas: 20, cajas: 2, duracionMs: 30_000, Ahora);

        Assert.NotNull(resultado);
        Assert.Equal(300, resultado.Puntos);
        Assert.True(resultado.NuevoRecord);
        Assert.Equal(300, resultado.Record!.Value.Value);
        var guardado = await _db.Records.SingleAsync(r => r.DriverId == id && r.RecordCode == Cruza.RecordCode);
        Assert.Equal(300, guardado.Value);
    }

    [Fact]
    public async Task A_lower_game_keeps_the_record_and_tells_it()
    {
        var id = await CrearCamioneroAsync();
        await _partidas.RegistrarAsync(id, 20, 2, 30_000, Antes);

        var resultado = await _partidas.RegistrarAsync(id, 5, 0, 9_000, Ahora);

        Assert.Equal(50, resultado!.Puntos);
        Assert.False(resultado.NuevoRecord);
        Assert.Equal(300, resultado.Record!.Value.Value);
        Assert.Equal(Antes, resultado.Record.Value.AchievedAt);
    }

    [Fact]
    public async Task Tying_the_record_does_not_move_its_date()
    {
        var id = await CrearCamioneroAsync();
        await _partidas.RegistrarAsync(id, 20, 2, 30_000, Antes);

        var resultado = await _partidas.RegistrarAsync(id, 20, 2, 30_000, Ahora);

        Assert.False(resultado!.NuevoRecord);
        Assert.Equal(Antes, (await _db.Records.SingleAsync(r => r.DriverId == id)).AchievedAt);
    }

    [Fact]
    public async Task A_better_game_moves_the_record_and_its_date()
    {
        var id = await CrearCamioneroAsync();
        await _partidas.RegistrarAsync(id, 20, 2, 30_000, Antes);

        var resultado = await _partidas.RegistrarAsync(id, 21, 2, 30_000, Ahora);

        Assert.True(resultado!.NuevoRecord);
        Assert.Equal(310, resultado.Record!.Value.Value);
        Assert.Equal(Ahora, resultado.Record.Value.AchievedAt);
    }

    [Fact]
    public async Task A_game_with_no_points_is_not_a_record()
    {
        var id = await CrearCamioneroAsync();

        var resultado = await _partidas.RegistrarAsync(id, 0, 0, 3_000, Ahora);

        Assert.Equal(0, resultado!.Puntos);
        Assert.False(resultado.NuevoRecord);
        Assert.Null(resultado.Record);
        Assert.Empty(_db.Records.Where(r => r.DriverId == id));
    }

    [Fact]
    public async Task An_impossible_game_is_rejected_and_nothing_is_saved()
    {
        var id = await CrearCamioneroAsync();

        Assert.Null(await _partidas.RegistrarAsync(id, 5, 6, 600_000, Ahora));
        Assert.Null(await _partidas.RegistrarAsync(id, 100, 0, 1_000, Ahora));
        Assert.Empty(_db.Records.Where(r => r.DriverId == id));
    }

    [Fact]
    public async Task The_record_lives_next_to_the_viborita_one_without_touching_it()
    {
        var id = await CrearCamioneroAsync();
        await new ViboritaPartidas(_db).RegistrarAsync(id, 5, 20_000, Antes);

        await _partidas.RegistrarAsync(id, 20, 2, 30_000, Ahora);

        var records = await _db.Records.Where(r => r.DriverId == id).OrderBy(r => r.RecordCode).ToListAsync();
        Assert.Equal(new[] { "cruza", "viborita" }, records.Select(r => r.RecordCode));
        Assert.Equal(new long[] { 300, 25 }, records.Select(r => r.Value));
    }
}
```

- [ ] **Paso 2: ver que falla**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter CruzaPartidasTests`
Expected: no compila, `CruzaPartidas` no existe.

- [ ] **Paso 3: el servicio**

```csharp
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Juegos;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Juegos;

/// <summary>
/// Registra una partida de Cruza, Mono y mejora el record del camionero.
/// </summary>
/// <remarks>
/// <para>
/// Es el segundo record de la tabla de records personales (<see cref="DriverRecord"/>),
/// con su propio codigo, y usa la misma regla que todos:
/// <see cref="PersonalRecords.Improve"/>, donde igualar no es superar y el empate no
/// mueve la fecha. El resultado es el mismo <see cref="ResultadoDePartida"/> de la
/// Viborita.
/// </para>
/// <para>
/// Una partida de cero puntos no es record: si no, perder en el primer paso festejaria
/// un "nuevo record" de cero.
/// </para>
/// </remarks>
public sealed class CruzaPartidas(AppDbContext db)
{
    /// <summary>El resultado, o <c>null</c> si la partida no pudo existir.</summary>
    public async Task<ResultadoDePartida?> RegistrarAsync(
        Guid driverId,
        int filas,
        int cajas,
        long duracionMs,
        DateTimeOffset cuando,
        CancellationToken ct = default)
    {
        if (!Cruza.EsPosible(filas, cajas, duracionMs))
        {
            return null;
        }

        var puntos = Cruza.Puntos(filas, cajas);

        var guardado = await db.Records.SingleOrDefaultAsync(
            r => r.DriverId == driverId && r.RecordCode == Cruza.RecordCode, ct);

        RecordStanding? vigente = guardado is null
            ? null
            : new RecordStanding(guardado.Value, guardado.AchievedAt);

        var mejor = puntos > 0 ? PersonalRecords.Improve(vigente, puntos, cuando) : null;

        if (mejor is not { } nuevo)
        {
            return new ResultadoDePartida(puntos, vigente, NuevoRecord: false);
        }

        if (guardado is null)
        {
            guardado = new DriverRecord { DriverId = driverId, RecordCode = Cruza.RecordCode };
            db.Records.Add(guardado);
        }

        guardado.Value = nuevo.Value;
        guardado.AchievedAt = nuevo.AchievedAt;
        await db.SaveChangesAsync(ct);

        return new ResultadoDePartida(puntos, nuevo, NuevoRecord: true);
    }
}
```

- [ ] **Paso 4: ver que pasa**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter CruzaPartidasTests`
Expected: PASS, 7 tests.

- [ ] **Paso 5: los DTOs** — en `Contracts/Dtos.cs`, después de `PartidaDeViboritaDto`:

```csharp

/// <summary>Una partida de Cruza, Mono: el telefono informa filas, cajas y duracion, no puntos.</summary>
public sealed record PartidaDeCruzaRequest(int Filas, int Cajas, long DuracionMs);

/// <summary>El record de Cruza, Mono: el valor y cuando se consiguio.</summary>
public sealed record RecordDeCruzaDto(long Valor, DateTimeOffset Fecha);

/// <summary>Lo que devuelve una partida. Los puntos los calcula el servidor.</summary>
public sealed record PartidaDeCruzaDto(long Puntos, RecordDeCruzaDto? Record, bool NuevoRecord);
```

- [ ] **Paso 6: el registro y el endpoint** — en `Program.cs`, debajo de
  `builder.Services.AddScoped<ViboritaPartidas>();`:

```csharp
builder.Services.AddScoped<CruzaPartidas>();
```

  El comentario del grupo `juegos` pasa a decir: `// La Viborita TBF (spec 2026-10-03-viborita-tbf) y Cruza, Mono (spec 2026-10-04-cruza-mono) guardan su record propio. El`
  (el resto del comentario queda igual). Y después del `.WithSummary(...)` del endpoint de la
  Viborita:

```csharp

juegos.MapPost("/cruza/partidas", async (
    PartidaDeCruzaRequest request,
    ClaimsPrincipal principal,
    CruzaPartidas partidas,
    CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);
    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var resultado = await partidas.RegistrarAsync(
        userId.Value, request.Filas, request.Cajas, request.DuracionMs, DateTimeOffset.UtcNow, ct);

    if (resultado is null)
    {
        return Results.Problem(
            title: "Esa partida no pudo existir",
            detail: "Mas cajas que filas, o mas filas de las que se cruzan en ese tiempo.",
            statusCode: StatusCodes.Status422UnprocessableEntity);
    }

    var record = resultado.Record is { } r ? new RecordDeCruzaDto(r.Value, r.AchievedAt) : null;
    return Results.Ok(new PartidaDeCruzaDto(resultado.Puntos, record, resultado.NuevoRecord));
})
.WithSummary("Registra una partida de Cruza, Mono y devuelve los puntos y el record.");
```

- [ ] **Paso 7: compila y no rompe nada**

Run: `dotnet build` y `dotnet test`
Expected: compila sin advertencias nuevas; todos los tests en verde (los 15 de GraphHopper se
saltean solos si no está levantado).

- [ ] **Paso 8: commit**

```bash
git add src/TruckNavigator.Infrastructure/Juegos/CruzaPartidas.cs src/TruckNavigator.Api/Contracts/Dtos.cs src/TruckNavigator.Api/Program.cs tests/TruckNavigator.IntegrationTests/CruzaPartidasTests.cs
git commit -m "Cruza, Mono: el HI-SCORE en el servidor, como el record de la Viborita"
```

---

### Task 3 · Las reglas en el cliente

**Files:**
- Create: `wwwroot/js/juegos/cruza/reglas.js`
- Test: `tests/web/cruza-reglas.test.mjs`

**Interfaces:**
- Produces (todo `export`): `COLUMNAS` 9, `CEL` 24, `FILAS_VISIBLES` 13, `HUD` 28, `ANCHO` 216,
  `ALTO` 340, `PASO_MS` 140, `VIDAS` 3, `GOLPE_MS` 900, `INVULNERABLE_MS` 1500,
  `COLUMNA_DE_LARGADA` 4, `FILAS_DE_LARGADA` 3, `MONO_MAX_DESDE_ABAJO` 6, `OLVIDAR_DEBAJO` 4,
  `UMBRAL_DESLIZAR` 24, `PUNTOS_POR_FILA`, `PUNTOS_POR_CAJA`, `puntos(filas, cajas)`, las
  constantes del mundo (`CADA_PLAYON`, `FILA_OBELISCO`, `PROB_*`, `LIBRES_MINIMAS`,
  `BLOQUEADAS_MAXIMAS_GALPONES`, `FILAS_DESPUES_DE_BOCA`), las del tránsito (`LAZO` 346,
  `AFUERA` 110, `VELOCIDAD_MINIMA`, `FACTOR_LARGOS`, `LARGOS_POR_CARRIL`, `AUTOS_POR_CARRIL`,
  `HUECO_CELDAS`, `HUECO_SEGUNDOS`), las del río (`LAZO_RIO` 360, `TRONCOS_POR_CARRIL` 3,
  `TRONCO_CADA` 5), `AUTOS`, `FLOTA`, `LINEAS`, `largoDe(modelo)`, `BANDAS`, `banda(fila)`.

- [ ] **Paso 1: el test que falla** — `tests/web/cruza-reglas.test.mjs`:

```js
/**
 * Las reglas de CRUZÁ, MONO (spec §2, §3 y §5). Los puntos son los mismos que el
 * servidor (Domain/Juegos/Cruza.cs): si cambian, cambian en los dos lados.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as R from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

test('el campo: 9 columnas y 13 filas de 24, con un HUD de 28', () => {
  assert.equal(R.COLUMNAS, 9);
  assert.equal(R.CEL, 24);
  assert.equal(R.FILAS_VISIBLES, 13);
  assert.equal(R.HUD, 28);
  assert.equal(R.ANCHO, 216);
  assert.equal(R.ALTO, 340);
});

test('el mono: un paso de 140 ms, 3 vidas, 0,9 s de golpe y 1,5 s invulnerable', () => {
  assert.equal(R.PASO_MS, 140);
  assert.equal(R.VIDAS, 3);
  assert.equal(R.GOLPE_MS, 900);
  assert.equal(R.INVULNERABLE_MS, 1500);
  assert.equal(R.COLUMNA_DE_LARGADA, 4);
  assert.equal(R.MONO_MAX_DESDE_ABAJO, 6);
  assert.equal(R.UMBRAL_DESLIZAR, 24);
});

test('SCORE = 10 × filas + 50 × cajas, y nada negativo', () => {
  assert.equal(R.puntos(0, 0), 0);
  assert.equal(R.puntos(1, 0), 10);
  assert.equal(R.puntos(73, 4), 930);
  assert.equal(R.puntos(-3, -1), 0);
});

test('las bandas de dificultad, como en la tabla de la spec', () => {
  assert.deepEqual(R.BANDAS.map((b) => b.desde), [0, 20, 60, 120]);
  assert.deepEqual(R.BANDAS.map((b) => b.velocidad), [1.5, 2.5, 3.5, 4.5]);
  assert.deepEqual(R.BANDAS.map((b) => b.camara), [4, 3, 2.5, 2]);
  assert.deepEqual(R.BANDAS.map((b) => b.calle), [[1, 2], [1, 3], [2, 4], [2, 5]]);
  assert.deepEqual(R.BANDAS.map((b) => b.rio), [[1, 2], [1, 3], [2, 3], [2, 4]]);
  assert.deepEqual(R.BANDAS.map((b) => b.troncos), [[3, 4], [2, 3], [2, 2], [2, 2]]);
  assert.deepEqual(R.BANDAS[0].reparto, [0.8, 0.2, 0]);
  for (const b of R.BANDAS.slice(1)) assert.deepEqual(b.reparto, [0.55, 0.3, 0.15]);
  assert.equal(R.banda(0).desde, 0);
  assert.equal(R.banda(19).desde, 0);
  assert.equal(R.banda(20).desde, 20);
  assert.equal(R.banda(500).desde, 120);
});

test('el mundo: playón cada 25, Obelisco en la 100, río 0,3 y galpones 0,18', () => {
  assert.equal(R.CADA_PLAYON, 25);
  assert.equal(R.FILA_OBELISCO, 100);
  assert.equal(R.PROB_RIO, 0.3);
  assert.equal(R.PROB_GALPONES, 0.18);
  assert.deepEqual(R.PROB_CAJA, { segura: 0.15, calle: 0.1, rio: 0.1 });
  assert.equal(R.VELOCIDAD_MINIMA, 0.8);
  assert.equal(R.FACTOR_LARGOS, 0.75);
  assert.equal(R.LARGOS_POR_CARRIL, 2);
});

test('los vehículos: 5 autos, 9 pinturas de la flota y 6 líneas, con su largo', () => {
  assert.deepEqual(R.AUTOS, ['torino', 'uno', 'fitito', '504', 'taxi']);
  assert.equal(R.FLOTA.length, 9);
  assert.deepEqual(R.LINEAS, ['152', '60', '29', '39', '64', '12']);
  assert.equal(R.largoDe('fitito'), 38);
  assert.equal(R.largoDe('tbf-cisterna'), 96);
  assert.equal(R.largoDe('colectivo-60'), 96);
});
```

- [ ] **Paso 2: ver que falla**

Run: `node --test tests/web/cruza-reglas.test.mjs`
Expected: FAIL, `Cannot find module …/cruza/reglas.js`.

- [ ] **Paso 3: las reglas** — `wwwroot/js/juegos/cruza/reglas.js`:

```js
/**
 * Las reglas de CRUZA, MONO (spec 2026-10-04-cruza-mono, §3 y §5).
 *
 * Todos los numeros del juego, con nombre. Los de los puntos y lo posible son los
 * mismos que usa el servidor (Domain/Juegos/Cruza.cs): si cambian, cambian en los
 * dos lados, y los tests de cada lado los fijan.
 */

// --- el campo
export const COLUMNAS = 9;
export const CEL = 24;
export const FILAS_VISIBLES = 13;
export const HUD = 28;
export const ANCHO = COLUMNAS * CEL;
export const ALTO = HUD + FILAS_VISIBLES * CEL;

// --- el mono
export const PASO_MS = 140;
export const VIDAS = 3;
export const GOLPE_MS = 900;
export const INVULNERABLE_MS = 1500;
export const COLUMNA_DE_LARGADA = 4;
export const FILAS_DE_LARGADA = 3;
/** La camara sigue al mono: nunca queda mas arriba que esto desde el borde de abajo. */
export const MONO_MAX_DESDE_ABAJO = 6;
/** Las filas que quedan mas abajo que esto de la camara se olvidan. */
export const OLVIDAR_DEBAJO = 4;
/** Un deslizamiento da su paso al cruzar estos pixeles de pantalla. */
export const UMBRAL_DESLIZAR = 24;

// --- los puntos (los mismos del servidor)
export const PUNTOS_POR_FILA = 10;
export const PUNTOS_POR_CAJA = 50;

/** SCORE = 10 x la fila mas lejana + 50 x las cajas. */
export const puntos = (filas, cajas) => PUNTOS_POR_FILA * Math.max(0, filas) + PUNTOS_POR_CAJA * Math.max(0, cajas);

// --- el mundo
export const CADA_PLAYON = 25;
export const FILA_OBELISCO = 100;
export const PROB_RIO = 0.3;
export const PROB_GALPONES = 0.18;
export const PROB_PLAZA = 0.35;
export const PROB_CARTEL_BOCA = 0.85;
export const PROB_ADOQUIN = 0.2;
export const PROB_CAJA = { segura: 0.15, calle: 0.1, rio: 0.1 };
export const LIBRES_MINIMAS = 4;
export const BLOQUEADAS_MAXIMAS_GALPONES = 5;
/** La franja que empieza con conventillos tiene al menos estas filas. */
export const FILAS_DESPUES_DE_BOCA = 2;

// --- el transito
/** El lazo de cada carril de calle: el campo mas lo que queda afuera. */
export const LAZO = ANCHO + 130;
/** Cuanto queda afuera a la izquierda: un vehiculo de 96 entra entero. */
export const AFUERA = 110;
export const VELOCIDAD_MINIMA = 0.8;
export const FACTOR_LARGOS = 0.75;
export const LARGOS_POR_CARRIL = 2;
export const AUTOS_POR_CARRIL = 3;
export const HUECO_CELDAS = 2;
export const HUECO_SEGUNDOS = 0.5;

// --- el rio
/** El lazo de un carril de rio: tres troncos cada cinco celdas. */
export const LAZO_RIO = 15 * CEL;
export const TRONCOS_POR_CARRIL = 3;
export const TRONCO_CADA = 5;

export const AUTOS = ['torino', 'uno', 'fitito', '504', 'taxi'];
export const FLOTA = ['celeste', 'violeta', 'naranja', 'amarillo', 'verde', 'rojo', 'azul', 'jaula', 'cisterna'];
export const LINEAS = ['152', '60', '29', '39', '64', '12'];

const LARGO_AUTO = { torino: 50, uno: 44, fitito: 38, 504: 50, taxi: 50 };
/** El largo en pixeles de un modelo: los autos el suyo, camiones y colectivos 96. */
export const largoDe = (modelo) => LARGO_AUTO[modelo] ?? 96;

/**
 * Las bandas de dificultad (spec §5.5). `calle` y `rio` son los carriles por bloque,
 * `troncos` las celdas de cada tronco, `velocidad` la maxima en celdas por segundo,
 * `camara` los segundos que tarda en subir una fila y `reparto` la probabilidad de
 * autos, Red y colectivos.
 */
export const BANDAS = [
  { desde: 0, calle: [1, 2], rio: [1, 2], troncos: [3, 4], velocidad: 1.5, camara: 4, reparto: [0.8, 0.2, 0] },
  { desde: 20, calle: [1, 3], rio: [1, 3], troncos: [2, 3], velocidad: 2.5, camara: 3, reparto: [0.55, 0.3, 0.15] },
  { desde: 60, calle: [2, 4], rio: [2, 3], troncos: [2, 2], velocidad: 3.5, camara: 2.5, reparto: [0.55, 0.3, 0.15] },
  { desde: 120, calle: [2, 5], rio: [2, 4], troncos: [2, 2], velocidad: 4.5, camara: 2, reparto: [0.55, 0.3, 0.15] }
];

/** La banda de una fila. */
export const banda = (fila) => BANDAS.filter((b) => b.desde <= Math.max(0, fila)).pop();
```

- [ ] **Paso 4: ver que pasa**

Run: `node --test tests/web/cruza-reglas.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js tests/web/cruza-reglas.test.mjs
git commit -m "Cruza, Mono: los numeros del juego, con nombre"
```

---

### Task 4 · El mundo sin fin

Es el generador de la demostración (`demo.js`, `crearMundoDemo` y `sinBolsillos`) con las
garantías de la spec cerradas. Al escribir este plan, el código de abajo se corrió con estos
tests: pasan los 18. Las diferencias con la demostración son a propósito:

- el pasillo va de la columna 2 a la 7, porque el playón tapa la 0, la 1 y la 8;
- la largada es parte de la primera franja;
- un playón que corta el último carril de un bloque entra en la búsqueda de bolsillos de la
  franja siguiente;
- el Obelisco va pegado a lo bloqueado;
- la señal de la Red va sólo en galpones pegados a una calle;
- el último cartel se restaura cuando la franja se vuelve a armar;
- `boca` y `galpones` son tipos de fila propios;
- la caja de la calle va sobre la senda.

**Files:**
- Create: `wwwroot/js/juegos/cruza/mundo.js`
- Test: `tests/web/cruza-mundo.test.mjs`

**Interfaces:**
- Consumes: todo lo de `reglas.js` (Task 3).
- Produces: `crearMundo(semilla) : { fila(i), olvidar(debajo) }`, `esSegura(fila) : boolean`,
  `azarCon(semilla) : () => number`, `tramos(cols) : [[desde, cuantas]]`,
  `sinBolsillos(franja, pasillo) : boolean`. La forma de una fila está en el comentario de
  cabecera del módulo: `t` ∈ `vereda | plaza | boca | galpones | playon | calle | rio`, `bloq`
  es un `Set` de columnas, `cajas` un arreglo de columnas, `vel` en px/s, `veh: [[modelo, x0]]`,
  `xs` los `x0` de los troncos, `P` el lazo del río, `cajaEn` el tronco con caja (o −1), `senda`
  `[x0, x1]` en píxeles, `murales: [[col, 'chapa' | 'senal' | 'neon']]`,
  `galpones: [[col, ancho, color]]`, `obst: [[col, 'arbol' | 'jacaranda' | 'contenedor' | 'mate' | 'bolardo' | 'mastil' | 'obelisco']]`.

- [ ] **Paso 1: el test que falla** — `tests/web/cruza-mundo.test.mjs`:

```js
/**
 * El mundo sin fin de CRUZÁ, MONO (spec §3), con semilla fija: cada garantía de la
 * spec se recorre sobre miles de filas, porque un mundo sin paso no se ve en diez.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearMundo, esSegura, sinBolsillos, tramos } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/mundo.js';
import { CEL, COLUMNAS, LAZO, LAZO_RIO, TRONCO_CADA, largoDe } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

const N = 3000;
const SEMILLAS = [1, 7, 2026, 99991];
const filasDe = (semilla, n = N) => { const m = crearMundo(semilla); return [...Array(n).keys()].map((i) => m.fila(i)); };
const MUNDOS = SEMILLAS.map((s) => filasDe(s));
const libres = (f) => [...Array(COLUMNAS).keys()].filter((c) => !f.bloq.has(c));

/** Los tramos de filas seguidas que cumplen la condición: [[desde, hasta]]. */
function corridas(filas, cond) {
  const v = [];
  let desde = null;
  filas.forEach((f, i) => {
    if (cond(f) && desde === null) desde = i;
    if (!cond(f) && desde !== null) { v.push([desde, i - 1]); desde = null; }
  });
  return v; // la última corrida abierta se descarta: puede seguir más allá de N
}

test('la misma semilla da el mismo mundo, y otra semilla otro', () => {
  const resumen = (filas) => JSON.stringify(filas.slice(0, 300).map((f) => ({ ...f, bloq: [...f.bloq] })));
  assert.equal(resumen(filasDe(7, 300)), resumen(filasDe(7, 300)));
  assert.notEqual(resumen(filasDe(7, 300)), resumen(filasDe(8, 300)));
});

test('las filas 0 a 2 son la largada: vereda, la columna 4 libre y sin cajas', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.slice(0, 3)) {
      assert.equal(f.t, 'vereda');
      assert.ok(!f.bloq.has(4));
      assert.deepEqual(f.cajas, []);
    }
  }
});

test('el primer peligro es una calle de un carril', () => {
  for (const filas of MUNDOS) {
    const d = filas.findIndex((f) => !esSegura(f));
    assert.equal(filas[d].t, 'calle');
    assert.ok(esSegura(filas[d + 1]), `la fila ${d + 1} tendría que ser segura`);
  }
});

test('nunca hay dos bloques de río seguidos', () => {
  for (const filas of MUNDOS) {
    const bloques = corridas(filas, (f) => !esSegura(f));
    for (let k = 1; k < bloques.length; k++) {
      const [a0, a1] = bloques[k - 1], [b0] = bloques[k];
      // Un playón solo en medio es el mismo bloque, cortado.
      if (b0 === a1 + 2 && filas[a1 + 1].t === 'playon') continue;
      if (filas[a0].t === 'rio') assert.equal(filas[b0].t, 'calle', `fila ${b0}`);
    }
  }
});

test('dos carriles de río vecinos van en sentidos opuestos', () => {
  for (const filas of MUNDOS) {
    filas.forEach((f, i) => { if (i && f.t === 'rio' && filas[i - 1].t === 'rio') assert.equal(f.dir, -filas[i - 1].dir, `fila ${i}`); });
  }
});

test('entre dos vehículos de un carril hay siempre el hueco mínimo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'calle')) {
      const hueco = (2 + (f.vel / CEL) * 0.5) * CEL;
      const v = f.veh.map(([m, x0]) => ({ x: ((x0 % LAZO) + LAZO) % LAZO, L: largoDe(m) })).sort((a, b) => a.x - b.x);
      v.forEach((a, k) => {
        const b = v[(k + 1) % v.length];
        const libre = (((b.x - (a.x + a.L)) % LAZO) + LAZO) % LAZO;
        assert.ok(v.length === 1 ? LAZO - a.L >= hueco : libre >= hueco - 1e-9, `fila ${f.i}: ${libre} < ${hueco}`);
      });
    }
  }
});

test('en el río el agua libre entre troncos es de 3 celdas como máximo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'rio')) {
      assert.equal(f.P, LAZO_RIO);
      assert.ok(f.n >= 2 && f.n <= 4, `fila ${f.i}: tronco de ${f.n}`);
      assert.ok(TRONCO_CADA - f.n <= 3);
      f.xs.forEach((x, k) => k && assert.equal(x - f.xs[k - 1], TRONCO_CADA * CEL));
    }
  }
});

test('cada franja segura tiene 4 celdas libres por fila, un pasillo y ningún bolsillo', () => {
  for (const filas of MUNDOS) {
    for (const [a, b] of corridas(filas, esSegura)) {
      const franja = filas.slice(a, b + 1);
      franja.forEach((f) => assert.ok(libres(f).length >= 4, `fila ${f.i}: ${libres(f).length} libres`));
      const pasillos = [...Array(COLUMNAS).keys()].filter((c) => franja.every((f) => !f.bloq.has(c)));
      assert.ok(pasillos.length > 0, `filas ${a}-${b} sin pasillo`);
      assert.ok(sinBolsillos(franja, pasillos[0]), `filas ${a}-${b} con un bolsillo`);
    }
  }
});

test('sinBolsillos ve el hueco encerrado que encontró la demostración', () => {
  // Conventillos a los costados de la columna 2 y un árbol adelante: entrar ahí es no salir.
  const boca = { bloq: new Set([0, 1, 3, 4, 5]) };
  const vereda = { bloq: new Set([2]) };
  assert.equal(sinBolsillos([boca, vereda], 7), false);
  assert.equal(sinBolsillos([boca, { bloq: new Set() }], 7), true);
});

test('la fila boca va siempre justo después de un río, y su franja tiene 2 filas o más', () => {
  for (const filas of MUNDOS) {
    let vistas = 0;
    filas.forEach((f, i) => {
      if (f.t !== 'boca') return;
      vistas++;
      assert.equal(filas[i - 1].t, 'rio', `fila ${i}`);
      assert.ok(esSegura(filas[i + 1]), `fila ${i + 1}`);
    });
    assert.ok(vistas > 10);
  }
});

test('los carteles: sobre 3 edificios, nunca dos iguales seguidos, la señal sólo pegada a una calle', () => {
  for (const filas of MUNDOS) {
    const orden = [];
    for (const f of filas) {
      for (const [col, tipo] of f.murales ?? []) {
        orden.push(tipo);
        if (f.t === 'boca') {
          assert.ok([0, 1, 2].every((d) => f.boca.includes(col + d)), `fila ${f.i}: el cartel no está sobre 3 conventillos`);
          assert.notEqual(tipo, 'senal');
        } else {
          assert.equal(f.t, 'galpones');
          assert.ok(f.galpones.some(([c0, n]) => c0 === col && n === 3), `fila ${f.i}: el cartel no está sobre un galpón de 3`);
          if (tipo === 'senal') assert.equal(filas[f.i - 1].t, 'calle', `fila ${f.i}: señal lejos de la calle`);
        }
      }
    }
    orden.forEach((t, k) => k && assert.notEqual(t, orden[k - 1], `dos carteles ${t} seguidos`));
    assert.ok(new Set(orden).size === 3, 'aparecen los tres carteles');
  }
});

test('los galpones son de 2 o 3 celdas, con 5 bloqueadas como máximo, y los conventillos entran en el campo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'galpones')) {
      assert.ok(f.bloq.size <= 5);
      for (const [c0, n] of f.galpones) assert.ok(n === 2 || n === 3);
    }
    for (const f of filas.filter((x) => x.t === 'boca')) {
      for (const [c0, n] of tramos(f.boca)) assert.ok(c0 >= 0 && c0 + n <= COLUMNAS);
    }
  }
});

test('una caja por fila como máximo, ninguna en la largada, y la de la calle sobre la senda', () => {
  for (const filas of MUNDOS) {
    filas.forEach((f, i) => {
      const cajas = f.cajas.length + (f.t === 'rio' && f.cajaEn >= 0 ? 1 : 0);
      assert.ok(cajas <= 1, `fila ${i}: ${cajas} cajas`);
      if (i < 3) assert.equal(cajas, 0);
      for (const col of f.cajas) assert.ok(!f.bloq.has(col), `fila ${i}: caja sobre un obstáculo`);
      if (f.t === 'calle' && f.senda && f.cajas.length) {
        const c = f.cajas[0] * CEL;
        assert.ok(c >= f.senda[0] && c < f.senda[1], `fila ${i}: caja fuera de la senda`);
      }
    });
  }
});

test('cada 25 filas un playón, y en la 100 el Obelisco', () => {
  for (const filas of MUNDOS) {
    for (let i = 25; i < N; i += 25) {
      assert.equal(filas[i].t, 'playon', `fila ${i}`);
      assert.equal(filas[i].numero, i);
      assert.ok(filas[i].bloq.has(0) && filas[i].bloq.has(1) && filas[i].bloq.has(8));
    }
    assert.ok(filas[100].obst.some(([, que]) => que === 'obelisco'));
    assert.ok(!filas[125].obst.some(([, que]) => que === 'obelisco'));
    assert.ok(filas.every((f, i) => f.t !== 'playon' || i % 25 === 0));
  }
});

test('el reparto: más autos, después la Red y lo que menos, colectivos', () => {
  // El sorteo es 0,55 / 0,30 / 0,15; la regla de no poner dos largos seguidos pasa
  // a autos los que tocan, y lo que queda en la calle es cerca de 2/3, 2/9 y 1/9.
  for (const filas of MUNDOS) {
    const cuenta = { autos: 0, red: 0, colectivos: 0 };
    for (const f of filas.slice(20)) if (f.t === 'calle') cuenta[f.clase]++;
    const total = cuenta.autos + cuenta.red + cuenta.colectivos;
    const parte = (k) => cuenta[k] / total;
    assert.ok(parte('autos') >= 0.6 && parte('autos') <= 0.72, `autos ${parte('autos').toFixed(3)}`);
    assert.ok(parte('red') >= 0.18 && parte('red') <= 0.28, `red ${parte('red').toFixed(3)}`);
    assert.ok(parte('colectivos') >= 0.08 && parte('colectivos') <= 0.16, `colectivos ${parte('colectivos').toFixed(3)}`);
    assert.ok(cuenta.colectivos < cuenta.red && cuenta.red < cuenta.autos);
  }
});

test('nunca dos carriles largos seguidos, 2 vehículos por carril largo y ningún colectivo antes de la fila 20', () => {
  for (const filas of MUNDOS) {
    filas.forEach((f, i) => {
      if (f.t !== 'calle') return;
      if (f.clase !== 'autos') {
        assert.ok(f.veh.length <= 2, `fila ${i}`);
        if (filas[i - 1].t === 'calle') assert.equal(filas[i - 1].clase, 'autos', `filas ${i - 1} y ${i}`);
      }
      if (i < 20) assert.notEqual(f.clase, 'colectivos', `fila ${i}`);
    });
  }
});

test('las velocidades salen de la banda y nunca bajan de 0,8 celdas por segundo', () => {
  for (const filas of MUNDOS) {
    for (const f of filas.filter((x) => x.t === 'calle' || x.t === 'rio')) {
      assert.ok(f.vel / CEL >= 0.8 - 1e-9, `fila ${f.i}`);
      assert.ok(f.vel / CEL <= 4.5 + 1e-9, `fila ${f.i}`);
    }
  }
});

test('olvidar suelta las filas de abajo y no cambia las de arriba', () => {
  const m = crearMundo(5);
  const antes = JSON.stringify({ ...m.fila(60), bloq: [...m.fila(60).bloq] });
  m.olvidar(50);
  assert.equal(m.fila(10).t, 'vereda');
  assert.deepEqual(m.fila(10).obst, []);
  assert.equal(JSON.stringify({ ...m.fila(60), bloq: [...m.fila(60).bloq] }), antes);
});
```

- [ ] **Paso 2: ver que falla**

Run: `node --test tests/web/cruza-mundo.test.mjs`
Expected: FAIL, `Cannot find module …/cruza/mundo.js`.

- [ ] **Paso 3: el mundo** — `wwwroot/js/juegos/cruza/mundo.js`:

```js
/**
 * El mundo sin fin de CRUZA, MONO (spec §3).
 *
 * Puro y con semilla: la misma semilla da el mismo mundo, y asi se prueba. Se arma
 * por bloques —una franja segura y un bloque de peligro— a medida que se piden
 * filas. Es el generador de la demostracion del prototipo
 * (docs/diseno/prototipo-cruza/demo.js, crearMundoDemo), con las garantias de la
 * spec cerradas: sin bolsillos, el pasillo libre tambien en el playon, la boca
 * siempre pegada al rio y la senal de la Red solo en galpones pegados a una calle.
 *
 * Una fila es un objeto:
 *   comun   { i, t, bloq: Set de columnas, cajas: [columna] }
 *   segura  t: vereda | plaza | boca | galpones | playon, con obst: [[col, que]],
 *           boca: [col], galpones: [[col, ancho, color]], murales: [[col, tipo]],
 *           amarillo, petalos y, en el playon, numero
 *   calle   { clase: autos | red | colectivos, red, dir, vel (px/s), veh: [[modelo, x0]],
 *             adoquin, mancha, senda?: [x0, x1] }
 *   rio     { dir, vel (px/s), n (celdas del tronco), xs: [x0], P (lazo), cajaEn }
 */

import {
  COLUMNAS, CEL, COLUMNA_DE_LARGADA, FILAS_DE_LARGADA, CADA_PLAYON, FILA_OBELISCO,
  PROB_RIO, PROB_GALPONES, PROB_PLAZA, PROB_CARTEL_BOCA, PROB_ADOQUIN, PROB_CAJA,
  LIBRES_MINIMAS, BLOQUEADAS_MAXIMAS_GALPONES, FILAS_DESPUES_DE_BOCA,
  LAZO, VELOCIDAD_MINIMA, FACTOR_LARGOS, LARGOS_POR_CARRIL, AUTOS_POR_CARRIL,
  HUECO_CELDAS, HUECO_SEGUNDOS, LAZO_RIO, TRONCOS_POR_CARRIL, TRONCO_CADA,
  AUTOS, FLOTA, LINEAS, largoDe, banda
} from './reglas.js';

const PELIGRO = new Set(['calle', 'rio']);
/** Si una fila es segura: no es calle ni rio. */
export const esSegura = (f) => !PELIGRO.has(f.t);

/** El azar con semilla (mulberry32): numeros entre 0 y 1. */
export function azarCon(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los tramos de columnas seguidas: [[desde, cuantas]]. */
export function tramos(cols) {
  const v = [];
  let ini = null, prev = null;
  for (const c of [...cols].sort((a, b) => a - b)) {
    if (prev !== null && c === prev + 1) { prev = c; continue; }
    if (ini !== null) v.push([ini, prev - ini + 1]);
    ini = prev = c;
  }
  if (ini !== null) v.push([ini, prev - ini + 1]);
  return v;
}

/**
 * Sin bolsillos: desde cualquier celda libre de la franja se llega al pasillo sin
 * salir de ella. Busqueda en anchura desde el pasillo de cada fila.
 */
export function sinBolsillos(franja, pasillo) {
  const libre = (k, c) => c >= 0 && c < COLUMNAS && !franja[k].bloq.has(c);
  const visto = new Set();
  const cola = [];
  franja.forEach((f, k) => { if (libre(k, pasillo)) { visto.add(k + ':' + pasillo); cola.push([k, pasillo]); } });
  while (cola.length) {
    const [k, c] = cola.pop();
    for (const [dk, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const k2 = k + dk, c2 = c + dc;
      if (k2 < 0 || k2 >= franja.length || !libre(k2, c2) || visto.has(k2 + ':' + c2)) continue;
      visto.add(k2 + ':' + c2);
      cola.push([k2, c2]);
    }
  }
  return franja.every((f, k) => [...Array(COLUMNAS).keys()].every((c) => !libre(k, c) || visto.has(k + ':' + c)));
}

const vacia = (i) => ({ t: 'vereda', i, obst: [], cajas: [], bloq: new Set() });

export function crearMundo(semilla) {
  const r = azarCon(semilla);
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const uno = (v) => v[Math.floor(r() * v.length)];
  const filas = new Map();
  let siguiente = 0;
  let olvidadasHasta = 0;
  let primero = true;
  let peligroAnterior = null;
  let ultimoMural = null;
  let ultimoPasillo = COLUMNA_DE_LARGADA;

  const columnasLibres = (f) => [...Array(COLUMNAS).keys()].filter((c) => !f.bloq.has(c));
  const caja = (f) => {
    if (f.i >= FILAS_DE_LARGADA && r() < PROB_CAJA.segura) {
      const libres = columnasLibres(f);
      if (libres.length) f.cajas.push(uno(libres));
    }
  };
  // Nunca dos carteles seguidos del mismo tipo.
  const mural = (opciones) => {
    const v = opciones.filter((o) => o !== ultimoMural);
    ultimoMural = uno(v.length ? v : opciones);
    return ultimoMural;
  };

  function playon(i, pasillo) {
    const f = { t: 'playon', i, numero: i, obst: [[0, 'bolardo'], [8, 'bolardo'], [1, 'mastil']], cajas: [], bloq: new Set([0, 1, 8]) };
    // El Obelisco va pegado a lo bloqueado, asi lo libre queda de una pieza.
    if (i === FILA_OBELISCO) {
      const col = pasillo === 2 ? 7 : 2;
      f.obst.push([col, 'obelisco']);
      f.bloq.add(col);
    }
    caja(f);
    return f;
  }

  function segura(tipo, pasillo, limpia) {
    const i = siguiente;
    if (i > 0 && i % CADA_PLAYON === 0) return playon(i, pasillo);
    const f = { t: limpia && (tipo === 'boca' || tipo === 'galpones') ? 'vereda' : tipo, i, obst: [], cajas: [], bloq: new Set(), amarillo: r() < 0.3, petalos: r() < 0.3 };
    if (limpia) { caja(f); return f; }
    if (tipo === 'boca') {
      const libres = new Set([pasillo]);
      while (libres.size < LIBRES_MINIMAS) libres.add(entre(0, COLUMNAS - 1));
      f.boca = [];
      f.murales = [];
      for (let col = 0; col < COLUMNAS; col++) if (!libres.has(col)) { f.boca.push(col); f.bloq.add(col); }
      for (const [c0, n] of tramos(f.boca)) {
        if (n >= 3 && r() < PROB_CARTEL_BOCA) f.murales.push([c0 + Math.floor((n - 3) / 2), mural(['chapa', 'neon'])]);
      }
    } else if (tipo === 'galpones') {
      f.galpones = [];
      f.murales = [];
      const pegadoACalle = filas.get(i - 1)?.t === 'calle';
      for (let intento = 0; intento < 30 && f.galpones.length < 2; intento++) {
        const n = entre(2, 3), c0 = entre(0, COLUMNAS - n);
        const cols = [...Array(n).keys()].map((k) => c0 + k);
        if (cols.some((c) => c === pasillo || f.bloq.has(c) || f.bloq.has(c - 1) || f.bloq.has(c + 1))) continue;
        if (f.bloq.size + n > BLOQUEADAS_MAXIMAS_GALPONES) continue;
        cols.forEach((c) => f.bloq.add(c));
        f.galpones.push([c0, n, entre(0, 3)]);
        if (n !== 3) continue;
        // La senal de la Red va en el galpon pegado a una calle, y solo ahi.
        const tipoMural = pegadoACalle && ultimoMural !== 'senal' ? 'senal' : mural(['neon', 'chapa']);
        if (tipoMural === 'senal') ultimoMural = 'senal';
        f.murales.push([c0, tipoMural]);
      }
    } else {
      const opciones = tipo === 'plaza' ? ['arbol', 'jacaranda', 'mate'] : ['arbol', 'jacaranda', 'contenedor'];
      for (let k = entre(1, 3); k > 0; k--) {
        const col = entre(0, COLUMNAS - 1);
        if (col === pasillo || f.bloq.has(col)) continue;
        f.bloq.add(col);
        f.obst.push([col, uno(opciones)]);
      }
    }
    caja(f);
    return f;
  }

  function calle(anterior) {
    const i = siguiente, b = banda(i), u = r();
    let clase = u < b.reparto[0] ? 'autos' : u < b.reparto[0] + b.reparto[1] ? 'red' : 'colectivos';
    // Nunca dos carriles seguidos de vehiculos largos.
    if (clase !== 'autos' && anterior && anterior.clase !== 'autos') clase = 'autos';
    const largo = clase !== 'autos';
    const dir = r() < 0.5 ? 1 : -1;
    const maxima = b.velocidad * (largo ? FACTOR_LARGOS : 1);
    const celdasPorSegundo = Math.max(VELOCIDAD_MINIMA, VELOCIDAD_MINIMA + r() * (maxima - VELOCIDAD_MINIMA));
    const hueco = (HUECO_CELDAS + celdasPorSegundo * HUECO_SEGUNDOS) * CEL;
    const elegir = () => (clase === 'autos' ? uno(AUTOS) : clase === 'red' ? 'tbf-' + uno(FLOTA) : 'colectivo-' + uno(LINEAS));
    const modelos = [];
    let usado = 0;
    while (modelos.length < (largo ? LARGOS_POR_CARRIL : AUTOS_POR_CARRIL)) {
      const m = elegir();
      if (usado + largoDe(m) + hueco > LAZO) break;
      modelos.push(m);
      usado += largoDe(m) + hueco;
    }
    const holgura = Math.max(0, LAZO - usado);
    let x = Math.floor(r() * LAZO);
    const veh = [];
    for (const m of modelos) {
      veh.push([m, x]);
      x += largoDe(m) + hueco + Math.floor((r() * holgura) / modelos.length);
    }
    const f = {
      t: 'calle', i, clase, red: clase === 'red', dir, vel: celdasPorSegundo * CEL, veh, cajas: [], bloq: new Set(),
      adoquin: clase !== 'red' && r() < PROB_ADOQUIN, mancha: r() < 0.3 ? entre(10, 190) : 0
    };
    if (i >= FILAS_DE_LARGADA && r() < PROB_CAJA.calle) f.cajas.push(entre(0, COLUMNAS - 1));
    return f;
  }

  function rio(anterior) {
    const i = siguiente, b = banda(i);
    // Dos carriles de rio seguidos van en sentidos opuestos.
    const dir = anterior?.t === 'rio' ? -anterior.dir : r() < 0.5 ? 1 : -1;
    const celdasPorSegundo = VELOCIDAD_MINIMA + r() * Math.max(0.2, b.velocidad * 0.6 - VELOCIDAD_MINIMA);
    const n = entre(b.troncos[0], b.troncos[1]);
    const fase = entre(0, 14) * CEL;
    const xs = [...Array(TRONCOS_POR_CARRIL).keys()].map((k) => fase + k * TRONCO_CADA * CEL);
    const cajaEn = i >= FILAS_DE_LARGADA && r() < PROB_CAJA.rio ? entre(0, TRONCOS_POR_CARRIL - 1) : -1;
    return { t: 'rio', i, dir, vel: celdasPorSegundo * CEL, n, xs, P: LAZO_RIO, cajaEn, cajas: [], bloq: new Set() };
  }

  const poner = (f) => { filas.set(f.i, f); siguiente++; return f; };

  /**
   * Una franja segura. La primera trae la largada adelante, con el pasillo en la
   * columna de largada. Si el bloque anterior lo corto un playon en su ultimo
   * carril, ese playon queda pegado a esta franja: es parte de ella y comparte el
   * pasillo, asi la busqueda de bolsillos lo cubre.
   */
  function franjaSegura() {
    const anterior = filas.get(siguiente - 1);
    const largada = siguiente === 0;
    const despuesDeRio = anterior?.t === 'rio';
    const prefijo = anterior?.t === 'playon' ? [anterior] : [];
    const pasillo = largada ? COLUMNA_DE_LARGADA : prefijo.length ? ultimoPasillo : entre(2, 7);
    const n = (largada ? FILAS_DE_LARGADA : 0) + Math.max(despuesDeRio ? FILAS_DESPUES_DE_BOCA : 1, entre(1, 3));
    const desde = siguiente;
    const muralAntes = ultimoMural;
    // Sin bolsillos: si la franja sale con uno, se vuelve a armar. Desde el quinto
    // intento sale sin obstaculos, que no puede tener bolsillos.
    for (let intento = 0; ; intento++) {
      const franja = [];
      for (let k = 0; k < n; k++) {
        const deLargada = largada && k < FILAS_DE_LARGADA;
        const tipo = deLargada ? 'vereda' : k === 0 && despuesDeRio ? 'boca' : r() < PROB_GALPONES ? 'galpones' : r() < PROB_PLAZA ? 'plaza' : 'vereda';
        const f = poner(segura(tipo, pasillo, intento >= 5));
        if (deLargada) f.cajas = [];
        franja.push(f);
      }
      if (sinBolsillos([...prefijo, ...franja], pasillo)) break;
      for (let k = desde; k < siguiente; k++) filas.delete(k);
      siguiente = desde;
      ultimoMural = muralAntes;
    }
    ultimoPasillo = pasillo;
  }

  function bloque() {
    franjaSegura();
    const pasillo = ultimoPasillo;
    const b = banda(siguiente);
    const tipo = primero || peligroAnterior === 'rio' ? 'calle' : r() < PROB_RIO ? 'rio' : 'calle';
    const carriles = primero ? 1 : entre(...b[tipo]);
    primero = false;
    let anterior = null;
    const nuevos = [];
    for (let k = 0; k < carriles; k++) {
      // El playon corta el bloque: sigue despues.
      if (siguiente % CADA_PLAYON === 0) { poner(playon(siguiente, pasillo)); anterior = null; continue; }
      const f = poner(tipo === 'rio' ? rio(anterior) : calle(anterior));
      nuevos.push(f);
      anterior = f;
    }
    // La senda cruza el bloque entero, y la caja de la calle va sobre ella.
    if (tipo === 'calle' && nuevos.length >= 2) {
      const c0 = entre(0, COLUMNAS - 2);
      for (const f of nuevos) {
        f.senda = [c0 * CEL, c0 * CEL + 44];
        f.cajas = f.cajas.map(() => c0 + (f.i % 2));
      }
    }
    peligroAnterior = tipo;
  }

  return {
    /** La fila i. Las de abajo de la largada son vereda; las olvidadas no vuelven. */
    fila(i) {
      if (i < olvidadasHasta) return vacia(i);
      while (siguiente <= i) bloque();
      return filas.get(i);
    },
    /** Olvida las filas por debajo de esta: el mundo no crece sin fin en memoria. */
    olvidar(debajo) {
      for (let k = olvidadasHasta; k < Math.min(debajo, siguiente); k++) filas.delete(k);
      olvidadasHasta = Math.max(olvidadasHasta, Math.min(debajo, siguiente));
    }
  };
}
```

- [ ] **Paso 4: ver que pasa**

Run: `node --test tests/web/cruza-mundo.test.mjs`
Expected: PASS, 18 tests, en menos de un segundo. Si el del reparto falla, **no se aflojan
los márgenes**: se imprime lo medido y se reporta. Es una decisión del usuario (spec §3.3).

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/cruza/mundo.js tests/web/cruza-mundo.test.mjs
git commit -m "Cruza, Mono: el mundo sin fin, con semilla y sin bolsillos"
```

---

### Task 5 · El motor

**Files:**
- Create: `wwwroot/js/juegos/cruza/motor.js`
- Test: `tests/web/cruza-motor.test.mjs`

**Interfaces:**
- Consumes: `reglas.js` (Task 3); `crearMundo`, `esSegura` de `mundo.js` (Task 4).
- Produces: `crearPartida(semilla, { mundo }?)` → la partida, un objeto que el motor cambia en
  su lugar:

  | Campo | Qué es |
  |---|---|
  | `mundo` | el mundo |
  | `estado` | `jugando` o `fin` |
  | `t` | el tiempo del tránsito en ms; se congela en el golpe |
  | `reloj` | el tiempo total en ms |
  | `fila`, `x` | dónde está el mono; `x` es el borde izquierdo, en px |
  | `vista` | `atras`, `frente`, `izq` o `der` |
  | `salto` | `{ f0, x0, f1, x1, desde }`, o `null` |
  | `cola` | el paso guardado, o `null` |
  | `enTronco` | el índice del tronco, o `null` |
  | `cam` | la fila del borde de abajo, con decimales |
  | `vidas`, `maxFila`, `cajas` | lo que cuenta |
  | `tomadas` | un `Set` de `'fila:col'`, y `'fila:t'` para la caja de un tronco |
  | `golpe` | `{ desde, motivo }`, o `null` |
  | `invulnerableHasta` | hasta cuándo no lo golpean los vehículos |
  | `ultimaSegura` | la última fila segura en la que estuvo |

  Las funciones:
  - `pedirPaso(p, 'arr' | 'aba' | 'izq' | 'der') : boolean`;
  - `avanzar(p, dtMs) : [{ tipo: 'aterrizo' | 'caja' | 'golpe' | 'reaparece' | 'fin', motivo? }]`,
    con `motivo` ∈ `calle | agua | borde | grua`;
  - `puntaje(p)`;
  - `xDelMono(p)`;
  - `avanceDelSalto(p)` (0 a 1);
  - `xVehiculo(fila, x0, tMs)`, `xTronco(fila, x0, tMs)`, `choca(fila, xMono, tMs)` y
    `troncoBajo(fila, xMono, tMs)`.

  **Los dibujos ubican vehículos y troncos con `xVehiculo` y `xTronco`**, así lo que se ve es
  lo que choca.

- [ ] **Paso 1: el test que falla** — `tests/web/cruza-motor.test.mjs`:

```js
/**
 * El motor de CRUZÁ, MONO (spec §5), sobre mundos armados a mano: cada fila dice
 * exactamente qué hay, así cada regla se prueba sola.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPartida, pedirPaso, avanzar, puntaje, xDelMono, xVehiculo, xTronco, choca, troncoBajo } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/motor.js';
import { CEL, PASO_MS, GOLPE_MS, INVULNERABLE_MS, AFUERA } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

const vereda = (i, bloq = [], cajas = []) => ({ t: 'vereda', i, obst: [], bloq: new Set(bloq), cajas });
const calle = (i, veh, { dir = 1, vel = 0 } = {}) => ({ t: 'calle', i, clase: 'autos', dir, vel, veh, bloq: new Set(), cajas: [] });
const rio = (i, xs, { dir = 1, vel = 0, n = 3, cajaEn = -1 } = {}) => ({ t: 'rio', i, dir, vel, n, xs, P: 15 * CEL, cajaEn, bloq: new Set(), cajas: [] });

/** Un mundo a mano: las filas que se den, y vereda libre en todas las demás. */
function mundo(filas = {}) {
  return { fila: (i) => filas[i] ?? (filas[i] = vereda(i)), olvidar() {} };
}
const partida = (filas) => crearPartida(1, { mundo: mundo(filas) });
/** Avanza en pasos de 10 ms, como la vista, y junta los eventos. */
function correr(p, ms) {
  const ev = [];
  for (let t = 0; t < ms; t += 10) ev.push(...avanzar(p, 10));
  return ev;
}
const tipos = (ev) => ev.map((e) => e.tipo);
/** Avanza de a 10 ms hasta que pase un evento de ese tipo. */
function hasta(p, tipo) {
  for (let k = 0; k < 1000; k++) if (avanzar(p, 10).some((e) => e.tipo === tipo)) return;
  assert.fail(`no hubo ${tipo}`);
}
/** Un auto parado justo encima de la columna 4. */
const autoEnLa4 = () => [['torino', AFUERA + 4 * CEL - 10]];

test('la partida arranca en la fila 0, columna 4, con 3 vidas y 0 puntos', () => {
  const p = partida();
  assert.equal(p.fila, 0);
  assert.equal(p.x, 4 * CEL);
  assert.equal(p.vidas, 3);
  assert.equal(puntaje(p), 0);
});

test('un paso adelante tarda 140 ms y suma 10', () => {
  const p = partida();
  assert.equal(pedirPaso(p, 'arr'), true);
  correr(p, PASO_MS - 10);
  assert.equal(p.fila, 0);
  assert.ok(p.salto);
  const ev = correr(p, 10);
  assert.deepEqual(tipos(ev), ['aterrizo']);
  assert.equal(p.fila, 1);
  assert.equal(puntaje(p), 10);
});

test('un obstáculo o un borde bloquean, y no cuestan nada', () => {
  const p = partida({ 1: vereda(1, [4]) });
  assert.equal(pedirPaso(p, 'arr'), false);
  assert.equal(pedirPaso(p, 'aba'), false, 'debajo de la largada no hay nada');
  assert.equal(p.salto, null);
  p.x = 0;
  assert.equal(pedirPaso(p, 'izq'), false);
  p.x = 8 * CEL;
  assert.equal(pedirPaso(p, 'der'), false);
  assert.equal(p.vidas, 3);
});

test('en medio del salto se guarda un solo paso, y sale al aterrizar', () => {
  const p = partida();
  pedirPaso(p, 'arr');
  pedirPaso(p, 'arr');
  pedirPaso(p, 'der');
  correr(p, 2 * PASO_MS);
  assert.equal(p.fila, 2);
  assert.equal(p.x, 4 * CEL, 'el tercer gesto se descartó');
});

test('ir y volver no suma: cuenta la fila más lejana', () => {
  const p = partida();
  for (const dir of ['arr', 'arr', 'aba', 'arr']) { pedirPaso(p, dir); correr(p, PASO_MS); }
  assert.equal(p.maxFila, 2);
  assert.equal(puntaje(p), 20);
});

test('la caja vale 50 y se levanta una sola vez', () => {
  const p = partida({ 1: vereda(1, [], [4]) });
  pedirPaso(p, 'arr');
  const ev = correr(p, PASO_MS);
  assert.ok(tipos(ev).includes('caja'));
  assert.equal(puntaje(p), 10 + 50);
  pedirPaso(p, 'aba'); correr(p, PASO_MS);
  pedirPaso(p, 'arr'); correr(p, PASO_MS);
  assert.equal(p.cajas, 1);
});

test('el tronco lleva al mono, y la caja de arriba del tronco también cuenta', () => {
  // Tronco de 3 celdas que a los 140 ms va de 87 a 159: el centro del mono (108) cae arriba.
  const p = partida({ 1: rio(1, [AFUERA + 84], { vel: 24, cajaEn: 0 }) });
  pedirPaso(p, 'arr');
  const ev = correr(p, PASO_MS);
  assert.deepEqual(tipos(ev).sort(), ['aterrizo', 'caja']);
  assert.equal(p.enTronco, 0);
  const antes = p.x;
  correr(p, 1000);
  assert.ok(Math.abs(p.x - (antes + 24)) < 0.01, `${p.x}`);
  assert.equal(p.vidas, 3);
});

test('caer al agua cuesta una vida', () => {
  const p = partida({ 1: rio(1, [0]) });
  pedirPaso(p, 'arr');
  const ev = correr(p, PASO_MS);
  assert.deepEqual(ev.filter((e) => e.tipo === 'golpe'), [{ tipo: 'golpe', motivo: 'agua' }]);
  assert.equal(p.vidas, 2);
});

test('el tronco que saca al mono del campo cuesta una vida', () => {
  // A 240 px/s el tronco se corre 34 px durante el salto: arranca más a la izquierda.
  const p = partida({ 1: rio(1, [AFUERA + 60], { vel: 240 }) });
  pedirPaso(p, 'arr');
  const ev = correr(p, 2000);
  assert.ok(ev.some((e) => e.tipo === 'golpe' && e.motivo === 'borde'));
});

test('un vehículo golpea también en medio del salto', () => {
  const p = partida({ 1: calle(1, autoEnLa4()) });
  pedirPaso(p, 'arr');
  const ev = correr(p, 80);
  assert.deepEqual(ev, [{ tipo: 'golpe', motivo: 'calle' }]);
  assert.equal(p.fila, 1, 'queda en la fila del golpe');
});

test('el golpe congela el mundo 0,9 s y el mono reaparece en la última fila segura, cerca de la columna 4', () => {
  const filas = { 2: calle(2, autoEnLa4()) };
  const p = partida(filas);
  pedirPaso(p, 'arr'); correr(p, PASO_MS);
  filas[1].bloq.add(4); // la columna 4 de esa vereda queda tapada: reaparece en la 5
  pedirPaso(p, 'arr');
  hasta(p, 'golpe');
  const t = p.t;
  correr(p, GOLPE_MS - 20);
  assert.equal(p.t, t, 'el tránsito no se movió');
  hasta(p, 'reaparece');
  assert.equal(p.fila, 1);
  assert.equal(p.x, 5 * CEL);
});

test('después de reaparecer el mono es invulnerable 1,5 s a los vehículos', () => {
  const p = partida({ 1: calle(1, [['torino', AFUERA + 3 * CEL]]) });
  // Golpe de costado: camina a la 3 por la fila 0 y sube.
  pedirPaso(p, 'izq'); correr(p, PASO_MS);
  pedirPaso(p, 'arr'); hasta(p, 'golpe');
  assert.equal(p.vidas, 2);
  hasta(p, 'reaparece');
  assert.equal(p.fila, 0, 'la fila 0 sigue a la vista');
  pedirPaso(p, 'arr');
  correr(p, INVULNERABLE_MS - 30);
  assert.equal(p.fila, 1);
  assert.equal(p.vidas, 2, 'todavía invulnerable');
  correr(p, 60);
  assert.equal(p.vidas, 1);
});

test('la grúa: si la cámara deja al mono abajo, pierde una vida', () => {
  const p = partida();
  pedirPaso(p, 'arr'); correr(p, PASO_MS);
  // Banda 0: la cámara sube una fila cada 4 s. A los 8 s el borde de abajo pasa la fila 1.
  const ev = correr(p, 8200);
  assert.ok(ev.some((e) => e.tipo === 'golpe' && e.motivo === 'grua'));
});

test('la cámara no se mueve hasta el primer paso adelante, sigue al mono y nunca baja', () => {
  const p = partida();
  correr(p, 5000);
  assert.equal(p.cam, 0);
  for (let k = 0; k < 10; k++) { pedirPaso(p, 'arr'); correr(p, PASO_MS); }
  assert.ok(p.cam >= 10 - 6, `${p.cam}`);
  const cam = p.cam;
  pedirPaso(p, 'aba'); correr(p, PASO_MS);
  assert.ok(p.cam >= cam);
});

test('sin vidas, el fin', () => {
  const p = partida({ 1: calle(1, autoEnLa4()) });
  for (let k = 0; k < 2; k++) {
    pedirPaso(p, 'arr'); hasta(p, 'golpe');
    hasta(p, 'reaparece'); correr(p, INVULNERABLE_MS);
  }
  pedirPaso(p, 'arr'); hasta(p, 'golpe');
  assert.equal(p.vidas, 0);
  assert.equal(p.estado, 'jugando', 'el último golpe también dura 0,9 s');
  hasta(p, 'fin');
  assert.equal(p.estado, 'fin');
  assert.equal(pedirPaso(p, 'arr'), false);
  assert.deepEqual(avanzar(p, 100), []);
});

test('las posiciones del tránsito dan la vuelta por el lazo', () => {
  const f = { dir: 1, vel: 24, P: 15 * CEL };
  assert.equal(xVehiculo(f, AFUERA, 0), 0);
  assert.equal(xVehiculo(f, AFUERA, 1000), 24);
  assert.equal(xVehiculo({ ...f, dir: -1 }, AFUERA, 1000), -24);
  assert.equal(xVehiculo(f, AFUERA, 15000), 14, 'dio la vuelta: 360 px en un lazo de 346');
  assert.equal(xTronco(f, AFUERA, 0), 0);
  assert.equal(choca(calle(0, autoEnLa4()), 4 * CEL, 0), true);
  assert.equal(choca(calle(0, autoEnLa4()), 7 * CEL, 0), false);
  assert.equal(troncoBajo(rio(0, [AFUERA]), 0, 0), 0);
  assert.equal(troncoBajo(rio(0, [AFUERA]), 5 * CEL, 0), -1);
  assert.equal(xDelMono(crearPartida(1)), 4 * CEL);
});
```

- [ ] **Paso 2: ver que falla**

Run: `node --test tests/web/cruza-motor.test.mjs`
Expected: FAIL, `Cannot find module …/cruza/motor.js`.

- [ ] **Paso 3: el motor** — `wwwroot/js/juegos/cruza/motor.js`:

```js
/**
 * El motor de CRUZA, MONO (spec §5): pasos, camara, colisiones, vidas y puntos.
 *
 * Puro: sin reloj ni pantalla. La vista le pasa el tiempo (`avanzar(p, dt)`, en
 * milisegundos) y los gestos (`pedirPaso`); el motor cambia la partida y devuelve
 * lo que paso, para que la vista vibre y dibuje. El mundo se inyecta, asi los
 * tests arman el suyo a mano.
 *
 * Las posiciones van en pixeles del campo: `x` es el borde izquierdo del mono, una
 * celda de 24. El tiempo del transito (`t`) se congela durante el golpe; el
 * `reloj` no.
 */

import {
  CEL, COLUMNAS, ANCHO, LAZO, AFUERA, PASO_MS, VIDAS, GOLPE_MS, INVULNERABLE_MS,
  COLUMNA_DE_LARGADA, MONO_MAX_DESDE_ABAJO, OLVIDAR_DEBAJO, largoDe, banda, puntos
} from './reglas.js';
import { crearMundo, esSegura } from './mundo.js';

const mod = (a, b) => ((a % b) + b) % b;
const lerp = (a, b, f) => a + (b - a) * f;

/** Donde esta un vehiculo de la fila en el tiempo t: su borde izquierdo. */
export const xVehiculo = (f, x0, t) => mod(x0 + (f.dir * f.vel * t) / 1000, LAZO) - AFUERA;
/** Donde esta un tronco del rio en el tiempo t. */
export const xTronco = (f, x0, t) => mod(x0 + (f.dir * f.vel * t) / 1000, f.P) - AFUERA;

/**
 * Si un vehiculo toca al mono. La caja de golpe del mono es de 16 x 18, centrada
 * en su celda; la del vehiculo, su largo menos 3 pixeles en cada punta.
 */
export function choca(f, xm, t) {
  if (f.t !== 'calle') return false;
  return f.veh.some(([m, x0]) => {
    const xv = xVehiculo(f, x0, t);
    return xm + 4 < xv + largoDe(m) - 3 && xm + 20 > xv + 3;
  });
}

/** El tronco que tiene abajo el centro del mono, o -1 si es agua. */
export function troncoBajo(f, xm, t) {
  const cx = xm + CEL / 2;
  for (let j = 0; j < f.xs.length; j++) {
    const xt = xTronco(f, f.xs[j], t);
    if (cx >= xt + 2 && cx <= xt + f.n * CEL - 2) return j;
  }
  return -1;
}

const MOVIDAS = { arr: [1, 0], aba: [-1, 0], izq: [0, -1], der: [0, 1] };
const VISTAS = { arr: 'atras', aba: 'frente', izq: 'izq', der: 'der' };

export function crearPartida(semilla, { mundo = crearMundo(semilla) } = {}) {
  return {
    mundo, estado: 'jugando',
    t: 0, reloj: 0,
    fila: 0, x: COLUMNA_DE_LARGADA * CEL, vista: 'atras',
    salto: null, cola: null, enTronco: null,
    cam: 0, vidas: VIDAS, maxFila: 0, cajas: 0, tomadas: new Set(),
    golpe: null, invulnerableHasta: 0, ultimaSegura: 0
  };
}

/** SCORE = 10 x la fila mas lejana + 50 x las cajas: ir y volver no suma. */
export const puntaje = (p) => puntos(p.maxFila, p.cajas);

/** Donde esta el mono ahora, tambien en medio del salto. */
export const xDelMono = (p) => (p.salto ? lerp(p.salto.x0, p.salto.x1, Math.min(1, (p.t - p.salto.desde) / PASO_MS)) : p.x);
/** Cuanto lleva el salto, de 0 a 1, o 0 si esta quieto. */
export const avanceDelSalto = (p) => (p.salto ? Math.min(1, (p.t - p.salto.desde) / PASO_MS) : 0);

function destino(p, dir) {
  const [df, dc] = MOVIDAS[dir];
  // De costado sobre un tronco se mueve en pixeles; si no, cae en la columna mas cercana.
  const x = p.enTronco !== null && df === 0 ? p.x + dc * CEL : Math.round((p.x + dc * CEL) / CEL) * CEL;
  return { fila: p.fila + df, x };
}

function bloqueado(p, d) {
  if (d.fila < 0 || d.x < 0 || d.x > (COLUMNAS - 1) * CEL) return true;
  const f = p.mundo.fila(d.fila);
  return f.t !== 'rio' && f.bloq.has(Math.round(d.x / CEL));
}

function saltar(p, dir) {
  p.vista = VISTAS[dir];
  const d = destino(p, dir);
  if (bloqueado(p, d)) return false;
  p.salto = { f0: p.fila, x0: p.x, f1: d.fila, x1: d.x, desde: p.t };
  p.enTronco = null;
  return true;
}

/**
 * Un gesto. Quieto, salta (si no hay obstaculo ni borde: bloqueado no cuesta nada).
 * En medio de un salto guarda uno solo, que sale al aterrizar; los demas se
 * descartan. Devuelve si salto ya.
 */
export function pedirPaso(p, dir) {
  if (!MOVIDAS[dir] || p.estado !== 'jugando' || p.golpe) return false;
  if (p.salto) {
    if (p.cola === null) p.cola = dir;
    return false;
  }
  return saltar(p, dir);
}

function golpear(p, motivo, ev) {
  if (p.salto) { p.x = xDelMono(p); p.fila = p.salto.f1; }
  p.vidas--;
  p.golpe = { desde: p.reloj, motivo };
  p.salto = null;
  p.cola = null;
  p.enTronco = null;
  ev.push({ tipo: 'golpe', motivo });
}

function tomar(p, clave, ev) {
  if (p.tomadas.has(clave)) return;
  p.tomadas.add(clave);
  p.cajas++;
  ev.push({ tipo: 'caja' });
}

function aterrizar(p, ev) {
  const s = p.salto;
  p.salto = null;
  p.fila = s.f1;
  p.x = s.x1;
  const f = p.mundo.fila(p.fila);
  if (f.t === 'rio') {
    const j = troncoBajo(f, p.x, p.t);
    if (j < 0) { golpear(p, 'agua', ev); return; }
    p.enTronco = j;
    if (f.cajaEn === j) tomar(p, p.fila + ':t', ev);
  } else {
    p.x = Math.round(p.x / CEL) * CEL;
    const col = p.x / CEL;
    if (f.cajas.includes(col)) tomar(p, p.fila + ':' + col, ev);
    if (esSegura(f)) p.ultimaSegura = p.fila;
  }
  if (p.fila > p.maxFila) p.maxFila = p.fila;
  ev.push({ tipo: 'aterrizo' });
  if (p.cola) {
    const dir = p.cola;
    p.cola = null;
    saltar(p, dir);
  }
}

/**
 * Despues del golpe: en la ultima fila segura en la que estuvo —o la primera
 * segura entera a la vista, si esa quedo abajo de la camara— y en la columna libre
 * mas cercana a la de largada. Sin vidas, el fin.
 */
function reaparecer(p, ev) {
  p.golpe = null;
  if (p.vidas <= 0) {
    p.estado = 'fin';
    ev.push({ tipo: 'fin' });
    return;
  }
  let fila = Math.max(p.ultimaSegura, Math.ceil(p.cam));
  while (!esSegura(p.mundo.fila(fila))) fila++;
  const f = p.mundo.fila(fila);
  const col = [0, 1, -1, 2, -2, 3, -3, 4, -4]
    .map((d) => COLUMNA_DE_LARGADA + d)
    .find((c) => c >= 0 && c < COLUMNAS && !f.bloq.has(c));
  Object.assign(p, { fila, x: col * CEL, vista: 'atras', ultimaSegura: fila, invulnerableHasta: p.reloj + INVULNERABLE_MS });
  ev.push({ tipo: 'reaparece' });
}

/**
 * Avanza la partida dt milisegundos. Devuelve los eventos: aterrizo, caja,
 * golpe (con su motivo: calle, agua, borde o grua), reaparece y fin.
 *
 * La invulnerabilidad despues de reaparecer protege de los vehiculos; el agua, el
 * borde y la grua no perdonan, porque dejarlos pasar dejaria al mono parado
 * sobre el agua.
 */
export function avanzar(p, dt) {
  const ev = [];
  if (p.estado !== 'jugando') return ev;
  p.reloj += dt;

  if (p.golpe) {
    if (p.reloj - p.golpe.desde >= GOLPE_MS) reaparecer(p, ev);
    return ev;
  }

  p.t += dt;
  if (p.salto) {
    if (p.t - p.salto.desde >= PASO_MS) aterrizar(p, ev);
  } else if (p.enTronco !== null) {
    const f = p.mundo.fila(p.fila);
    p.x += (f.dir * f.vel * dt) / 1000;
    if (p.x + CEL / 2 < 0 || p.x + CEL / 2 > ANCHO) golpear(p, 'borde', ev);
  }
  if (p.golpe) return ev;

  // La camara sube sola desde el primer paso adelante, sigue al mono y nunca baja.
  if (p.maxFila > 0) p.cam += dt / (banda(p.maxFila).camara * 1000);
  p.cam = Math.max(p.cam, p.fila - MONO_MAX_DESDE_ABAJO);
  p.mundo.olvidar(Math.floor(p.cam) - OLVIDAR_DEBAJO);

  if (!p.salto && p.fila < Math.floor(p.cam)) {
    golpear(p, 'grua', ev);
    return ev;
  }

  const f = p.mundo.fila(p.salto ? p.salto.f1 : p.fila);
  if (p.reloj >= p.invulnerableHasta && choca(f, xDelMono(p), p.t)) golpear(p, 'calle', ev);
  return ev;
}
```

- [ ] **Paso 4: ver que pasa**

Run: `node --test tests/web/cruza-motor.test.mjs`
Expected: PASS, 16 tests.

- [ ] **Paso 5: una prueba de humo, sin commitear** — 300 partidas con gestos al azar sobre el
  mundo de verdad no tienen que tirar ninguna excepción:

```bash
node --input-type=module -e "import { crearPartida, pedirPaso, avanzar } from './src/TruckNavigator.Api/wwwroot/js/juegos/cruza/motor.js'; for (let s = 1; s <= 300; s++) { const p = crearPartida(s); for (let ms = 0; p.estado === 'jugando' && ms < 600000; ms += 1000 / 60) { if (Math.random() < 0.08) pedirPaso(p, ['arr', 'arr', 'arr', 'izq', 'der', 'aba'][Math.floor(Math.random() * 6)]); avanzar(p, 1000 / 60); } } console.log('ok');"
```

Expected: `ok`.

- [ ] **Paso 6: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/cruza/motor.js tests/web/cruza-motor.test.mjs
git commit -m "Cruza, Mono: el motor, puro: pasos, camara, choques, vidas y puntos"
```

---

### Task 6 · La fuente y los sprites

**Files:**
- Modify: `wwwroot/js/juegos/viborita/dibujos.js` (tres glifos y `rotulo`)
- Modify: `wwwroot/js/views/viborita.js` (importa `rotulo` en vez de definirlo)
- Create: `wwwroot/js/juegos/cruza/sprites.js`
- Test: `tests/web/viborita-dibujos.test.mjs` (suma un test), `tests/web/cruza-sprites.test.mjs`

**Interfaces:**
- Consumes: `FUENTE`, `anchoDeTexto` de `viborita/dibujos.js`; `ANCHO` de `reglas.js`.
- Produces:
  - **`dibujos.js`:** `rotulo(texto, color, k = 2) : string`, el SVG que hoy está en
    `views/viborita.js`, movido tal cual.
  - **`sprites.js`, las ayudas:**
    - `CONTORNO` (`'#170c16'`), `mod`, `lerp`, `px(c, x, y, w, h, col)`, `semilla(n)`;
    - `brillo(c, x0, y0, w, h, t, periodo = 3, color)` y `humo(c, xs, ys, dir, t, fase, tono)`;
    - `lienzo(w, h) : HTMLCanvasElement`, la única fábrica de lienzos: crea con
      `document.createElement` y deja `imageSmoothingEnabled = false`.
  - **`sprites.js`, el texto:**
    - `texto(c, s, x, y, color, k = 1)`, donde `color` puede ser un arreglo de 7, un degradé por
      fila;
    - `ancho(s, k = 1)`;
    - `centro(c, s, y, color, k = 1)`, centrado en `ANCHO`;
    - `centroEn(c, s, x, w, y, color)`;
    - `letrasFilete(c, s, x, y, k, relleno, contorno, luz = '#ffffff')`.
  - **`sprites.js`, los colores:** `CROMO7`, `CELESTE7`, `BLANCO7`, `VIOLETA7` y
    `DEGRADE_VIOLETA`.
  - **`sprites.js`, los dibujos:**
    - `SOL`, `VOLUTA`, `solCol` y `estampa(c, filas, x, y, colores, voltear = false)`;
    - `PAL` y `GRIS`;
    - `MONO_ATRAS`, `MONO_FRENTE`, `MONO_PARPADEO`, `MONO_LADO` y `MONO_GOLPE`;
    - `GORRA`, `CABEZA`, `CABEZA_GUINO` y `CAJA`;
    - `hoja(filas, pal = PAL) : HTMLCanvasElement` y
      `pegar(c, filas, x, y, { pal, voltear, k, alto })`.

- [ ] **Paso 1: los tests que fallan.** En `tests/web/viborita-dibujos.test.mjs`, sumar
  `rotulo` al `import` de `dibujos.js` y este test al final:

```js
test('la fuente trae los signos de CRUZÁ, MONO: el guion, el más y la coma', () => {
  assert.deepEqual(FUENTE['-'], ['.....', '.....', '.....', '#####', '.....', '.....', '.....']);
  assert.deepEqual(FUENTE['+'], ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....']);
  assert.deepEqual(FUENTE[','], ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...']);
  assert.deepEqual(faltantes('HI-SCORE +50 CRUZÁ, MONO'), []);
});

test('rotulo arma un SVG de la fuente de píxel, con un rectángulo por píxel', () => {
  const svg = rotulo('< SALIR', '#9aa6b8');
  assert.match(svg, /^<svg viewBox="0 0 82 14" width="82" height="14"/);
  assert.match(svg, /aria-label="< SALIR"/);
  assert.equal((svg.match(/<rect /g) ?? []).length, 80);
});
```

  `tests/web/cruza-sprites.test.mjs`:

```js
/**
 * Los sprites de CRUZÁ, MONO, portados del prototipo aprobado
 * (docs/diseno/prototipo-cruza/sprites.js): el mono de 24 × 24, las cabezas del HUD,
 * la gorra y la caja. Sin lienzo: se prueban las grillas y la paleta.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as S from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/sprites.js';

const MEDIDAS = {
  MONO_ATRAS: [24, 24], MONO_FRENTE: [24, 24], MONO_PARPADEO: [24, 24], MONO_LADO: [24, 24], MONO_GOLPE: [24, 24],
  GORRA: [4, 10], CABEZA: [12, 12], CABEZA_GUINO: [12, 12], CAJA: [14, 16]
};

test('cada sprite mide lo del prototipo, con todas sus filas del mismo largo', () => {
  for (const [nombre, [alto, ancho]] of Object.entries(MEDIDAS)) {
    assert.equal(S[nombre].length, alto, nombre);
    for (const fila of S[nombre]) assert.equal(fila.length, ancho, nombre);
  }
});

test('ningún píxel de un sprite queda sin color', () => {
  for (const nombre of Object.keys(MEDIDAS)) {
    const sin = [...new Set(S[nombre].join('').replace(/\./g, ''))].filter((ch) => !(ch in S.PAL));
    assert.deepEqual(sin, [], nombre);
  }
});

test('la vida perdida es la misma cabeza en gris', () => {
  assert.deepEqual(Object.keys(S.GRIS).sort(), Object.keys(S.PAL).sort());
  assert.ok(Object.values(S.GRIS).every((c) => c === '#2b313b'));
});

test('el texto mide seis píxeles por letra, sin el último espacio', () => {
  assert.equal(S.ancho('SCORE'), 29);
  assert.equal(S.ancho('HI-SCORE', 2), 94);
});
```

- [ ] **Paso 2: ver que fallan**

Run: `node --test tests/web/viborita-dibujos.test.mjs tests/web/cruza-sprites.test.mjs`
Expected: FAIL, falta `rotulo`, faltan los glifos y no existe `sprites.js`.

- [ ] **Paso 3: la fuente.** En `FUENTE` de `dibujos.js`, después de `'<'`:

```js
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
```

  Mover `rotulo` de `views/viborita.js` a `dibujos.js` tal cual, con `export` y su comentario,
  y en `views/viborita.js` importarlo (`import { rotulo } from '../juegos/viborita/dibujos.js';`)
  y sacar `FUENTE, anchoDeTexto` del import si quedan sin uso.

- [ ] **Paso 4: `sprites.js`, portado.** Cabecera:

```js
/**
 * Los sprites de CRUZA, MONO y las ayudas de dibujo (spec §4.1).
 *
 * Portados del prototipo aprobado (docs/diseno/prototipo-cruza/sprites.js y el
 * principio de escena.js), pixel por pixel: no se redibujan. La fuente es la 5 x 7
 * de la Viborita, con los glifos que suma esta etapa. Nada de esto toca el
 * documento al importarse: los lienzos se crean al primer uso.
 */

import { FUENTE, anchoDeTexto } from '../viborita/dibujos.js';
import { ANCHO } from './reglas.js';
```

  | Qué | De dónde | Cambios |
  |---|---|---|
  | `mod`, `lerp`, `px`, `semilla`, `brillo`, `humo`, `letrasFilete` | `escena.js` l. 3–32 | `export`. `CEL`, `W`, `HUD`, `FILAS` y `H` (l. 2) no se portan: salen de `reglas.js` |
  | `CELESTE7`, `BLANCO7`, `VIOLETA7` | `escena.js` l. 33–35 | `export` |
  | `SOL`, `VOLUTA`, `estampa`, `solCol` | `escena.js` l. 38–43 | `export`; `VOLUTA` la usan los colectivos (l. 210–211) |
  | `CONTORNO` | `escena.js` l. 49 | `export` |
  | `DEGRADE_VIOLETA` | `escena.js` l. 684 | `export` |
  | `texto`, `ancho`, `centro`, `CROMO7` | `sprites.js` l. 33–45 | `texto` lee `FUENTE`, no `F`, y la letra que falta cae en `FUENTE[' ']`. `ancho = (s, k = 1) => anchoDeTexto(s, k)`. `centro(c, s, y, color, k = 1)` centra en `ANCHO`: se va el parámetro `W`, y las llamadas portadas `centro(c, s, y, col, W, k)` pasan a `centro(c, s, y, col, k)` |
  | `centroEn` | `escena.js` l. 811 | `export` |
  | `PAL`, `GRIS`, `MONO_*`, `GORRA`, `CABEZA`, `CAJA` | `sprites.js` l. 48–86 | `export`. `CABEZA_GUIÑO` se renombra `CABEZA_GUINO` |
  | `hoja`, `pegar` | `sprites.js` l. 87–103 | `export`. `hoja` crea el lienzo con `lienzo(w, h)` |

  `lienzo` es nuevo:

```js
/** La unica fabrica de lienzos: sin suavizado, para que el pixel quede pixel. */
export function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').imageSmoothingEnabled = false;
  return cv;
}
```

- [ ] **Paso 5: ver que pasan**

Run: `node --test "tests/web/*.test.mjs"`
Expected: PASS todo, los de la Viborita incluidos (su vista sigue igual).

- [ ] **Paso 6: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js src/TruckNavigator.Api/wwwroot/js/views/viborita.js src/TruckNavigator.Api/wwwroot/js/juegos/cruza/sprites.js tests/web/viborita-dibujos.test.mjs tests/web/cruza-sprites.test.mjs
git commit -m "Cruza, Mono: la fuente suma el guion, el mas y la coma, y los sprites del mono"
```

---

### Task 7 · Los vehículos

**Files:**
- Create: `wwwroot/js/juegos/cruza/vehiculos.js`
- Test: `tests/web/cruza-vehiculos.test.mjs`

**Interfaces:**
- Consumes: `px`, `mod`, `lerp`, `semilla`, `brillo`, `humo`, `texto`, `letrasFilete`, `estampa`,
  `SOL`, `VOLUTA`, `solCol`, `CELESTE7`, `BLANCO7`, `CONTORNO`, `lienzo`, `pegar`, `CABEZA` de
  `sprites.js`; `CEL` de `reglas.js`.
- Produces: `MODELOS` (los 21 modelos, cada uno `{ L, H, arriba, ruedas, pal, pintar, extra? }`),
  `construir(L, H, pintar) : (string|null)[][]`, `renderizar(grilla, pal) : HTMLCanvasElement`,
  `vehiculo(c, nombre, x, y, dir, t, vel = 30)`.

- [ ] **Paso 1: el test que falla** — `tests/web/cruza-vehiculos.test.mjs`:

```js
/**
 * Los vehículos de CRUZÁ, MONO, portados del rasterizador de siluetas del prototipo:
 * cada modelo es una grilla de partes que recibe luz, sombra y contorno. Sin lienzo:
 * se arma la grilla y se mira que cada parte tenga color y cada rueda quepa.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MODELOS, construir } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/vehiculos.js';
import { AUTOS, FLOTA, LINEAS, largoDe } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

const QUE_SALEN = [...AUTOS, ...FLOTA.map((p) => 'tbf-' + p), ...LINEAS.map((l) => 'colectivo-' + l)];

test('están los 21 modelos: los que salen a la calle y el colectivo de muestra', () => {
  assert.equal(Object.keys(MODELOS).length, 21);
  for (const nombre of QUE_SALEN) assert.ok(MODELOS[nombre], nombre);
});

test('cada modelo mide lo que el motor usa para chocar', () => {
  for (const nombre of QUE_SALEN) assert.equal(MODELOS[nombre].L, largoDe(nombre), nombre);
});

test('cada modelo se arma, sin partes sin color', () => {
  for (const [nombre, d] of Object.entries(MODELOS)) {
    const g = construir(d.L, d.H, d.pintar);
    assert.equal(g.length, d.H, nombre);
    assert.ok(g.every((fila) => fila.length === d.L), nombre);
    const partes = new Set(g.flat().filter(Boolean));
    assert.ok(partes.size > 0, nombre);
    assert.deepEqual([...partes].filter((p) => !d.pal[p]), [], nombre);
  }
});

test('las ruedas quedan adentro del vehículo', () => {
  for (const [nombre, d] of Object.entries(MODELOS)) {
    for (const [x, y, r] of d.ruedas) {
      assert.ok(x - r >= 0 && x + r <= d.L && y + r <= d.H, `${nombre}: rueda en ${x},${y}`);
    }
  }
});
```

- [ ] **Paso 2: ver que falla**

Run: `node --test tests/web/cruza-vehiculos.test.mjs`
Expected: FAIL, no existe `vehiculos.js`.

- [ ] **Paso 3: `vehiculos.js`, portado** de `escena.js` l. 45–286, con este cambio:
  - `CONTORNO` se importa de `sprites.js` en vez de definirse;
  - `renderizar` crea su lienzo con `lienzo(L + 2, H + 2)` en vez de `document.createElement`;
  - `MODELOS`, `construir`, `renderizar` y `vehiculo` llevan `export`.

  Lo demás queda tal cual: `modelo`, `imagenDe` (que sigue armando el lienzo al primer uso),
  `aLienzo`, `rueda`, las paletas (`VIDRIO`, `CROMO`, `NEGRO`, `PLAST`, `NARANJA`, `AZUL7`,
  `AMARILLO7`), `mezcla`, `tonos`, `LINEAS`, `LIBREAS`, `sedan504` y los 21 `modelo(...)`. El
  objeto `LINEAS` del prototipo choca con el `LINEAS` de `reglas.js` si se importa: no se
  importa. Cabecera:

```js
/**
 * Los vehiculos de CRUZA, MONO (spec §4.2): el rasterizador de siluetas y los
 * modelos, portados del prototipo aprobado (docs/diseno/prototipo-cruza/escena.js).
 *
 * Cada vehiculo es una grilla de partes (pintura, techo, vidrio, cromo, faros); cada
 * pixel toma luz si arriba hay otra parte y sombra si abajo, y el vacio que toca la
 * silueta es contorno. El lienzo de cada modelo se arma una vez, al primer uso. Lo
 * que no se espeja (el logo TBF, el sol, la cara del mono, el numero de linea) se
 * dibuja aparte en `extra`.
 */
```

- [ ] **Paso 4: ver que pasa**

Run: `node --test tests/web/cruza-vehiculos.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/cruza/vehiculos.js tests/web/cruza-vehiculos.test.mjs
git commit -m "Cruza, Mono: el rasterizador de siluetas y los 21 vehiculos"
```

---

### Task 8 · El escenario y el caché por fila

**Files:**
- Create: `wwwroot/js/juegos/cruza/escenario.js`
- Test: `tests/web/cruza-escenario.test.mjs`

**Interfaces:**
- Consumes: `sprites.js` (Task 6); `vehiculo` de `vehiculos.js` (Task 7); `CEL`, `ANCHO` de
  `reglas.js`. No importa el motor: las posiciones del tránsito le llegan por parámetro.
- Produces:
  - **los pisos:**
    - `pisoBase(c, fila, y, arriba, abajo)` dibuja lo quieto de una fila. `arriba` y `abajo`
      son los `t` de las vecinas, y `fila` es la fila del mundo;
    - `pisoVivo(c, fila, y, t)` dibuja lo que se mueve: las florcitas de la plaza, el número
      del playón y las crestas del río;
    - `crearCacheDePisos() : { dibujar(c, fila, y, arriba, abajo), olvidar(debajo) }`;
  - **lo que hay en una fila:**
    - `cosasDeFila(c, fila, y, t, { tomadas, xVehiculo, xTronco, tMs })` dibuja conventillos,
      galpones, carteles, obstáculos, cajas, troncos y vehículos;
  - **el mono:** `mono(c, x, y, t, { vista, salto, alto, invisible })`, `estrellas`,
    `chapuzon`, `cajaTBF` y `tronco`;
  - **la letra gruesa:** `GRUESA`, `anchoGruesa(s)` y `pixelesGruesa(s, x, y)`;
  - **los carteles:** `chapaFilete`, `senalRed` y `neon`, todos `(c, x, y, t, pared)`.

- [ ] **Paso 1: el test que falla** — `tests/web/cruza-escenario.test.mjs`:

```js
/**
 * El escenario de CRUZÁ, MONO: la letra gruesa de los carteles (spec §4.3), que tiene
 * que entrar en 3 celdas, y que ninguna leyenda caiga en un hueco.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GRUESA, anchoGruesa, pixelesGruesa } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/escenario.js';

const LEYENDAS = { 'EL MEJOR AMIGO': 64, 'DEL CAMIONERO': 62, 'RED DE TRÁNSITO': 66, PESADO: 29, 'TU GPS,': 28, 'BAJALA GRATIS': 59 };

test('la letra gruesa tiene cada letra de las tres leyendas', () => {
  for (const leyenda of Object.keys(LEYENDAS)) {
    const faltan = [...leyenda].filter((ch) => ch !== ' ' && !GRUESA[ch === 'Á' ? 'A' : ch]);
    assert.deepEqual(faltan, [], leyenda);
  }
});

test('las leyendas miden lo del prototipo y entran en un cartel de 72', () => {
  for (const [leyenda, ancho] of Object.entries(LEYENDAS)) {
    assert.equal(anchoGruesa(leyenda), ancho, leyenda);
    assert.ok(ancho <= 72 - 6, leyenda);
  }
});

test('la letra es angosta y gruesa: 4 × 7, la M y la N de 5, la I y la T de 3', () => {
  for (const [ch, g] of Object.entries(GRUESA)) {
    assert.equal(g.length, 7, ch);
    const ancho = g[0].length;
    if ('MN'.includes(ch)) assert.equal(ancho, 5, ch);
    else if ('IT'.includes(ch)) assert.equal(ancho, 3, ch);
    else if (ch === ',') assert.equal(ancho, 2);
    else if (ch === ' ') assert.equal(ancho, 1);
    else assert.equal(ancho, 4, ch);
  }
});

test('la Á lleva su acento arriba de la A', () => {
  const a = pixelesGruesa('A', 0, 10), aa = pixelesGruesa('Á', 0, 10);
  assert.equal(aa.length, a.length + 2);
  assert.ok(aa.some(([, y]) => y < 10));
});
```

- [ ] **Paso 2: ver que falla**

Run: `node --test tests/web/cruza-escenario.test.mjs`
Expected: FAIL, no existe `escenario.js`.

- [ ] **Paso 3: `escenario.js`, portado.** Cabecera:

```js
/**
 * El escenario de CRUZA, MONO (spec §2.2 y §4): el piso, el barrio, los galpones y los
 * conventillos, la letra gruesa y los tres carteles de la app, el mono animado, los
 * troncos y la caja. Portado del prototipo aprobado
 * (docs/diseno/prototipo-cruza/escena.js), pixel por pixel.
 *
 * Rendimiento (spec §8): lo quieto de cada piso se dibuja una vez por fila en un
 * lienzo aparte y despues se copia entero; los arboles se guardan en sus dos
 * posiciones de vaiven. Cada cuadro solo dibuja lo que se mueve.
 */
```

  | Qué | De dónde (`escena.js`) | Cambios |
  |---|---|---|
  | `asfalto`, `vereda`, `plaza`, `playon`, `rio` | l. 287–347 | Se parten en base y vivo (abajo) |
  | `sombra`, `arbol`, `contenedor`, `banco`, `bolardo`, `mastil`, `chapa`, `COLORES_BOCA`, `conventillo`, `COLORES_GALPON`, `galpon` | l. 348–435 | `arbol` pasa por el caché de vaivén (abajo) |
  | `GRUESA`, `glifo`, `anchoGruesa`, `pixelesGruesa`, `letraFilete`, `letraFileteCentro`, `letraNeon`, `DORADO7`, `NIEVE7`, `chapaFilete`, `senalRed`, `neon` | l. 436–522 | `export` los de la interfaz. `RULO` no se usa y no se porta |
  | `sombraMono`, `cola`, `mono`, `estrellas`, `chapuzon`, `cajaTBF`, `tronco` | l. 523–584 | `export` |

  **El piso, partido.** `pisoBase(c, fila, y, arriba, abajo)` elige por `fila.t`:
  - `calle` → `asfalto(c, y, fila.i, arriba, abajo, fila)` entero;
  - `vereda`, `boca` y `galpones` → `vereda(c, y, fila.i, arriba, abajo, 0, fila)` entero;
  - `plaza` → `plaza` sin el bucle de las 10 florcitas (l. 324–327), que pasa a
    `florcitas(c, y, i, t)` con el mismo azar `semilla(i + 41)`. **Para que todo salga en el
    mismo lugar**, `florcitas` consume primero las 32 llamadas a `az()` de los 16 pastos
    (l. 323) y después dibuja las 10. La base, a su vez, consume las 20 llamadas de las
    florcitas sin dibujarlas antes de los 8 píxeles violetas (l. 328);
  - `playon` → `playon` sin la línea del número (l. 335);
  - `rio` → el fondo, la trama y las orillas de `rio` (l. 338–339 y 344–345), sin las crestas.

  `pisoVivo(c, fila, y, t)` dibuja lo que se mueve:
  - en la plaza, `florcitas`;
  - en el playón, el número (l. 335, con `numero = fila.numero`);
  - en el río, las 12 crestas (l. 340–343).

  **El caché.** `crearCacheDePisos()` guarda un lienzo de `ANCHO × CEL` por fila (`Map` por
  `fila.i`). Lo arma la primera vez con `pisoBase(cv, fila, 0, arriba, abajo)` y lo copia con
  `c.drawImage(cv, 0, y)`. `olvidar(debajo)` borra las filas de abajo, como el mundo.

  **Los árboles.** `arbol` dibuja dos cosas:
  - la copa y el tronco, que cambian sólo con `sway` (0 o 1) y `jac`;
  - las flores que caen, que se mueven con `t`.

  Se guarda un lienzo de 28 × 28 por cada `(jac, sway)`, con lo de las l. 352–366 (sombra,
  tronco y copa) dibujado con origen en `(2, 5)`. Al dibujar se copia en `(x - 2, y - 5)` y
  después van las flores (l. 367) en vivo. Como `px` redondea y el corrimiento es entero, cada
  píxel cae donde caía. **Hay que comparar contra el prototipo** en el navegador (Task 10):
  la copa no puede correrse ni un píxel.

  **El Obelisco** (fila 100) es nuevo: el prototipo lo dibuja en el inicio y no como obstáculo.
  Se porta la misma silueta en chico:

```js
/** El Obelisco del playon de la fila 100: una celda, dibujado alto (spec §3.2). */
function obelisco(c, x, y, t) {
  sombra(c, x + 4, y + 18, 16, 4);
  const cx = x + 12, base = y + 20;
  for (let k = 0; k < 64; k++) {
    const w = Math.round(lerp(10, 4, k / 64));
    px(c, cx - Math.floor(w / 2) - 1, base - k, w + 2, 1, CONTORNO);
    px(c, cx - Math.floor(w / 2), base - k, w, 1, k % 16 === 0 ? '#c9c2e6' : '#e8e4f4');
    px(c, cx + Math.ceil(w / 2) - 1, base - k, 1, 1, '#b3a9d9');
  }
  for (let k = 0; k < 5; k++) px(c, cx - Math.floor((5 - k) / 2), base - 64 - k, 5 - k, 1, '#e8e4f4');
  px(c, cx - 1, base - 58, 2, 2, Math.floor(t * 2) % 2 ? '#ffd27a' : '#8a7fc0');
}
```

  **`cosasDeFila`** es `cosas` (l. 633–657) con estos cambios:
  - **Vehículos y troncos se ubican con el motor**: `xVehiculo(fila, x0, tMs)` y
    `xTronco(fila, x0, tMs)`, en vez de `pos`, `P` y `k.P`. La l. 621–622 no se porta.
  - Las cajas del suelo se saltean si `tomadas.has(fila.i + ':' + col)`, y la del tronco si
    `tomadas.has(fila.i + ':t')`.
  - `que === 'obelisco'` llama a `obelisco`.
  - Los `murales` usan `chapaFilete`, `senalRed` y `neon` con `pared = true`, en `y - 17`, como
    en la l. 636.
  - La ramas `'banco'`, `'chapa'`, `'senal'` y `'neon'` de `obst` no se portan: el mundo ya no
    los pone como obstáculo.

- [ ] **Paso 4: ver que pasa**

Run: `node --test tests/web/cruza-escenario.test.mjs`
Expected: PASS, 4 tests. Y `node --check` del archivo, más buscar identificadores usados y
nunca declarados: `node --check` no lo detecta (trampa de `CLAUDE.md`).

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/cruza/escenario.js tests/web/cruza-escenario.test.mjs
git commit -m "Cruza, Mono: el barrio, los galpones y los carteles de la app, con un cache por fila"
```

---

### Task 9 · Las pantallas

**Files:**
- Create: `wwwroot/js/juegos/cruza/pantallas.js`
- Test: `tests/web/cruza-pantallas.test.mjs`

**Interfaces:**
- Consumes:
  - `sprites.js` y `escenario.js` (Tasks 6 y 8), y `vehiculo` de `vehiculos.js` (Task 7);
  - `puntaje`, `xVehiculo`, `xTronco`, `xDelMono`, `avanceDelSalto` de `motor.js` (Task 5);
  - `reglas.js`.
- Produces:
  - **el estado visual:**
    - `crearVisual() : { camara, marcador, particulas, reloj }`;
    - `actualizarVisual(vis, p, eventos, dtMs)`, que es puro. La cámara visible persigue a
      `p.cam`, el marcador cuenta hacia `puntaje(p)`, y los eventos crean partículas: `caja`
      da el "+50" y 14 chispas, y `aterrizo` fuera del río da 6 de polvo. Las vencidas se
      sacan. Los tiempos van en ms;
  - **el dibujo:**
    - `dibujarJuego(c, p, vis, t, { hi, quieto })`;
    - `dibujarPausa(c, p, vis, t, { hi })`;
    - `dibujarInicio(c, t, { hi, imagenes, quieto })`;
    - `dibujarFin(c, t, { score, hi, filas, cajas, nuevoRecord, guardado, imagenes, quieto })`;
  - **lo demás:**
    - `BOTONES` (`{ pausa: [...], fin: [...] }`, cada uno `{ accion, x, y, w, h }`) y
      `botonEn(lista, x, y) : accion | null`;
    - `TEXTOS` (cada texto fijo que se dibuja);
    - `tamanoDelCampo(anchoCss, altoCss, dpr) : { P, ancho, alto, anchoCss, altoCss }`.

- [ ] **Paso 1: el test que falla** — `tests/web/cruza-pantallas.test.mjs`:

```js
/**
 * Las pantallas de CRUZÁ, MONO: los textos que la fuente tiene que tener, el estado
 * visual (cámara, marcador y partículas), los botones y la escala entera.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TEXTOS, BOTONES, botonEn, crearVisual, actualizarVisual, tamanoDelCampo } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/pantallas.js';
import { faltantes } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js';
import { crearPartida } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/motor.js';
import { ANCHO, ALTO } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/cruza/reglas.js';

test('ningún texto de las pantallas tiene una letra que la fuente no dibuja', () => {
  for (const t of ['CRUZÁ,', 'MONO', 'TOCÁ PARA JUGAR', 'HI-SCORE', 'SCORE', '¡QUÉ MACANA!', '¡SOS UN', 'CRACK!',
    '¡NUEVO HI-SCORE!', 'SIN SEÑAL: RÉCORD NO GUARDADO', 'OTRA VEZ', 'SALIR', 'SEGUIR', 'PAUSA', 'FILAS', 'CAJAS', '+50']) {
    assert.ok(TEXTOS.includes(t), `falta en TEXTOS: ${t}`);
  }
  for (const t of TEXTOS) assert.deepEqual(faltantes(t), [], t);
});

test('los botones entran en el campo y se encuentran por dónde se toca', () => {
  for (const lista of Object.values(BOTONES)) {
    for (const b of lista) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= ANCHO && b.y + b.h <= ALTO, b.accion);
  }
  const [otra] = BOTONES.fin;
  assert.equal(botonEn(BOTONES.fin, otra.x + 2, otra.y + 2), 'otra');
  assert.equal(botonEn(BOTONES.fin, 2, 2), null);
  assert.deepEqual(BOTONES.pausa.map((b) => b.accion), ['seguir', 'salir']);
  assert.deepEqual(BOTONES.fin.map((b) => b.accion), ['otra', 'salir']);
});

test('una caja deja el "+50", y se va a los 0,7 s', () => {
  const vis = crearVisual(), p = crearPartida(1);
  actualizarVisual(vis, p, [{ tipo: 'caja' }], 16);
  assert.ok(vis.particulas.some((x) => x.texto === '+50'));
  assert.ok(vis.particulas.length >= 15);
  for (let k = 0; k < 50; k++) actualizarVisual(vis, p, [], 16);
  assert.ok(!vis.particulas.some((x) => x.texto === '+50'));
});

test('la cámara visible persigue a la del motor y el marcador cuenta hacia arriba', () => {
  const vis = crearVisual(), p = crearPartida(1);
  p.cam = 3;
  p.maxFila = 10;
  for (let k = 0; k < 120; k++) actualizarVisual(vis, p, [], 16);
  assert.ok(Math.abs(vis.camara - 3) < 0.01, `${vis.camara}`);
  assert.ok(Math.abs(vis.marcador - 100) < 0.5, `${vis.marcador}`);
});

test('la escala es entera en píxeles físicos y entra en el lugar', () => {
  assert.deepEqual(tamanoDelCampo(360, 692, 3), { P: 5, ancho: 1080, alto: 1700, anchoCss: 360, altoCss: 1700 / 3 });
  assert.equal(tamanoDelCampo(412, 851, 2.625).P, 5);
  assert.equal(tamanoDelCampo(375, 764, 2).P, 3);
  assert.equal(tamanoDelCampo(100, 100, 1).P, 1);
  for (const [w, h, dpr] of [[360, 692, 3], [375, 764, 3], [412, 851, 2.625], [1280, 900, 1]]) {
    const t = tamanoDelCampo(w, h, dpr);
    assert.ok(t.anchoCss <= w + 1e-9 && t.altoCss <= h + 1e-9, `${w}x${h}`);
  }
});
```

- [ ] **Paso 2: ver que falla**

Run: `node --test tests/web/cruza-pantallas.test.mjs`
Expected: FAIL, no existe `pantallas.js`.

- [ ] **Paso 3: `pantallas.js`.** Cabecera:

```js
/**
 * Las pantallas de CRUZA, MONO (spec §2.3 y §6): la partida con su HUD, el inicio, la
 * pausa, el game over y el nuevo record. Portadas del prototipo aprobado
 * (docs/diseno/prototipo-cruza/escena.js y demo.js).
 *
 * Todo se dibuja en el lienzo logico de 216 x 340; la vista lo copia a escala entera.
 * `t` es el tiempo de lo decorativo, en segundos; lo que choca sale del motor.
 */
```

  Lo puro, completo:

```js
export const BOTONES = {
  pausa: [{ accion: 'seguir', x: 34, y: 150, w: 148, h: 19 }, { accion: 'salir', x: 34, y: 178, w: 148, h: 19 }],
  fin: [{ accion: 'otra', x: 34, y: 262, w: 148, h: 19 }, { accion: 'salir', x: 34, y: 290, w: 148, h: 19 }]
};

/** El boton que esta en (x, y) del campo, o null. */
export const botonEn = (lista, x, y) => lista.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)?.accion ?? null;

/** Cada texto fijo que se dibuja: el test de `faltantes` los recorre. */
export const TEXTOS = ['CRUZÁ,', 'MONO', 'TOCÁ PARA JUGAR', 'HI-SCORE', 'SCORE', 'GAME', 'OVER', '¡QUÉ MACANA!',
  '¡SOS UN', 'CRACK!', '¡NUEVO HI-SCORE!', 'SIN SEÑAL: RÉCORD NO GUARDADO', 'OTRA VEZ', 'SALIR', 'SEGUIR',
  'PAUSA', 'FILAS', 'CAJAS', '+50', '0123456789'];

/**
 * La escala del campo: un entero de pixeles fisicos por pixel del juego, el mas
 * grande que entra en el lugar. Con densidades fraccionarias (2,625 en Android) el
 * campo puede quedar un poco mas chico que el lugar, pero nunca borroso.
 */
export function tamanoDelCampo(anchoCss, altoCss, dpr = 1) {
  const P = Math.max(1, Math.floor(Math.min((anchoCss * dpr) / ANCHO, (altoCss * dpr) / ALTO)));
  return { P, ancho: ANCHO * P, alto: ALTO * P, anchoCss: (ANCHO * P) / dpr, altoCss: (ALTO * P) / dpr };
}

export const crearVisual = () => ({ camara: 0, marcador: 0, particulas: [], reloj: 0 });

const CHISPAS = ['#35b8e8', '#a97bf0', '#ffffff', '#ffd21f'];

/** Lo que se ve y no decide nada: la camara suave, el marcador que cuenta, las particulas. */
export function actualizarVisual(vis, p, eventos, dt) {
  vis.reloj += dt;
  vis.camara += (p.cam - vis.camara) * Math.min(1, (dt / 1000) * 5);
  vis.marcador += (puntaje(p) - vis.marcador) * Math.min(1, (dt / 1000) * 12);
  for (const e of eventos) {
    if (e.tipo === 'caja') {
      vis.particulas.push({ texto: '+50', x: p.x - 6, fila: p.fila, dy: -8, vida: 700, desde: vis.reloj });
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        vis.particulas.push({ x: p.x + 12, fila: p.fila, dy: 10, vx: Math.cos(a), vy: Math.sin(a) * 0.8, s: 2, col: CHISPAS[k % 4], vida: 500, desde: vis.reloj, g: true });
      }
    }
    if (e.tipo === 'aterrizo' && p.mundo.fila(p.fila).t !== 'rio') {
      for (let k = 0; k < 6; k++) vis.particulas.push({ x: p.x + 12, fila: p.fila, dy: 21, vx: (k - 2.5) * 0.25, vy: -0.08, s: 1, col: 'rgba(255,255,255,.85)', vida: 300, desde: vis.reloj });
    }
  }
  vis.particulas = vis.particulas.filter((q) => vis.reloj - q.desde < q.vida);
}
```

  Lo portado:

  | Qué | De dónde | Cambios |
  |---|---|---|
  | `hud(c, score, hi, vidas, t, perdiendo)` | `escena.js` l. 585–604 | `marcadorVisible` no se porta (es `vis.marcador`). `CABEZA_GUIÑO` pasa a `CABEZA_GUINO` |
  | `dibujarJuego` | el cuerpo del `lienzo('escena', …)` de `demo.js` l. 266–307 | Ver la tabla de abajo |
  | `marquesina`, `mascotaPNG`, `CIELO`, `EDIFICIOS`, `atardecer` | `escena.js` l. 752–791 | `mascotaPNG` recibe la imagen y no la busca en el documento |
  | `dibujarInicio(c, t, { hi, imagenes })` | el `lienzo('inicio', …)`, l. 792–806 | El HI-SCORE es `hi` con 6 dígitos (no `'003850'`). El convoy de abajo usa `cosasDeFila` sobre tres filas fijas y `xVehiculo` con `tMs = t * 1000` |
  | `boton`, `caer`, `confeti` | l. 807–812 y 825 | `export` no hace falta |
  | `dibujarFin` | `gameover` (l. 813–823) si `!nuevoRecord`; `record` (l. 826–840) si `nuevoRecord` | Los números salen de `score`, `hi`, `filas` y `cajas`. El récord cuenta hacia `score`, no hacia 4120. Si `guardado === false`, `centro(c, 'SIN SEÑAL: RÉCORD NO GUARDADO', 250, '#ff9e1f')`. Los botones en `BOTONES.fin`, también en el récord (l. 838 dice 264/292: pasa a 262/290) |
  | `dibujarPausa` | nuevo | `dibujarJuego` con el mundo quieto y `px(c, 0, HUD, ANCHO, ALTO - HUD, 'rgba(0,0,0,.6)')`; `centro(c, 'PAUSA', 112, CROMO7, 3)` y los dos botones de `BOTONES.pausa` con `boton` (SEGUIR principal, SALIR no) |

  **`dibujarJuego(c, p, vis, t, { hi, quieto })`**, de `demo.js` l. 266–307, sin la parte del
  game over (l. 308–316, que es `dibujarFin`). Cada cosa de la demostración tiene su lugar en
  el motor o en la vista:

  | En la demostración | En el juego |
  |---|---|
  | `demo.camVis` | `vis.camara` |
  | `demo.tm` (s) | `p.t / 1000` para lo decorativo; los vehículos y troncos con `p.t` en ms |
  | `demo.salto`, `fs` | `p.salto`, `avanceDelSalto(p)` |
  | `demo.x` en medio del salto | `xDelMono(p)` |
  | `demo.golpe`, `g` | `p.golpe`, `g = (p.reloj - p.golpe.desde) / 1000` |
  | `demo.reloj < demo.invul` | `p.reloj < p.invulnerableHasta` |
  | `demo.particulas`, `marcadorVisible` | `vis.particulas` (`desde` y `vida` en ms, `a = (vis.reloj - q.desde) / q.vida`), `vis.marcador` |
  | `motivo === 'agua'` | `motivo === 'agua' \|\| motivo === 'borde'` → `chapuzon`; el resto → `MONO_GOLPE` y `estrellas` |
  | `suelo` por tipo | `cache.dibujar(c, fila, y, arriba, abajo)` y `pisoVivo(c, fila, y, t)` |
  | `cosas(...)` | `cosasDeFila(c, fila, y, t, { tomadas: p.tomadas, xVehiculo, xTronco, tMs: p.t })` |
  | `hud(...)` | `hud(c, vis.marcador, Math.max(hi, puntaje(p)), Math.max(0, p.vidas), t, g)` |

  - **El caché de pisos** se crea una vez por módulo (`const cache = crearCacheDePisos()`) y
    `dibujarJuego` llama a `cache.olvidar(Math.floor(vis.camara) - 4)`.
  - **Las filas que se dibujan** son las de la demostración (l. 275–297): los pisos de
    `i1 = Math.ceil(camTop) + 2` a `i0 = Math.floor(vis.camara) - 2`, de arriba para abajo,
    con `camTop = vis.camara + FILAS_VISIBLES - 1`; después las cosas y el mono, desde
    `i1 + 2`.
  - **Con `quieto`** (`prefers-reduced-motion`) el golpe es un solo destello y no hay sacudida,
    como en la l. 272 y la l. 304.

- [ ] **Paso 4: ver que pasa**

Run: `node --test tests/web/cruza-pantallas.test.mjs`
Expected: PASS, 5 tests. Y la búsqueda de identificadores sin declarar del Task 8.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/cruza/pantallas.js tests/web/cruza-pantallas.test.mjs
git commit -m "Cruza, Mono: las pantallas, el HUD y el estado visual"
```

---

### Task 10 · La pantalla del juego y la integración

**Files:**
- Create: `wwwroot/js/views/cruza.js`
- Modify: `wwwroot/js/api.js` (~l. 317), `wwwroot/js/dock.js` (~l. 38), `wwwroot/js/app.js`
  (l. 31, l. 93 y l. 125–131), `wwwroot/js/views/juegos.js`, `wwwroot/app.css` (después de la
  sección VIBORITA TBF)

**Interfaces:**
- Consumes: todo lo anterior; `api.progressRecords()`; `vibrate`, `VIBRACION.caja`,
  `VIBRACION.choque` de `platform.js`; `rotulo` de `dibujos.js`.
- Produces: `cruzaView(host, { go }) : () => void`, la ruta `cruza` y
  `api.cruzaPartida(filas, cajas, duracionMs)`.

- [ ] **Paso 1: la API, el zócalo y la ruta.** En `api.js`, debajo de `viboritaPartida`:

```js
  cruzaPartida: (filas, cajas, duracionMs) => post('/api/juegos/cruza/partidas', { filas, cajas, duracionMs })
```

  (con la coma que corresponda en la línea de arriba). En `dock.js`:
  `cubre: ['juegos', 'viborita', 'cruza']`. En `app.js`:
  - `import { cruzaView } from './views/cruza.js';` debajo del de la Viborita;
  - `cruza: cruzaView,` en el mapa de rutas;
  - `cruza: 'juegos'` en `NECESITAN_CUENTA`: el invitado ve el aviso de cuenta, como en la
    Viborita (spec §1, decisión 3).

- [ ] **Paso 2: la fila en Juegos.** En `views/juegos.js`, debajo de la fila de la Viborita:

```js
      <button class="card stack juego-fila" id="to-cruza" type="button">
        <h2>Cruzá, Mono</h2>
        <p class="muted">Cruzá calles y el Riachuelo con el mono: esquivá el tránsito, subite a los troncos y juntá cajas TBF.</p>
        <span class="btn btn-primary btn-duo">JUGAR</span>
      </button>
```

  y en `wire`: `'#to-cruza': () => go('cruza'),`.

- [ ] **Paso 3: el CSS** — en `app.css`, después de la sección de la Viborita:

```css
/* ===========================================================================
   CRUZA, MONO (spec 2026-10-04-cruza-mono). Pantalla completa sobre negro puro:
   adentro del juego vale la estetica arcade de la propuesta, no la de la app.
=========================================================================== */
.cruza{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;background:#000;
  padding:var(--safe-top,0px) 0 var(--safe-bottom,0px);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
/* area tocable de 48 px de alto: 17 + 14 del rotulo + 17 */
.cz-salir{align-self:flex-start;margin:0 0 0 10px;background:none;border:0;padding:17px 12px;cursor:pointer}
.cz-campo{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
.cz-lienzo{display:block;image-rendering:pixelated;touch-action:none}
```

- [ ] **Paso 4: la vista** — `wwwroot/js/views/cruza.js`:

```js
/**
 * CRUZA, MONO: el Crossy Road porteño con el mono de la app
 * (spec 2026-10-04-cruza-mono).
 *
 * Pantalla completa sobre negro. El mundo, el motor y los dibujos viven en
 * js/juegos/cruza/; aca va el reloj, los gestos, la pausa y el servidor. El juego
 * se dibuja en un lienzo logico de 216 x 340 y se copia a escala entera en pixeles
 * fisicos: un pixel del juego nunca queda borroso.
 */

import { api } from '../api.js';
import { vibrate, VIBRACION } from '../platform.js';
import { rotulo } from '../juegos/viborita/dibujos.js';
import { crearPartida, pedirPaso, avanzar, puntaje } from '../juegos/cruza/motor.js';
import { ANCHO, ALTO, UMBRAL_DESLIZAR } from '../juegos/cruza/reglas.js';
import { lienzo } from '../juegos/cruza/sprites.js';
import {
  crearVisual, actualizarVisual, dibujarJuego, dibujarPausa, dibujarInicio, dibujarFin,
  BOTONES, botonEn, tamanoDelCampo
} from '../juegos/cruza/pantallas.js';

const TECLAS = {
  ArrowUp: 'arr', ArrowDown: 'aba', ArrowLeft: 'izq', ArrowRight: 'der',
  w: 'arr', s: 'aba', a: 'izq', d: 'der', W: 'arr', S: 'aba', A: 'izq', D: 'der'
};
/** El motor avanza en pasos fijos: lo que choca no depende de los cuadros por segundo. */
const PASO_FIJO = 1000 / 60;
/** Un toque pensado para el juego, justo en el final, no tiene que reiniciar la partida. */
const MARGEN_FIN_MS = 600;

function imagen(pose) {
  const im = new Image();
  im.src = `/img/mascota/${pose}.png`;
  return im;
}

export function cruzaView(host, { go }) {
  host.className = 'cruza';
  host.innerHTML = `
    <button type="button" class="cz-salir" aria-label="Salir">${rotulo('< SALIR', '#9aa6b8')}</button>
    <div class="cz-campo"><canvas class="cz-lienzo" aria-label="CRUZÁ, MONO"></canvas></div>`;

  const caja = host.querySelector('.cz-campo');
  const canvas = host.querySelector('.cz-lienzo');
  const pantalla = canvas.getContext('2d');
  const escena = lienzo(ANCHO, ALTO);
  const c = escena.getContext('2d');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const imagenes = { joystick: imagen('joystick'), rueda: imagen('rueda'), festejo: imagen('festejo') };
  const t0 = performance.now();

  let modo = 'inicio';             // inicio | jugando | pausa | fin
  let partida = null;
  let vis = crearVisual();
  let record = null;               // el HI-SCORE del servidor, o null si nunca jugo
  let resumen = null;              // lo que muestra el final
  let generacion = 0;              // una por partida: descarta la respuesta de una anterior
  let jugadoMs = 0;                // sin contar las pausas
  let finDesde = 0;
  let cuadro = 0;
  let ultimo = null;
  let acumulado = 0;

  function medir() {
    const dpr = globalThis.devicePixelRatio || 1;
    const { ancho, alto, anchoCss, altoCss } = tamanoDelCampo(caja.clientWidth, caja.clientHeight, dpr);
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho;
      canvas.height = alto;
    }
    canvas.style.width = `${anchoCss}px`;
    canvas.style.height = `${altoCss}px`;
  }

  function pintar() {
    const t = quieto ? 1.3 : (performance.now() - t0) / 1000;
    const hi = record ?? 0;
    if (modo === 'inicio') dibujarInicio(c, t, { hi, imagenes, quieto });
    else if (modo === 'jugando') dibujarJuego(c, partida, vis, t, { hi, quieto });
    else if (modo === 'pausa') dibujarPausa(c, partida, vis, t, { hi });
    else dibujarFin(c, t, { ...resumen, imagenes, quieto });
    pantalla.imageSmoothingEnabled = false;
    pantalla.drawImage(escena, 0, 0, canvas.width, canvas.height);
  }

  function bucle(ahora) {
    cuadro = requestAnimationFrame(bucle);
    const dt = ultimo === null ? 0 : Math.min(100, ahora - ultimo);
    ultimo = ahora;
    if (modo === 'jugando') {
      jugadoMs += dt;
      acumulado += dt;
      while (acumulado >= PASO_FIJO && modo === 'jugando') {
        acumulado -= PASO_FIJO;
        const eventos = avanzar(partida, PASO_FIJO);
        actualizarVisual(vis, partida, eventos, PASO_FIJO);
        for (const e of eventos) {
          if (e.tipo === 'caja') vibrate(VIBRACION.caja);
          if (e.tipo === 'golpe') vibrate(VIBRACION.choque);
          if (e.tipo === 'fin') terminar();
        }
      }
    }
    pintar();
  }

  function empezar() {
    generacion++;
    partida = crearPartida((Math.random() * 2 ** 32) >>> 0);
    vis = crearVisual();
    resumen = null;
    jugadoMs = 0;
    acumulado = 0;
    modo = 'jugando';
  }

  const pausar = () => { if (modo === 'jugando') modo = 'pausa'; };
  const seguir = () => { if (modo === 'pausa') { modo = 'jugando'; ultimo = null; acumulado = 0; } };

  async function terminar() {
    modo = 'fin';
    finDesde = performance.now();
    const { maxFila: filas, cajas } = partida;
    const score = puntaje(partida);
    resumen = { score, hi: Math.max(record ?? 0, score), filas, cajas, nuevoRecord: false, guardado: undefined };
    const esta = generacion;
    try {
      const r = await api.cruzaPartida(filas, cajas, Math.round(jugadoMs));
      if (esta !== generacion) return;
      if (r.record) record = r.record.valor;
      resumen = { ...resumen, hi: Math.max(record ?? 0, score), nuevoRecord: Boolean(r.nuevoRecord), guardado: true };
    } catch {
      if (esta !== generacion) return;
      resumen = { ...resumen, guardado: false };
    }
  }

  function accion(nombre) {
    if (nombre === 'seguir') seguir();
    if (nombre === 'otra') empezar();
    if (nombre === 'salir') go('juegos');
  }

  const paso = (dir) => { if (modo === 'jugando') pedirPaso(partida, dir); };

  /** Un toque: arrancar, un paso adelante, o el boton que haya abajo del dedo. */
  function tocar(xCss, yCss) {
    if (modo === 'inicio') return empezar();
    if (modo === 'jugando') return paso('arr');
    if (modo === 'fin' && performance.now() - finDesde < MARGEN_FIN_MS) return;
    const r = canvas.getBoundingClientRect();
    const x = ((xCss - r.left) * ANCHO) / r.width;
    const y = ((yCss - r.top) * ALTO) / r.height;
    accion(botonEn(BOTONES[modo], x, y));
  }

  // Un gesto es un paso: el deslizamiento se decide al cruzar el umbral, sin
  // esperar a que se levante el dedo, y lo que siga del mismo gesto no cuenta.
  let gesto = null;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gesto = { x: e.clientX, y: e.clientY, deslizo: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!gesto || gesto.deslizo) return;
    const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL_DESLIZAR) return;
    gesto.deslizo = true;
    paso(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'der' : 'izq') : dy > 0 ? 'aba' : 'arr');
  });
  canvas.addEventListener('pointerup', (e) => {
    if (gesto && !gesto.deslizo) tocar(e.clientX, e.clientY);
    gesto = null;
  });
  canvas.addEventListener('pointercancel', () => { gesto = null; });

  host.querySelector('.cz-salir').addEventListener('click', () => (modo === 'jugando' ? pausar() : go('juegos')));

  const alTeclado = (e) => {
    if (TECLAS[e.key] && modo === 'jugando') { e.preventDefault(); paso(TECLAS[e.key]); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (modo === 'inicio') empezar();
    else if (modo === 'pausa') seguir();
    else if (modo === 'fin' && performance.now() - finDesde >= MARGEN_FIN_MS) empezar();
  };
  document.addEventListener('keydown', alTeclado);

  // Se pausa sola si la app pasa a segundo plano.
  const alOcultar = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', alOcultar);

  api.progressRecords()
    .then((lista) => {
      const r = lista.find((x) => x.code === 'cruza');
      record = r ? r.value : null;
    })
    .catch(() => {});

  const observador = new ResizeObserver(medir);
  observador.observe(caja);
  medir();
  cuadro = requestAnimationFrame(bucle);

  // Al final del montaje: si algo de arriba falla, el zocalo de la app no queda oculto.
  document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: true } }));

  return () => {
    cancelAnimationFrame(cuadro);
    observador.disconnect();
    document.removeEventListener('keydown', alTeclado);
    document.removeEventListener('visibilitychange', alOcultar);
    document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: false } }));
  };
}
```

- [ ] **Paso 5: todos los tests**

Run: `node --test "tests/web/*.test.mjs"` y `dotnet test`
Expected: PASS todo.

- [ ] **Paso 6: en el navegador** (lo hace el controlador, no un subagente). Levantar la API
  con `preview_start` y entrar con la cuenta sembrada de desarrollo. Recorrer:
  - **360 × 740, 375 × 812 y 412 × 915:** la escala entera (el `P` de `tamanoDelCampo`) y sin
    scroll, con `document.scrollingElement.scrollHeight <= innerHeight`;
  - **jugar con toques y con teclado:** un paso, deslizar a los cuatro lados, la pausa con
    SALIR, SEGUIR, el golpe con el destello y el game over;
  - **la red:** el `POST /api/juegos/cruza/partidas` sale con `{ filas, cajas, duracionMs }` y
    vuelve 200. Al recargar, el HI-SCORE del inicio es el guardado;
  - **el invitado:** entra a Juegos, toca Cruzá, Mono y ve el aviso de cuenta;
  - **el zócalo:** se esconde en el juego y vuelve al salir;
  - **la fluidez:** con la CPU limitada a 4× en las herramientas del navegador, medir los
    cuadros por segundo durante 20 s con `performance.now()` en un rAF. Tienen que dar 55 o
    más. Si no, el primer sospechoso es lo que se dibuja por píxel en cada cuadro, y se mueve
    al caché;
  - **comparar contra el artifact** (https://claude.ai/artifact/4CHjiBmpzuvkD1xcfcfx77): el
    mono, los vehículos, los carteles, el HUD, el inicio y el final. Lo portado no puede
    cambiar ni un píxel.

  Captura de pantalla del juego en marcha como prueba.

- [ ] **Paso 7: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/views/cruza.js src/TruckNavigator.Api/wwwroot/js/api.js src/TruckNavigator.Api/wwwroot/js/dock.js src/TruckNavigator.Api/wwwroot/js/app.js src/TruckNavigator.Api/wwwroot/js/views/juegos.js src/TruckNavigator.Api/wwwroot/app.css
git commit -m "Cruza, Mono: la pantalla del juego, en Juegos"
```

---

### Task 11 · La documentación

**Files:**
- Modify: `docs/decisions.md` (AD-56), `CLAUDE.md`,
  `.claude/skills/estado-camiones-app/SKILL.md`, `docs/diseno/prototipo-cruza/README.md`

- [ ] **Paso 1: AD-56** en `docs/decisions.md`, con el formato de las anteriores: *CRUZÁ, MONO:
  un mundo sin fin con sus garantías probadas*. Qué dice:
  - **El mundo se genera con semilla**, por bloques, y cada garantía de la spec (§3) se prueba
    sobre 3000 filas y cuatro semillas.
  - **La regla de los bolsillos la encontró la demostración del prototipo, no un test.** Las
    franjas se arman de nuevo hasta que no hay bolsillos; desde el quinto intento salen sin
    obstáculos, que no pueden tener.
  - **El reparto que queda en la calle no es el sorteado**: 2/3, 2/9 y 1/9, por la regla de no
    poner dos largos seguidos.
  - **El motor es puro y avanza en pasos fijos de 1/60 s**, y lo que se dibuja sale de las
    mismas funciones que chocan.
  - **El récord va en `DriverRecord` con el código `cruza`**, como la Viborita (AD-55), y
    reusa `ResultadoDePartida`.
  - **La invulnerabilidad es sólo contra los vehículos.**

- [ ] **Paso 2: `CLAUDE.md`.**
  - **Los números de tests:** contarlos (`dotnet test` y `node --test "tests/web/*.test.mjs"`),
    no sumarlos a mano; ya pasó que dijera 243 en vez de 245.
  - **La tabla de proyectos:** `/api/juegos` pasa a decir "los récords de la Viborita y de
    Cruzá, Mono", y los tests de dominio e integración nombran a Cruzá, Mono.
  - **La tabla de documentación:** la spec de Cruzá, Mono, con su prototipo.
  - **Una trampa nueva:** *"Un mundo generado se prueba sobre miles de filas, no mirando diez:
    la franja con un bolsillo pasó la regla del pasillo y la encontró la demostración del
    prototipo jugándose sola. Las garantías de `mundo.js` tienen un test cada una (AD-56)."*

- [ ] **Paso 3: la skill de estado** (`estado-camiones-app`): Cruzá, Mono hecho, con la rama, el
  commit y lo que falta (el teléfono). El README del prototipo dice que ya está implementado y
  dónde.

- [ ] **Paso 4: commit**

```bash
git add docs/decisions.md CLAUDE.md .claude/skills/estado-camiones-app/SKILL.md docs/diseno/prototipo-cruza/README.md
git commit -m "Docs de Cruza, Mono: AD-56, CLAUDE.md y la skill de estado"
```

---

### Task 12 · El teléfono y el PR

- [ ] **Paso 1: el APK.** Con el teléfono por USB:
  1. preguntarle al usuario la dirección del backend;
  2. compilar con `.\build-apk.ps1 -ApiUrl <la dirección>`;
  3. instalar con `adb install -r` (el `-Push` falla si el demonio de adb recién arranca);
  4. restaurar `TruckNavigatorApi.cs` con
     `git checkout -- src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs`.
- [ ] **Paso 2: lo prueba el usuario.** Fluidez, gestos, la vibración de la caja y del choque, la
  pausa al salir de la app, el botón atrás y el récord guardado. Leer
  `adb logcat -s Web Cascara` después.
- [ ] **Paso 3: el PR**, sólo cuando el usuario lo pida: `git push -u origin cruza-mono` y
  `gh pr create` contra `main`. La descripción termina con
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. No se fusiona: lo fusiona el
  usuario.
