using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;

namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Cliente HTTP de la API. La URL base es configurable en tiempo de ejecucion
/// porque la IP de la maquina de desarrollo cambia de red en red y no queremos
/// recompilar la app por eso.
/// </summary>
public sealed class TruckNavigatorApi(HttpClient httpClient)
{
    private const string BaseUrlPreferenceKey = "api_base_url";
    private const string PinnedPreferenceKey = "api_base_url_pinned";

    /// <summary>
    /// Backend con el que sale el build. Se cambia acá al mover el servidor.
    /// </summary>
    public const string DefaultBaseUrl = "https://earthquake-vegetarian-careers-statutory.trycloudflare.com";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// URL del backend.
    /// </summary>
    /// <remarks>
    /// El valor del build gana salvo que el usuario haya puesto uno a mano desde
    /// "Configurar servidor". Sin esa distinción, instalar una versión nueva dejaba
    /// la app apuntando a la URL vieja guardada en <see cref="Preferences"/> —y como
    /// el servidor de la demo se muda, eso significa una app que no conecta y un
    /// motivo nada evidente.
    /// </remarks>
    public static string BaseUrl
    {
        get
        {
            if (!Preferences.Default.Get(PinnedPreferenceKey, false))
            {
                return DefaultBaseUrl;
            }

            return Preferences.Default.Get(BaseUrlPreferenceKey, DefaultBaseUrl);
        }
        set
        {
            var url = value.Trim().TrimEnd('/');

            // Escribir la URL del propio build equivale a volver al valor de fábrica.
            if (string.Equals(url, DefaultBaseUrl, StringComparison.OrdinalIgnoreCase))
            {
                Preferences.Default.Remove(PinnedPreferenceKey);
                Preferences.Default.Remove(BaseUrlPreferenceKey);
                return;
            }

            Preferences.Default.Set(BaseUrlPreferenceKey, url);
            Preferences.Default.Set(PinnedPreferenceKey, true);
        }
    }

    public async Task<bool> IsReachableAsync(CancellationToken ct = default)
    {
        try
        {
            using var response = await httpClient.GetAsync(Url("api/health"), ct);
            return response.IsSuccessStatusCode;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public async Task<IReadOnlyList<TruckProfileDto>> GetTrucksAsync(CancellationToken ct = default) =>
        await httpClient.GetFromJsonAsync<List<TruckProfileDto>>(Url("api/trucks"), JsonOptions, ct)
        ?? [];

    public async Task<TruckProfileDto> CreateTruckAsync(
        SaveTruckProfileRequest request,
        CancellationToken ct = default)
    {
        using var response = await httpClient.PostAsJsonAsync(Url("api/trucks"), request, JsonOptions, ct);
        await EnsureSuccessAsync(response, ct);

        return (await response.Content.ReadFromJsonAsync<TruckProfileDto>(JsonOptions, ct))!;
    }

    /// <summary>
    /// Autocompletado de direcciones. Devuelve una lista vacía ante cualquier
    /// error: no poder buscar no debe impedir fijar los puntos en el mapa.
    /// </summary>
    public async Task<IReadOnlyList<PlaceDto>> SearchPlacesAsync(
        string query,
        CancellationToken ct = default)
    {
        try
        {
            var url = Url($"api/places?q={Uri.EscapeDataString(query)}");

            return await httpClient.GetFromJsonAsync<List<PlaceDto>>(url, JsonOptions, ct) ?? [];
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return [];
        }
    }

    public async Task<PlaceDto?> ReverseGeocodeAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default)
    {
        try
        {
            var lat = latitude.ToString("0.######", CultureInfo.InvariantCulture);
            var lng = longitude.ToString("0.######", CultureInfo.InvariantCulture);

            using var response = await httpClient.GetAsync(
                Url($"api/places/reverse?lat={lat}&lng={lng}"), ct);

            if (!response.IsSuccessStatusCode ||
                response.StatusCode == System.Net.HttpStatusCode.NoContent)
            {
                return null;
            }

            return await response.Content.ReadFromJsonAsync<PlaceDto>(JsonOptions, ct);
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return null;
        }
    }

    /// <summary>
    /// Puntos de interés para camiones. Se piden todos de una y se filtran localmente;
    /// lo único que cambia la respuesta es el camión, porque el servidor resuelve la
    /// aptitud y así la app no reimplementa esa regla.
    /// </summary>
    /// <remarks>
    /// Devuelve lista vacía ante cualquier error, igual que la búsqueda de lugares: no
    /// poder mostrar los puntos no puede romper el mapa ni el cálculo de rutas.
    /// </remarks>
    public async Task<IReadOnlyList<PoiDto>> GetPoisAsync(
        Guid? truckId = null,
        CancellationToken ct = default)
    {
        try
        {
            var url = Url("api/pois");

            if (truckId is { } id)
            {
                url += $"?truckId={id}";
            }

            return await httpClient.GetFromJsonAsync<List<PoiDto>>(url, JsonOptions, ct) ?? [];
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return [];
        }
    }

    public async Task<RouteResponse> GetRouteAsync(RouteRequest request, CancellationToken ct = default)
    {
        using var response = await httpClient.PostAsJsonAsync(Url("api/routes"), request, JsonOptions, ct);
        await EnsureSuccessAsync(response, ct);

        return (await response.Content.ReadFromJsonAsync<RouteResponse>(JsonOptions, ct))!;
    }

    private static string Url(string relative) => $"{BaseUrl}/{relative}";

    /// <summary>
    /// Convierte el ProblemDetails de la API en un mensaje legible, para que el
    /// usuario vea "no hay ruta para este camion" en vez de un 422 pelado.
    /// </summary>
    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        try
        {
            var problem = JsonSerializer.Deserialize<JsonElement>(body);

            var title = problem.TryGetProperty("title", out var t) ? t.GetString() : null;
            var detail = problem.TryGetProperty("detail", out var d) ? d.GetString() : null;

            if (!string.IsNullOrWhiteSpace(title))
            {
                throw new ApiException(string.IsNullOrWhiteSpace(detail) ? title! : $"{title}: {detail}");
            }
        }
        catch (JsonException)
        {
            // Cuerpo no-JSON: se informa el codigo de estado.
        }

        throw new ApiException($"La API respondio {(int)response.StatusCode}.");
    }
}

public sealed class ApiException(string message) : Exception(message);
