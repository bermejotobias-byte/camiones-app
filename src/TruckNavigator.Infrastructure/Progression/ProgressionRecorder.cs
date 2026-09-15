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
    // Cuanto paga cada cosa lo decide ExperienceScale, en el dominio. Aca no hay
    // ningun numero: el registrador sabe escribir en el libro, no cuanto vale un
    // viaje. Antes eran dos constantes fijas de 20 y 50.

    /// <summary>
    /// Acredita el viaje y devuelve lo que dejo, o <c>null</c> si no habia nada que
    /// acreditar —cancelado, o ya acreditado—. Null y no un resultado vacio, para
    /// que quien llama no pueda mostrar una celebracion de cero.
    /// </summary>
    public async Task<TripEarnings?> RecordAsync(Trip trip, DateTimeOffset when, CancellationToken ct = default)
    {
        if (trip.Status != TripStatus.Completed)
        {
            return null;
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
            return null;
        }

        var rows = await db.TrackProgress
            .Where(t => t.DriverId == trip.DriverId)
            .ToDictionaryAsync(t => t.TrackCode, ct);

        var countsBefore = rows.ToDictionary(row => row.Key, row => row.Value.Count);
        var increments = new Dictionary<string, long>(TripProgression.IncrementsFor(trip));

        AddMileageIncrement(await TotalCreditedMetersAsync(trip.DriverId, ct), countsBefore, increments);

        // El nivel de antes y el de despues salen de los mismos kilometros que la
        // pista: el total acreditado con y sin este viaje.
        countsBefore.TryGetValue(TrackCatalog.Mileage, out var kmBefore);
        increments.TryGetValue(TrackCatalog.Mileage, out var kmIncrement);
        var levelBefore = LevelScale.For(kmBefore);
        var levelAfter = LevelScale.For(kmBefore + kmIncrement);

        // La distancia ACREDITADA, no la planificada: un viaje que se corto a la
        // mitad no puede pagar entero.
        var tripExperience = ExperienceScale.ForTrip(trip.CreditedDistanceMeters);

        db.LedgerEntries.Add(Entry(
            trip.DriverId,
            when,
            LedgerReason.TripCompleted,
            tripExperience,
            tripKey));

        var outcome = Apply(trip.DriverId, when, countsBefore, increments, rows);

        await db.SaveChangesAsync(ct);

        return new TripEarnings(
            tripExperience,
            outcome.CompletedTiers.Count * ExperienceScale.PerTier,
            outcome.CompletedTiers,
            levelBefore,
            levelAfter);
    }

    /// <summary>
    /// Acredita un aporte a los lugares —un voto o un lugar nuevo— y devuelve lo
    /// que dejo, o <c>null</c> si ese hecho ya estaba cobrado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Es la misma puerta que los viajes: el cliente pide, el servidor decide, y el
    /// mismo indice unico impide que un voto cambiado, un reintento o un doble
    /// toque cobren dos veces. <b>Retirar un voto no devuelve nada</b>: el libro no
    /// resta, y el voto ya se pago una vez.
    /// </para>
    /// <para>
    /// Sin tope diario, por decision del usuario del 15/09/2026. El dia que haga
    /// falta, el tope se decide aca contando los asientos del dia antes de escribir.
    /// </para>
    /// </remarks>
    public async Task<ContributionEarnings?> RecordContributionAsync(
        Guid driverId,
        LedgerReason reason,
        string sourceKey,
        DateTimeOffset when,
        CancellationToken ct = default)
    {
        var amount = reason switch
        {
            LedgerReason.PlaceAdded => ExperienceScale.PlaceAdded,
            LedgerReason.PlaceVoted => ExperienceScale.PlaceVote,
            _ => throw new ArgumentException("Por esta puerta solo pasan los aportes a los lugares.", nameof(reason))
        };

        var alreadyCredited = await db.LedgerEntries.AnyAsync(
            e => e.DriverId == driverId && e.Reason == reason && e.SourceKey == sourceKey,
            ct);

        if (alreadyCredited)
        {
            return null;
        }

        var rows = await db.TrackProgress
            .Where(t => t.DriverId == driverId)
            .ToDictionaryAsync(t => t.TrackCode, ct);

        var countsBefore = rows.ToDictionary(row => row.Key, row => row.Value.Count);
        var increments = new Dictionary<string, long> { [TrackCatalog.Places] = 1 };

        db.LedgerEntries.Add(Entry(driverId, when, reason, amount, sourceKey));

        var outcome = Apply(driverId, when, countsBefore, increments, rows);

        await db.SaveChangesAsync(ct);

        return new ContributionEarnings(
            amount,
            outcome.CompletedTiers.Count * ExperienceScale.PerTier,
            outcome.CompletedTiers);
    }

    /// <summary>
    /// Lo que comparten un viaje y un aporte: decidir los escalones, asentarlos con
    /// su recompensa y avanzar los contadores. No guarda: quien llama guarda, para
    /// que todo salga en una sola operacion.
    /// </summary>
    private ProgressionOutcome Apply(
        Guid driverId,
        DateTimeOffset when,
        IReadOnlyDictionary<string, long> countsBefore,
        IReadOnlyDictionary<string, long> increments,
        IDictionary<string, DriverTrackProgress> rows)
    {
        var outcome = ProgressionEngine.Advance(TrackCatalog.All, countsBefore, increments);

        foreach (var tier in outcome.CompletedTiers)
        {
            db.LedgerEntries.Add(Entry(
                driverId,
                when,
                LedgerReason.TierCompleted,
                ExperienceScale.PerTier,
                $"{tier.TrackCode}:{tier.Tier}"));

            // El desbloqueo va en la misma operacion que el escalon: si fueran dos
            // pasos, una meta podria quedar completada sin que su recompensa llegue
            // nunca al inventario.
            db.Rewards.Add(new DriverReward
            {
                DriverId = driverId,
                RewardCode = tier.RewardCode,
                UnlockedAt = when
            });
        }

        foreach (var (code, increment) in increments)
        {
            if (!rows.TryGetValue(code, out var row))
            {
                row = new DriverTrackProgress { DriverId = driverId, TrackCode = code };
                db.TrackProgress.Add(row);
                rows[code] = row;
            }

            row.Count += increment;
            row.TierReached = TrackCatalog.Get(code).TiersReachedAt(row.Count);
        }

        return outcome;
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
