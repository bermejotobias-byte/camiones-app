using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.Gms.Common;
using Android.Gms.Location;
using Android.Locations;
using Android.OS;
using Android.Runtime;
using AndroidX.Core.App;

// MAUI trae su propio Location entre los using implicitos, asi que el de Android
// se nombra explicito para que no quede ambiguo.
using AndroidLocation = Android.Locations.Location;

// Y lo mismo con el oyente: Play Services trae uno con el mismo nombre.
using SystemLocationListener = Android.Locations.ILocationListener;

// Y con el pedido de posiciones: hay uno del sistema y otro de Play Services.
using FusedLocationRequest = Android.Gms.Location.LocationRequest;

namespace TruckNavigator.Mobile.Platforms.Android;

/// <summary>
/// Mantiene vivo el GPS mientras hay un viaje en curso.
/// </summary>
/// <remarks>
/// <para>
/// Sin esto, apenas el conductor cambia de app o apaga la pantalla, Android deja
/// de entregar posiciones y la navegacion se congela: la flecha queda clavada en
/// la ultima cuadra conocida y no vuelve a avisar ningun giro. Es la diferencia
/// entre un mapa y un navegador.
/// </para>
/// <para>
/// <b>Vive solo mientras dura el viaje.</b> Arranca cuando el usuario toca
/// "Arrancar viaje" y se apaga al llegar o al abandonar. Un servicio de ubicacion
/// permanente seria un abuso de la bateria y del permiso.
/// </para>
/// <para>
/// El servicio es ademas <b>la unica fuente de posiciones durante la
/// navegacion</b>. Tener dos —este y el de la app en primer plano— significaria
/// dos trenes de fixes con ritmos distintos alimentando el mismo motor.
/// </para>
/// </remarks>
[Service(
    Exported = false,
    ForegroundServiceType = ForegroundService.TypeLocation)]
public sealed class NavigationForegroundService : Service, SystemLocationListener
{
    public const string ActionStart = "ar.com.trucknavigator.NAVEGAR";
    public const string ActionStop = "ar.com.trucknavigator.PARAR";
    public const string ExtraDestination = "destino";

    private const string ChannelId = "navegacion";
    private const int NotificationId = 4501;

    /// <summary>
    /// Cada cuanto se pide una posicion nueva.
    /// </summary>
    /// <remarks>
    /// Un segundo. Mas espaciado y la flecha se mueve a los saltos justo cuando
    /// mas importa —en el giro—; mas seguido no aporta, porque el GPS no produce
    /// fixes mas rapido y solo gasta bateria.
    /// </remarks>
    private const long MinimumIntervalMs = 1_000;

    /// <summary>
    /// Metros minimos entre posiciones.
    /// </summary>
    /// <remarks>
    /// Cero a proposito. Filtrar por distancia parece un ahorro y no lo es: con
    /// el camion detenido en un semaforo dejarian de llegar fixes, y el motor no
    /// podria distinguir "parado" de "el GPS se perdio".
    /// </remarks>
    private const float MinimumDistanceMeters = 0f;

    /// <summary>
    /// Hasta cuando sirve la ultima posicion guardada del sistema.
    /// </summary>
    /// <remarks>
    /// Diez minutos. Alcanza para el caso real —se abre la app y se arranca el
    /// viaje desde donde uno ya estaba— y es corto para que el camion no pueda
    /// haberse ido lejos. Mas viejo que eso se descarta: es preferible una
    /// pantalla que dice "buscando" a una flecha puesta en otro barrio.
    /// </remarks>
    private const long MaximumLastKnownAgeNanos = 10L * 60L * 1_000_000_000L;

    /// <summary>Posiciones que lee el servicio, para quien las quiera.</summary>
    public static event EventHandler<AndroidLocation>? PositionChanged;

    /// <summary>Si el servicio esta corriendo.</summary>
    public static bool IsRunning { get; private set; }

    private LocationManager? _locationManager;
    private IFusedLocationProviderClient? _fusedClient;
    private FusedLocationCallback? _fusedCallback;
    private string? _destination;

    public override IBinder? OnBind(Intent? intent) => null;

    public override StartCommandResult OnStartCommand(Intent? intent, StartCommandFlags flags, int startId)
    {
        if (intent?.Action == ActionStop)
        {
            StopEverything();
            return StartCommandResult.NotSticky;
        }

        _destination = intent?.GetStringExtra(ExtraDestination);

        CreateChannel();
        StartInForeground();
        StartListening();

        IsRunning = true;

        // NotSticky: si el sistema mata el proceso, no queremos que Android
        // reviva el servicio solo. Un viaje que se reanuda sin que nadie lo
        // pidiera dejaria el GPS prendido sin que el conductor lo sepa.
        return StartCommandResult.NotSticky;
    }

