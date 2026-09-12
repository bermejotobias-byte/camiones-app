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

    /// <summary>Marca del camion (Scania, Mercedes-Benz, Iveco…). Dato del carnet.</summary>
    /// <remarks>
    /// Los tres campos que siguen son <b>identidad</b>, no medidas: no entran en
    /// el ruteo ni en las restricciones. Existen porque el dorso del carnet muestra
    /// con que camion anda la persona. Van en <c>null</c> en las plantillas del
    /// catalogo, que son genericas.
    /// </remarks>
    public string? Brand { get; set; }

    /// <summary>Modelo (R 450, Actros 2651…).</summary>
    public string? Model { get; set; }

    /// <summary>
    /// Patente, en forma canonica: mayusculas, sin espacios ni guiones.
    /// </summary>
    /// <remarks>
    /// La forma la valida y normaliza <see cref="LicensePlate"/>. Se guarda
    /// canonica para comparar y se muestra como esta estampada en la chapa.
    /// </remarks>
    public string? Plate { get; set; }

    /// <summary>
    /// Dueno del perfil.
    /// </summary>
    /// <remarks>
    /// <c>null</c> significa que es una <b>plantilla del catalogo</b>: no pertenece a
    /// nadie, se muestra a todos y sirve de punto de partida para que el usuario
    /// cargue su propio camion. Son las tres que siembra la API con sus medidas, que
    /// es lo que permite mostrar "cuanto de altura y peso" tiene cada tipo antes de
    /// elegir.
    /// </remarks>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Indica que el perfil es un dato de prueba y no una configuracion real
    /// declarada por el usuario. Ver docs/data-sources.md.
    /// </summary>
    public bool IsSampleData { get; set; }

    /// <summary>Si es una plantilla del catalogo y no el camion de alguien.</summary>
    public bool IsTemplate => OwnerId is null;

    public double GrossWeightTons => GrossWeightKg / 1000.0;

    /// <summary>
    /// Longitud total del conjunto circulante. Es la que se compara contra los
    /// limites de la via, no la del tractor solo.
    /// </summary>
    public double TotalLengthMeters =>
        LengthMeters + (HasTrailer ? TrailerLengthMeters ?? 0 : 0);
}
