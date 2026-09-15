using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Pois;

/// <summary>
/// Lo que la comunidad dice de un lugar, tal como lo necesita la ficha.
/// </summary>
/// <param name="All">Todos los votos y su sello.</param>
/// <param name="TruckClass">Para que tipo de camion se filtro, si se filtro.</param>
/// <param name="ForTruck">Solo los votos de ese tipo; <c>null</c> sin tipo.</param>
/// <param name="SealForTruck">El sello calculado sobre esos votos; <c>null</c> sin tipo.</param>
/// <param name="YourVote">El voto de quien consulta; <c>null</c> sin sesion o sin voto.</param>
public sealed record CommunityView(
    CommunityCount All,
    CommunitySeal Seal,
    PoiSuitabilityField? TruckClass,
    CommunityCount? ForTruck,
    CommunitySeal? SealForTruck,
    PoiVerdict? YourVote);

/// <summary>
/// Cuenta los votos de un lote de lugares: en total, para un tipo de camion, y el
/// propio.
/// </summary>
/// <remarks>
/// <para>
/// Una sola consulta por lote y el agrupado en memoria: la lista de lugares ya
/// vino de la base, y traer los votos de a uno seria una consulta por marcador.
/// </para>
/// <para>
/// El detalle por tipo es la decision del usuario del 15/09/2026: para un semi,
/// que lo recomienden veinte camioneros de liviano no dice nada. El sello se
/// calcula con la misma funcion las dos veces, sobre todos y sobre los del tipo.
/// </para>
/// </remarks>
public sealed class CommunityReader(AppDbContext db)
{
    public async Task<IReadOnlyDictionary<Guid, CommunityView>> ForPlacesAsync(
        IReadOnlyCollection<Guid> poiIds,
        PoiSuitabilityField? truckClass,
        Guid? driverId,
        CancellationToken ct = default)
    {
        var votes = poiIds.Count == 0
            ? []
            : await db.PoiVotes
                .AsNoTracking()
                .Where(v => poiIds.Contains(v.PoiId))
                .ToListAsync(ct);

        var byPlace = votes.ToLookup(v => v.PoiId);

        // Todos los pedidos tienen su fila, con votos o sin ellos: la ficha no puede
        // distinguir "sin votos" de "no lo consulte".
        return poiIds.Distinct().ToDictionary(id => id, id => Build(byPlace[id], truckClass, driverId));
    }

    private static CommunityView Build(IEnumerable<PoiVote> votes, PoiSuitabilityField? truckClass, Guid? driverId)
    {
        var list = votes.ToList();

        var all = Count(list);
        var forTruck = truckClass is { } cls ? Count(list.Where(v => v.TruckClass == cls)) : null;
        var yours = driverId is { } me ? list.FirstOrDefault(v => v.DriverId == me)?.Verdict : null;

        return new CommunityView(
            all,
            CommunityStanding.SealFor(all),
            truckClass,
            forTruck,
            forTruck is null ? null : CommunityStanding.SealFor(forTruck),
            yours);
    }

    private static CommunityCount Count(IEnumerable<PoiVote> votes)
    {
        var suitable = 0;
        var notSuitable = 0;

        foreach (var vote in votes)
        {
            if (vote.Verdict == PoiVerdict.Suitable)
            {
                suitable++;
            }
            else
            {
                notSuitable++;
            }
        }

        return new CommunityCount(suitable, notSuitable);
    }
}
