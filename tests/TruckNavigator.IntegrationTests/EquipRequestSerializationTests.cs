using System.Text.Json;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Progression;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El pedido de equipar, tal como llega por HTTP.
/// </summary>
/// <remarks>
/// <para>
/// Este test existe por un defecto real: los tests del lector pasaban porque le
/// pasan el enum ya construido, salteandose el JSON. Por HTTP el endpoint devolvia
/// <b>500</b> —no 409— porque System.Text.Json no convierte una cadena a enum sin
/// que se lo pidan.
/// </para>
/// <para>
/// La leccion es la de siempre en este proyecto: lo que cruza una frontera hay que
/// probarlo cruzandola.
/// </para>
/// </remarks>
public class EquipRequestSerializationTests
{
    /// <remarks>
    /// El cliente manda el nombre de la ranura, no su numero. Un numero seria
    /// ilegible en el codigo del telefono y se romperia en silencio el dia que se
    /// agregue una ranura en el medio del enum.
    /// </remarks>
    [Theory]
    [InlineData("Hat", LoadoutSlot.Hat)]
    [InlineData("Truck", LoadoutSlot.Truck)]
    [InlineData("Background", LoadoutSlot.Background)]
    public void The_slot_arrives_as_its_name(string slot, LoadoutSlot expected)
    {
        var json = $$"""{"slot":"{{slot}}","rewardCode":"viajes-01"}""";

        var request = JsonSerializer.Deserialize<EquipRequest>(
            json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.NotNull(request);
        Assert.Equal(expected, request.Slot);
        Assert.Equal("viajes-01", request.RewardCode);
    }
}
