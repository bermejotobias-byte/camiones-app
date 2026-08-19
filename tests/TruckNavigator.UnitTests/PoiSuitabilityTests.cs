using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.UnitTests;

public class PoiSuitabilityTests
{
    /// <summary>
    /// Punto con un valor distinto en cada campo, para que el test falle si
    /// <see cref="PoiSuitability"/> consulta el campo equivocado.
    /// </summary>
    private static PointOfInterest Poi() => new()
    {
        Name = "Punto de prueba",
        Category = PoiCategory.FuelStation,
        Latitude = -34.60,
        Longitude = -58.40,
        Source = "Dato de prueba",
        SuitableForLightTruck = true,
        SuitableForHeavyTruck = false,
        SuitableForSemiTrailer = true,
        SuitableForTrailer = false
    };

    [Fact]
    public void A_light_truck_is_judged_by_the_light_truck_field()
    {
        Assert.Equal(PoiSuitabilityField.LightTruck, PoiSuitability.FieldFor(SampleTrucks.Light()));
        Assert.True(PoiSuitability.Accepts(Poi(), SampleTrucks.Light()));
    }

    [Fact]
    public void A_truck_over_the_threshold_is_judged_by_the_heavy_truck_field()
    {
        Assert.Equal(PoiSuitabilityField.HeavyTruck, PoiSuitability.FieldFor(SampleTrucks.Heavy()));
        Assert.False(PoiSuitability.Accepts(Poi(), SampleTrucks.Heavy()));
    }

    [Fact]
    public void A_semi_trailer_is_judged_by_the_semi_trailer_field()
    {
        Assert.Equal(
            PoiSuitabilityField.SemiTrailer,
            PoiSuitability.FieldFor(SampleTrucks.SemiTrailer()));

        Assert.True(PoiSuitability.Accepts(Poi(), SampleTrucks.SemiTrailer()));
    }

    [Fact]
    public void A_truck_with_a_trailer_is_judged_by_the_trailer_field()
    {
        var truck = SampleTrucks.Heavy();
        truck.VehicleType = VehicleType.TruckWithTrailer;
        truck.HasTrailer = true;
        truck.TrailerLengthMeters = 8.0;

        Assert.Equal(PoiSuitabilityField.Trailer, PoiSuitability.FieldFor(truck));
        Assert.False(PoiSuitability.Accepts(Poi(), truck));
    }

    /// <summary>
    /// El tipo de vehiculo manda sobre el peso: un semirremolque liviano se sigue
    /// evaluando como semirremolque, porque lo que limita es la maniobra, no la balanza.
    /// </summary>
    [Fact]
    public void The_vehicle_type_takes_precedence_over_the_weight()
    {
        var truck = SampleTrucks.SemiTrailer();
        truck.GrossWeightKg = 9_000;

        Assert.Equal(PoiSuitabilityField.SemiTrailer, PoiSuitability.FieldFor(truck));
    }

    /// <summary>
    /// Lo que la fuente no dice no se convierte en "no apto". Es la misma regla que
    /// impide inventar restricciones legales: la ausencia de dato es ausencia de dato.
    /// </summary>
    [Fact]
    public void An_undeclared_suitability_stays_unknown_instead_of_becoming_false()
    {
        var poi = Poi();
        poi.SuitableForLightTruck = null;
        poi.SuitableForHeavyTruck = null;
        poi.SuitableForSemiTrailer = null;
        poi.SuitableForTrailer = null;

        Assert.Null(PoiSuitability.Accepts(poi, SampleTrucks.Light()));
        Assert.Null(PoiSuitability.Accepts(poi, SampleTrucks.Heavy()));
        Assert.Null(PoiSuitability.Accepts(poi, SampleTrucks.SemiTrailer()));
    }

    /// <summary>
    /// El limite de la Red de Transito Pesado es el que decide entre liviano y pesado;
    /// si alguien cambia esa constante, este test lo acompana en vez de contradecirlo.
    /// </summary>
    [Fact]
    public void The_light_heavy_boundary_follows_the_heavy_network_threshold()
    {
        var atThreshold = SampleTrucks.Light();
        atThreshold.GrossWeightKg = Domain.Restrictions.CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg;

        var justOver = SampleTrucks.Light();
        justOver.GrossWeightKg = Domain.Restrictions.CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg + 1;

        Assert.Equal(PoiSuitabilityField.LightTruck, PoiSuitability.FieldFor(atThreshold));
        Assert.Equal(PoiSuitabilityField.HeavyTruck, PoiSuitability.FieldFor(justOver));
    }
}
