using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Verifica que un camion pertenezca a su cuenta y que las plantillas del
/// catalogo sigan siendo de todos.
/// </summary>
/// <remarks>
/// Las medidas de un camion son dato de su dueno, y ademas son la entrada del
/// motor de restricciones: rutear con el camion equivocado devuelve una ruta que
/// no sirve. Por eso el filtro por dueno se prueba sobre la consulta real y no
/// solo sobre el endpoint.
/// </remarks>
public sealed class TruckOwnershipTests : IAsyncLifetime
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

        // Migrations reales: lo que se prueba es el esquema que va a produccion.
        await TruckProfileSeed.ApplyAsync(_db);
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

    private async Task<Guid> AddTruckAsync(Guid ownerId, string name)
    {
        var truck = new TruckProfile
        {
            Name = name,
            OwnerId = ownerId,
            GrossWeightKg = 18_000,
            HeightMeters = 3.8,
            WidthMeters = 2.5,
            LengthMeters = 12,
            NumberOfAxles = 3,
            VehicleType = VehicleType.RigidTruck
        };

        _db.TruckProfiles.Add(truck);
        await _db.SaveChangesAsync();

        return truck.Id;
    }

    /// <summary>
    /// Las tres que siembra la API no son de nadie: son el catalogo que se muestra
    /// para elegir el tipo de transporte la primera vez.
    /// </summary>
    [Fact]
    public async Task The_seeded_profiles_are_templates_owned_by_nobody()
    {
        var seeded = await _db.TruckProfiles.AsNoTracking().ToListAsync();

        Assert.Equal(3, seeded.Count);
        Assert.All(seeded, t => Assert.True(t.IsTemplate));
        Assert.All(seeded, t => Assert.Null(t.OwnerId));
    }

    [Fact]
    public async Task A_user_only_sees_their_own_trucks_plus_the_templates()
    {
        var mine = await CreateUserAsync("uno@example.com");
        var theirs = await CreateUserAsync("dos@example.com");

        await AddTruckAsync(mine, "El mio");
        await AddTruckAsync(theirs, "El de otro");

        var visible = await _db.TruckProfiles
            .Where(t => t.OwnerId == null || t.OwnerId == mine)
            .AsNoTracking()
            .ToListAsync();

        Assert.Equal(4, visible.Count);                       // 3 plantillas + el propio
        Assert.Contains(visible, t => t.Name == "El mio");
        Assert.DoesNotContain(visible, t => t.Name == "El de otro");
    }

    /// <summary>
    /// El caso que importa de verdad: pedir por id el camion de otra cuenta no
    /// tiene que devolver nada, aunque el id sea correcto.
    /// </summary>
    [Fact]
    public async Task Another_users_truck_is_not_reachable_by_id()
    {
        var mine = await CreateUserAsync("uno@example.com");
        var theirs = await CreateUserAsync("dos@example.com");

        var foreignTruck = await AddTruckAsync(theirs, "El de otro");

        var found = await _db.TruckProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                t.Id == foreignTruck && (t.OwnerId == null || t.OwnerId == mine));

        Assert.Null(found);
    }

    [Fact]
    public async Task A_template_is_reachable_by_anyone_even_without_an_account()
    {
        var template = await _db.TruckProfiles.AsNoTracking().FirstAsync();

        Guid? nobody = null;

        var found = await _db.TruckProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                t.Id == template.Id && (t.OwnerId == null || t.OwnerId == nobody));

        Assert.NotNull(found);
    }

    /// <summary>
    /// Los camiones son datos de la persona: si se va, se van con ella. Las
    /// plantillas no, porque no cuelgan de ninguna cuenta.
    /// </summary>
    [Fact]
    public async Task Deleting_the_account_deletes_its_trucks_but_not_the_templates()
    {
        var owner = await CreateUserAsync("uno@example.com");
        await AddTruckAsync(owner, "El mio");

        _db.Users.Remove(await _db.Users.SingleAsync(u => u.Id == owner));
        await _db.SaveChangesAsync();

        var left = await _db.TruckProfiles.AsNoTracking().ToListAsync();

        Assert.Equal(3, left.Count);
        Assert.All(left, t => Assert.True(t.IsTemplate));
    }
}
