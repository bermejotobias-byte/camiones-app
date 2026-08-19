using System.Text.Json;
using TruckNavigator.Domain.Routing;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Verifica que las reglas lleguen al motor de ruteo. Si estas expresiones se
/// rompen, la restriccion deja de formar parte del calculo de la ruta y pasa a
/// ser, en el mejor de los casos, una advertencia posterior.
/// </summary>
public class CabaTruckRoutingPolicyTests
{
    private readonly CabaTruckRoutingPolicy _policy = new();
    private static readonly DateTimeOffset Noon =
        new(2026, 8, 13, 12, 0, 0, TimeSpan.FromHours(-3));

    [Fact]
    public void Physical_limits_are_emitted_as_hard_blocks()
    {
        var model = _policy.BuildCustomModel(SampleTrucks.Heavy(), Noon);

        var blocking = model.Priority.Where(s => s.MultiplyBy == "0").ToList();

        Assert.Contains(blocking, s => s.If == "max_height < 3.8");
        Assert.Contains(blocking, s => s.If == "max_width < 2.5");
        Assert.Contains(blocking, s => s.If == "max_length < 12");
        Assert.Contains(blocking, s => s.If!.StartsWith("max_weight < 18"));
    }

    [Fact]
    public void Heavy_truck_gets_the_heavy_traffic_network_rule()
    {
        var model = _policy.BuildCustomModel(SampleTrucks.Heavy(), Noon);

        var networkRule = model.Priority.Single(s => s.If == "hgv != DESIGNATED");

        // Penalizacion, no bloqueo: si fuera "0" el camion no podria llegar a
        // ningun destino que no este sobre la Red.
        Assert.NotEqual("0", networkRule.MultiplyBy);
        Assert.Equal("0.03", networkRule.MultiplyBy);
    }

    [Fact]
    public void Light_truck_does_not_get_the_heavy_traffic_network_rule()
    {
        var model = _policy.BuildCustomModel(SampleTrucks.Light(), Noon);

        Assert.DoesNotContain(model.Priority, s => s.If == "hgv != DESIGNATED");
    }

    [Fact]
    public void Semi_trailer_length_uses_the_whole_combination()
    {
        var model = _policy.BuildCustomModel(SampleTrucks.SemiTrailer(), Noon);

        // 6 m de tractor + 12 m de semirremolque.
        Assert.Contains(model.Priority, s => s.If == "max_length < 18");
    }

    [Fact]
    public void Numbers_are_serialised_with_a_dot_regardless_of_the_machine_locale()
    {
        var original = Thread.CurrentThread.CurrentCulture;
        try
        {
            // es-AR usa coma decimal; una coma partiria la expresion en dos.
            Thread.CurrentThread.CurrentCulture = new System.Globalization.CultureInfo("es-AR");

            var model = _policy.BuildCustomModel(SampleTrucks.Heavy(), Noon);
            var json = JsonSerializer.Serialize(model);

            Assert.Contains("max_height \\u003C 3.8", json);
            Assert.DoesNotContain("3,8", json);
        }
        finally
        {
            Thread.CurrentThread.CurrentCulture = original;
        }
    }

    [Fact]
    public void Serialised_model_omits_unset_statement_fields()
    {
        var model = _policy.BuildCustomModel(SampleTrucks.Heavy(), Noon);

        var json = JsonSerializer.Serialize(model);

        // GraphHopper rechaza una sentencia que traiga a la vez "if" y "else_if".
        Assert.DoesNotContain("else_if", json);
        Assert.DoesNotContain("limit_to", json);
    }
}
