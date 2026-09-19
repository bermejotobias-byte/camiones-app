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

    // ------------------------------------------------- la graduacion (19/09/2026)

    private async Task VoteFiveSemisAsync(Guid poiId, PoiVerdict verdict = PoiVerdict.Suitable)
    {
        for (var i = 0; i < 5; i++)
        {
            var voter = await CreateDriverAsync($"semi{i}@camiones.test");
            await _voting.CastAsync(voter, poiId, Semi(), verdict, When.AddMinutes(i));
        }
    }

    private async Task<PointOfInterest> StoredAsync(Guid id)
    {
        _db.ChangeTracker.Clear();
        return await _db.PointsOfInterest.SingleAsync(p => p.Id == id);
    }

    [Fact]
    public async Task The_fifth_suitable_vote_of_a_truck_class_establishes_the_contributed_place()
    {
        var author = await CreateDriverAsync("autor@camiones.test");
        var poi = await CreatePlaceAsync(author);

        await VoteFiveSemisAsync(poi.Id);

        var stored = await StoredAsync(poi.Id);
        Assert.Equal(VerificationLevel.Probable, stored.VerificationLevel);
        Assert.Equal(SuitabilityEvidenceKind.Community, stored.SuitabilityEvidenceKind);
        Assert.True(stored.SuitableForSemiTrailer);
        Assert.Null(stored.SuitableForHeavyTruck);
        Assert.Contains("5 camioneros", stored.SuitabilityEvidence);
    }

    [Fact]
    public async Task Four_votes_leave_the_place_as_it_was()
    {
        var author = await CreateDriverAsync("autor@camiones.test");
        var poi = await CreatePlaceAsync(author);

        for (var i = 0; i < 4; i++)
        {
            var voter = await CreateDriverAsync($"semi{i}@camiones.test");
            await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.Suitable, When.AddMinutes(i));
        }

        var stored = await StoredAsync(poi.Id);
        Assert.Equal(VerificationLevel.NotConfirmed, stored.VerificationLevel);
        Assert.Null(stored.SuitableForSemiTrailer);
    }

    [Fact]
    public async Task A_place_of_the_dataset_is_not_touched_by_five_votes()
    {
        var author = await CreateDriverAsync("autor@camiones.test");
        var poi = await CreatePlaceAsync(author);
        poi.ManagedByDataset = true;
        poi.VerificationLevel = VerificationLevel.Confirmed;
        poi.SuitabilityEvidenceKind = SuitabilityEvidenceKind.Official;
        await _db.SaveChangesAsync();

        await VoteFiveSemisAsync(poi.Id);

        var stored = await StoredAsync(poi.Id);
        Assert.Equal(VerificationLevel.Confirmed, stored.VerificationLevel);
        Assert.Equal(SuitabilityEvidenceKind.Official, stored.SuitabilityEvidenceKind);
        Assert.Null(stored.SuitableForSemiTrailer);
    }

    [Fact]
    public async Task The_seal_of_the_community_still_comes_back_as_always()
    {
        var author = await CreateDriverAsync("autor@camiones.test");
        var poi = await CreatePlaceAsync(author);
        await VoteFiveSemisAsync(poi.Id);

        var voter = await CreateDriverAsync("otro@camiones.test");
        var result = await _voting.CastAsync(voter, poi.Id, Semi(), PoiVerdict.Suitable, When.AddMinutes(10));

        Assert.Equal(CommunitySeal.Recommended, result.Community.Seal);
        Assert.Equal(new CommunityCount(6, 0), result.Community.ForTruck);
    }
}
