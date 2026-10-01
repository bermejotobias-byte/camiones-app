using System.Text.Json;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Routing;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El bloqueo que un reporte validado mete en el custom model: un poligono
/// chico alrededor del punto, a lo largo de la calle si se sabe el rumbo, y
/// una sentencia de prioridad cero sobre esa area.
/// </summary>
/// <remarks>
/// Medido el 19/09/2026 contra GraphHopper 11: un cuadrado de once metros
/// sobre la ruta alcanzo para que el motor cambiara de cuadra. Las medidas de
/// aca (40 x 16 con rumbo, 24 de lado sin rumbo) quedan por debajo de los ~100 m
/// que separan dos calles paralelas en CABA: bloquean esa cuadra y no la de al lado.
/// </remarks>
public class RouteBlockadeTests
{
    private const double Lat = -34.6037;
    private const double Lon = -58.3816;

    private static readonly DateTimeOffset Noon = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

    private static double MetresNorth(double fromLat, double toLat) => GeoDistance.Meters(fromLat, Lon, toLat, Lon);

    private static double MetresEast(double fromLon, double toLon) => GeoDistance.Meters(Lat, fromLon, Lat, toLon);

    [Fact]
    public void Without_heading_it_is_a_closed_square_of_twenty_four_metres()
    {
        var polygon = new RouteBlockade("r1", Lat, Lon, null).Polygon();

        Assert.Equal(5, polygon.Count);
        Assert.Equal(polygon[0], polygon[4]);

        var north = polygon.Max(p => p.Lat);
        var south = polygon.Min(p => p.Lat);
        var east = polygon.Max(p => p.Lon);
        var west = polygon.Min(p => p.Lon);

        Assert.Equal(12, MetresNorth(Lat, north), 0.5);
        Assert.Equal(12, MetresNorth(Lat, south), 0.5);
        Assert.Equal(12, MetresEast(Lon, east), 0.5);
        Assert.Equal(12, MetresEast(Lon, west), 0.5);
    }

    [Fact]
    public void Heading_east_it_is_a_rectangle_along_the_street()
    {
        var polygon = new RouteBlockade("r1", Lat, Lon, 90).Polygon();

        Assert.Equal(20, MetresEast(Lon, polygon.Max(p => p.Lon)), 0.5);
        Assert.Equal(20, MetresEast(Lon, polygon.Min(p => p.Lon)), 0.5);
        Assert.Equal(8, MetresNorth(Lat, polygon.Max(p => p.Lat)), 0.5);
        Assert.Equal(8, MetresNorth(Lat, polygon.Min(p => p.Lat)), 0.5);
    }

    [Fact]
    public void Heading_north_the_rectangle_turns_with_the_street()
    {
        var polygon = new RouteBlockade("r1", Lat, Lon, 0).Polygon();

        Assert.Equal(8, MetresEast(Lon, polygon.Max(p => p.Lon)), 0.5);
        Assert.Equal(20, MetresNorth(Lat, polygon.Max(p => p.Lat)), 0.5);
    }

    [Fact]
    public void The_policy_adds_the_areas_and_blocks_them_after_the_physical_rules()
    {
        var policy = new CabaTruckRoutingPolicy();
        var blockades = new[]
        {
            new RouteBlockade("r1", Lat, Lon, null),
            new RouteBlockade("r2", Lat + 0.01, Lon, 45)
        };

        var model = policy.BuildCustomModel(SampleTrucks.Heavy(), Noon, blockades);
        var json = JsonSerializer.Serialize(model);

        Assert.NotNull(model.Areas);
        Assert.Equal(2, model.Areas!.Features.Count);
        Assert.Contains("\"areas\":{\"type\":\"FeatureCollection\"", json);
        Assert.Contains("\"id\":\"r1\"", json);
        Assert.Contains("\"type\":\"Polygon\"", json);

        var rules = model.Priority.Select(s => s.If).ToList();
        var last = model.Priority.Count;

        Assert.Equal("in_r1", rules[last - 2]);
        Assert.Equal("in_r2", rules[last - 1]);
        Assert.All(model.Priority.Where(s => s.If!.StartsWith("in_")), s => Assert.Equal("0", s.MultiplyBy));
        Assert.Contains(rules, r => r!.StartsWith("max_height"));
    }

    [Fact]
    public void Without_blockades_the_model_is_the_one_of_always()
    {
        var policy = new CabaTruckRoutingPolicy();

        var plain = JsonSerializer.Serialize(policy.BuildCustomModel(SampleTrucks.Heavy(), Noon));
        var explicitlyEmpty = JsonSerializer.Serialize(policy.BuildCustomModel(SampleTrucks.Heavy(), Noon, []));

        Assert.Equal(plain, explicitlyEmpty);
        Assert.DoesNotContain("areas", plain);
        Assert.DoesNotContain("in_", plain);
    }

    [Fact]
    public void Coordinates_are_serialised_as_longitude_then_latitude_with_a_dot()
    {
        var original = Thread.CurrentThread.CurrentCulture;
        try
        {
            Thread.CurrentThread.CurrentCulture = new System.Globalization.CultureInfo("es-AR");

            var model = new CabaTruckRoutingPolicy().BuildCustomModel(
                SampleTrucks.Heavy(), Noon, [new RouteBlockade("r1", Lat, Lon, null)]);
            var json = JsonSerializer.Serialize(model);

            Assert.Contains("[[[-58.38", json);
            Assert.DoesNotContain("-58,38", json);
        }
        finally
        {
            Thread.CurrentThread.CurrentCulture = original;
        }
    }
}
