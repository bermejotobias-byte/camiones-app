namespace TruckNavigator.Mobile.Services;

/// <summary>Una posicion leida del GPS.</summary>
public readonly record struct TrackedPosition(
    double Latitude,
    double Longitude,
    double? AccuracyMeters,
    double? SpeedMetersPerSecond,
    double? BearingDegrees);

/// <summary>
/// Sigue la posicion del camion mientras dura un viaje.
/// </summary>
/// <remarks>
/// Existe para que la pagina que hospeda la app no tenga que saber que en
/// Android esto es un servicio en primer plano con su notificacion, su tipo
/// declarado y sus permisos. Cuando se agregue iOS, se implementa esta misma
/// interfaz y no se toca nada de arriba.
/// </remarks>
public interface ITripTracker
{
    /// <summary>Cada posicion nueva.</summary>
    event EventHandler<TrackedPosition>? PositionChanged;

    /// <summary>Si el seguimiento esta activo.</summary>
    bool IsTracking { get; }

    /// <summary>
    /// Arranca el seguimiento.
    /// </summary>
    /// <param name="destination">
    /// Hacia donde va el viaje, para mostrarlo en la notificacion del sistema.
    /// </param>
    /// <returns>
    /// <c>false</c> si falto un permiso. El llamador tiene que avisarle al
    /// usuario: sin permiso no hay navegacion, y quedarse callado deja una
    /// pantalla que no se actualiza sin ningun motivo visible.
    /// </returns>
    Task<bool> StartAsync(string? destination);

    void Stop();
}
