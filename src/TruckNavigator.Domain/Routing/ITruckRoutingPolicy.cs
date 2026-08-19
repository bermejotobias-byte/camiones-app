using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Routing;

/// <summary>
/// Traduce las caracteristicas de un camion al custom model que consume el motor
/// de ruteo.
/// </summary>
/// <remarks>
/// Es la pieza que hace que la restriccion forme parte del <b>calculo</b> de la
/// ruta y no de un filtro posterior: los tramos incompatibles reciben prioridad
/// cero antes de que el algoritmo elija por donde ir, asi que nunca llegan a
/// formar parte de una ruta candidata.
/// </remarks>
public interface ITruckRoutingPolicy
{
    CustomModel BuildCustomModel(TruckProfile truck, DateTimeOffset when);
}
