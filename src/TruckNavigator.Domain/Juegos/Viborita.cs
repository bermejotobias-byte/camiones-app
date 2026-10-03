namespace TruckNavigator.Domain.Juegos;

/// <summary>
/// Las reglas de la Viborita TBF que le importan al servidor: cuanto vale una partida
/// y cuales son posibles.
/// </summary>
/// <remarks>
/// <para>
/// El servidor calcula los puntos a partir de las cajas: no los recibe. Asi el numero
/// que se guarda como record no lo inventa el telefono.
/// </para>
/// <para>
/// Rechazar lo imposible no defiende contra un tramposo decidido —el telefono igual
/// informa las cajas— pero descarta lo absurdo y deja el record en numeros posibles.
/// Los mismos numeros viven en el cliente (js/juegos/viborita/reglas.js).
/// </para>
/// </remarks>
public static class Viborita
{
    /// <summary>El codigo del record en la tabla de records personales.</summary>
    public const string RecordCode = "viborita";

    public const int Columnas = 10;
    public const int Filas = 10;

    /// <summary>La cabina arranca con dos acoplados: tres celdas ocupadas.</summary>
    public const int AcopladosAlArrancar = 2;

    /// <summary>Con el campo lleno no queda lugar para otra caja: 100 - 3.</summary>
    public const int CajasMaximas = Columnas * Filas - (AcopladosAlArrancar + 1);

    /// <summary>El paso mas rapido del juego, en milisegundos.</summary>
    public const int PasoMasRapidoMs = 140;

    /// <summary>
    /// La caja vale tantos puntos como acoplados lleva el camion despues de
    /// levantarla: la primera 3, la segunda 4. Con n cajas: 2n + n(n+1)/2.
    /// </summary>
    public static long Puntos(int cajas) =>
        cajas <= 0 ? 0 : (long)AcopladosAlArrancar * cajas + (long)cajas * (cajas + 1) / 2;

    /// <summary>
    /// Si una partida asi pudo existir: no mas cajas de las que entran en el campo,
    /// y cada caja necesita al menos un paso a la velocidad maxima.
    /// </summary>
    public static bool EsPosible(int cajas, long duracionMs) =>
        cajas is >= 0 and <= CajasMaximas
        && duracionMs >= 0
        && duracionMs >= (long)cajas * PasoMasRapidoMs;
}
