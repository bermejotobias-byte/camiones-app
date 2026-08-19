using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Restrictions;

/// <summary>
/// Decide si un tramo de via es compatible con un vehiculo en un momento dado.
/// </summary>
/// <remarks>
/// Este componente no calcula rutas. Las restricciones entran al calculo a
/// traves de <see cref="Routing.ITruckRoutingPolicy"/>, que traduce el mismo
/// conjunto de reglas al custom model del motor de ruteo. Este evaluador se usa
/// para explicarle al usuario por que una restriccion aplica y para verificar
/// en los tests que la ruta devuelta efectivamente las respeta.
/// </remarks>
public interface IRestrictionEvaluator
{
    RestrictionVerdict Evaluate(
        RoadSegmentAttributes segment,
        TruckProfile truck,
        DateTimeOffset when);
}
