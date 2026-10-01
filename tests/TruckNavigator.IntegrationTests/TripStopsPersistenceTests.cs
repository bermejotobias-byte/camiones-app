using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Las paradas de un reparto tienen que sobrevivir al viaje.
/// </summary>
/// <remarks>
/// <para>
/// El viaje abierto vive en el servidor y sobrevive a cerrar la app (AD-27): al
/// volver a entrar, la app lo recupera y el servidor <b>recalcula la ruta</b>.
/// Mientras el viaje guardó sólo origen y destino, esa ruta salía <b>directa</b>
/// — medido: un reparto de 31 km por tres paradas volvía convertido en un tramo
/// de 10,2 km — y el guiado mandaba al camión por donde no correspondía.
/// </para>
/// <para>
/// Es una falla de las caras: no avisa. La app muestra una ruta perfectamente
/// válida, sólo que no es la que el camionero armó, y las paradas que faltan no
/// aparecen en ningún lado.
/// </para>
/// </remarks>
public sealed class TripStopsPersistenceTests : IAsyncLifetime
{
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

    private async Task<Guid> CreateUserAsync(string email)
    {
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

    private Trip NuevoViaje(Guid driverId, params TripStop[] stops) => new()
    {
        DriverId = driverId,
        TruckName = "Camion de prueba",
        OriginLatitude = -34.6037,
        OriginLongitude = -58.3816,
        DestinationLatitude = -34.5631,
        DestinationLongitude = -58.4560,
        Stops = stops,
        StartedAt = DateTimeOffset.UtcNow
    };

    [Fact]
    public async Task LasParadasVuelvenDeLaBaseEnElMISMOOrden()
    {
        // El orden es el resultado del calculo del reparto y es lo que se le
        // mostro al usuario. Devolverlo cambiado seria mandarlo por otro lado.
        var driver = await CreateUserAsync("reparto@camiones.test");

        var viaje = NuevoViaje(driver,
            new TripStop(-34.6357, -58.3972, "Caseros 2500"),
            new TripStop(-34.6391, -58.5186, "Rivadavia 11000"));

        _db.Trips.Add(viaje);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var leido = await _db.Trips.SingleAsync(t => t.Id == viaje.Id);

        Assert.Equal(2, leido.Stops.Count);
        Assert.Equal("Caseros 2500", leido.Stops[0].Label);
        Assert.Equal("Rivadavia 11000", leido.Stops[1].Label);
        Assert.Equal(-34.6357, leido.Stops[0].Latitude, precision: 4);
    }

    [Fact]
    public async Task UnViajeSinParadasVuelveConLaListaVaciaYNoConNull()
    {
        // El endpoint decide con `Stops.Count == 0` si recalcular directo o por
        // los waypoints. Un null ahi seria una excepcion al recuperar cualquier
        // viaje comun, que son la mayoria.
        var driver = await CreateUserAsync("simple@camiones.test");

        var viaje = NuevoViaje(driver);
        _db.Trips.Add(viaje);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var leido = await _db.Trips.SingleAsync(t => t.Id == viaje.Id);

        Assert.NotNull(leido.Stops);
        Assert.Empty(leido.Stops);
    }

    [Fact]
    public async Task UnaColumnaVaciaNoRompeLaLecturaDelHistorial()
    {
        // EF creo la columna con "" como valor por defecto, y deserializar una
        // cadena vacia TIRA excepcion. Una sola fila asi haria ilegible el
        // historial entero, no solo ese viaje. La migracion quedo con "[]" y el
        // conversor tolera el vacio igual: son datos que ya estan en discos
        // ajenos y no se pueden volver a escribir.
        var driver = await CreateUserAsync("vieja@camiones.test");

        var viaje = NuevoViaje(driver);
        _db.Trips.Add(viaje);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        // Se simula la fila vieja escribiendo "" directamente en la columna.
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE Trips SET Stops = '' WHERE Id = {0}", viaje.Id);

        var leido = await _db.Trips.SingleAsync(t => t.Id == viaje.Id);

        Assert.Empty(leido.Stops);
    }

    [Fact]
    public async Task CambiarLasParadasSeGuarda()
    {
        // Sin el ValueComparer, EF compara la coleccion por referencia y un cambio
        // pasa inadvertido: se guardaria el viaje sin las paradas nuevas.
        var driver = await CreateUserAsync("cambio@camiones.test");

        var viaje = NuevoViaje(driver, new TripStop(-34.60, -58.38, "Una"));
        _db.Trips.Add(viaje);
        await _db.SaveChangesAsync();

        viaje.Stops = [new TripStop(-34.60, -58.38, "Una"), new TripStop(-34.61, -58.39, "Otra")];
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var leido = await _db.Trips.SingleAsync(t => t.Id == viaje.Id);

        Assert.Equal(2, leido.Stops.Count);
    }
}
