namespace TruckNavigator.Domain.Reports;

/// <summary>
/// Lo que la comunidad vuelve fijo.
/// </summary>
/// <remarks>
/// <para>
/// Decision del usuario del 19/09/2026: "una camara muy marcada es porque es fija,
/// no tiene sentido que solo dure 6 hs. Si la confirman muchos usuarios se
/// mantiene como fija y alimenta la base de datos de la app". El umbral es
/// <see cref="ReportCatalog.FixedThreshold"/>, "un principio": una constante.
/// </para>
/// <para>
/// Que tipos pueden fijarse lo dice el catalogo (<see cref="ReportRule.FixedAfterConfirmations"/>);
/// hoy solo la camara. Un reporte fijo sigue aceptando votos, y con el mismo
/// umbral de rechazos —que ademas superen a las confirmaciones— deja de serlo.
/// </para>
/// </remarks>
public static class ReportPromotion
{
    public static bool ShouldFix(Report report)
    {
        ArgumentNullException.ThrowIfNull(report);

        if (report.Status == ReportStatus.Fixed)
        {
            return false;
        }

        return ReportCatalog.Get(report.Type).FixedAfterConfirmations is { } threshold
               && report.Confirmations >= threshold;
    }

    public static void Fix(Report report)
    {
        ArgumentNullException.ThrowIfNull(report);

        report.Status = ReportStatus.Fixed;
        report.ExpiresAt = null;
    }

    public static bool ShouldUnfix(Report report)
    {
        ArgumentNullException.ThrowIfNull(report);

        if (report.Status != ReportStatus.Fixed)
        {
            return false;
        }

        return ReportCatalog.Get(report.Type).FixedAfterConfirmations is { } threshold
               && report.Rejections >= threshold
               && report.Rejections > report.Confirmations;
    }
}
