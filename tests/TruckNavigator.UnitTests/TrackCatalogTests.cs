using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El catalogo de pistas.
/// </summary>
/// <remarks>
/// Los objetivos de <c>viajes</c>, <c>repartos</c> y <c>nocturnos</c> son
/// <b>provisorios</b>: el usuario todavia no los eligio. Estos tests no fijan los
/// numeros —eso los haria romperse cuando se decidan— sino las <b>invariantes</b>
/// que cualquier numero tiene que cumplir para que el motor no haga cosas raras.
/// </remarks>
public class TrackCatalogTests
{
    [Fact]
    public void The_catalog_only_has_tracks_the_server_can_already_measure()
    {
        Assert.Equal(
            ["kilometraje", "viajes", "repartos", "nocturnos"],
            TrackCatalog.All.Select(t => t.Code));
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
