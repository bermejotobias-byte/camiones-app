using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Como nace un reporte: en la posicion GPS, con el rumbo solo si venia en
/// movimiento, con el valor solo si el tipo lo lleva, y dentro del area cubierta.
/// </summary>
public class ReportTests
{
    private static readonly Guid Driver = Guid.NewGuid();
    private static readonly DateTimeOffset When = new(2026, 9, 19, 10, 0, 0, TimeSpan.FromHours(-3));

    // Obelisco: adentro del rectangulo de cobertura.
    private const double Lat = -34.6037;
    private const double Lon = -58.3816;

    private static NewReport Input(
        ReportType type = ReportType.Accident,
        double lat = Lat,
        double lon = Lon,
        double? heading = null,
        double? speed = null,
        string? street = null,
        double? value = null) =>
        new(type, lat, lon, heading, speed, street, value);

    [Fact]
    public void A_new_report_is_active_and_lives_what_its_type_says()
    {
        var report = Report.Create(Driver, Input(ReportType.Traffic), When);

        Assert.Equal(ReportStatus.Active, report.Status);
        Assert.Equal(Driver, report.CreatedBy);
        Assert.Equal(When, report.CreatedAt);
        Assert.Equal(When + ReportCatalog.Get(ReportType.Traffic).Lifetime, report.ExpiresAt);
        Assert.Equal(0, report.Confirmations);
        Assert.Equal(0, report.Rejections);
        Assert.Null(report.ValidatedAt);
        Assert.NotEqual(Guid.Empty, report.Id);
    }

    [Fact]
    public void Outside_the_covered_area_it_is_refused_with_a_reason_for_the_person()
    {
        // Rosario.
        var error = Assert.Throws<ArgumentException>(() =>
            Report.Create(Driver, Input(lat: -32.9468, lon: -60.6393), When));

        Assert.Contains("CABA", error.Message);
    }

    [Fact]
    public void A_low_clearance_needs_its_metres_inside_the_range()
    {
        Assert.Throws<ArgumentException>(() => Report.Create(Driver, Input(ReportType.LowClearance), When));
        Assert.Throws<ArgumentException>(() => Report.Create(Driver, Input(ReportType.LowClearance, value: 1.5), When));
        Assert.Throws<ArgumentException>(() => Report.Create(Driver, Input(ReportType.LowClearance, value: 6.5), When));

        var report = Report.Create(Driver, Input(ReportType.LowClearance, value: 3.8), When);

        Assert.Equal(3.8, report.Value);
    }

    [Fact]
    public void A_type_without_value_ignores_the_one_it_receives()
    {
        var report = Report.Create(Driver, Input(ReportType.Accident, value: 3.8), When);

        Assert.Null(report.Value);
    }

    [Theory]
    [InlineData(2.0, 90.0, 90.0)]      // en movimiento: el rumbo se guarda
    [InlineData(12.5, 370.0, 10.0)]    // y se normaliza a [0, 360)
    [InlineData(3.0, -90.0, 270.0)]
    [InlineData(1.5, 90.0, null)]      // parado: el rumbo no significa nada
    [InlineData(null, 90.0, null)]     // sin velocidad no se sabe si se movia
    public void The_heading_is_kept_only_when_moving(double? speed, double heading, double? expected)
    {
        var report = Report.Create(Driver, Input(heading: heading, speed: speed), When);

        Assert.Equal(expected, report.HeadingDegrees);
    }

    [Theory]
    [InlineData("  Av. Corrientes 5500 ", "Av. Corrientes 5500")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void The_street_is_trimmed_and_an_empty_one_is_null(string? street, string? expected)
    {
        var report = Report.Create(Driver, Input(street: street), When);

        Assert.Equal(expected, report.Street);
    }

    [Fact]
    public void Moving_starts_at_two_metres_per_second()
    {
        Assert.Equal(2.0, Report.MovingSpeedMps);
    }
}
