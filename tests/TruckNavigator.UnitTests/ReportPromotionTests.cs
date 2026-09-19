using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Lo que la comunidad vuelve fijo: la camara con cinco confirmaciones deja de
/// vencer. Decision del usuario del 19/09/2026: "una camara muy marcada es porque
/// es fija (...) +5 es un principio".
/// </summary>
public class ReportPromotionTests
{
    private static readonly DateTimeOffset Created = new(2026, 9, 19, 10, 0, 0, TimeSpan.FromHours(-3));

    private static Report Make(ReportType type, int confirmations = 0, int rejections = 0)
    {
        var report = Report.Create(
            Guid.NewGuid(),
            new NewReport(type, -34.6037, -58.3816, null, null, null, null),
            Created);

        report.Confirmations = confirmations;
        report.Rejections = rejections;
        return report;
    }

    [Theory]
    [InlineData(4, false)]
    [InlineData(5, true)]
    [InlineData(9, true)]
    public void A_camera_becomes_fixed_at_five_confirmations(int confirmations, bool expected)
    {
        Assert.Equal(expected, ReportPromotion.ShouldFix(Make(ReportType.Camera, confirmations)));
    }

    [Fact]
    public void An_accident_never_becomes_fixed_however_confirmed()
    {
        Assert.False(ReportPromotion.ShouldFix(Make(ReportType.Accident, 50)));
    }

    [Fact]
    public void Fixing_removes_the_expiry_for_good()
    {
        var camera = Make(ReportType.Camera, 5);

        ReportPromotion.Fix(camera);

        Assert.Equal(ReportStatus.Fixed, camera.Status);
        Assert.Null(camera.ExpiresAt);
        Assert.False(ReportExpiry.IsExpired(camera, Created.AddYears(1)));
    }

    [Fact]
    public void An_already_fixed_camera_is_not_fixed_again()
    {
        var camera = Make(ReportType.Camera, 7);
        camera.Status = ReportStatus.Fixed;
        camera.ExpiresAt = null;

        Assert.False(ReportPromotion.ShouldFix(camera));
    }

    [Theory]
    [InlineData(5, 4, true)]
    [InlineData(5, 6, false)]   // los rechazos tienen que superar a las confirmaciones
    [InlineData(4, 0, false)]   // y ser al menos cinco
    public void A_fixed_camera_stops_being_fixed_with_five_rejections_that_outnumber(int rejections, int confirmations, bool expected)
    {
        var camera = Make(ReportType.Camera, confirmations, rejections);
        camera.Status = ReportStatus.Fixed;
        camera.ExpiresAt = null;

        Assert.Equal(expected, ReportPromotion.ShouldUnfix(camera));
    }

    [Fact]
    public void A_report_that_is_not_fixed_cannot_be_unfixed()
    {
        Assert.False(ReportPromotion.ShouldUnfix(Make(ReportType.Camera, 0, 9)));
    }
}
