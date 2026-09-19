using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Routing;

/// <summary>
/// Una cuadra que la ruta tiene que esquivar: un reporte de la comunidad
/// validado (calle cerrada, o un galibo por el que este camion no pasa).
/// </summary>
/// <remarks>
/// <para>
/// Se vuelve un poligono en el custom model del pedido: un rectangulo de
/// <see cref="LengthMetres"/> a lo largo del rumbo por <see cref="WidthMetres"/>
/// de ancho si se sabe para donde iba quien reporto, y un cuadrado de
/// <see cref="SquareMetres"/> de lado si no. Las dos medidas quedan por debajo
/// de los ~100 m que separan dos calles paralelas en CABA, asi que bloquean esa
/// cuadra y no la de al lado. Medido contra GraphHopper 11 el 19/09/2026.
/// </para>
/// <para>
/// La geometria es plana con la correccion del coseno de la latitud: a esta
/// escala el error es de centimetros y no hace falta una biblioteca.
/// </para>
/// </remarks>
public sealed record RouteBlockade(string Id, double Latitude, double Longitude, double? HeadingDegrees)
{
    public const double LengthMetres = 40;
    public const double WidthMetres = 16;
    public const double SquareMetres = 24;

    private const double MetresPerDegreeLatitude = 111_320;

    /// <summary>El anillo cerrado, en (lon, lat) como lo pide GeoJSON.</summary>
    public IReadOnlyList<(double Lon, double Lat)> Polygon()
    {
        var halfAlong = (HeadingDegrees is null ? SquareMetres : LengthMetres) / 2;
        var halfAcross = (HeadingDegrees is null ? SquareMetres : WidthMetres) / 2;

        // Rumbo 0 es norte y crece hacia el este; en el plano (este, norte) el eje
        // "a lo largo" es (sin, cos) y el "a traves" es su perpendicular.
        var radians = (HeadingDegrees ?? 0) * Math.PI / 180;
        var alongEast = Math.Sin(radians);
        var alongNorth = Math.Cos(radians);
        var acrossEast = Math.Cos(radians);
        var acrossNorth = -Math.Sin(radians);

        var corners = new[]
        {
            (Along: halfAlong, Across: halfAcross),
            (Along: halfAlong, Across: -halfAcross),
            (Along: -halfAlong, Across: -halfAcross),
            (Along: -halfAlong, Across: halfAcross)
        };

        var ring = corners
            .Select(c => Offset(
                east: c.Along * alongEast + c.Across * acrossEast,
                north: c.Along * alongNorth + c.Across * acrossNorth))
            .ToList();

        ring.Add(ring[0]);
        return ring;
    }

    private (double Lon, double Lat) Offset(double east, double north)
    {
        var metresPerDegreeLongitude = MetresPerDegreeLatitude * Math.Cos(Latitude * Math.PI / 180);

        return (Longitude + east / metresPerDegreeLongitude, Latitude + north / MetresPerDegreeLatitude);
    }
}

/// <summary>De donde salen los bloqueos vigentes para un camion: la base, en produccion.</summary>
public interface IRouteBlockadeSource
{
    Task<IReadOnlyList<RouteBlockade>> ActiveAsync(TruckProfile truck, DateTimeOffset when, CancellationToken cancellationToken = default);
}

/// <summary>Ningun bloqueo: lo que usan los tests y quien no tiene base a mano.</summary>
public sealed class NoRouteBlockades : IRouteBlockadeSource
{
    public static readonly NoRouteBlockades Instance = new();

    public Task<IReadOnlyList<RouteBlockade>> ActiveAsync(TruckProfile truck, DateTimeOffset when, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<RouteBlockade>>([]);
}
