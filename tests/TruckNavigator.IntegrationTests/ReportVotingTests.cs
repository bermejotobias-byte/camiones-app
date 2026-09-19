using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;
using TruckNavigator.Infrastructure.Reports;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// "Sigue ahi" / "Ya no esta" contra la base de verdad: la fila del voto, el
/// recuento, la validacion con lo que paga y lo que mueve, el rechazo, la camara
/// que se vuelve fija, y cerrar el propio.
/// </summary>
public sealed class ReportVotingTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

    private const double Lat = -34.6037;
    private const double Lon = -58.3816;

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private ReportWriter _writer = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _writer = new ReportWriter(_db, new ProgressionRecorder(_db), new NoPlaces());
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

    private async Task<Report> ReportedAsync(Guid author, ReportType type = ReportType.Accident)
    {
        var result = await _writer.CreateAsync(author, new NewReport(type, Lat, Lon, null, null, "Av. Corrientes 1500", null), When);
        return result.Report!;
    }

    private Task<ReportVoteResult> VoteAsync(Guid voter, Guid reportId, ReportVerdict verdict, int minutesLater = 1, double metresAway = 100) =>
        _writer.VoteAsync(voter, reportId, verdict, Lat, Lon + metresAway / 91_700.0, null, When.AddMinutes(minutesLater));

    private async Task<Report> StoredAsync(Guid id)
    {
        _db.ChangeTracker.Clear();
        return await _db.Reports.SingleAsync(r => r.Id == id);
    }

    [Fact]
    public async Task You_cannot_vote_your_own_report()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var report = await ReportedAsync(author);

        var result = await VoteAsync(author, report.Id, ReportVerdict.StillThere);

        Assert.Equal(VoteOutcome.OwnReport, result.Outcome);
        Assert.Equal(0, await _db.ReportVotes.CountAsync());
    }

    [Fact]
    public async Task Voting_from_far_away_does_not_count()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var voter = await CreateDriverAsync("dos@camiones.test");
        var report = await ReportedAsync(author);

        var result = await VoteAsync(voter, report.Id, ReportVerdict.StillThere, metresAway: 800);

        Assert.Equal(VoteOutcome.TooFar, result.Outcome);
        Assert.Equal(0, await _db.ReportVotes.CountAsync());
    }

    [Fact]
    public async Task An_expired_report_cannot_be_voted()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var voter = await CreateDriverAsync("dos@camiones.test");
        var report = await ReportedAsync(author, ReportType.Traffic);   // 45 min

        var result = await VoteAsync(voter, report.Id, ReportVerdict.StillThere, minutesLater: 60);

        Assert.Equal(VoteOutcome.Expired, result.Outcome);
    }

    [Fact]
    public async Task A_report_nobody_knows_is_not_found()
    {
        var voter = await CreateDriverAsync("dos@camiones.test");

        var result = await VoteAsync(voter, Guid.NewGuid(), ReportVerdict.StillThere);

        Assert.Equal(VoteOutcome.NotFound, result.Outcome);
    }

    [Fact]
    public async Task Two_confirmations_validate_it_pay_the_author_once_and_move_their_reputation()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var one = await CreateDriverAsync("dos@camiones.test");
        var two = await CreateDriverAsync("tres@camiones.test");
        var report = await ReportedAsync(author);

        var first = await VoteAsync(one, report.Id, ReportVerdict.StillThere);
        Assert.Equal(VoteOutcome.Ok, first.Outcome);
        Assert.False(first.View!.Validated);
        Assert.Equal(ExperienceScale.ReportVote, first.Earned!.ContributionExperience);

        var second = await VoteAsync(two, report.Id, ReportVerdict.StillThere, minutesLater: 2);
        Assert.True(second.View!.Validated);
        Assert.Equal(ReliabilityLabel.Confirmed, second.View.Label);
        Assert.Equal(ExperienceScale.ReportVote, second.Earned!.ContributionExperience);

        var stored = await StoredAsync(report.Id);
        Assert.Equal(ReportStatus.Validated, stored.Status);
        Assert.Equal(When.AddMinutes(2), stored.ValidatedAt);
        Assert.Equal(2, stored.Confirmations);
        Assert.Equal(0, stored.Rejections);

        var authorExperience = await _db.LedgerEntries
            .Where(e => e.DriverId == author && e.Reason == LedgerReason.ReportValidated)
            .SumAsync(e => e.Amount);
        Assert.Equal(ExperienceScale.ReportValidated, authorExperience);
        Assert.Equal(ReputationScale.Start + ReputationScale.OnValidated, await _writer.ReputationOfAsync(author));

        var vote = await _db.ReportVotes.SingleAsync(v => v.ReportId == report.Id && v.DriverId == one);
        Assert.InRange(vote.DistanceMeters, 99, 101);
    }

    [Fact]
    public async Task Changing_a_vote_recounts_pays_nothing_and_does_not_degrade_a_validated_report()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var one = await CreateDriverAsync("dos@camiones.test");
        var two = await CreateDriverAsync("tres@camiones.test");
        var report = await ReportedAsync(author);
        await VoteAsync(one, report.Id, ReportVerdict.StillThere);
        await VoteAsync(two, report.Id, ReportVerdict.StillThere, minutesLater: 2);

        var changed = await VoteAsync(one, report.Id, ReportVerdict.Gone, minutesLater: 3);

        Assert.Equal(VoteOutcome.Ok, changed.Outcome);
        Assert.Null(changed.Earned);

        var stored = await StoredAsync(report.Id);
        Assert.Equal(1, stored.Confirmations);
        Assert.Equal(1, stored.Rejections);
        Assert.Equal(ReportStatus.Validated, stored.Status);
        Assert.Equal(2, await _db.ReportVotes.CountAsync(v => v.ReportId == report.Id));
    }

    [Fact]
    public async Task Two_gone_against_one_reject_it_now_and_cost_the_author()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var one = await CreateDriverAsync("dos@camiones.test");
        var two = await CreateDriverAsync("tres@camiones.test");
        var three = await CreateDriverAsync("cuatro@camiones.test");
        var report = await ReportedAsync(author);

        await VoteAsync(one, report.Id, ReportVerdict.StillThere);
        await VoteAsync(two, report.Id, ReportVerdict.Gone, minutesLater: 2);
        var last = await VoteAsync(three, report.Id, ReportVerdict.Gone, minutesLater: 3);

        Assert.Equal(VoteOutcome.Ok, last.Outcome);

        var stored = await StoredAsync(report.Id);
        Assert.Equal(ReportStatus.Rejected, stored.Status);
        Assert.Equal(When.AddMinutes(3), stored.ExpiresAt);
        Assert.Equal(ReputationScale.Start + ReputationScale.OnRejected, await _writer.ReputationOfAsync(author));
        Assert.False(await _db.LedgerEntries.AnyAsync(e => e.DriverId == author));
    }

    [Fact]
    public async Task A_camera_with_five_confirmations_becomes_fixed()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var camera = await ReportedAsync(author, ReportType.Camera);

        for (var i = 0; i < 5; i++)
        {
            var voter = await CreateDriverAsync($"v{i}@camiones.test");
            await VoteAsync(voter, camera.Id, ReportVerdict.StillThere, minutesLater: i + 1);
        }

        var stored = await StoredAsync(camera.Id);
        Assert.Equal(ReportStatus.Fixed, stored.Status);
        Assert.Null(stored.ExpiresAt);
        Assert.NotNull(stored.ValidatedAt);
        Assert.Equal(5, stored.Confirmations);
    }

    [Fact]
    public async Task The_author_can_close_their_own_report_and_nobody_else_can()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var other = await CreateDriverAsync("dos@camiones.test");
        var report = await ReportedAsync(author);

        Assert.False(await _writer.CloseAsync(other, report.Id, When.AddMinutes(1)));
        Assert.True(await _writer.CloseAsync(author, report.Id, When.AddMinutes(2)));

        var stored = await StoredAsync(report.Id);
        Assert.Equal(ReportStatus.ClosedByAuthor, stored.Status);
        Assert.Equal(When.AddMinutes(2), stored.ExpiresAt);
    }

    private sealed class NoPlaces : IPlaceSearch
    {
        public Task<IReadOnlyList<Place>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Place>>([]);

        public Task<Place?> ReverseAsync(GeoPoint point, CancellationToken cancellationToken = default) =>
            Task.FromResult<Place?>(null);
    }
}
