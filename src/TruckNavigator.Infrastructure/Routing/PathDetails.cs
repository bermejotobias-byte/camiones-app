using System.Text.Json;
using TruckNavigator.Domain.Restrictions;

namespace TruckNavigator.Infrastructure.Routing;

/// <summary>
/// Los <c>path_details</c> de GraphHopper vienen como intervalos
/// <c>[desdeIndice, hastaIndice, valor]</c> sobre la geometria, y cada clave
/// tiene sus propios cortes. Esta clase los recompone en tramos homogeneos para
/// poder evaluarlos con el motor de restricciones.
/// </summary>
internal sealed class PathDetails
{
    private readonly Dictionary<string, List<Interval>> _byKey;

    private readonly record struct Interval(int From, int To, JsonElement Value);

    private PathDetails(Dictionary<string, List<Interval>> byKey) => _byKey = byKey;

    public static PathDetails Parse(JsonElement? details)
    {
        var byKey = new Dictionary<string, List<Interval>>(StringComparer.Ordinal);

        if (details is not { ValueKind: JsonValueKind.Object } root)
        {
            return new PathDetails(byKey);
        }

        foreach (var property in root.EnumerateObject())
        {
            var intervals = new List<Interval>();

            foreach (var entry in property.Value.EnumerateArray())
            {
                if (entry.GetArrayLength() < 3)
                {
                    continue;
                }

                intervals.Add(new Interval(
                    entry[0].GetInt32(),
                    entry[1].GetInt32(),
                    entry[2].Clone()));
            }

            byKey[property.Name] = intervals;
        }

        return new PathDetails(byKey);
    }

    /// <summary>
    /// Devuelve los tramos homogeneos: cada uno es un rango de indices en el que
    /// ninguna de las claves cambia de valor.
    /// </summary>
    public IReadOnlyList<(int From, int To, RoadSegmentAttributes Attributes)> ToSegments()
    {
        var boundaries = new SortedSet<int>();

        foreach (var intervals in _byKey.Values)
        {
            foreach (var interval in intervals)
            {
                boundaries.Add(interval.From);
                boundaries.Add(interval.To);
            }
        }

        var ordered = boundaries.ToArray();
        var segments = new List<(int, int, RoadSegmentAttributes)>(Math.Max(ordered.Length - 1, 0));

        for (var i = 0; i < ordered.Length - 1; i++)
        {
            var from = ordered[i];
            var to = ordered[i + 1];

            if (to <= from)
            {
                continue;
            }

            segments.Add((from, to, BuildAttributes(from)));
        }

        return segments;
    }

    private RoadSegmentAttributes BuildAttributes(int index) => new(
        StreetName: ReadString("street_name", index),
        RoadClass: ReadString("road_class", index),
        MaxWeightTons: ReadDouble("max_weight", index),
        MaxHeightMeters: ReadDouble("max_height", index),
        MaxWidthMeters: ReadDouble("max_width", index),
        MaxLengthMeters: ReadDouble("max_length", index),
        Hgv: ParseHgv(ReadString("hgv", index)));

    private JsonElement? ValueAt(string key, int index)
    {
        if (!_byKey.TryGetValue(key, out var intervals))
        {
            return null;
        }

        foreach (var interval in intervals)
        {
            if (index >= interval.From && index < interval.To)
            {
                return interval.Value;
            }
        }

        return null;
    }

    private string? ReadString(string key, int index) =>
        ValueAt(key, index) is { ValueKind: JsonValueKind.String } element
            ? element.GetString()
            : null;

    /// <summary>
    /// GraphHopper manda <c>null</c> en las dimensiones cuando la via no declara
    /// limite, asi que la ausencia de valor significa "sin restriccion".
    /// </summary>
    private double? ReadDouble(string key, int index) =>
        ValueAt(key, index) is { ValueKind: JsonValueKind.Number } element
            ? element.GetDouble()
            : null;

    private static HgvAccess ParseHgv(string? value) => value switch
    {
        "designated" => HgvAccess.Designated,
        "yes" => HgvAccess.Yes,
        "destination" => HgvAccess.Destination,
        "delivery" => HgvAccess.Delivery,
        "no" => HgvAccess.No,
        _ => HgvAccess.Missing
    };
}
