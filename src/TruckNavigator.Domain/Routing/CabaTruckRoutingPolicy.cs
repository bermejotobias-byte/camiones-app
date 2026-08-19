using System.Globalization;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Routing;

/// <summary>
/// Construye el custom model de GraphHopper para un camion concreto en CABA.
/// </summary>
/// <remarks>
/// <para>
/// Los limites fisicos se traducen a prioridad cero: GraphHopper descarta esos
/// tramos durante la busqueda, de modo que no pueden aparecer en la ruta.
/// </para>
/// <para>
/// La Red de Transito Pesado, en cambio, se modela como <b>penalizacion</b> y no
/// como bloqueo. La normativa habilita a salir de la Red para llegar al destino
/// y volver por el recorrido mas corto; con una penalizacion fuerte el
/// optimizador usa la Red para el grueso del viaje y solo la abandona en los
/// tramos de acceso a origen y destino, que es exactamente lo que la norma
/// permite. Bloquear los tramos fuera de la Red haria que la mayoria de los
/// destinos reales quedaran inalcanzables.
/// </para>
/// </remarks>
public sealed class CabaTruckRoutingPolicy : ITruckRoutingPolicy
{
    /// <summary>
    /// Factor de prioridad aplicado a los tramos fuera de la Red de Transito
    /// Pesado. Es agresivo a proposito: encarece el tramo unas 30 veces, asi que
    /// solo se usa cuando no queda alternativa, es decir, en el acceso a origen
    /// y destino.
    /// </summary>
    private const string OutsideHeavyNetworkPriority = "0.03";

    public CustomModel BuildCustomModel(TruckProfile truck, DateTimeOffset when)
    {
        ArgumentNullException.ThrowIfNull(truck);

        var priority = new List<CustomModelStatement>();

        // --- Limites fisicos de la via ---
        //
        // En GraphHopper el encoded value contiene el limite de la via, no la
        // medida del vehiculo. "max_height < 3.8" significa: el galibo del tramo
        // es menor que la altura del camion, por lo tanto no pasa.
        //
        // Las vias sin limite declarado toman un valor infinito, asi que la
        // comparacion las deja pasar sin necesidad de un caso especial.

        priority.Add(CustomModelStatement.Block(
            $"max_height < {Num(truck.HeightMeters)}"));

        priority.Add(CustomModelStatement.Block(
            $"max_width < {Num(truck.WidthMeters)}"));

        priority.Add(CustomModelStatement.Block(
            $"max_length < {Num(truck.TotalLengthMeters)}"));

        // max_weight_except cubre la cartelería del tipo "excepto reparto":
        // si la via declara una excepcion, el limite de peso no se aplica a
        // rajatabla y se deja que la evaluacion de acceso decida.
        priority.Add(CustomModelStatement.Block(
            $"max_weight < {Num(truck.GrossWeightTons)} && max_weight_except == MISSING"));

        // --- Red de Transito Pesado (Ley 2148, art. 9.10.1) ---
        //
        // La obligacion rige solo por encima del umbral de peso de la norma.
        // Para un camion liviano no se agrega ninguna regla de Red.
        if (truck.GrossWeightKg > CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg)
        {
            priority.Add(CustomModelStatement.Penalize(
                "hgv != DESIGNATED", OutsideHeavyNetworkPriority));
        }

        return new CustomModel
        {
            Priority = priority,
            Speed = []
        };
    }

    /// <summary>
    /// Formatea con punto decimal. Imprescindible: el servidor corre en una
    /// maquina con locale es-AR y una coma partiria la expresion de GraphHopper.
    /// </summary>
    private static string Num(double value) =>
        value.ToString("0.###", CultureInfo.InvariantCulture);
}
