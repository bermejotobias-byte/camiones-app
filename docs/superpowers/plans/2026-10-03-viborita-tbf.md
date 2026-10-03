# VIBORITA TBF — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el Snake del Nokia 1100 con un camión que engancha acoplados, jugable dentro de
Juegos, con el récord propio guardado en el servidor.

**Architecture:** en el cliente, un módulo por responsabilidad en
`wwwroot/js/juegos/viborita/` —reglas, motor y dibujos puros con tests; la LCD pintada en un
`<canvas>`— y una vista anfitriona `views/viborita.js` con el contorno del 1100 y la cruceta
en HTML/CSS. En el servidor, las reglas que importan para el récord en el dominio
(`Domain/Juegos/Viborita.cs`), el guardado en un servicio de Infrastructure sobre la tabla
de récords que ya existe (`DriverRecord`), y un endpoint fino.

**Tech Stack:** módulos ES sin compilación, `node --test`, Canvas 2D; .NET 10 Minimal API,
EF Core + SQLite, xUnit.

**Spec:** `docs/superpowers/specs/2026-10-03-viborita-tbf-design.md`. Prototipo aprobado:
`docs/diseno/prototipo-viborita/` (sprites y fuente en `base-lcd.mjs`, contorno y cruceta en
`viborita.mjs`).

## Global Constraints

- Rama `viborita-tbf` (ya creada desde `main`). Un commit por tarea. No commitear
  `routing/config-truck.yml`, `.claude/launch.json` ni `.superpowers/`. No empujar a
  `hermano`. El PR lo fusiona el usuario.
- Código, comentarios, commits y docs en español. **Comentarios sin tildes** en `.cs` y en
  los `.js` de la app; los tests `.mjs` sí llevan tildes.
- Reglas (spec §4), idénticas en cliente y servidor: campo **10 × 10**; arranque con la
  cabina y **2** acoplados; **97** cajas como máximo; paso de **260 ms**, **20 ms** menos
  cada **5** cajas, piso **140 ms**; giros en cola **2**; puntos con *n* cajas
  **`2n + n(n+1)/2`**; código del récord **`viborita`**.
- LCD (spec §2.3): **102 × 128** píxeles de LCD; campo desde **y = 10**, celdas de **10**;
  fondo `#b8d27a → #97b555`, tinta `#1b2412`, sombra al **20 %**, rejilla al **7 %**.
- Nada de la estética de la app en la pantalla del juego (spec §2). No va "NOKIA": va
  **TBF**.
- Tests web: `node --test "tests/web/*.test.mjs"` desde la raíz. .NET: `dotnet test`
  (antes, parar cualquier API corriendo: bloquea los .exe).
- Al verificar en el navegador del panel oculto: `window.requestAnimationFrame = (cb) =>
  setTimeout(() => cb(performance.now()), 16)` y forzar recarga con `location.reload()`.

---

## Mapa de archivos

| Archivo | Qué |
|---|---|
| `src/TruckNavigator.Domain/Juegos/Viborita.cs` (nuevo) | Constantes, `Puntos`, `EsPosible` |
| `src/TruckNavigator.Infrastructure/Juegos/ViboritaPartidas.cs` (nuevo) | Registra una partida y mejora el récord |
| `src/TruckNavigator.Api/Contracts/Dtos.cs` | `PartidaDeViboritaRequest`, `PartidaDeViboritaDto` |
| `src/TruckNavigator.Api/Program.cs` | `POST /api/juegos/viborita/partidas` y el registro del servicio |
| `tests/TruckNavigator.UnitTests/ViboritaTests.cs` (nuevo) | Reglas del dominio |
| `tests/TruckNavigator.IntegrationTests/ViboritaPartidasTests.cs` (nuevo) | El récord contra SQLite |
| `wwwroot/js/juegos/viborita/reglas.js` (nuevo) | Las mismas constantes, `puntos`, `pasoMs` |
| `wwwroot/js/juegos/viborita/motor.js` (nuevo) | `crearPartida`, `girar`, `avanzar`, `ponerCaja` |
| `wwwroot/js/juegos/viborita/dibujos.js` (nuevo) | Sprites, fuente 5 × 7, `spriteDe` |
| `wwwroot/js/juegos/viborita/pantallas.js` (nuevo) | Qué dibuja la LCD en cada pantalla (órdenes) |
| `wwwroot/js/juegos/viborita/lcd.js` (nuevo) | `pixeles` (puro) y `pintar` (canvas) |
| `wwwroot/js/views/viborita.js` (nuevo) | La pantalla: contorno, cruceta, reloj, controles, servidor |
| `wwwroot/js/platform.js`, `api.js`, `dock.js`, `app.js`, `views/juegos.js`, `app.css` | Engancharla |
| `tests/web/viborita-*.test.mjs` (nuevos), `tests/web/vibracion.test.mjs` | Tests |

`wwwroot` = `src/TruckNavigator.Api/wwwroot`.

---

### Tarea 1: las reglas en el dominio

**Files:**
- Create: `src/TruckNavigator.Domain/Juegos/Viborita.cs`
- Test: `tests/TruckNavigator.UnitTests/ViboritaTests.cs`

**Interfaces:**
- Produces: `Viborita.RecordCode` (`"viborita"`), `Viborita.CajasMaximas` (97),
  `Viborita.PasoMasRapidoMs` (140), `Viborita.Puntos(int cajas) : long`,
  `Viborita.EsPosible(int cajas, long duracionMs) : bool`.

- [ ] **Paso 1: el test que falla**

```csharp
using TruckNavigator.Domain.Juegos;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Las reglas de la Viborita TBF que necesita el servidor: cuanto vale una partida y
/// que partidas son posibles. El cliente usa los mismos numeros (reglas.js).
/// </summary>
public class ViboritaTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 3)]
    [InlineData(2, 7)]
    [InlineData(5, 25)]
    [InlineData(97, 4947)]
    public void Each_box_is_worth_as_many_points_as_trailers_after_picking_it(int cajas, long puntos)
    {
        Assert.Equal(puntos, Viborita.Puntos(cajas));
    }

    [Fact]
    public void Ninety_seven_boxes_fill_the_ten_by_ten_field()
    {
        Assert.Equal(97, Viborita.CajasMaximas);
        Assert.Equal("viborita", Viborita.RecordCode);
    }

    [Fact]
    public void More_boxes_than_fit_in_the_field_are_impossible()
    {
        Assert.True(Viborita.EsPosible(97, 60_000));
        Assert.False(Viborita.EsPosible(98, 60_000));
        Assert.False(Viborita.EsPosible(-1, 60_000));
    }

    [Fact]
    public void Each_box_takes_at_least_one_step_at_top_speed()
    {
        Assert.True(Viborita.EsPosible(10, 10 * 140));
        Assert.False(Viborita.EsPosible(10, 10 * 140 - 1));
        Assert.True(Viborita.EsPosible(0, 0));
        Assert.False(Viborita.EsPosible(0, -1));
    }
}
```

- [ ] **Paso 2: verlo fallar**

Run: `dotnet test tests/TruckNavigator.UnitTests --filter ViboritaTests`
Expected: no compila — `TruckNavigator.Domain.Juegos` no existe.

- [ ] **Paso 3: el dominio**

```csharp
namespace TruckNavigator.Domain.Juegos;

/// <summary>
/// Las reglas de la Viborita TBF que le importan al servidor: cuanto vale una partida
/// y cuales son posibles.
/// </summary>
/// <remarks>
/// <para>
/// El servidor calcula los puntos a partir de las cajas: no los recibe. Asi el numero
/// que se guarda como record no lo inventa el telefono.
/// </para>
/// <para>
/// Rechazar lo imposible no defiende contra un tramposo decidido —el telefono igual
/// informa las cajas— pero descarta lo absurdo y deja el record en numeros posibles.
/// Los mismos numeros viven en el cliente (js/juegos/viborita/reglas.js).
/// </para>
/// </remarks>
public static class Viborita
{
    /// <summary>El codigo del record en la tabla de records personales.</summary>
    public const string RecordCode = "viborita";

    public const int Columnas = 10;
    public const int Filas = 10;

    /// <summary>La cabina arranca con dos acoplados: tres celdas ocupadas.</summary>
    public const int AcopladosAlArrancar = 2;

    /// <summary>Con el campo lleno no queda lugar para otra caja: 100 - 3.</summary>
    public const int CajasMaximas = Columnas * Filas - (AcopladosAlArrancar + 1);

    /// <summary>El paso mas rapido del juego, en milisegundos.</summary>
    public const int PasoMasRapidoMs = 140;

    /// <summary>
    /// La caja vale tantos puntos como acoplados lleva el camion despues de
    /// levantarla: la primera 3, la segunda 4. Con n cajas: 2n + n(n+1)/2.
    /// </summary>
    public static long Puntos(int cajas) =>
        cajas <= 0 ? 0 : (long)AcopladosAlArrancar * cajas + (long)cajas * (cajas + 1) / 2;

    /// <summary>
    /// Si una partida asi pudo existir: no mas cajas de las que entran en el campo,
    /// y cada caja necesita al menos un paso a la velocidad maxima.
    /// </summary>
    public static bool EsPosible(int cajas, long duracionMs) =>
        cajas is >= 0 and <= CajasMaximas
        && duracionMs >= 0
        && duracionMs >= (long)cajas * PasoMasRapidoMs;
}
```

- [ ] **Paso 4: verlo pasar**

