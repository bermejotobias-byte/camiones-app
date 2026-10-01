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

    /// <summary>
    /// Lo mismo, mas los bloqueos de la comunidad validados que le tocan a este
    /// camion: cada uno entra como un area con prioridad cero (spec de reportes,
    /// 19/09/2026). Un reporte solo, sin validar, nunca llega aca.
    /// </summary>
    CustomModel BuildCustomModel(TruckProfile truck, DateTimeOffset when, IReadOnlyList<RouteBlockade> blockades);
}
