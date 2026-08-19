using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Routing;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Verifica el ruteo real contra GraphHopper con datos de OpenStreetMap de CABA.
/// </summary>
public class TruckRoutingTests
{
    // Retiro -> Mataderos: atraviesa la ciudad de noreste a suroeste.
    private static readonly GeoPoint Origin = new(-34.5900, -58.3730);
    private static readonly GeoPoint Destination = new(-34.6580, -58.5050);

    private static readonly DateTimeOffset Departure =
        new(2026, 8, 13, 10, 0, 0, TimeSpan.FromHours(-3));

    private static readonly CabaRestrictionEvaluator Evaluator = new();

    private static GraphHopperRouteCalculator CreateCalculator()
    {
        var options = Options.Create(new GraphHopperOptions { BaseUrl = "http://localhost:8989" });

        var httpClient = new HttpClient
        {
            BaseAddress = new Uri("http://localhost:8989/"),
            Timeout = TimeSpan.FromSeconds(120)
        };

        return new GraphHopperRouteCalculator(
            httpClient,
            new CabaTruckRoutingPolicy(),
            Evaluator,
            options,
            NullLogger<GraphHopperRouteCalculator>.Instance);
    }

    private static TruckProfile Heavy() => new()
    {
        Name = "Camion pesado",
        GrossWeightKg = 18_000,
        HeightMeters = 3.80,
        WidthMeters = 2.50,
        LengthMeters = 12.00,
        NumberOfAxles = 3,
        VehicleType = VehicleType.RigidTruck
    };

    private static TruckProfile SemiTrailer() => new()
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

    private static TruckProfile Light() => new()
    {
        Name = "Camion liviano",
        GrossWeightKg = 7_500,
        HeightMeters = 3.20,
        WidthMeters = 2.40,
        LengthMeters = 8.00,
        NumberOfAxles = 2,
        VehicleType = VehicleType.RigidTruck
    };

    [GraphHopperFact]
    public async Task A_route_is_returned_for_a_heavy_truck_inside_caba()
    {
        var route = await CreateCalculator()
            .CalculateAsync(Heavy(), Origin, Destination, Departure);

        Assert.True(route.DistanceMeters > 0);
        Assert.True(route.DurationSeconds > 0);
        Assert.NotEmpty(route.Geometry);
        Assert.NotEmpty(route.Instructions);
    }

    /// <summary>
    /// Criterio de exito nº 10 del MVP: ninguna calle incompatible forma parte
    /// de la ruta.
    /// </summary>
    [GraphHopperFact]
    public async Task No_segment_of_the_route_is_incompatible_with_the_vehicle()
    {
        var truck = SemiTrailer();

        var route = await CreateCalculator()
            .CalculateAsync(truck, Origin, Destination, Departure);

        // Las notas se generan corriendo el evaluador sobre los mismos atributos
        // de via que uso GraphHopper para calcular. Si alguna diera "prohibido",
        // la restriccion no habria entrado al calculo.
        var forbidden = route.RestrictionNotes
            .Where(note => note.Findings.Any(f =>
                f.Kind is RestrictionKind.MaxHeight
                       or RestrictionKind.MaxWeight
                       or RestrictionKind.MaxWidth
                       or RestrictionKind.MaxLength
                       or RestrictionKind.HgvProhibited))
            .ToList();

        Assert.True(
            forbidden.Count == 0,
            "La ruta contiene tramos incompatibles: " +
            string.Join("; ", forbidden.Select(n => $"{n.StreetName} -> {n.Findings[0].Description}")));
    }

    /// <summary>
    /// La regla de la Red tiene que cambiar el trazado, no solo anotarlo.
    /// </summary>
    [GraphHopperFact]
    public async Task Heavy_truck_route_runs_mostly_on_the_heavy_traffic_network()
    {
        var route = await CreateCalculator()
            .CalculateAsync(SemiTrailer(), Origin, Destination, Departure);

        Assert.True(
            route.HeavyNetworkSharePercent > 70,
            $"Solo el {route.HeavyNetworkSharePercent}% del trayecto va por la Red.");
    }

    [GraphHopperFact]
    public async Task Vehicle_dimensions_change_the_computed_route()
    {
        var calculator = CreateCalculator();

        var lightRoute = await calculator.CalculateAsync(Light(), Origin, Destination, Departure);
        var heavyRoute = await calculator.CalculateAsync(SemiTrailer(), Origin, Destination, Departure);

        // El camion es parte del calculo, no un filtro visual: dos vehiculos
        // distintos sobre el mismo par origen/destino dan trazados distintos.
        Assert.NotEqual(
            Math.Round(lightRoute.DistanceMeters),
            Math.Round(heavyRoute.DistanceMeters));

        Assert.True(heavyRoute.HeavyNetworkSharePercent > lightRoute.HeavyNetworkSharePercent);
    }

    [GraphHopperFact]
    public async Task Segments_off_the_network_are_reported_as_access_legs_with_their_source()
    {
        var route = await CreateCalculator()
            .CalculateAsync(SemiTrailer(), Origin, Destination, Departure);

        Assert.NotEmpty(route.AccessLegs);

        // Criterio de exito nº 11: toda restriccion tiene fuente identificable.
        Assert.All(route.AccessLegs, leg =>
        {
            Assert.True(leg.RequiresAccessException);

            var finding = leg.Findings.Single(f =>
                f.Kind == RestrictionKind.OutsideHeavyTrafficNetwork);

            Assert.Equal(RestrictionSourceType.CabaOfficial, finding.RuleSource);
            Assert.Contains("Ley 2148", finding.RuleReference);
            Assert.False(string.IsNullOrWhiteSpace(finding.DataReference));
        });
    }

    [GraphHopperFact]
    public async Task Light_truck_is_not_pushed_onto_the_heavy_traffic_network()
    {
        var route = await CreateCalculator()
            .CalculateAsync(Light(), Origin, Destination, Departure);

        // Por debajo de 12 t la Red no es obligatoria, asi que no se reportan
        // tramos de acceso.
        Assert.Empty(route.AccessLegs);
    }
}
