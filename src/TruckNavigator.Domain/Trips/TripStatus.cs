namespace TruckNavigator.Domain.Trips;

public enum TripStatus
{
    /// <summary>Arrancado y todavia sin cerrar.</summary>
    InProgress = 0,

    /// <summary>El camionero llego a destino.</summary>
    Completed = 1,

    /// <summary>Se abandono antes de llegar. No acredita kilometros.</summary>
    Cancelled = 2
}
