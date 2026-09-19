using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Reports;

/// <summary>Que le dice un reporte al camion elegido.</summary>
public enum TruckRelevance
{
    /// <summary>Informacion: no se compara con el camion.</summary>
    NotApplicable = 0,

    /// <summary>Una restriccion por la que este camion pasa.</summary>
    Compatible = 1,

    /// <summary>Una restriccion por la que este camion no pasa: pin rojo, aviso de peligro y, validada, la ruta la esquiva.</summary>
    Incompatible = 2
}

/// <summary>
/// La comparacion de una restriccion reportada con el camion, en un solo lugar.
/// </summary>
/// <remarks>
/// El ejemplo que dio el usuario: un galibo de 3,80 reportado es incompatible
/// para un camion de 4,10 y compatible para uno de 3,60. Igual pasa: el limite
/// es el de la via, y un camion de exactamente esa altura entra.
/// </remarks>
public static class ReportRelevance
{
    public static TruckRelevance ForTruck(Report report, TruckProfile? truck)
    {
        ArgumentNullException.ThrowIfNull(report);

        if (truck is null || ReportCatalog.Get(report.Type).Kind != ReportKind.Restriction)
        {
            return TruckRelevance.NotApplicable;
        }

        return report.Type switch
        {
            ReportType.RoadClosed => TruckRelevance.Incompatible,
            ReportType.LowClearance when report.Value is { } metres =>
                truck.HeightMeters > metres ? TruckRelevance.Incompatible : TruckRelevance.Compatible,
            _ => TruckRelevance.NotApplicable
        };
    }
}
