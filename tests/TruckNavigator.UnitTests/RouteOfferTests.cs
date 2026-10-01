using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Lo que el motor excluyo no se ofrece nunca como opcion. Si por una
/// divergencia de datos una ruta trae un tramo prohibido para el camion, esa
/// ruta se descarta; si es la recomendada, no hay ruta que ofrecer.
/// </summary>
public class RouteOfferTests
{
    private static readonly RestrictionFinding Blocked = new(
        RestrictionKind.MaxHeight, "Altura maxima 3.9 m; el vehiculo declara 4.2 m.",
        3.9, "m", RestrictionSourceType.Osm, "OSM", RestrictionSourceType.Osm, "OSM");

    private static readonly RestrictionFinding OutsideNetwork = new(
        RestrictionKind.OutsideHeavyTrafficNetwork, "Fuera de la Red.",
        12, "t", RestrictionSourceType.CabaOfficial, "Ley 2148", RestrictionSourceType.Osm, "OSM");

    private static TruckRoute Route(params RouteRestrictionNote[] notes) => new(
        1000, 120, [new GeoPoint(-34.6, -58.4), new GeoPoint(-34.61, -58.41)], [], notes,
        notes.Where(n => n.RequiresAccessException).ToList(), 80);

    private static RouteRestrictionNote Note(bool requiresAccessException, RestrictionFinding finding) =>
        new(0, 1, "Calle", 100, requiresAccessException, [finding]);

    [Fact]
    public void A_route_without_notes_is_offerable()
    {
        Assert.True(RouteOffer.IsOfferable(Route()));
    }

    [Fact]
    public void Leaving_the_network_to_reach_the_destination_is_still_offerable()
    {
        Assert.True(RouteOffer.IsOfferable(Route(Note(requiresAccessException: true, OutsideNetwork))));
    }

    [Fact]
    public void A_blocked_segment_makes_the_route_unofferable()
    {
        Assert.False(RouteOffer.IsOfferable(Route(Note(requiresAccessException: false, Blocked))));
    }

    [Fact]
    public void Blocked_alternatives_are_dropped_and_the_recommended_stays_first()
    {
        var recommended = Route();
        var blocked = Route(Note(false, Blocked));
        var fine = Route(Note(true, OutsideNetwork));

        var offered = RouteOffer.Offerable([recommended, blocked, fine]);

        Assert.NotNull(offered);
        Assert.Equal([recommended, fine], offered);
    }

    [Fact]
    public void A_blocked_recommended_route_means_no_offer_at_all()
    {
        Assert.Null(RouteOffer.Offerable([Route(Note(false, Blocked)), Route()]));
    }

    [Fact]
    public void No_routes_means_no_offer()
    {
        Assert.Null(RouteOffer.Offerable([]));
    }

    [Fact]
    public void The_blocking_finding_is_reported_so_the_user_learns_why()
    {
        var route = Route(Note(false, Blocked));

        Assert.Equal(Blocked, RouteOffer.WhyNot(route));
        Assert.Null(RouteOffer.WhyNot(Route()));
    }

    // El viaje arranca por la ruta que el usuario eligio entre las ofrecidas,
    // que se identifica por su posicion en esa lista. Sin eleccion, la
    // recomendada; con una posicion que ya no existe —la lista cambio entre
    // que se mostro y que se arranco—, tambien la recomendada, nunca otra.

    [Fact]
    public void Without_a_choice_the_trip_starts_on_the_recommended_route()
    {
        var recommended = Route();
        var alternative = Route(Note(true, OutsideNetwork));

        Assert.Same(recommended, RouteOffer.Chosen([recommended, alternative], null));
    }

    [Fact]
    public void The_chosen_alternative_is_the_one_the_trip_starts_on()
    {
        var recommended = Route();
        var alternative = Route(Note(true, OutsideNetwork));

        Assert.Same(alternative, RouteOffer.Chosen([recommended, alternative], 1));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(2)]
    [InlineData(9)]
    public void A_choice_that_no_longer_exists_falls_back_to_the_recommended_route(int index)
    {
        var recommended = Route();
        var alternative = Route(Note(true, OutsideNetwork));

        Assert.Same(recommended, RouteOffer.Chosen([recommended, alternative], index));
    }
}
