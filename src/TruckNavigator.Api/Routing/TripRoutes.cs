using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Api.Routing;

/// <summary>
/// La ruta con la que arranca —o se retoma— un viaje, o por que no la hay.
/// </summary>
/// <remarks>
/// <para>
/// Pasa por el MISMO camino que <c>POST /api/routes</c>: las alternativas
/// ordenadas por lo que le conviene a un camion y el filtro de AD-47. Antes el
/// viaje pedia una sola ruta al motor —la mas rapida por peso— y arrancaba por
/// otra que la que se acababa de recomendar en pantalla (medido el 16/09/2026:
/// 2,7 km al 52 % por la Red contra 2,2 km al 60 %), y ademas sin el filtro,
/// o sea que un tramo prohibido podia colarse justo en el viaje que se iba a
/// manejar.
/// </para>
/// <para>
/// Con paradas la ruta es una sola, la que pasa por todas en su orden (AD-45),
/// y solo se comprueba que sea ofrecible.
/// </para>
/// </remarks>
public static class TripRoutes
{
    public static async Task<(TruckRoute? Route, string? Reason)> ForTripAsync(
        ITruckRouteCalculator calculator,
        TruckProfile truck,
        GeoPoint origin,
        GeoPoint destination,
        IReadOnlyList<GeoPoint> stops,
        int? routeIndex,
        DateTimeOffset departure,
        CancellationToken ct = default)
    {
        if (stops.Count > 0)
        {
            var route = await calculator.CalculateThroughAsync(truck, [origin, .. stops, destination], departure, ct);

            return RouteOffer.IsOfferable(route)
                ? (route, null)
                : (null, Unofferable(truck, RouteOffer.WhyNot(route)));
        }

        var calculadas = await calculator.CalculateAlternativesAsync(truck, origin, destination, departure, ct);
        var ofrecibles = RouteOffer.Offerable(calculadas);

        if (ofrecibles is null)
        {
            return (null, Unofferable(truck, calculadas.Count > 0 ? RouteOffer.WhyNot(calculadas[0]) : null));
        }

        return (RouteOffer.Chosen(ofrecibles, routeIndex), null);
    }

    /// <summary>Por que no hay ruta apta, en una frase para el usuario.</summary>
    public static string Unofferable(TruckProfile truck, RestrictionFinding? motivo) =>
        motivo is null
            ? "El motor no encontro una ruta por la que este camion pueda circular."
            : $"La unica ruta posible pasa por un tramo prohibido para {truck.Name}: {motivo.Description}";
}
