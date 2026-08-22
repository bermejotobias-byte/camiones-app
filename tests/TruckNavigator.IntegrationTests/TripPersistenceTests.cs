using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El historial de viajes es de la persona, no del camion.
/// </summary>
/// <remarks>
/// El caso que se cuida es el de siempre en este oficio: el camionero cambia de
/// vehiculo o de empresa y borra el camion viejo. Si eso se llevara puesto el
/// historial, se llevaria tambien sus kilometros acumulados y todo lo que hubiera
/// desbloqueado con ellos.
/// </remarks>
public sealed class TripPersistenceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> CreateUserAsync(string email)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return user.Id;
    }

    private async Task<TruckProfile> AddTruckAsync(Guid ownerId, string name)
    {
        var truck = new TruckProfile
        {
            Name = name,
            OwnerId = ownerId,
            GrossWeightKg = 18_000,
            HeightMeters = 3.8,
            WidthMeters = 2.5,
            LengthMeters = 12,
            NumberOfAxles = 3,
            VehicleType = VehicleType.RigidTruck
        };

        _db.TruckProfiles.Add(truck);
        await _db.SaveChangesAsync();

        return truck;
    }

    private async Task<Trip> AddFinishedTripAsync(Guid driverId, TruckProfile truck)
    {
        var start = DateTimeOffset.UtcNow.AddHours(-1);

        var trip = new Trip
        {
            DriverId = driverId,
            TruckId = truck.Id,
            TruckName = truck.Name,
            OriginLatitude = -34.5915,
            OriginLongitude = -58.3745,
            OriginLabel = "Retiro",
            DestinationLatitude = -34.6580,
            DestinationLongitude = -58.5030,
            DestinationLabel = "Mataderos",
            PlannedDistanceMeters = 21_200,
            PlannedDurationSeconds = TimeSpan.FromMinutes(24).TotalSeconds,
            HeavyNetworkSharePercent = 88.8,
            StartedAt = start
        };

        trip.Finish(start.AddMinutes(26));

        _db.Trips.Add(trip);
        await _db.SaveChangesAsync();

        return trip;
    }

    [Fact]
    public async Task A_finished_trip_keeps_the_kilometres_it_credited()
    {
        var driver = await CreateUserAsync("uno@example.com");
        var truck = await AddTruckAsync(driver, "El Scania");

        await AddFinishedTripAsync(driver, truck);

        var stored = await _db.Trips.AsNoTracking().SingleAsync();

        Assert.Equal(TripStatus.Completed, stored.Status);
        Assert.Equal(21_200, stored.CreditedDistanceMeters);
        Assert.Equal(88.8, stored.HeavyNetworkSharePercent);
        Assert.Equal("Mataderos", stored.DestinationLabel);
    }

    /// <summary>
    /// El caso central: se va el camion, queda el viaje y queda legible.
    /// </summary>
    [Fact]
    public async Task Deleting_the_truck_keeps_the_trip_and_its_readable_name()
    {
        var driver = await CreateUserAsync("uno@example.com");
        var truck = await AddTruckAsync(driver, "El Scania");

        await AddFinishedTripAsync(driver, truck);

        _db.TruckProfiles.Remove(await _db.TruckProfiles.SingleAsync(t => t.Id == truck.Id));
        await _db.SaveChangesAsync();

        var stored = await _db.Trips.AsNoTracking().SingleAsync();

        Assert.Null(stored.TruckId);                       // la referencia se corta
        Assert.Equal("El Scania", stored.TruckName);       // el nombre sobrevive
        Assert.Equal(21_200, stored.CreditedDistanceMeters);
    }

    /// <summary>
    /// El viaje es historial de la persona: si se borra la cuenta, se va con ella.
    /// </summary>
    [Fact]
    public async Task Deleting_the_account_deletes_its_trips()
    {
        var driver = await CreateUserAsync("uno@example.com");
        var truck = await AddTruckAsync(driver, "El Scania");

        await AddFinishedTripAsync(driver, truck);

        _db.Users.Remove(await _db.Users.SingleAsync(u => u.Id == driver));
        await _db.SaveChangesAsync();

        Assert.Empty(await _db.Trips.ToListAsync());
    }

    [Fact]
    public async Task A_driver_only_sees_their_own_trips()
    {
        var mine = await CreateUserAsync("uno@example.com");
        var theirs = await CreateUserAsync("dos@example.com");

        var myTruck = await AddTruckAsync(mine, "El mio");
        var theirTruck = await AddTruckAsync(theirs, "El de otro");

        await AddFinishedTripAsync(mine, myTruck);
        await AddFinishedTripAsync(theirs, theirTruck);

        var visible = await _db.Trips
            .Where(t => t.DriverId == mine)
            .AsNoTracking()
            .ToListAsync();

        Assert.Single(visible);
        Assert.Equal("El mio", visible[0].TruckName);
    }

    /// <summary>
    /// Los kilometros del total salen de lo acreditado, no de lo planeado: si no,
    /// cancelar viajes seria una forma de sumar.
    /// </summary>
    [Fact]
    public async Task A_cancelled_trip_is_kept_in_the_history_but_adds_no_kilometres()
    {
        var driver = await CreateUserAsync("uno@example.com");
        var truck = await AddTruckAsync(driver, "El Scania");

        await AddFinishedTripAsync(driver, truck);

        var start = DateTimeOffset.UtcNow.AddMinutes(-10);

        var abandoned = new Trip
        {
            DriverId = driver,
            TruckId = truck.Id,
            TruckName = truck.Name,
            PlannedDistanceMeters = 50_000,
            PlannedDurationSeconds = TimeSpan.FromMinutes(60).TotalSeconds,
            StartedAt = start
        };

        abandoned.Cancel(start.AddMinutes(9));

        _db.Trips.Add(abandoned);
        await _db.SaveChangesAsync();

        var all = await _db.Trips.AsNoTracking().ToListAsync();

        Assert.Equal(2, all.Count);
        Assert.Equal(21_200, all.Sum(t => t.CreditedDistanceMeters));
        Assert.Equal(71_200, all.Sum(t => t.PlannedDistanceMeters));
    }

    /// <summary>
    /// El historial se lee del mas nuevo al mas viejo, y ese ORDER BY es
    /// justamente lo que SQLite no sabe hacer sobre un <c>DateTimeOffset</c>
    /// guardado como texto: tiraba <c>NotSupportedException</c> y dejaba el
    /// historial y las estadisticas en error 500.
    ///
    /// Ninguno de los otros tests lo agarraba porque ninguno ordenaba por fecha.
    /// Este cubre ese hueco.
    /// </summary>
    [Fact]
    public async Task The_history_can_be_ordered_by_date_newest_first()
    {
        var driver = await CreateUserAsync("uno@example.com");
        var truck = await AddTruckAsync(driver, "El Scania");

        var now = DateTimeOffset.UtcNow;

        foreach (var (label, hoursAgo) in new[] { ("Primero", 6), ("Segundo", 4), ("Tercero", 2) })
        {
            var start = now.AddHours(-hoursAgo);

            var trip = new Trip
            {
                DriverId = driver,
                TruckId = truck.Id,
                TruckName = truck.Name,
                DestinationLabel = label,
                PlannedDistanceMeters = 10_000,
                PlannedDurationSeconds = TimeSpan.FromMinutes(20).TotalSeconds,
                StartedAt = start
            };

            trip.Finish(start.AddMinutes(21));
            _db.Trips.Add(trip);
        }

        await _db.SaveChangesAsync();

        var history = await _db.Trips
            .Where(t => t.DriverId == driver)
            .OrderByDescending(t => t.StartedAt)
            .AsNoTracking()
            .ToListAsync();

        Assert.Equal(
            new[] { "Tercero", "Segundo", "Primero" },
            history.Select(t => t.DestinationLabel));
    }

    /// <summary>
    /// El instante tiene que volver de la base tal como se guardo. El conversor a
    /// ticks es exacto, pero conviene tener quien lo vigile.
    /// </summary>
    [Fact]
    public async Task A_stored_moment_comes_back_unchanged()
    {
        var driver = await CreateUserAsync("uno@example.com");
        var truck = await AddTruckAsync(driver, "El Scania");

        var stored = await AddFinishedTripAsync(driver, truck);
        var expectedStart = stored.StartedAt;
        var expectedFinish = stored.FinishedAt;

        _db.ChangeTracker.Clear();

        var reloaded = await _db.Trips.AsNoTracking().SingleAsync();

        Assert.Equal(expectedStart.UtcTicks, reloaded.StartedAt.UtcTicks);
        Assert.Equal(expectedFinish!.Value.UtcTicks, reloaded.FinishedAt!.Value.UtcTicks);
    }

}
