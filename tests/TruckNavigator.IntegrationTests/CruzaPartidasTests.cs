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