    public override void OnDestroy()
    {
        StopEverything();
        base.OnDestroy();
    }

    /* --------------------------------------------------------------------
       Notificacion

       Android la exige: no existe un servicio en primer plano sin ella. Se deja
       en la minima expresion —esta navegando, y a donde— y en un canal de baja
       importancia para que no suene ni vibre.

       Mostrar ahi la proxima maniobra y la distancia es el paso siguiente: se
       actualiza esta notificacion, no se agrega otra.
    -------------------------------------------------------------------- */

    private void CreateChannel()
    {
        if (!OperatingSystem.IsAndroidVersionAtLeast(26))
        {
            return;
        }

        var channel = new NotificationChannel(
            ChannelId,
            "Navegación",
            NotificationImportance.Low)
        {
            Description = "Se muestra mientras hay un viaje en curso."
        };

        channel.SetShowBadge(false);

        var manager = (NotificationManager?)GetSystemService(NotificationService);
        manager?.CreateNotificationChannel(channel);
    }

    private void StartInForeground()
    {
        var notification = BuildNotification();

        // Desde Android 14 hay que declarar el tipo tambien al arrancar, no solo
        // en el manifiesto; si no, el sistema tira SecurityException.
        if (OperatingSystem.IsAndroidVersionAtLeast(34))
        {
            StartForeground(NotificationId, notification, ForegroundService.TypeLocation);
        }
        else
        {
            StartForeground(NotificationId, notification);
        }
    }

    private Notification BuildNotification()
    {
        // Tocar la notificacion devuelve a la app en vez de abrir otra copia.
        var intent = PackageManager?.GetLaunchIntentForPackage(PackageName!);
        intent?.SetFlags(ActivityFlags.SingleTop | ActivityFlags.ClearTop);

        var pending = PendingIntent.GetActivity(
            this,
            0,
            intent,
            PendingIntentFlags.UpdateCurrent | PendingIntentFlags.Immutable);

        return new NotificationCompat.Builder(this, ChannelId)
            .SetContentTitle("Viaje en curso")
            .SetContentText(string.IsNullOrWhiteSpace(_destination)
                ? "Navegando"
                : $"Hacia {_destination}")
            .SetSmallIcon(global::Android.Resource.Drawable.IcMenuDirections)
            .SetContentIntent(pending)
            .SetOngoing(true)
            .SetPriority(NotificationCompat.PriorityLow)
            .SetCategory(NotificationCompat.CategoryNavigation)
            .Build();
    }

    /* --------------------------------------------------------------------
       Ubicacion
    -------------------------------------------------------------------- */

    private void StartListening()
    {
        _locationManager = (LocationManager?)GetSystemService(LocationService);

        // La ultima posicion conocida sale primero y sin esperar a nadie: el
        // mapa se ubica al instante en vez de quedarse mirando la nada hasta que
        // el GPS enganche. Es aproximada y se corrige sola con el primer fix.
        PublishLastKnownLocation();

        // Y despues se engancha el tren de posiciones frescas, por el proveedor
        // combinado si el telefono lo tiene.
        if (StartFusedUpdates())
        {
            return;
        }

        StartSystemUpdates();
    }

