using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Pois;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Contar los votos de un lote de lugares: en total, para un tipo de camion, y el
/// propio.
/// </summary>
/// <remarks>
/// El detalle por tipo es la decision del usuario del 15/09/2026: para un semi,
/// que lo recomienden veinte camioneros de liviano no dice nada.
/// </remarks>
public sealed class CommunityReaderTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3));

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private CommunityReader _reader = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _reader = new CommunityReader(_db);
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

    private async Task<PointOfInterest> CreatePlaceAsync(Guid driver, string name)
    {
        var poi = PoiContribution.Create(driver, name, PoiCategory.TyreShop, -34.65, -58.36, null, null, When);
        _db.PointsOfInterest.Add(poi);
        await _db.SaveChangesAsync();
        return poi;
    }

    private async Task VoteAsync(Guid poiId, Guid driver, PoiSuitabilityField truckClass, PoiVerdict verdict)
    {
        _db.PoiVotes.Add(new PoiVote
        {
            PoiId = poiId,
            DriverId = driver,
            TruckClass = truckClass,
            Verdict = verdict,
            CastAt = When,
            UpdatedAt = When
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task Counts_everyone_and_only_the_trucks_like_yours()
    {
        var a = await CreateDriverAsync("a@camiones.test");
        var b = await CreateDriverAsync("b@camiones.test");
        var c = await CreateDriverAsync("c@camiones.test");
        var d = await CreateDriverAsync("d@camiones.test");
        var poi = await CreatePlaceAsync(a, "Gomería del Puerto");

        await VoteAsync(poi.Id, a, PoiSuitabilityField.SemiTrailer, PoiVerdict.Suitable);
        await VoteAsync(poi.Id, b, PoiSuitabilityField.SemiTrailer, PoiVerdict.Suitable);
        await VoteAsync(poi.Id, c, PoiSuitabilityField.SemiTrailer, PoiVerdict.Suitable);
        await VoteAsync(poi.Id, d, PoiSuitabilityField.HeavyTruck, PoiVerdict.NotSuitable);

        var forSemi = (await _reader.ForPlacesAsync([poi.Id], PoiSuitabilityField.SemiTrailer, a))[poi.Id];

        Assert.Equal(new CommunityCount(3, 1), forSemi.All);
        Assert.Equal(CommunitySeal.Recommended, forSemi.Seal);
        Assert.Equal(PoiSuitabilityField.SemiTrailer, forSemi.TruckClass);
        Assert.Equal(new CommunityCount(3, 0), forSemi.ForTruck);
        Assert.Equal(CommunitySeal.Recommended, forSemi.SealForTruck);
        Assert.Equal(PoiVerdict.Suitable, forSemi.YourVote);

        var forHeavy = (await _reader.ForPlacesAsync([poi.Id], PoiSuitabilityField.HeavyTruck, d))[poi.Id];

        Assert.Equal(new CommunityCount(0, 1), forHeavy.ForTruck);
        Assert.Equal(CommunitySeal.NoVotesYet, forHeavy.SealForTruck);
        Assert.Equal(PoiVerdict.NotSuitable, forHeavy.YourVote);
    }

    /// <remarks>
    /// Un lugar sin votos tambien tiene su fila en el resultado: la ficha no puede
    /// distinguir "sin votos" de "no lo consulte".
    /// </remarks>
    [Fact]
    public async Task A_place_without_votes_still_gets_a_view()
    {
        var a = await CreateDriverAsync("a@camiones.test");
        var poi = await CreatePlaceAsync(a, "Sin votos");

        var view = (await _reader.ForPlacesAsync([poi.Id], null, null))[poi.Id];

        Assert.Equal(new CommunityCount(0, 0), view.All);
        Assert.Equal(CommunitySeal.NoVotesYet, view.Seal);
        Assert.Null(view.TruckClass);
        Assert.Null(view.ForTruck);
        Assert.Null(view.SealForTruck);
        Assert.Null(view.YourVote);
    }

    [Fact]
    public async Task Without_a_session_there_is_no_own_vote()
    {
        var a = await CreateDriverAsync("a@camiones.test");
        var poi = await CreatePlaceAsync(a, "Gomería");
        await VoteAsync(poi.Id, a, PoiSuitabilityField.LightTruck, PoiVerdict.Suitable);

        var view = (await _reader.ForPlacesAsync([poi.Id], PoiSuitabilityField.LightTruck, null))[poi.Id];

        Assert.Equal(new CommunityCount(1, 0), view.All);
        Assert.Null(view.YourVote);
    }
}
