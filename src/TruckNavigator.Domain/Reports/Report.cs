using System.Globalization;
using TruckNavigator.Domain.Pois;

namespace TruckNavigator.Domain.Reports;

/// <summary>En que estado esta un reporte. Vencido no es un estado: es que <see cref="Report.ExpiresAt"/> ya paso.</summary>
public enum ReportStatus
{
    Active = 0,

    /// <summary>Confirmado por suficientes personas distintas del creador: puede tocar la ruta.</summary>
    Validated = 1,

    /// <summary>No vence nunca: la camara muy confirmada. Es un dato de la app.</summary>
    Fixed = 2,

    /// <summary>La comunidad dijo que ya no esta.</summary>
    Rejected = 3,

    ClosedByAuthor = 4
}

/// <summary>
/// Un reporte de la comunidad: lo que un camionero vio en su posicion.
/// </summary>
/// <remarks>
/// <para>
/// Nace en la posicion GPS de quien reporta —decision del usuario del 19/09/2026:
/// nunca en un punto elegido a mano— y con lo que el fix traia: el rumbo solo si
/// venia en movimiento, porque el rumbo de un vehiculo parado no significa nada.
/// </para>
/// <para>
/// Los contadores son una copia de las filas de votos, para leer barato; la
/// verdad son las filas, y quien vota los recalcula desde ahi.
/// </para>
/// </remarks>
public sealed class Report
{
    /// <summary>Por debajo de esto el vehiculo esta parado y el rumbo se descarta.</summary>
    public const double MovingSpeedMps = 2.0;

    public Guid Id { get; set; }

    public ReportType Type { get; set; }

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    /// <summary>La calle, si se supo. Null no se rellena: la ficha dice "cerca de aca".</summary>
    public string? Street { get; set; }

    /// <summary>Rumbo 0–360 al reportar, solo si venia en movimiento.</summary>
    public double? HeadingDegrees { get; set; }

    /// <summary>Los metros del galibo. Null en todo lo demas.</summary>
    public double? Value { get; set; }

    public Guid CreatedBy { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Cuando deja de valer. Null es que no vence: un reporte fijo.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }

    public ReportStatus Status { get; set; }

    /// <summary>Votos "sigue ahi" de personas distintas del creador.</summary>
    public int Confirmations { get; set; }

    /// <summary>Votos "ya no esta" de personas distintas del creador.</summary>
    public int Rejections { get; set; }

    /// <summary>La primera vez que cruzo el umbral de validacion.</summary>
    public DateTimeOffset? ValidatedAt { get; set; }

    /// <summary>
    /// Arma el reporte. Tira <see cref="ArgumentException"/> con el motivo escrito
    /// para la persona si cae fuera del area o si el galibo no trae metros validos.
    /// </summary>
    public static Report Create(Guid driverId, NewReport input, DateTimeOffset when)
    {
        ArgumentNullException.ThrowIfNull(input);

        if (!PoiContribution.IsInsideCoverage(input.Latitude, input.Longitude))
        {
            throw new ArgumentException(
                "El reporte tiene que estar dentro de CABA o de su anillo de acceso: mas alla la app todavia no tiene mapa.",
                nameof(input));
        }

        var rule = ReportCatalog.Get(input.Type);

        return new Report
        {
            Id = Guid.NewGuid(),
            Type = input.Type,
            Latitude = input.Latitude,
            Longitude = input.Longitude,
            Street = string.IsNullOrWhiteSpace(input.Street) ? null : input.Street.Trim(),
            HeadingDegrees = HeadingIfMoving(input),
            Value = ValueFor(rule, input.Value),
            CreatedBy = driverId,
            CreatedAt = when,
            ExpiresAt = when + rule.Lifetime,
            Status = ReportStatus.Active
        };
    }

    private static double? HeadingIfMoving(NewReport input)
    {
        if (input.HeadingDegrees is not { } heading || input.SpeedMps is not { } speed || speed < MovingSpeedMps)
        {
            return null;
        }

        var normalized = heading % 360;
        return normalized < 0 ? normalized + 360 : normalized;
    }

    private static double? ValueFor(ReportRule rule, double? value)
    {
        if (rule.ValueRange is not { } range)
        {
            // Un tipo sin valor lo ignora aunque llegue: no es un error, es ruido.
            return null;
        }

        if (value is not { } metres || metres < range.Min || metres > range.Max)
        {
            var min = range.Min.ToString("0.0", CultureInfo.InvariantCulture);
            var max = range.Max.ToString("0.0", CultureInfo.InvariantCulture);

            throw new ArgumentException(
                $"El galibo necesita los metros, entre {min} y {max}.",
                nameof(value));
        }

        return metres;
    }
}
