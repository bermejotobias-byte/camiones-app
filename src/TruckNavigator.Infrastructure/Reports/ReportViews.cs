using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Infrastructure.Reports;

/// <summary>
/// Un reporte como lo ve quien pregunta: con su confiabilidad calculada ahora,
/// lo que le dice a su camion, y lo suyo (si es de el, que voto).
/// </summary>
public sealed record ReportView(
    Report Report,
    int Score,
    ReliabilityLabel Label,
    bool Validated,
    TruckRelevance Relevance,
    string? ReportedByAlias,
    ReportVerdict? YourVote,
    bool Mine);

/// <summary>Arma la vista con las funciones puras del dominio. Sin base.</summary>
public static class ReportViews
{
    public static ReportView Build(
        Report report,
        int creatorReputation,
        TruckProfile? truck,
        Guid? viewerId,
        string? creatorAlias,
        ReportVerdict? viewerVote,
        DateTimeOffset now)
    {
        var score = ReportStanding.ScoreFor(report, creatorReputation, now);

        return new ReportView(
            report,
            score,
            ReportStanding.LabelFor(report, score),
            // Lo validado es un estado escrito al votar, no un recalculo: es lo que
            // el ruteo lee, y la vista dice lo mismo que el ruteo.
            report.Status is ReportStatus.Validated or ReportStatus.Fixed,
            ReportRelevance.ForTruck(report, truck),
            creatorAlias,
            viewerVote,
            viewerId is { } viewer && viewer == report.CreatedBy);
    }
}
