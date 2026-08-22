namespace TruckNavigator.Domain.Trips;

/// <summary>
/// Un viaje: de donde a donde, con que camion, cuanto duro y cuantos kilometros
/// acredito.
/// </summary>
/// <remarks>
/// <para>
/// Es la unidad del historial y la fuente de los kilometros acumulados. Sin esta
/// entidad no hay estadisticas, ni niveles, ni nada que se desbloquee manejando.
/// </para>
/// <para>
/// La distancia y la duracion previstas las escribe el servidor con el resultado
/// del motor de ruteo al arrancar el viaje. El cliente no las informa nunca: si
/// pudiera, los kilometros serian un numero que cualquiera se regala.
/// </para>
/// <para>
/// El nombre del camion se guarda copiado, ademas de la referencia. El camion se
/// puede borrar —el usuario cambia de vehiculo o de empresa— y el historial tiene
/// que seguir diciendo con que lo hizo.
/// </para>
/// </remarks>
public sealed class Trip
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Cuenta que hizo el viaje.</summary>
    public Guid DriverId { get; set; }

    /// <summary>
    /// Camion usado. Queda en <c>null</c> si despues se borro el vehiculo; el
    /// viaje sobrevive porque es historial de la persona, no del camion.
    /// </summary>
    public Guid? TruckId { get; set; }

    /// <summary>Nombre del camion al momento del viaje. Ver el comentario de la clase.</summary>
    public string TruckName { get; set; } = string.Empty;

    public double OriginLatitude { get; set; }

    public double OriginLongitude { get; set; }

    public string? OriginLabel { get; set; }

    public double DestinationLatitude { get; set; }

    public double DestinationLongitude { get; set; }

    public string? DestinationLabel { get; set; }

    /// <summary>Distancia de la ruta calculada por el servidor, en metros.</summary>
    public double PlannedDistanceMeters { get; set; }

    public double PlannedDurationSeconds { get; set; }

    /// <summary>
    /// Porcentaje del recorrido sobre la Red de Transito Pesado. Se guarda porque
    /// es la medida propia del producto y sirve para el historial.
    /// </summary>
    public double HeavyNetworkSharePercent { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? FinishedAt { get; set; }

    public TripStatus Status { get; set; } = TripStatus.InProgress;

    /// <summary>
    /// Kilometros que efectivamente suman. Esta separado de
    /// <see cref="PlannedDistanceMeters"/> a proposito: un viaje cancelado, o
    /// cerrado demasiado rapido, tiene distancia prevista pero no acredita nada.
    /// </summary>
    public double CreditedDistanceMeters { get; set; }

    public TimeSpan? Elapsed => FinishedAt is null ? null : FinishedAt.Value - StartedAt;

    public bool IsOpen => Status == TripStatus.InProgress;

    /// <summary>Cierra el viaje como llegado y acredita lo que corresponda.</summary>
    /// <exception cref="InvalidOperationException">Si el viaje ya estaba cerrado.</exception>
    public void Finish(DateTimeOffset when)
    {
        EnsureOpen();

        // Un reloj atrasado no puede producir un viaje de duracion negativa.
        var finishedAt = when < StartedAt ? StartedAt : when;

        FinishedAt = finishedAt;
        Status = TripStatus.Completed;
        CreditedDistanceMeters = TripCrediting.CreditFor(
            PlannedDistanceMeters,
            PlannedDurationSeconds,
            finishedAt - StartedAt);
    }

    /// <summary>Cierra el viaje como abandonado. No acredita kilometros.</summary>
    /// <exception cref="InvalidOperationException">Si el viaje ya estaba cerrado.</exception>
    public void Cancel(DateTimeOffset when)
    {
        EnsureOpen();

        FinishedAt = when < StartedAt ? StartedAt : when;
        Status = TripStatus.Cancelled;
        CreditedDistanceMeters = 0;
    }

    private void EnsureOpen()
    {
        if (!IsOpen)
        {
            throw new InvalidOperationException(
                $"El viaje {Id} ya estaba cerrado como {Status}.");
        }
    }
}
