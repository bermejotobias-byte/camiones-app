using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los datos que el carnet necesita y no existian, contra el esquema real.
/// </summary>
/// <remarks>
/// Decision del usuario del 11/09/2026: el frente lleva la fecha de nacimiento y el
/// dorso lleva marca, modelo y patente del camion. Son cuatro columnas nuevas y una
/// migracion; estos tests prueban que la migracion existe y que lo que se guarda
/// vuelve igual —incluida la <c>DateOnly</c>, que SQLite no conoce.
/// </remarks>
public sealed class CarnetFieldsTests : IAsyncLifetime
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

    private async Task<Guid> CreateDriverAsync(DateOnly? birthDate)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "uno@camiones.test",
            NormalizedEmail = "UNO@CAMIONES.TEST",
            UserName = "uno@camiones.test",
            NormalizedUserName = "UNO@CAMIONES.TEST",
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };

        _db.Users.Add(user);
        _db.DriverProfiles.Add(new DriverProfile { Id = user.Id, FirstName = "Demo", BirthDate = birthDate });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        return user.Id;
    }

    [Fact]
    public async Task The_birth_date_survives_a_round_trip_as_a_date_only()
    {
        var id = await CreateDriverAsync(new DateOnly(1988, 3, 27));

        var loaded = await _db.DriverProfiles.SingleAsync(p => p.Id == id);

        Assert.Equal(new DateOnly(1988, 3, 27), loaded.BirthDate);
    }

    [Fact]
    public async Task A_driver_without_birth_date_stays_without_one()
    {
        var id = await CreateDriverAsync(birthDate: null);

        var loaded = await _db.DriverProfiles.SingleAsync(p => p.Id == id);

        Assert.Null(loaded.BirthDate);
    }

    /// <remarks>
    /// Se guarda la forma canonica de la patente, no lo que el usuario escribio.
    /// Eso es responsabilidad del endpoint, no de la entidad: aca solo se prueba que
    /// la columna existe y que lo guardado vuelve.
    /// </remarks>
    [Fact]
    public async Task Brand_model_and_plate_survive_a_round_trip()
    {
        var owner = await CreateDriverAsync(birthDate: null);

        var truck = new TruckProfile
        {
            Name = "El Rayo",
            OwnerId = owner,
            Brand = "Scania",
            Model = "R 450",
            Plate = "AB123CD",
            GrossWeightKg = 30_000,
            HeightMeters = 4,
            WidthMeters = 2.6,
            LengthMeters = 16,
            NumberOfAxles = 5,
            VehicleType = VehicleType.SemiTrailer
        };

        _db.TruckProfiles.Add(truck);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var loaded = await _db.TruckProfiles.SingleAsync(t => t.Id == truck.Id);

        Assert.Equal("Scania", loaded.Brand);
        Assert.Equal("R 450", loaded.Model);
        Assert.Equal("AB123CD", loaded.Plate);
    }

    /// <remarks>
    /// Las plantillas del catalogo no tienen patente ni marca: son genericas. La
    /// columna tiene que admitir nulo para que las que ya existen sigan cargando.
    /// </remarks>
    [Fact]
    public async Task A_truck_without_identity_fields_still_loads()
    {
        var truck = new TruckProfile
        {
            Name = "Plantilla",
            GrossWeightKg = 10_000,
            HeightMeters = 3,
            WidthMeters = 2.4,
            LengthMeters = 8,
            NumberOfAxles = 2
        };

        _db.TruckProfiles.Add(truck);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var loaded = await _db.TruckProfiles.SingleAsync(t => t.Id == truck.Id);

        Assert.Null(loaded.Brand);
        Assert.Null(loaded.Model);
        Assert.Null(loaded.Plate);
    }
}
