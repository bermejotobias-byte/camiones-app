using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Verifica que la unicidad del alias la garantice la base y no solo la consulta
/// previa del endpoint.
/// </summary>
/// <remarks>
/// La distincion importa: entre "fijate si esta libre" y "guardalo" hay una
/// ventana en la que otra alta puede quedarse con el mismo alias. Si el indice
/// unico no estuviera, esa carrera dejaria dos camioneros con el mismo nombre
/// publico y el chat quedaria abierto a la suplantacion.
/// </remarks>
public sealed class DriverProfilePersistenceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        // La base en memoria vive mientras la conexion siga abierta.
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        // Se aplican las migrations reales y no EnsureCreated: lo que se quiere
        // probar es el esquema que va a produccion, indice unico incluido.
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

    [Fact]
    public async Task Two_profiles_cannot_share_an_alias()
    {
        var first = await CreateUserAsync("uno@example.com");
        var second = await CreateUserAsync("dos@example.com");

        var one = new DriverProfile { Id = first };
        one.SetAlias("ElGaucho");
        _db.DriverProfiles.Add(one);
        await _db.SaveChangesAsync();

        var other = new DriverProfile { Id = second };
        other.SetAlias("ElGaucho");
        _db.DriverProfiles.Add(other);

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    /// <summary>
    /// El caso que hace falta la columna normalizada: para SQLite "ElGaucho" y
    /// "elgaucho" son distintos, asi que sin normalizar el indice no los frenaria.
    /// </summary>
    [Fact]
    public async Task Aliases_that_differ_only_in_capitalisation_are_rejected_too()
    {
        var first = await CreateUserAsync("uno@example.com");
        var second = await CreateUserAsync("dos@example.com");

        var one = new DriverProfile { Id = first };
        one.SetAlias("ElGaucho");
        _db.DriverProfiles.Add(one);
        await _db.SaveChangesAsync();

        var other = new DriverProfile { Id = second };
        other.SetAlias("elgaucho");
        _db.DriverProfiles.Add(other);

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    /// <summary>
    /// Varias cuentas pueden convivir sin alias elegido, porque el alta permite
    /// saltear ese paso. Un indice unico que no admitiera NULL lo impediria.
    /// </summary>
    [Fact]
    public async Task Several_profiles_can_wait_without_an_alias()
    {
        var first = await CreateUserAsync("uno@example.com");
        var second = await CreateUserAsync("dos@example.com");

        _db.DriverProfiles.Add(new DriverProfile { Id = first });
        _db.DriverProfiles.Add(new DriverProfile { Id = second });

        await _db.SaveChangesAsync();

        Assert.Equal(2, await _db.DriverProfiles.CountAsync());
    }

    [Fact]
    public async Task Deleting_the_account_deletes_its_profile()
    {
        var id = await CreateUserAsync("uno@example.com");

        var profile = new DriverProfile { Id = id };
        profile.SetAlias("ElGaucho");
        _db.DriverProfiles.Add(profile);
        await _db.SaveChangesAsync();

        _db.Users.Remove(await _db.Users.SingleAsync(u => u.Id == id));
        await _db.SaveChangesAsync();

        Assert.Empty(await _db.DriverProfiles.ToListAsync());
    }
}
