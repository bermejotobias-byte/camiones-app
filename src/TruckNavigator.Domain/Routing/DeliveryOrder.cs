namespace TruckNavigator.Domain.Routing;

/// <summary>
/// En que orden conviene visitar las paradas de un reparto.
/// </summary>
/// <remarks>
/// <para>
/// Es el problema del viajante, acotado a lo que hace un camion de reparto en un
/// dia: <b>hasta diez paradas, con el origen fijo y sin obligacion de volver</b>.
/// A esa escala no hace falta nada sofisticado, pero tampoco alcanza con visitar
/// siempre la mas cercana.
/// </para>
/// <para>
/// El codigo es puro —entran numeros y sale un orden— para poder probarlo con
/// casos armados en vez de contra el motor de ruteo.
/// </para>
/// </remarks>
public static class DeliveryOrder
{
    /// <summary>
    /// Cuantas paradas admite un reparto.
    /// </summary>
    /// <remarks>
    /// Diez, que es lo que pidio el brainstorm. El limite no es del algoritmo
    /// —2-opt sobre diez puntos es instantaneo— sino de lo que cuesta armar la
    /// matriz: son N x (N-1) consultas al motor de ruteo, o sea 90 para diez
    /// paradas y 380 para veinte.
    /// </remarks>
    public const int MaxStops = 10;

    /// <summary>
    /// Ordena las paradas para que el recorrido total sea lo mas corto posible.
    /// </summary>
    /// <param name="cost">
    /// Matriz cuadrada de costos: <c>cost[i][j]</c> es lo que cuesta ir de la
    /// parada <c>i</c> a la <c>j</c>. El indice 0 es el origen.
    ///
    /// <b>Tiene que ser costo REAL de ruta, no distancia en linea recta.</b> En
    /// una ciudad con un rio, autopistas y calles de un solo sentido, la ruta
    /// real llega a ser 1,67 veces la recta —medido en CABA— y ahi el orden que
    /// sale de la linea recta deja de ser el mejor. Ademas la matriz no tiene por
    /// que ser simetrica: ir y volver entre dos puntos puede costar distinto.
    /// </param>
    /// <returns>
    /// Los indices en el orden de visita, empezando por 0. Nunca es null y
    /// siempre contiene todos los indices exactamente una vez.
    /// </returns>
    public static IReadOnlyList<int> Solve(double[][] cost)
    {
        ArgumentNullException.ThrowIfNull(cost);

        var n = cost.Length;

        if (n <= 2)
        {
            // Con una o dos paradas no hay nada que ordenar.
            return Enumerable.Range(0, n).ToArray();
        }

        var order = NearestNeighbour(cost, n);

        ImproveWithTwoOpt(cost, order);

        return order;
    }

    /// <summary>
    /// Punto de partida: desde donde estoy, ir siempre a la parada mas cercana.
    /// </summary>
    /// <remarks>
    /// Es una heuristica pobre por si sola —se come las paradas cercanas primero
    /// y despues tiene que cruzar la ciudad— pero da un recorrido razonable en un
    /// paso, y 2-opt se encarga de arreglar justamente esos cruces.
    /// </remarks>
    private static int[] NearestNeighbour(double[][] cost, int n)
    {
        var visited = new bool[n];
        var order = new int[n];

        order[0] = 0;
        visited[0] = true;

        for (var step = 1; step < n; step++)
        {
            var from = order[step - 1];
            var best = -1;
            var bestCost = double.PositiveInfinity;

            for (var candidate = 0; candidate < n; candidate++)
            {
                if (visited[candidate] || cost[from][candidate] >= bestCost)
                {
                    continue;
                }

                best = candidate;
                bestCost = cost[from][candidate];
            }

            // Si ninguna parada es alcanzable —matriz con infinitos—, se toma la
            // primera sin visitar. Devolver un orden incompleto seria peor: la
            // app perderia paradas sin decirlo.
            if (best < 0)
            {
                best = Array.FindIndex(visited, v => !v);
            }

            order[step] = best;
            visited[best] = true;
        }

        return order;
    }

    /// <summary>
    /// Da vuelta tramos del recorrido mientras eso lo acorte.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Es lo que deshace los cruces que deja el vecino mas cercano: si el camino
    /// se cruza consigo mismo, invertir el tramo del medio siempre lo acorta.
    /// </para>
    /// <para>
    /// <b>El origen no se mueve</b> —el camion arranca donde esta— y por eso el
    /// barrido empieza en 1.
    /// </para>
    /// </remarks>
    private static void ImproveWithTwoOpt(double[][] cost, int[] order)
    {
        var n = order.Length;

        // Tope de vueltas. Con diez paradas converge en dos o tres, pero una
        // matriz con valores raros —ceros, infinitos, NaN— podria hacerlo oscilar,
        // y un GPS que se cuelga calculando un reparto es peor que uno que da una
        // vuelta de mas.
        const int MaxPasses = 50;

        for (var pass = 0; pass < MaxPasses; pass++)
        {
            var improved = false;

            for (var i = 1; i < n - 1; i++)
            {
                for (var j = i + 1; j < n; j++)
                {
                    if (Gain(cost, order, i, j) <= Epsilon)
                    {
                        continue;
                    }

                    Array.Reverse(order, i, j - i + 1);
                    improved = true;
                }
            }

            if (!improved)
            {
                return;
            }
        }
    }

    /// <summary>
    /// Cuanto se ahorra al dar vuelta el tramo entre <paramref name="i"/> y
    /// <paramref name="j"/>.
    /// </summary>
    /// <remarks>
    /// Se comparan solo las dos aristas que cambian y no el largo total: el
    /// interior del tramo se recorre igual, nada mas que al reves. Con matriz
    /// simetrica eso es exacto y evita recorrer el arreglo entero en cada prueba.
    /// </remarks>
    private static double Gain(double[][] cost, int[] order, int i, int j)
    {
        var beforeStart = order[i - 1];
        var start = order[i];
        var end = order[j];

        // Sin arista de salida —el tramo termina el recorrido— solo cambia la
        // entrada.
        if (j == order.Length - 1)
        {
            return cost[beforeStart][start] - cost[beforeStart][end];
        }

        var afterEnd = order[j + 1];

        var actual = cost[beforeStart][start] + cost[end][afterEnd];
        var invertido = cost[beforeStart][end] + cost[start][afterEnd];

        return actual - invertido;
    }

    /// <summary>
    /// Ahorro minimo para aceptar un cambio, en metros.
    /// </summary>
    /// <remarks>
    /// Sin este piso, la aritmetica de punto flotante puede encontrar mejoras de
    /// una millonesima de metro para siempre y el bucle no termina nunca.
    /// </remarks>
    private const double Epsilon = 0.5;

    /// <summary>Cuanto mide un recorrido, para poder compararlos.</summary>
    public static double TotalCost(double[][] cost, IReadOnlyList<int> order)
    {
        ArgumentNullException.ThrowIfNull(cost);
        ArgumentNullException.ThrowIfNull(order);

        var total = 0d;

        for (var i = 1; i < order.Count; i++)
        {
            total += cost[order[i - 1]][order[i]];
        }

        return total;
    }
}
