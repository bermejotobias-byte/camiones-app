using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Juegos;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Juegos;

/// <summary>Lo que devuelve una partida: sus puntos y como quedo el record.</summary>
public sealed record ResultadoDePartida(long Puntos, RecordStanding? Record, bool NuevoRecord);

/// <summary>
/// Registra una partida de la Viborita TBF y mejora el record del camionero.
/// </summary>
/// <remarks>
/// <para>
/// Es el primer record que se escribe en la tabla de records personales
/// (<see cref="DriverRecord"/>). Usa la misma regla que todos:
/// <see cref="PersonalRecords.Improve"/>, donde igualar no es superar y el empate no
/// mueve la fecha.
/// </para>
/// <para>
/// Una partida sin cajas no es record: si no, la primera partida perdida en el primer
/// paso festejaria un "nuevo record" de cero.
/// </para>
/// </remarks>
public sealed class ViboritaPartidas(AppDbContext db)
{
    /// <summary>El resultado, o <c>null</c> si la partida no pudo existir.</summary>
    public async Task<ResultadoDePartida?> RegistrarAsync(
        Guid driverId,
        int cajas,
        long duracionMs,
        DateTimeOffset cuando,
        CancellationToken ct = default)
    {
        if (!Viborita.EsPosible(cajas, duracionMs))
        {
            return null;
        }

        var puntos = Viborita.Puntos(cajas);

        var guardado = await db.Records.SingleOrDefaultAsync(
            r => r.DriverId == driverId && r.RecordCode == Viborita.RecordCode, ct);

        RecordStanding? vigente = guardado is null
            ? null
            : new RecordStanding(guardado.Value, guardado.AchievedAt);

        var mejor = puntos > 0 ? PersonalRecords.Improve(vigente, puntos, cuando) : null;

        if (mejor is not { } nuevo)
        {
            return new ResultadoDePartida(puntos, vigente, NuevoRecord: false);
        }

        if (guardado is null)
        {
            guardado = new DriverRecord { DriverId = driverId, RecordCode = Viborita.RecordCode };
            db.Records.Add(guardado);
        }

        guardado.Value = nuevo.Value;
        guardado.AchievedAt = nuevo.AchievedAt;
        await db.SaveChangesAsync(ct);

        return new ResultadoDePartida(puntos, nuevo, NuevoRecord: true);
    }
}
