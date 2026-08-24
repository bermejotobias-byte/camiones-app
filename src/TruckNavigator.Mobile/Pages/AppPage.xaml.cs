using System.Globalization;
using System.Text.Json;
using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile.Pages;

/// <summary>
/// Cascara nativa de la aplicacion web.
/// </summary>
/// <remarks>
/// <para>
/// La interfaz entera es la misma web que sirve la API, empaquetada como assets.
/// Esta pagina no dibuja nada propio salvo el panel de conexion: se limita a
/// resolver las tres cosas que el WebView no puede hacer solo —decirle a la web
/// cual es la URL del backend, leer el GPS y abrir el discador—.
/// </para>
/// <para>
/// El puente es el canal oficial de <c>HybridWebView</c>: JS avisa con
/// <c>SendRawMessage</c> y C# contesta evaluando JavaScript. Ya estaba probado en
/// este proyecto y no hay motivo para inventar otro (ver AD-09).
/// </para>
/// </remarks>
public partial class AppPage : ContentPage
{
    private readonly TruckNavigatorApi _api;
    private readonly ITripTracker? _tracker;

    private bool _configSent;
    private bool _pageAnnounced;
    private bool _watchingLocation;

    public AppPage(TruckNavigatorApi api, IServiceProvider services)
    {
        InitializeComponent();
        _api = api;

        // Opcional: en una plataforma sin implementacion la app sigue andando y
        // solo se pierde el seguimiento continuo.
        _tracker = services.GetService<ITripTracker>();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        ServerEntry.Text = TruckNavigatorApi.BaseUrl;

        // No se conecta desde aca: la pagina avisa cuando esta lista con el
        // mensaje "ready", y esa es la unica senal confiable. Empujarle la
        // configuracion antes se pierde, porque el WebView todavia esta cargando.
        WatchForSilentPage();
    }

    /// <summary>
    /// Si la pagina nunca avisa que esta lista, igual se le da una salida al usuario.
    /// </summary>
    /// <remarks>
    /// Depender solo del aviso de la pagina significa que, si la web no llega a
    /// cargar, la pantalla queda en "Conectando…" para siempre y sin nada que
    /// tocar. Este vigia convierte ese cuelgue en un mensaje y un formulario.
    /// </remarks>
    private async void WatchForSilentPage()
    {
        await Task.Delay(TimeSpan.FromSeconds(15));

        if (_pageAnnounced || _configSent)
        {
            return;
        }

        ShowStartup(
            "La aplicación no terminó de cargar." + Environment.NewLine + Environment.NewLine +
            "Cerrala y volvé a abrirla. Si vuelve a pasar, revisá la dirección del servidor.",
            showSetup: true);
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        StopWatchingLocation();
    }

    /* --------------------------------------------------------------------
       Conexion
    -------------------------------------------------------------------- */

    /// <summary>
    /// Comprueba que el backend conteste y recien ahi le pasa la URL a la web.
    /// </summary>
    /// <remarks>
    /// Se verifica antes de entregar la configuracion para poder mostrar un
    /// mensaje util. Si se le pasara una URL muerta, la web arrancaria y fallaria
    /// pedido por pedido, que es mucho mas dificil de entender desde adentro.
    /// </remarks>
    private async Task ConnectAsync()
    {
        // Se muestra a donde se esta intentando conectar. Sin eso, "Conectando…"
        // no le dice al usuario ni que direccion probar cuando falla.
        ShowStartup($"Conectando con {TruckNavigatorApi.BaseUrl}…", showSetup: false);

        var check = await _api.CheckAsync();

        if (!check.Reachable)
        {
            ShowStartup(
                $"No se pudo contactar al servidor en {TruckNavigatorApi.BaseUrl}.\n\n" +
                check.Problem,
                showSetup: true);

            return;
        }

        await SendConfigAsync();

        _configSent = true;
        StartupPanel.IsVisible = false;
        StartupSpinner.IsRunning = false;
    }

    private void ShowStartup(string message, bool showSetup)
    {
        StartupPanel.IsVisible = true;
        StartupLabel.Text = message;
        StartupSpinner.IsRunning = !showSetup;
        ServerSetup.IsVisible = showSetup;
    }

    private async void OnRetry(object? sender, EventArgs e)
    {
        var typed = ServerEntry.Text?.Trim();

        if (!string.IsNullOrWhiteSpace(typed))
        {
            TruckNavigatorApi.BaseUrl = typed;
        }

        await ConnectAsync();
    }

