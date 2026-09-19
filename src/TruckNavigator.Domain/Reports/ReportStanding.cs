namespace TruckNavigator.Domain.Reports;

/// <summary>Lo que la ficha dice de un reporte, porque un numero no se lee manejando.</summary>
public enum ReliabilityLabel
{
    New = 0,
    Confirmed = 1,
    Disputed = 2
}

/// <summary>
/// La confiabilidad de un reporte, de 0 a 100, y lo que se decide con ella.
/// </summary>
/// <remarks>
/// <para>
/// Formula propia, simple y configurable (spec del 19/09/2026):
/// <c>(Base + PerReputationPoint x reputacion + PerConfirmation x min(confirmaciones, 4)
/// - PerRejection x rechazos) x frescura</c>, con la frescura cayendo hasta
/// <see cref="FreshnessDrop"/> al llegar a la vida util del tipo. Se calcula al leer,
/// con el reloj como parametro: no hay tareas de fondo.
/// </para>
/// <para>
/// Un reporte recien creado por alguien promedio vale 50; con dos confirmaciones,
/// 74 —validado—; el mismo de alguien con reputacion 10 llega a 62 con dos y
/// necesita tres. Asi una fuente desacreditada no bloquea una calle con un
/// complice: le hace falta uno mas.
/// </para>
/// </remarks>
public static class ReportStanding
{
    public const int Base = 35;
    public const double PerReputationPoint = 0.30;
    public const int PerConfirmation = 12;
    public const int MaxCountedConfirmations = 4;
    public const int PerRejection = 18;
    public const double FreshnessDrop = 0.40;

    /// <summary>Desde este score, con al menos una confirmacion, la etiqueta dice "confirmado".</summary>
    public const int ConfirmedFrom = 60;

    /// <summary>Desde este score, con <see cref="ValidatedConfirmations"/>, el reporte puede tocar la ruta.</summary>
    public const int ValidatedFrom = 70;

    public const int ValidatedConfirmations = 2;

    public static int ScoreFor(Report report, int creatorReputation, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(report);

        var support = PerConfirmation * Math.Min(report.Confirmations, MaxCountedConfirmations);
        var raw = Base + PerReputationPoint * creatorReputation + support - PerRejection * report.Rejections;
        var score = raw * FreshnessOf(report, now);

        return Math.Clamp((int)Math.Round(score, MidpointRounding.AwayFromZero), 0, 100);
    }

    public static ReliabilityLabel LabelFor(Report report, int score)
    {
        ArgumentNullException.ThrowIfNull(report);

        if (report.Rejections >= 1 && report.Rejections >= report.Confirmations)
        {
            return ReliabilityLabel.Disputed;
        }

        // Una reputacion alta sola no lo vuelve "confirmado": nadie lo confirmo.
        return report.Confirmations >= 1 && score >= ConfirmedFrom
            ? ReliabilityLabel.Confirmed
            : ReliabilityLabel.New;
    }

    /// <summary>Lo unico que habilita a tocar la ruta: confirmaciones ajenas y score.</summary>
    public static bool IsValidated(Report report, int score)
    {
        ArgumentNullException.ThrowIfNull(report);

        return report.Confirmations >= ValidatedConfirmations && score >= ValidatedFrom;
    }

    private static double FreshnessOf(Report report, DateTimeOffset now)
    {
        // Lo fijo no envejece: es un dato de la app, no un aviso.
        if (report.ExpiresAt is null)
        {
            return 1;
        }

        var lifetime = ReportCatalog.Get(report.Type).Lifetime;
        var age = now - report.CreatedAt;
        var fraction = Math.Clamp(age / lifetime, 0, 1);

        return 1 - FreshnessDrop * fraction;
    }
}
