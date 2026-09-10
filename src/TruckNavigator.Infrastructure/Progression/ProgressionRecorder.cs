using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Progression;

/// <summary>
/// Aplica al camionero lo que le corresponde por cerrar un viaje.
/// </summary>
/// <remarks>
/// <para>
/// Es el <b>unico</b> lugar donde se otorga algo. No existe ningun endpoint que
/// reciba "gane 20 de EXP": el cliente pregunta cuanto tiene, nunca informa cuanto
/// gano. Es la misma regla que ya rige los kilometros, y por el mismo motivo.
/// </para>
/// <para>
/// La decision de que escalones se completaron la toma <see cref="ProgressionEngine"/>,
/// que es una funcion pura y se testea sin base. Aca solo esta lo que necesita la
/// base: leer el estado, escribir el resultado, y no cobrar dos veces.
/// </para>
/// </remarks>
public sealed class ProgressionRecorder(AppDbContext db)
{
    /// <summary>EXP por cerrar un viaje.</summary>
    /// <remarks>
    /// <b>Es fija, no proporcional a los kilometros.</b> Si creciera con la
    /// distancia seria una segunda forma de medir lo mismo que el nivel, y los dos
    /// sistemas tienen que poder convivir sin confundirse.
    ///
    /// El valor es provisorio: esta puesto para poder construir y medir.
    /// </remarks>
    public const int ExperiencePerTrip = 20;

    /// <summary>EXP por completar un escalon. Provisorio.</summary>
    public const int ExperiencePerTier = 50;

    public async Task RecordAsync(Trip trip, DateTimeOffset when, CancellationToken ct = default)
    {
        if (trip.Status != TripStatus.Completed)
        {
            return;
        }

        var tripKey = trip.Id.ToString();

        // El indice unico es la garantia de fondo, pero chequear antes evita que un
        // reintento —que va a pasar— reviente el endpoint con una excepcion de base.
        var alreadyCredited = await db.LedgerEntries.AnyAsync(
            e => e.DriverId == trip.DriverId
                 && e.Reason == LedgerReason.TripCompleted
                 && e.SourceKey == tripKey,
            ct);

        if (alreadyCredited)
        {
            return;
        }

        var rows = await db.TrackProgress
            .Where(t => t.DriverId == trip.DriverId)
            .ToDictionaryAsync(t => t.TrackCode, ct);

        var countsBefore = rows.ToDictionary(row => row.Key, row => row.Value.Count);
        var increments = new Dictionary<string, long>(TripProgression.IncrementsFor(trip));

        AddMileageIncrement(await TotalCreditedMetersAsync(trip.DriverId, ct), countsBefore, increments);

        var outcome = ProgressionEngine.Advance(TrackCatalog.All, countsBefore, increments);

        db.LedgerEntries.Add(Entry(trip.DriverId, when, LedgerReason.TripCompleted, ExperiencePerTrip, tripKey));

        foreach (var tier in outcome.CompletedTiers)
        {
            db.LedgerEntries.Add(Entry(
                trip.DriverId,
                when,
                LedgerReason.TierCompleted,
                ExperiencePerTier,
                $"{tier.TrackCode}:{tier.Tier}"));

            // El desbloqueo va en la misma operacion que el escalon: si fueran dos
            // pasos, una meta podria quedar completada sin que su recompensa llegue
            // nunca al inventario.
            db.Rewards.Add(new DriverReward
            {
                DriverId = trip.DriverId,
                RewardCode = tier.RewardCode,
                UnlockedAt = when
            });
        }

        foreach (var (code, increment) in increments)
        {
            if (!rows.TryGetValue(code, out var row))
            {
                row = new DriverTrackProgress { DriverId = trip.DriverId, TrackCode = code };
                db.TrackProgress.Add(row);
            }

            row.Count += increment;
            row.TierReached = TrackCatalog.Get(code).TiersReachedAt(row.Count);
        }

        await db.SaveChangesAsync(ct);
    }

    private Task<double> TotalCreditedMetersAsync(Guid driverId, CancellationToken ct) =>
        db.Trips
            .Where(t => t.DriverId == driverId && t.Status == TripStatus.Completed)
            .SumAsync(t => t.CreditedDistanceMeters, ct);

    /// <summary>
    /// El kilometraje se <b>recalcula del total</b>, no se incrementa viaje a viaje.
    /// </summary>
    /// <remarks>
    /// Redondear cada viaje por separado tira los metros sueltos de todos: tres
    /// viajes de 900 m darian cero kilometros en vez de dos. Ademas, calcularlo del
    /// total es lo que permite reconstruir el contador sumando los viajes.
    /// </remarks>
    private static void AddMileageIncrement(
        double totalCreditedMeters,
        IReadOnlyDictionary<string, long> countsBefore,
        IDictionary<string, long> increments)
    {
        var totalKilometers = (long)(totalCreditedMeters / 1000);

        countsBefore.TryGetValue(TrackCatalog.Mileage, out var before);

        if (totalKilometers > before)
        {
            increments[TrackCatalog.Mileage] = totalKilometers - before;
        }
    }

    private static LedgerEntry Entry(
        Guid driverId,
        DateTimeOffset when,
        LedgerReason reason,
        int amount,
        string sourceKey) => new()
    {
        Id = Guid.NewGuid(),
        DriverId = driverId,
        OccurredAt = when,
        Denomination = Denomination.Experience,
        Amount = amount,
        Reason = reason,
        SourceKey = sourceKey
    };
}
