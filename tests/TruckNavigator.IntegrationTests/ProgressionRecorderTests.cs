using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El enganche: que pasa cuando el servidor cierra un viaje.
/// </summary>
/// <remarks>
/// Es el unico momento en que se otorga algo. El cliente no participa: no hay
/// ningun endpoint que reciba "gane 20 de EXP", por el mismo motivo por el que los
/// kilometros se acreditan del lado del servidor.
/// </remarks>
public sealed class ProgressionRecorderTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private ProgressionRecorder _recorder = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _recorder = new ProgressionRecorder(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> CreateDriverAsync()
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "uno@camiones.test",
            NormalizedEmail = "UNO@CAMIONES.TEST",
            UserName = "uno@camiones.test",
            NormalizedUserName = "UNO@CAMIONES.TEST",
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return user.Id;
    }

    private async Task<Trip> FinishTripAsync(Guid driverId, double meters)
    {
        var trip = new Trip
        {
            DriverId = driverId,
            TruckName = "Semi",
            PlannedDistanceMeters = meters,
            PlannedDurationSeconds = 3_600,
            StartedAt = DateTimeOffset.Parse("2026-03-14T15:00:00Z")
        };

        trip.Finish(trip.StartedAt.AddHours(1));

        _db.Trips.Add(trip);
        await _db.SaveChangesAsync();

        return trip;
    }

    [Fact]
    public async Task Finishing_a_trip_credits_experience_and_advances_the_tracks()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 120_000);

        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        var viajes = await _db.TrackProgress.SingleAsync(t => t.TrackCode == "viajes");
        Assert.Equal(1, viajes.Count);

        var kilometraje = await _db.TrackProgress.SingleAsync(t => t.TrackCode == TrackCatalog.Mileage);
        Assert.Equal(120, kilometraje.Count);

        Assert.Contains(
            await _db.LedgerEntries.ToListAsync(),
            e => e.Reason == LedgerReason.TripCompleted && e.SourceKey == trip.Id.ToString());
    }

    /// <remarks>
    /// <para>
    /// <b>Lo que se acredita sale de la distancia, no de una constante.</b> Es el
    /// unico test que cruza la regla del dominio con lo que termina escrito en el
    /// libro: <see cref="ExperienceScale"/> se prueba sola, pero que el registrador
    /// la use —y no un 20 pegado— solo se ve aca.
    /// </para>
    /// <para>
    /// Y usa la distancia <b>acreditada</b>, que es la que el servidor midio, no la
    /// planificada. Si tomara la planificada, un viaje que se corto a la mitad
    /// pagaria entero.
    /// </para>
    /// </remarks>
    [Theory]
    [InlineData(20_000, 12)]
    [InlineData(120_000, 22)]
    [InlineData(300_000, 40)]
    public async Task The_experience_of_a_trip_comes_from_how_far_it_went(double meters, int expected)
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters);

        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        var entry = await _db.LedgerEntries.SingleAsync(e => e.Reason == LedgerReason.TripCompleted);

        Assert.Equal(expected, entry.Amount);
    }

    /// <remarks>
    /// El escalon paga mas que el viaje mas largo que lleva a el. Si no, el camino
    /// valdria mas que llegar, y el logro se sentiria un tramite.
    /// </remarks>
    [Fact]
    public async Task A_completed_tier_pays_more_than_the_trip_that_completed_it()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 300_000);

        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        var porElViaje = await _db.LedgerEntries.SingleAsync(e => e.Reason == LedgerReason.TripCompleted);
        var porEscalon = await _db.LedgerEntries.FirstAsync(e => e.Reason == LedgerReason.TierCompleted);

        Assert.Equal(100, porEscalon.Amount);
        Assert.True(porEscalon.Amount > porElViaje.Amount);
    }

    /// <remarks>
    /// Un reintento, un doble toque o un cierre procesado dos veces son cosas que
    /// van a pasar. Cada una no puede regalar EXP.
    /// </remarks>
    [Fact]
    public async Task Recording_the_same_trip_twice_credits_once()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 120_000);

        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);
        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        var viajes = await _db.TrackProgress.SingleAsync(t => t.TrackCode == "viajes");

        Assert.Equal(1, viajes.Count);
        Assert.Single(await _db.LedgerEntries.Where(e => e.Reason == LedgerReason.TripCompleted).ToListAsync());
    }

    /// <remarks>
    /// El primer escalon de viajes es 1, asi que el primer viaje ya desbloquea algo.
    /// Sin esto el ciclo no cierra: se completa una meta y no llega nada al
    /// inventario.
    /// </remarks>
    [Fact]
    public async Task Crossing_a_tier_puts_its_reward_in_the_inventory()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 120_000);

        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        Assert.Contains(await _db.Rewards.ToListAsync(), r => r.RewardCode == "viajes-01");
    }

    /// <remarks>
    /// <b>Los metros sueltos no se pierden.</b> Tres viajes de 900 m suman 2 km, no
    /// cero: el kilometraje se recalcula del total acreditado y no se redondea viaje
    /// por viaje. Sobre cientos de viajes, redondear cada uno se come kilometros de
    /// verdad.
    /// </remarks>
    [Fact]
    public async Task Mileage_is_recomputed_from_the_total_and_loses_no_metres()
    {
        var driver = await CreateDriverAsync();

        foreach (var _ in Enumerable.Range(0, 3))
        {
            var trip = await FinishTripAsync(driver, meters: 900);
            await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);
        }

        var kilometraje = await _db.TrackProgress.SingleAsync(t => t.TrackCode == TrackCatalog.Mileage);

        Assert.Equal(2, kilometraje.Count);
    }
}
