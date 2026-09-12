namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Las pistas que existen y sus escalones.
/// </summary>
/// <remarks>
/// <para>
/// Vive en el dominio y no en la base a proposito: agregar una pista —cuando
/// existan los reportes, o las trivias— es una entrada mas aca, sin migracion.
/// </para>
/// <para>
/// <b>Cada escalera tiene su propio ritmo porque cada actividad tiene el suyo.</b>
/// Antes las tres compartian la misma forma y eso las dejaba mal calibradas en
/// direcciones opuestas: repartos se agotaba en cuatro meses y nocturnos tardaba
/// mas de seis años. La misma escala para actividades de cadencia distinta no es
/// coherencia, es no haber mirado.
/// </para>
/// </remarks>
public static class TrackCatalog
{
    /// <summary>Codigo de la pista de la que se lee el nivel.</summary>
    public const string Mileage = "kilometraje";

    private static readonly Dictionary<string, Track> ByCode = Build();

    public static IReadOnlyList<Track> All { get; } = [.. ByCode.Values];

    public static Track Get(string code) => ByCode.TryGetValue(code, out var track)
        ? track
        : throw new KeyNotFoundException($"No existe la pista '{code}'.");

    private static Dictionary<string, Track> Build()
    {
        // El codigo de recompensa es sistematico —pista y escalon— y no describe el
        // objeto: los objetos todavia no estan disenados, y el usuario pidio no
        // aproximar nada visual antes de tener las referencias. Cuando existan, el
        // catalogo de objetos mapea este codigo a su dibujo y su ranura; el codigo
        // no cambia.
        //
        // Ademas garantiza por construccion la invariante que mas duele: ninguna
        // recompensa la entregan dos escalones distintos.
        static Track Make(string code, IReadOnlyList<long> goals) => new(
            code,
            [.. goals.Select((goal, index) => new TrackTier(goal, $"{code}-{index + 1:D2}"))]);

        var tracks = new[]
        {
            // La unica pista sin numeros propios: sale de la escala de niveles.
            Make(Mileage, LevelScale.GoalThresholds()),

            // Calibradas por el usuario el 10/09/2026 contra la cadencia real del
            // oficio: 2 viajes por dia, 5 repartos por dia, 1 nocturno por semana,
            // 250 dias de trabajo al año. El tope de cada una cae en dos a tres años
            // y medio de trabajo sostenido, y los primeros tres escalones en la
            // primera semana, que es donde esta el enganche.
            Make("viajes",    [1, 3, 7, 15, 30, 60, 120, 250, 500, 1_000]),
            Make("repartos",  [1, 5, 15, 40, 100, 250, 500, 1_000, 1_750, 2_500]),
            Make("nocturnos", [1, 2, 5, 10, 20, 35, 60, 90, 130, 180])
        };

        return tracks.ToDictionary(track => track.Code);
    }
}
