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
/// <b>Los objetivos de viajes, repartos y nocturnos son provisorios.</b> El usuario
/// todavia no los eligio; estan puestos para poder construir y medir. Cambiarlos no
/// toca nada mas, porque el libro permite recalcular.
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

            Make("viajes",    [1, 5, 10, 25, 50, 100, 200, 350, 500, 1_000]),
            Make("repartos",  [1, 3, 10, 25, 50, 100, 175, 275, 400, 600]),
            Make("nocturnos", [1, 5, 15, 30, 60, 100, 175, 275, 400, 600])
        };

        return tracks.ToDictionary(track => track.Code);
    }
}