Run: `dotnet test tests/TruckNavigator.UnitTests --filter ViboritaTests`
Expected: PASS, 9 casos.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Domain/Juegos/Viborita.cs tests/TruckNavigator.UnitTests/ViboritaTests.cs
git commit -m "Viborita: los puntos y lo posible, en el dominio"
```

---

### Tarea 2: el récord en el servidor

**Files:**
- Create: `src/TruckNavigator.Infrastructure/Juegos/ViboritaPartidas.cs`
- Modify: `src/TruckNavigator.Api/Contracts/Dtos.cs` (al final)
- Modify: `src/TruckNavigator.Api/Program.cs` (registro junto a `AddScoped<ReportReader>()`, y el
  grupo nuevo después del grupo `progress`)
- Test: `tests/TruckNavigator.IntegrationTests/ViboritaPartidasTests.cs`

**Interfaces:**
- Consumes: `Viborita` (Tarea 1); `PersonalRecords.Improve`, `RecordStanding`,
  `DriverRecord`, `AppDbContext.Records` (existentes).
- Produces: `ViboritaPartidas.RegistrarAsync(Guid driverId, int cajas, long duracionMs,
  DateTimeOffset cuando, CancellationToken ct) : Task<ResultadoDePartida?>` (null si es
  imposible); `record ResultadoDePartida(long Puntos, RecordStanding? Record, bool NuevoRecord)`;
  `POST /api/juegos/viborita/partidas` con `{ cajas, duracionMs }` →
  `{ puntos, record: { valor, fecha } | null, nuevoRecord }`.

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
/// El record de la Viborita TBF: el primero que se escribe en la tabla de records
/// personales. El servidor calcula los puntos; igualar no mueve la fecha.
/// </summary>
public sealed class ViboritaPartidasTests : IAsyncLifetime
{
    private static readonly DateTimeOffset Antes = new(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Ahora = new(2026, 10, 3, 12, 0, 0, TimeSpan.Zero);

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private ViboritaPartidas _partidas = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        await _db.Database.MigrateAsync();
        _partidas = new ViboritaPartidas(_db);
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
            Email = "vibo@camiones.test",
            NormalizedEmail = "VIBO@CAMIONES.TEST",
            UserName = "vibo@camiones.test",
            NormalizedUserName = "VIBO@CAMIONES.TEST",
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

        var resultado = await _partidas.RegistrarAsync(id, cajas: 5, duracionMs: 20_000, Ahora);

        Assert.NotNull(resultado);
        Assert.Equal(25, resultado.Puntos);
        Assert.True(resultado.NuevoRecord);
        Assert.Equal(25, resultado.Record!.Value.Value);
        var guardado = await _db.Records.SingleAsync(r => r.DriverId == id && r.RecordCode == Viborita.RecordCode);
        Assert.Equal(25, guardado.Value);
    }

    [Fact]
    public async Task A_lower_game_keeps_the_record_and_tells_it()
    {
        var id = await CrearCamioneroAsync();
        await _partidas.RegistrarAsync(id, 5, 20_000, Antes);

        var resultado = await _partidas.RegistrarAsync(id, 2, 9_000, Ahora);

        Assert.Equal(7, resultado!.Puntos);
        Assert.False(resultado.NuevoRecord);
        Assert.Equal(25, resultado.Record!.Value.Value);
        Assert.Equal(Antes, resultado.Record.Value.AchievedAt);
    }

    [Fact]
    public async Task Tying_the_record_does_not_move_its_date()
    {
        var id = await CrearCamioneroAsync();
        await _partidas.RegistrarAsync(id, 5, 20_000, Antes);

        var resultado = await _partidas.RegistrarAsync(id, 5, 20_000, Ahora);

        Assert.False(resultado!.NuevoRecord);
        Assert.Equal(Antes, (await _db.Records.SingleAsync(r => r.DriverId == id)).AchievedAt);
    }

    [Fact]
    public async Task A_better_game_moves_the_record_and_its_date()
    {
        var id = await CrearCamioneroAsync();
        await _partidas.RegistrarAsync(id, 5, 20_000, Antes);

        var resultado = await _partidas.RegistrarAsync(id, 6, 20_000, Ahora);

        Assert.True(resultado!.NuevoRecord);
        Assert.Equal(33, resultado.Record!.Value.Value);
        Assert.Equal(Ahora, resultado.Record.Value.AchievedAt);
    }

    [Fact]
    public async Task A_game_with_no_boxes_is_not_a_record()
    {
        var id = await CrearCamioneroAsync();

        var resultado = await _partidas.RegistrarAsync(id, 0, 3_000, Ahora);

        Assert.Equal(0, resultado!.Puntos);
        Assert.False(resultado.NuevoRecord);
        Assert.Null(resultado.Record);
        Assert.Empty(_db.Records.Where(r => r.DriverId == id));
    }

    [Fact]
    public async Task An_impossible_game_is_rejected_and_nothing_is_saved()
    {
        var id = await CrearCamioneroAsync();

        Assert.Null(await _partidas.RegistrarAsync(id, 98, 600_000, Ahora));
        Assert.Null(await _partidas.RegistrarAsync(id, 50, 1_000, Ahora));
        Assert.Empty(_db.Records.Where(r => r.DriverId == id));
    }
}
```

- [ ] **Paso 2: verlo fallar**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter ViboritaPartidasTests`
Expected: no compila — `TruckNavigator.Infrastructure.Juegos` no existe.

- [ ] **Paso 3: el servicio**

`src/TruckNavigator.Infrastructure/Juegos/ViboritaPartidas.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Juegos;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Juegos;

/// <summary>Lo que devuelve una partida: sus puntos y como quedo el record.</summary>
public sealed record ResultadoDePartida(long Puntos, RecordStanding? Record, bool NuevoRecord);

/// <summary>
/// Registra una partida de la Viborita TBF y mejora el record del camionero.
/// </summary>
/// <remarks>
/// <para>
/// Es el primer record que se escribe en la tabla de records personales
/// (<see cref="DriverRecord"/>). Usa la misma regla que todos:
/// <see cref="PersonalRecords.Improve"/>, donde igualar no es superar y el empate no
/// mueve la fecha.
/// </para>
/// <para>
/// Una partida sin cajas no es record: si no, la primera partida perdida en el primer
/// paso festejaria un "nuevo record" de cero.
/// </para>
/// </remarks>
public sealed class ViboritaPartidas(AppDbContext db)
{
    /// <summary>El resultado, o <c>null</c> si la partida no pudo existir.</summary>
    public async Task<ResultadoDePartida?> RegistrarAsync(
        Guid driverId,
        int cajas,
        long duracionMs,
        DateTimeOffset cuando,
        CancellationToken ct = default)
    {
        if (!Viborita.EsPosible(cajas, duracionMs))
        {
            return null;
        }

        var puntos = Viborita.Puntos(cajas);

        var guardado = await db.Records.SingleOrDefaultAsync(
            r => r.DriverId == driverId && r.RecordCode == Viborita.RecordCode, ct);

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
            guardado = new DriverRecord { DriverId = driverId, RecordCode = Viborita.RecordCode };
            db.Records.Add(guardado);
        }

        guardado.Value = nuevo.Value;
        guardado.AchievedAt = nuevo.AchievedAt;
        await db.SaveChangesAsync(ct);

        return new ResultadoDePartida(puntos, nuevo, NuevoRecord: true);
    }
}
```

- [ ] **Paso 4: verlo pasar**

Run: `dotnet test tests/TruckNavigator.IntegrationTests --filter ViboritaPartidasTests`
Expected: PASS, 6 tests.

- [ ] **Paso 5: el contrato y el endpoint**

Al final de `src/TruckNavigator.Api/Contracts/Dtos.cs`:

```csharp
/// <summary>Una partida de la Viborita TBF: el telefono informa cajas y duracion, no puntos.</summary>
public sealed record PartidaDeViboritaRequest(int Cajas, long DuracionMs);

/// <summary>El record de la Viborita: el valor y cuando se consiguio.</summary>
public sealed record RecordDeViboritaDto(long Valor, DateTimeOffset Fecha);

/// <summary>Lo que devuelve una partida. Los puntos los calcula el servidor.</summary>
public sealed record PartidaDeViboritaDto(long Puntos, RecordDeViboritaDto? Record, bool NuevoRecord);
```

En `Program.cs`, junto a `builder.Services.AddScoped<ReportReader>();`:

```csharp
builder.Services.AddScoped<ViboritaPartidas>();
```

con `using TruckNavigator.Infrastructure.Juegos;` arriba, y después del último
`progress.MapPost(...)` del grupo de progresión:

```csharp
// ------------------------------------------------------------------ juegos
//
// La Viborita TBF guarda el record propio (spec 2026-10-03-viborita-tbf). El
// telefono informa cajas y duracion; los puntos los calcula el servidor, y lo
// imposible se rechaza. Cae en la canasta de escritura del limite de tasa.
var juegos = app.MapGroup("/api/juegos").WithTags("Juegos").RequireAuthorization();

juegos.MapPost("/viborita/partidas", async (
    PartidaDeViboritaRequest request,
    ClaimsPrincipal principal,
    ViboritaPartidas partidas,
    CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);
    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var resultado = await partidas.RegistrarAsync(userId.Value, request.Cajas, request.DuracionMs, DateTimeOffset.UtcNow, ct);

    if (resultado is null)
    {
        return Results.Problem(
            title: "Esa partida no pudo existir",
            detail: "Mas cajas de las que entran en el campo, o de las que se levantan en ese tiempo.",
            statusCode: StatusCodes.Status422UnprocessableEntity);
    }

    var record = resultado.Record is { } r ? new RecordDeViboritaDto(r.Value, r.AchievedAt) : null;
    return Results.Ok(new PartidaDeViboritaDto(resultado.Puntos, record, resultado.NuevoRecord));
})
.WithSummary("Registra una partida de la Viborita TBF y devuelve los puntos y el record.");
```

- [ ] **Paso 6: compila y anda por HTTP**

```bash
dotnet build src/TruckNavigator.Api -v q
```

Levantar la API (preview `api`), entrar con la cuenta de prueba de desarrollo
(`demo@camiones.test` y su contraseña de la siembra, por `POST /api/auth/login`) y probar:
sin sesión → 401; `{ "cajas": 5, "duracionMs": 20000 }` → `{ "puntos": 25, "record": { "valor": 25, … }, "nuevoRecord": true }`;
`{ "cajas": 50, "duracionMs": 1000 }` → 422; y `GET /api/progress/records` lista
`viborita`. Bajar la API antes de seguir.

- [ ] **Paso 7: commit**

```bash
git add src/TruckNavigator.Infrastructure/Juegos/ViboritaPartidas.cs src/TruckNavigator.Api/Contracts/Dtos.cs src/TruckNavigator.Api/Program.cs tests/TruckNavigator.IntegrationTests/ViboritaPartidasTests.cs
git commit -m "Viborita: el record propio en el servidor, el primero de la tabla de records"
```

---

### Tarea 3: las reglas en el cliente

**Files:**
- Create: `wwwroot/js/juegos/viborita/reglas.js`
- Test: `tests/web/viborita-reglas.test.mjs`

**Interfaces:**
- Produces: `COLUMNAS`, `FILAS`, `ACOPLADOS_AL_ARRANCAR`, `CAJAS_MAXIMAS`,
  `PASO_INICIAL_MS`, `PASO_MAS_RAPIDO_MS`, `GIROS_EN_COLA`, `puntos(cajas)`,
  `pasoMs(cajas)`.

- [ ] **Paso 1: el test que falla**

```js
/**
 * Las reglas de VIBORITA TBF (spec §4). Son los mismos números que el servidor
 * (Domain/Juegos/Viborita.cs): si cambian, cambian en los dos lados.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as R from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/reglas.js';

test('el campo es de 10 × 10 y caben 97 cajas', () => {
  assert.equal(R.COLUMNAS, 10);
  assert.equal(R.FILAS, 10);
  assert.equal(R.ACOPLADOS_AL_ARRANCAR, 2);
  assert.equal(R.CAJAS_MAXIMAS, 97);
});

test('cada caja vale los acoplados que llevás después de levantarla', () => {
  assert.deepEqual([0, 1, 2, 5, 97].map(R.puntos), [0, 3, 7, 25, 4947]);
});

test('el paso arranca en 260 ms, baja 20 cada 5 cajas y se planta en 140', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 29, 30, 60, 97].map(R.pasoMs), [260, 260, 240, 240, 220, 160, 140, 140, 140]);
  assert.equal(R.PASO_MAS_RAPIDO_MS, 140);
});

test('se encolan hasta dos giros', () => {
  assert.equal(R.GIROS_EN_COLA, 2);
});
```

- [ ] **Paso 2: verlo fallar**

Run: `node --test tests/web/viborita-reglas.test.mjs`
Expected: FAIL, `Cannot find module …/reglas.js`.

- [ ] **Paso 3: las reglas**

```js
/**
 * Las reglas de VIBORITA TBF (spec 2026-10-03-viborita-tbf, §4).
 *
 * Son los mismos numeros que usa el servidor para calcular los puntos y rechazar
 * lo imposible (Domain/Juegos/Viborita.cs). Si cambian, cambian en los dos lados:
 * los tests de cada lado los fijan.
 */

