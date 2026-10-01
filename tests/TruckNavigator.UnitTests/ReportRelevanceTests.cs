using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Un reporte contra el camion elegido: el galibo de 3,80 es incompatible para
/// el de 4,10 y compatible para el de 3,60 (el ejemplo del usuario), la calle
/// cerrada le toca a todos, y lo demas no se compara con nada.
/// </summary>
public class ReportRelevanceTests
{
    private static Report Make(ReportType type, double? value = null)
    {
        return Report.Create(
            Guid.NewGuid(),
            new NewReport(type, -34.6037, -58.3816, null, null, null, value),
            new DateTimeOffset(2026, 9, 19, 10, 0, 0, TimeSpan.FromHours(-3)));
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

    [Theory]
    [InlineData(4.10, TruckRelevance.Incompatible)]
    [InlineData(3.60, TruckRelevance.Compatible)]
    [InlineData(3.80, TruckRelevance.Compatible)]   // justo igual, pasa
    public void A_low_clearance_is_compared_with_the_truck_height(double truckHeight, TruckRelevance expected)
    {
        Assert.Equal(expected, ReportRelevance.ForTruck(Make(ReportType.LowClearance, 3.8), TruckOf(truckHeight)));
    }

    [Fact]
    public void A_closed_road_is_incompatible_for_every_truck()
    {
        Assert.Equal(TruckRelevance.Incompatible, ReportRelevance.ForTruck(Make(ReportType.RoadClosed), TruckOf(3.2)));
    }

    [Theory]
    [InlineData(ReportType.Accident)]
    [InlineData(ReportType.Camera)]
    [InlineData(ReportType.Pothole)]
    public void Information_does_not_apply_to_the_truck(ReportType type)
    {
        Assert.Equal(TruckRelevance.NotApplicable, ReportRelevance.ForTruck(Make(type), TruckOf(4.2)));
    }

    [Fact]
    public void Without_a_truck_nothing_applies()
    {
        Assert.Equal(TruckRelevance.NotApplicable, ReportRelevance.ForTruck(Make(ReportType.LowClearance, 3.8), null));
    }
}
