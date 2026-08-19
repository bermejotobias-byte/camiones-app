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

    [JsonPropertyName("priority")]
    public IReadOnlyList<CustomModelStatement> Priority { get; init; } = [];

    [JsonPropertyName("speed")]
    public IReadOnlyList<CustomModelStatement> Speed { get; init; } = [];
}
