using TruckNavigator.Domain.Routing;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El orden de las paradas de un reparto.
/// </summary>
/// <remarks>
/// Las dos formas de romper esto son caras y silenciosas: <b>perder una parada</b>
/// —el camion vuelve al deposito con un bulto y nadie se entera hasta el final del
/// dia— y <b>devolver un orden peor que el de entrada</b>, que no se nota porque
/// la ruta se calcula y se dibuja igual.
///
/// Por eso casi todos estos tests verifican invariantes, no un orden concreto:
/// una heuristica puede cambiar de resultado con una mejora legitima, pero nunca
/// puede perder paradas ni empeorar el recorrido.
/// </remarks>
public class DeliveryOrderTests
{
    /// <summary>Matriz de costos a partir de puntos en un plano, en metros.</summary>
    private static double[][] Matriz(params (double X, double Y)[] puntos)
    {
        var n = puntos.Length;
        var cost = new double[n][];

        for (var i = 0; i < n; i++)
        {
            cost[i] = new double[n];
            for (var j = 0; j < n; j++)
            {
                cost[i][j] = Math.Sqrt(
                    Math.Pow(puntos[i].X - puntos[j].X, 2) +
                    Math.Pow(puntos[i].Y - puntos[j].Y, 2));
            }
        }

        return cost;
    }

    /* ----------------------------------------------------------------------
       Invariantes: lo que no puede fallar nunca
    ---------------------------------------------------------------------- */

    [Fact]
    public void No_se_pierde_ninguna_parada()
    {
        var cost = Matriz((0, 0), (10, 0), (10, 10), (0, 10), (5, 5), (20, 3));

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(6, orden.Count);
        Assert.Equal(Enumerable.Range(0, 6), orden.OrderBy(i => i));
    }

    [Fact]
    public void El_origen_va_primero()
    {
        // El camion arranca donde esta: reordenar eso no tiene sentido.
        var cost = Matriz((0, 0), (100, 0), (1, 1), (2, 2));

        Assert.Equal(0, DeliveryOrder.Solve(cost)[0]);
    }

    [Fact]
    public void Ninguna_parada_se_repite()
    {
        var cost = Matriz((0, 0), (5, 5), (5, 5), (5, 5), (1, 9));

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(orden.Count, orden.Distinct().Count());
    }

    /* ----------------------------------------------------------------------
       Que el orden sea bueno, no solo valido
    ---------------------------------------------------------------------- */

    [Fact]
    public void Cuatro_paradas_en_cuadrado_se_recorren_sin_cruzar()
    {
        // El costo minimo de un cuadrado de lado 10, sin volver al origen, es 30.
        // Cualquier recorrido que cruce por la diagonal pasa de 34.
        var cost = Matriz((0, 0), (10, 0), (10, 10), (0, 10));

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(30, DeliveryOrder.TotalCost(cost, orden), 1);
    }

    [Fact]
    public void Deshace_el_cruce_que_deja_el_vecino_mas_cercano()
    {
        // Caso armado para que "ir siempre al mas cercano" se equivoque: desde el
        // origen, la parada 1 queda cerca, pero tomarla primero obliga a volver
        // sobre los pasos.
        var cost = Matriz((0, 0), (1, 10), (0, 20), (1, 30), (0, 40));

        var orden = DeliveryOrder.Solve(cost);
        var recorrido = DeliveryOrder.TotalCost(cost, orden);

        // El orden natural —de abajo hacia arriba— es el mejor y mide poco mas de
        // 40. Cualquier zigzag se va por encima de 45.
        Assert.True(recorrido < 45, $"el recorrido dio {recorrido:N1} y deberia rondar 40");
    }

    [Fact]
    public void Nunca_devuelve_un_recorrido_peor_que_el_orden_de_entrada()
    {
        // Es la garantia que importa: 2-opt solo acepta cambios que acortan, asi
        // que el resultado no puede ser peor que el punto de partida.
        var cost = Matriz((0, 0), (30, 1), (10, 0), (20, 1), (40, 0), (5, 8));

        var entrada = Enumerable.Range(0, 6).ToArray();
        var salida = DeliveryOrder.Solve(cost);

        Assert.True(
            DeliveryOrder.TotalCost(cost, salida) <= DeliveryOrder.TotalCost(cost, entrada) + 0.5,
            "el orden calculado no puede recorrer mas que el orden en que llegaron las paradas");
    }

    [Fact]
    public void Aprovecha_una_matriz_asimetrica()
    {
        // Ir y volver puede costar distinto: calles de un solo sentido, una
        // autopista que solo tiene bajada de un lado. La matriz no tiene por que
        // ser simetrica y el algoritmo no debe suponerlo.
        var cost = new[]
        {
            new[] {  0d,  10d, 100d },
            new[] { 100d,   0d,  10d },
            new[] {  10d, 100d,   0d }
        };

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(new[] { 0, 1, 2 }, orden);
        Assert.Equal(20, DeliveryOrder.TotalCost(cost, orden), 1);
    }

    /* ----------------------------------------------------------------------
       Bordes
    ---------------------------------------------------------------------- */

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void Con_pocas_paradas_no_hay_nada_que_ordenar(int cantidad)
    {
        var puntos = Enumerable.Range(0, cantidad).Select(i => ((double)i, 0d)).ToArray();
        var cost = Matriz(puntos);

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(Enumerable.Range(0, cantidad), orden);
    }

    [Fact]
    public void Una_matriz_con_paradas_inalcanzables_no_pierde_ninguna()
    {
        // Infinito es "no hay ruta". Puede pasar: una parada del otro lado de un
        // corte, o mal geocodificada. Igual tiene que aparecer en el orden —el
        // usuario la cargo— y la app decidira que hacer con ella.
        var cost = new[]
        {
            new[] { 0d, double.PositiveInfinity, 10d },
            new[] { double.PositiveInfinity, 0d, double.PositiveInfinity },
            new[] { 10d, double.PositiveInfinity, 0d }
        };

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(3, orden.Count);
        Assert.Equal(new[] { 0, 1, 2 }, orden.OrderBy(i => i));
    }

    [Fact]
    public void Termina_aunque_la_matriz_este_toda_en_cero()
    {
        // Todo empata, asi que ninguna vuelta mejora nada. Sin el piso de mejora,
        // el ruido del punto flotante podria hacerlo girar para siempre.
        var n = 8;
        var cost = Enumerable.Range(0, n).Select(_ => new double[n]).ToArray();

        var orden = DeliveryOrder.Solve(cost);

        Assert.Equal(n, orden.Count);
    }

    [Fact]
    public void El_tope_de_paradas_es_diez()
    {
        // Se fija el numero: no lo limita el algoritmo sino el costo de armar la
        // matriz, que son N x (N-1) consultas al motor de ruteo.
        Assert.Equal(10, DeliveryOrder.MaxStops);
    }

    [Fact]
    public void Rechaza_una_matriz_nula()
    {
        Assert.Throws<ArgumentNullException>(() => DeliveryOrder.Solve(null!));
    }
}
