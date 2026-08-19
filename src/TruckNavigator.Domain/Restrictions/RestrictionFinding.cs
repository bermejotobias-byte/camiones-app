namespace TruckNavigator.Domain.Restrictions;

/// <summary>Tipo de restriccion detectada sobre un tramo.</summary>
public enum RestrictionKind
{
    MaxWeight,
    MaxHeight,
    MaxWidth,
    MaxLength,

    /// <summary>Circulacion de camiones prohibida explicitamente sobre la via.</summary>
    HgvProhibited,

    /// <summary>
    /// El tramo no pertenece a la Red de Transito Pesado y el vehiculo supera el
    /// umbral a partir del cual la Red es obligatoria.
    /// </summary>
    OutsideHeavyTrafficNetwork
}

/// <summary>Origen de una regla o de un dato.</summary>
public enum RestrictionSourceType
{
    /// <summary>Derivado de etiquetas de OpenStreetMap.</summary>
    Osm,

    /// <summary>Normativa o dato publicado por el Gobierno de la Ciudad de Buenos Aires.</summary>
    CabaOfficial,

    /// <summary>Cargado a mano por un operador.</summary>
    Manual,

    /// <summary>Restriccion temporal (obra, evento, corte).</summary>
    Temporary
}

/// <summary>
/// Una restriccion concreta que aplica a un tramo para un camion dado.
/// </summary>
/// <remarks>
/// La fuente se parte en dos deliberadamente. La <b>regla</b> y el <b>dato</b>
/// pueden venir de origenes distintos: la obligacion de circular por la Red de
/// Transito Pesado es normativa oficial de CABA, pero saber si un tramo
/// pertenece o no a esa Red hoy sale de OpenStreetMap. Mezclarlos en un solo
/// campo haria imposible auditar el sistema. Ver docs/data-sources.md.
/// </remarks>
/// <param name="LimitValue">Valor del limite de la via que se incumple, si aplica.</param>
/// <param name="RuleSource">Origen de la regla que se esta aplicando.</param>
/// <param name="RuleReference">Cita concreta de la regla (articulo, ley, o etiqueta OSM).</param>
/// <param name="DataSource">Origen del dato del tramo sobre el que se evaluo la regla.</param>
/// <param name="DataReference">Cita concreta del dato.</param>
public sealed record RestrictionFinding(
    RestrictionKind Kind,
    string Description,
    double? LimitValue,
    string? Unit,
    RestrictionSourceType RuleSource,
    string RuleReference,
    RestrictionSourceType DataSource,
    string DataReference);

/// <summary>
/// Resultado de evaluar un tramo contra un camion.
/// </summary>
/// <param name="IsAllowed">
/// <c>false</c> si el tramo es lisa y llanamente intransitable para el vehiculo.
/// </param>
/// <param name="RequiresAccessException">
/// <c>true</c> si el tramo solo puede usarse al amparo de la excepcion de acceso
/// a origen/destino. No es una prohibicion: es circulacion condicionada.
/// </param>
public sealed record RestrictionVerdict(
    bool IsAllowed,
    bool RequiresAccessException,
    IReadOnlyList<RestrictionFinding> Findings)
{
    public static RestrictionVerdict Allowed { get; } =
        new(true, false, Array.Empty<RestrictionFinding>());
}
