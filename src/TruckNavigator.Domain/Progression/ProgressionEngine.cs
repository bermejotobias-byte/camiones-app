namespace TruckNavigator.Domain.Progression;

/// <summary>Un escalon que se acaba de completar, y lo que entrega.</summary>
public sealed record CompletedTier(string TrackCode, int Tier, string RewardCode);

/// <summary>Lo que cambio en la progresion a raiz de un hecho.</summary>
public sealed record ProgressionOutcome(IReadOnlyList<CompletedTier> CompletedTiers);

/// <summary>
/// Decide que escalones se completaron cuando las pistas avanzan.
/// </summary>
/// <remarks>
/// <para>
/// Es una <b>funcion pura</b>: recibe donde estaba cada pista y cuanto sumo, y
/// devuelve lo nuevo. No toca la base, no mira el reloj y no depende de nada del
/// entorno, asi que se testea con casos igual que el orden del reparto.
/// </para>
/// <para>
/// <b>El cliente nunca la invoca.</b> Todo lo que se gana ocurre como efecto de que
/// el servidor cierre un viaje, por el mismo motivo por el que los kilometros se
/// acreditan del lado del servidor: para que no se puedan falsificar.
/// </para>
/// </remarks>
public static class ProgressionEngine
{
    public static ProgressionOutcome Advance(
        IReadOnlyList<Track> catalog,
        IReadOnlyDictionary<string, long> countsBefore,
        IReadOnlyDictionary<string, long> increments)
    {
        var completed = new List<CompletedTier>();

        foreach (var track in catalog)
        {
            if (!increments.TryGetValue(track.Code, out var increment) || increment <= 0)
            {
                continue;
            }

            countsBefore.TryGetValue(track.Code, out var before);

            var reachedBefore = track.TiersReachedAt(before);
            var reachedAfter = track.TiersReachedAt(before + increment);

            // Un solo hecho puede cruzar mas de un escalon: un viaje largo puede
            // completar dos metas de kilometraje de una. Se reportan todas.
            for (var tier = reachedBefore + 1; tier <= reachedAfter; tier++)
            {
                completed.Add(new CompletedTier(
                    track.Code,
                    tier,
                    track.Tiers[tier - 1].RewardCode));
            }
        }

        return new ProgressionOutcome(completed);
    }
}
