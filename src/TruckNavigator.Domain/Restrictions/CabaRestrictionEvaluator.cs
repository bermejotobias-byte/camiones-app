using System.Globalization;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Restrictions;

/// <summary>
/// Motor de restricciones para CABA.
/// </summary>
/// <remarks>
/// Combina dos familias de reglas de origen distinto:
/// <list type="bullet">
/// <item>Limites fisicos de la via (peso, alto, ancho, largo) y prohibiciones
/// explicitas, que provienen de etiquetas de OpenStreetMap.</item>
/// <item>La obligacion de circular por la Red de Transito Pesado, que proviene
/// de la normativa de la Ciudad.</item>
/// </list>
/// Deliberadamente NO implementa la regla ingenua "si el tramo no esta en la Red
/// entonces esta prohibido". La normativa admite salir de la Red para acceder a
/// origen y destino, asi que ese caso se reporta como
/// <see cref="RestrictionVerdict.RequiresAccessException"/> y no como prohibicion.
/// </remarks>
public sealed class CabaRestrictionEvaluator : IRestrictionEvaluator
{
    public RestrictionVerdict Evaluate(
        RoadSegmentAttributes segment,
        TruckProfile truck,
        DateTimeOffset when)
    {
        ArgumentNullException.ThrowIfNull(truck);

        var findings = new List<RestrictionFinding>();
        var isAllowed = true;

        // --- Limites fisicos declarados sobre la via (fuente: OSM) ---

        if (segment.MaxWeightTons is { } maxWeight && truck.GrossWeightTons > maxWeight)
        {
            isAllowed = false;
            findings.Add(PhysicalLimit(
                RestrictionKind.MaxWeight, "maxweight", "t",
                maxWeight, truck.GrossWeightTons, "Peso"));
        }

        if (segment.MaxHeightMeters is { } maxHeight && truck.HeightMeters > maxHeight)
        {
            isAllowed = false;
            findings.Add(PhysicalLimit(
                RestrictionKind.MaxHeight, "maxheight", "m",
                maxHeight, truck.HeightMeters, "Altura"));
        }

        if (segment.MaxWidthMeters is { } maxWidth && truck.WidthMeters > maxWidth)
        {
            isAllowed = false;
            findings.Add(PhysicalLimit(
                RestrictionKind.MaxWidth, "maxwidth", "m",
                maxWidth, truck.WidthMeters, "Ancho"));
        }

        if (segment.MaxLengthMeters is { } maxLength && truck.TotalLengthMeters > maxLength)
        {
            isAllowed = false;
            findings.Add(PhysicalLimit(
                RestrictionKind.MaxLength, "maxlength", "m",
                maxLength, truck.TotalLengthMeters, "Longitud"));
        }

        // --- Prohibicion explicita de camiones (fuente: OSM) ---

        if (segment.Hgv == HgvAccess.No)
        {
            isAllowed = false;
            findings.Add(new RestrictionFinding(
                RestrictionKind.HgvProhibited,
                "Circulacion de camiones prohibida en este tramo.",
                LimitValue: null,
                Unit: null,
                RuleSource: RestrictionSourceType.Osm,
                RuleReference: "OpenStreetMap, etiqueta hgv=no",
                DataSource: RestrictionSourceType.Osm,
                DataReference: $"OSM hgv=no en {segment.DisplayName}"));
        }

        // --- Red de Transito Pesado (fuente de la regla: normativa CABA) ---
        //
        // Solo aplica por encima del umbral de peso fijado por la norma. Un
        // camion liviano puede circular fuera de la Red sin condicionamiento.
        var requiresAccessException = false;

        if (truck.GrossWeightKg > CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg
            && segment.Hgv != HgvAccess.Designated
            && segment.Hgv != HgvAccess.No)
        {
            requiresAccessException = true;
            findings.Add(new RestrictionFinding(
                RestrictionKind.OutsideHeavyTrafficNetwork,
                CabaHeavyTrafficRules.AccessExceptionExplanation,
                LimitValue: CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg / 1000.0,
                Unit: "t",
                RuleSource: RestrictionSourceType.CabaOfficial,
                RuleReference: CabaHeavyTrafficRules.HeavyNetworkLegalReference,
                DataSource: RestrictionSourceType.Osm,
                DataReference: CabaHeavyTrafficRules.HeavyNetworkDataReference));
        }

        return new RestrictionVerdict(isAllowed, requiresAccessException, findings);
    }

    private static RestrictionFinding PhysicalLimit(
        RestrictionKind kind,
        string osmTag,
        string unit,
        double limit,
        double truckValue,
        string label)
    {
        var limitText = Format(limit);
        var truckText = Format(truckValue);

        return new RestrictionFinding(
            kind,
            $"{label} maxima {limitText} {unit}; el vehiculo declara {truckText} {unit}.",
            limit,
            unit,
            RuleSource: RestrictionSourceType.Osm,
            RuleReference: $"OpenStreetMap, etiqueta {osmTag}={limitText}",
            DataSource: RestrictionSourceType.Osm,
            DataReference: $"OSM {osmTag}={limitText}");
    }

    private static string Format(double value) =>
        value.ToString("0.##", CultureInfo.InvariantCulture);
}
