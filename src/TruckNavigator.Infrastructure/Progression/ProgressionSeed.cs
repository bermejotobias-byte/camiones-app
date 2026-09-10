using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.Infrastructure.Progression;

/// <summary>
/// Acredita la progresion de los viajes que se cerraron antes de que el motor
/// existiera.
/// </summary>
/// <remarks>
/// <para>
/// Sin esto, alguien con 9.480 km ya recorridos pasaria a Novato el dia que se
/// despliega la gamificacion. El perfil ya mostraba un nivel derivado de esos
/// kilometros: arrancar en cero seria una regresion visible.
/// </para>
/// <para>
/// <b>Lo delicado no es acreditar, es no festejar.</b> Al sembrar se pone la marca
/// de "ya lo vio" en ese momento, asi que todo lo sembrado queda del lado de lo
/// visto: aparece conseguido en el perfil —como corresponde a algo que la persona
/// efectivamente hizo— sin dispararle veinte celebraciones al abrir la app.
/// </para>
/// </remarks>
public static class ProgressionSeed
{
    public static async Task RunAsync(
        AppDbContext db,
        ProgressionRecorder recorder,
        DateTimeOffset now,
        CancellationToken ct = default)
    {
        // Solo los camioneros con historial y SIN un solo asiento. Ese es el corte
        // exacto de "tiene viajes de antes del motor".
        //
        // Uno que cierre su primer viaje con el motor ya andando queda con asientos
        // en el acto, asi que nunca entra aca: si entrara, la marca se le pondria en
        // hoy y se comeria festejos que todavia no vio.
        var alreadyCredited = await db.LedgerEntries
            .Select(entry => entry.DriverId)
            .Distinct()
            .ToListAsync(ct);

        var pending = await db.Trips
            .Where(trip => trip.Status == TripStatus.Completed
                           && !alreadyCredited.Contains(trip.DriverId))
            .Select(trip => trip.DriverId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var driverId in pending)
        {
            var history = await db.Trips
                .Where(trip => trip.DriverId == driverId && trip.Status == TripStatus.Completed)
                .OrderBy(trip => trip.FinishedAt)
                .ToListAsync(ct);

            foreach (var trip in history)
            {
                // La fecha del asiento es la del viaje original, no la de hoy: el
                // libro tiene que poder contar cuando paso cada cosa.
                await recorder.RecordAsync(trip, trip.FinishedAt ?? trip.StartedAt, ct);
            }

            if (!await db.ProgressMarks.AnyAsync(mark => mark.DriverId == driverId, ct))
            {
                db.ProgressMarks.Add(new DriverProgressMark
                {
                    DriverId = driverId,
                    CelebratedUpTo = now
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
