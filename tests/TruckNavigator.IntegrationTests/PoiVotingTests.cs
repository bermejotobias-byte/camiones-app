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
/// Votar, cambiar el voto y retirarlo, con lo que cada cosa paga.
/// </summary>
/// <remarks>
/// Es lo que hace el endpoint, sin el HTTP: la fila del voto, la EXP por el libro
/// y la vista que vuelve a la ficha. La regla que sostiene todo: el mismo lugar
/// paga una vez, y retirar no devuelve.
/// </remarks>
public sealed class PoiVotingTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3));

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private PoiVoting _voting = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _voting = new PoiVoting(_db, new ProgressionRecorder(_db), new CommunityReader(_db));
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

    private async Task<PointOfInterest> CreatePlaceAsync(Guid driver)
    {
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null, When);
        _db.PointsOfInterest.Add(poi);
        await _db.SaveChangesAsync();
        return poi;
    }

    private static TruckProfile Semi() => new()
    {
        Name = "Semi",
        GrossWeightKg = 40_000,
        HeightMeters = 4.1,
        WidthMeters = 2.6,
        LengthMeters = 18.6,
        NumberOfAxles = 5,
        VehicleType = VehicleType.SemiTrailer
    };

    [Fact]
    public async Task The_first_vote_is_stored_with_the_truck_class_and_pays_two()
    {
        var author = await CreateDriverAsync("autor@camiones.test");
        var voter = await CreateDriverAsync("votante@camiones.test");
        var poi = await CreatePlaceAsync(author);

        var result = await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.Suitable, When);

        var vote = await _db.PoiVotes.SingleAsync(v => v.PoiId == poi.Id && v.DriverId == voter);
        Assert.Equal(PoiSuitabilityField.SemiTrailer, vote.TruckClass);
        Assert.Equal(PoiVerdict.Suitable, vote.Verdict);

        Assert.NotNull(result.Earned);
        Assert.Equal(ExperienceScale.PlaceVote, result.Earned!.ContributionExperience);
        Assert.Equal(PoiVerdict.Suitable, result.Community.YourVote);
        Assert.Equal(new CommunityCount(1, 0), result.Community.ForTruck);
    }

    [Fact]
    public async Task Changing_the_vote_rewrites_the_row_and_does_not_pay_again()
    {
        var voter = await CreateDriverAsync("votante@camiones.test");
        var poi = await CreatePlaceAsync(voter);

        await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.Suitable, When);
        var second = await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.NotSuitable, When.AddHours(1));

        Assert.Null(second.Earned);
        Assert.Equal(PoiVerdict.NotSuitable, second.Community.YourVote);
        Assert.Equal(1, await _db.PoiVotes.CountAsync(v => v.PoiId == poi.Id));

        var vote = await _db.PoiVotes.SingleAsync(v => v.PoiId == poi.Id && v.DriverId == voter);
        Assert.Equal(When, vote.CastAt);
        Assert.Equal(When.AddHours(1), vote.UpdatedAt);
    }

    [Fact]
    public async Task Retiring_the_vote_keeps_the_experience_and_voting_again_does_not_pay()
    {
        var voter = await CreateDriverAsync("votante@camiones.test");
        var poi = await CreatePlaceAsync(voter);

        await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.Suitable, When);
        await _voting.RetireAsync(voter, poi.Id);

        Assert.False(await _db.PoiVotes.AnyAsync(v => v.PoiId == poi.Id));
        Assert.Equal(ExperienceScale.PlaceVote, await _db.LedgerEntries.Where(e => e.DriverId == voter && e.Reason == LedgerReason.PlaceVoted).SumAsync(e => e.Amount));

        var again = await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.Suitable, When.AddDays(1));

        Assert.Null(again.Earned);
        Assert.Equal(ExperienceScale.PlaceVote, await _db.LedgerEntries.Where(e => e.DriverId == voter && e.Reason == LedgerReason.PlaceVoted).SumAsync(e => e.Amount));
    }

    [Fact]
    public async Task Retiring_a_vote_that_does_not_exist_is_fine()
    {
        var voter = await CreateDriverAsync("votante@camiones.test");
        var poi = await CreatePlaceAsync(voter);

        await _voting.RetireAsync(voter, poi.Id);   // no tira
    }
}
