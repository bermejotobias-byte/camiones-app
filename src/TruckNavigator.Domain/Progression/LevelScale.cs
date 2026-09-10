namespace TruckNavigator.Domain.Progression;

/// <summary>Nivel alcanzado por un camionero, y por donde va dentro de el.</summary>
/// <param name="NextName">Nombre del nivel siguiente, o <c>null</c> en el ultimo.</param>
/// <param name="KilometersToNextLevel">Cuanto falta para subir. Cero en el ultimo.</param>
/// <param name="ProgressInLevel">De 0 a 1 dentro del nivel. Uno en el ultimo.</param>
public readonly record struct LevelStanding(
    int Number,
    string Name,
    int GoalInLevel,
    string? NextName,
    long KilometersToNextLevel,
    double ProgressInLevel);

/// <summary>
/// Traduce kilometros acreditados a nivel.
/// </summary>
/// <remarks>
/// <para>
/// El nivel depende <b>exclusivamente del kilometraje</b>. No lo mueven la EXP, ni
/// las trivias, ni los reportes: es lo que hace que "Rutero" signifique que la
/// persona manejo esos kilometros y no que jugo bien.
/// </para>
/// <para>
/// Los nombres salen del vocabulario del oficio. La escala vivia antes en el
/// cliente (<c>levelFor</c> en <c>store.js</c>), o sea en un lugar donde el usuario
/// podia cambiarla; por eso se mudo aca.
/// </para>
/// </remarks>
public static class LevelScale
{
    /// <summary>
    /// Donde arranca cada nivel, en kilometros acreditados.
    /// </summary>
    /// <remarks>
    /// Los cortes no son parejos a proposito: cada nivel se recorre en diez metas y
    /// la meta crece con el nivel. Con metas parejas, un camionero de larga
    /// distancia llegaria al techo en meses.
    /// </remarks>
    private static readonly (double StartsAt, string Name, double GoalKm)[] Levels =
    [
        (0,       "Novato",              250),
        (2_500,   "Repartidor",          600),
        (8_500,   "Fletero",           1_200),
        (20_500,  "Transportista",     2_500),
        (45_500,  "Rutero",            4_000),
        (85_500,  "Veterano",          6_500),
        (150_500, "Leyenda del asfalto", 10_000)
    ];

    /// <summary>Metas que hay que completar para pasar de nivel.</summary>
    public const int GoalsPerLevel = 10;

    /// <summary>
    /// Los kilometros a los que se completa cada meta, en orden.
    /// </summary>
    /// <remarks>
    /// Son los escalones de la pista de kilometraje, y salen de esta misma tabla en
    /// vez de escribirse aparte: duplicarlos seria pedir que alguna vez dejen de
    /// coincidir, y ahi el nivel y la meta empezarian a decir cosas distintas.
    /// </remarks>
    public static IReadOnlyList<long> GoalThresholds()
    {
        var thresholds = new List<long>(Levels.Length * GoalsPerLevel);

        foreach (var level in Levels)
        {
            for (var goal = 1; goal <= GoalsPerLevel; goal++)
            {
                thresholds.Add((long)(level.StartsAt + goal * level.GoalKm));
            }
        }

        return thresholds;
    }

    public static LevelStanding For(double kilometers)
    {
        // Un kilometraje negativo no deberia existir; si aparece por un dato
        // corrupto, vale mas devolver el primer nivel que un indice roto.
        var km = Math.Max(0, kilometers);

        var index = 0;

        while (index + 1 < Levels.Length && km >= Levels[index + 1].StartsAt)
        {
            index++;
        }

        var level = Levels[index];
        var into = km - level.StartsAt;

        // El ultimo nivel es el techo y se sigue sumando kilometros por encima:
        // sin este tope, quien lo termina veria "meta 35 de 10".
        var goal = Math.Min(GoalsPerLevel, (int)(into / level.GoalKm) + 1);

        var isLast = index + 1 >= Levels.Length;

        // En el ultimo nivel no hay siguiente: la barra se muestra llena en vez de
        // dividir por cero.
        var span = isLast ? 0 : Levels[index + 1].StartsAt - level.StartsAt;

        return new LevelStanding(
            index + 1,
            level.Name,
            goal,
            isLast ? null : Levels[index + 1].Name,
            isLast ? 0 : (long)Math.Max(0, Levels[index + 1].StartsAt - km),
            isLast ? 1 : Math.Min(1, into / span));
    }
}
