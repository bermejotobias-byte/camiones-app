namespace TruckNavigator.Domain.Reports;

/// <summary>Que vio el camionero. Agregar uno es sumar aca y en <see cref="ReportCatalog"/>.</summary>
/// <remarks>
/// Se guarda como entero: los valores no se reordenan ni se reutilizan. El
/// usuario saco del catalogo inicial el vehiculo detenido y el limite de peso
/// (19/09/2026); si vuelven, entran con un numero nuevo.
/// </remarks>
public enum ReportType
{
    Accident = 0,
    Traffic = 1,
    Checkpoint = 2,
    Police = 3,
    Camera = 4,
    Roadworks = 5,
    Pothole = 6,
    Hazard = 7,
    RoadClosed = 8,

    /// <summary>Un galibo bajo, con los metros. El unico con valor.</summary>
    LowClearance = 9
}

/// <summary>
/// Informacion avisa; restriccion ademas puede cambiar la ruta, y solo validada.
/// </summary>
public enum ReportKind
{
    Information = 0,
    Restriction = 1
}
