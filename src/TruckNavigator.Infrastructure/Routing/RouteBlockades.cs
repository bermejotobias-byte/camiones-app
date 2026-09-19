using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Routing;

/// <summary>
/// Los bloqueos vigentes para un camion, leidos de los reportes de la comunidad.
/// </summary>
/// <remarks>
/// <para>
/// Solo entran las <b>restricciones</b> (calle cerrada, galibo) <b>validadas o
/// fijas</b> y sin vencer, y de esas, las que le tocan a este camion: una calle
/// cerrada a todos, un galibo solo a los que no pasan por debajo. Un reporte
/// sin validar no existe para el motor (spec del 19/09/2026).
/// </para>
/// <para>
/// Se consulta una vez por pedido de ruta, sobre una tabla chica con indice por
/// vencimiento: el costo es el de una consulta corta, y a cambio la ruta que
/// vuelve ya esquiva lo que la comunidad confirmo.
/// </para>
/// </remarks>
public sealed class RouteBlockades(AppDbContext db) : IRouteBlockadeSource
{
    public async Task<IReadOnlyList<RouteBlockade>> ActiveAsync(
        TruckProfile truck,
        DateTimeOffset when,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(truck);

        var restrictions = ReportCatalog.All
            .Where(rule => rule.Kind == ReportKind.Restriction)
            .Select(rule => rule.Type)
            .ToList();

        var reports = await db.Reports
            .AsNoTracking()
            .Where(r => restrictions.Contains(r.Type)
                        && (r.Status == ReportStatus.Validated || r.Status == ReportStatus.Fixed)
                        && (r.ExpiresAt == null || r.ExpiresAt > when))
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return reports
            .Where(r => ReportRelevance.ForTruck(r, truck) == TruckRelevance.Incompatible)
            .Select((r, index) => new RouteBlockade($"r{index + 1}", r.Latitude, r.Longitude, r.HeadingDegrees))
            .ToList();
    }
}
