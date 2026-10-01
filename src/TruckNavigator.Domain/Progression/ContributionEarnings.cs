namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Lo que un aporte a los lugares —un voto o un lugar nuevo— le dejo al camionero.
/// </summary>
/// <remarks>
/// La misma forma que <see cref="TripEarnings"/> sin el nivel: el nivel es de
/// kilometros y aportar no lo mueve. Existe para que la interfaz pueda festejar
/// el aporte igual que festeja un viaje.
/// </remarks>
public sealed record ContributionEarnings(
    int ContributionExperience,
    int TierExperience,
    IReadOnlyList<CompletedTier> CompletedTiers)
{
    public int TotalExperience => ContributionExperience + TierExperience;
}
