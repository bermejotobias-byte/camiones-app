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

    private bool _configSent;
    private bool _watchingLocation;

    public AppPage(TruckNavigatorApi api)
    {
        InitializeComponent();
        _api = api;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        ServerEntry.Text = TruckNavigatorApi.BaseUrl;

        if (!_configSent)
        {
            await ConnectAsync();
        }
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
        ShowStartup("Conectando…", showSetup: false);

        var reachable = await _api.IsReachableAsync();

        if (!reachable)
        {
            ShowStartup(
                $"No se pudo contactar al servidor en {TruckNavigatorApi.BaseUrl}.",
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

    private Task SendConfigAsync() =>
        RunScriptAsync($"window.TN_setConfig({{ apiBase: {Json(TruckNavigatorApi.BaseUrl)} }})");

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
                case "locate":
                    MainThread.BeginInvokeOnMainThread(async () => await SendPositionAsync());
                    break;

                case "watchLocation":
                    var on = root.TryGetProperty("on", out var flag) && flag.GetBoolean();
                    MainThread.BeginInvokeOnMainThread(async () =>
                    {
                        if (on)
                        {
                            await StartWatchingLocationAsync();
                        }
                        else
                        {
                            StopWatchingLocation();
                        }
                    });
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

            await PushPositionAsync(location.Latitude, location.Longitude);
        }
        catch (Exception ex)
        {
            await RunScriptAsync($"window.TN_locationFailed({Json(ex.Message)})");
        }
    }

    private Task PushPositionAsync(double latitude, double longitude) =>
        RunScriptAsync($"window.TN_setPosition({Num(latitude)},{Num(longitude)})");

    private async Task StartWatchingLocationAsync()
    {
        if (_watchingLocation || !await EnsureLocationPermissionAsync())
        {
            return;
        }

        Geolocation.Default.LocationChanged += OnLocationChanged;

        try
        {
            await Geolocation.Default.StartListeningForegroundAsync(
                new GeolocationListeningRequest(GeolocationAccuracy.Best, TimeSpan.FromSeconds(3)));

            _watchingLocation = true;
        }
        catch (Exception ex)
        {
            Geolocation.Default.LocationChanged -= OnLocationChanged;
            System.Diagnostics.Debug.WriteLine($"No se pudo seguir la ubicación: {ex.Message}");
        }
    }

    private void StopWatchingLocation()
    {
        if (!_watchingLocation)
        {
            return;
        }

        Geolocation.Default.LocationChanged -= OnLocationChanged;

        try
        {
            Geolocation.Default.StopListeningForeground();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"No se pudo detener el seguimiento: {ex.Message}");
        }

        _watchingLocation = false;
    }

    private void OnLocationChanged(object? sender, GeolocationLocationChangedEventArgs e) =>
        MainThread.BeginInvokeOnMainThread(async () =>
            await PushPositionAsync(e.Location.Latitude, e.Location.Longitude));

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

    /// <summary>Serializa a literal de JavaScript, con las comillas escapadas.</summary>
    private static string Json(string? value) =>
        JsonSerializer.Serialize(value ?? string.Empty);
}
