using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.Locations;
using Android.OS;
using Android.Runtime;
using AndroidX.Core.App;

// MAUI trae su propio Location entre los using implicitos, asi que el de Android
// se nombra explicito para que no quede ambiguo.
using AndroidLocation = Android.Locations.Location;

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
public sealed class NavigationForegroundService : Service, ILocationListener
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

    /// <summary>Posiciones que lee el servicio, para quien las quiera.</summary>
    public static event EventHandler<AndroidLocation>? PositionChanged;

    /// <summary>Si el servicio esta corriendo.</summary>
    public static bool IsRunning { get; private set; }

    private LocationManager? _locationManager;
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

        if (_locationManager is null)
        {
            return;
        }

        // Se escucha el GPS y tambien la red. El GPS es el que sirve, pero tarda
        // en enganchar bajo techo o entre edificios; mientras tanto la red da una
        // posicion aproximada que evita que la pantalla arranque en blanco.
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
