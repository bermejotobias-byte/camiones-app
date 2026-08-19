namespace TruckNavigator.Domain.Trucks;

public enum VehicleType
{
    /// <summary>Camion simple (chasis rigido, sin acoplado).</summary>
    RigidTruck = 0,

    /// <summary>Camion con acoplado.</summary>
    TruckWithTrailer = 1,

    /// <summary>Tractor con semirremolque.</summary>
    SemiTrailer = 2
}

/// <summary>
/// Caracteristicas fisicas y de configuracion del vehiculo. Es la entrada del
/// motor de restricciones y de la construccion del custom model de ruteo.
/// </summary>
public sealed class TruckProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    /// <summary>Peso total bruto en kilogramos.</summary>
    public int GrossWeightKg { get; set; }

    public double HeightMeters { get; set; }

    public double WidthMeters { get; set; }

    /// <summary>Longitud del vehiculo tractor / chasis, sin acoplado.</summary>
    public double LengthMeters { get; set; }

    public int NumberOfAxles { get; set; }

    public VehicleType VehicleType { get; set; }

    public bool HasTrailer { get; set; }

    public double? TrailerLengthMeters { get; set; }

    /// <summary>
    /// Indica que el perfil es un dato de prueba y no una configuracion real
    /// declarada por el usuario. Ver docs/data-sources.md.
    /// </summary>
    public bool IsSampleData { get; set; }

    public double GrossWeightTons => GrossWeightKg / 1000.0;

    /// <summary>
    /// Longitud total del conjunto circulante. Es la que se compara contra los
    /// limites de la via, no la del tractor solo.
    /// </summary>
    public double TotalLengthMeters =>
        LengthMeters + (HasTrailer ? TrailerLengthMeters ?? 0 : 0);
}
