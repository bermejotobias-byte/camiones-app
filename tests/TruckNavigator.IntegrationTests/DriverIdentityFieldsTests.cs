using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Nacionalidad y camion activo, contra el esquema real.
/// </summary>
/// <remarks>
/// <para>
/// Los dos campos existen porque <b>el perfil lo ven otros usuarios</b>. Un camion
/// activo guardado en el telefono no se le puede mostrar a nadie mas, asi que tiene
/// que vivir en el servidor.
/// </para>
/// <para>
/// Lo que mas se cuida aca es la direccion del borrado: el perfil NO puede
/// desaparecer porque se borro un camion.
/// </para>
/// </remarks>
public sealed class DriverIdentityFieldsTests : IAsyncLifetime
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

    private async Task<DriverProfile> CreateDriverAsync()
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

        var profile = new DriverProfile { Id = user.Id, FirstName = "Demo" };

        _db.Users.Add(user);
        _db.DriverProfiles.Add(profile);
        await _db.SaveChangesAsync();

        return profile;
    }

    private async Task<TruckProfile> CreateTruckAsync(Guid ownerId)
    {
        var truck = new TruckProfile
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = "El Colorado",
            VehicleType = VehicleType.SemiTrailer
        };

        _db.TruckProfiles.Add(truck);
        await _db.SaveChangesAsync();

        return truck;
    }

    [Fact]
    public async Task The_nationality_survives_a_round_trip()
    {
        var profile = await CreateDriverAsync();

        profile.Nationality = "AR";
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        Assert.Equal("AR", (await _db.DriverProfiles.SingleAsync()).Nationality);
    }

    [Fact]
    public async Task The_active_truck_lives_in_the_server()
    {
        var profile = await CreateDriverAsync();
        var truck = await CreateTruckAsync(profile.Id);

        profile.ActiveTruckId = truck.Id;
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        Assert.Equal(truck.Id, (await _db.DriverProfiles.SingleAsync()).ActiveTruckId);
    }

    /// <remarks>
    /// <b>El test que mas importa de los tres.</b> Con la relacion configurada al
    /// reves, borrar un camion se llevaria puesto el perfil del camionero: la
    /// persona pierde alias, nombre y avatar por haber borrado un vehiculo.
    ///
    /// Es el mismo criterio que ya rige los viajes: borrar un camion no borra el
    /// historial hecho con el.
    /// </remarks>
    [Fact]
    public async Task Deleting_the_truck_clears_the_selection_but_keeps_the_profile()
    {
        var profile = await CreateDriverAsync();
        var truck = await CreateTruckAsync(profile.Id);

        profile.ActiveTruckId = truck.Id;
        await _db.SaveChangesAsync();

        _db.TruckProfiles.Remove(truck);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var leido = await _db.DriverProfiles.SingleOrDefaultAsync();

        Assert.NotNull(leido);
        Assert.Equal("Demo", leido.FirstName);
        Assert.Null(leido.ActiveTruckId);
    }
}
