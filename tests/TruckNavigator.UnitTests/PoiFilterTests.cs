using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Que deja pasar el filtro "solo aptos para mi camion".
/// </summary>
/// <remarks>
/// Decision del usuario del 15/09/2026: lo verificado apto <b>o</b> lo recomendado
/// por la comunidad para el tipo de camion del que consulta. La comunidad
/// completa lo que la fuente no dice; no la contradice: un "no apto" verificado
/// sigue afuera aunque lo recomienden. Lo desconocido y lo discutido siguen
/// afuera, y la interfaz marca distinto cada origen porque el DTO los trae por
/// separado.
/// </remarks>
public class PoiFilterTests
{
    [Theory]
    [InlineData(true, null, true)]                              // verificado apto, sin comunidad
    [InlineData(true, CommunitySeal.Disputed, true)]            // verificado sigue verificado aunque se discuta
    [InlineData(null, CommunitySeal.Recommended, true)]         // sin dato verificado, la comunidad lo recomienda para tu tipo
    [InlineData(false, CommunitySeal.Recommended, false)]       // la fuente dijo que no: la comunidad completa, no reemplaza
    [InlineData(null, CommunitySeal.NoVotesYet, false)]
    [InlineData(null, CommunitySeal.Disputed, false)]
    [InlineData(null, null, false)]
    [InlineData(false, null, false)]
    public void Verified_or_recommended_for_your_truck_passes(bool? verified, CommunitySeal? sealForTruck, bool expected)
    {
        Assert.Equal(expected, PoiFilter.PassesSuitableOnly(verified, sealForTruck));
    }
}
