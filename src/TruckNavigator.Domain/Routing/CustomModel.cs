using System.Text.Json.Serialization;

namespace TruckNavigator.Domain.Routing;

/// <summary>
/// Una sentencia del custom model de GraphHopper.
/// Los valores son cadenas porque GraphHopper evalua expresiones, no solo numeros.
/// </summary>
public sealed record CustomModelStatement
{
    [JsonPropertyName("if")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? If { get; init; }

    [JsonPropertyName("else_if")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ElseIf { get; init; }

    [JsonPropertyName("multiply_by")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? MultiplyBy { get; init; }

    [JsonPropertyName("limit_to")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LimitTo { get; init; }

    /// <summary>Bloquea por completo los tramos que cumplan la condicion.</summary>
    public static CustomModelStatement Block(string condition) =>
        new() { If = condition, MultiplyBy = "0" };

    /// <summary>Penaliza sin bloquear: el tramo sigue siendo transitable.</summary>
    public static CustomModelStatement Penalize(string condition, string factor) =>
        new() { If = condition, MultiplyBy = factor };
}

/// <summary>
/// Custom model que se envia a GraphHopper por request. GraphHopper lo fusiona
/// con el modelo base del perfil configurado en el servidor.
/// </summary>
public sealed record CustomModel
{
    [JsonPropertyName("distance_influence")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? DistanceInfluence { get; init; }

    /// <summary>
    /// Las areas a las que las sentencias pueden referirse como <c>in_{id}</c>:
    /// los bloqueos de la comunidad validados. Null cuando no hay ninguno, para
    /// que el JSON sea el de siempre.
    /// </summary>
    [JsonPropertyName("areas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public GeoJsonFeatureCollection? Areas { get; init; }

    [JsonPropertyName("priority")]
    public IReadOnlyList<CustomModelStatement> Priority { get; init; } = [];

    [JsonPropertyName("speed")]
    public IReadOnlyList<CustomModelStatement> Speed { get; init; } = [];
}

/// <summary>Un FeatureCollection de GeoJSON, con lo justo para las areas del custom model.</summary>
public sealed record GeoJsonFeatureCollection
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "FeatureCollection";

    [JsonPropertyName("features")]
    public IReadOnlyList<GeoJsonFeature> Features { get; init; } = [];
}

public sealed record GeoJsonFeature
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "Feature";

    /// <summary>El id es lo que la sentencia nombra: <c>in_{id}</c>.</summary>
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("properties")]
    public Dictionary<string, object> Properties { get; init; } = [];

    [JsonPropertyName("geometry")]
    public GeoJsonPolygon Geometry { get; init; } = new();
}

public sealed record GeoJsonPolygon
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "Polygon";

    /// <summary>Anillos de [lon, lat]; el primero es el contorno y va cerrado.</summary>
    [JsonPropertyName("coordinates")]
    public IReadOnlyList<IReadOnlyList<double[]>> Coordinates { get; init; } = [];
}
