using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Routing;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Que reportes le bloquean la ruta a un camion: solo restricciones validadas
/// o fijas, vigentes, y que le toquen a ese camion.
/// </summary>
public sealed class RouteBlockadesTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private RouteBlockades _blockades = null!;
    private Guid _driver;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

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
        _driver = user.Id;

        _blockades = new RouteBlockades(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Report> AddAsync(ReportType type, ReportStatus status, double? value = null, double? heading = null, DateTimeOffset? at = null)
    {
        var report = Report.Create(_driver, new NewReport(type, -34.6037, -58.3816, heading, 10, null, value), at ?? When);
        report.Status = status;

        if (status == ReportStatus.Fixed)
        {
            report.ExpiresAt = null;
        }

        _db.Reports.Add(report);
        await _db.SaveChangesAsync();
        return report;
    }

    private static TruckProfile TruckOf(double height) => new()
    {
        Name = "De prueba",
        GrossWeightKg = 12_000,
        HeightMeters = height,
        WidthMeters = 2.5,
        LengthMeters = 10,
        NumberOfAxles = 2
    };

    [Fact]
    public async Task Only_validated_or_fixed_restrictions_that_are_alive_count()
    {
        var validated = await AddAsync(ReportType.RoadClosed, ReportStatus.Validated, heading: 90);
        await AddAsync(ReportType.RoadClosed, ReportStatus.Active);                                 // sin validar
        await AddAsync(ReportType.RoadClosed, ReportStatus.Validated, at: When.AddDays(-1));         // vencido
        await AddAsync(ReportType.Accident, ReportStatus.Validated);                                 // informacion
        await AddAsync(ReportType.Camera, ReportStatus.Fixed);                                       // fija pero informacion
        _db.ChangeTracker.Clear();

        var blockades = await _blockades.ActiveAsync(TruckOf(3.5), When);

        var only = Assert.Single(blockades);
        Assert.Equal("r1", only.Id);
        Assert.Equal(validated.Latitude, only.Latitude);
        Assert.Equal(90, only.HeadingDegrees);
    }

    [Fact]
    public async Task A_low_clearance_blocks_only_the_trucks_that_do_not_fit()
    {
        await AddAsync(ReportType.LowClearance, ReportStatus.Validated, value: 3.8);
        _db.ChangeTracker.Clear();

        Assert.Single(await _blockades.ActiveAsync(TruckOf(4.1), When));
        Assert.Empty(await _blockades.ActiveAsync(TruckOf(3.6), When));
    }

    [Fact]
    public async Task Ids_are_numbered_in_order()
    {
        await AddAsync(ReportType.RoadClosed, ReportStatus.Validated);
        await AddAsync(ReportType.LowClearance, ReportStatus.Validated, value: 3.8);
        _db.ChangeTracker.Clear();

        var blockades = await _blockades.ActiveAsync(TruckOf(4.1), When);

        Assert.Equal(["r1", "r2"], blockades.Select(b => b.Id));
    }
}
