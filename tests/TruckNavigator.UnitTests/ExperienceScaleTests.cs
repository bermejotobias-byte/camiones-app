using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Cuanta experiencia vale cada cosa.
/// </summary>
/// <remarks>
/// <para>
/// Decision del usuario del 10/09/2026: <b>la EXP mide esfuerzo, no cantidad</b>.
/// Antes un viaje de 300 km y uno de 20 km daban los dos 20, y el escalon —que
/// cuesta semanas— daba 50, o sea dos viajes y medio.
/// </para>
/// <para>
/// La regla vive en el dominio y no en el registrador porque es una regla, no una
/// forma de guardar: asi se puede probar sin base y el dia que haya bonos, la
/// segunda moneda se agrega al lado.
/// </para>
/// </remarks>
public class ExperienceScaleTests
{
    /// <remarks>
    /// El piso existe para que un reparto corto no de casi cero. Cuatro cuadras
    /// siguen siendo un viaje que se manejo.
    /// </remarks>
    [Fact]
    public void A_short_trip_still_pays_the_base()
    {
        Assert.Equal(10, ExperienceScale.ForTrip(creditedMeters: 0));
        Assert.Equal(10, ExperienceScale.ForTrip(creditedMeters: 400));
    }

    [Theory]
    [InlineData(20_000, 12)]   // 20 km  -> 10 + 2
    [InlineData(120_000, 22)]  // 120 km -> 10 + 12
    [InlineData(300_000, 40)]  // 300 km -> 10 + 30
    public void A_longer_trip_pays_one_more_every_ten_kilometers(double meters, int expected)
    {
        Assert.Equal(expected, ExperienceScale.ForTrip(meters));
    }

    /// <remarks>
    /// Se trunca, no se redondea: 19 km pagan lo mismo que 10. Redondear hacia
    /// arriba haria que un viaje de 5 km cobre el tramo de 10 que no hizo.
    /// </remarks>
    [Fact]
    public void The_kilometers_that_do_not_complete_a_tranche_do_not_pay()
    {
        Assert.Equal(11, ExperienceScale.ForTrip(creditedMeters: 19_999));
        Assert.Equal(12, ExperienceScale.ForTrip(creditedMeters: 20_000));
    }

    /// <remarks>
    /// Una distancia negativa no deberia existir, pero si llegara, restar EXP seria
    /// peor que ignorarla: el libro no tiene forma de devolver.
    /// </remarks>
    [Fact]
    public void A_nonsense_distance_never_pays_less_than_the_base()
    {
        Assert.Equal(10, ExperienceScale.ForTrip(creditedMeters: -500));
        Assert.Equal(10, ExperienceScale.ForTrip(creditedMeters: double.NaN));
    }

    /// <remarks>
    /// El escalon tiene que valer mas que un viaje largo: es lo que se acumula
    /// durante semanas. Con 100 contra 40 del viaje de 300 km, la relacion se sostiene.
    /// </remarks>
    [Fact]
    public void A_tier_is_worth_more_than_the_longest_trip_it_takes_to_reach_it()
    {
        Assert.Equal(100, ExperienceScale.PerTier);
        Assert.True(ExperienceScale.PerTier > ExperienceScale.ForTrip(300_000));
    }
}
