using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;
using TruckNavigator.Infrastructure.Reports;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Crear un reporte contra la base de verdad: la guardia contra el abuso con lo
/// reciente de la cuenta y lo activo que hay cerca, y la calle que se pide a
/// Photon solo si el cliente no la sabia, con tope de tiempo.
/// </summary>
public sealed class ReportWriterTests : IAsyncLifetime
{
    private static readonly DateTimeOffset When = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;
    private FakePlaces _places = null!;
    private ReportWriter _writer = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();

        _places = new FakePlaces();
        _writer = new ReportWriter(_db, new ProgressionRecorder(_db), _places);
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

    private static NewReport Accident(double lat = -34.6037, double lon = -58.3816, string? street = null) =>
        new(ReportType.Accident, lat, lon, 95, 8, street, null);

    [Fact]
    public async Task It_creates_an_active_report_with_the_street_the_client_knew()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");

        var result = await _writer.CreateAsync(driver, Accident(street: "Av. Corrientes 1500"), When);

        Assert.NotNull(result.Report);
        Assert.Null(result.DuplicateOf);
        Assert.Null(result.Error);
        Assert.Equal(ReportStatus.Active, result.Report!.Status);
        Assert.Equal("Av. Corrientes 1500", result.Report.Street);
        Assert.Equal(0, _places.Calls);

        Assert.Equal(1, await _db.Reports.CountAsync());
    }

    [Fact]
    public async Task Without_a_street_it_asks_the_geocoder()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        _places.Answer = new Place("Av. Corrientes 5500", "Villa Crespo", new GeoPoint(-34.6, -58.44));

        var result = await _writer.CreateAsync(driver, Accident(), When);

        Assert.Equal("Av. Corrientes 5500", result.Report!.Street);
        Assert.Equal(1, _places.Calls);
    }

    [Fact]
    public async Task A_slow_geocoder_does_not_hold_the_report_and_leaves_the_street_empty()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        _places.Delay = TimeSpan.FromSeconds(5);
        _places.Answer = new Place("Tarde", null, new GeoPoint(-34.6, -58.44));

        var started = DateTimeOffset.UtcNow;
        var result = await _writer.CreateAsync(driver, Accident(), When);

        Assert.NotNull(result.Report);
        Assert.Null(result.Report!.Street);
        Assert.True(DateTimeOffset.UtcNow - started < TimeSpan.FromSeconds(4));
    }

    [Fact]
    public async Task A_second_one_ten_seconds_later_has_to_wait()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");
        await _writer.CreateAsync(driver, Accident(street: "x"), When);

        var result = await _writer.CreateAsync(driver, new NewReport(ReportType.Pothole, -34.61, -58.40, null, null, "y", null), When.AddSeconds(10));

        Assert.Null(result.Report);
        Assert.Equal(35, result.RetryAfterSeconds);
        Assert.NotNull(result.Error);
        Assert.Equal(1, await _db.Reports.CountAsync());
    }

    [Fact]
    public async Task The_same_type_fifty_metres_from_an_active_one_is_a_duplicate()
    {
        var one = await CreateDriverAsync("uno@camiones.test");
        var two = await CreateDriverAsync("dos@camiones.test");
        var existing = await _writer.CreateAsync(one, Accident(street: "x"), When);

        // 50 m al este: un grado de longitud son ~91,7 km a esta latitud.
        var result = await _writer.CreateAsync(two, Accident(lon: -58.3816 + 50 / 91_700.0, street: "x"), When.AddMinutes(5));

        Assert.Null(result.Report);
        Assert.Equal(existing.Report!.Id, result.DuplicateOf);
        Assert.Equal(1, await _db.Reports.CountAsync());
    }

    [Fact]
    public async Task Outside_the_area_it_is_refused_with_the_reason()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");

        var result = await _writer.CreateAsync(driver, Accident(lat: -32.9468, lon: -60.6393, street: "x"), When);

        Assert.Null(result.Report);
        Assert.Contains("CABA", result.Error);
        Assert.DoesNotContain("Parameter", result.Error);
    }

    [Fact]
    public async Task A_new_driver_reports_with_the_starting_reputation_without_a_row()
    {
        var driver = await CreateDriverAsync("uno@camiones.test");

        Assert.Equal(ReputationScale.Start, await _writer.ReputationOfAsync(driver));
        Assert.Equal(0, await _db.DriverReputations.CountAsync());
    }

    /// <summary>Un geocoder de mentira: contesta lo que se le diga, cuando se le diga.</summary>
    private sealed class FakePlaces : IPlaceSearch
    {
        public Place? Answer { get; set; }

        public TimeSpan Delay { get; set; } = TimeSpan.Zero;

        public int Calls { get; private set; }

        public Task<IReadOnlyList<Place>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Place>>([]);

        public async Task<Place?> ReverseAsync(GeoPoint point, CancellationToken cancellationToken = default)
        {
            Calls++;

            if (Delay > TimeSpan.Zero)
            {
                await Task.Delay(Delay, cancellationToken);
            }

            return Answer;
        }
    }
}
