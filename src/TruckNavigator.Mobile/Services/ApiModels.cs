using System.Text.Json.Serialization;

namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Espejo de los contratos que expone TruckNavigator.Api. Se mantienen aparte
/// del dominio a proposito: la app consume una API por HTTP, no comparte
/// entidades con el servidor.
/// </summary>
public sealed record TruckProfileDto(
    Guid Id,
    string Name,
    int GrossWeightKg,
    double HeightMeters,
    double WidthMeters,
    double LengthMeters,
    int NumberOfAxles,
    string VehicleType,
    bool HasTrailer,
    double? TrailerLengthMeters,
    double TotalLengthMeters,
    bool IsSampleData)
{
    public string DimensionsSummary =>
        $"{GrossWeightKg:N0} kg · {HeightMeters:0.00} m alto · " +
        $"{WidthMeters:0.00} m ancho · {TotalLengthMeters:0.00} m largo";
}

public sealed class SaveTruckProfileRequest
{
    public string Name { get; set; } = string.Empty;
    public int GrossWeightKg { get; set; }
    public double HeightMeters { get; set; }
    public double WidthMeters { get; set; }
    public double LengthMeters { get; set; }
    public int NumberOfAxles { get; set; } = 2;
    public string VehicleType { get; set; } = "RigidTruck";
    public bool HasTrailer { get; set; }
    public double? TrailerLengthMeters { get; set; }
}

public sealed record CoordinateDto(double Latitude, double Longitude);

public sealed record PlaceDto(
    string Label,
    string? Secondary,
    double Latitude,
    double Longitude);

public sealed class RouteRequest
{
    public Guid TruckId { get; set; }
    public CoordinateDto? Origin { get; set; }
    public CoordinateDto? Destination { get; set; }
}

/// <summary>Categorias de puntos de interes. Los nombres coinciden con los de la API.</summary>
public enum PoiCategory
{
    TruckParking,
    FuelStation,
    RepairShop,
    TyreShop,
    HeavyRoadsideAssistance
}

public sealed record PoiDto(
    Guid Id,
    string Name,
    string Category,
    string? Address,
    string? Neighbourhood,
    double Latitude,
    double Longitude,
    string? Phone,
    string? Website,
    string? OpeningHours,
    string? Description,
    IReadOnlyList<string> Services,
    bool? SuitableForLightTruck,
    bool? SuitableForHeavyTruck,
    bool? SuitableForSemiTrailer,
    bool? SuitableForTrailer,
    string Source,
    DateOnly SourceRetrievedOn,
    string VerificationLevel,
    bool IsSampleData,
    bool? SuitableForSelectedTruck)
{
    public PoiCategory ParsedCategory =>
        Enum.TryParse<PoiCategory>(Category, out var value) ? value : PoiCategory.TruckParking;

    public string Emoji => PoiPresentation.Emoji(ParsedCategory);

    public string CategoryLabel => PoiPresentation.Label(ParsedCategory);

    /// <summary>Barrio si lo hay, si no la dirección: lo que ubique al lugar.</summary>
    public string? Location => string.IsNullOrWhiteSpace(Neighbourhood) ? Address : Neighbourhood;

    public string VerificationText => VerificationLevel switch
    {
        "Confirmed" => "Confirmado con fuente oficial o el operador",
        "Probable" => "Declarado por la fuente, sin verificación independiente",
        _ => "La fuente ubica el lugar pero no declara aptitud para camiones"
    };

    public string SuitabilityText => SuitableForSelectedTruck switch
    {
        true => "Apto para el camión seleccionado",
        false => "No apto para el camión seleccionado",
        _ => "Aptitud no verificada para este camión"
    };
}

/// <summary>
/// Cómo se ve cada categoría. Vive acá y no en la página para que el mapa, la ficha
/// y el panel de filtros usen los mismos íconos y nombres.
/// </summary>
public static class PoiPresentation
{
    public static IReadOnlyList<PoiCategory> All { get; } = Enum.GetValues<PoiCategory>();

    public static string Emoji(PoiCategory category) => category switch
    {
        PoiCategory.TruckParking => "🅿️",
        PoiCategory.FuelStation => "⛽",
        PoiCategory.RepairShop => "🔧",
        PoiCategory.TyreShop => "🛞",
        _ => "🚨"
    };

    public static string Label(PoiCategory category) => category switch
    {
        PoiCategory.TruckParking => "Playas y estacionamientos",
        PoiCategory.FuelStation => "Estaciones de servicio",
        PoiCategory.RepairShop => "Talleres",
        PoiCategory.TyreShop => "Gomerías",
        _ => "Auxilio mecánico pesado"
    };
}

public sealed record RestrictionFindingDto(
    string Kind,
    string Description,
    double? LimitValue,
    string? Unit,
    string RuleSource,
    string RuleReference,
    string DataSource,
    string DataReference);

public sealed record RouteRestrictionNoteDto(
    int FromPointIndex,
    int ToPointIndex,
    string StreetName,
    double DistanceMeters,
    bool RequiresAccessException,
    IReadOnlyList<RestrictionFindingDto> Findings);

public sealed record RouteInstructionDto(
    string Text,
    double DistanceMeters,
    double DurationSeconds,
    string? StreetName);

public sealed record GeoJsonLineString(
    [property: JsonPropertyName("coordinates")] IReadOnlyList<double[]> Coordinates);

public sealed record RouteResponse(
    double DistanceMeters,
    double DurationSeconds,
    GeoJsonLineString Geometry,
    IReadOnlyList<RouteInstructionDto> Instructions,
    IReadOnlyList<RouteRestrictionNoteDto> RestrictionNotes,
    IReadOnlyList<RouteRestrictionNoteDto> AccessLegs,
    double HeavyNetworkSharePercent,
    string TruckName,
    string Attribution);
