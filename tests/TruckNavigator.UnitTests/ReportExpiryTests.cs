using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Cuando un reporte deja de valer: vence solo, se estira con "sigue ahi" hasta un
/// tope, muere con "ya no esta", y el creador puede cerrar el suyo.
/// </summary>
public class ReportExpiryTests
{
    private static readonly DateTimeOffset Created = new(2026, 9, 19, 10, 0, 0, TimeSpan.FromHours(-3));

    private static Report Make(ReportType type)
    {
        return Report.Create(
            Guid.NewGuid(),
            new NewReport(type, -34.6037, -58.3816, null, null, null, null),
            Created);
    }

    [Fact]
    public void It_is_expired_once_its_time_passed()
    {
        var report = Make(ReportType.Traffic);   // 45 minutos

        Assert.False(ReportExpiry.IsExpired(report, Created.AddMinutes(44)));
        Assert.True(ReportExpiry.IsExpired(report, Created.AddMinutes(45)));
    }

    [Fact]
    public void A_confirmation_extends_it_by_half_a_life_but_never_shortens_it()
    {
        var roadworks = Make(ReportType.Roadworks);   // 7 dias

        // El dia 6 quedan 24 h; media vida son 3,5 dias: vence el dia 9,5.
        ReportExpiry.Confirm(roadworks, Created.AddDays(6));
        Assert.Equal(Created.AddDays(9.5), roadworks.ExpiresAt);

        // Confirmar enseguida no lo acorta: le quedaban 3,5 dias y media vida son 3,5.
        var early = Make(ReportType.Roadworks);
        ReportExpiry.Confirm(early, Created.AddHours(1));
        Assert.Equal(Created.AddDays(7), early.ExpiresAt);
    }

    [Fact]
    public void Extensions_stop_at_three_lives()
    {
        var roadworks = Make(ReportType.Roadworks);

        for (var day = 1; day <= 40; day++)
        {
            ReportExpiry.Confirm(roadworks, Created.AddDays(day));
        }

        Assert.Equal(Created.AddDays(21), roadworks.ExpiresAt);

        var traffic = Make(ReportType.Traffic);

        for (var minute = 10; minute <= 200; minute += 10)
        {
            ReportExpiry.Confirm(traffic, Created.AddMinutes(minute));
        }

        Assert.Equal(Created.AddMinutes(135), traffic.ExpiresAt);   // 2 h 15
    }

    [Fact]
    public void A_fixed_report_is_not_touched_by_confirmations()
    {
        var camera = Make(ReportType.Camera);
        camera.Status = ReportStatus.Fixed;
        camera.ExpiresAt = null;

        ReportExpiry.Confirm(camera, Created.AddDays(3));

        Assert.Null(camera.ExpiresAt);
        Assert.False(ReportExpiry.IsExpired(camera, Created.AddYears(1)));
    }

    [Theory]
    [InlineData(2, 1, true)]
    [InlineData(2, 2, false)]   // los rechazos tienen que superar, no igualar
    [InlineData(1, 0, false)]   // uno solo no mata
    [InlineData(3, 0, true)]
    public void Two_rejections_that_outnumber_the_confirmations_kill_it(int rejections, int confirmations, bool expected)
    {
        var report = Make(ReportType.Accident);
        report.Rejections = rejections;
        report.Confirmations = confirmations;

        Assert.Equal(expected, ReportExpiry.ShouldReject(report));
    }

    [Fact]
    public void Rejecting_expires_it_now()
    {
        var report = Make(ReportType.Accident);
        var now = Created.AddMinutes(30);

        ReportExpiry.Reject(report, now);

        Assert.Equal(ReportStatus.Rejected, report.Status);
        Assert.Equal(now, report.ExpiresAt);
        Assert.True(ReportExpiry.IsExpired(report, now));
    }

    [Fact]
    public void The_author_can_close_it_whenever()
    {
        var report = Make(ReportType.Hazard);
        var now = Created.AddMinutes(2);

        ReportExpiry.CloseByAuthor(report, now);

        Assert.Equal(ReportStatus.ClosedByAuthor, report.Status);
        Assert.True(ReportExpiry.IsExpired(report, now));
    }

    [Fact]
    public void The_constants_are_the_ones_of_the_spec()
    {
        Assert.Equal(0.5, ReportExpiry.ExtensionFraction);
        Assert.Equal(3, ReportExpiry.MaxLifetimes);
        Assert.Equal(2, ReportExpiry.RejectionsToKill);
    }
}
