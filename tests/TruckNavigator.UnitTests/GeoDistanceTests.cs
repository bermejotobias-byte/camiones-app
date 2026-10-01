using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La distancia en metros entre dos coordenadas, la misma que usan el candado del
/// dataset y el chequeo de duplicados al aportar un lugar.
/// </summary>
public class GeoDistanceTests
{
    [Fact]
    public void The_same_point_is_at_zero()
    {
        Assert.Equal(0, GeoDistance.Meters(-34.6, -58.4, -34.6, -58.4), precision: 6);
    }

    /// <remarks>
    /// Un grado de latitud son ~111,2 km en cualquier parte; a la latitud de Buenos
    /// Aires, un grado de longitud son ~91,5 km.
    /// </remarks>
    [Fact]
    public void A_thousandth_of_a_degree_is_about_a_hundred_meters()
    {
        Assert.InRange(GeoDistance.Meters(-34.6, -58.4, -34.601, -58.4), 110, 112);
        Assert.InRange(GeoDistance.Meters(-34.6, -58.4, -34.6, -58.401), 91, 93);
    }
}
