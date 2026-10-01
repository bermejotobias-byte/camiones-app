using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El libro de movimientos contra el esquema real.
/// </summary>
/// <remarks>
/// <para>
/// La razon de que esto sea un libro y no un contador es exactamente lo que se
/// prueba aca: <b>un mismo hecho no puede acreditarse dos veces</b>. Y esa garantia
/// no puede vivir en el dominio, porque depende de que la base la haga cumplir
/// entre todas las escrituras a la vez.
/// </para>
/// <para>
/// Un reintento, un doble toque o un cierre de viaje que se procesa dos veces son
/// cosas que van a pasar. Sin el indice unico, cada una regala EXP.
/// </para>
/// </remarks>
public sealed class ProgressionPersistenceTests : IAsyncLifetime
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

    private static LedgerEntry Credit(Guid driverId, string sourceKey) => new()
    {
        Id = Guid.NewGuid(),
        DriverId = driverId,
        OccurredAt = DateTimeOffset.UtcNow,
        Denomination = Denomination.Experience,
        Amount = 20,
        Reason = LedgerReason.TripCompleted,
        SourceKey = sourceKey
    };

    [Fact]
    public async Task The_same_trip_cannot_be_credited_twice()
    {
        var driver = await CreateUserAsync("uno@camiones.test");
        var trip = Guid.NewGuid().ToString();

        _db.LedgerEntries.Add(Credit(driver, trip));
        await _db.SaveChangesAsync();

        _db.LedgerEntries.Add(Credit(driver, trip));

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    /// <remarks>
    /// El indice es por camionero: que uno haya cobrado un hecho no puede impedir
    /// que otro cobre el suyo.
    /// </remarks>
    [Fact]
    public async Task The_same_source_key_credits_once_per_driver()
    {
        var uno = await CreateUserAsync("uno@camiones.test");
        var otro = await CreateUserAsync("otro@camiones.test");

        // Distintos viajes, misma clave por casualidad no: es la misma pista y el
        // mismo escalon, que dos camioneros pueden alcanzar por separado.
        _db.LedgerEntries.Add(Credit(uno, "viajes:1"));
        _db.LedgerEntries.Add(Credit(otro, "viajes:1"));

        await _db.SaveChangesAsync();

        Assert.Equal(2, await _db.LedgerEntries.CountAsync());
    }

    /// <remarks>
    /// Una pista por camionero y nada mas. Dos filas de <c>viajes</c> para la misma
    /// persona serian dos verdades sobre el mismo contador.
    /// </remarks>
    [Fact]
    public async Task A_driver_has_one_row_per_track()
    {
        var driver = await CreateUserAsync("uno@camiones.test");

        _db.TrackProgress.Add(new DriverTrackProgress
        {
            DriverId = driver,
            TrackCode = "viajes",
            Count = 9,
            TierReached = 0
        });

        await _db.SaveChangesAsync();

        // Sin limpiar el rastreador, EF detecta la clave repetida en memoria y tira
        // InvalidOperationException: el test pasaria sin haber tocado la base. Lo
        // que se quiere probar es que el ESQUEMA lo impide.
        _db.ChangeTracker.Clear();

        _db.TrackProgress.Add(new DriverTrackProgress
        {
            DriverId = driver,
            TrackCode = "viajes",
            Count = 40,
            TierReached = 2
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    /// <remarks>
    /// Equipar es reemplazar, no acumular: una sola pieza por ranura.
    /// </remarks>
    [Fact]
    public async Task Equipping_replaces_what_was_in_the_slot()
    {
        var driver = await CreateUserAsync("uno@camiones.test");

        var equipped = new DriverLoadout
        {
            DriverId = driver,
            Slot = LoadoutSlot.Hat,
            RewardCode = "gorra-vieja"
        };

        _db.Loadout.Add(equipped);
        await _db.SaveChangesAsync();

        equipped.RewardCode = "gorra-nueva";
        await _db.SaveChangesAsync();

        var hats = await _db.Loadout
            .Where(l => l.DriverId == driver && l.Slot == LoadoutSlot.Hat)
            .ToListAsync();

        Assert.Equal("gorra-nueva", Assert.Single(hats).RewardCode);
    }

    /// <remarks>
    /// Lo que hace valioso a un record es <b>cuando</b> ocurrio, asi que la fecha
    /// tiene que sobrevivir la ida y vuelta por el conversor a ticks. Es la misma
    /// trampa que dejo el historial ilegible en AD-20.
    /// </remarks>
    [Fact]
    public async Task A_record_keeps_the_exact_moment_it_was_achieved()
    {
        var driver = await CreateUserAsync("uno@camiones.test");
        var cuando = new DateTimeOffset(2026, 3, 14, 9, 26, 53, TimeSpan.Zero);

        _db.Records.Add(new DriverRecord
        {
            DriverId = driver,
            RecordCode = "km-en-un-dia",
            Value = 812,
            AchievedAt = cuando
        });

        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var leido = await _db.Records.SingleAsync();

        Assert.Equal(812, leido.Value);
        Assert.Equal(cuando, leido.AchievedAt);
    }

    /// <remarks>
    /// Borrar la cuenta se lleva toda su progresion. Es historial de esa persona y
    /// no tiene sentido sin ella; ademas, dejar filas huerfanas con su identificador
    /// seria guardar datos de alguien que se fue.
    /// </remarks>
    [Fact]
    public async Task Deleting_the_account_takes_the_whole_progression()
    {
        var driver = await CreateUserAsync("uno@camiones.test");

        _db.LedgerEntries.Add(Credit(driver, "viajes:1"));
        _db.TrackProgress.Add(new DriverTrackProgress { DriverId = driver, TrackCode = "viajes", Count = 10, TierReached = 1 });
        _db.Rewards.Add(new DriverReward { DriverId = driver, RewardCode = "gorra", UnlockedAt = DateTimeOffset.UtcNow });
        _db.Loadout.Add(new DriverLoadout { DriverId = driver, Slot = LoadoutSlot.Hat, RewardCode = "gorra" });
        _db.Records.Add(new DriverRecord { DriverId = driver, RecordCode = "km-en-un-dia", Value = 812, AchievedAt = DateTimeOffset.UtcNow });
        _db.ProgressMarks.Add(new DriverProgressMark { DriverId = driver, CelebratedUpTo = DateTimeOffset.UtcNow });

        await _db.SaveChangesAsync();

        _db.Users.Remove(await _db.Users.SingleAsync(u => u.Id == driver));
        await _db.SaveChangesAsync();

        Assert.Empty(await _db.LedgerEntries.ToListAsync());
        Assert.Empty(await _db.TrackProgress.ToListAsync());
        Assert.Empty(await _db.Rewards.ToListAsync());
        Assert.Empty(await _db.Loadout.ToListAsync());
        Assert.Empty(await _db.Records.ToListAsync());
        Assert.Empty(await _db.ProgressMarks.ToListAsync());
    }
}
