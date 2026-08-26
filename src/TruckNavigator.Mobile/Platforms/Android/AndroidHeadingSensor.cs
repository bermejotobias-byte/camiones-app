using Android.Content;
using Android.Hardware;
using Android.OS;
using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile.Platforms.Android;

/// <summary>
/// El rumbo del telefono, leido de los sensores de Android.
/// </summary>
/// <remarks>
/// <para>
/// No se usa <c>Compass</c> de MAUI aunque exista y sea una linea: entrega el
/// azimut del <b>eje largo del telefono</b>, que sirve con el aparato apoyado
/// horizontal y <b>se degenera con el telefono parado en un soporte</b> —que es
/// justo como se usa arriba de un camion—. Con la pantalla vertical ese eje
/// apunta al cielo y el rumbo deja de significar nada. Aca se elige el eje segun
/// la inclinacion, que es la unica forma de que la brujula sirva en las dos
/// posiciones. Ver AD-30.
/// </para>
/// <para>
/// Se lee el <c>RotationVector</c> y no el campo magnetico crudo: el vector de
/// rotacion es una fusion de magnetometro, acelerometro y giroscopo que el
/// propio sistema filtra, mucho mas estable que el magnetometro solo.
/// </para>
/// </remarks>
public sealed class AndroidHeadingSensor : Java.Lang.Object, ISensorEventListener, IHeadingSensor
{
    /// <summary>Etiqueta de logcat. `adb logcat -s Brujula` y nada mas.</summary>
    private const string LogTag = "Brujula";

    /// <summary>Cuanto tiene que girar el telefono para que valga la pena avisar.</summary>
    /// <remarks>
    /// Cada aviso cruza el puente hacia el WebView, que no es gratis. Dos grados
    /// no se ven en una flecha de 30 px, asi que por debajo de eso no se manda
    /// nada: yendo derecho el puente queda casi mudo y solo se despierta en las
    /// curvas.
    /// </remarks>
    private const double MinEmitDeltaDegrees = 2.0;

    /// <summary>Tope de avisos: unos seis por segundo.</summary>
    private const long MinEmitIntervalMs = 150;

    /// <summary>
    /// Cuanto pesa cada lectura nueva en el promedio.
    /// </summary>
    /// <remarks>
    /// El rumbo crudo tiembla aunque el telefono este quieto. Se promedia como
    /// vector —seno y coseno— y no como numero: promediando grados, 359 y 1 dan
    /// 180, o sea la flecha pegaria un salto al sur cada vez que se cruza el norte.
    /// </remarks>
    private const double Smoothing = 0.25;

    /// <summary>
    /// Umbrales de inclinacion, con histeresis.
    /// </summary>
    /// <remarks>
    /// Es la componente vertical del eje perpendicular a la pantalla: 1 es el
    /// telefono acostado boca arriba, 0 es de pie. Con un solo umbral, un
    /// telefono a 45 grados alternaria entre los dos modos varias veces por
    /// segundo y la flecha saltaria 90 grados en cada cambio.
    /// </remarks>
    private const float BecomesUprightBelow = 0.60f;
    private const float BecomesFlatAbove = 0.80f;

    /// <summary>Cuanto se puede mover el camion antes de recalcular la declinacion.</summary>
    /// <remarks>
    /// Medio grado son unos 55 km. La declinacion magnetica cambia con una
    /// lentitud enorme frente a eso; recalcularla en cada posicion seria crear un
    /// objeto de Java por segundo para obtener el mismo numero.
    /// </remarks>
    private const double DeclinationRefreshDegrees = 0.5;

    private readonly SensorManager? _sensors;
    private readonly Sensor? _sensor;

    private readonly float[] _rotation = new float[9];
    private readonly float[] _remapped = new float[9];
    private readonly float[] _orientation = new float[3];
    private readonly float[] _vector3 = new float[3];
    private readonly float[] _vector4 = new float[4];

    private bool _running;
    private bool _flat = true;

    private double _declination;
    private double? _declinationLatitude;
    private double? _declinationLongitude;

    private bool _averaging;
    private double _averageX;
    private double _averageY;

    private bool _emitted;
    private double _lastDegrees;
    private bool _lastReliable = true;
    private long _lastEmitAt;

    /// <summary>
    /// Si el magnetometro esta calibrado.
    /// </summary>
    /// <remarks>
    /// Arranca en <c>true</c> a proposito: hay telefonos que nunca llaman a
    /// <see cref="OnAccuracyChanged"/>, y suponer lo peor dejaria la brujula
    /// marcada como dudosa para siempre en esos equipos. Solo se baja cuando el
    /// sistema lo dice.
    /// </remarks>
    private bool _reliable = true;