    /// <summary>
    /// Proveedor combinado de Google: satelites, WiFi, antenas y sensores.
    /// </summary>
    /// <remarks>
    /// Es el que usan los navegadores conocidos y la razon es medible: el GPS
    /// crudo tarda decenas de segundos en dar el primer fix bajo techo, y el
    /// respaldo por antenas del sistema puede estar deshabilitado sin que la app
    /// se entere. El combinado entrega en uno o dos segundos.
    /// </remarks>
    /// <returns>Si se pudo enganchar. Falso deja paso al proveedor del sistema.</returns>
    private bool StartFusedUpdates()
    {
        try
        {
            if (GoogleApiAvailability.Instance.IsGooglePlayServicesAvailable(this) != ConnectionResult.Success)
            {
                return false;
            }

            _fusedClient = LocationServices.GetFusedLocationProviderClient(this);

            var request = new FusedLocationRequest.Builder(Priority.PriorityHighAccuracy, MinimumIntervalMs)
                .SetMinUpdateIntervalMillis(MinimumIntervalMs)
                .SetMinUpdateDistanceMeters(MinimumDistanceMeters)
                .Build();

            _fusedCallback = new FusedLocationCallback(this);

            // Looper.MainLooper y no el hilo del servicio: sin un Looper vivo el
            // cliente no tiene donde entregar y no llama nunca al callback.
            _fusedClient.RequestLocationUpdates(request, _fusedCallback, Looper.MainLooper);

            return true;
        }
        catch (Exception ex)
        {
            // Play Services falta, esta desactualizado, o el fabricante lo
            // recorto. No es motivo para quedarse sin navegacion: hay respaldo.
            System.Diagnostics.Debug.WriteLine($"Proveedor combinado no disponible: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Respaldo con el proveedor del sistema, para telefonos sin Play Services.
    /// </summary>
    private void StartSystemUpdates()
    {
        if (_locationManager is null)
        {
            return;
        }

        // Se piden los dos proveedores. El GPS es el que sirve para navegar; la
        // red, cuando existe, tapa el hueco del arranque. Puede estar
        // deshabilitada —se midio asi en el equipo de prueba—, y por eso el
        // arranque no puede depender de ella.
        foreach (var provider in new[] { LocationManager.GpsProvider, LocationManager.NetworkProvider })
        {
            try
            {
                if (_locationManager.IsProviderEnabled(provider))
                {
                    _locationManager.RequestLocationUpdates(
                        provider, MinimumIntervalMs, MinimumDistanceMeters, this);
                }
            }
            catch (Java.Lang.SecurityException)
            {
                // El permiso se pide antes de llegar aca; si aun asi falta, el
                // servicio queda vivo pero mudo, y la app lo nota porque no
                // llegan posiciones.
            }
        }
    }

    /// <summary>
    /// Empuja la ultima posicion que el sistema tenga guardada, si no es vieja.
    /// </summary>
    /// <remarks>
    /// El limite de antiguedad usa el reloj monotono del dispositivo
    /// (<c>ElapsedRealtimeNanos</c>) y no la hora: la hora del telefono puede
    /// saltar por el operador o por el usuario, y un salto haria pasar por fresca
    /// una posicion de ayer.
    /// </remarks>
    private void PublishLastKnownLocation()
    {
        if (_locationManager is null)
        {
            return;
        }

        AndroidLocation? best = null;

        foreach (var provider in new[]
        {
            LocationManager.GpsProvider,
            LocationManager.NetworkProvider,
            LocationManager.PassiveProvider
        })
        {
            try
            {
                var candidate = _locationManager.GetLastKnownLocation(provider);

                if (candidate is not null &&
                    (best is null || candidate.ElapsedRealtimeNanos > best.ElapsedRealtimeNanos))
                {
                    best = candidate;
                }
            }
            catch (Java.Lang.SecurityException)
            {
                // Sin permiso no hay ultima posicion. El pedido de permiso ya
                // ocurrio antes de arrancar el servicio.
            }
            catch (Java.Lang.IllegalArgumentException)
            {
                // El proveedor no existe en este telefono.
            }
        }

        if (best is null)
        {
            return;
        }

        var ageNanos = SystemClock.ElapsedRealtimeNanos() - best.ElapsedRealtimeNanos;

        if (ageNanos <= MaximumLastKnownAgeNanos)
        {
            PositionChanged?.Invoke(this, best);
        }
    }

    /// <summary>Recibe las posiciones del proveedor combinado.</summary>
    private sealed class FusedLocationCallback(NavigationForegroundService service) : LocationCallback
    {
        public override void OnLocationResult(LocationResult result)
        {
            if (result.LastLocation is { } location)
            {
                PositionChanged?.Invoke(service, location);
            }
        }
    }

    private void StopEverything()
    {
        try
        {
            _locationManager?.RemoveUpdates(this);
        }
        catch (Java.Lang.SecurityException)
        {
            // Nada que hacer: igual se esta apagando.
        }

        // El cliente combinado se da de baja aparte: es otro registro de
        // ubicacion y quedaria vivo consumiendo bateria con el viaje terminado.
        try
        {
            if (_fusedCallback is not null)
            {
                _fusedClient?.RemoveLocationUpdates(_fusedCallback);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"No se pudo dar de baja el proveedor combinado: {ex.Message}");
        }

        _fusedCallback?.Dispose();
        _fusedCallback = null;
        _fusedClient = null;

        _locationManager = null;
        IsRunning = false;

        if (OperatingSystem.IsAndroidVersionAtLeast(24))
        {
            StopForeground(StopForegroundFlags.Remove);
        }
        else
        {
#pragma warning disable CA1422
            StopForeground(true);
#pragma warning restore CA1422
        }

        StopSelf();
    }

    public void OnLocationChanged(AndroidLocation location) =>
        PositionChanged?.Invoke(this, location);

    public void OnProviderDisabled(string provider) { }

    public void OnProviderEnabled(string provider) { }

    public void OnStatusChanged(string? provider, [GeneratedEnum] Availability status, Bundle? extras) { }
}
