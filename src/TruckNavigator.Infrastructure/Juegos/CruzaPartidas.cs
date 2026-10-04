using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Juegos;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Juegos;

/// <summary>
/// Registra una partida de Cruza, Mono y mejora el record del camionero.
/// </summary>
/// <remarks>
/// <para>
/// Es el segundo record de la tabla de records personales (<see cref="DriverRecord"/>),
/// con su propio codigo, y usa la misma regla que todos:
/// <see cref="PersonalRecords.Improve"/>, donde igualar no es superar y el empate no
/// mueve la fecha. El resultado es el mismo <see cref="ResultadoDePartida"/> de la
/// Viborita.
/// </para>
/// <para>
/// Una partida de cero puntos no es record: si no, perder en el primer paso festejaria
/// un "nuevo record" de cero.
/// </para>
/// </remarks>
public sealed class CruzaPartidas(AppDbContext db)
{
    /// <summary>El resultado, o <c>null</c> si la partida no pudo existir.</summary>
    public async Task<ResultadoDePartida?> RegistrarAsync(
        Guid driverId,
        int filas,
        int cajas,
        long duracionMs,
        DateTimeOffset cuando,
        CancellationToken ct = default)
    {
        if (!Cruza.EsPosible(filas, cajas, duracionMs))
        {
            return null;
        }

        var puntos = Cruza.Puntos(filas, cajas);

        var guardado = await db.Records.SingleOrDefaultAsync(
            r => r.DriverId == driverId && r.RecordCode == Cruza.RecordCode, ct);

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
            guardado = new DriverRecord { DriverId = driverId, RecordCode = Cruza.RecordCode };
            db.Records.Add(guardado);
        }

        guardado.Value = nuevo.Value;
        guardado.AchievedAt = nuevo.AchievedAt;
        await db.SaveChangesAsync(ct);

        return new ResultadoDePartida(puntos, nuevo, NuevoRecord: true);
    }
}
