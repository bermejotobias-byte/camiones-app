using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Progression;

/// <summary>Una recompensa desbloqueada que el camionero todavia no vio.</summary>
public sealed record PendingReward(string RewardCode, DateTimeOffset UnlockedAt);

/// <summary>Una pista con su escalon en curso.</summary>
public sealed record TrackView(
    string Code,
    long Count,
    int TiersReached,
    int TotalTiers,
    long CurrentGoal);

/// <summary>Un record personal, con la fecha que lo hace valioso.</summary>
public sealed record RecordView(string Code, long Value, DateTimeOffset AchievedAt);

/// <summary>Lo desbloqueado y lo que esta puesto.</summary>
/// <remarks>
/// Las ranuras van por su <b>nombre</b> y no por el enum: un diccionario con clave
/// de enum se serializa con claves numericas —<c>{"6": "..."}</c>— y eso es
/// ilegible del lado del telefono, ademas de romperse en silencio si algun dia se
/// agrega una ranura en el medio.
/// </remarks>
public sealed record InventoryView(
    IReadOnlyList<string> Unlocked,
    IReadOnlyDictionary<string, string> Equipped);

/// <summary>Lo que el perfil necesita para dibujarse.</summary>
public sealed record ProgressView(
    int Level,
    string LevelName,
    int GoalInLevel,
    int GoalsPerLevel,
    string? NextLevelName,
    long KilometersToNextLevel,
    double ProgressInLevel,
    long Kilometers,
    long Experience,
    IReadOnlyList<PendingReward> PendingRewards);

/// <summary>
/// Arma lo que el perfil le muestra al camionero.
/// </summary>
/// <remarks>
/// <para>
/// Nada de esto se guarda calculado: el nivel sale del contador de kilometraje y la
/// EXP de sumar el libro. Tener un total aparte seria un segundo lugar donde la
/// verdad puede desincronizarse.
/// </para>
/// <para>
/// Una cuenta recien creada no tiene una sola fila de progresion, y aca eso no es
/// un caso raro: es el caso de todo usuario nuevo. Por eso cada lectura tiene su
/// valor por defecto en vez de asumir que la fila existe.
/// </para>
/// </remarks>
public sealed class ProgressionReader(AppDbContext db)
{
    public async Task<ProgressView> GetProgressAsync(Guid driverId, CancellationToken ct = default)
    {
        var kilometers = await db.TrackProgress
            .Where(t => t.DriverId == driverId && t.TrackCode == TrackCatalog.Mileage)
            .Select(t => (long?)t.Count)
            .FirstOrDefaultAsync(ct) ?? 0;

        var experience = await db.LedgerEntries
            .Where(e => e.DriverId == driverId && e.Denomination == Denomination.Experience)
            .SumAsync(e => e.Amount, ct);

        var standing = LevelScale.For(kilometers);

        return new ProgressView(
            standing.Number,
            standing.Name,
            standing.GoalInLevel,
            LevelScale.GoalsPerLevel,
            standing.NextName,
            standing.KilometersToNextLevel,
            standing.ProgressInLevel,
            kilometers,
            experience,
            await PendingAsync(driverId, ct));
    }

    /// <summary>
    /// Lo desbloqueado despues de la marca: lo que todavia no se festejo.
    /// </summary>
    /// <remarks>
    /// Sin marca —cuenta nueva— vale todo, que es lo correcto: si desbloqueo algo,
    /// no lo vio.
    /// </remarks>
    private async Task<IReadOnlyList<PendingReward>> PendingAsync(Guid driverId, CancellationToken ct)
    {
        var mark = await db.ProgressMarks
            .Where(m => m.DriverId == driverId)
            .Select(m => (DateTimeOffset?)m.CelebratedUpTo)
            .FirstOrDefaultAsync(ct);

        var since = mark ?? DateTimeOffset.MinValue;

        return await db.Rewards
            .Where(r => r.DriverId == driverId && r.UnlockedAt > since)
            .OrderBy(r => r.UnlockedAt)
            .Select(r => new PendingReward(r.RewardCode, r.UnlockedAt))
            .ToListAsync(ct);
    }

