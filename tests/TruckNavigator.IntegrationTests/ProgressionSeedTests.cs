using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// La siembra retroactiva.
/// </summary>
/// <remarks>
/// <para>
/// Hay viajes cerrados desde antes de que existiera la progresion, y el perfil ya
/// mostraba un nivel derivado de los kilometros. Arrancar en cero seria una
/// regresion visible: alguien con 9.480 km pasaria a Novato.
/// </para>
/// <para>
/// Pero acreditar hacia atras tiene un riesgo, y es lo que mas se prueba aca: sin
/// cuidado, el camionero abre la app y le caen encima veinte festejos de logros que
/// nunca vio desbloquearse.
/// </para>
/// </remarks>
public sealed class ProgressionSeedTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private ProgressionRecorder _recorder = null!;

    private static readonly DateTimeOffset Ahora =
        new(2026, 9, 10, 12, 0, 0, TimeSpan.Zero);

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

    private async Task<Guid> CreateDriverWithHistoryAsync(int trips, double metersEach)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "viejo@camiones.test",
            NormalizedEmail = "VIEJO@CAMIONES.TEST",
            UserName = "viejo@camiones.test",
            NormalizedUserName = "VIEJO@CAMIONES.TEST",
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };

        _db.Users.Add(user);

        for (var i = 0; i < trips; i++)
        {
            var trip = new Trip
            {
                DriverId = user.Id,
                TruckName = "Semi",
                PlannedDistanceMeters = metersEach,
                PlannedDurationSeconds = 3_600,
                StartedAt = new DateTimeOffset(2026, 4, 1, 12, 0, 0, TimeSpan.Zero).AddDays(i)
            };

            trip.Finish(trip.StartedAt.AddHours(1));

            _db.Trips.Add(trip);
        }

        await _db.SaveChangesAsync();

        return user.Id;
    }

    [Fact]
    public async Task The_history_that_predates_the_engine_is_credited()
    {
        var driver = await CreateDriverWithHistoryAsync(trips: 3, metersEach: 40_000);

        await ProgressionSeed.RunAsync(_db, _recorder, Ahora);

        var viajes = await _db.TrackProgress.SingleAsync(t => t.TrackCode == "viajes");
        Assert.Equal(3, viajes.Count);

        var kilometraje = await _db.TrackProgress.SingleAsync(t => t.TrackCode == TrackCatalog.Mileage);
        Assert.Equal(120, kilometraje.Count);

        Assert.Equal(driver, viajes.DriverId);
    }

    /// <remarks>
    /// <b>Lo que hace tolerable acreditar hacia atras.</b> La marca se pone en el
    /// momento de la siembra, asi que todo lo sembrado queda del lado de lo ya
    /// visto: aparece conseguido en el perfil, como corresponde a algo que la
    /// persona efectivamente hizo, y no dispara ni un festejo.
    /// </remarks>
    [Fact]
    public async Task What_is_seeded_is_credited_but_never_celebrated()
    {
        await CreateDriverWithHistoryAsync(trips: 3, metersEach: 40_000);

        await ProgressionSeed.RunAsync(_db, _recorder, Ahora);

        var mark = await _db.ProgressMarks.SingleAsync();
        Assert.Equal(Ahora, mark.CelebratedUpTo);

        // Nada sembrado puede quedar por delante de la marca.
        Assert.Empty(await _db.LedgerEntries.Where(e => e.OccurredAt > mark.CelebratedUpTo).ToListAsync());
        Assert.Empty(await _db.Rewards.Where(r => r.UnlockedAt > mark.CelebratedUpTo).ToListAsync());
    }

    /// <remarks>
    /// La siembra corre en cada arranque del servidor. Si duplicara, cada reinicio
    /// regalaria una tanda entera de EXP.
    /// </remarks>
    [Fact]
    public async Task Running_the_seed_twice_changes_nothing()
    {
        await CreateDriverWithHistoryAsync(trips: 3, metersEach: 40_000);

        await ProgressionSeed.RunAsync(_db, _recorder, Ahora);

        var entriesAfterFirst = await _db.LedgerEntries.CountAsync();

        await ProgressionSeed.RunAsync(_db, _recorder, Ahora.AddDays(1));

        Assert.Equal(entriesAfterFirst, await _db.LedgerEntries.CountAsync());
        Assert.Equal(3, (await _db.TrackProgress.SingleAsync(t => t.TrackCode == "viajes")).Count);
    }
}