    private DisplayRotation _display = DisplayRotation.Rotation0;

    public event EventHandler<HeadingReading>? HeadingChanged;

    public AndroidHeadingSensor()
    {
        _sensors = global::Android.App.Application.Context
            .GetSystemService(Context.SensorService) as SensorManager;

        // El primero fusiona giroscopo y es el mas suave. El segundo hace lo
        // mismo sin giroscopo, para telefonos que no lo traen.
        _sensor = _sensors?.GetDefaultSensor(SensorType.RotationVector)
            ?? _sensors?.GetDefaultSensor(SensorType.GeomagneticRotationVector);
    }

    public bool IsSupported => _sensor is not null;

    public void Start()
    {
        if (_running || _sensors is null || _sensor is null)
        {
            return;
        }

        // La rotacion de la pantalla se lee una vez y se sigue por evento: leerla
        // en cada lectura del sensor seria consultar al sistema de ventanas
        // dieciseis veces por segundo para obtener siempre lo mismo.
        _display = DeviceDisplay.Current.MainDisplayInfo.Rotation;
        DeviceDisplay.Current.MainDisplayInfoChanged += OnDisplayChanged;

        var ok = _sensors.RegisterListener(this, _sensor, SensorDelay.Ui);
        _running = true;

        global::Android.Util.Log.Info(
            LogTag,
            $"arranco sensor={_sensor.Name} registrado={ok} pantalla={_display}");
    }

    public void Stop()
    {
        if (!_running)
        {
            return;
        }

        DeviceDisplay.Current.MainDisplayInfoChanged -= OnDisplayChanged;
        _sensors?.UnregisterListener(this);

        _running = false;
        _averaging = false;
        _emitted = false;
    }

