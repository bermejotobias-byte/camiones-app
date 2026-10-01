using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Reports;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los reportes vigentes de un recuadro, como los ve quien pregunta: con su
/// confiabilidad, lo que le dicen a su camion, el alias del creador y lo suyo.
/// </summary>
public sealed class ReportReaderTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

    // Un recuadro de ~2 km alrededor del Obelisco.
    private const double MinLon = -58.39;
    private const double MinLat = -34.61;
    private const double MaxLon = -58.37;
    private const double MaxLat = -34.59;

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private ReportReader _reader = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _reader = new ReportReader(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> CreateDriverAsync(string mail, string? alias = null)
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

        if (alias is not null)
        {
            var profile = new DriverProfile { Id = user.Id, CreatedAt = When };
            profile.SetAlias(alias);
            _db.DriverProfiles.Add(profile);
        }

        await _db.SaveChangesAsync();

        return user.Id;
    }

    private async Task<Report> AddAsync(Guid driver, ReportType type, double lat = -34.6037, double lon = -58.3816, double? value = null, DateTimeOffset? at = null)
    {
        var report = Report.Create(driver, new NewReport(type, lat, lon, null, null, null, value), at ?? When);
        _db.Reports.Add(report);
        await _db.SaveChangesAsync();
        return report;
    }

    private static TruckProfile Tall() => new()
    {
        Name = "Alto",
        GrossWeightKg = 18_000,
        HeightMeters = 4.1,
        WidthMeters = 2.5,
        LengthMeters = 12,
        NumberOfAxles = 3
    };

    [Fact]
    public async Task It_returns_the_alive_ones_of_the_box_newest_first()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var older = await AddAsync(driver, ReportType.Accident, at: When.AddMinutes(-30));
        var newer = await AddAsync(driver, ReportType.Pothole, at: When.AddMinutes(-5));
        var camera = await AddAsync(driver, ReportType.Camera, at: When.AddDays(-20));
        ReportPromotion.Fix(camera);
        await AddAsync(driver, ReportType.Traffic, at: When.AddHours(-2));           // vencido
        await AddAsync(driver, ReportType.Accident, lat: -34.70, lon: -58.45);       // afuera del recuadro
        var closed = await AddAsync(driver, ReportType.Hazard, at: When.AddMinutes(-10));
        ReportExpiry.CloseByAuthor(closed, When.AddMinutes(-1));
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var views = await _reader.InBoxAsync(MinLon, MinLat, MaxLon, MaxLat, null, null, When);

        Assert.Equal([newer.Id, older.Id, camera.Id], views.Select(v => v.Report.Id));
    }

    [Fact]
    public async Task It_says_whose_it_is_what_you_voted_and_who_reported()
    {
        var author = await CreateDriverAsync("uno@camiones.test", alias: "elgaucho");
        var viewer = await CreateDriverAsync("dos@camiones.test");
        var mine = await AddAsync(viewer, ReportType.Pothole);
        var theirs = await AddAsync(author, ReportType.Accident);
        _db.ReportVotes.Add(new ReportVote { ReportId = theirs.Id, DriverId = viewer, Verdict = ReportVerdict.StillThere, CastAt = When, UpdatedAt = When });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var views = await _reader.InBoxAsync(MinLon, MinLat, MaxLon, MaxLat, null, viewer, When);

        var ofTheirs = views.Single(v => v.Report.Id == theirs.Id);
        Assert.Equal("elgaucho", ofTheirs.ReportedByAlias);
        Assert.Equal(ReportVerdict.StillThere, ofTheirs.YourVote);
        Assert.False(ofTheirs.Mine);

        var ofMine = views.Single(v => v.Report.Id == mine.Id);
        Assert.Null(ofMine.ReportedByAlias);   // sin alias en el perfil
        Assert.Null(ofMine.YourVote);
        Assert.True(ofMine.Mine);
    }

    [Fact]
    public async Task Without_a_viewer_nothing_is_yours()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        await AddAsync(author, ReportType.Accident);
        _db.ChangeTracker.Clear();

        var views = await _reader.InBoxAsync(MinLon, MinLat, MaxLon, MaxLat, null, null, When);

        Assert.All(views, v => Assert.False(v.Mine));
        Assert.All(views, v => Assert.Null(v.YourVote));
    }

    [Fact]
    public async Task A_low_clearance_is_compared_with_the_truck_of_the_viewer()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var clearance = await AddAsync(author, ReportType.LowClearance, value: 3.8);
        _db.ChangeTracker.Clear();

        var forTall = (await _reader.InBoxAsync(MinLon, MinLat, MaxLon, MaxLat, Tall(), null, When)).Single(v => v.Report.Id == clearance.Id);
        var forNobody = (await _reader.InBoxAsync(MinLon, MinLat, MaxLon, MaxLat, null, null, When)).Single(v => v.Report.Id == clearance.Id);

        Assert.Equal(TruckRelevance.Incompatible, forTall.Relevance);
        Assert.Equal(TruckRelevance.NotApplicable, forNobody.Relevance);
    }

    [Fact]
    public async Task The_score_uses_the_reputation_of_the_creator()
    {
        var trusted = await CreateDriverAsync("uno@camiones.test");
        var doubted = await CreateDriverAsync("dos@camiones.test");
        _db.DriverReputations.Add(new DriverReputation { DriverId = trusted, Score = 90, UpdatedAt = When });
        _db.DriverReputations.Add(new DriverReputation { DriverId = doubted, Score = 10, UpdatedAt = When });
        var byTrusted = await AddAsync(trusted, ReportType.Accident);
        var byDoubted = await AddAsync(doubted, ReportType.Accident, lat: -34.605);
        _db.ChangeTracker.Clear();

        var views = await _reader.InBoxAsync(MinLon, MinLat, MaxLon, MaxLat, null, null, When);

        Assert.Equal(62, views.Single(v => v.Report.Id == byTrusted.Id).Score);
        Assert.Equal(38, views.Single(v => v.Report.Id == byDoubted.Id).Score);
    }

    [Fact]
    public async Task A_box_too_big_is_shrunk_around_its_centre()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var inside = await AddAsync(author, ReportType.Accident);                     // el Obelisco
        // Puerto Madero: adentro del pedido enorme, afuera del recuadro recortado al centro.
        await AddAsync(author, ReportType.Accident, lat: -34.60, lon: -58.34);
        _db.ChangeTracker.Clear();

        var views = await _reader.InBoxAsync(-59.0, -35.0, -58.0, -34.2, null, null, When);

        Assert.Equal([inside.Id], views.Select(v => v.Report.Id));
        Assert.Equal(0.25, ReportReader.MaxBoxDegrees);
    }

    [Fact]
    public async Task One_report_can_be_read_on_its_own()
    {
        var author = await CreateDriverAsync("uno@camiones.test", alias: "elgaucho");
        var report = await AddAsync(author, ReportType.Accident);
        _db.ChangeTracker.Clear();

        var view = await _reader.ForOneAsync(report.Id, null, author, When);

        Assert.NotNull(view);
        Assert.True(view!.Mine);
        Assert.Equal("elgaucho", view.ReportedByAlias);
        Assert.Null(await _reader.ForOneAsync(Guid.NewGuid(), null, null, When));
    }
}
