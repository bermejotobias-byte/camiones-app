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
