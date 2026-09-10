using TruckNavigator.Domain.Trips;

namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Que pistas hace avanzar un viaje al cerrarse.
/// </summary>
/// <remarks>
/// <para>
/// <b>La pista de kilometraje no sale de aca.</b> Se recalcula del total acreditado
/// del camionero por dos motivos: para no perder los metros sueltos de cada viaje
/// al redondear a kilometros —sobre cientos de viajes eso se nota— y para que el
/// contador siempre pueda reconstruirse sumando los viajes completados.
/// </para>
/// <para>
/// Un viaje cancelado no mueve nada. Si contara como viaje, arrancar y cancelar
/// seria una forma de subir de escalon sin manejar.
/// </para>
/// </remarks>
public static class TripProgression
{
    /// <summary>
    /// Huso de la Ciudad de Buenos Aires.
    /// </summary>
    /// <remarks>
    /// <b>"Nocturno" es una hora local, no UTC.</b> Las 23:00 en Buenos Aires son
    /// las 02:00 UTC del dia siguiente: mirando la hora UTC se marcarian como
    /// nocturnos los viajes del mediodia. Argentina no aplica horario de verano, asi
    /// que el corrimiento es fijo y no hace falta una base de husos.
    /// </remarks>
    public static readonly TimeSpan LocalOffset = TimeSpan.FromHours(-3);

    /// <summary>Desde que hora local cuenta como nocturno.</summary>
    public const int NightStartsAtHour = 22;

    /// <summary>Hasta que hora local cuenta como nocturno, sin incluirla.</summary>
    public const int NightEndsAtHour = 6;

    public static IReadOnlyDictionary<string, long> IncrementsFor(Trip trip)
    {
        var increments = new Dictionary<string, long>();

        if (trip.Status != TripStatus.Completed)
        {
            return increments;
        }

        increments["viajes"] = 1;

        if (trip.Stops.Count > 0)
        {
            increments["repartos"] = 1;
        }

        if (IsNight(trip.StartedAt))
        {
            increments["nocturnos"] = 1;
        }

        return increments;
    }

    private static bool IsNight(DateTimeOffset startedAt)
    {
        var hour = startedAt.ToOffset(LocalOffset).Hour;

        return hour >= NightStartsAtHour || hour < NightEndsAtHour;
    }
}
