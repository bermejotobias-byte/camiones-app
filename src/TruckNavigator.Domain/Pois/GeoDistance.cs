namespace TruckNavigator.Domain.Pois;

/// <summary>
/// La distancia en metros entre dos coordenadas (haversine).
/// </summary>
/// <remarks>
/// La misma cuenta la usan el candado del dataset —dos puntos de la misma categoria
/// a menos de 25 m son el mismo lugar— y el chequeo de duplicados al aportar un
/// lugar. Vive en el dominio para que sea una sola.
/// </remarks>
public static class GeoDistance
{
    /// <summary>Radio medio de la Tierra, en metros.</summary>
    private const double EarthRadius = 6_371_000;

    /// <summary>
    /// A menos de esto, dos puntos de la misma categoria se consideran el mismo
    /// lugar.
    /// </summary>
    public const double SamePlaceMeters = 25;

    public static double Meters(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = Radians(lat2 - lat1);
        var dLon = Radians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        return 2 * EarthRadius * Math.Asin(Math.Sqrt(a));
    }

    private static double Radians(double degrees) => degrees * Math.PI / 180;
}
