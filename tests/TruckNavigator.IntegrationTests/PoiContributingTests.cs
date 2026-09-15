using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Pois;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Agregar un lugar: nace de la comunidad, con su primer voto, y paga como un
/// viaje corto.
/// </summary>
public sealed class PoiContributingTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3));

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private PoiContributing _contributing = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _contributing = new PoiContributing(_db, new ProgressionRecorder(_db), new CommunityReader(_db));
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> CreateDriverAsync(string mail)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = mail,
            NormalizedEmail = mail.ToUpperInvariant(),
            UserName = mail,
            NormalizedUserName = mail.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return user.Id;
    }

    private static TruckProfile Heavy() => new()
    {
        Name = "Pesado",
        GrossWeightKg = 18_000,
        HeightMeters = 4.0,
        WidthMeters = 2.6,
        LengthMeters = 12.0,
        NumberOfAxles = 3,
        VehicleType = VehicleType.RigidTruck
    };

    private static NewPlace Place(string name = "Gomería del Puerto", double lat = -34.65, double lon = -58.36) =>
        new(name, PoiCategory.TyreShop, lat, lon, "Debenedetti 100", null);

    [Fact]
    public async Task A_new_place_comes_with_its_first_vote_and_pays_ten()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");

        var result = await _contributing.AddAsync(driver, Place(), Heavy(), When);

        Assert.Null(result.DuplicateOf);
        Assert.NotNull(result.Place);

        var stored = await _db.PointsOfInterest.SingleAsync(p => p.Id == result.Place!.Id);
        Assert.Equal(driver, stored.ContributedBy);
        Assert.False(stored.ManagedByDataset);
        Assert.Equal(VerificationLevel.NotConfirmed, stored.VerificationLevel);

        var vote = await _db.PoiVotes.SingleAsync(v => v.PoiId == stored.Id && v.DriverId == driver);
        Assert.Equal(PoiVerdict.Suitable, vote.Verdict);
        Assert.Equal(PoiSuitabilityField.HeavyTruck, vote.TruckClass);

        Assert.Equal(ExperienceScale.PlaceAdded, result.Earned!.ContributionExperience);
        Assert.Equal(new CommunityCount(1, 0), result.Community!.All);
        Assert.Equal(PoiVerdict.Suitable, result.Community.YourVote);

        // El primer voto va con el aporte: no paga aparte.
        Assert.True(await _db.LedgerEntries.AnyAsync(e => e.DriverId == driver && e.Reason == LedgerReason.PlaceAdded));
        Assert.False(await _db.LedgerEntries.AnyAsync(e => e.DriverId == driver && e.Reason == LedgerReason.PlaceVoted));
    }

    /// <remarks>
    /// El mismo umbral que el candado del dataset: dos puntos de la misma categoria
    /// a menos de 25 m son el mismo lugar. Se devuelve el existente para que la
    /// interfaz ofrezca votarlo.
    /// </remarks>
    [Fact]
    public async Task A_place_of_the_same_category_within_25_meters_is_a_duplicate()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var first = await _contributing.AddAsync(driver, Place(), Heavy(), When);

        var second = await _contributing.AddAsync(driver, Place("Otra gomería", -34.65015, -58.36), Heavy(), When);

        Assert.Null(second.Place);
        Assert.Equal(first.Place!.Id, second.DuplicateOf);
        Assert.Equal(1, await _db.PointsOfInterest.CountAsync());
    }

    [Fact]
    public async Task A_different_category_at_the_same_spot_is_not_a_duplicate()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        await _contributing.AddAsync(driver, Place(), Heavy(), When);

        var eatery = await _contributing.AddAsync(driver, new NewPlace("Parador", PoiCategory.TruckFriendlyEatery, -34.65, -58.36, null, null), Heavy(), When);

        Assert.NotNull(eatery.Place);
        Assert.Equal(2, await _db.PointsOfInterest.CountAsync());
    }

    [Fact]
    public async Task Outside_the_coverage_the_domain_refuses_and_nothing_is_written()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _contributing.AddAsync(driver, Place(lat: -34.90, lon: -58.40), Heavy(), When));

        Assert.Equal(0, await _db.PointsOfInterest.CountAsync());
        Assert.Equal(0, await _db.LedgerEntries.CountAsync());
    }
}
