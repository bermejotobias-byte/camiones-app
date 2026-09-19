namespace TruckNavigator.Domain.Reports;

/// <summary>Lo que dice quien pasa por el lugar.</summary>
public enum ReportVerdict
{
    StillThere = 0,
    Gone = 1
}

/// <summary>
/// El voto de un camionero sobre un reporte: sigue ahi o ya no esta.
/// </summary>
/// <remarks>
/// Un voto por camionero y reporte —la clave compuesta lo garantiza—: cambiar de
/// opinion reescribe la fila. Igual que el voto de un lugar, no lleva EXP encima:
/// lo que pago queda en el libro con el reporte como clave, y cambiarlo no
/// vuelve a pagar. La distancia queda para auditar: votar exige estar cerca.
/// </remarks>
public sealed class ReportVote
{
    public Guid ReportId { get; set; }

    public Guid DriverId { get; set; }

    public ReportVerdict Verdict { get; set; }

    /// <summary>La primera vez que voto este reporte.</summary>
    public DateTimeOffset CastAt { get; set; }

    /// <summary>La ultima vez que cambio el voto.</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>A que distancia del reporte estaba al votar, en metros.</summary>
    public double DistanceMeters { get; set; }
}
