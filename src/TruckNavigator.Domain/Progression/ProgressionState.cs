namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Por donde va un camionero en una pista.
/// </summary>
/// <remarks>
/// <c>TierReached</c> no es redundante con <c>Count</c>: se puede recalcular
/// recorriendo el catalogo, pero tenerlo guardado hace que "subio de escalon" sea
/// una comparacion y no una busqueda en cada cierre de viaje.
/// </remarks>
public sealed class DriverTrackProgress
{
    public Guid DriverId { get; set; }

    public string TrackCode { get; set; } = string.Empty;

    /// <summary>Acumulado de la pista: kilometros, viajes, reportes, lo que sea.</summary>
    public long Count { get; set; }

    public int TierReached { get; set; }
}

/// <summary>Una recompensa que el camionero ya desbloqueo. Es el inventario.</summary>
public sealed class DriverReward
{
    public Guid DriverId { get; set; }

    public string RewardCode { get; set; } = string.Empty;

    public DateTimeOffset UnlockedAt { get; set; }
}

/// <summary>
/// Donde se puede equipar una recompensa.
/// </summary>
/// <remarks>
/// Las nueve primeras salen del editor de avatar que sirvio de referencia. La
/// decima no estaba ahi y es la propia de esta app: el camion coleccionable que se
/// exhibe en el perfil.
/// </remarks>
public enum LoadoutSlot
{
    Face = 0,
    Body = 1,
    Eyes = 2,
    Hair = 3,
    Beard = 4,
    Glasses = 5,
    Hat = 6,
    Clothes = 7,
    Background = 8,
    Truck = 9
}

/// <summary>Que tiene puesto en cada ranura. Es el equipamiento.</summary>
public sealed class DriverLoadout
{
    public Guid DriverId { get; set; }

    public LoadoutSlot Slot { get; set; }

    public string RewardCode { get; set; } = string.Empty;
}

/// <summary>
/// La mejor marca historica de un camionero en algo.
/// </summary>
/// <remarks>
/// No pasa por el libro porque no otorga nada. Lo que lo hace valioso es
/// <c>AchievedAt</c>: sin la fecha es un numero mas.
/// </remarks>
public sealed class DriverRecord
{
    public Guid DriverId { get; set; }

    public string RecordCode { get; set; } = string.Empty;

    public long Value { get; set; }

    public DateTimeOffset AchievedAt { get; set; }
}

/// <summary>
/// Hasta donde el camionero ya vio sus festejos.
/// </summary>
/// <remarks>
/// <para>
/// Todo asiento y todo desbloqueo posterior a esta marca es "nuevo" y hay que
/// festejarlo. Vive en el servidor y no en el telefono para que el festejo ocurra
/// una sola vez aunque cambie de aparato o reinstale la app.
/// </para>
/// <para>
/// Tambien es lo que evita que la siembra retroactiva le tire encima veinte
/// celebraciones de golpe: al sembrar, la marca se pone en ese momento.
/// </para>
/// </remarks>
public sealed class DriverProgressMark
{
    public Guid DriverId { get; set; }

    public DateTimeOffset CelebratedUpTo { get; set; }
}
