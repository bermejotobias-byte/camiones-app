namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Lo que un viaje le dejo al camionero al cerrarse.
/// </summary>
/// <remarks>
/// <para>
/// Existe para la pantalla de fin de viaje: las estadisticas, la EXP ganada y lo
/// desbloqueado (decision del usuario del 10/09/2026). Hasta que existio, el
/// motor acreditaba en silencio y el camionero cerraba el viaje sin ver nada.
/// </para>
/// <para>
/// El nivel va <b>antes y despues</b>, y no solo el de despues: subir de nivel
/// es el momento mas grande del sistema y la pantalla tiene que poder
/// distinguirlo de un viaje comun. Se compara <see cref="LevelStanding.Number"/>.
/// </para>
/// </remarks>
public sealed record TripEarnings(
    int TripExperience,
    int TierExperience,
    IReadOnlyList<CompletedTier> CompletedTiers,
    LevelStanding LevelBefore,
    LevelStanding LevelAfter)
{
    public int TotalExperience => TripExperience + TierExperience;

    public bool LeveledUp => LevelAfter.Number > LevelBefore.Number;
}
