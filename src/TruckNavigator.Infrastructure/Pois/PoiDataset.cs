using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using TruckNavigator.Domain.Pois;

namespace TruckNavigator.Infrastructure.Pois;

/// <summary>
/// Lee los puntos de interes de los archivos JSON embebidos.
/// </summary>
/// <remarks>
/// Los datos viven en archivos versionados y no en codigo, para que reemplazarlos por
/// una API o una tabla cargada de otra forma no obligue a recompilar nada mas que el
/// origen. La carga toma <b>todos</b> los recursos <c>Data.pois-*.json</c>: sumar un
/// dataset nuevo (por ejemplo uno verificado para produccion, con
/// <c>isSampleData: false</c>) es agregar un archivo, no tocar esta clase.
/// </remarks>
public static class PoiDataset
{
    private const string ResourcePrefix = "TruckNavigator.Infrastructure.Data.pois-";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
        ReadCommentHandling = JsonCommentHandling.Skip
    };

    /// <summary>
    /// Todos los puntos de los archivos embebidos, ordenados por nombre.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Si un archivo no parsea o si un punto no declara fuente. Fallar al arrancar es
    /// preferible a servir un punto sin trazabilidad.
    /// </exception>
    public static IReadOnlyList<PointOfInterest> Load()
    {
        var assembly = typeof(PoiDataset).Assembly;

        var points = assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith(ResourcePrefix, StringComparison.Ordinal))
            .OrderBy(name => name, StringComparer.Ordinal)
            .SelectMany(name => ReadFile(assembly, name))
            .ToList();

        return points.OrderBy(p => p.Name, StringComparer.CurrentCulture).ToList();
    }

    private static IEnumerable<PointOfInterest> ReadFile(Assembly assembly, string resourceName)
    {
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"No se pudo abrir el recurso {resourceName}.");

        PoiFile? file;

        try
        {
            file = JsonSerializer.Deserialize<PoiFile>(stream, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"El dataset {resourceName} no es JSON valido.", ex);
        }

        if (file is null)
        {
            throw new InvalidOperationException($"El dataset {resourceName} esta vacio.");
        }

        return file.Pois.Select(entry => ToPoint(entry, resourceName)).ToList();
    }

    private static PointOfInterest ToPoint(PoiEntry entry, string resourceName)
    {
        if (string.IsNullOrWhiteSpace(entry.Source))
        {
            throw new InvalidOperationException(
                $"El punto '{entry.Name}' de {resourceName} no declara fuente. " +
                "Todo punto tiene que poder rastrearse a un origen citable.");
        }

        return new PointOfInterest
        {
            Id = DeterministicId(entry.Source),
            Name = entry.Name,
            Category = entry.Category,
            Address = entry.Address,
            Neighbourhood = entry.Neighbourhood,
            Latitude = entry.Latitude,
            Longitude = entry.Longitude,
            Phone = entry.Phone,
            Website = entry.Website,
            OpeningHours = entry.OpeningHours,
            Description = entry.Description,
            Services = entry.Services ?? [],
            SuitableForLightTruck = entry.SuitableForLightTruck,
            SuitableForHeavyTruck = entry.SuitableForHeavyTruck,
            SuitableForSemiTrailer = entry.SuitableForSemiTrailer,
            SuitableForTrailer = entry.SuitableForTrailer,
            Source = entry.Source,
            SourceRetrievedOn = entry.SourceRetrievedOn,
            VerificationLevel = entry.VerificationLevel,
            IsSampleData = entry.IsSampleData
        };
    }

    /// <summary>
    /// Id derivado de la fuente, para que el mismo punto conserve su id entre
    /// arranques sin tener que escribir GUIDs a mano en el JSON.
    /// </summary>
    /// <remarks>
    /// MD5 se usa como funcion de dispersion para construir el GUID, no como
    /// primitiva de seguridad.
    /// </remarks>
    private static Guid DeterministicId(string source) =>
        new(MD5.HashData(Encoding.UTF8.GetBytes(source)));

    private sealed record PoiFile(
        string? GeneratedOn,
        string? GeneratedBy,
        string? SourceNote,
        IReadOnlyList<PoiEntry> Pois);

    private sealed record PoiEntry(
        string Name,
        PoiCategory Category,
        string? Address,
        string? Neighbourhood,
        double Latitude,
        double Longitude,
        string? Phone,
        string? Website,
        string? OpeningHours,
        string? Description,
        IReadOnlyList<string>? Services,
        bool? SuitableForLightTruck,
        bool? SuitableForHeavyTruck,
        bool? SuitableForSemiTrailer,
        bool? SuitableForTrailer,
        string Source,
        DateOnly SourceRetrievedOn,
        VerificationLevel VerificationLevel,
        bool IsSampleData);
}