export const COLUMNAS = 10;
export const FILAS = 10;
export const ACOPLADOS_AL_ARRANCAR = 2;

/** Con el campo lleno no queda lugar para otra caja: 100 - 3. */
export const CAJAS_MAXIMAS = COLUMNAS * FILAS - (ACOPLADOS_AL_ARRANCAR + 1);

export const PASO_INICIAL_MS = 260;
export const PASO_MAS_RAPIDO_MS = 140;
const ACELERA_CADA_CAJAS = 5;
const ACELERA_MS = 20;

/** Dos toques rapidos se respetan los dos; el tercero se descarta. */
export const GIROS_EN_COLA = 2;

/** La caja vale los acoplados que llevas despues de levantarla: 2n + n(n+1)/2. */
export const puntos = (cajas) => (cajas <= 0 ? 0 : ACOPLADOS_AL_ARRANCAR * cajas + (cajas * (cajas + 1)) / 2);

/** Cuanto dura un paso con tantas cajas levantadas. */
export const pasoMs = (cajas) =>
  Math.max(PASO_MAS_RAPIDO_MS, PASO_INICIAL_MS - Math.floor(cajas / ACELERA_CADA_CAJAS) * ACELERA_MS);
```

- [ ] **Paso 4: verlo pasar**

Run: `node --test tests/web/viborita-reglas.test.mjs` → PASS.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/viborita/reglas.js tests/web/viborita-reglas.test.mjs
git commit -m "Viborita: las reglas en el cliente, con los mismos numeros que el servidor"
```

---

### Tarea 4: el motor

**Files:**
- Create: `wwwroot/js/juegos/viborita/motor.js`
- Test: `tests/web/viborita-motor.test.mjs`

**Interfaces:**
- Consumes: `COLUMNAS`, `FILAS`, `GIROS_EN_COLA` (Tarea 3).
- Produces:
  - `crearPartida(azar = Math.random) → Partida`
  - `girar(partida, dir) → Partida` (`dir`: `'arr' | 'aba' | 'izq' | 'der'`)
  - `avanzar(partida, azar = Math.random) → { partida: Partida, evento: 'caja' | 'choque' | 'gano' | null }`
  - `ponerCaja(cuerpo, azar) → {x, y} | null`
  - `Partida = { cuerpo: {x,y}[] /* cabina primero */, rumbo, giros: string[], caja: {x,y}|null, cajas: number, estado: 'jugando'|'choco'|'gano', motivo: 'borde'|'cola'|null }`

- [ ] **Paso 1: el test que falla**

```js
/**
 * El motor de VIBORITA TBF: el Snake, paso a paso (spec §4). Puro: el azar se
 * inyecta, así cada caso es exacto.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPartida, girar, avanzar, ponerCaja } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/motor.js';

const fijo = (v) => () => v;
const partida = (cuerpo, rumbo, extra = {}) => ({ cuerpo, rumbo, giros: [], caja: { x: 9, y: 9 }, cajas: 0, estado: 'jugando', motivo: null, ...extra });
const cabeza = (p) => p.cuerpo[0];

test('arranca con la cabina y dos acoplados en la fila del medio, yendo a la derecha', () => {
  const p = crearPartida(fijo(0));

  assert.deepEqual(p.cuerpo, [{ x: 2, y: 5 }, { x: 1, y: 5 }, { x: 0, y: 5 }]);
  assert.equal(p.rumbo, 'der');
  assert.equal(p.estado, 'jugando');
  assert.ok(!p.cuerpo.some((c) => c.x === p.caja.x && c.y === p.caja.y));
});

test('avanza una celda por paso y la cola la sigue', () => {
  const { partida: p, evento } = avanzar(crearPartida(fijo(0.99)));

  assert.equal(evento, null);
  assert.deepEqual(p.cuerpo, [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }]);
});

test('gira', () => {
  const p = avanzar(girar(crearPartida(fijo(0.99)), 'aba')).partida;

  assert.deepEqual(cabeza(p), { x: 2, y: 6 });
  assert.equal(p.rumbo, 'aba');
});

test('el giro en U se ignora', () => {
  const p = girar(crearPartida(fijo(0.99)), 'izq');

  assert.deepEqual(p.giros, []);
});

test('se encolan dos giros y no tres, y los dos se respetan en orden', () => {
  let p = crearPartida(fijo(0.99));
  p = girar(girar(girar(p, 'aba'), 'izq'), 'arr');

  assert.deepEqual(p.giros, ['aba', 'izq']);

  p = avanzar(p).partida;
  assert.deepEqual(cabeza(p), { x: 2, y: 6 });
  p = avanzar(p).partida;
  assert.deepEqual(cabeza(p), { x: 1, y: 6 });
});

test('levantar una caja suma un acoplado y una caja nueva', () => {
  const p0 = partida([{ x: 2, y: 5 }, { x: 1, y: 5 }, { x: 0, y: 5 }], 'der', { caja: { x: 3, y: 5 } });

  const { partida: p, evento } = avanzar(p0, fijo(0));

  assert.equal(evento, 'caja');
  assert.equal(p.cajas, 1);
  assert.equal(p.cuerpo.length, 4);
  assert.deepEqual(cabeza(p), { x: 3, y: 5 });
  assert.ok(!p.cuerpo.some((c) => c.x === p.caja.x && c.y === p.caja.y));
});

test('chocar contra el borde termina la partida y el camión queda donde estaba', () => {
  const cuerpo = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
  const { partida: p, evento } = avanzar(partida(cuerpo, 'der'));

  assert.equal(evento, 'choque');
  assert.equal(p.estado, 'choco');
  assert.equal(p.motivo, 'borde');
  assert.deepEqual(p.cuerpo, cuerpo);
});

test('chocar contra un acoplado propio termina la partida', () => {
  // Una U: la cabina va a la izquierda contra el segundo acoplado.
  const cuerpo = [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }];
  const { partida: p, evento } = avanzar(partida(cuerpo, 'izq'));

  assert.equal(evento, 'choque');
  assert.equal(p.motivo, 'cola');
});

test('perseguirse la cola no es choque: la celda que deja la cola ese paso está libre', () => {
  const cuerpo = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }];
  const { partida: p, evento } = avanzar(partida(cuerpo, 'izq'));

  assert.equal(evento, null);
  assert.deepEqual(cabeza(p), { x: 0, y: 0 });
});

test('la caja nunca cae sobre el camión', () => {
  const cuerpo = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  for (let i = 0; i < 100; i++) {
    const caja = ponerCaja(cuerpo, fijo(i / 100));
    assert.ok(!cuerpo.some((c) => c.x === caja.x && c.y === caja.y), `azar ${i / 100}`);
  }
});

test('con el campo lleno no hay caja, y llenarlo es ganar', () => {
  // Un recorrido en zigzag por las 100 celdas: el camión ocupa 99 y la caja la última.
  const zigzag = [];
  for (let y = 0; y < 10; y++) for (let i = 0; i < 10; i++) zigzag.push({ x: y % 2 ? 9 - i : i, y });

  assert.equal(ponerCaja(zigzag, fijo(0)), null);

  const cuerpo = zigzag.slice(0, 99).reverse();
  const { partida: p, evento } = avanzar(partida(cuerpo, 'izq', { caja: zigzag[99] }));

  assert.equal(evento, 'gano');
  assert.equal(p.estado, 'gano');
  assert.equal(p.caja, null);
});

test('una partida terminada no se mueve más', () => {
  const p0 = partida([{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }], 'der', { estado: 'choco', motivo: 'borde' });

  assert.deepEqual(avanzar(p0), { partida: p0, evento: null });
});
```

- [ ] **Paso 2: verlo fallar**

Run: `node --test tests/web/viborita-motor.test.mjs` → FAIL (`Cannot find module`).

- [ ] **Paso 3: el motor**

