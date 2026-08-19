using TruckNavigator.Domain.Routing;

namespace TruckNavigator.Domain.Places;

/// <summary>
/// Un lugar que el usuario puede elegir como origen o destino.
/// </summary>
/// <param name="Label">Texto principal, por ejemplo "Avenida Rivadavia 1000".</param>
/// <param name="Secondary">Contexto: barrio, localidad, codigo postal.</param>
public sealed record Place(string Label, string? Secondary, GeoPoint Location);

/// <summary>
/// Busqueda de direcciones. Vive detras de nuestra API para que la app no
/// dependa de un proveedor concreto y podamos cambiarlo (o autohospedarlo) sin
/// tocar el cliente movil.
/// </summary>
public interface IPlaceSearch
{
    Task<IReadOnlyList<Place>> SearchAsync(
        string query,
        int limit,
        CancellationToken cancellationToken = default);

    /// <summary>Que hay en estas coordenadas. Se usa al marcar un punto en el mapa.</summary>
    Task<Place?> ReverseAsync(GeoPoint point, CancellationToken cancellationToken = default);
}
