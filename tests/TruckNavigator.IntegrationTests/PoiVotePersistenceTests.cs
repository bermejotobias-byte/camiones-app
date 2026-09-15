using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Pois;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los votos y lo aportado, cruzando la base de verdad.
/// </summary>
/// <remarks>
/// SQLite real y no un proveedor en memoria: lo que hay que probar es el conversor
/// de fechas, la clave compuesta del voto y que el seed no borre lo que cargo un
/// usuario. Nada de eso lo ejercita un proveedor falso.
/// </remarks>
public sealed class PoiVotePersistenceTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3));

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

    [Fact]
    public async Task A_vote_survives_the_round_trip()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null, When);

        _db.PointsOfInterest.Add(poi);
        _db.PoiVotes.Add(new PoiVote
        {
            PoiId = poi.Id,
            DriverId = driver,
            TruckClass = PoiSuitabilityField.SemiTrailer,
            Verdict = PoiVerdict.Suitable,
            CastAt = When,
            UpdatedAt = When
        });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var stored = await _db.PoiVotes.SingleAsync(v => v.PoiId == poi.Id && v.DriverId == driver);
        Assert.Equal(PoiSuitabilityField.SemiTrailer, stored.TruckClass);
        Assert.Equal(PoiVerdict.Suitable, stored.Verdict);
        Assert.Equal(When, stored.CastAt);

        var place = await _db.PointsOfInterest.SingleAsync(p => p.Id == poi.Id);
        Assert.Equal(driver, place.ContributedBy);
        Assert.Equal(When, place.ContributedAt);
    }

    /// <remarks>
    /// La garantia es del esquema, y para probar el esquema hay que sacar la
    /// primera fila del rastreador de EF: si no, es EF quien se queja, no la base
    /// (leccion del 10/09/2026).
    /// </remarks>
    [Fact]
    public async Task One_vote_per_driver_and_place()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null, When);
        _db.PointsOfInterest.Add(poi);
        _db.PoiVotes.Add(Vote(poi.Id, driver, PoiVerdict.Suitable));
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        _db.PoiVotes.Add(Vote(poi.Id, driver, PoiVerdict.NotSuitable));

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task Deleting_the_place_takes_its_votes_along()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null, When);
        _db.PointsOfInterest.Add(poi);
        _db.PoiVotes.Add(Vote(poi.Id, driver, PoiVerdict.Suitable));
        await _db.SaveChangesAsync();

        _db.PointsOfInterest.Remove(poi);
        await _db.SaveChangesAsync();

        Assert.False(await _db.PoiVotes.AnyAsync(v => v.PoiId == poi.Id));
    }

    /// <remarks>
    /// El seed reconoce lo suyo por ManagedByDataset y no toca el resto: un lugar
    /// aportado sobrevive a cada arranque.
    /// </remarks>
    [Fact]
    public async Task A_contributed_place_is_not_deleted_by_the_seed()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null, When);
        _db.PointsOfInterest.Add(poi);
        await _db.SaveChangesAsync();

        await PointOfInterestSeed.ApplyAsync(_db, dataset: []);

        Assert.True(await _db.PointsOfInterest.AnyAsync(p => p.Id == poi.Id));
    }

    private static PoiVote Vote(Guid poiId, Guid driverId, PoiVerdict verdict) => new()
    {
        PoiId = poiId,
        DriverId = driverId,
        TruckClass = PoiSuitabilityField.HeavyTruck,
        Verdict = verdict,
        CastAt = When,
        UpdatedAt = When
    };
}
