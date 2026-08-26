namespace TruckNavigator.Mobile.Services;

/// <summary>Hacia donde apunta el telefono.</summary>
/// <param name="Degrees">
/// Grados en sentido horario desde el norte: 0 norte, 90 este, 180 sur, 270 oeste.
/// </param>
/// <param name="Reliable">
/// Si el magnetometro esta calibrado. Cuando es <c>false</c> el valor sigue
/// sirviendo como orientacion gruesa, pero la interfaz tiene que decir que no
/// es confiable en vez de mostrarlo como si lo fuera.
/// </param>
public readonly record struct HeadingReading(double Degrees, bool Reliable);

/// <summary>
/// El rumbo del dispositivo, leido del magnetometro.
/// </summary>
/// <remarks>
/// <para>
/// Es distinto del rumbo del GPS: aquel dice hacia donde <b>se mueve</b> el
/// camion y no existe cuando esta parado; este dice hacia donde <b>apunta el
/// telefono</b>, aunque el camion este detenido en un semaforo. Es lo que
/// permite saber para que lado se esta mirando en todo momento.
/// </para>
/// <para>
/// Mismo reparto que <see cref="ITripTracker"/>: la interfaz vive en Services y
/// cada plataforma trae su implementacion, para que la pagina que hospeda la web
/// no sepa nada de sensores.
/// </para>
/// </remarks>
public interface IHeadingSensor
{
    /// <summary>Cada rumbo nuevo, ya filtrado y limitado en frecuencia.</summary>
    event EventHandler<HeadingReading>? HeadingChanged;

    /// <summary>Si el dispositivo tiene los sensores que hacen falta.</summary>
    bool IsSupported { get; }

    void Start();

    void Stop();

    /// <summary>
    /// Le informa donde esta el dispositivo, para corregir la declinacion magnetica.
    /// </summary>
    /// <remarks>
    /// El magnetometro apunta al norte <b>magnetico</b>, que no es el geografico
    /// —el del mapa—. La diferencia depende del lugar y del momento, asi que no
    /// se puede fijar como constante: se calcula con el modelo geomagnetico del
    /// sistema a partir de la posicion. Hasta que llegue la primera, el rumbo va
    /// sin corregir.
    /// </remarks>
    void UseLocation(double latitude, double longitude);
}