    /// <summary>
    /// Le pasa a la pagina la direccion del backend.
    /// </summary>
    /// <remarks>
    /// Va como texto suelto y no como objeto JavaScript: evaluar llaves y
    /// comillas desde el lado nativo es mas fragil, y esta es la unica llamada
    /// de la que depende todo lo demas.
    /// </remarks>
    private Task SendConfigAsync() =>
        RunScriptAsync($"window.TN_setConfig({Json(TruckNavigatorApi.BaseUrl)})");

    /* --------------------------------------------------------------------
       Puente
    -------------------------------------------------------------------- */

    private void OnMessageReceived(object? sender, HybridWebViewRawMessageReceivedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(e.Message))
        {
            return;
        }

        try
        {
            using var document = JsonDocument.Parse(e.Message);
            var root = document.RootElement;

            if (!root.TryGetProperty("action", out var action))
            {
                return;
            }

            switch (action.GetString())
            {
                // La pagina avisa que termino de cargar y recien ahi se le manda
                // la direccion del backend. Ver ConnectAsync.
                case "ready":
                    _pageAnnounced = true;
                    MainThread.BeginInvokeOnMainThread(async () => await ConnectAsync());
                    break;

                case "locate":
                    MainThread.BeginInvokeOnMainThread(async () => await SendPositionAsync());
                    break;

                case "watchLocation":
                    var on = root.TryGetProperty("on", out var flag) && flag.GetBoolean();
                    var destination = root.TryGetProperty("destination", out var target)
                        ? target.GetString()
                        : null;

                    MainThread.BeginInvokeOnMainThread(async () =>
                    {
                        if (on)
                        {
                            await StartWatchingLocationAsync(destination);
                        }
                        else
                        {
                            StopWatchingLocation();
                        }
                    });
                    break;

                case "speak":
                    var phrase = root.TryGetProperty("text", out var said) ? said.GetString() : null;
                    MainThread.BeginInvokeOnMainThread(async () => await SpeakAsync(phrase));
                    break;

                case "keepAwake":
                    var awake = root.TryGetProperty("on", out var keep) && keep.GetBoolean();
                    MainThread.BeginInvokeOnMainThread(() => DeviceDisplay.Current.KeepScreenOn = awake);
                    break;

                case "call":
                    var number = root.TryGetProperty("number", out var value)
                        ? value.GetString()
                        : null;

                    MainThread.BeginInvokeOnMainThread(() => Dial(number));
                    break;
            }
        }
        catch (JsonException)
        {
            // Un mensaje mal formado no puede tumbar la app.
        }
    }

    /// <summary>
    /// Evalua JavaScript en la pagina.
    /// </summary>
    /// <remarks>
    /// El marshalling al hilo de UI se hace aca adentro y no en cada llamador.
    /// <b>El WebView de Android aborta el proceso si se lo toca fuera del hilo de
    /// UI</b>, y <c>RawMessageReceived</c> no siempre llega en ese hilo. La
    /// excepcion que tira MAUI en ese caso viaja por un camino interno que ni
    /// siquiera entra al <c>catch</c>: aparece como crash nativo y no como error
    /// manejado (ver AD-15).
    /// </remarks>
    private async Task RunScriptAsync(string script)
    {
        try
        {
            await MainThread.InvokeOnMainThreadAsync(() => WebView.EvaluateJavaScriptAsync(script));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"No se pudo evaluar el script: {ex.Message}");
        }
    }

    /* --------------------------------------------------------------------
       Ubicacion

       El WebView de Android no entrega navigator.geolocation sin que la cascara
       resuelva el permiso, asi que la posicion la lee el GPS nativo y se empuja
       a la pagina.
    -------------------------------------------------------------------- */

    private async Task SendPositionAsync()
    {
        if (!await EnsureLocationPermissionAsync())
        {
            await RunScriptAsync(
                "window.TN_locationFailed('No diste permiso de ubicación. Revisalo en los ajustes.')");

            return;
        }

        try
        {
            var location = await Geolocation.Default.GetLocationAsync(
                new GeolocationRequest(GeolocationAccuracy.Best, TimeSpan.FromSeconds(15)));

            if (location is null)
            {
                await RunScriptAsync("window.TN_locationFailed('No se pudo determinar tu ubicación.')");
                return;
            }

            await PushPositionAsync(new TrackedPosition(
                location.Latitude,
                location.Longitude,
                location.Accuracy,
                location.Speed,
                location.Course));
        }
        catch (Exception ex)
        {
            await RunScriptAsync($"window.TN_locationFailed({Json(ex.Message)})");
        }
    }

    /// <summary>
    /// Empuja una posicion a la pagina.
    /// </summary>
    /// <remarks>
    /// Van tambien la precision, la velocidad y el rumbo: el motor de guiado los
    /// necesita para decidir si el camion se salio de la ruta —el umbral depende
    /// de cuanto error informe el GPS— y cuanto pudo haber avanzado desde la
    /// posicion anterior.
    /// </remarks>
    private Task PushPositionAsync(TrackedPosition position) =>
        RunScriptAsync(
            "window.TN_setPosition(" +
            Num(position.Latitude) + "," +
            Num(position.Longitude) + "," +
            Num(position.AccuracyMeters) + "," +
            Num(position.SpeedMetersPerSecond) + "," +
            Num(position.BearingDegrees) + ")");

    /// <summary>
    /// Arranca el seguimiento del viaje.
    /// </summary>
    /// <remarks>
    /// <para>
    /// No se usa <c>Geolocation.StartListeningForegroundAsync</c>: ese escucha
    /// solo mientras la app esta a la vista. Apenas el conductor cambia de app o
    /// apaga la pantalla deja de entregar posiciones, y la navegacion se congela
    /// con la flecha clavada en la ultima cuadra conocida.
    /// </para>
    /// <para>
    /// El <see cref="ITripTracker"/> levanta un servicio en primer plano, que es
    /// la unica forma que da Android de seguir leyendo el GPS con la app tapada.
    /// </para>
    /// </remarks>
    private async Task StartWatchingLocationAsync(string? destination)
    {
        if (_tracker is null || _watchingLocation)
        {
            return;
        }

        _tracker.PositionChanged -= OnTrackedPosition;
        _tracker.PositionChanged += OnTrackedPosition;

        if (!await _tracker.StartAsync(destination))
        {
            _tracker.PositionChanged -= OnTrackedPosition;

            // Sin permiso no hay navegacion. Callarse dejaria una pantalla que no
            // se actualiza sin ningun motivo visible.
            await RunScriptAsync(
                "window.TN_locationFailed('Sin permiso de ubicación no se puede navegar. " +
                "Habilitalo en los ajustes del teléfono.')");

            return;
        }

        _watchingLocation = true;
    }

    private void StopWatchingLocation()
    {
        if (!_watchingLocation)
        {
            return;
        }

        _tracker!.PositionChanged -= OnTrackedPosition;
        _tracker.Stop();
        _watchingLocation = false;
    }

    private void OnTrackedPosition(object? sender, TrackedPosition position) =>
        MainThread.BeginInvokeOnMainThread(async () => await PushPositionAsync(position));

    private static async Task<bool> EnsureLocationPermissionAsync()
    {
        var status = await Permissions.CheckStatusAsync<Permissions.LocationWhenInUse>();

        if (status != PermissionStatus.Granted)
        {
            status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
        }

        return status == PermissionStatus.Granted;
    }

    /* --------------------------------------------------------------------
       Telefono
    -------------------------------------------------------------------- */

    private static void Dial(string? number)
    {
        if (string.IsNullOrWhiteSpace(number))
        {
            return;
        }

        try
        {
            PhoneDialer.Default.Open(number);
        }
        catch (Exception ex)
        {
            // Si no hay discador —una tablet sin telefonia— no tiene sentido
            // tumbar la app en medio de una emergencia.
            System.Diagnostics.Debug.WriteLine($"No se pudo abrir el discador: {ex.Message}");
        }
    }

    /* --------------------------------------------------------------------
       Ayudas
    -------------------------------------------------------------------- */

    /// <summary>
    /// Formatea con punto decimal. Imprescindible: el telefono puede estar en
    /// es-AR y una coma partiria la llamada de JavaScript en dos argumentos.
    /// </summary>
    private static string Num(double value) =>
        value.ToString("0.######", CultureInfo.InvariantCulture);

    /// <summary>Un dato ausente viaja como <c>null</c>, no como cero.</summary>
    private static string Num(double? value) =>
        value.HasValue ? Num(value.Value) : "null";

    private static async Task SpeakAsync(string? phrase)
    {
        if (string.IsNullOrWhiteSpace(phrase))
        {
            return;
        }

        try
        {
            // Se corta lo anterior: una indicacion vieja sonando encima de la
            // nueva es peor que el silencio.
            await TextToSpeech.Default.SpeakAsync(phrase);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"No se pudo hablar: {ex.Message}");
        }
    }

    /// <summary>Serializa a literal de JavaScript, con las comillas escapadas.</summary>
    private static string Json(string? value) =>
        JsonSerializer.Serialize(value ?? string.Empty);
}
