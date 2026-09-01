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
    private readonly IHeadingSensor? _compass;

    private bool _configSent;
    private bool _pageAnnounced;
    private bool _watchingLocation;
    private bool _readingHeading;

    public AppPage(TruckNavigatorApi api, IServiceProvider services)
    {
        InitializeComponent();
        _api = api;

        // Opcionales: en una plataforma sin implementacion la app sigue andando y
        // solo se pierden el seguimiento continuo y la brujula.
        _tracker = services.GetService<ITripTracker>();
        _compass = services.GetService<IHeadingSensor>();
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
        StopReadingHeading();
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

        // Incondicional y lo primero de todo: es la unica linea que prueba que el
        // puente al log funciona, y de paso dice que URL se esta usando de
        // verdad. Una URL fijada a mano en "Configurar servidor" le gana a la que
        // viene compilada, y desde afuera eso es indistinguible de un problema de
        // red.
        Note($"conectando a {TruckNavigatorApi.BaseUrl} " +
             $"(compilada: {TruckNavigatorApi.DefaultBaseUrl}, " +
             $"fijada a mano: {TruckNavigatorApi.IsPinned})");

        // Insiste, no se rinde al primer intento. Al abrir la app la red del
        // telefono suele no estar lista todavia —la WiFi reconecta al salir de
        // suspension— y con un solo intento eso terminaba en la pantalla de
        // "no se pudo contactar": el usuario cerraba, abria de nuevo y andaba.
        //
        // El progreso se informa en pantalla porque una espera silenciosa de
        // veinte segundos no se distingue de una app colgada.
        var progreso = new Progress<int>(intento =>
            ShowStartup(ConnectionRetry.Describe(intento, TruckNavigatorApi.BaseUrl), showSetup: false));

        var check = await _api.ConnectAsync(progress: progreso);

        Note($"resultado: alcanzable={check.Reachable} motivo={check.Problem ?? "ninguno"}");

        // Auto-rescate: una direccion guardada que dejo de servir no puede dejar
        // la app varada para siempre. Se prueba la de fabrica ANTES de darse por
        // vencido, y recien si esa anda se descarta la guardada — si tampoco
        // anda, lo que el usuario configuro no se toca. Ver AD-33.
        if (!check.Reachable &&
            TruckNavigatorApi.IsPinned &&
            !string.Equals(TruckNavigatorApi.BaseUrl, TruckNavigatorApi.DefaultBaseUrl,
                StringComparison.OrdinalIgnoreCase))
        {
            ShowStartup(
                $"La dirección guardada no responde." + Environment.NewLine +
                $"Probando con {TruckNavigatorApi.DefaultBaseUrl}…",
                showSetup: false);

            // Un solo intento, y con la espera larga del segundo. Aca no se
            // reintenta tres veces mas: la direccion guardada ya se llevo sus
            // tres, y encadenar otra tanda pasaria del medio minuto mirando un
            // cartel. Ademas la red ya tuvo todo ese tiempo para levantar, que
            // era el motivo de reintentar.
            var fallback = await _api.CheckAsync(TruckNavigatorApi.DefaultBaseUrl, attempt: 2);

            Note($"rescate con la de fabrica: alcanzable={fallback.Reachable}");

            if (fallback.Reachable)
            {
                TruckNavigatorApi.ResetToDefault();
                ServerEntry.Text = TruckNavigatorApi.BaseUrl;
                check = fallback;
            }
        }

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

        if (!string.IsNullOrWhiteSpace(typed) &&
            !TruckNavigatorApi.TrySetBaseUrl(typed, out var problem))
        {
            // No se guarda nada y se dice por que, sin salir de la pantalla. Antes
            // se guardaba cualquier texto: una direccion sin http:// quedaba
            // pegada y rompia todos los intentos siguientes.
            ShowStartup(problem, showSetup: true);
            return;
        }

        await ConnectAsync();
    }

    /// <summary>
    /// Vuelve a la direccion con la que se compilo la app.
    /// </summary>
    /// <remarks>
    /// Es la salida de emergencia explicita. El auto-rescate de
    /// <see cref="ConnectAsync"/> cubre el caso normal, pero si el backend de
    /// fabrica tampoco responde en ese momento, el usuario necesita poder
    /// descartar lo que escribio sin adivinar cual era el valor original.
    /// </remarks>
    private async void OnUseFactoryUrl(object? sender, EventArgs e)
    {
        TruckNavigatorApi.ResetToDefault();
        ServerEntry.Text = TruckNavigatorApi.BaseUrl;

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

                case "heading":
                    var reading = root.TryGetProperty("on", out var compass) && compass.GetBoolean();

                    MainThread.BeginInvokeOnMainThread(() =>
                    {
                        if (reading)
                        {
                            StartReadingHeading();
                        }
                        else
                        {
                            StopReadingHeading();
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
            Note($"no se pudo evaluar el script: {ex.Message}", error: true);
        }
    }

    /// <summary>
    /// Deja rastro en el log del sistema.
    /// </summary>
    /// <remarks>
    /// <b>No usa <c>Debug.WriteLine</c> a proposito.</b> Ese metodo lleva
    /// <c>[Conditional("DEBUG")]</c>: el compilador borra las llamadas en Release,
    /// asi que los diagnosticos desaparecen justo en el APK que se instala en el
    /// telefono — el unico lugar donde hay GPS, sensores y WebView de verdad—.
    /// Este escribe siempre, y se lee con <c>adb logcat -s Cascara</c>.
    /// </remarks>
    private static void Note(string message, bool error = false)
    {
#if ANDROID
        if (error)
        {
            global::Android.Util.Log.Error("Cascara", message);
        }
        else
        {
            global::Android.Util.Log.Info("Cascara", message);
        }
#endif
    }

    /* --------------------------------------------------------------------
       Ubicacion

       El WebView de Android no entrega navigator.geolocation sin que la cascara
       resuelva el permiso, asi que la posicion la lee el GPS nativo y se empuja
       a la pagina.
    -------------------------------------------------------------------- */

    /// <summary>
    /// Cuanto puede tener la ultima posicion guardada para seguir sirviendo.
    /// </summary>
    /// <remarks>
    /// Diez minutos: alcanza para ubicar el mapa al abrir la app y es corto para
    /// que el camion no pueda haberse ido lejos. La posicion fresca la corrige
    /// en cuanto llega.
    /// </remarks>
    private static readonly TimeSpan LastKnownUsefulFor = TimeSpan.FromMinutes(10);

    /// <summary>
    /// Responde el pedido puntual de ubicacion de la pagina.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Va en tres intentos, del mas barato al mas caro, y <b>el primero que sirva
    /// se muestra sin esperar a los otros</b>:
    /// </para>
    /// <list type="number">
    /// <item>la ultima posicion que el sistema ya tiene guardada — instantanea;</item>
    /// <item>una lectura de maxima precision, con paciencia corta;</item>
    /// <item>una de precision media, que se conforma con antenas y WiFi.</item>
    /// </list>
    /// <para>
    /// Antes habia un solo intento: maxima precision con quince segundos de
    /// espera. Bajo techo el GPS puede no enganchar en ese tiempo, y se midio
    /// haciendo exactamente eso — dos pedidos seguidos que expiraron a los quince
    /// segundos con cero posiciones. El usuario veia "La ubicacion tardo
    /// demasiado" y el mapa se quedaba sin ubicar, con el sistema teniendo
    /// guardada una posicion buena de minutos antes.
    /// </para>
    /// </remarks>
    private async Task SendPositionAsync()
    {
        if (!await EnsureLocationPermissionAsync())
        {
            await RunScriptAsync(
                "window.TN_locationFailed('No diste permiso de ubicación. Revisalo en los ajustes.')");

            return;
        }

        var served = false;

        try
        {
            var known = await Geolocation.Default.GetLastKnownLocationAsync();

            if (known is not null &&
                DateTimeOffset.UtcNow - known.Timestamp <= LastKnownUsefulFor)
            {
                await PushPositionAsync(Track(known));
                served = true;
            }
        }
        catch (Exception ex)
        {
            // Que no haya ultima posicion no es un error: se sigue con la fresca.
            System.Diagnostics.Debug.WriteLine($"Sin ultima posicion conocida: {ex.Message}");
        }

        foreach (var accuracy in new[] { GeolocationAccuracy.Best, GeolocationAccuracy.Medium })
        {
            try
            {
                var location = await Geolocation.Default.GetLocationAsync(
                    new GeolocationRequest(accuracy, TimeSpan.FromSeconds(8)));

                if (location is not null)
                {
                    await PushPositionAsync(Track(location));
                    return;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Lectura {accuracy} fallida: {ex.Message}");
            }
        }

        // Solo se avisa si no se pudo mostrar nada. Si ya se empujo la ultima
        // conocida, el mapa esta ubicado y un cartel de error seria mentira.
        if (!served)
        {
            await RunScriptAsync(
                "window.TN_locationFailed('No se pudo determinar tu ubicación. " +
                "Si estás bajo techo, salí a cielo abierto o marcá el origen tocando el mapa.')");
        }
    }

    private static TrackedPosition Track(Location location) => new(
        location.Latitude,
        location.Longitude,
        location.Accuracy,
        location.Speed,
        location.Course);

    /// <summary>
    /// Empuja una posicion a la pagina.
    /// </summary>
    /// <remarks>
    /// Van tambien la precision, la velocidad y el rumbo: el motor de guiado los
    /// necesita para decidir si el camion se salio de la ruta —el umbral depende
    /// de cuanto error informe el GPS— y cuanto pudo haber avanzado desde la
    /// posicion anterior.
    /// </remarks>
    private Task PushPositionAsync(TrackedPosition position)
    {
        // De paso, la brujula se entera de donde esta el camion. Lo necesita para
        // corregir la declinacion magnetica, que depende del lugar.
        _compass?.UseLocation(position.Latitude, position.Longitude);

        return RunScriptAsync(
            "window.TN_setPosition(" +
            Num(position.Latitude) + "," +
            Num(position.Longitude) + "," +
            Num(position.AccuracyMeters) + "," +
            Num(position.SpeedMetersPerSecond) + "," +
            Num(position.BearingDegrees) + ")");
    }

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

            // Canal propio y no TN_locationFailed: ese resuelve los pedidos
            // puntuales de posicion, y si en ese momento no hay ninguno esperando
            // —que es lo habitual al arrancar un viaje— el aviso se perdia en
            // silencio y la pantalla quedaba muerta sin motivo visible.
            await RunScriptAsync(
                "window.TN_trackingFailed('Sin permiso de ubicación no se puede navegar. " +
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
       Brujula

       El rumbo del GPS dice hacia donde se MUEVE el camion, y no existe cuando
       esta parado. El magnetometro dice hacia donde APUNTA el telefono, siempre.
       Son dos datos distintos y la pantalla usa los dos.
    -------------------------------------------------------------------- */

    /// <summary>
    /// Arranca la lectura del rumbo, a pedido de la pagina.
    /// </summary>
    /// <remarks>
    /// A pedido y no siempre: los sensores consumen bateria y solo la pantalla
    /// del mapa muestra la brujula. Cuando la pagina se va a otra vista avisa que
    /// deje de leer.
    /// </remarks>
    private void StartReadingHeading()
    {
        if (_compass is null || _readingHeading)
        {
            return;
        }

        Note($"brujula: arrancando, soportada={_compass.IsSupported}");

        if (!_compass.IsSupported)
        {
            // Hay telefonos sin magnetometro. Se avisa para que la pantalla
            // esconda la brujula en vez de dejar una flecha clavada al norte,
            // que seria peor que no mostrar nada.
            _ = RunScriptAsync("window.TN_headingUnavailable && window.TN_headingUnavailable()");
            return;
        }

        _compass.HeadingChanged -= OnHeadingChanged;
        _compass.HeadingChanged += OnHeadingChanged;

        _compass.Start();
        _readingHeading = true;

        // Antes del primer viaje no hay ninguna posicion empujada, asi que la
        // declinacion se sembra con la ultima que el sistema tenga guardada. Sin
        // esto la brujula arranca referida al norte magnetico.
        _ = SeedDeclinationAsync();
    }

    private async Task SeedDeclinationAsync()
    {
        try
        {
            var known = await Geolocation.Default.GetLastKnownLocationAsync();

            if (known is not null)
            {
                _compass?.UseLocation(known.Latitude, known.Longitude);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Sin posicion para la declinacion: {ex.Message}");
        }
    }

    private void StopReadingHeading()
    {
        if (!_readingHeading)
        {
            return;
        }

        _compass!.HeadingChanged -= OnHeadingChanged;
        _compass.Stop();
        _readingHeading = false;
    }

    private void OnHeadingChanged(object? sender, HeadingReading reading)
    {
        var script = $"window.TN_setHeading({Num(reading.Degrees)},{(reading.Reliable ? "true" : "false")})";

        Note($"brujula: empujo {script}");

        MainThread.BeginInvokeOnMainThread(async () => await RunScriptAsync(script));
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
