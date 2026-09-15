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
    /// <para>
    /// <b>Lo que se acredito se devuelve, para que la pantalla de fin de viaje lo
    /// muestre.</b> Hasta ahora el motor acreditaba en silencio: el camionero
    /// cerraba el viaje y no veia nada. La pantalla de fin de viaje muestra las
    /// estadisticas, la EXP ganada y lo desbloqueado (decision del usuario del
    /// 10/09/2026), y para eso el cierre tiene que decir que paso.
    /// </para>
    /// <para>
    /// El primer viaje completa el primer escalon de "viajes" (objetivo 1), asi que
    /// ademas de la EXP del viaje se acredita la del escalon.
    /// </para>
    /// </remarks>
    [Fact]
    public async Task Recording_reports_what_the_trip_earned()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 300_000);

        var earned = await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        Assert.NotNull(earned);
        Assert.Equal(40, earned.TripExperience);
        Assert.Contains(earned.CompletedTiers, t => t.TrackCode == "viajes" && t.Tier == 1);
        Assert.Equal(earned.CompletedTiers.Count * 100, earned.TierExperience);
        Assert.Equal(1, earned.LevelBefore.Number);
        Assert.Equal(1, earned.LevelAfter.Number);
    }

    /// <remarks>
    /// Subir de nivel es el momento mas grande del sistema y la pantalla tiene que
    /// saberlo: se devuelve el nivel de antes y el de despues. 2.500 km es el
    /// umbral de Repartidor.
    /// </remarks>
    [Fact]
    public async Task Recording_reports_a_level_up_when_the_trip_crosses_the_threshold()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 2_600_000);

        var earned = await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        Assert.NotNull(earned);
        Assert.Equal(1, earned.LevelBefore.Number);
        Assert.Equal(2, earned.LevelAfter.Number);
        Assert.Equal("Repartidor", earned.LevelAfter.Name);
    }

    /// <remarks>
    /// La segunda vez no hay nada que contar: se devuelve null, no un resultado
    /// vacio, para que quien llama no pueda mostrar una celebracion de cero.
    /// </remarks>
    [Fact]
    public async Task Recording_the_same_trip_twice_reports_nothing_the_second_time()
    {
        var driver = await CreateDriverAsync();
        var trip = await FinishTripAsync(driver, meters: 120_000);

        var primera = await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);
        var segunda = await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);

        Assert.NotNull(primera);
        Assert.Null(segunda);
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

    // ---------------------------------------------------------------- aportes
    //
    // Un voto o un lugar nuevo entran por la misma puerta que los viajes: el
    // cliente pide, el servidor decide, y el indice unico impide cobrar dos veces.

    private static readonly DateTimeOffset Contributed = DateTimeOffset.Parse("2026-09-15T15:00:00Z");

    [Fact]
    public async Task A_vote_pays_two_and_lights_the_first_tier_of_places()
    {
        var driver = await CreateDriverAsync();
        var poi = Guid.NewGuid();

        var earned = await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, $"poi-vote:{poi}", Contributed);

        Assert.NotNull(earned);
        Assert.Equal(ExperienceScale.PlaceVote, earned!.ContributionExperience);
        Assert.Single(earned.CompletedTiers);
        Assert.Equal(TrackCatalog.Places, earned.CompletedTiers[0].TrackCode);
        Assert.Equal(ExperienceScale.PerTier, earned.TierExperience);
        Assert.Equal(ExperienceScale.PlaceVote + ExperienceScale.PerTier, earned.TotalExperience);

        var rewards = await _db.Rewards.Where(r => r.DriverId == driver).Select(r => r.RewardCode).ToListAsync();
        Assert.Contains("lugares-01", rewards);

        var lugares = await _db.TrackProgress.SingleAsync(t => t.DriverId == driver && t.TrackCode == TrackCatalog.Places);
        Assert.Equal(1, lugares.Count);
        Assert.Equal(1, lugares.TierReached);
    }

    [Fact]
    public async Task The_same_place_never_pays_twice()
    {
        var driver = await CreateDriverAsync();
        var key = $"poi-vote:{Guid.NewGuid()}";

        Assert.NotNull(await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, key, Contributed));
        Assert.Null(await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, key, Contributed.AddDays(1)));

        var lugares = await _db.TrackProgress.SingleAsync(t => t.DriverId == driver && t.TrackCode == TrackCatalog.Places);
        Assert.Equal(1, lugares.Count);

        var experience = await _db.LedgerEntries.Where(e => e.DriverId == driver && e.Reason == LedgerReason.PlaceVoted).SumAsync(e => e.Amount);
        Assert.Equal(ExperienceScale.PlaceVote, experience);
    }

    [Fact]
    public async Task Adding_a_place_pays_ten_and_counts_as_one_contribution()
    {
        var driver = await CreateDriverAsync();

        var earned = await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceAdded, $"poi-added:{Guid.NewGuid()}", Contributed);

        Assert.Equal(ExperienceScale.PlaceAdded, earned!.ContributionExperience);

        var lugares = await _db.TrackProgress.SingleAsync(t => t.DriverId == driver && t.TrackCode == TrackCatalog.Places);
        Assert.Equal(1, lugares.Count);
    }

    /// <remarks>
    /// Dos aportes distintos al mismo lugar —lo agregue y despues lo vote— son dos
    /// hechos: el motivo es parte de la clave.
    /// </remarks>
    [Fact]
    public async Task Adding_and_voting_the_same_place_are_two_different_facts()
    {
        var driver = await CreateDriverAsync();
        var poi = Guid.NewGuid();

        Assert.NotNull(await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceAdded, $"poi-added:{poi}", Contributed));
        Assert.NotNull(await _recorder.RecordContributionAsync(driver, LedgerReason.PlaceVoted, $"poi-vote:{poi}", Contributed));

        var lugares = await _db.TrackProgress.SingleAsync(t => t.DriverId == driver && t.TrackCode == TrackCatalog.Places);
        Assert.Equal(2, lugares.Count);
    }

    [Fact]
    public async Task Only_contribution_reasons_go_through_this_door()
    {
        var driver = await CreateDriverAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _recorder.RecordContributionAsync(driver, LedgerReason.TripCompleted, "x", Contributed));
    }
}
