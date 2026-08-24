namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Lo que la cascara nativa necesita saber del backend: donde esta y si
/// responde. La URL base es configurable en tiempo de ejecucion porque la IP
/// de la maquina de desarrollo cambia de red en red y no queremos recompilar
/// la app por eso. El resto de las llamadas a la API las hace la web dentro del
/// WebView (ver AD-22), asi que aca no hace falta ningun otro metodo.
/// </summary>
public sealed class TruckNavigatorApi(HttpClient httpClient)
{
    private const string BaseUrlPreferenceKey = "api_base_url";
    private const string PinnedPreferenceKey = "api_base_url_pinned";

    /// <summary>
    /// Backend con el que sale el build. Se cambia acá al mover el servidor.
    /// </summary>
    public const string DefaultBaseUrl = "http://192.168.100.106:5080";

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

    /// <summary>
    /// Cuanto se espera al chequeo de conexion.
    /// </summary>
    /// <remarks>
    /// Corto a proposito, y muy por debajo del timeout del <see cref="HttpClient"/>,
    /// que esta pensado para calcular rutas y por eso es largo.
    ///
    /// Heredar aquel timeout hacia que la app se quedara casi dos minutos en
    /// "Conectando…" antes de admitir que no llegaba al servidor. Para el
    /// usuario eso no se distingue de una app colgada, y encima durante toda esa
    /// espera no podia corregir la direccion.
    /// </remarks>
    private static readonly TimeSpan HealthCheckTimeout = TimeSpan.FromSeconds(6);

    /// <summary>Resultado del chequeo de conexion, con el motivo si fallo.</summary>
    /// <param name="Reachable">Si el backend contesto lo que se esperaba.</param>
    /// <param name="Problem">
    /// Que paso, en una linea y en criollo. Se le muestra al usuario: un
    /// "no se pudo conectar" a secas no le dice a nadie donde mirar.
    /// </param>
    public sealed record HealthCheck(bool Reachable, string? Problem);

    public async Task<HealthCheck> CheckAsync(CancellationToken ct = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(HealthCheckTimeout);

        var url = $"{BaseUrl}/api/health";

        try
        {
            using var response = await httpClient.GetAsync(url, timeout.Token);

            if (response.IsSuccessStatusCode)
            {
                return new HealthCheck(true, null);
            }

            // Contesto algo, pero no lo nuestro. Suele ser un router o un portal
            // cautivo respondiendo en esa direccion.
            return new HealthCheck(false,
                $"El servidor respondio {(int)response.StatusCode}. " +
                "Fijate que la dirección apunte al backend y no a otra cosa.");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return new HealthCheck(false,
                "El servidor no contestó a tiempo. Puede estar apagado, o el " +
                "teléfono en otra red.");
        }
        catch (HttpRequestException ex)
        {
            return new HealthCheck(false, $"No se pudo conectar: {ex.Message}");
        }
        catch (Exception ex)
        {
            return new HealthCheck(false, ex.Message);
        }
    }

    public async Task<bool> IsReachableAsync(CancellationToken ct = default) =>
        (await CheckAsync(ct)).Reachable;
}