    public void UseLocation(double latitude, double longitude)
    {
        if (_declinationLatitude is double lat && _declinationLongitude is double lng &&
            Math.Abs(lat - latitude) < DeclinationRefreshDegrees &&
            Math.Abs(lng - longitude) < DeclinationRefreshDegrees)
        {
            return;
        }

        try
        {
            // El modelo geomagnetico lo trae Android. Es la forma de no inventar
            // un numero: la declinacion en Buenos Aires no es la de Salta ni la
            // de hace veinte anos.
            using var field = new GeomagneticField(
                (float)latitude,
                (float)longitude,
                0f,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

            _declination = field.Declination;
            _declinationLatitude = latitude;
            _declinationLongitude = longitude;
        }
        catch (Exception ex)
        {
            // Sin correccion el rumbo sigue sirviendo: queda referido al norte
            // magnetico en vez del geografico.
            System.Diagnostics.Debug.WriteLine($"Sin declinacion magnetica: {ex.Message}");
        }
    }

    private void OnDisplayChanged(object? sender, DisplayInfoChangedEventArgs e) =>
        _display = e.DisplayInfo.Rotation;

    /* --------------------------------------------------------------------
       Lectura
    -------------------------------------------------------------------- */

    public void OnSensorChanged(SensorEvent? e)
    {
        if (e?.Values is null || e.Values.Count < 3)
        {
            return;
        }

        // El vector de rotacion puede traer tres, cuatro o cinco componentes
        // segun el equipo. Con tres el sistema deduce la cuarta; la quinta —la
        // precision estimada— no se pasa: hay telefonos donde el metodo falla si
        // se la incluye.
        var source = e.Values.Count >= 4 ? _vector4 : _vector3;

        for (var i = 0; i < source.Length; i++)
        {
            source[i] = e.Values[i];
        }

        SensorManager.GetRotationMatrixFromVector(_rotation, source);

        UpdateTilt();

        var azimuth = _flat ? FlatAzimuth() : UprightAzimuth();

        Emit(Average(Normalize(azimuth + _declination)));
    }

    public void OnAccuracyChanged(Sensor? sensor, SensorStatus accuracy)
    {
        if (sensor?.Handle != _sensor?.Handle)
        {
            return;
        }

        _reliable = accuracy >= SensorStatus.AccuracyMedium;
    }

    /// <summary>Decide si el telefono esta acostado o de pie.</summary>
    private void UpdateTilt()
    {
        // Tercera fila, tercera columna: cuanto del eje perpendicular a la
        // pantalla apunta hacia arriba.
        var upwards = Math.Abs(_rotation[8]);

        if (_flat && upwards < BecomesUprightBelow)
        {
            _flat = false;
        }
        else if (!_flat && upwards > BecomesFlatAbove)
        {
            _flat = true;
        }
    }

    /// <summary>
    /// Telefono acostado: manda el borde superior de la <b>pantalla</b>.
    /// </summary>
    /// <remarks>
    /// Por eso entra la rotacion de la interfaz: con el telefono apaisado, el
    /// borde de arriba para el usuario no es el mismo eje fisico que en vertical.
    /// </remarks>
    private double FlatAzimuth()
    {
        var (x, y) = ScreenAxes(_display);

        SensorManager.RemapCoordinateSystem(_rotation, x, y, _remapped);
        SensorManager.GetOrientation(_remapped, _orientation);

        return _orientation[0] * 180.0 / Math.PI;
    }

    /// <summary>
    /// Telefono de pie: manda hacia donde mira la espalda del aparato.
    /// </summary>
    /// <remarks>
    /// <para>
    /// En un soporte de parabrisas la pantalla mira al conductor y la espalda
    /// mira hacia adelante, o sea hacia donde el conductor mira. Ese eje es
    /// perpendicular a la pantalla, asi que <b>no depende de como este rotada la
    /// interfaz</b> y no hay que corregir nada.
    /// </para>
    /// <para>
    /// El remapeo deja como eje de referencia el que sale <b>de</b> la pantalla
    /// —el que apunta al conductor—, de ahi la media vuelta: lo que interesa es
    /// el opuesto.
    /// </para>
    /// </remarks>
    private double UprightAzimuth()
    {
        SensorManager.RemapCoordinateSystem(_rotation, Axis.X, Axis.Z, _remapped);
        SensorManager.GetOrientation(_remapped, _orientation);

        return _orientation[0] * 180.0 / Math.PI + 180.0;
    }

    private static (Axis X, Axis Y) ScreenAxes(DisplayRotation rotation) => rotation switch
    {
        DisplayRotation.Rotation90 => (Axis.Y, Axis.MinusX),
        DisplayRotation.Rotation180 => (Axis.MinusX, Axis.MinusY),
        DisplayRotation.Rotation270 => (Axis.MinusY, Axis.X),
        _ => (Axis.X, Axis.Y)
    };

    /* --------------------------------------------------------------------
       Filtro y salida
    -------------------------------------------------------------------- */

    private double Average(double degrees)
    {
        var radians = degrees * Math.PI / 180.0;
        var x = Math.Cos(radians);
        var y = Math.Sin(radians);

        if (!_averaging)
        {
            _averageX = x;
            _averageY = y;
            _averaging = true;
        }
        else
        {
            _averageX += (x - _averageX) * Smoothing;
            _averageY += (y - _averageY) * Smoothing;
        }

        return Normalize(Math.Atan2(_averageY, _averageX) * 180.0 / Math.PI);
    }

    private void Emit(double degrees)
    {
        var now = SystemClock.ElapsedRealtime();

        // Que el magnetometro pase a estar sin calibrar —o vuelva— se avisa
        // siempre: es lo que hace que la pantalla deje de mostrar como firme algo
        // que dejo de serlo.
        if (_emitted && _reliable == _lastReliable)
        {
            if (now - _lastEmitAt < MinEmitIntervalMs)
            {
                return;
            }

            if (Delta(degrees, _lastDegrees) < MinEmitDeltaDegrees)
            {
                return;
            }
        }

        _emitted = true;
        _lastDegrees = degrees;
        _lastReliable = _reliable;
        _lastEmitAt = now;

        // Al logcat de verdad y no por Debug.WriteLine: el compilador borra ese
        // en Release, o sea que los diagnosticos desaparecen justo en el build
        // que corre en el telefono, que es el unico lugar donde hay sensores.
        global::Android.Util.Log.Info(
            LogTag,
            $"rumbo={degrees:0.0} plano={_flat} confiable={_reliable} declinacion={_declination:0.0}");

        HeadingChanged?.Invoke(this, new HeadingReading(degrees, _reliable));
    }

    private static double Normalize(double degrees) => (degrees % 360.0 + 360.0) % 360.0;

    /// <summary>Cuanto hay entre dos rumbos, por el lado corto.</summary>
    private static double Delta(double a, double b)
    {
        var difference = Math.Abs(a - b) % 360.0;
        return difference > 180.0 ? 360.0 - difference : difference;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            Stop();
        }

        base.Dispose(disposing);
    }
}
