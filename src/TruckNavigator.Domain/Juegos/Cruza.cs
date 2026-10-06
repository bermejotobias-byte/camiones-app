namespace TruckNavigator.Domain.Juegos;

/// <summary>
/// Las reglas de Cruza, Mono que le importan al servidor: cuanto vale una partida y
/// cuales son posibles.
/// </summary>
/// <remarks>
/// <para>
/// El servidor calcula los puntos a partir de las filas y las cajas: no los recibe.
/// Asi el numero que se guarda como record no lo inventa el telefono.
/// </para>
/// <para>
/// Rechazar lo imposible no defiende contra un tramposo decidido —el telefono igual
/// informa filas y cajas— pero descarta lo absurdo. Hay una caja por fila como
/// maximo, asi que no puede haber mas cajas que filas, y cada fila necesita al menos
/// un paso. Los mismos numeros viven en el cliente (js/juegos/cruza/reglas.js).
/// </para>
/// </remarks>
public static class Cruza
{
    /// <summary>El codigo del record en la tabla de records personales.</summary>
    public const string RecordCode = "cruza";

    public const int PuntosPorFila = 10;
    public const int PuntosPorCaja = 50;

    /// <summary>Lo que tarda un paso, en milisegundos.</summary>
    public const int PasoMs = 140;

    /// <summary>10 por la fila mas lejana y 50 por caja. Nada negativo suma.</summary>
    public static long Puntos(int filas, int cajas) =>
        (long)PuntosPorFila * Math.Max(0, filas) + (long)PuntosPorCaja * Math.Max(0, cajas);

    /// <summary>
    /// Si una partida asi pudo existir: nada negativo, no mas cajas que filas, y cada
    /// fila con al menos un paso.
    /// </summary>
    public static bool EsPosible(int filas, int cajas, long duracionMs) =>
        filas >= 0
        && cajas >= 0
        && cajas <= filas
        && duracionMs >= 0
        && (long)filas * PasoMs <= duracionMs;
}