```js
/**
 * El motor de VIBORITA TBF: el Snake, paso a paso (spec §4).
 *
 * Puro: recibe una partida y devuelve otra, sin reloj ni pantalla. El azar se
 * inyecta, asi los tests son exactos. El reloj y los controles los pone la vista.
 */

import { COLUMNAS, FILAS, GIROS_EN_COLA } from './reglas.js';

const DIRECCION = { arr: { x: 0, y: -1 }, aba: { x: 0, y: 1 }, izq: { x: -1, y: 0 }, der: { x: 1, y: 0 } };
const OPUESTO = { arr: 'aba', aba: 'arr', izq: 'der', der: 'izq' };

const igual = (a, b) => a.x === b.x && a.y === b.y;

/** Una celda libre al azar, o null si el camion ya ocupa todo el campo. */
export function ponerCaja(cuerpo, azar) {
  const libres = [];
  for (let y = 0; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS; x++) {
      if (!cuerpo.some((c) => c.x === x && c.y === y)) libres.push({ x, y });
    }
  }
  return libres.length ? libres[Math.floor(azar() * libres.length)] : null;
}

/** La cabina y dos acoplados en la fila del medio, yendo a la derecha. */
export function crearPartida(azar = Math.random) {
  const fila = Math.floor(FILAS / 2);
  const cuerpo = [{ x: 2, y: fila }, { x: 1, y: fila }, { x: 0, y: fila }];
  return { cuerpo, rumbo: 'der', giros: [], caja: ponerCaja(cuerpo, azar), cajas: 0, estado: 'jugando', motivo: null };
}

/**
 * Encola un giro. Se compara contra el ultimo giro pendiente, no contra el rumbo:
 * asi dos toques rapidos (abajo, izquierda) se respetan los dos, y el segundo no
 * se toma como un giro en U del primero.
 */
export function girar(partida, dir) {
  if (!DIRECCION[dir] || partida.estado !== 'jugando') return partida;
  const ultimo = partida.giros.at(-1) ?? partida.rumbo;
  if (dir === ultimo || dir === OPUESTO[ultimo] || partida.giros.length >= GIROS_EN_COLA) return partida;
  return { ...partida, giros: [...partida.giros, dir] };
}

/** Un paso: mueve, levanta la caja, choca o gana. */
export function avanzar(partida, azar = Math.random) {
  if (partida.estado !== 'jugando') return { partida, evento: null };

  const [giro, ...giros] = partida.giros;
  const rumbo = giro ?? partida.rumbo;
  const d = DIRECCION[rumbo];
  const cabeza = partida.cuerpo[0];
  const siguiente = { x: cabeza.x + d.x, y: cabeza.y + d.y };

  const choco = (motivo) => ({ partida: { ...partida, rumbo, giros, estado: 'choco', motivo }, evento: 'choque' });

  if (siguiente.x < 0 || siguiente.x >= COLUMNAS || siguiente.y < 0 || siguiente.y >= FILAS) return choco('borde');

  const levanta = partida.caja !== null && igual(siguiente, partida.caja);
  // La celda que deja la cola en este mismo paso esta libre: perseguirse la cola no es choque.
  const resto = levanta ? partida.cuerpo : partida.cuerpo.slice(0, -1);
  if (resto.some((c) => igual(c, siguiente))) return choco('cola');

  const cuerpo = [siguiente, ...resto];

  if (!levanta) return { partida: { ...partida, cuerpo, rumbo, giros }, evento: null };

  const caja = ponerCaja(cuerpo, azar);
  const cajas = partida.cajas + 1;

  if (caja === null) return { partida: { ...partida, cuerpo, rumbo, giros, caja, cajas, estado: 'gano' }, evento: 'gano' };
  return { partida: { ...partida, cuerpo, rumbo, giros, caja, cajas }, evento: 'caja' };
}
```

- [ ] **Paso 4: verlo pasar**

Run: `node --test tests/web/viborita-motor.test.mjs` → PASS, 12 tests.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/viborita/motor.js tests/web/viborita-motor.test.mjs
git commit -m "Viborita: el motor del Snake, puro y con el azar inyectado"
```

---

### Tarea 5: los dibujos y la fuente

**Files:**
- Create: `wwwroot/js/juegos/viborita/dibujos.js`
- Test: `tests/web/viborita-dibujos.test.mjs`

**Interfaces:**
- Produces: `SPRITES` (objeto `nombre → string[10]`, nombres `CAB_R CAB_L CAB_D CAB_U TRL_H
  TRL_HL TRL_V TRL_VU CAJA`), `FUENTE` (objeto `carácter → string[7]`),
  `spriteDe(cuerpo, i, rumbo) → nombre`, `faltantes(texto) → string[]`,
  `anchoDeTexto(texto, k = 1) → number`.

- [ ] **Paso 1: el test que falla**

```js
/**
 * Los dibujos de VIBORITA TBF: los sprites del camión aprobados en el prototipo
 * (docs/diseno/prototipo-viborita/base-lcd.mjs) y la fuente de píxel 5 × 7.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SPRITES, FUENTE, spriteDe, faltantes, anchoDeTexto } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js';

test('los sprites aprobados, píxel por píxel', () => {
  assert.deepEqual(SPRITES.CAB_R, ['....#.....', '....#####.', '....##..#.', '....##..##', '....######', '....######', '##########', '.##....##.', '.##....##.', '..........']);
  assert.deepEqual(SPRITES.CAJA[2], '.#..##..#.');
  for (const [nombre, s] of Object.entries(SPRITES)) {
    assert.equal(s.length, 10, nombre);
    for (const fila of s) assert.equal(fila.length, 10, nombre);
  }
});

test('lo que va a la izquierda es el espejo, y lo que sube es el volteo', () => {
  assert.deepEqual(SPRITES.CAB_L, SPRITES.CAB_R.map((f) => [...f].reverse().join('')));
  assert.deepEqual(SPRITES.TRL_HL, SPRITES.TRL_H.map((f) => [...f].reverse().join('')));
  assert.deepEqual(SPRITES.CAB_U, [...SPRITES.CAB_D].reverse());
  assert.deepEqual(SPRITES.TRL_VU, [...SPRITES.TRL_V].reverse());
});

test('la cabina se dibuja según el rumbo', () => {
  const cuerpo = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
  assert.deepEqual(['der', 'izq', 'aba', 'arr'].map((r) => spriteDe(cuerpo, 0, r)), ['CAB_R', 'CAB_L', 'CAB_D', 'CAB_U']);
});

test('cada acoplado mira a la pieza de adelante, también en las curvas', () => {
  // Va a la derecha y dobla hacia abajo: la cabina en (6,6), la curva en (6,5).
  const cuerpo = [{ x: 6, y: 6 }, { x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }];
  assert.deepEqual([1, 2, 3].map((i) => spriteDe(cuerpo, i, 'aba')), ['TRL_V', 'TRL_H', 'TRL_H']);

  const subiendo = [{ x: 3, y: 2 }, { x: 3, y: 3 }];
  assert.equal(spriteDe(subiendo, 1, 'arr'), 'TRL_VU');
  const yendoIzq = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
  assert.equal(spriteDe(yendoIzq, 1, 'izq'), 'TRL_HL');
});

test('la fuente cubre las mayúsculas del castellano, los dígitos y los signos que se usan', () => {
  assert.deepEqual(faltantes('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ ÁÉÍÓÚ 0123456789 ¡!:<.'), []);
  for (const [c, g] of Object.entries(FUENTE)) {
    assert.equal(g.length, 7, c);
    for (const fila of g) assert.equal(fila.length, 5, c);
  }
});

test('un carácter que no está se informa, no se dibuja en blanco callado', () => {
  assert.deepEqual(faltantes('HOLA€'), ['€']);
});

test('el ancho de un texto: seis por letra menos el último espacio', () => {
  assert.equal(anchoDeTexto('TBF'), 17);
  assert.equal(anchoDeTexto('TBF', 2), 34);
});
```

- [ ] **Paso 2: verlo fallar**

Run: `node --test tests/web/viborita-dibujos.test.mjs` → FAIL (`Cannot find module`).

- [ ] **Paso 3: los dibujos**

```js
/**
 * Los dibujos de VIBORITA TBF: el camion, la caja y la fuente de pixel.
 *
 * Son los del prototipo aprobado (docs/diseno/prototipo-viborita/base-lcd.mjs),
 * pixel por pixel. Diez por diez por celda, en dos tonos: '#' es tinta.
 */

const CAB_R = ['....#.....', '....#####.', '....##..#.', '....##..##', '....######', '....######', '##########', '.##....##.', '.##....##.', '..........'];
const TRL_H = ['..........', '#########.', '#########.', '#.......#.', '#########.', '#########.', '##########', '.##....##.', '.##....##.', '..........'];
const CAB_D = ['....##....', '..######..', '..#....#..', '..######..', '.########.', '..######..', '..#.##.#..', '..#....#..', '..######..', '...####...'];
const TRL_V = ['..######..', '..#.##.#..', '..######..', '..#.##.#..', '..######..', '..#.##.#..', '..######..', '..#.##.#..', '..######..', '....##....'];
const CAJA = ['..........', '.########.', '.#..##..#.', '.#..##..#.', '.########.', '.#..##..#.', '.#..##..#.', '.########.', '..........', '..........'];

const espejo = (s) => s.map((f) => [...f].reverse().join(''));
const volteo = (s) => [...s].reverse();

/**
 * De costado los dibujos miran a la derecha y de arriba bajan; los otros dos
 * rumbos son el espejo y el volteo. El acoplado lleva el enganche del lado de la
 * pieza de adelante.
 */
export const SPRITES = {
  CAB_R, CAB_L: espejo(CAB_R), CAB_D, CAB_U: volteo(CAB_D),
  TRL_H, TRL_HL: espejo(TRL_H), TRL_V, TRL_VU: volteo(TRL_V),
  CAJA
};

const CABINA = { der: 'CAB_R', izq: 'CAB_L', aba: 'CAB_D', arr: 'CAB_U' };

/**
 * Que sprite lleva la pieza i. La cabina va segun el rumbo; cada acoplado mira a
 * la pieza de adelante, asi en una curva se ve doblando.
 */
export function spriteDe(cuerpo, i, rumbo) {
  if (i === 0) return CABINA[rumbo];
  const adelante = cuerpo[i - 1];
  const yo = cuerpo[i];
  if (adelante.x > yo.x) return 'TRL_H';
  if (adelante.x < yo.x) return 'TRL_HL';
  if (adelante.y > yo.y) return 'TRL_V';
  return 'TRL_VU';
}

/**
 * La fuente de pixel 5 x 7: mayusculas del castellano con tildes y Ñ, digitos y
 * los signos que usan las pantallas. Un caracter que falta no se dibuja y no
 * avisa: por eso hay `faltantes` y un test que lo usa.
 */
