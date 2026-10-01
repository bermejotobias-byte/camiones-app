namespace TruckNavigator.Domain.Trips;

/// <summary>Un destino al que se fue hace poco, para volver a elegirlo de un toque.</summary>
public sealed record RecentPlace(string Label, double Latitude, double Longitude, DateTimeOffset LastUsedAt);

/// <summary>
/// Los destinos recientes salen de los viajes, no de una tabla propia: cada
/// viaje ya guarda adonde fue y cuando. Asi no hay nada que se desincronice.
/// </summary>
public static class RecentPlaces
{
    /// <summary>Ocho: los que entran en la hoja de busqueda sin scrollear.</summary>
    public const int Max = 8;

    /// <summary>
    /// Los ultimos destinos distintos, del mas nuevo al mas viejo. El mismo
    /// destino en varios viajes aparece una vez, con la fecha del ultimo.
    /// </summary>
    public static IReadOnlyList<RecentPlace> From(IEnumerable<Trip> trips)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var recent = new List<RecentPlace>();

        foreach (var trip in trips.OrderByDescending(t => t.StartedAt))
        {
            var label = (trip.DestinationLabel ?? string.Empty).Trim();

            if (label.Length == 0 || !seen.Add(label))
            {
                continue;
            }

            recent.Add(new RecentPlace(label, trip.DestinationLatitude, trip.DestinationLongitude, trip.StartedAt));

            if (recent.Count == Max)
            {
                break;
            }
        }

        return recent;
    }
}
