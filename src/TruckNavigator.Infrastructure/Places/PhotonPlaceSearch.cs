using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Routing;

namespace TruckNavigator.Infrastructure.Places;

/// <summary>
/// Busqueda de direcciones contra Photon, un geocoder construido sobre datos de
/// OpenStreetMap y pensado especificamente para autocompletado a medida que se
/// escribe.
/// </summary>
/// <remarks>
/// Se eligio Photon en lugar de Nominatim porque la politica de uso de este
/// ultimo desaconseja explicitamente el autocompletado. Ver AD-09 en
/// docs/decisions.md.
/// </remarks>
public sealed class PhotonPlaceSearch(
    HttpClient httpClient,
    IOptions<GeocodingOptions> options,
    ILogger<PhotonPlaceSearch> logger) : IPlaceSearch
{
    private readonly GeocodingOptions _options = options.Value;

    public async Task<IReadOnlyList<Place>> SearchAsync(
        string query,
        int limit,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 3)
        {
            return [];
        }

        var effectiveLimit = Math.Clamp(limit, 1, _options.MaxResults);

        // Se piden mas resultados de los que se devuelven porque el recorte por
        // area descarta parte de lo que trae Photon.
        var url = "api/?q=" + Uri.EscapeDataString(query.Trim())
                  + "&lat=" + Format(_options.BiasLatitude)
                  + "&lon=" + Format(_options.BiasLongitude)
                  + "&location_bias_scale=" + Format(_options.BiasScale)
                  + "&limit=" + (effectiveLimit * 3).ToString(CultureInfo.InvariantCulture);

        var response = await GetAsync(url, cancellationToken);

        if (response is null)
        {
            return [];
        }

        return ReadFeatures(response.Value)
            .Where(place => IsInsideServiceArea(place.Location))
            .Take(effectiveLimit)
            .ToList();
    }

    public async Task<Place?> ReverseAsync(
        GeoPoint point,
        CancellationToken cancellationToken = default)
    {
        var url = "reverse?lon=" + Format(point.Longitude)
                  + "&lat=" + Format(point.Latitude);

        var response = await GetAsync(url, cancellationToken);

        return response is null ? null : ReadFeatures(response.Value).FirstOrDefault();
    }

    private async Task<JsonElement?> GetAsync(string url, CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            using var response = await httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("El geocoder respondio {Status} para {Url}",
                    response.StatusCode, url);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // Un geocoder caido no debe romper la pantalla: el usuario todavia
            // puede fijar origen y destino marcandolos sobre el mapa.
            logger.LogWarning(ex, "No se pudo consultar el geocoder");
            return null;
        }
    }

    private static IEnumerable<Place> ReadFeatures(JsonElement root)
    {
        if (!root.TryGetProperty("features", out var features) ||
            features.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }

        foreach (var feature in features.EnumerateArray())
        {
            if (!feature.TryGetProperty("geometry", out var geometry) ||
                !geometry.TryGetProperty("coordinates", out var coordinates) ||
                coordinates.GetArrayLength() < 2)
            {
                continue;
            }

            var properties = feature.TryGetProperty("properties", out var p)
                ? p
                : default;

            var label = BuildLabel(properties);

            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            yield return new Place(
                label,
                BuildSecondary(properties),
                new GeoPoint(coordinates[1].GetDouble(), coordinates[0].GetDouble()));
        }
    }

    private static string BuildLabel(JsonElement properties)
    {
        var name = ReadString(properties, "name");
        var street = ReadString(properties, "street");
        var houseNumber = ReadString(properties, "housenumber");

        // Una direccion con altura es lo que el usuario espera ver primero.
        if (!string.IsNullOrWhiteSpace(street))
        {
            var address = string.IsNullOrWhiteSpace(houseNumber)
                ? street
                : $"{street} {houseNumber}";

            return string.IsNullOrWhiteSpace(name) ? address! : $"{name}, {address}";
        }

        return name ?? string.Empty;
    }

    private static string? BuildSecondary(JsonElement properties)
    {
        var parts = new List<string>(4);

        foreach (var key in new[] { "district", "city", "state" })
        {
            var value = ReadString(properties, key);

            if (!string.IsNullOrWhiteSpace(value) && !parts.Contains(value!))
            {
                parts.Add(value!);
            }
        }

        var postcode = ReadString(properties, "postcode");

        if (!string.IsNullOrWhiteSpace(postcode))
        {
            parts.Add(postcode!);
        }

        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }

    private static string? ReadString(JsonElement properties, string name) =>
        properties.ValueKind == JsonValueKind.Object
        && properties.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private bool IsInsideServiceArea(GeoPoint point) =>
        point.Longitude >= _options.MinLongitude
        && point.Longitude <= _options.MaxLongitude
        && point.Latitude >= _options.MinLatitude
        && point.Latitude <= _options.MaxLatitude;

    private static string Format(double value) =>
        value.ToString("0.######", CultureInfo.InvariantCulture);
}
