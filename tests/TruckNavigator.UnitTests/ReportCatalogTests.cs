using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El catalogo de tipos de reporte: cuanto vive cada uno, cual es informacion y
/// cual restriccion, y cual se vuelve fijo.
/// </summary>
/// <remarks>
/// Los numeros son los de la spec del 19/09/2026 (propuesta, configurable). El
/// test los fija para que cambiarlos sea una decision y no un accidente, y para
/// que agregar un tipo sin su regla se vea en rojo antes que en el telefono.
/// </remarks>
public class ReportCatalogTests
{
    [Fact]
    public void Every_type_has_a_rule()
    {
        foreach (var type in Enum.GetValues<ReportType>())
        {
            var rule = ReportCatalog.Get(type);

            Assert.Equal(type, rule.Type);
            Assert.True(rule.Lifetime > TimeSpan.Zero);
        }

        Assert.Equal(Enum.GetValues<ReportType>().Length, ReportCatalog.All.Count);
    }

    [Theory]
    [InlineData(ReportType.Traffic, 45)]
    [InlineData(ReportType.Police, 60)]
    [InlineData(ReportType.Accident, 120)]
    [InlineData(ReportType.Checkpoint, 120)]
    [InlineData(ReportType.Hazard, 120)]
    [InlineData(ReportType.Camera, 360)]
    [InlineData(ReportType.RoadClosed, 720)]
    [InlineData(ReportType.Pothole, 7 * 24 * 60)]
    [InlineData(ReportType.Roadworks, 7 * 24 * 60)]
    [InlineData(ReportType.LowClearance, 30 * 24 * 60)]
    public void Each_type_lives_what_the_spec_says(ReportType type, int minutes)
    {
        Assert.Equal(TimeSpan.FromMinutes(minutes), ReportCatalog.Get(type).Lifetime);
    }

    [Fact]
    public void Only_a_closed_road_and_a_low_clearance_are_restrictions()
    {
        var restrictions = ReportCatalog.All
            .Where(rule => rule.Kind == ReportKind.Restriction)
            .Select(rule => rule.Type)
            .ToHashSet();

        Assert.Equal(new HashSet<ReportType> { ReportType.RoadClosed, ReportType.LowClearance }, restrictions);
    }

    [Fact]
    public void Only_the_low_clearance_carries_a_value_and_it_is_in_metres()
    {
        var withValue = ReportCatalog.All.Where(rule => rule.ValueRange is not null).ToList();

        var rule = Assert.Single(withValue);
        Assert.Equal(ReportType.LowClearance, rule.Type);
        Assert.Equal((2.0, 6.0), rule.ValueRange!.Value);
    }

    [Fact]
    public void Only_the_camera_becomes_fixed_and_it_takes_five_confirmations()
    {
        var fixable = ReportCatalog.All.Where(rule => rule.FixedAfterConfirmations is not null).ToList();

        var rule = Assert.Single(fixable);
        Assert.Equal(ReportType.Camera, rule.Type);
        Assert.Equal(5, rule.FixedAfterConfirmations);
        Assert.Equal(5, ReportCatalog.FixedThreshold);
    }

    [Fact]
    public void Every_type_extends_when_someone_says_it_is_still_there()
    {
        Assert.All(ReportCatalog.All, rule => Assert.True(rule.ExtendsWithConfirmation));
    }
}
