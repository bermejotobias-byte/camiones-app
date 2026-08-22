namespace TruckNavigator.Domain.Trips;

/// <summary>
/// Decide cuantos kilometros de un viaje se le acreditan al camionero.
/// </summary>
/// <remarks>
/// <para>
/// La distancia sale de la ruta que <b>calculo el servidor</b> al arrancar el
/// viaje, nunca de lo que informe el telefono. Esa es la mitad del problema.
/// </para>
/// <para>
/// La otra mitad es el tiempo: sin ninguna condicion, arrancar un viaje y
/// cerrarlo en el acto acreditaria la distancia entera sin haber movido el
/// camion. Por eso se exige que haya transcurrido al menos una fraccion de la
/// duracion estimada.
/// </para>
/// <para>
/// <b>Es una regla de plausibilidad, no una verificacion.</b> No prueba que el
/// camion haya recorrido la ruta: prueba que paso tiempo suficiente como para
/// que fuera posible. La verificacion de verdad necesita el trazado del GPS
/// comparado contra la ruta, y eso llega con la navegacion paso a paso. Cuando
/// llegue, se reemplaza el contenido de esta clase y no el esquema de la base:
/// <c>CreditedDistanceMeters</c> ya esta separado de
/// <c>PlannedDistanceMeters</c> justamente para eso.
/// </para>
/// </remarks>
public static class TripCrediting
{
    /// <summary>
    /// Fraccion de la duracion estimada que tiene que haber pasado para acreditar.
    /// </summary>
    /// <remarks>
    /// La mitad deja margen para que el trafico este mas suelto que lo que estimo
    /// el motor, y a la vez descarta lo imposible: cerrar en 14 minutos un viaje
    /// estimado en 30 implica el doble de la velocidad prevista, que dentro de la
    /// Ciudad no pasa.
    /// </remarks>
    public const double MinimumElapsedFraction = 0.5;

    public static double CreditFor(
        double plannedDistanceMeters,
        double plannedDurationSeconds,
        TimeSpan elapsed)
    {
        if (elapsed < TimeSpan.Zero)
        {
            return 0;
        }

        var required = plannedDurationSeconds * MinimumElapsedFraction;

        return elapsed.TotalSeconds >= required ? plannedDistanceMeters : 0;
    }
}
