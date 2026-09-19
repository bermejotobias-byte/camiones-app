using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los reportes, sus votos y la reputacion cruzando la base de verdad: el
/// conversor de fechas con un vencimiento que puede ser nulo, la clave compuesta
/// del voto y el orden por vencimiento, que es lo que la consulta de vigentes usa.
/// </summary>
public sealed class ReportPersistenceTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

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

    private static Report Make(Guid driver, ReportType type = ReportType.Accident, double? value = null) =>
        Report.Create(driver, new NewReport(type, -34.6037, -58.3816, 95, 8, "Av. Corrientes 1500", value), When);

    [Fact]
    public async Task A_report_survives_the_round_trip_with_its_dates_in_utc()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var report = Make(driver, ReportType.LowClearance, 3.8);

        _db.Reports.Add(report);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var stored = await _db.Reports.SingleAsync(r => r.Id == report.Id);

        Assert.Equal(ReportType.LowClearance, stored.Type);
        Assert.Equal(3.8, stored.Value);
        Assert.Equal(95, stored.HeadingDegrees);
        Assert.Equal("Av. Corrientes 1500", stored.Street);
        Assert.Equal(When, stored.CreatedAt);
        Assert.Equal(When + ReportCatalog.Get(ReportType.LowClearance).Lifetime, stored.ExpiresAt);
        Assert.Equal(ReportStatus.Active, stored.Status);
        Assert.Null(stored.ValidatedAt);
    }

    [Fact]
    public async Task A_fixed_report_keeps_its_null_expiry()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var camera = Make(driver, ReportType.Camera);
        ReportPromotion.Fix(camera);

        _db.Reports.Add(camera);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var stored = await _db.Reports.SingleAsync(r => r.Id == camera.Id);

        Assert.Null(stored.ExpiresAt);
        Assert.Equal(ReportStatus.Fixed, stored.Status);
    }

    [Fact]
    public async Task The_active_ones_can_be_filtered_and_ordered_by_expiry()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        var traffic = Make(driver, ReportType.Traffic);      // vence a los 45 min
        var accident = Make(driver, ReportType.Accident);    // a las 2 h
        var camera = Make(driver, ReportType.Camera);
        ReportPromotion.Fix(camera);                          // no vence

        _db.Reports.AddRange(traffic, accident, camera);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var inAnHour = When.AddHours(1);
        var alive = await _db.Reports
            .Where(r => r.ExpiresAt == null || r.ExpiresAt > inAnHour)
            .OrderBy(r => r.ExpiresAt)
            .Select(r => r.Id)
            .ToListAsync();

        Assert.Equal([camera.Id, accident.Id], alive);
    }

    /// <remarks>
    /// La garantia es del esquema: se saca la primera fila del rastreador de EF
    /// antes de insertar la segunda, si no es EF quien se queja y no la base.
    /// </remarks>
    [Fact]
    public async Task One_vote_per_driver_and_report()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var voter = await CreateDriverAsync("dos@camiones.test");
        var report = Make(author);
        _db.Reports.Add(report);
        _db.ReportVotes.Add(Vote(report.Id, voter, ReportVerdict.StillThere));
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        _db.ReportVotes.Add(Vote(report.Id, voter, ReportVerdict.Gone));

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task Deleting_the_report_takes_its_votes_with_it()
    {
        var author = await CreateDriverAsync("uno@camiones.test");
        var voter = await CreateDriverAsync("dos@camiones.test");
        var report = Make(author);
        _db.Reports.Add(report);
        _db.ReportVotes.Add(Vote(report.Id, voter, ReportVerdict.StillThere));
        await _db.SaveChangesAsync();

        _db.Reports.Remove(report);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        Assert.Empty(await _db.ReportVotes.ToListAsync());
    }

    [Fact]
    public async Task Reputation_is_one_row_per_driver()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");

        _db.DriverReputations.Add(new DriverReputation { DriverId = driver, Score = 53, UpdatedAt = When });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var stored = await _db.DriverReputations.SingleAsync(r => r.DriverId == driver);
        Assert.Equal(53, stored.Score);
        Assert.Equal(When, stored.UpdatedAt);

        // Que se queje la base y no el rastreador de EF (leccion del 10/09/2026).
        _db.ChangeTracker.Clear();
        _db.DriverReputations.Add(new DriverReputation { DriverId = driver, Score = 60, UpdatedAt = When });
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    private static ReportVote Vote(Guid reportId, Guid driverId, ReportVerdict verdict) => new()
    {
        ReportId = reportId,
        DriverId = driverId,
        Verdict = verdict,
        CastAt = When,
        UpdatedAt = When,
        DistanceMeters = 42
    };
}
