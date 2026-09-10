using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El motor de progresion.
/// </summary>
/// <remarks>
/// <para>
/// Es una funcion pura: recibe donde estaba cada pista y cuanto sumo, y devuelve
/// que escalones se completaron. Sin base de datos y sin reloj adentro, para que se
/// pueda testear como <c>DeliveryOrder</c> o <c>TruckRouteComparer</c>.
/// </para>
/// <para>
/// El cliente nunca lo invoca ni le informa nada: todo lo que se gana ocurre como
/// efecto de que el servidor cierre un viaje.
/// </para>
/// </remarks>
public class ProgressionEngineTests
{
    private static Track Viajes() => new(
        "viajes",
        [
            new TrackTier(10, "gorra"),
            new TrackTier(25, "campera"),
            new TrackTier(50, "chaleco")
        ]);

    [Fact]
    public void Crossing_a_tier_reports_it_with_its_reward()
    {
        var outcome = ProgressionEngine.Advance(
            [Viajes()],
            countsBefore: new Dictionary<string, long> { ["viajes"] = 9 },
            increments: new Dictionary<string, long> { ["viajes"] = 1 });

        var completed = Assert.Single(outcome.CompletedTiers);

        Assert.Equal("viajes", completed.TrackCode);
        Assert.Equal(1, completed.Tier);
        Assert.Equal("gorra", completed.RewardCode);
    }

    /// <remarks>
    /// Un viaje largo puede completar dos metas de kilometraje de un saque. Si el
    /// motor reportara solo la ultima, la recompensa de la primera se perderia sin
    /// que nadie se entere.
    /// </remarks>
    [Fact]
    public void A_single_event_can_cross_several_tiers_at_once()
    {
        var outcome = ProgressionEngine.Advance(
            [Viajes()],
            countsBefore: new Dictionary<string, long> { ["viajes"] = 0 },
            increments: new Dictionary<string, long> { ["viajes"] = 30 });

        Assert.Equal(2, outcome.CompletedTiers.Count);
        Assert.Equal(["gorra", "campera"], outcome.CompletedTiers.Select(t => t.RewardCode));
    }

    [Fact]
    public void A_track_that_did_not_move_reports_nothing()
    {
        var outcome = ProgressionEngine.Advance(
            [Viajes()],
            countsBefore: new Dictionary<string, long> { ["viajes"] = 9 },
            increments: new Dictionary<string, long>());

        Assert.Empty(outcome.CompletedTiers);
    }

    /// <remarks>
    /// Quien termino la pista sigue acumulando: no puede volver a cobrar el ultimo
    /// escalon en cada viaje.
    /// </remarks>
    [Fact]
    public void A_finished_track_stops_paying()
    {
        var outcome = ProgressionEngine.Advance(
            [Viajes()],
            countsBefore: new Dictionary<string, long> { ["viajes"] = 60 },
            increments: new Dictionary<string, long> { ["viajes"] = 5 });

        Assert.Empty(outcome.CompletedTiers);
    }

    [Fact]
    public void Several_tracks_advance_in_the_same_event()
    {
        var nocturnos = new Track("nocturnos", [new TrackTier(1, "farol")]);

        var outcome = ProgressionEngine.Advance(
            [Viajes(), nocturnos],
            countsBefore: new Dictionary<string, long> { ["viajes"] = 9, ["nocturnos"] = 0 },
            increments: new Dictionary<string, long> { ["viajes"] = 1, ["nocturnos"] = 1 });

        Assert.Equal(["gorra", "farol"], outcome.CompletedTiers.Select(t => t.RewardCode));
    }
}
