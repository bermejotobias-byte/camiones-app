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

            var saved = Preferences.Default.Get(BaseUrlPreferenceKey, DefaultBaseUrl);

            // Ultima linea de defensa. Una version anterior guardaba lo que
            // fuera, sin validar: si en el telefono quedo una direccion invalida
            // de entonces, se la ignora en vez de arrastrar el problema para
            // siempre. Sin esto, la app queda inutilizable y la unica salida es
            // adivinar que hay que reescribir la direccion. Ver AD-33.
            return TryNormalize(saved, out var url, out _) ? url : DefaultBaseUrl;
        }
    }

    /// <summary>
    /// Guarda una direccion escrita a mano, si es usable.
    /// </summary>
    /// <param name="input">Lo que escribio el usuario.</param>
    /// <param name="problem">Que tiene de malo, para mostrarselo.</param>
    /// <returns><c>false</c> si no se guardo nada.</returns>
    /// <remarks>
    /// <b>Validar aca no es opcional.</b> Antes el setter guardaba cualquier
    /// texto. Escribir la IP sin <c>http://</c> —que es lo que cualquiera
    /// escribe— producia una direccion que ni siquiera es una URI absoluta, y a
    /// partir de ahi <see cref="HttpClient"/> tiraba antes de salir a la red.
    /// Como el valor quedaba guardado y le gana al del build, la app quedaba
    /// muerta incluso reinstalandola.
    /// </remarks>
    public static bool TrySetBaseUrl(string? input, out string problem)
    {
        if (!TryNormalize(input, out var url, out problem))
        {
            return false;
        }

        // Escribir la URL del propio build equivale a volver al valor de fábrica.
        if (string.Equals(url, DefaultBaseUrl, StringComparison.OrdinalIgnoreCase))
        {
            ResetToDefault();
            return true;
        }

        Preferences.Default.Set(BaseUrlPreferenceKey, url);
        Preferences.Default.Set(PinnedPreferenceKey, true);

        return true;
    }

    /// <summary>Vuelve a la direccion con la que se compilo la app.</summary>
    public static void ResetToDefault()
    {
        Preferences.Default.Remove(PinnedPreferenceKey);
        Preferences.Default.Remove(BaseUrlPreferenceKey);
    }

    /// <inheritdoc cref="BackendAddress.TryNormalize"/>
    private static bool TryNormalize(string? input, out string url, out string problem) =>
        BackendAddress.TryNormalize(input, out url, out problem);

    /// <summary>
    /// Si hay una URL fijada a mano que le gana a la del build.
    /// </summary>
    /// <remarks>
    /// Es para poder <b>decirlo</b> en el log. Una URL vieja fijada desde
    /// "Configurar servidor" sobrevive a reinstalar la app, y desde afuera el
    /// sintoma —"no se pudo conectar"— es identico al de un problema de red. Sin
    /// esta distincion se persigue el fantasma equivocado.
    /// </remarks>
    public static bool IsPinned => Preferences.Default.Get(PinnedPreferenceKey, false);

    /// <summary>Resultado del chequeo de conexion, con el motivo si fallo.</summary>
    /// <param name="Reachable">Si el backend contesto lo que se esperaba.</param>
    /// <param name="Problem">
    /// Que paso, en una linea y en criollo. Se le muestra al usuario: un
    /// "no se pudo conectar" a secas no le dice a nadie donde mirar.
    /// </param>
    /// <param name="Retriable">
    /// Si tiene sentido volver a intentar lo mismo dentro de un rato.
    ///
    /// No todas las fallas son iguales: una direccion mal escrita va a fallar
    /// igual las tres veces, y reintentarla es hacer esperar al usuario veinte
    /// segundos para darle el error que ya se sabia. En cambio un timeout o una
    /// conexion rechazada suelen ser la red del telefono que todavia no termino
    /// de levantar, y ahi el reintento es exactamente lo que hace falta.
    /// </param>
    public sealed record HealthCheck(bool Reachable, string? Problem, bool Retriable = false);

    /// <summary>
    /// Pregunta si un backend responde.
    /// </summary>
    /// <param name="candidate">
    /// Que direccion probar. Si va <c>null</c>, la que este configurada. Se pasa
    /// explicita para poder probar la de fabrica sin pisar todavia la que el
    /// usuario guardo: si la de fabrica tampoco anda, la suya no se toca.
    /// </param>
    /// <param name="attempt">
    /// Numero de intento, desde 1. Define cuanto se espera la respuesta: ver
    /// <see cref="ConnectionRetry.TimeoutFor"/>.
    /// </param>
    public async Task<HealthCheck> CheckAsync(string? candidate = null, CancellationToken ct = default, int attempt = 1)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(ConnectionRetry.TimeoutFor(attempt));

        // La direccion se valida ANTES de armar el pedido. Con una invalida,
        // HttpClient tira una excepcion cuyo mensaje en Release es una clave de
        // recurso ilegible, y el usuario recibe eso como explicacion.
        if (!TryNormalize(candidate ?? BaseUrl, out var baseUrl, out var invalid))
        {
            return new HealthCheck(false, invalid);
        }

        var url = $"{baseUrl}/api/health";

        try
        {
            using var response = await httpClient.GetAsync(url, timeout.Token);

            if (response.IsSuccessStatusCode)
            {
                return new HealthCheck(true, null);
            }

            // Contesto algo, pero no lo nuestro. Suele ser un router o un portal
            // cautivo respondiendo en esa direccion.
            //
            // 502, 503 y 504 son la excepcion y SI se reintentan: los devuelve un
            // intermediario que todavia no llego al backend —un tunel Cloudflare
            // recien levantado es el caso tipico— y no significan que la
            // direccion este mal.
            var transitorio = (int)response.StatusCode is 502 or 503 or 504;

            return new HealthCheck(false,
                $"El servidor respondio {(int)response.StatusCode}. " +
                "Fijate que la dirección apunte al backend y no a otra cosa.",
                Retriable: transitorio);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return new HealthCheck(false,
                "El servidor no contestó a tiempo. Puede estar apagado, o el " +
                "teléfono en otra red.",
                Retriable: true);
        }
        catch (HttpRequestException)
        {
            // El mensaje de la excepcion NO se muestra. En un build recortado
            // .NET reemplaza los textos del framework por sus claves de recurso,
            // asi que lo que le llegaba al usuario era algo como
            // "net_http_client_invalid_requesturi" — ruido puro. Ver AD-33.
            //
            // Se reintenta: es la falla que da la red del telefono cuando todavia
            // no termino de levantar, que es exactamente el caso que motivo los
            // reintentos.
            return new HealthCheck(false,
                "No se pudo conectar. Fijate que el backend esté corriendo y que " +
                "el teléfono esté en la misma red que la computadora.",
                Retriable: true);
        }
        catch (Exception ex)
        {
            // Del tipo de excepcion sí se puede dar el nombre: los nombres de
            // tipo sobreviven al recorte, los mensajes no.
            //
            // Se reintenta por las dudas: no sabemos que paso, y equivocarse
            // reintentando cuesta segundos, mientras que equivocarse rindiendose
            // manda al usuario a tocar una direccion que podia estar bien.
            return new HealthCheck(false,
                $"Falló el intento de conexión ({ex.GetType().Name}). " +
                "Revisá la dirección.",
                Retriable: true);
        }
    }

    /// <summary>
    /// Insiste con el backend hasta que conteste o se agoten los intentos.
    /// </summary>
    /// <param name="progress">
    /// Recibe el numero de intento antes de cada uno, para que la pantalla pueda
    /// decir que esta pasando. Sin eso la espera se ve igual que una app colgada.
    /// </param>
    /// <remarks>
    /// La politica —cuantos intentos, cuanto se espera entre ellos y cuanto dura
    /// cada uno— vive en <see cref="ConnectionRetry"/>, que no depende de MAUI y
    /// por eso se puede testear.
    ///
    /// Corta apenas una falla no es reintentable: una direccion mal escrita va a
    /// fallar igual las tres veces.
    /// </remarks>
    public async Task<HealthCheck> ConnectAsync(
        string? candidate = null,
        IProgress<int>? progress = null,
        CancellationToken ct = default)
    {
        HealthCheck resultado = new(false, "No se intentó conectar.");

        for (var attempt = 1; attempt <= ConnectionRetry.MaxAttempts; attempt++)
        {
            var espera = ConnectionRetry.DelayBefore(attempt);
            if (espera > TimeSpan.Zero)
            {
                await Task.Delay(espera, ct);
            }

            progress?.Report(attempt);

            resultado = await CheckAsync(candidate, ct, attempt);

            if (!ConnectionRetry.ShouldRetry(attempt, resultado.Reachable, resultado.Retriable))
            {
                return resultado;
            }
        }

        return resultado;
    }

    public async Task<bool> IsReachableAsync(CancellationToken ct = default) =>
        (await CheckAsync(null, ct)).Reachable;
}
