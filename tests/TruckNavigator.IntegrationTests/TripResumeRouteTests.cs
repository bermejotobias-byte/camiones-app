using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TruckNavigator.Api.Routing;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Routing;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Un viaje que se retoma vuelve por la MISMA opcion de ruta que se eligio al
/// arrancar, no por la recomendada.
/// </summary>
/// <remarks>
/// El viaje arrancaba por la opcion elegida (<c>RouteIndex</c>), pero no la
/// guardaba: al reabrir la app a mitad de camino, <c>GET /api/trips/active</c>
/// recalculaba y devolvia la recomendada. Medido el 03/10/2026 en Liniers → La
/// Boca: la app navegaba la alternativa de 21 km y el servidor devolvia 18,4.
/// El guiado tomaba al camion como salido de ruta y lo empujaba a la que no
/// eligio. Es la misma clase de falla que AD-45 corrigio para las paradas: no
/// avisa, porque la ruta que se muestra es valida, solo que no es la elegida.
/// </remarks>
public sealed class TripResumeRouteTests : IAsyncLifetime
{
    // El mismo par de TripRoutesTests: da al menos una alternativa.
    private static readonly GeoPoint Origin = new(-34.654516, -58.416144);
    private static readonly GeoPoint Destination = new(-34.651009, -58.405948);

    private static readonly DateTimeOffset Departure =
        new(2026, 9, 16, 15, 0, 0, TimeSpan.FromHours(-3));

    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> CreateUserAsync()
    {
        var email = $"{Guid.NewGuid():N}@camiones.test";
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user.Id;
    }

    /// <summary>Guarda el viaje y lo vuelve a leer de cero, como al reabrir la app.</summary>
    private async Task<Trip> GuardarYReleerAsync(int? routeIndex)
    {
        var trip = new Trip
        {
            DriverId = await CreateUserAsync(),
            TruckName = "El Rayo",
            OriginLatitude = Origin.Latitude,
            OriginLongitude = Origin.Longitude,
            DestinationLatitude = Destination.Latitude,
            DestinationLongitude = Destination.Longitude,
            RouteIndex = routeIndex,
            StartedAt = DateTimeOffset.UtcNow
        };

        _db.Trips.Add(trip);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        return await _db.Trips.AsNoTracking().SingleAsync(t => t.Id == trip.Id);
    }

    [Fact]
    public async Task The_chosen_route_option_survives_in_the_database()
    {
        var releido = await GuardarYReleerAsync(routeIndex: 1);

        Assert.Equal(1, releido.RouteIndex);
    }

    [Fact]
    public async Task A_trip_without_a_choice_keeps_none_and_resumes_on_the_recommended()
    {
        // Los viajes que ya estaban abiertos antes de esta columna quedan en
        // null, y null es la recomendada: el comportamiento de siempre.
        var releido = await GuardarYReleerAsync(routeIndex: null);

        Assert.Null(releido.RouteIndex);
    }

    [GraphHopperFact]
    public async Task A_trip_started_on_an_alternative_resumes_on_that_alternative()
    {
        var calculator = CreateCalculator();
        var truck = SemiTrailer();

        var offered = RouteOffer.Offerable(
            await calculator.CalculateAlternativesAsync(truck, Origin, Destination, Departure));

        Assert.NotNull(offered);
        Assert.True(offered.Count > 1, "Este par tiene que dar al menos una alternativa para que el test signifique algo.");
        Assert.NotEqual(Math.Round(offered[0].DistanceMeters), Math.Round(offered[1].DistanceMeters));

        // Se arranca por la alternativa, se guarda el viaje y se lo relee.
        var (arrancada, _) = await TripRoutes.ForTripAsync(
            calculator, truck, Origin, Destination, stops: [], routeIndex: 1, Departure);
        var releido = await GuardarYReleerAsync(routeIndex: 1);

        // Retomar es lo que hace GET /api/trips/active con el viaje guardado.
        var (retomada, _) = await TripRoutes.ForTripAsync(
            calculator, truck, Origin, Destination, stops: [], releido.RouteIndex, Departure);

        Assert.NotNull(arrancada);
        Assert.NotNull(retomada);
        Assert.Equal(Math.Round(arrancada.DistanceMeters), Math.Round(retomada.DistanceMeters));
        Assert.Equal(Math.Round(offered[1].DistanceMeters), Math.Round(retomada.DistanceMeters));
    }

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
}
