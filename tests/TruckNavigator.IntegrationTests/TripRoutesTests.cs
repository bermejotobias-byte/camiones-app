using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TruckNavigator.Api.Routing;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Routing;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El viaje arranca por la MISMA ruta que se recomendo o se eligio en pantalla.
/// Antes el servidor pedia una sola ruta al motor al arrancar —la mas rapida por
/// peso— y el viaje salia por otra que la recomendada, con otros kilometros
/// previstos y sin pasar por el filtro de AD-47.
/// </summary>
public class TripRoutesTests
{
    // Nueva Pompeya: el par con el que se midio la divergencia el 16/09/2026
    // (2,7 km al 52 % por la Red contra 2,2 km al 60 %).
    private static readonly GeoPoint Origin = new(-34.654516, -58.416144);
    private static readonly GeoPoint Destination = new(-34.651009, -58.405948);

    private static readonly DateTimeOffset Departure =
        new(2026, 9, 16, 15, 0, 0, TimeSpan.FromHours(-3));

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
            new CabaRestrictionEvaluator(),
            options,
            NullLogger<GraphHopperRouteCalculator>.Instance);
    }

    private static TruckProfile SemiTrailer() => new()
    {
        Name = "El Rayo",
        GrossWeightKg = 40_000,
        HeightMeters = 4.20,
        WidthMeters = 2.55,
        LengthMeters = 6.00,
        NumberOfAxles = 5,
        VehicleType = VehicleType.SemiTrailer
    };

    [GraphHopperFact]
    public async Task The_trip_starts_on_the_route_that_was_recommended()
    {
        var calculator = CreateCalculator();
        var truck = SemiTrailer();

        var offered = RouteOffer.Offerable(
            await calculator.CalculateAlternativesAsync(truck, Origin, Destination, Departure));

        var (route, reason) = await TripRoutes.ForTripAsync(
            calculator, truck, Origin, Destination, stops: [], routeIndex: null, Departure);

        Assert.NotNull(offered);
        Assert.Null(reason);
        Assert.NotNull(route);
        Assert.Equal(Math.Round(offered[0].DistanceMeters), Math.Round(route.DistanceMeters));
        Assert.Equal(offered[0].HeavyNetworkSharePercent, route.HeavyNetworkSharePercent);
    }

    [GraphHopperFact]
    public async Task Choosing_an_alternative_starts_the_trip_on_that_alternative()
    {
        var calculator = CreateCalculator();
        var truck = SemiTrailer();

        var offered = RouteOffer.Offerable(
            await calculator.CalculateAlternativesAsync(truck, Origin, Destination, Departure));

        Assert.NotNull(offered);
        Assert.True(offered.Count > 1, "Este par tiene que dar al menos una alternativa para que el test signifique algo.");

        var (route, _) = await TripRoutes.ForTripAsync(
            calculator, truck, Origin, Destination, stops: [], routeIndex: 1, Departure);

        Assert.NotNull(route);
        Assert.Equal(Math.Round(offered[1].DistanceMeters), Math.Round(route.DistanceMeters));
    }
}
