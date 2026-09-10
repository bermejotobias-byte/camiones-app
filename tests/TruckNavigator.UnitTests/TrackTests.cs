using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Las pistas de progreso.
/// </summary>
/// <remarks>
/// <para>
/// Una pista es una familia de escalones: <c>viajes</c>, <c>nocturnos</c>,
/// <c>reportes-siniestro</c>. El escalon en curso es lo que el usuario ve como
/// <b>meta</b>; la pista entera es lo que ve como <b>logro</b>.
/// </para>
/// <para>
/// Estos tests usan una pista inventada a proposito. El catalogo real todavia
/// tiene objetivos sin cerrar, y atarlos aca haria que definirlos rompiera tests
/// que no son sobre eso.
/// </para>
/// </remarks>
public class TrackTests
{
    private static Track Sample() => new(
        "prueba",
        [
            new TrackTier(10, "recompensa-1"),
            new TrackTier(25, "recompensa-2"),
            new TrackTier(50, "recompensa-3")
        ]);

    [Theory]
    [InlineData(0, 0)]
    [InlineData(9, 0)]
    [InlineData(10, 1)]
    [InlineData(24, 1)]
    [InlineData(25, 2)]
    [InlineData(49, 2)]
    [InlineData(50, 3)]
    public void A_tier_is_reached_when_its_goal_is_met(long count, int expectedTiers)
    {
        Assert.Equal(expectedTiers, Sample().TiersReachedAt(count));
    }

    /// <remarks>
    /// Terminar la pista no la desborda: quien la completo sigue acumulando y el
    /// escalon no puede pasar del ultimo.
    /// </remarks>
    [Theory]
    [InlineData(51)]
    [InlineData(1_000_000)]
    public void Finishing_a_track_does_not_overflow_it(long count)
    {
        Assert.Equal(3, Sample().TiersReachedAt(count));
    }
}
