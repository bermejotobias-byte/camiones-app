using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Reports;

/// <summary>
/// Los reportes vigentes de un recuadro, como los ve quien pregunta.
/// </summary>
/// <remarks>
/// <para>
/// Vigente es que no vencio: <c>ExpiresAt</c> nulo (fijo) o posterior a ahora.
/// Lo rechazado y lo cerrado vencen en el momento, asi que el mismo filtro los
/// deja afuera sin mirar el estado.
/// </para>
/// <para>
/// La confiabilidad se calcula al leer, con la reputacion de cada creador leida
/// en una sola consulta (como los alias de quienes aportaron lugares).
/// </para>
/// </remarks>
public sealed class ReportReader(AppDbContext db)
{
    /// <summary>Lado maximo del recuadro, en grados (~25 km). Mas grande, se recorta al centro.</summary>
    public const double MaxBoxDegrees = 0.25;

    public async Task<IReadOnlyList<ReportView>> InBoxAsync(
        double minLon,
        double minLat,
        double maxLon,
        double maxLat,
        TruckProfile? truck,
        Guid? viewerId,
        DateTimeOffset now,
        CancellationToken ct = default)
    {
        (minLon, maxLon) = Clamp(minLon, maxLon);
        (minLat, maxLat) = Clamp(minLat, maxLat);

        var reports = await db.Reports
            .AsNoTracking()
            .Where(r => (r.ExpiresAt == null || r.ExpiresAt > now)
                        && r.Latitude >= minLat && r.Latitude <= maxLat
                        && r.Longitude >= minLon && r.Longitude <= maxLon)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        return await BuildAsync(reports, truck, viewerId, now, ct);
    }

    public async Task<ReportView?> ForOneAsync(
        Guid id,
        TruckProfile? truck,
        Guid? viewerId,
        DateTimeOffset now,
        CancellationToken ct = default)
    {
        var report = await db.Reports.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);

        if (report is null)
        {
            return null;
        }

        return (await BuildAsync([report], truck, viewerId, now, ct))[0];
    }

    private async Task<IReadOnlyList<ReportView>> BuildAsync(
        IReadOnlyList<Report> reports,
        TruckProfile? truck,
        Guid? viewerId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (reports.Count == 0)
        {
            return [];
        }

        var creators = reports.Select(r => r.CreatedBy).Distinct().ToList();

        var reputations = await db.DriverReputations
            .AsNoTracking()
            .Where(r => creators.Contains(r.DriverId))
            .ToDictionaryAsync(r => r.DriverId, r => r.Score, ct);

        var aliases = await db.DriverProfiles
            .AsNoTracking()
            .Where(d => creators.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.Alias, ct);

        var ids = reports.Select(r => r.Id).ToList();

        var votes = viewerId is { } viewer
            ? await db.ReportVotes
                .AsNoTracking()
                .Where(v => v.DriverId == viewer && ids.Contains(v.ReportId))
                .ToDictionaryAsync(v => v.ReportId, v => v.Verdict, ct)
            : [];

        return reports
            .Select(r => ReportViews.Build(
                r,
                reputations.TryGetValue(r.CreatedBy, out var score) ? score : ReputationScale.Start,
                truck,
                viewerId,
                aliases.TryGetValue(r.CreatedBy, out var alias) ? alias : null,
                votes.TryGetValue(r.Id, out var vote) ? vote : null,
                now))
            .ToList();
    }

    /// <summary>Un recuadro mas grande que el tope se recorta alrededor de su centro.</summary>
    private static (double Min, double Max) Clamp(double min, double max)
    {
        if (max - min <= MaxBoxDegrees)
        {
            return (min, max);
        }

        var centre = (min + max) / 2;
        return (centre - MaxBoxDegrees / 2, centre + MaxBoxDegrees / 2);
    }
}