export const FUENTE = {
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  Ñ: ['.###.', '.....', '#...#', '##..#', '#.#.#', '#..##', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'], Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'], W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'], Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  Á: ['...#.', '.###.', '#...#', '#...#', '#####', '#...#', '#...#'], É: ['...#.', '#####', '#....', '####.', '#....', '#....', '#####'],
  Í: ['...#.', '.###.', '..#..', '..#..', '..#..', '..#..', '.###.'], Ó: ['...#.', '.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Ú: ['...#.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'], '¡': ['..#..', '.....', '..#..', '..#..', '..#..', '..#..', '..#..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'], '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....']
};

/** Los caracteres de un texto que la fuente no tiene. */
export const faltantes = (texto) => [...new Set([...String(texto)].filter((c) => !FUENTE[c]))];

/** Ancho en pixeles: seis por caracter (cinco y un espacio), sin el ultimo espacio. */
export const anchoDeTexto = (texto, k = 1) => String(texto).length * 6 * k - k;
```

- [ ] **Paso 4: verlo pasar**

Run: `node --test tests/web/viborita-dibujos.test.mjs` → PASS, 7 tests.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js tests/web/viborita-dibujos.test.mjs
git commit -m "Viborita: el camion aprobado y la fuente de pixel del castellano"
```

---

### Tarea 6: las pantallas y los píxeles

**Files:**
- Create: `wwwroot/js/juegos/viborita/pantallas.js`
- Create: `wwwroot/js/juegos/viborita/lcd.js`
- Test: `tests/web/viborita-pantallas.test.mjs`

**Interfaces:**
- Consumes: `SPRITES`, `FUENTE`, `spriteDe`, `anchoDeTexto` (Tarea 5); `puntos` (Tarea 3).
- Produces:
  - `AN = 102`, `AL = 128`, `CAMPO_Y = 10`, `CEL = 10` (pantallas.js)
  - `inicio({ record }) → Pantalla`, `jugando(partida, { record }) → Pantalla`,
    `pausa(partida, { record }) → Pantalla`,
    `fin(partida, { record, nuevoRecord, guardado }) → Pantalla`
  - `Pantalla = { ordenes: Orden[], etiqueta: string, epigrafe: string[] }`
  - `Orden`: `{op:'texto', t, x, y, k}` · `{op:'centro', t, y, k}` · `{op:'sprite', n, x, y}` ·
    `{op:'linea', x0, y0, x1, y1}` · `{op:'marco', x0, y0, x1, y1}` · `{op:'borrar', x0, y0, x1, y1}` · `{op:'estado'}`
  - `pixeles(ordenes) → Set<number>` (lcd.js; cada píxel encendido como `y * AN + x`)
  - `pintar(canvas, ordenes, escala)` (lcd.js; no se prueba en node)

- [ ] **Paso 1: el test que falla**

```js
/**
 * Qué dibuja la LCD de VIBORITA TBF en cada pantalla (spec §3), como órdenes
 * puras, y qué píxeles prenden. El canvas sólo pinta lo que esto decide.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { inicio, jugando, pausa, fin, AN, AL } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/pantallas.js';
import { pixeles } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/lcd.js';
import { faltantes } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/dibujos.js';
import { crearPartida } from '../../src/TruckNavigator.Api/wwwroot/js/juegos/viborita/motor.js';

const partida = crearPartida(() => 0);
const textos = (p) => [...p.ordenes.filter((o) => o.t !== undefined).map((o) => o.t), p.etiqueta, ...p.epigrafe];

const TODAS = [
  inicio({ record: 31 }), inicio({ record: null }),
  jugando(partida, { record: 31 }), pausa(partida, { record: 31 }),
  fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: true }),
  fin({ ...partida, estado: 'choco', motivo: 'borde', cajas: 9 }, { record: 117, nuevoRecord: true, guardado: true }),
  fin({ ...partida, estado: 'gano', cajas: 97 }, { record: 4947, nuevoRecord: true, guardado: true }),
  fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: false })
];

test('cada carácter de cada pantalla existe en la fuente', () => {
  for (const p of TODAS) for (const t of textos(p)) assert.deepEqual(faltantes(t), [], t);
});

test('el inicio: VIBORITA TBF, el récord con cuatro dígitos, JUGAR y TOCÁ EL CENTRO', () => {
  const p = inicio({ record: 31 });
  assert.ok(textos(p).includes('VIBORITA') && textos(p).includes('TBF'));
  assert.ok(textos(p).includes('RÉCORD 0031'));
  assert.equal(p.etiqueta, 'JUGAR');
  assert.deepEqual(p.epigrafe, ['TOCÁ EL CENTRO']);
  assert.ok(textos(inicio({ record: null })).includes('RÉCORD 0000'));
});

test('jugando: puntaje, acoplados, PAUSA y el récord abajo', () => {
  const p = jugando({ ...partida, cajas: 2 }, { record: 31 });
  assert.ok(textos(p).includes('0007'));
  assert.ok(textos(p).includes('X2'));
  assert.equal(p.etiqueta, 'PAUSA');
  assert.deepEqual(p.epigrafe, ['RÉCORD 0031']);
});

test('la pausa dice PAUSA encima del campo y el botón dice SEGUIR', () => {
  const p = pausa(partida, { record: 31 });
  assert.ok(p.ordenes.some((o) => o.op === 'borrar'));
  assert.ok(textos(p).includes('PAUSA'));
  assert.equal(p.etiqueta, 'SEGUIR');
});

test('al perder: GAME OVER, puntos, récord, acoplados y el motivo abajo', () => {
  const cola = fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: true });
  assert.ok(textos(cola).includes('GAME OVER'));
  assert.ok(textos(cola).includes('PUNTOS 0018'));
  assert.ok(textos(cola).includes('RÉCORD 0031'));
  assert.equal(cola.etiqueta, 'OTRA VEZ');
  assert.deepEqual(cola.epigrafe, ['TE ENGANCHASTE LA COLA']);

  const borde = fin({ ...partida, estado: 'choco', motivo: 'borde', cajas: 9 }, { record: 117, nuevoRecord: true, guardado: true });
  assert.ok(textos(borde).includes('¡NUEVO RÉCORD!'));
  assert.deepEqual(borde.epigrafe, ['CHOCASTE']);
});

test('al llenar el campo: ¡GANASTE!', () => {
  const p = fin({ ...partida, estado: 'gano', cajas: 97 }, { record: 4947, nuevoRecord: true, guardado: true });
  assert.ok(textos(p).includes('¡GANASTE!'));
  assert.deepEqual(p.epigrafe, ['LLENASTE EL CAMPO']);
});

test('si no se pudo guardar, el epígrafe lo dice', () => {
  const p = fin({ ...partida, estado: 'choco', motivo: 'cola', cajas: 4 }, { record: 31, nuevoRecord: false, guardado: false });
  assert.deepEqual(p.epigrafe, ['SIN SEÑAL:', 'RÉCORD NO GUARDADO']);
});

test('los píxeles: una línea prende sus puntos y borrar los apaga', () => {
  const prendidos = pixeles([{ op: 'linea', x0: 0, y0: 0, x1: 3, y1: 0 }, { op: 'borrar', x0: 1, y0: 0, x1: 1, y1: 0 }]);
  assert.deepEqual([...prendidos].sort((a, b) => a - b), [0, 2, 3]);
});

test('nada se dibuja afuera de la LCD', () => {
  for (const p of TODAS) for (const i of pixeles(p.ordenes)) assert.ok(i >= 0 && i < AN * AL, `${i}`);
});
```

- [ ] **Paso 2: verlo fallar**

Run: `node --test tests/web/viborita-pantallas.test.mjs` → FAIL (`Cannot find module`).

- [ ] **Paso 3: las pantallas**

`wwwroot/js/juegos/viborita/pantallas.js`:

```js
/**
 * Que dibuja la LCD de VIBORITA TBF en cada pantalla (spec §3).
 *
 * Devuelve ordenes de dibujo, no pixeles ni canvas: asi se prueba en node y la
 * vista solo pinta. Las coordenadas son pixeles de la LCD (102 x 128), las del
 * prototipo aprobado.
 */

import { spriteDe } from './dibujos.js';
import { puntos } from './reglas.js';

export const AN = 102;
export const AL = 128;
export const CAMPO_Y = 10;
export const CEL = 10;

const cuatro = (n) => String(Math.max(0, n ?? 0)).padStart(4, '0');

const texto = (t, x, y, k = 1) => ({ op: 'texto', t, x, y, k });
const centro = (t, y, k = 1) => ({ op: 'centro', t, y, k });
const sprite = (n, x, y) => ({ op: 'sprite', n, x, y });
const linea = (x0, y0, x1, y1) => ({ op: 'linea', x0, y0, x1, y1 });
const marco = (x0, y0, x1, y1) => ({ op: 'marco', x0, y0, x1, y1 });
const borrar = (x0, y0, x1, y1) => ({ op: 'borrar', x0, y0, x1, y1 });

/** La linea de abajo y lo que hace el boton del medio, centrado. */
const pie = (etiqueta) => [linea(0, AL - 11, AN - 1, AL - 11), centro(etiqueta, AL - 8)];

/** El camion de costado, decorativo: n acoplados y la cabina. */
const camionDeCostado = (x, y, acoplados) => [
  ...Array.from({ length: acoplados }, (_, i) => sprite('TRL_H', x + i * CEL, y)),
  sprite('CAB_R', x + acoplados * CEL, y)
];

export function inicio({ record }) {
  const etiqueta = 'JUGAR';
  return {
    ordenes: [
      { op: 'estado' },
      centro('VIBORITA', 16, 2), centro('TBF', 34, 2),
      ...camionDeCostado(14, 58, 3), sprite('CAJA', 76, 58),
      centro(`RÉCORD ${cuatro(record)}`, 84),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe: ['TOCÁ EL CENTRO']
  };
}

function campo(partida) {
  const ordenes = [marco(0, CAMPO_Y - 1, AN - 1, CAMPO_Y + 10 * CEL + 1)];
  partida.cuerpo.forEach((c, i) => ordenes.push(sprite(spriteDe(partida.cuerpo, i, partida.rumbo), 1 + c.x * CEL, CAMPO_Y + 1 + c.y * CEL)));
  if (partida.caja) ordenes.push(sprite('CAJA', 1 + partida.caja.x * CEL, CAMPO_Y + 1 + partida.caja.y * CEL));
  return ordenes;
}

export function jugando(partida, { record }) {
  const etiqueta = 'PAUSA';
  const acoplados = `X${partida.cuerpo.length - 1}`;
  return {
    ordenes: [
      texto(cuatro(puntos(partida.cajas)), 1, 1),
      texto(acoplados, AN - (acoplados.length * 6 - 1) - 1, 1),
      ...campo(partida),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe: [`RÉCORD ${cuatro(record)}`]
  };
}

export function pausa(partida, { record }) {
  const base = jugando(partida, { record });
  const etiqueta = 'SEGUIR';
  return {
    ordenes: [
      ...base.ordenes.slice(0, -2),
      borrar(24, 50, 77, 66), marco(24, 50, 77, 66), centro('PAUSA', 55),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe: base.epigrafe
  };
}

const MOTIVO = { cola: 'TE ENGANCHASTE LA COLA', borde: 'CHOCASTE' };

export function fin(partida, { record, nuevoRecord, guardado }) {
  const etiqueta = 'OTRA VEZ';
  const gano = partida.estado === 'gano';
  const acoplados = partida.cuerpo.length - 1;
  const epigrafe = guardado === false
    ? ['SIN SEÑAL:', 'RÉCORD NO GUARDADO']
    : [gano ? 'LLENASTE EL CAMPO' : MOTIVO[partida.motivo] ?? MOTIVO.cola];

  return {
    ordenes: [
      { op: 'estado' },
      centro(gano ? '¡GANASTE!' : 'GAME OVER', 14),
      linea(10, 24, AN - 11, 24),
      ...camionDeCostado(16, 32, 4), linea(68, 30, 68, 42),
      centro(`PUNTOS ${cuatro(puntos(partida.cajas))}`, 54),
      centro(nuevoRecord ? '¡NUEVO RÉCORD!' : `RÉCORD ${cuatro(record)}`, 66),
      centro(`X${acoplados} ACOPLADOS`, 78),
      ...pie(etiqueta)
    ],
    etiqueta,
    epigrafe
  };
}
```

`wwwroot/js/juegos/viborita/lcd.js`:

```js
/**
 * La LCD verde de VIBORITA TBF (spec §2.3), pintada en un canvas.
 *
 * `pixeles` decide que se prende (puro, probado en node); `pintar` lo pinta con
 * el aspecto aprobado: el verde con su degradado, la rejilla fantasma de la
 * matriz, la sombra de cada pixel corrida uno y las esquinas mas oscuras.
 */

import { SPRITES, FUENTE, anchoDeTexto } from './dibujos.js';
import { AN, AL } from './pantallas.js';

const LCD = { fondo: ['#b8d27a', '#97b555'], tinta: '#1b2412', sombra: 'rgba(27,36,18,.2)', fantasma: 'rgba(27,36,18,.07)' };

/** Los pixeles encendidos, como y * AN + x. Lo que cae afuera de la LCD no se prende. */
export function pixeles(ordenes) {
  const on = new Set();
  const prender = (x, y) => { if (x >= 0 && x < AN && y >= 0 && y < AL) on.add(y * AN + x); };
  const rect = (o, fn) => { for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) fn(x, y); };
  const escribir = (t, x0, y0, k) => {
    let cx = x0;
    for (const c of String(t)) {
      (FUENTE[c] ?? FUENTE[' ']).forEach((fila, j) => [...fila].forEach((p, i) => {
        if (p === '#') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) prender(cx + i * k + a, y0 + j * k + b);
      }));
      cx += 6 * k;
    }
  };

  for (const o of ordenes) {
    switch (o.op) {
      case 'texto': escribir(o.t, o.x, o.y, o.k ?? 1); break;
      case 'centro': escribir(o.t, Math.round((AN - anchoDeTexto(o.t, o.k ?? 1)) / 2), o.y, o.k ?? 1); break;
      case 'sprite': SPRITES[o.n].forEach((fila, j) => [...fila].forEach((p, i) => p === '#' && prender(o.x + i, o.y + j))); break;
      case 'linea': rect(o, prender); break;
      case 'marco':
        rect({ ...o, y1: o.y0 }, prender); rect({ ...o, y0: o.y1 }, prender);
        rect({ ...o, x1: o.x0 }, prender); rect({ ...o, x0: o.x1 }, prender);
        break;
      case 'borrar': rect(o, (x, y) => on.delete(y * AN + x)); break;
      case 'estado':
        // La barrita de senal y la pila del modo de espera, como en el 1100.
        [2, 3, 4, 5].forEach((h, i) => rect({ x0: 1 + i * 2, y0: 7 - h, x1: 1 + i * 2, y1: 6 }, prender));
        for (const r of [[AN - 9, 1, AN - 2, 1], [AN - 9, 6, AN - 2, 6], [AN - 9, 1, AN - 9, 6], [AN - 2, 1, AN - 2, 6], [AN - 1, 3, AN - 1, 4], [AN - 8, 2, AN - 3, 5]]) {
          rect({ x0: r[0], y0: r[1], x1: r[2], y1: r[3] }, prender);
        }
        break;
      default: break;
    }
  }
  return on;
}

/**
 * Pinta la LCD en el canvas, a `escala` px de pantalla por pixel de LCD. La escala
 * es siempre entera y se multiplica por la densidad del telefono: un pixel de LCD
 * nunca se dibuja borroso.
 */
export function pintar(canvas, ordenes, escala) {
  const dpr = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  const P = escala * dpr;
  const W = AN * P, H = AL * P;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${AN * escala}px`;
    canvas.style.height = `${AL * escala}px`;
  }
  const g = canvas.getContext('2d');

  const fondo = g.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, LCD.fondo[0]);
  fondo.addColorStop(1, LCD.fondo[1]);
  g.fillStyle = fondo;
  g.fillRect(0, 0, W, H);

  g.fillStyle = LCD.fantasma;
  for (let x = P; x < W; x += P) g.fillRect(x - Math.max(1, dpr / 2), 0, Math.max(1, dpr / 2), H);
  for (let y = P; y < H; y += P) g.fillRect(0, y - Math.max(1, dpr / 2), W, Math.max(1, dpr / 2));

  const on = pixeles(ordenes);
  g.fillStyle = LCD.sombra;
  for (const i of on) g.fillRect((i % AN + 1) * P, (Math.floor(i / AN) + 1) * P, P, P);
  g.fillStyle = LCD.tinta;
  for (const i of on) g.fillRect((i % AN) * P, Math.floor(i / AN) * P, P, P);

  const vineta = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.45, W / 2, H * 0.45, Math.max(W, H) * 0.75);
  vineta.addColorStop(0, 'rgba(0,0,0,0)');
  vineta.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = vineta;
  g.fillRect(0, 0, W, H);
}
```

- [ ] **Paso 4: verlo pasar**

Run: `node --test tests/web/viborita-pantallas.test.mjs` → PASS, 9 tests. Y todo:
`node --test "tests/web/*.test.mjs" 2>&1 | grep -E "ℹ (pass|fail)"` → `fail 0`.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/juegos/viborita/pantallas.js src/TruckNavigator.Api/wwwroot/js/juegos/viborita/lcd.js tests/web/viborita-pantallas.test.mjs
git commit -m "Viborita: lo que dibuja cada pantalla, y la LCD verde en canvas"
```

