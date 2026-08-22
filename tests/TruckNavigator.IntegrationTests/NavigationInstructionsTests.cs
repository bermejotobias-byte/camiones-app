using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Routing;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Verifica el contrato del que depende la navegacion paso a paso.
/// </summary>
/// <remarks>
/// <para>
/// El motor de navegacion que corre en el telefono necesita dos cosas de cada
/// instruccion: <b>que maniobra es</b> y <b>en que punto de la geometria
/// ocurre</b>. Sin el indice no se puede decir "en doscientos metros gira", que
/// es la unica frase que importa manejando.
/// </para>
/// <para>
/// Durante mucho tiempo el parser descartaba ambos campos y nadie se enteraba,
/// porque la ruta se dibujaba igual de bien. Estos tests existen para que si
/// vuelven a perderse, se note acá y no en la calle.
/// </para>
/// </remarks>
public class NavigationInstructionsTests
{
    private static readonly GeoPoint Origin = new(-34.5900, -58.3730);
    private static readonly GeoPoint Destination = new(-34.6580, -58.5050);

    private static readonly DateTimeOffset Departure =
        new(2026, 8, 13, 10, 0, 0, TimeSpan.FromHours(-3));

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

    private static Task<TruckRoute> RouteAsync() =>
        CreateCalculator().CalculateAsync(SampleTruck(), Origin, Destination, Departure);

    private static TruckProfile SampleTruck() => new()
    {
        Name = "Camion de prueba",
        GrossWeightKg = 18_000,
        HeightMeters = 3.8,
        WidthMeters = 2.5,
        LengthMeters = 12,
        NumberOfAxles = 3,
        VehicleType = VehicleType.RigidTruck
    };

    [GraphHopperFact]
    public async Task Every_instruction_says_which_manoeuvre_it_is()
    {
        var route = await RouteAsync();

        Assert.NotEmpty(route.Instructions);

        // Unknown significa que el motor mando un codigo que no sabemos traducir.
        // Si aparece en una ruta corriente, la tabla de traduccion quedo corta y
        // el conductor va a ver una flecha generica donde deberia ver un giro.
        Assert.DoesNotContain(route.Instructions, i => i.Kind == ManeuverKind.Unknown);
    }

    [GraphHopperFact]
    public async Task Every_instruction_is_anchored_to_a_point_of_the_geometry()
    {
        var route = await RouteAsync();
        var lastPoint = route.Geometry.Count - 1;

        foreach (var instruction in route.Instructions)
        {
            Assert.InRange(instruction.FromPointIndex, 0, lastPoint);
            Assert.InRange(instruction.ToPointIndex, instruction.FromPointIndex, lastPoint);
        }
    }

    /// <summary>
    /// Las instrucciones tienen que venir en el orden en que se recorren. El
    /// navegador confia en eso para saber cual es la proxima maniobra: si
    /// llegaran desordenadas, avisaria de un giro que ya quedo atras.
    /// </summary>
    [GraphHopperFact]
    public async Task Instructions_come_in_travel_order()
    {
        var route = await RouteAsync();

        var indexes = route.Instructions.Select(i => i.FromPointIndex).ToList();

        Assert.Equal(indexes.OrderBy(i => i).ToList(), indexes);
    }

    /// <summary>
    /// La primera instruccion arranca en el origen y la ultima es la llegada.
    /// </summary>
    [GraphHopperFact]
    public async Task The_route_starts_at_the_beginning_and_ends_with_the_arrival()
    {
        var route = await RouteAsync();

        Assert.Equal(0, route.Instructions[0].FromPointIndex);
        Assert.Equal(ManeuverKind.Finish, route.Instructions[^1].Kind);
    }

    /// <summary>
    /// La suma de los tramos tiene que dar la distancia de la ruta.
    /// </summary>
    /// <remarks>
    /// Es la comprobacion que detecta que se este leyendo <c>distance</c> como
    /// otra cosa: el navegador reparte los avisos sobre esos tramos, asi que un
    /// error acá corre cada indicacion de lugar.
    /// </remarks>
    [GraphHopperFact]
    public async Task The_legs_add_up_to_the_whole_route()
    {
        var route = await RouteAsync();

        var sum = route.Instructions.Sum(i => i.DistanceMeters);

        // Un metro de tolerancia por redondeo del motor.
        Assert.InRange(sum, route.DistanceMeters - 1, route.DistanceMeters + 1);
    }
}
