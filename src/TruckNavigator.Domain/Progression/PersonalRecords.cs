namespace TruckNavigator.Domain.Progression;

/// <summary>La mejor marca de un camionero en algo, y cuando la consiguio.</summary>
public readonly record struct RecordStanding(long Value, DateTimeOffset AchievedAt);

/// <summary>
/// Decide si una marca nueva supera al record vigente.
/// </summary>
/// <remarks>
/// <para>
/// Los records no son progresion y no otorgan nada, por eso no pasan por el libro
/// de movimientos: son "mas kilometros en un dia", "el viaje mas largo", "la racha
/// mas larga". Lo que los hace valiosos es <b>cuando</b> ocurrieron.
/// </para>
/// <para>
/// Igualar no es superar. Si el empate moviera la fecha, la marca diria que se
/// consiguio hoy cuando en realidad se consiguio hace meses, y se perderia
/// justamente lo que se queria mostrar.
/// </para>
/// </remarks>
public static class PersonalRecords
{
    /// <summary>
    /// El record nuevo si la marca lo supera, o <c>null</c> si no cambio nada.
    /// </summary>
    public static RecordStanding? Improve(
        RecordStanding? current,
        long candidate,
        DateTimeOffset when)
    {
        if (current is { } vigente && candidate <= vigente.Value)
        {
            return null;
        }

        return new RecordStanding(candidate, when);
    }
}
