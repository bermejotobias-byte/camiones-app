using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La proteccion basica contra el abuso: espera entre reportes, tope por hora, y
/// el duplicado cerca que en vez de crear otro ofrece confirmar el que hay.
/// </summary>
public class ReportAbuseGuardTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 19, 10, 0, 0, TimeSpan.FromHours(-3));

    private const double Lat = -34.6037;
    private const double Lon = -58.3816;

    private static readonly NewReport Accident = new(ReportType.Accident, Lat, Lon, null, null, null, null);

    private static RecentReport Mine(int secondsAgo, ReportType type = ReportType.Pothole) =>
        new(type, Lat + 0.01, Lon + 0.01, Now.AddSeconds(-secondsAgo), Guid.NewGuid(), Active: true);

    private static RecentReport Nearby(double metresEast, int minutesAgo, ReportType type = ReportType.Accident, bool active = true) =>
        // Un grado de longitud a esta latitud son ~91,7 km.
        new(type, Lat, Lon + metresEast / 91_700.0, Now.AddMinutes(-minutesAgo), Guid.NewGuid(), active);

    [Fact]
    public void With_nothing_recent_it_is_allowed()
    {
        var verdict = ReportAbuseGuard.Check(Accident, [], [], reputation: 50, Now);

        Assert.True(verdict.Allowed);
        Assert.Equal(0, verdict.RetryAfterSeconds);
        Assert.Null(verdict.DuplicateOf);
    }

    [Fact]
    public void Twenty_seconds_after_the_last_one_it_has_to_wait_the_rest_of_the_cooldown()
    {
        var verdict = ReportAbuseGuard.Check(Accident, [Mine(20)], [], 50, Now);

        Assert.False(verdict.Allowed);
        Assert.Equal(25, verdict.RetryAfterSeconds);
        Assert.NotNull(verdict.Reason);
    }

    [Fact]
    public void Fifty_seconds_after_the_last_one_it_is_allowed()
    {
        Assert.True(ReportAbuseGuard.Check(Accident, [Mine(50)], [], 50, Now).Allowed);
    }

    [Fact]
    public void A_low_reputation_doubles_the_wait()
    {
        var verdict = ReportAbuseGuard.Check(Accident, [Mine(60)], [], reputation: 20, Now);

        Assert.False(verdict.Allowed);
        Assert.Equal(30, verdict.RetryAfterSeconds);
    }

    [Fact]
    public void Twenty_in_the_last_hour_is_the_limit()
    {
        var nineteen = Enumerable.Range(1, 19).Select(i => Mine(120 + i * 60)).ToList();
        Assert.True(ReportAbuseGuard.Check(Accident, nineteen, [], 50, Now).Allowed);

        var twenty = Enumerable.Range(1, 20).Select(i => Mine(120 + i * 60)).ToList();
        var verdict = ReportAbuseGuard.Check(Accident, twenty, [], 50, Now);

        Assert.False(verdict.Allowed);
        Assert.True(verdict.RetryAfterSeconds > 0);
    }

    [Fact]
    public void One_of_the_same_type_nearby_and_recent_is_a_duplicate()
    {
        var existing = Nearby(100, minutesAgo: 10);

        var verdict = ReportAbuseGuard.Check(Accident, [], [existing], 50, Now);

        Assert.False(verdict.Allowed);
        Assert.Equal(existing.Id, verdict.DuplicateOf);
    }

    [Theory]
    [InlineData(200, 10, ReportType.Accident, true)]    // lejos
    [InlineData(100, 20, ReportType.Accident, true)]    // viejo
    [InlineData(100, 10, ReportType.Traffic, true)]     // otro tipo
    [InlineData(100, 10, ReportType.Accident, false)]   // ya no esta activo
    public void Far_old_other_type_or_inactive_is_not_a_duplicate(double metres, int minutes, ReportType type, bool active)
    {
        var verdict = ReportAbuseGuard.Check(Accident, [], [Nearby(metres, minutes, type, active)], 50, Now);

        Assert.True(verdict.Allowed);
        Assert.Null(verdict.DuplicateOf);
    }

    [Fact]
    public void The_numbers_are_the_ones_of_the_spec()
    {
        Assert.Equal(TimeSpan.FromSeconds(45), ReportAbuseGuard.Cooldown);
        Assert.Equal(25, ReportAbuseGuard.LowReputationBelow);
        Assert.Equal(20, ReportAbuseGuard.MaxPerHour);
        Assert.Equal(150, ReportAbuseGuard.DuplicateMeters);
        Assert.Equal(TimeSpan.FromMinutes(15), ReportAbuseGuard.DuplicateWindow);
    }
}
