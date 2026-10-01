namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Un escalon de una pista: cuanto hay que juntar y que se gana al llegar.
/// </summary>
public sealed record TrackTier(long Goal, string RewardCode);

/// <summary>
/// Una familia de escalones sobre una misma actividad.
/// </summary>
/// <remarks>
/// <para>
/// Es la pieza que hace que <b>meta</b> y <b>logro</b> sean la misma cosa vista de
/// dos maneras: el escalon en curso es la meta —"Nocturnos 7/10"— y la pista
/// entera es el logro —"4 de 10 escalones"—.
/// </para>
/// <para>
/// Por eso agregar <c>reportar 25 controles</c> es una entrada mas en el catalogo
/// y no una funcionalidad nueva.
/// </para>
/// </remarks>
public sealed record Track(string Code, IReadOnlyList<TrackTier> Tiers)
{
    /// <summary>Cuantos escalones tiene completos alguien con ese acumulado.</summary>
    /// <remarks>
    /// Terminar la pista no la desborda: el resultado nunca supera la cantidad de
    /// escalones, asi que quien la completo sigue sumando sin romper la cuenta.
    /// </remarks>
    public int TiersReachedAt(long count)
    {
        var reached = 0;

        while (reached < Tiers.Count && count >= Tiers[reached].Goal)
        {
            reached++;
        }

        return reached;
    }
}