    /// <summary>
    /// Las pistas con su escalon en curso.
    /// </summary>
    /// <remarks>
    /// Se listan <b>todas las del catalogo</b>, incluso las que el camionero no
    /// empezo: una pista que todavia no aparece es justamente la que hay que
    /// mostrarle para que sepa que existe.
    /// </remarks>
    public async Task<IReadOnlyList<TrackView>> GetTracksAsync(
        Guid driverId,
        CancellationToken ct = default)
    {
        var counts = await db.TrackProgress
            .Where(t => t.DriverId == driverId)
            .ToDictionaryAsync(t => t.TrackCode, t => t.Count, ct);

        return
        [
            .. TrackCatalog.All.Select(track =>
            {
                counts.TryGetValue(track.Code, out var count);

                var reached = track.TiersReachedAt(count);

                // Terminada la pista no hay objetivo en curso: se repite el ultimo
                // para que la pantalla tenga algo que mostrar en vez de un cero.
                var current = reached < track.Tiers.Count
                    ? track.Tiers[reached].Goal
                    : track.Tiers[^1].Goal;

                return new TrackView(track.Code, count, reached, track.Tiers.Count, current);
            })
        ];
    }

    public async Task<IReadOnlyList<RecordView>> GetRecordsAsync(
        Guid driverId,
        CancellationToken ct = default) =>
        await db.Records
            .Where(r => r.DriverId == driverId)
            .OrderByDescending(r => r.AchievedAt)
            .Select(r => new RecordView(r.RecordCode, r.Value, r.AchievedAt))
            .ToListAsync(ct);

    public async Task<InventoryView> GetInventoryAsync(
        Guid driverId,
        CancellationToken ct = default)
    {
        var unlocked = await db.Rewards
            .Where(r => r.DriverId == driverId)
            .OrderBy(r => r.UnlockedAt)
            .Select(r => r.RewardCode)
            .ToListAsync(ct);

        var equipped = await db.Loadout
            .Where(l => l.DriverId == driverId)
            .Select(l => new { l.Slot, l.RewardCode })
            .ToListAsync(ct);

        return new InventoryView(
            unlocked,
            equipped.ToDictionary(e => e.Slot.ToString(), e => e.RewardCode));
    }

    /// <summary>
    /// Pone una recompensa en su ranura. Devuelve false si no la tiene.
    /// </summary>
    /// <remarks>
    /// <b>No se puede equipar lo que no se desbloqueo.</b> Es la unica regla del
    /// equipamiento y vive del lado del servidor: el cliente pide equipar, no decide
    /// que tiene. Es la misma logica que rige todo el motor.
    /// </remarks>
    public async Task<bool> EquipAsync(
        Guid driverId,
        LoadoutSlot slot,
        string rewardCode,
        CancellationToken ct = default)
    {
        var owned = await db.Rewards.AnyAsync(
            r => r.DriverId == driverId && r.RewardCode == rewardCode, ct);

        if (!owned)
        {
            return false;
        }

        var current = await db.Loadout.FirstOrDefaultAsync(
            l => l.DriverId == driverId && l.Slot == slot, ct);

        if (current is null)
        {
            db.Loadout.Add(new DriverLoadout
            {
                DriverId = driverId,
                Slot = slot,
                RewardCode = rewardCode
            });
        }
        else
        {
            current.RewardCode = rewardCode;
        }

        await db.SaveChangesAsync(ct);

        return true;
    }

    /// <summary>
    /// Corre la marca de "ya lo vi" hacia adelante.
    /// </summary>
    /// <remarks>
    /// <b>Nunca hacia atras.</b> Es la unica escritura que el cliente puede pedir y
    /// no otorga nada; dejarla retroceder permitiria pedir el mismo festejo dos
    /// veces.
    /// </remarks>
    public async Task MarkSeenAsync(Guid driverId, DateTimeOffset upTo, CancellationToken ct = default)
    {
        var mark = await db.ProgressMarks.FirstOrDefaultAsync(m => m.DriverId == driverId, ct);

        if (mark is null)
        {
            db.ProgressMarks.Add(new DriverProgressMark
            {
                DriverId = driverId,
                CelebratedUpTo = upTo
            });
        }
        else if (upTo > mark.CelebratedUpTo)
        {
            mark.CelebratedUpTo = upTo;
        }

        await db.SaveChangesAsync(ct);
    }
}
