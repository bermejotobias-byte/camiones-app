namespace TruckNavigator.Domain.Reports;

/// <summary>
/// Cuando un reporte deja de valer.
/// </summary>
/// <remarks>
/// <para>
/// No hay tareas de fondo: vencido es que <see cref="Report.ExpiresAt"/> ya paso, y
/// la consulta lo filtra. Lo que si se escribe es el <c>ExpiresAt</c>, que se mueve
/// con los votos: un "sigue ahi" lo estira media vida —con tope de tres vidas,
/// para que un embotellamiento confirmado no viva un dia— y los "ya no esta" que
/// superan a las confirmaciones lo matan ahora.
/// </para>
/// <para>
/// Lo fijo (<c>ExpiresAt</c> null) no se toca desde aca: eso es de <see cref="ReportPromotion"/>.
/// </para>
/// </remarks>
public static class ReportExpiry
{
    /// <summary>Que fraccion de la vida util agrega cada confirmacion.</summary>
    public const double ExtensionFraction = 0.5;

    /// <summary>Hasta cuantas vidas utiles puede llegar a vivir, confirmandolo.</summary>
    public const int MaxLifetimes = 3;

    /// <summary>Cuantos "ya no esta" hacen falta, ademas de superar a las confirmaciones.</summary>
    public const int RejectionsToKill = 2;

    public static bool IsExpired(Report report, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(report);

        return report.ExpiresAt is { } expires && expires <= now;
    }

    /// <summary>Un "sigue ahi": estira, nunca acorta, y respeta el tope.</summary>
    public static void Confirm(Report report, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(report);

        if (report.ExpiresAt is not { } current)
        {
            return;
        }

        var rule = ReportCatalog.Get(report.Type);

        if (!rule.ExtendsWithConfirmation)
        {
            return;
        }

        var extended = now + rule.Lifetime * ExtensionFraction;
        var cap = report.CreatedAt + rule.Lifetime * MaxLifetimes;

        report.ExpiresAt = Max(current, Min(extended, cap));
    }

    public static bool ShouldReject(Report report)
    {
        ArgumentNullException.ThrowIfNull(report);

        return report.Rejections >= RejectionsToKill && report.Rejections > report.Confirmations;
    }

    public static void Reject(Report report, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(report);

        report.Status = ReportStatus.Rejected;
        report.ExpiresAt = now;
    }

    public static void CloseByAuthor(Report report, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(report);

        report.Status = ReportStatus.ClosedByAuthor;
        report.ExpiresAt = now;
    }

    private static DateTimeOffset Max(DateTimeOffset a, DateTimeOffset b) => a >= b ? a : b;

    private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a <= b ? a : b;
}
