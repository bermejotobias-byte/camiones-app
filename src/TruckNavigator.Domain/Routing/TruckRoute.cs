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

    /// <summary>
    /// Calcula varias rutas posibles, <b>ordenadas por lo que le conviene a un
    /// camion</b> y no por tiempo.
    /// </summary>
    /// <remarks>
    /// El motor de ruteo devuelve las alternativas ordenadas por peso, que es
    /// basicamente duracion. Para un camion ese orden es el equivocado: una ruta
    /// dos minutos mas larga que no obliga a salir de la Red de Transito Pesado
    /// es mejor que la mas rapida que si obliga — la primera se puede manejar
    /// tranquilo y la segunda es una multa esperando.
    ///
    /// El criterio esta en <see cref="TruckRouteComparer"/>.
    /// </remarks>
    /// <returns>
    /// Al menos una ruta. La primera es la recomendada; el resto son las
    /// alternativas, ya descartadas las repetidas.
    /// </returns>
    Task<IReadOnlyList<TruckRoute>> CalculateAlternativesAsync(
        TruckProfile truck,
        GeoPoint origin,
        GeoPoint destination,
        DateTimeOffset departure,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Ordena rutas por lo que le conviene a un camion.
/// </summary>
/// <remarks>
/// <para>
/// El orden importa mas que en un GPS de auto, y por eso vive en el dominio y no
/// pegado al cliente HTTP: es una regla del producto, no un detalle del motor.
/// </para>
/// <para>
/// Se compara en tres escalones, y cada uno solo se mira si el anterior empata:
/// </para>
/// <list type="number">
///   <item>
///     <b>Tramos que el camion no puede transitar.</b> Una ruta que obliga a
///     pasar por donde este vehiculo tiene prohibido circular no es una
///     alternativa mas lenta: es una ruta que no se puede hacer.
///   </item>
///   <item>
///     <b>Tramos que dependen de la excepcion de acceso.</b> Circular fuera de
///     la Red "para llegar al destino por el camino mas corto" es legal, pero
///     hay que poder justificarlo. Menos es mejor.
///   </item>
///   <item>
///     <b>Duracion</b>, pero con tolerancia: dos rutas que difieren en menos de
///     <see cref="EquivalentSeconds"/> se consideran igual de rapidas.
///   </item>
///   <item>
///     <b>Cuanto va por la Red de Transito Pesado.</b> Entre dos rutas que
///     tardan practicamente lo mismo, gana la que mas usa la Red: son las calles
///     que la Ciudad preparo para camiones. Va DESPUES de la duracion y con
///     tolerancia justamente para que este criterio no pueda elegir un rodeo
///     largo por ganar unos puntos de Red.
///   </item>
/// </list>
/// </remarks>
public sealed class TruckRouteComparer : IComparer<TruckRoute>
{
    public static readonly TruckRouteComparer Instance = new();

    /// <summary>
    /// Diferencia de tiempo por debajo de la cual dos rutas se consideran
    /// igual de rapidas.
    /// </summary>
    /// <remarks>
    /// Un minuto. Sin tolerancia, una ruta que va entera por la Red pierde
    /// contra otra que va por calles de barrio sólo por llegar tres segundos
    /// antes — una diferencia que ademas es una estimacion del motor, no un
    /// hecho, y que en la calle desaparece en el primer semaforo.
    /// </remarks>
    public const double EquivalentSeconds = 60;

    public int Compare(TruckRoute? x, TruckRoute? y)
    {
        if (x is null) return y is null ? 0 : 1;
        if (y is null) return -1;

        // Los tramos con restriccion que NO son de acceso son los bloqueantes:
        // ahi el camion directamente no puede circular.
        var bloqueosX = x.RestrictionNotes.Count(n => !n.RequiresAccessException);
        var bloqueosY = y.RestrictionNotes.Count(n => !n.RequiresAccessException);

        if (bloqueosX != bloqueosY)
        {
            return bloqueosX.CompareTo(bloqueosY);
        }

        if (x.AccessLegs.Count != y.AccessLegs.Count)
        {
            return x.AccessLegs.Count.CompareTo(y.AccessLegs.Count);
        }

        if (Math.Abs(x.DurationSeconds - y.DurationSeconds) > EquivalentSeconds)
        {
            return x.DurationSeconds.CompareTo(y.DurationSeconds);
        }

        // Tardan lo mismo: gana la que mas va por la Red. El signo va al reves
        // porque aca mas es mejor.
        return y.HeavyNetworkSharePercent.CompareTo(x.HeavyNetworkSharePercent);
    }
}

/// <summary>Error recuperable del motor de ruteo (sin ruta, punto inalcanzable, etc.).</summary>
public sealed class RoutingException(string message) : Exception(message);
