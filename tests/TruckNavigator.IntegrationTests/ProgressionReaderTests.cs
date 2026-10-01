using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Lo que el perfil le muestra al camionero.
/// </summary>
/// <remarks>
/// La logica vive aca y no en el endpoint: el proyecto no tiene arnes HTTP y
/// agregar uno seria una dependencia nueva. El endpoint queda de pegamento fino
/// sobre esto, que si se puede probar contra el esquema real.
/// </remarks>
public sealed class ProgressionReaderTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private ProgressionRecorder _recorder = null!;
    private ProgressionReader _reader = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _recorder = new ProgressionRecorder(_db);
        _reader = new ProgressionReader(_db);
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

    private async Task DriveAsync(Guid driverId, double meters)
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

        await _recorder.RecordAsync(trip, DateTimeOffset.UtcNow);
    }

    /// <remarks>
    /// Una cuenta recien creada no tiene ni una fila de progresion. El perfil se
    /// abre igual y muestra el primer nivel: si esto reventara, la pantalla
    /// principal estaria rota para todo usuario nuevo.
    /// </remarks>
    [Fact]
    public async Task A_brand_new_driver_starts_at_the_first_level()
    {
        var driver = await CreateDriverAsync();

        var progress = await _reader.GetProgressAsync(driver);

        Assert.Equal(1, progress.Level);
        Assert.Equal("Novato", progress.LevelName);
        Assert.Equal(1, progress.GoalInLevel);
        Assert.Equal(0, progress.Kilometers);
        Assert.Equal(0, progress.Experience);
    }

    [Fact]
    public async Task The_level_comes_from_the_credited_kilometres()
    {
        var driver = await CreateDriverAsync();

        // 2.600 km deja el nivel 2 recien empezado.
        await DriveAsync(driver, meters: 2_600_000);

        var progress = await _reader.GetProgressAsync(driver);

        Assert.Equal(2, progress.Level);
        Assert.Equal("Repartidor", progress.LevelName);
        Assert.Equal(2_600, progress.Kilometers);
    }

    /// <remarks>
    /// La EXP sale de sumar el libro, no de un contador aparte: el libro es la
    /// unica verdad y asi no pueden divergir.
    /// </remarks>
    [Fact]
    public async Task The_experience_is_the_sum_of_the_ledger()
    {
        var driver = await CreateDriverAsync();

        await DriveAsync(driver, meters: 120_000);

        var enElLibro = await _db.LedgerEntries
            .Where(e => e.DriverId == driver)
            .SumAsync(e => e.Amount);

        Assert.Equal(enElLibro, (await _reader.GetProgressAsync(driver)).Experience);
    }

    /// <remarks>
    /// Lo que se acredito despues de la marca es lo que todavia no se festejo. Sin
    /// esto la pantalla de festejo no tiene que mostrar, o muestra siempre lo mismo.
    /// </remarks>
    [Fact]
    public async Task What_happened_after_the_mark_is_pending_celebration()
    {
        var driver = await CreateDriverAsync();

        await DriveAsync(driver, meters: 120_000);

        var antes = await _reader.GetProgressAsync(driver);
        Assert.NotEmpty(antes.PendingRewards);

        await _reader.MarkSeenAsync(driver, DateTimeOffset.UtcNow.AddMinutes(1));

        Assert.Empty((await _reader.GetProgressAsync(driver)).PendingRewards);
    }

    /// <remarks>
    /// <b>No se puede equipar lo que no se desbloqueo.</b> Es la unica regla del
    /// equipamiento, y tiene que estar del lado del servidor: el cliente pide
    /// equipar, no decide que tiene.
    /// </remarks>
    [Fact]
    public async Task Equipping_something_not_in_the_inventory_is_refused()
    {
        var driver = await CreateDriverAsync();

        var equipped = await _reader.EquipAsync(driver, LoadoutSlot.Hat, "gorra-que-no-tiene");

        Assert.False(equipped);
        Assert.Empty(await _db.Loadout.ToListAsync());
    }

    [Fact]
    public async Task Equipping_something_unlocked_works()
    {
        var driver = await CreateDriverAsync();

        // El primer escalon de viajes es 1, asi que un viaje ya desbloquea algo.
        await DriveAsync(driver, meters: 120_000);

        var equipped = await _reader.EquipAsync(driver, LoadoutSlot.Hat, "viajes-01");

        Assert.True(equipped);

        var inventory = await _reader.GetInventoryAsync(driver);

        Assert.Contains("viajes-01", inventory.Unlocked);

        // Por nombre, no por el enum: un diccionario con clave de enum se
        // serializa con claves numericas y el telefono recibe {"6": "..."}.
        Assert.Equal("viajes-01", inventory.Equipped[nameof(LoadoutSlot.Hat)]);
    }

    [Fact]
    public async Task The_tracks_report_the_current_goal_and_how_far_it_is()
    {
        var driver = await CreateDriverAsync();

        await DriveAsync(driver, meters: 120_000);

        var viajes = (await _reader.GetTracksAsync(driver)).Single(t => t.Code == "viajes");

        Assert.Equal(1, viajes.Count);
        Assert.Equal(1, viajes.TiersReached);

        // El primer escalon es 1 viaje y ya se cumplio, asi que el objetivo en curso
        // es el segundo.
        Assert.Equal(TrackCatalog.Get("viajes").Tiers[1].Goal, viajes.CurrentGoal);
    }
}
