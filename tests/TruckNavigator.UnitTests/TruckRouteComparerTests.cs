using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El orden de las rutas alternativas.
/// </summary>
/// <remarks>
/// <para>
/// El motor de ruteo devuelve las alternativas ordenadas por peso, que es
/// basicamente duracion. <b>Para un camion ese orden es el equivocado</b>: una
/// ruta dos minutos mas larga que no obliga a salir de la Red de Transito Pesado
/// es mejor que la mas rapida que si obliga — la primera se maneja tranquilo y
/// la segunda es una multa esperando.
/// </para>
/// <para>
/// Estos tests fijan ese criterio. Es facil de romper sin darse cuenta: alcanza
/// con reordenar dos comparaciones para que la app vuelva a recomendar por
/// tiempo, y desde afuera no se nota — la ruta se calcula igual y se dibuja
/// igual.
/// </para>
/// </remarks>
public class TruckRouteComparerTests
{
    private static readonly IReadOnlyList<GeoPoint> Geometria =
        [new GeoPoint(-34.60, -58.38), new GeoPoint(-34.61, -58.39)];

    /// <param name="bloqueos">Tramos por donde el camion NO puede circular.</param>
    /// <param name="accesos">Tramos que dependen de la excepcion de acceso.</param>
    private static TruckRoute Ruta(
        double segundos,
        int bloqueos = 0,
        int accesos = 0,
        double redPorCiento = 0)
    {
        RouteRestrictionNote Nota(bool acceso) => new(
            FromPointIndex: 0,
            ToPointIndex: 1,
            StreetName: "Calle",
            DistanceMeters: 100,
            RequiresAccessException: acceso,
            Findings: Array.Empty<RestrictionFinding>());

        return new TruckRoute(
            DistanceMeters: 1000,
            DurationSeconds: segundos,
            Geometry: Geometria,
            Instructions: Array.Empty<RouteInstruction>(),
            RestrictionNotes: Enumerable.Range(0, bloqueos).Select(_ => Nota(false)).ToList(),
            AccessLegs: Enumerable.Range(0, accesos).Select(_ => Nota(true)).ToList(),
            HeavyNetworkSharePercent: redPorCiento);
    }

    /// <summary>Ordena y devuelve la que quedaria recomendada.</summary>
    private static TruckRoute Mejor(params TruckRoute[] rutas) =>
        rutas.OrderBy(r => r, TruckRouteComparer.Instance).First();

    /* ----------------------------------------------------------------------
       Lo que no se puede transitar pesa mas que el reloj
    ---------------------------------------------------------------------- */

    [Fact]
    public void Una_ruta_sin_tramos_prohibidos_le_gana_a_una_mas_rapida_que_si_los_tiene()
    {
        var conBloqueo = Ruta(segundos: 600, bloqueos: 1);
        var limpiaPeroLenta = Ruta(segundos: 1800);

        Assert.Same(limpiaPeroLenta, Mejor(conBloqueo, limpiaPeroLenta));
    }

    [Fact]
    public void Entre_dos_con_tramos_prohibidos_gana_la_que_tiene_menos()
    {
        var tres = Ruta(segundos: 600, bloqueos: 3);
        var uno = Ruta(segundos: 900, bloqueos: 1);

        Assert.Same(uno, Mejor(tres, uno));
    }

    [Fact]
    public void Un_tramo_prohibido_pesa_mas_que_uno_de_acceso()
    {
        // Salir de la Red para llegar al destino es legal y se puede justificar;
        // circular por donde el vehiculo tiene prohibido, no.
        var prohibido = Ruta(segundos: 600, bloqueos: 1);
        var conAccesos = Ruta(segundos: 600, accesos: 4);

        Assert.Same(conAccesos, Mejor(prohibido, conAccesos));
    }

    [Fact]
    public void A_igualdad_de_bloqueos_gana_la_que_menos_depende_de_la_excepcion_de_acceso()
    {
        var muchos = Ruta(segundos: 600, accesos: 3);
        var pocos = Ruta(segundos: 900, accesos: 1);

        Assert.Same(pocos, Mejor(muchos, pocos));
    }

    /* ----------------------------------------------------------------------
       El reloj, y la Red cuando el reloj empata
    ---------------------------------------------------------------------- */

    [Fact]
    public void Sin_restricciones_de_por_medio_gana_la_mas_rapida()
    {
        var lenta = Ruta(segundos: 1800);
        var rapida = Ruta(segundos: 600);

        Assert.Same(rapida, Mejor(lenta, rapida));
    }

    [Fact]
    public void Entre_dos_que_tardan_practicamente_lo_mismo_gana_la_que_mas_usa_la_Red()
    {
        // 20 segundos de diferencia es ruido: una estimacion del motor que en la
        // calle desaparece en el primer semaforo.
        var porBarrio = Ruta(segundos: 600, redPorCiento: 0);
        var porLaRed = Ruta(segundos: 620, redPorCiento: 45);

        Assert.Same(porLaRed, Mejor(porBarrio, porLaRed));
    }

    [Fact]
    public void La_Red_no_alcanza_para_elegir_un_rodeo_largo()
    {
        // Cinco minutos de diferencia ya no es ruido. Si la Red pesara mas que
        // esto, la app mandaria a dar vueltas por ganar puntos de Red.
        var directa = Ruta(segundos: 600, redPorCiento: 0);
        var rodeoPorLaRed = Ruta(segundos: 900, redPorCiento: 90);

        Assert.Same(directa, Mejor(directa, rodeoPorLaRed));
    }

    [Fact]
    public void La_tolerancia_es_de_un_minuto()
    {
        // Se fija el numero: es el que decide cuando la Red puede desempatar, y
        // moverlo cambia en silencio que ruta se recomienda.
        Assert.Equal(60, TruckRouteComparer.EquivalentSeconds);
    }

    /* ----------------------------------------------------------------------
       Que el orden sea un orden
    ---------------------------------------------------------------------- */

    [Fact]
    public void Ordena_una_lista_completa_de_peor_a_mejor()
    {
        var pesima = Ruta(segundos: 300, bloqueos: 2);
        var conAccesos = Ruta(segundos: 700, accesos: 2);
        var buena = Ruta(segundos: 900);
        var buenaYporLaRed = Ruta(segundos: 930, redPorCiento: 60);

        var orden = new[] { pesima, buena, conAccesos, buenaYporLaRed }
            .OrderBy(r => r, TruckRouteComparer.Instance)
            .ToList();

        Assert.Same(buenaYporLaRed, orden[0]);
        Assert.Same(buena, orden[1]);
        Assert.Same(conAccesos, orden[2]);
        Assert.Same(pesima, orden[3]);
    }

    [Fact]
    public void Comparar_una_ruta_consigo_misma_da_empate()
    {
        var ruta = Ruta(segundos: 600, bloqueos: 1, accesos: 1, redPorCiento: 30);

        Assert.Equal(0, TruckRouteComparer.Instance.Compare(ruta, ruta));
    }

    [Fact]
    public void Los_nulos_van_al_final_y_no_rompen()
    {
        var ruta = Ruta(segundos: 600);

        Assert.True(TruckRouteComparer.Instance.Compare(null, ruta) > 0);
        Assert.True(TruckRouteComparer.Instance.Compare(ruta, null) < 0);
        Assert.Equal(0, TruckRouteComparer.Instance.Compare(null, null));
    }
}
