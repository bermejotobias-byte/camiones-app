namespace TruckNavigator.Domain.Pois;

/// <summary>Cuantos dijeron apto y cuantos no.</summary>
public sealed record CommunityCount(int Suitable, int NotSuitable)
{
    public int Total => Suitable + NotSuitable;
}

/// <summary>
/// El sello de la comunidad sobre un lugar.
/// </summary>
/// <remarks>
/// Es una señal <b>aparte</b> del nivel verificado y nunca lo reemplaza (decision
/// del usuario del 15/09/2026): un lugar aportado llega como mucho a
/// <see cref="Recommended"/>, nunca a <c>Confirmed</c>; y un lugar verificado con
/// sello <see cref="Disputed"/> sigue verificado, con las dos cosas a la vista.
/// </remarks>
public enum CommunitySeal
{
    NoVotesYet = 0,
    Recommended = 1,
    Disputed = 2
}

/// <summary>
/// Que sello le corresponde a un conteo de votos.
/// </summary>
/// <remarks>
/// <para>
/// Funcion pura con umbrales fijos, para que "recomendado" signifique lo mismo en
/// la API y en la ficha, y para que cambiar el umbral sea cambiar un numero aca y
/// no buscarlo en tres lugares.
/// </para>
/// <para>
/// Tres votos es poco, y se sabe: es la señal minima para arrancar sin usuarios.
/// Se ajusta con datos, igual que el tope de EXP por votar que hoy no existe.
/// </para>
/// </remarks>
public static class CommunityStanding
{
    /// <summary>
    /// Menos que esto, el sello no dice nada: para recomendar hacen falta tantos
    /// votos <b>apto</b>; para marcar en discusion, tantos votos en total.
    /// </summary>
    public const int MinimumVotes = 3;

    /// <summary>Cuantos aptos por cada no apto hacen falta para recomendar.</summary>
    public const int ApprovalRatio = 2;

    public static CommunitySeal SealFor(CommunityCount count)
    {
        if (count.Total >= MinimumVotes && count.NotSuitable >= count.Suitable)
        {
            return CommunitySeal.Disputed;
        }

        // Entre "los no aptos igualan" y "el doble de aptos" el sello calla: 5 a 3
        // no es una recomendacion, es una discusion que todavia no se dio. Y dos
        // aptos contra uno tampoco alcanzan: la regla pide tres aptos, no tres votos.
        return count.Suitable >= MinimumVotes && count.Suitable >= ApprovalRatio * count.NotSuitable
            ? CommunitySeal.Recommended
            : CommunitySeal.NoVotesYet;
    }
}
