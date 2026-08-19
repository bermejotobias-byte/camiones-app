using System.Globalization;

namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Una restriccion lista para mostrar: que pasa, por que, y de donde sale.
/// </summary>
public sealed record RestrictionNoteView(string Title, string Description, string Source)
{
    public static IReadOnlyList<RestrictionNoteView> From(RouteResponse route)
    {
        var views = new List<RestrictionNoteView>();

        // Se agrupan por regla para no repetir la misma explicacion en cada uno
        // de los tramos de acceso.
        var groups = route.RestrictionNotes
            .SelectMany(note => note.Findings.Select(finding => (note, finding)))
            .GroupBy(x => (x.finding.Kind, x.finding.RuleReference));

        foreach (var group in groups)
        {
            var finding = group.First().finding;
            var streets = group
                .Select(x => x.note.StreetName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct()
                .Take(3)
                .ToList();

            var distance = group.Sum(x => x.note.DistanceMeters);

            var title = finding.Kind switch
            {
                "OutsideHeavyTrafficNetwork" =>
                    $"Fuera de la Red de Tránsito Pesado · {FormatDistance(distance)}",
                "MaxHeight" => "Altura máxima",
                "MaxWeight" => "Peso máximo",
                "MaxWidth" => "Ancho máximo",
                "MaxLength" => "Longitud máxima",
                "HgvProhibited" => "Camiones prohibidos",
                _ => finding.Kind
            };

            var description = streets.Count > 0
                ? $"{finding.Description} ({string.Join(", ", streets)})"
                : finding.Description;

            views.Add(new RestrictionNoteView(
                title,
                description,
                $"Regla: {finding.RuleReference} · Dato: {finding.DataReference}"));
        }

        return views;
    }

    private static string FormatDistance(double meters) =>
        meters >= 1000
            ? string.Format(CultureInfo.CurrentCulture, "{0:0.0} km", meters / 1000)
            : string.Format(CultureInfo.CurrentCulture, "{0:0} m", meters);
}
