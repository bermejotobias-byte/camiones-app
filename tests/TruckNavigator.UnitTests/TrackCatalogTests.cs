using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El catalogo de pistas.
/// </summary>
/// <remarks>
/// <para>
/// Los objetivos de <c>viajes</c>, <c>repartos</c> y <c>nocturnos</c> <b>ya no son
/// provisorios</b>: los eligio el usuario el 10/09/2026, calibrados contra la
/// cadencia real del oficio. Por eso ahora si se fijan los numeros: son una
/// decision, y una decision que se puede cambiar sin querer no esta tomada.
/// </para>
/// <para>
/// El resto de los tests fijan <b>invariantes</b>, que valen para cualquier numero
/// que se elija despues.
/// </para>
/// </remarks>
public class TrackCatalogTests
{
    [Fact]
    public void The_catalog_only_has_tracks_the_server_can_already_measure()
    {
        Assert.Equal(
            ["kilometraje", "viajes", "repartos", "nocturnos", "lugares"],
            TrackCatalog.All.Select(t => t.Code));
    }

    /// <remarks>
    /// <para>
    /// Cada escalera tiene su propio ritmo porque cada actividad tiene el suyo.
    /// Medido contra una cadencia real —2 viajes por dia, 5 repartos por dia, 1
    /// nocturno por semana, 250 dias de trabajo al año— las tres terminan en un
    /// orden de magnitud parecido: dos a tres años y medio de trabajo sostenido.
    /// </para>
    /// <para>
    /// Antes las tres tenian la misma forma y eso las dejaba mal calibradas en
    /// direcciones opuestas: repartos se agotaba en cuatro meses y nocturnos
    /// tardaba mas de seis años. <b>La misma escala para actividades de cadencia
    /// distinta no es coherencia, es no haber mirado.</b>
    /// </para>
    /// </remarks>
    [Theory]
    [InlineData("viajes",    new long[] { 1, 3, 7, 15, 30, 60, 120, 250, 500, 1_000 })]
    [InlineData("repartos",  new long[] { 1, 5, 15, 40, 100, 250, 500, 1_000, 1_750, 2_500 })]
    [InlineData("nocturnos", new long[] { 1, 2, 5, 10, 20, 35, 60, 90, 130, 180 })]
    [InlineData("lugares",   new long[] { 1, 3, 7, 15, 30, 60, 120, 250, 500, 1_000 })]
    public void The_ladders_are_the_ones_calibrated_against_the_trade(string code, long[] goals)
    {
        Assert.Equal(goals, TrackCatalog.Get(code).Tiers.Select(t => t.Goal));
    }

    /// <remarks>
    /// El primer escalon de toda pista contable es <b>uno</b>: el enganche es que la
    /// primera vez que hacés algo, algo se prende.
    /// </remarks>
    [Fact]
    public void Every_countable_track_lights_up_on_the_first_one()
    {
        foreach (var track in TrackCatalog.All.Where(t => t.Code != TrackCatalog.Mileage))
        {
            Assert.Equal(1, track.Tiers[0].Goal);
        }
    }

    /// <remarks>
    /// La pista de kilometraje no tiene numeros propios: son los de la escala de
    /// niveles. Si divergen, el perfil diria un nivel y una meta que no se
    /// corresponden.
    /// </remarks>
    [Fact]
    public void The_mileage_track_follows_the_level_scale()
    {
        Assert.Equal(
            LevelScale.GoalThresholds(),
            TrackCatalog.Get("kilometraje").Tiers.Select(t => t.Goal));
    }

    /// <remarks>
    /// Un escalon que no supera al anterior se completaria junto con el, y entregaria
    /// dos recompensas de una sola vez.
    /// </remarks>
    [Fact]
    public void Every_track_has_growing_goals()
    {
        foreach (var track in TrackCatalog.All)
        {
            for (var i = 1; i < track.Tiers.Count; i++)
            {
                Assert.True(
                    track.Tiers[i].Goal > track.Tiers[i - 1].Goal,
                    $"{track.Code}: el escalon {i} no supera al anterior.");
            }
        }
    }

    [Fact]
    public void Every_tier_hands_out_a_reward()
    {
        foreach (var track in TrackCatalog.All)
        {
            Assert.All(track.Tiers, tier =>
                Assert.False(
                    string.IsNullOrWhiteSpace(tier.RewardCode),
                    $"{track.Code}: hay un escalon sin recompensa."));
        }
    }

    /// <remarks>
    /// <b>La invariante que mas duele si se rompe.</b> El inventario tiene clave
    /// (camionero, recompensa): si dos escalones entregaran el mismo objeto, el
    /// segundo reventaria al guardar, en produccion y en medio de un festejo.
    /// </remarks>
    [Fact]
    public void No_reward_is_handed_out_by_two_different_tiers()
    {
        var rewards = TrackCatalog.All
            .SelectMany(track => track.Tiers.Select(tier => tier.RewardCode))
            .ToList();

        Assert.Equal(rewards.Count, rewards.Distinct().Count());
    }

    [Fact]
    public void Asking_for_a_track_that_does_not_exist_is_an_error()
    {
        Assert.Throws<KeyNotFoundException>(() => TrackCatalog.Get("no-existe"));
    }
}