---

### Tarea 7: la vibración, la API y el zócalo

**Files:**
- Modify: `wwwroot/js/platform.js` (`VIBRACION`)
- Modify: `wwwroot/js/api.js` (sección de progresión)
- Modify: `wwwroot/js/dock.js` (oyente y visibilidad; `cubre` de juegos)
- Test: `tests/web/vibracion.test.mjs`

**Interfaces:**
- Produces: `VIBRACION.caja`, `VIBRACION.choque`; `api.viboritaPartida(cajas, duracionMs)`;
  el evento `pantalla-completa` (`detail: { activa: boolean }`) que esconde el zócalo.

- [ ] **Paso 1: el test que falla**

Al final de `tests/web/vibracion.test.mjs`:

```js
test('la Viborita vibra con dos patrones propios: la caja y el choque', () => {
  const viejos = ['maniobra', 'galibo', 'radar', 'paso', 'reporte', 'peligro'].map((k) => VIBRACION[k].join(','));
  assert.ok(Array.isArray(VIBRACION.caja) && Array.isArray(VIBRACION.choque));
  assert.ok(!viejos.includes(VIBRACION.caja.join(',')));
  assert.ok(!viejos.includes(VIBRACION.choque.join(',')));
  assert.ok(VIBRACION.caja.reduce((a, b) => a + b, 0) < 60, 'la caja es un toque corto');
});
```

- [ ] **Paso 2: verlo fallar**

Run: `node --test tests/web/vibracion.test.mjs` → FAIL.

- [ ] **Paso 3: los patrones, la API y el zócalo**

En `VIBRACION` de `platform.js`, después de `peligro`:

```js
  ,

  /** La Viborita TBF: levantar una caja. Un toque cortisimo: pasa seguido. */
  caja: [25],

  /** La Viborita TBF: el choque. Un golpe y un rebote, distinto de todo lo del viaje. */
  choque: [140, 60, 60]
```

(el `,` va pegado al cierre de `peligro: [180, 100, 180]`).

En `api.js`, después de `equip: …`:

```js
  ,

  // La Viborita TBF: el telefono informa cajas y duracion; los puntos y el record
  // los calcula el servidor.
  viboritaPartida: (cajas, duracionMs) => post('/api/juegos/viborita/partidas', { cajas, duracionMs })
```

En `dock.js`: junto a `let enViaje = false;` agregar `let pantallaCompleta = false;`;
en `aplicarVisibilidad` reemplazar `nodo.hidden = !permitido || enViaje;` por
`nodo.hidden = !permitido || enViaje || pantallaCompleta;`; y después del oyente de
`viaje`:

```js
  // Una pantalla que ocupa todo —la Viborita TBF— tambien lo esconde, por el
  // mismo camino: un evento, para que el juego no tenga que conocer al zocalo.
  document.addEventListener('pantalla-completa', (e) => {
    pantallaCompleta = Boolean(e.detail?.activa);
    if (pantallaCompleta) hojaAbierta = false;
    draw();
  });
```

y en `ACCESOS`, el de juegos pasa a `cubre: ['juegos', 'viborita']`.

- [ ] **Paso 4: verlo pasar**

Run: `node --test "tests/web/*.test.mjs" 2>&1 | grep -E "ℹ (pass|fail)"` → `fail 0`.

- [ ] **Paso 5: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/platform.js src/TruckNavigator.Api/wwwroot/js/api.js src/TruckNavigator.Api/wwwroot/js/dock.js tests/web/vibracion.test.mjs
git commit -m "Viborita: sus dos vibraciones, el pedido al servidor y el zocalo que se esconde"
```

---

### Tarea 8: la pantalla del juego

**Files:**
- Create: `wwwroot/js/views/viborita.js`
- Modify: `wwwroot/js/app.js` (import, `ROUTES`, `NECESITAN_CUENTA`)
- Modify: `wwwroot/js/views/juegos.js` (la fila de la Viborita)
- Modify: `wwwroot/app.css` (sección nueva al final)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la ruta `viborita`; `viboritaView(host, { go }) → teardown`.

- [ ] **Paso 1: la vista**

`wwwroot/js/views/viborita.js`:

```js
/**
 * VIBORITA TBF: el Snake del 1100 con un camion (spec 2026-10-03-viborita-tbf).
 *
 * La pantalla entera es el telefono de la epoca: la carcasa de plastico azul, el
 * frente plateado con TBF, la LCD verde y la cruceta de la referencia. Nada de la
 * estetica de la app (spec §2). El motor, las reglas y lo que dibuja cada pantalla
 * son puros y viven en js/juegos/viborita/; aca va el reloj, los controles y el
 * servidor.
 */

import { api } from '../api.js';
import { vibrate, VIBRACION } from '../platform.js';
import { crearPartida, girar, avanzar } from '../juegos/viborita/motor.js';
import { pasoMs } from '../juegos/viborita/reglas.js';
import { inicio, jugando, pausa, fin, AN, AL } from '../juegos/viborita/pantallas.js';
import { pintar } from '../juegos/viborita/lcd.js';
import { FUENTE, anchoDeTexto } from '../juegos/viborita/dibujos.js';

