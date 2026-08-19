using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Routing;

public readonly record struct GeoPoint(double Latitude, double Longitude);

public sealed record RouteInstruction(
    string Text,
    double DistanceMeters,
    double DurationSeconds,
    string? StreetName);

/// <summary>
/// Un tramo de la ruta calculada al que le aplica alguna restriccion, con la
/// explicacion y las fuentes correspondientes.
/// </summary>
/// <param name="FromPointIndex">Indice del primer punto de la geometria (inclusive).</param>
/// <param name="ToPointIndex">Indice del ultimo punto de la geometria (exclusive).</param>
public sealed record RouteRestrictionNote(
    int FromPointIndex,
    int ToPointIndex,
    string StreetName,
    double DistanceMeters,
    bool RequiresAccessException,
    IReadOnlyList<RestrictionFinding> Findings);

public sealed record TruckRoute(
    double DistanceMeters,
    double DurationSeconds,
    IReadOnlyList<GeoPoint> Geometry,
    IReadOnlyList<RouteInstruction> Instructions,
    IReadOnlyList<RouteRestrictionNote> RestrictionNotes,
    IReadOnlyList<RouteRestrictionNote> AccessLegs,
    double HeavyNetworkSharePercent);

public interface ITruckRouteCalculator
{
    Task<TruckRoute> CalculateAsync(
        TruckProfile truck,
        GeoPoint origin,
        GeoPoint destination,
        DateTimeOffset departure,
        CancellationToken cancellationToken = default);
}

/// <summary>Error recuperable del motor de ruteo (sin ruta, punto inalcanzable, etc.).</summary>
public sealed class RoutingException(string message) : Exception(message);
