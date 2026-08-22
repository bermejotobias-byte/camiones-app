using System.ComponentModel.DataAnnotations;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;

namespace TruckNavigator.Api.Contracts;

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
    public static TruckProfileDto From(TruckProfile truck) => new(
        truck.Id,
        truck.Name,
        truck.GrossWeightKg,
        truck.HeightMeters,
        truck.WidthMeters,
        truck.LengthMeters,
        truck.NumberOfAxles,
        truck.VehicleType.ToString(),
        truck.HasTrailer,
        truck.TrailerLengthMeters,
        truck.TotalLengthMeters,
        truck.IsSampleData);
}

public sealed class SaveTruckProfileRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Range(500, 100_000)]
    public int GrossWeightKg { get; set; }

    [Range(1.0, 6.0)]
    public double HeightMeters { get; set; }

    [Range(1.0, 4.0)]
    public double WidthMeters { get; set; }

    [Range(1.0, 40.0)]
    public double LengthMeters { get; set; }

    [Range(2, 12)]
    public int NumberOfAxles { get; set; }

    public VehicleType VehicleType { get; set; }

    public bool HasTrailer { get; set; }

    [Range(0.0, 30.0)]
    public double? TrailerLengthMeters { get; set; }

    public void ApplyTo(TruckProfile truck)
    {
        truck.Name = Name.Trim();
        truck.GrossWeightKg = GrossWeightKg;
        truck.HeightMeters = HeightMeters;
        truck.WidthMeters = WidthMeters;
        truck.LengthMeters = LengthMeters;
        truck.NumberOfAxles = NumberOfAxles;
        truck.VehicleType = VehicleType;
        truck.HasTrailer = HasTrailer;
        truck.TrailerLengthMeters = HasTrailer ? TrailerLengthMeters : null;
        truck.IsSampleData = false;
    }
}

public sealed class RouteRequest
{
    [Required]
    public Guid TruckId { get; set; }

    [Required]
    public CoordinateDto? Origin { get; set; }

    [Required]
    public CoordinateDto? Destination { get; set; }

    /// <summary>Momento de partida. Si no se indica, se usa la hora actual.</summary>
    public DateTimeOffset? DepartureTime { get; set; }
}

public sealed record PlaceDto(
    string Label,
    string? Secondary,
    double Latitude,
    double Longitude)
{
    public static PlaceDto From(Domain.Places.Place place) => new(
        place.Label,
        place.Secondary,
        place.Location.Latitude,
        place.Location.Longitude);
}

public sealed class CoordinateDto
{
    [Range(-90.0, 90.0)]
    public double Latitude { get; set; }

    [Range(-180.0, 180.0)]
    public double Longitude { get; set; }
}

/// <summary>
/// Un punto de interes tal como lo consume la app.
/// </summary>
/// <param name="SuitableForSelectedTruck">
/// Resultado de aplicar <see cref="Domain.Pois.PoiSuitability"/> al camion indicado en
/// la consulta: <c>true</c> apto, <c>false</c> no apto, <c>null</c> la fuente no lo
/// dice o no se indico camion. Lo calcula el servidor a proposito, para que el cliente
/// no tenga que reimplementar la regla.
/// </param>
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
    public static PoiDto From(PointOfInterest poi, TruckProfile? truck) => new(
        poi.Id,
        poi.Name,
        poi.Category.ToString(),
        poi.Address,
        poi.Neighbourhood,
        poi.Latitude,
        poi.Longitude,
        poi.Phone,
        poi.Website,
        poi.OpeningHours,
        poi.Description,
        poi.Services,
        poi.SuitableForLightTruck,
        poi.SuitableForHeavyTruck,
        poi.SuitableForSemiTrailer,
        poi.SuitableForTrailer,
        poi.Source,
        poi.SourceRetrievedOn,
        poi.VerificationLevel.ToString(),
        poi.IsSampleData,
        truck is null ? null : PoiSuitability.Accepts(poi, truck));
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

public sealed record RouteResponse(
    double DistanceMeters,
    double DurationSeconds,
    /// <summary>GeoJSON LineString con las coordenadas en orden [lon, lat].</summary>
    GeoJsonLineString Geometry,
    IReadOnlyList<RouteInstructionDto> Instructions,
    IReadOnlyList<RouteRestrictionNoteDto> RestrictionNotes,
    IReadOnlyList<RouteRestrictionNoteDto> AccessLegs,
    double HeavyNetworkSharePercent,
    string TruckName,
    string Attribution);

public sealed record GeoJsonLineString(IReadOnlyList<double[]> Coordinates)
{
    public string Type => "LineString";
}

/// <summary>
/// El perfil del camionero tal como lo consume la app.
/// </summary>
/// <remarks>
/// Junta en una sola respuesta lo que vive en dos tablas: los datos de la persona
/// —que son dominio— y el estado de la cuenta —que es de Identity—. La app
/// necesita ambos para decidir que pantalla mostrar, y pedirlos por separado
/// obligaria a dos viajes para una sola decision.
/// </remarks>
public sealed record DriverProfileDto(
    Guid Id,
    string? Alias,
    string? FirstName,
    string? LastName,
    string? AvatarId,
    string? Email,
    bool EmailConfirmed,
    bool IsComplete,
    DateTimeOffset CreatedAt)
{
    public static DriverProfileDto From(DriverProfile profile, AppUser user) => new(
        profile.Id,
        profile.Alias,
        profile.FirstName,
        profile.LastName,
        profile.AvatarId,
        user.Email,
        user.EmailConfirmed,
        profile.IsComplete,
        profile.CreatedAt);
}

/// <summary>
/// Datos que el usuario puede cargar o cambiar de su perfil.
/// </summary>
/// <remarks>
/// Todos los campos son opcionales porque el alta permite saltear este paso. Un
/// campo ausente se interpreta como "dejalo vacio", no como "no lo toques": es un
/// PUT y reemplaza el perfil entero, que es lo que hace el formulario de la app.
/// </remarks>
public sealed class SaveDriverProfileRequest
{
    /// <summary>
    /// El formato lo valida <see cref="DriverAlias"/>, no un atributo: es una regla
    /// de dominio y tiene que dar el mismo veredicto desde cualquier llamador.
    /// </summary>
    public string? Alias { get; set; }

    [StringLength(80)]
    public string? FirstName { get; set; }

    [StringLength(80)]
    public string? LastName { get; set; }

    [StringLength(64)]
    public string? AvatarId { get; set; }
}

/// <summary>Respuesta de la consulta de disponibilidad de un alias.</summary>
/// <param name="Available">
/// <c>true</c> si el alias esta libre y bien formado. Es una foto del momento: lo
/// unico que garantiza la unicidad es el indice de la base al guardar.
/// </param>
public sealed record AliasAvailabilityDto(string Alias, bool Available, string? Reason);
