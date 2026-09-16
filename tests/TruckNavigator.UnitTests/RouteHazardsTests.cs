using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Los galibos que se avisan durante el viaje salen de la ruta misma —los
/// tramos con max_height declarado que el motor recorrio—, no de una capa
/// aparte que puede estar a 30 m de la ruta y hablar de otra calle.
/// </summary>
public class RouteHazardsTests
{
    private static (int, int, RoadSegmentAttributes) Segment(int from, int to, double? height, string street = "Av. Sáenz") =>
        (from, to, new RoadSegmentAttributes(StreetName: street, MaxHeightMeters: height));

    [Fact]
    public void A_segment_with_a_declared_clearance_becomes_a_hazard()
    {
        var hazards = RouteHazards.From([Segment(0, 4, 4.5)]);

        var hazard = Assert.Single(hazards);
        Assert.Equal("galibo", hazard.Kind);
        Assert.Equal(4.5, hazard.Metres);
        Assert.Equal("Av. Sáenz", hazard.StreetName);
        Assert.Equal(0, hazard.FromPointIndex);
        Assert.Equal(4, hazard.ToPointIndex);
    }

    [Fact]
    public void Segments_without_a_clearance_are_not_hazards()
    {
        Assert.Empty(RouteHazards.From([Segment(0, 4, null), Segment(4, 9, null)]));
    }

    [Fact]
    public void Contiguous_segments_under_the_same_bridge_are_one_hazard()
    {
        var hazards = RouteHazards.From([Segment(0, 4, 4.5), Segment(4, 7, 4.5), Segment(7, 9, null), Segment(9, 12, 4.5)]);

        Assert.Equal(2, hazards.Count);
        Assert.Equal((0, 7), (hazards[0].FromPointIndex, hazards[0].ToPointIndex));
        Assert.Equal((9, 12), (hazards[1].FromPointIndex, hazards[1].ToPointIndex));
    }

    [Fact]
    public void Two_different_bridges_back_to_back_stay_separate()
    {
        var hazards = RouteHazards.From([Segment(0, 4, 4.5), Segment(4, 7, 3.9, "Bajo vía")]);

        Assert.Equal(2, hazards.Count);
        Assert.Equal(3.9, hazards[1].Metres);
    }

    [Fact]
    public void A_segment_without_a_name_reports_the_house_fallback()
    {
        var hazard = Assert.Single(RouteHazards.From([(0, 2, new RoadSegmentAttributes(MaxHeightMeters: 4.1))]));

        Assert.Equal("tramo sin nombre", hazard.StreetName);
    }
}
