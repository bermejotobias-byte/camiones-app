namespace TruckNavigator.Domain.Pois;

/// <summary>
/// Tipo de establecimiento. El orden no significa prioridad.
/// </summary>
public enum PoiCategory
{
    /// <summary>Playas y estacionamientos para camiones.</summary>
    TruckParking = 0,

    /// <summary>Estaciones de servicio aptas para camiones.</summary>
    FuelStation = 1,

    /// <summary>Talleres mecanicos.</summary>
    RepairShop = 2,

    /// <summary>Gomerias.</summary>
    TyreShop = 3,

    /// <summary>Auxilio mecanico pesado y remolque.</summary>
    HeavyRoadsideAssistance = 4,

    /// <summary>
    /// Lugares para comer con lugar para dejar el camion: paradores, comedores y
    /// restaurantes con playa. Entra SOLO con evidencia de que el camion entra; sin
    /// ella la categoria no dice nada (spec del 15/09/2026, §6.3).
    /// </summary>
    TruckFriendlyEatery = 5
}

/// <summary>
/// Cuanto respaldo tiene la informacion de un punto.
/// </summary>
/// <remarks>
/// Aplica a los datos del establecimiento, no a su existencia: un punto tomado de
/// OpenStreetMap existe, pero que sea apto para un semirremolque es otra cosa.
/// </remarks>
public enum VerificationLevel
{
    /// <summary>Existe, pero nadie dice si recibe camiones.</summary>
    NotConfirmed = 0,

    /// <summary>
    /// Señales indirectas sin declaracion ni testimonio: el nombre ("Gomeria del
    /// Camionero"), una etiqueta de OSM, fotos de la ficha con camiones.
    /// </summary>
    Probable = 1,

    /// <summary>
    /// Lo dice el operador, una fuente oficial, o reseñas de conductores que
    /// cuentan haber entrado con el camion. Decision del usuario del 15/09/2026:
    /// con reseña, el punto esta aprobado.
    /// </summary>
    Confirmed = 2
}

/// <summary>
/// De que tipo es la evidencia de aptitud. Es lo que permite verificar, con un
/// test y sin leer texto, que el nivel de verificacion se corresponde con lo que
/// respalda al punto.
/// </summary>
public enum SuitabilityEvidenceKind
{
    /// <summary>No hay evidencia: el punto queda NotConfirmed.</summary>
    None = 0,

    /// <summary>El operador lo declara por escrito (sitio de la marca o del comercio).</summary>
    Operator = 1,

    /// <summary>Una fuente oficial lo declara.</summary>
    Official = 2,

    /// <summary>Reseñas de conductores que cuentan haber entrado con el camion.</summary>
    Reviews = 3,

    /// <summary>Señales indirectas: nombre, etiqueta de OSM, fotos. Da Probable, no Confirmed.</summary>
    Signals = 4
}

/// <summary>
/// Un establecimiento util para un camionero: donde cargar combustible, estacionar,
/// arreglar la unidad o a quien llamar si se rompe.
/// </summary>
/// <remarks>
/// Dos reglas gobiernan este tipo, y ninguna es decorativa:
///
/// 1. Los cuatro campos de aptitud son <c>bool?</c>. <c>null</c> significa "la fuente
///    no lo dice", que no es lo mismo que "no apto". Colapsar lo desconocido en
///    <c>false</c> seria inventar una restriccion, igual que inventar una norma.
///
/// 2. <see cref="Source"/> no es nulable. Ningun punto entra al sistema sin decir de
///    donde salio, del mismo modo que ningun hallazgo de restriccion se emite sin
///    RuleReference y DataReference.
/// </remarks>
public sealed class PointOfInterest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public PoiCategory Category { get; set; }

    /// <summary>Direccion tal como la publica la fuente.</summary>
    public string? Address { get; set; }

    /// <summary>Barrio de CABA. Queda vacio para puntos fuera de la Ciudad.</summary>
    public string? Neighbourhood { get; set; }

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string? Phone { get; set; }

    public string? Website { get; set; }

    /// <summary>Horario en el formato de la fuente (por ejemplo "24/7").</summary>
    public string? OpeningHours { get; set; }

    public string? Description { get; set; }

    /// <summary>Servicios declarados: playa cubierta, balanza, grua, etc.</summary>
    public IReadOnlyList<string> Services { get; set; } = [];

    /// <summary><c>null</c> si la fuente no declara aptitud para este tipo de vehiculo.</summary>
    public bool? SuitableForLightTruck { get; set; }

    /// <inheritdoc cref="SuitableForLightTruck"/>
    public bool? SuitableForHeavyTruck { get; set; }

    /// <inheritdoc cref="SuitableForLightTruck"/>
    public bool? SuitableForSemiTrailer { get; set; }

    /// <inheritdoc cref="SuitableForLightTruck"/>
    public bool? SuitableForTrailer { get; set; }

    /// <summary>
    /// De donde salio el dato: identificador de OSM, URL oficial o del operador.
    /// Es obligatorio y se muestra en la ficha del punto.
    /// </summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>Cuando se consulto la fuente. Los sitios web cambian.</summary>
    public DateOnly SourceRetrievedOn { get; set; }

    public VerificationLevel VerificationLevel { get; set; }

    /// <summary>
    /// Por que creemos que es apto y desde cuando. Va en la ficha del punto; es lo
    /// que hace defendible cada marca de aptitud. Resumen propio con fecha, nunca
    /// texto copiado de una reseña.
    /// </summary>
    public string? SuitabilityEvidence { get; set; }

    public SuitabilityEvidenceKind SuitabilityEvidenceKind { get; set; }

    /// <summary>
    /// <c>true</c> para toda fila que venga de los archivos embebidos, sea de muestra
    /// o de un relevamiento. Es lo que el seed usa para saber que filas le pertenecen:
    /// <see cref="IsSampleData"/> distingue el dato inicial del MVP de un relevamiento
    /// curado, y no sirve para eso.
    /// </summary>
    public bool ManagedByDataset { get; set; }

    /// <summary>
    /// Indica que el punto viene del dataset inicial que acompana al MVP y no de
    /// un relevamiento curado para produccion. Mismo criterio que
    /// <see cref="Trucks.TruckProfile.IsSampleData"/>.
    /// </summary>
    public bool IsSampleData { get; set; }
}
