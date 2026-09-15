using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.Infrastructure.Pois;

/// <summary>Lo que vuelve despues de votar: la ficha actualizada y lo que pago, si pago.</summary>
public sealed record VoteResult(CommunityView Community, ContributionEarnings? Earned);

/// <summary>
/// Votar, cambiar el voto y retirarlo.
/// </summary>
/// <remarks>
/// <para>
/// Es lo que hace el endpoint, sin el HTTP, para que se pueda probar contra la
/// base: la fila del voto, la EXP por el libro y la vista que vuelve a la ficha.
/// </para>
/// <para>
/// La regla que sostiene todo: <b>el mismo lugar paga una vez</b>. Cambiar el
/// voto reescribe la fila y no cobra; retirarlo borra la fila y no devuelve; volver
/// a votar no cobra, porque el asiento sigue en el libro con el lugar como clave.
/// </para>
/// </remarks>
public sealed class PoiVoting(AppDbContext db, ProgressionRecorder progression, CommunityReader community)
{
    public async Task<VoteResult> CastAsync(
        Guid driverId,
        Guid poiId,
        TruckProfile truck,
        PoiVerdict verdict,
        DateTimeOffset when,
        CancellationToken ct = default)
    {
        var truckClass = PoiSuitability.FieldFor(truck);

        var vote = await db.PoiVotes.FirstOrDefaultAsync(v => v.PoiId == poiId && v.DriverId == driverId, ct);

        if (vote is null)
        {
            vote = new PoiVote { PoiId = poiId, DriverId = driverId, CastAt = when };
            db.PoiVotes.Add(vote);
        }

        // El tipo se toma del camion con el que vota AHORA: si cambio de camion, el
        // voto cambia de clase con el.
        vote.TruckClass = truckClass;
        vote.Verdict = verdict;
        vote.UpdatedAt = when;

        await db.SaveChangesAsync(ct);

        var earned = await progression.RecordContributionAsync(
            driverId,
            LedgerReason.PlaceVoted,
            $"poi-vote:{poiId}",
            when,
            ct);

        var view = (await community.ForPlacesAsync([poiId], truckClass, driverId, ct))[poiId];

        return new VoteResult(view, earned);
    }

    /// <summary>Borra el voto si existe. No devuelve EXP: el libro no resta.</summary>
    public async Task RetireAsync(Guid driverId, Guid poiId, CancellationToken ct = default)
    {
        var vote = await db.PoiVotes.FirstOrDefaultAsync(v => v.PoiId == poiId && v.DriverId == driverId, ct);

        if (vote is null)
        {
            return;
        }

        db.PoiVotes.Remove(vote);
        await db.SaveChangesAsync(ct);
    }
}
