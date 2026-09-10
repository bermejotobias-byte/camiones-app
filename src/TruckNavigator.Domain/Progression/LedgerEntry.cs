namespace TruckNavigator.Domain.Progression;

/// <summary>En que esta expresado un movimiento.</summary>
/// <remarks>
/// Hoy hay una sola denominacion. La columna existe igual porque el usuario dejo
/// los cofres y las suscripciones guardados como concepto: si algun dia se reabre
/// esa economia, sumar una moneda es un valor mas en este enum y no una migracion.
/// </remarks>
public enum Denomination
{
    Experience = 0
}

/// <summary>Por que se acredito un movimiento.</summary>
/// <remarks>
/// Dos motivos alcanzan: todo lo que no es cerrar un viaje es completar un escalon,
/// y el escalon ya identifica su pista.
/// </remarks>
public enum LedgerReason
{
    TripCompleted = 0,
    TierCompleted = 1
}

/// <summary>
/// Un asiento del libro: algo que se le acredito a un camionero, y por que.
/// </summary>
/// <remarks>
/// <para>
/// Es un libro y no un contador por tres razones que un numero suelto no da:
/// que un mismo hecho no acredite dos veces, poder responder "por que tengo 1.200
/// de EXP", y poder recalcular si una regla cambia.
/// </para>
/// <para>
/// La primera es la que sostiene todo, y no la garantiza esta clase sino el indice
/// unico sobre <c>(DriverId, Denomination, Reason, SourceKey)</c>: es la base la
/// unica que puede verlo entre todas las escrituras a la vez.
/// </para>
/// </remarks>
public sealed class LedgerEntry
{
    public Guid Id { get; set; }

    public Guid DriverId { get; set; }

    public DateTimeOffset OccurredAt { get; set; }

    public Denomination Denomination { get; set; }

    /// <summary>Cuanto se acredito. Siempre positivo: nada resta todavia.</summary>
    public int Amount { get; set; }

    public LedgerReason Reason { get; set; }

    /// <summary>
    /// Que hecho lo origino: el <c>Guid</c> del viaje, o pista y escalon como
    /// <c>"viajes:4"</c>.
    /// </summary>
    /// <remarks>
    /// Es la mitad de la clave de unicidad, asi que tiene que identificar el hecho
    /// sin ambiguedad. Dos camioneros pueden compartir la misma clave —los dos
    /// llegan al escalon 4 de viajes— y eso esta bien: el indice incluye el dueno.
    /// </remarks>
    public string SourceKey { get; set; } = string.Empty;
}