const FLECHA = '<svg viewBox="0 0 40 40" width="38" height="38"><path d="M20 6 L34 22 H25 V34 H15 V22 H6 Z" fill="#a9c07c" stroke="#1d2418" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const TECLAS = { ArrowUp: 'arr', ArrowDown: 'aba', ArrowLeft: 'izq', ArrowRight: 'der' };

/** Un texto en la fuente de pixel, como SVG: los epigrafes y el SALIR de afuera. */
function rotulo(t, color, k = 2) {
  const px = [];
  let cx = 0;
  for (const c of t) {
    (FUENTE[c] ?? FUENTE[' ']).forEach((f, j) => [...f].forEach((p, i) => p === '#' && px.push([cx + i, j])));
    cx += 6;
  }
  const W = anchoDeTexto(t) * k, H = 7 * k;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;shape-rendering:crispEdges" aria-label="${t}">${px.map(([x, y]) => `<rect x="${x * k}" y="${y * k}" width="${k}" height="${k}" fill="${color}"/>`).join('')}</svg>`;
}

export function viboritaView(host, { go }) {
  host.className = 'viborita';
  host.innerHTML = `
    <button type="button" class="vb-salir" aria-label="Salir">${rotulo('< SALIR', '#9aa6b8')}</button>
    <div class="vb-carcasa"><span class="vb-canto"></span><span class="vb-veta"></span>
      <div class="vb-frente">
        <div class="vb-parlante"><i></i></div>
        <div class="vb-marca">TBF</div>
        <div class="vb-marco"><div class="vb-hundido"><canvas class="vb-lcd" aria-label="Pantalla del juego"></canvas></div></div>
      </div>
    </div>
    <div class="vb-cruceta">
      <button type="button" class="vb-k vb-arr" data-dir="arr" aria-label="Arriba">${FLECHA}</button>
      <button type="button" class="vb-k vb-izq" data-dir="izq" aria-label="Izquierda">${FLECHA}</button>
      <button type="button" class="vb-k vb-centro" aria-label="Centro"><span class="vb-aro"></span></button>
      <button type="button" class="vb-k vb-der" data-dir="der" aria-label="Derecha">${FLECHA}</button>
      <button type="button" class="vb-k vb-aba" data-dir="aba" aria-label="Abajo">${FLECHA}</button>
    </div>
    <div class="vb-epigrafe"></div>`;

  document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: true } }));

  const canvas = host.querySelector('.vb-lcd');
  const epigrafe = host.querySelector('.vb-epigrafe');

  let modo = 'inicio';             // inicio | jugando | pausa | fin
  let partida = crearPartida();
  let record = null;               // el valor, o null si nunca jugo
  let resultado = null;            // lo que devolvio el servidor al terminar
  let reloj = null;
  let jugadoMs = 0;                // sin contar las pausas
  let desde = 0;

  // La escala del pixel: entera (un pixel de LCD nunca borroso), la mas grande que
  // entra a lo ancho y a lo alto. Lo alto se mide: todo lo que no es la LCD
  // (salir, carcasa, cruceta, epigrafe) ocupa lo que ocupa, y la LCD toma el resto.
  let p = 3;
  const escala = () => p;
  function medir() {
    const cromo = host.scrollHeight - canvas.clientHeight;
    const porAlto = Math.floor((window.innerHeight - cromo) / AL);
    const porAncho = Math.floor((Math.min(window.innerWidth, 520) - 60) / AN);
    const nueva = Math.max(2, Math.min(5, porAlto, porAncho));
    if (nueva !== p) { p = nueva; dibujar(); }
  }

  function dibujar() {
    const p = modo === 'inicio' ? inicio({ record })
      : modo === 'jugando' ? jugando(partida, { record })
      : modo === 'pausa' ? pausa(partida, { record })
      : fin(partida, { record: resultado?.record?.valor ?? record, nuevoRecord: Boolean(resultado?.nuevoRecord), guardado: resultado ? resultado.guardado !== false : undefined });
    pintar(canvas, p.ordenes, escala());
    epigrafe.innerHTML = p.epigrafe.map((t) => rotulo(t, modo === 'jugando' || modo === 'pausa' ? '#9aa6b8' : '#e6ead8')).join('');
  }

  function programar() {
    clearTimeout(reloj);
    reloj = setTimeout(paso, pasoMs(partida.cajas));
  }

  function paso() {
    const { partida: siguiente, evento } = avanzar(partida);
    partida = siguiente;
    if (evento === 'caja') vibrate(VIBRACION.caja);
    if (evento === 'choque' || evento === 'gano') {
      vibrate(evento === 'gano' ? VIBRACION.caja : VIBRACION.choque);
      terminar();
      return;
    }
    dibujar();
    programar();
  }

  function empezar() {
    partida = crearPartida();
    resultado = null;
    jugadoMs = 0;
    desde = performance.now();
    modo = 'jugando';
    dibujar();
    programar();
  }

  function pausar() {
    if (modo !== 'jugando') return;
    clearTimeout(reloj);
    jugadoMs += performance.now() - desde;
    modo = 'pausa';
    dibujar();
  }

  function seguir() {
    desde = performance.now();
    modo = 'jugando';
    dibujar();
    programar();
  }

  async function terminar() {
    clearTimeout(reloj);
    jugadoMs += performance.now() - desde;
    modo = 'fin';
    dibujar();
    try {
      const r = await api.viboritaPartida(partida.cajas, Math.round(jugadoMs));
      resultado = { ...r, guardado: true };
      if (r.record) record = r.record.valor;
    } catch {
      resultado = { guardado: false };
    }
    if (modo === 'fin') dibujar();
  }

  const centro = () => ({ inicio: empezar, jugando: pausar, pausa: seguir, fin: empezar }[modo])();
  const doblar = (dir) => { if (modo === 'jugando') partida = girar(partida, dir); };

  host.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); doblar(b.dataset.dir); }));
  host.querySelector('.vb-centro').addEventListener('pointerdown', (e) => { e.preventDefault(); centro(); });
  host.querySelector('.vb-salir').addEventListener('click', () => (modo === 'jugando' ? pausar() : go('juegos')));

  // Deslizar el dedo sobre la LCD tambien gira: solo adentro de la pantalla, para
  // no pelearse con el gesto de volver de Android.
  const pantalla = host.querySelector('.vb-hundido');
  let toque = null;
  pantalla.addEventListener('touchstart', (e) => { toque = e.touches[0]; }, { passive: true });
  pantalla.addEventListener('touchend', (e) => {
    if (!toque) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toque.clientX, dy = t.clientY - toque.clientY;
    toque = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    doblar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'der' : 'izq') : (dy > 0 ? 'aba' : 'arr'));
  });

  const alTeclado = (e) => {
    if (TECLAS[e.key]) { e.preventDefault(); doblar(TECLAS[e.key]); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); centro(); }
  };
  document.addEventListener('keydown', alTeclado);

  // Se pausa sola si la app pasa a segundo plano.
  const alOcultar = () => { if (document.hidden) pausar(); };
  document.addEventListener('visibilitychange', alOcultar);

  api.progressRecords()
    .then((lista) => {
      const r = lista.find((x) => x.recordCode === 'viborita');
      record = r ? r.value : null;
      if (modo === 'inicio') dibujar();
    })
    .catch(() => {});

  dibujar();
  medir();
  window.addEventListener('resize', medir);

  return () => {
    clearTimeout(reloj);
    window.removeEventListener('resize', medir);
    document.removeEventListener('keydown', alTeclado);
    document.removeEventListener('visibilitychange', alOcultar);
    document.dispatchEvent(new CustomEvent('pantalla-completa', { detail: { activa: false } }));
  };
}
```

- [ ] **Paso 2: la ruta y la fila de Juegos**

En `app.js`: `import { viboritaView } from './views/viborita.js';` junto al de juegos; en
`ROUTES`, `viborita: viboritaView,`; en `NECESITAN_CUENTA`, `viborita: 'juegos'`.

En `views/juegos.js`, antes de la tarjeta de la trivia:

```js
      <button class="card stack juego-fila" id="to-viborita" type="button">
        <h2>Viborita TBF</h2>
        <p class="muted">El Snake del 1100, con tu camión: cada caja es un acoplado más. No te enganches la cola.</p>
        <span class="btn btn-primary btn-duo">JUGAR</span>
      </button>
