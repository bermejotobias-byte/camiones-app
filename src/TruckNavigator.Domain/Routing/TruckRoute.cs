using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Routing;

public readonly record struct GeoPoint(double Latitude, double Longitude);

/// <summary>
/// Un paso de la navegacion: que maniobra hacer, donde, y cuanto se recorre
/// despues de hacerla.
/// </summary>
/// <remarks>
/// <para>
/// <b>La maniobra ocurre en <see cref="FromPointIndex"/></b>, y
/// <see cref="DistanceMeters"/> es lo que se recorre <b>despues</b> de hacerla,
/// hasta la maniobra siguiente. Es la convencion del motor de ruteo y conviene
/// tenerla presente: leerlo al reves adelanta cada aviso una cuadra entera.
/// </para>
/// <para>
/// Sin los indices no hay navegacion paso a paso posible, porque no se puede
/// saber a que distancia esta el proximo giro.
/// </para>
/// </remarks>
/// <param name="FromPointIndex">Indice en la geometria donde se hace la maniobra.</param>
/// <param name="ToPointIndex">Indice donde termina el tramo (inclusive).</param>
/// <param name="ExitNumber">Salida a tomar, solo en rotondas.</param>
public sealed record RouteInstruction(
    string Text,
    double DistanceMeters,
    double DurationSeconds,
    string? StreetName,
    ManeuverKind Kind,
    int FromPointIndex,
    int ToPointIndex,
    int? ExitNumber = null);

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
