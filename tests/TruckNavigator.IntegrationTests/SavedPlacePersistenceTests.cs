using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Casa y Deposito contra el esquema real: uno por tipo y por camionero —el
/// indice unico es la garantia, no el endpoint—, sin mezclar cuentas, y borrar
/// la cuenta se los lleva.
/// </summary>
public sealed class SavedPlacePersistenceTests : IAsyncLifetime
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

    private async Task SaveAsync(Guid ownerId, SavedPlaceKind kind, string label)
    {
        _db.SavedPlaces.Add(new SavedPlace
        {
            OwnerId = ownerId,
            Kind = kind,
            Label = label,
            Latitude = -34.65,
            Longitude = -58.41
        });

        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task Home_and_depot_are_saved_and_read_back_per_driver()
    {
        var driver = await CreateUserAsync("uno@camiones.test");
        var other = await CreateUserAsync("otro@camiones.test");

        await SaveAsync(driver, SavedPlaceKind.Home, "Casa en Pompeya");
        await SaveAsync(driver, SavedPlaceKind.Depot, "Deposito de Barracas");
        await SaveAsync(other, SavedPlaceKind.Home, "Otra casa");

        // El tipo se guarda como texto ("Depot" < "Home"): se ordena en memoria,
        // por el enum, como hace el endpoint.
        var places = (await _db.SavedPlaces.Where(p => p.OwnerId == driver).ToListAsync())
            .OrderBy(p => p.Kind)
            .ToList();

        Assert.Equal(["Casa en Pompeya", "Deposito de Barracas"], places.Select(p => p.Label));
    }

    [Fact]
    public async Task There_is_only_one_place_per_kind_and_driver()
    {
        var driver = await CreateUserAsync("uno@camiones.test");

        await SaveAsync(driver, SavedPlaceKind.Home, "Casa");

        await Assert.ThrowsAsync<DbUpdateException>(() => SaveAsync(driver, SavedPlaceKind.Home, "Otra casa"));
    }

    [Fact]
    public async Task Deleting_the_account_deletes_its_places()
    {
        var driver = await CreateUserAsync("uno@camiones.test");
        await SaveAsync(driver, SavedPlaceKind.Home, "Casa");

        _db.Users.Remove(await _db.Users.SingleAsync(u => u.Id == driver));
        await _db.SaveChangesAsync();

        Assert.Empty(await _db.SavedPlaces.ToListAsync());
    }
}