```

y en `wire`: `'#to-viborita': () => go('viborita'),`.

- [ ] **Paso 3: el CSS**

Al final de `app.css`, la sección con el contorno y la cruceta del prototipo
(`docs/diseno/prototipo-viborita/viborita.mjs`), con los nombres `vb-*`. El grano del
plástico se arma con `ruido(alfa, frecuencia, color)` del prototipo: generar los tres
`url("data:image/svg+xml,…")` corriendo esta línea y pegar la salida en `background`:

```bash
node -e "const r=(a,f,c)=>'url(\"data:image/svg+xml,'+encodeURIComponent(\"<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='\"+f+\"' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 \"+c+\"  0 0 0 0 \"+c+\"  0 0 0 0 \"+c+\"  0 0 0 \"+a+\" 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>\")+'\")';console.log([r('.55','.95','1'),r('.65','1.8','0'),r('.35','.35','0')].join(',\n'))"
```

```css
/* ===========================================================================
   VIBORITA TBF (spec 2026-10-03-viborita-tbf). La pantalla entera es un 1100:
   nada de la estetica de la app. Medidas y colores del prototipo aprobado.
=========================================================================== */
.viborita{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;gap:18px;padding:calc(14px + var(--safe-top,0px)) 0 calc(16px + var(--safe-bottom,0px));
  background:linear-gradient(180deg,#141d28,#0c121a);overflow:hidden;touch-action:none}
.vb-salir{align-self:flex-start;margin-left:22px;background:none;border:0;padding:6px 0;cursor:pointer}
.vb-carcasa{position:relative;padding:20px;border-radius:62px 62px 44px 44px;
  background:/* los tres ruidos generados arriba */,linear-gradient(158deg,#34507f 0%,#22385e 28%,#172848 58%,#0d1730 100%);
  background-blend-mode:soft-light,soft-light,multiply,normal;
  box-shadow:inset 0 2px 1px rgba(200,220,255,.45),inset 0 7px 10px rgba(150,180,240,.12),inset 0 -4px 6px rgba(0,0,0,.6),inset -5px 0 9px rgba(0,0,0,.35),inset 5px 0 9px rgba(120,160,230,.14),
    0 0 0 1px #050914,0 2px 0 1px rgba(110,140,200,.18),0 18px 34px rgba(0,0,0,.65),0 4px 8px rgba(0,0,0,.5)}
.vb-carcasa::after{content:"";position:absolute;inset:11px;border-radius:52px 52px 34px 34px;pointer-events:none;
  box-shadow:0 0 0 1px rgba(150,180,235,.28),inset 0 0 0 1px rgba(0,0,0,.55),inset 0 2px 3px rgba(0,0,0,.45)}
.vb-canto{position:absolute;left:6px;top:46px;bottom:60px;width:9px;border-radius:9px;pointer-events:none;
  background:linear-gradient(180deg,rgba(190,215,255,0),rgba(190,215,255,.42) 22%,rgba(190,215,255,.16) 60%,rgba(190,215,255,0));filter:blur(2px)}
.vb-veta{position:absolute;left:52px;right:52px;top:4px;height:6px;border-radius:6px;pointer-events:none;
  background:linear-gradient(90deg,rgba(220,235,255,0),rgba(220,235,255,.35),rgba(220,235,255,0));filter:blur(1.5px)}
.vb-frente{position:relative;z-index:1;border-radius:44px 44px 26px 26px;padding:12px 12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;
  background:linear-gradient(180deg,#e4e7ea 0%,#c3c8cd 30%,#a7adb3 70%,#8f959c 100%);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.9),inset 0 -3px 6px rgba(0,0,0,.25),0 0 0 1.5px #070b14,0 0 0 2.5px rgba(160,190,240,.22),0 3px 6px rgba(0,0,0,.45)}
.vb-parlante{width:96px;height:9px;border-radius:5px;background:#2a2e34;box-shadow:inset 0 2px 2px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.7);position:relative;overflow:hidden}
.vb-parlante i{position:absolute;right:8px;top:3px;width:26px;height:3px;border-radius:2px;background:#7c838c}
.vb-marca{font:900 23px "Arial Black",Arial,sans-serif;letter-spacing:.08em;color:#20252c;text-shadow:0 1px 0 rgba(255,255,255,.75)}
.vb-marco{padding:9px;border-radius:20px;background:linear-gradient(180deg,#d2d6da,#a2a8ae);box-shadow:inset 0 1px 0 #f4f6f8,inset 0 -1px 0 rgba(0,0,0,.25),0 1px 0 rgba(255,255,255,.6)}
.vb-hundido{border-radius:12px;overflow:hidden;box-shadow:0 0 0 3px #2d3238,0 0 0 4px #1a1d21;position:relative;line-height:0}
.vb-hundido::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 3px 6px rgba(0,0,0,.35);background:linear-gradient(160deg,rgba(255,255,255,.18),rgba(255,255,255,0) 35%)}
.vb-lcd{display:block;image-rendering:pixelated}
.vb-cruceta{--k:clamp(50px,7.6vh,70px);display:grid;grid-template-columns:repeat(3,var(--k));grid-template-rows:repeat(3,var(--k));gap:clamp(6px,1.1vh,10px)}
.vb-k{border:0;padding:0;border-radius:14px;display:grid;place-items:center;cursor:pointer;background:linear-gradient(180deg,#1f2732,#151b23);
  box-shadow:inset 0 0 0 2.5px #93a874,inset 0 0 0 4.5px #1a2018,0 3px 0 #06090d;-webkit-tap-highlight-color:transparent}
.vb-k:active{transform:translateY(2px);box-shadow:inset 0 0 0 2.5px #93a874,inset 0 0 0 4.5px #1a2018,0 1px 0 #06090d}
.vb-arr{grid-area:1/2}.vb-izq{grid-area:2/1}.vb-centro{grid-area:2/2}.vb-der{grid-area:2/3}.vb-aba{grid-area:3/2}
.vb-izq svg{transform:rotate(270deg)}.vb-der svg{transform:rotate(90deg)}.vb-aba svg{transform:rotate(180deg)}
.vb-aro{width:30px;height:30px;border-radius:50%;border:3px solid #93a874;background:#1a2018}
.vb-epigrafe{display:flex;flex-direction:column;align-items:center;gap:6px;min-height:14px}
/* En un telefono angosto (360-399) la LCD a escala 3 (306) mas los bordes del
   prototipo (82) no entra: se achican los bordes, 306 + 52 = 358. */
@media (max-width:399px){.vb-carcasa{padding:12px}.vb-frente{padding:10px 8px 12px}.vb-marco{padding:6px}.vb-carcasa::after{inset:6px}}
/* En uno bajo, menos aire entre las piezas. */
@media (max-height:820px){.viborita{gap:10px}}
```

Reemplazar `/* los tres ruidos generados arriba */` por la salida del comando.

- [ ] **Paso 4: todo en verde**

Run: `node --test "tests/web/*.test.mjs" 2>&1 | grep -E "ℹ (pass|fail)"` → `fail 0`.

- [ ] **Paso 5: verificarlo en el navegador**

Preview `api`, entrar con la cuenta de prueba de desarrollo y ir a `#viborita`. **Probar a
360 × 740, 375 × 812 y 412 × 915**: en los tres entra todo sin scroll, la LCD a escala
entera (medir `canvas.style.width`: 306 o 408, nunca otro número) y la cruceta completa. Contra el prototipo (`node docs/diseno/prototipo-viborita/viborita.mjs …`):

1. **Inicio**: VIBORITA / TBF, el camión, RÉCORD, JUGAR, *TOCÁ EL CENTRO*; el zócalo no está.
2. **Jugar** con la cruceta y con el teclado (flechas, Enter): el camión avanza, dobla,
   levanta cajas, el puntaje y la X crecen.
3. **Pausa** con el centro y con SALIR; **seguir**.
4. **Perder** contra el borde (*CHOCASTE*) y contra la cola (*TE ENGANCHASTE LA COLA*).
5. **El récord**: `read_network_requests` muestra el `POST /api/juegos/viborita/partidas`
   con `{cajas, duracionMs}`; recargar y el inicio muestra el récord nuevo.
6. **Sin sesión** (invitado): `#viborita` muestra el aviso de cuenta de Juegos.
7. Consola sin errores. Volver a Juegos: el zócalo vuelve.

Fotos de las cuatro pantallas para mostrarle al usuario.

- [ ] **Paso 6: commit**

```bash
git add src/TruckNavigator.Api/wwwroot/js/views/viborita.js src/TruckNavigator.Api/wwwroot/js/app.js src/TruckNavigator.Api/wwwroot/js/views/juegos.js src/TruckNavigator.Api/wwwroot/app.css
git commit -m "Viborita TBF: la pantalla del 1100, jugable desde Juegos"
```

---

### Tarea 9: la documentación

**Files:**
- Modify: `docs/decisions.md` (AD nueva: el número que siga al último que haya en `main`)
- Modify: `CLAUDE.md` (conteos de tests; la tabla de estructura si cambia; una trampa)
- Modify: `.claude/skills/producto-camiones-app/SKILL.md` (la fila de los juegos)
- Modify: `.claude/skills/diseno-camiones-app/SKILL.md` (sección nueva: la Viborita)
- Modify: `.claude/skills/estado-camiones-app/SKILL.md` (punta y frente vivo)

- [ ] **Paso 1: la decisión**

Agregar al final de `docs/decisions.md`, con el formato de las anteriores:
**"La Viborita TBF: el primer juego, y el primer récord"**. Contexto: el pedido y las cinco
vueltas de diseño (spec §1). Decisiones: la pantalla es un 1100 y no la app (la excepción
al lenguaje Duolingo, pedida por el usuario); el récord usa `DriverRecord` y
`PersonalRecords.Improve`, y es el primero en esa tabla; el servidor calcula los puntos y
rechaza lo imposible; la LCD en canvas a escala entera. Descartado: SVG por píxel (miles de
nodos por paso), EXP en esta etapa, sonido. Consecuencias: los números de tests nuevos y lo
verificado.

- [ ] **Paso 2: CLAUDE.md**

- Los conteos: `dotnet test` y la línea de `node --test` con el número que dé cada uno, y
  en la lista de temas de la web sumar "la Viborita TBF (motor, dibujos, pantallas)".
- La fila de `IntegrationTests` en la tabla de estructura: el número nuevo y "el récord de
  la Viborita".
- Una trampa, escrita así: **"Un carácter que falta en una fuente de píxel no se dibuja y
  no avisa."** Al hacer el prototipo de la Viborita pasó tres veces (la D, la X, la H y el
  `<`): el texto salía con huecos. `dibujos.js` tiene `faltantes` y un test que recorre
  cada texto de cada pantalla.

- [ ] **Paso 3: las skills**

- `producto-camiones-app`: en la fila de "los otros cuatro juegos", la viborita pasa a
  hecha (✅, 03/10/2026) con el nombre VIBORITA TBF; quedan tres.
- `diseno-camiones-app`: sección nueva **"18. La Viborita TBF"** con la regla —la pantalla
  del juego es un 1100, sin la estética de la app, por pedido del usuario— y los recursos
  aprobados (carcasa de plástico azul con grano, frente plateado con TBF, LCD verde, la
  cruceta), con el puntero a `docs/diseno/prototipo-viborita/`. Y la lección de las cinco
  vueltas: **cuando el usuario manda una referencia, se toma de la referencia, no de la
  app**.
- `estado-camiones-app`: la punta y la Fase 6 con el primer juego.

- [ ] **Paso 4: commit**

```bash
git add docs/decisions.md CLAUDE.md .claude/skills/producto-camiones-app/SKILL.md .claude/skills/diseno-camiones-app/SKILL.md .claude/skills/estado-camiones-app/SKILL.md
git commit -m "Docs de la Viborita TBF: la decision, las trampas y las skills"
```

---

### Tarea 10: el teléfono y el PR

- [ ] **Paso 1: el APK**

Con el teléfono conectado: `.\demo-up.ps1`, `.\build-apk.ps1 -ApiUrl <túnel> -Push`, y
`git checkout -- src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs`. Log a un archivo
con `adb logcat -v time -s Web Cascara` como proceso aparte.

- [ ] **Paso 2: lo que sólo se ve en el teléfono**

El usuario juega. Se mira: el deslizar gira y no dispara el gesto de volver; la vibración de
la caja y la del choque se distinguen; la LCD se ve nítida (sin borroso); a 140 ms no se
traba; salir de la app pausa. El log, sin errores.

- [ ] **Paso 3: el PR**

```bash
node --test "tests/web/*.test.mjs" 2>&1 | grep -E "ℹ (pass|fail)"
dotnet test --nologo -v q
git push -u origin viborita-tbf
gh pr create --base main --title "VIBORITA TBF: el Snake del 1100 con un camion, y el primer record" --body-file <archivo del scratchpad>
```

El cuerpo: qué es, las cinco vueltas de diseño, qué se construyó, cómo se verificó (tests,
navegador, teléfono) y lo que queda afuera (EXP, batería, ranking, sonido). Termina con la
línea de atribución de Claude Code. Después, `demo-down.ps1` y bajar el log y el
anti-suspensión. **No fusionar.**
