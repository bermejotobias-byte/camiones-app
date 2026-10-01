namespace TruckNavigator.Domain.Reports;

/// <summary>Lo que el catalogo dice de un tipo de reporte.</summary>
/// <param name="Lifetime">Cuanto vive desde que se crea, si nadie lo confirma.</param>
/// <param name="ExtendsWithConfirmation">Si un "sigue ahi" lo estira.</param>
/// <param name="ValueRange">Rango del valor que lleva (metros del galibo), o null si no lleva.</param>
/// <param name="FixedAfterConfirmations">Con cuantas confirmaciones deja de vencer, o null si nunca.</param>
public sealed record ReportRule(
    ReportType Type,
    ReportKind Kind,
    TimeSpan Lifetime,
    bool ExtendsWithConfirmation,
    (double Min, double Max)? ValueRange,
    int? FixedAfterConfirmations);

/// <summary>
/// Las reglas de cada tipo de reporte, en un solo lugar.
/// </summary>
/// <remarks>
/// <para>
/// Vive en el dominio y no en la base a proposito: agregar un tipo es una fila
/// aca y un valor en el enum, sin migracion. Cada numero es una constante con
/// nombre porque la spec del 19/09/2026 los marca como propuesta configurable:
/// se cambian aca, con su test, y en ningun otro lado.
/// </para>
/// <para>
/// Las vidas utiles siguen la naturaleza de cada cosa: un embotellamiento se
/// disuelve en menos de una hora, una obra dura semanas. La camara es el caso
/// aparte: una camara muy confirmada es fija —decision del usuario— y con
/// <see cref="FixedThreshold"/> confirmaciones deja de vencer.
/// </para>
/// </remarks>
public static class ReportCatalog
{
    /// <summary>Confirmaciones ajenas que vuelven fijo lo que puede serlo. "+5 es un principio".</summary>
    public const int FixedThreshold = 5;

    public const double MinClearanceMetres = 2.0;
    public const double MaxClearanceMetres = 6.0;

    private static readonly Dictionary<ReportType, ReportRule> ByType = Build();

    public static IReadOnlyList<ReportRule> All { get; } = [.. ByType.Values];

    public static ReportRule Get(ReportType type) => ByType.TryGetValue(type, out var rule)
        ? rule
        : throw new KeyNotFoundException($"El tipo de reporte '{type}' no esta en el catalogo.");

    private static Dictionary<ReportType, ReportRule> Build()
    {
        static ReportRule Info(ReportType type, TimeSpan lifetime, int? fixedAfter = null) =>
            new(type, ReportKind.Information, lifetime, ExtendsWithConfirmation: true, ValueRange: null, fixedAfter);

        var rules = new[]
        {
            Info(ReportType.Traffic,    TimeSpan.FromMinutes(45)),
            Info(ReportType.Police,     TimeSpan.FromHours(1)),
            Info(ReportType.Accident,   TimeSpan.FromHours(2)),
            Info(ReportType.Checkpoint, TimeSpan.FromHours(2)),
            Info(ReportType.Hazard,     TimeSpan.FromHours(2)),
            Info(ReportType.Camera,     TimeSpan.FromHours(6), fixedAfter: FixedThreshold),
            Info(ReportType.Pothole,    TimeSpan.FromDays(7)),
            Info(ReportType.Roadworks,  TimeSpan.FromDays(7)),

            // Las dos restricciones: pueden cambiar la ruta, y solo validadas.
            new ReportRule(ReportType.RoadClosed, ReportKind.Restriction, TimeSpan.FromHours(12),
                ExtendsWithConfirmation: true, ValueRange: null, FixedAfterConfirmations: null),
            new ReportRule(ReportType.LowClearance, ReportKind.Restriction, TimeSpan.FromDays(30),
                ExtendsWithConfirmation: true, ValueRange: (MinClearanceMetres, MaxClearanceMetres), FixedAfterConfirmations: null)
        };

        return rules.ToDictionary(rule => rule.Type);
    }
}
