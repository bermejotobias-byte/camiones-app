using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Vehiculos usados en los tests. Los valores son de prueba y no representan
/// limites legales.
/// </summary>
internal static class SampleTrucks
{
    /// <summary>7.500 kg: por debajo del umbral de 12 t de la Red de Transito Pesado.</summary>
    public static TruckProfile Light() => new()
    {
        Name = "Camion liviano",
        GrossWeightKg = 7_500,
        HeightMeters = 3.20,
        WidthMeters = 2.40,
        LengthMeters = 8.00,
        NumberOfAxles = 2,
        VehicleType = VehicleType.RigidTruck,
        HasTrailer = false
    };

    /// <summary>18.000 kg: por encima del umbral, la Red le aplica.</summary>
    public static TruckProfile Heavy() => new()
    {
        Name = "Camion pesado",
        GrossWeightKg = 18_000,
        HeightMeters = 3.80,
        WidthMeters = 2.50,
        LengthMeters = 12.00,
        NumberOfAxles = 3,
        VehicleType = VehicleType.RigidTruck,
        HasTrailer = false
    };

    /// <summary>40.000 kg con semirremolque de 18 m totales.</summary>
    public static TruckProfile SemiTrailer() => new()
    {
        Name = "Semirremolque",
        GrossWeightKg = 40_000,
        HeightMeters = 4.20,
        WidthMeters = 2.55,
        LengthMeters = 6.00,
        NumberOfAxles = 5,
        VehicleType = VehicleType.SemiTrailer,
        HasTrailer = true,
        TrailerLengthMeters = 12.00
    };
}
