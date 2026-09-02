using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los contactos de emergencia contra el esquema real.
/// </summary>
/// <remarks>
/// <para>
/// Tres cosas sólo se pueden verificar acá y no en el dominio: que el orden de
/// lectura funcione —SQLite <b>no sabe ordenar por <c>DateTimeOffset</c></b> y sin
/// el conversor a ticks la consulta tira <c>NotSupportedException</c> (AD-20)—,
/// que borrar la cuenta se lleve los contactos, y que los de un camionero no se
/// mezclen con los de otro.
/// </para>
/// <para>
/// Ese último es el que más importa: son teléfonos de <b>terceros</b> que nunca
/// dieron su consentimiento, y filtrarlos entre cuentas sería la peor forma de
/// fallar de toda esta funcionalidad.
/// </para>
/// </remarks>
public sealed class EmergencyContactPersistenceTests : IAsyncLifetime
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

        // Migrations reales: se prueba el esquema que va a produccion, con su
        // conversor de fecha y su cascade.
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

    private async Task<EmergencyContact> AddAsync(
        Guid ownerId, string name, string phone, DateTimeOffset addedAt)
    {
        var contact = new EmergencyContact
        {
            OwnerId = ownerId,
            Name = name,
            Phone = phone,
            AddedAt = addedAt
        };

        _db.EmergencyContacts.Add(contact);
        await _db.SaveChangesAsync();

        return contact;
    }

    [Fact]
    public async Task SeLeenEnOrdenDeCargaYNoAlfabetico()
    {
        // Esta consulta es la que rompia sin el conversor a ticks: SQLite guarda
        // el DateTimeOffset como texto con el offset adelante y el ORDER BY seria
        // alfabetico, asi que EF directamente lo rechaza. Ver AD-20.
        var owner = await CreateUserAsync("orden@camiones.test");
        var ahora = DateTimeOffset.UtcNow;

        await AddAsync(owner, "Zulema", "1145678900", ahora);
        await AddAsync(owner, "Ana", "1145678901", ahora.AddMinutes(1));
        await AddAsync(owner, "Miguel", "1145678902", ahora.AddMinutes(2));

        var leidos = await _db.EmergencyContacts
            .Where(c => c.OwnerId == owner)
            .OrderBy(c => c.AddedAt)
            .Select(c => c.Name)
            .ToListAsync();

        // Que el orden no cambie entre una pantalla y la siguiente importa: se
        // busca por posicion, no leyendo.
        Assert.Equal(["Zulema", "Ana", "Miguel"], leidos);
    }

    [Fact]
    public async Task LaFechaVuelveIntactaDeLaBase()
    {
        var owner = await CreateUserAsync("fecha@camiones.test");
        var momento = new DateTimeOffset(2026, 9, 1, 20, 30, 15, TimeSpan.Zero);

        var guardado = await AddAsync(owner, "Rosa", "1145678900", momento);

        _db.ChangeTracker.Clear();

        var leido = await _db.EmergencyContacts.SingleAsync(c => c.Id == guardado.Id);

        Assert.Equal(momento, leido.AddedAt);
    }

    [Fact]
    public async Task LosContactosDeUnCamioneroNoSeMezclanConLosDeOtro()
    {
        // El peor fallo posible de esta funcionalidad: son telefonos de terceros
        // que nunca dieron su consentimiento.
        var uno = await CreateUserAsync("uno@camiones.test");
        var otro = await CreateUserAsync("otro@camiones.test");
        var ahora = DateTimeOffset.UtcNow;

        await AddAsync(uno, "La mujer de uno", "1145678900", ahora);
        await AddAsync(otro, "El hermano del otro", "1145678901", ahora);

        var deUno = await _db.EmergencyContacts.Where(c => c.OwnerId == uno).ToListAsync();

        Assert.Single(deUno);
        Assert.Equal("La mujer de uno", deUno[0].Name);
    }

    [Fact]
    public async Task BorrarLaCuentaSeLlevaSusContactos()
    {
        // Son datos de esa persona sobre terceros. No hay ninguna razon para que
        // sobrevivan a la cuenta, y si la hubiera seria una mala razon.
        var owner = await CreateUserAsync("baja@camiones.test");
        await AddAsync(owner, "Rosa", "1145678900", DateTimeOffset.UtcNow);

        var user = await _db.Users.SingleAsync(u => u.Id == owner);
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        Assert.Empty(await _db.EmergencyContacts.Where(c => c.OwnerId == owner).ToListAsync());
    }

    [Fact]
    public async Task ElTelefonoSeGuardaTalComoSeCargo()
    {
        // Con espacios, guiones y prefijo. Ni el servidor ni la base lo reescriben.
        var owner = await CreateUserAsync("crudo@camiones.test");

        var guardado = await AddAsync(
            owner, "Taller", "+54 9 11 5555-1234", DateTimeOffset.UtcNow);

        _db.ChangeTracker.Clear();

        var leido = await _db.EmergencyContacts.SingleAsync(c => c.Id == guardado.Id);

        Assert.Equal("+54 9 11 5555-1234", leido.Phone);
    }

    [Fact]
    public async Task ElNombreLargoLoCortaElDominioAntesDeLlegarAca()
    {
        // La columna tiene el mismo limite que la regla, y el punto es que la
        // regla salte primero: un DbUpdateException le llega al usuario como
        // "error del servidor" en vez de "el nombre es muy largo".
        var validacion = EmergencyContactRules.Validate(
            new string('a', EmergencyContactRules.MaxNameLength + 1), "1145678900");

        Assert.False(validacion.IsValid);

        await Task.CompletedTask;
    }
}
