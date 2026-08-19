using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Domain.Pois;

/// <summary>
/// Decide si un punto sirve para un camion concreto.
/// </summary>
/// <remarks>
/// Vive en el dominio y sin dependencias para que la misma regla la use el filtro de
/// la API y el cartel de la ficha en la app, en lugar de reimplementarse en cada
/// lado. Es el mismo criterio que separa <c>CabaTruckRoutingPolicy</c> de
/// <c>CabaRestrictionEvaluator</c>: la regla se escribe una vez.
/// </remarks>
public static class PoiSuitability
{
    /// <summary>
    /// Campo de aptitud que corresponde consultar para este vehiculo.
    /// </summary>
    /// <remarks>
    /// El umbral de peso se toma de
    /// <see cref="CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg"/> para que el
    /// numero siga viviendo en un solo lugar, junto a su cita normativa.
    /// </remarks>
    public static PoiSuitabilityField FieldFor(TruckProfile truck) => truck switch
    {
        { VehicleType: VehicleType.SemiTrailer } => PoiSuitabilityField.SemiTrailer,
        { VehicleType: VehicleType.TruckWithTrailer } => PoiSuitabilityField.Trailer,
        { GrossWeightKg: > CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg }
            => PoiSuitabilityField.HeavyTruck,
        _ => PoiSuitabilityField.LightTruck
    };

    /// <summary>
    /// <c>true</c> apto, <c>false</c> no apto, <c>null</c> la fuente no lo dice.
    /// </summary>
    /// <remarks>
    /// Devolver <c>bool?</c> es intencional: quien filtra decide que hacer con lo
    /// desconocido. Si esto devolviera <c>bool</c>, la falta de dato se convertiria
    /// silenciosamente en "no apto".
    /// </remarks>
    public static bool? Accepts(PointOfInterest poi, TruckProfile truck) =>
        FieldFor(truck) switch
        {
            PoiSuitabilityField.SemiTrailer => poi.SuitableForSemiTrailer,
            PoiSuitabilityField.Trailer => poi.SuitableForTrailer,
            PoiSuitabilityField.HeavyTruck => poi.SuitableForHeavyTruck,
            _ => poi.SuitableForLightTruck
        };
}

/// <summary>
/// Cual de los cuatro campos de aptitud aplica a un vehiculo.
/// </summary>
public enum PoiSuitabilityField
{
    LightTruck = 0,
    HeavyTruck = 1,
    SemiTrailer = 2,
    Trailer = 3
}
