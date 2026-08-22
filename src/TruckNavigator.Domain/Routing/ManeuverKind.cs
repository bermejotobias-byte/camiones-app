namespace TruckNavigator.Domain.Routing;

/// <summary>
/// Que tiene que hacer el conductor en una instruccion.
/// </summary>
/// <remarks>
/// <para>
/// El motor de ruteo expresa esto como un entero con signo —negativo a la
/// izquierda, positivo a la derecha—. La traduccion se hace una sola vez, en la
/// capa que habla con el motor: el dominio y la app trabajan con nombres, no con
/// numeros cuya convencion hay que recordar.
/// </para>
/// <para>
/// Importa mas de lo que parece: de esto salen la flecha que se dibuja en
/// pantalla y el verbo que se dice en voz alta. Un entero mal interpretado manda
/// a un camion a doblar donde no debe.
/// </para>
/// </remarks>
public enum ManeuverKind
{
    /// <summary>El motor informo algo que todavia no sabemos representar.</summary>
    Unknown = 0,

    Continue,

    SlightLeft,
    Left,
    SharpLeft,

    SlightRight,
    Right,
    SharpRight,

    /// <summary>Mantenerse por la izquierda en una bifurcacion.</summary>
    KeepLeft,

    /// <summary>Mantenerse por la derecha en una bifurcacion.</summary>
    KeepRight,

    UTurn,

    /// <summary>Rotonda. La salida va en <see cref="RouteInstruction.ExitNumber"/>.</summary>
    Roundabout,

    /// <summary>Punto intermedio alcanzado.</summary>
    Waypoint,

    /// <summary>Llegada.</summary>
    Finish
}
