using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;

namespace TruckNavigator.Infrastructure.Persistence;

/// <summary>
/// Contexto unico de la aplicacion: incluye las tablas de Identity y las del
/// dominio.
/// </summary>
/// <remarks>
/// Un solo contexto y no dos: la cuenta y el perfil del camionero se crean juntos
/// y conviene que entren en la misma transaccion. Partirlo obligaria a coordinar
/// dos <c>SaveChanges</c> sobre el mismo archivo SQLite sin ganar nada.
/// </remarks>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<TruckProfile> TruckProfiles => Set<TruckProfile>();

    public DbSet<PointOfInterest> PointsOfInterest => Set<PointOfInterest>();

    public DbSet<DriverProfile> DriverProfiles => Set<DriverProfile>();

    public DbSet<Trip> Trips => Set<Trip>();

    /// <summary>
    /// Guarda un instante como ticks UTC en lugar de texto.
    /// </summary>
    /// <remarks>
    /// <b>SQLite no sabe ordenar por <c>DateTimeOffset</c></b>: EF lo persiste como
    /// texto con el offset adelante, y un ORDER BY sobre eso seria alfabetico. El
    /// motor directamente lo rechaza con <c>NotSupportedException</c>, asi que el
    /// historial —que se lee del mas nuevo al mas viejo— no funcionaba.
    ///
    /// En ticks el orden es numerico y correcto, el indice sirve, y la precision
    /// no se pierde. Todas las fechas del sistema se escriben con <c>UtcNow</c>, de
    /// modo que no hay offset propio que preservar.
    /// </remarks>
    private static readonly ValueConverter<DateTimeOffset, long> UtcTicks = new(
        moment => moment.UtcTicks,
        ticks => new DateTimeOffset(ticks, TimeSpan.Zero));

    private static readonly ValueConverter<DateTimeOffset?, long?> NullableUtcTicks = new(
        moment => moment!.Value.UtcTicks,
        ticks => new DateTimeOffset(ticks!.Value, TimeSpan.Zero));

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Identity configura sus ocho tablas aca adentro. Tiene que ir primero:
        // lo que sigue ajusta sobre esa base.
        base.OnModelCreating(modelBuilder);

        var truck = modelBuilder.Entity<TruckProfile>();

        truck.HasKey(t => t.Id);
        truck.Property(t => t.Name).IsRequired().HasMaxLength(120);
        truck.Property(t => t.VehicleType).HasConversion<string>().HasMaxLength(32);

        // Propiedades calculadas: viven en el dominio, no en la tabla.
        truck.Ignore(t => t.GrossWeightTons);
        truck.Ignore(t => t.TotalLengthMeters);
        truck.Ignore(t => t.IsTemplate);

        // Un camion pertenece a una cuenta. OwnerId nulo es la plantilla del
        // catalogo, que no es de nadie y la ve todo el mundo.
        //
        // Al borrar la cuenta se borran sus camiones: son datos de esa persona y no
        // tienen sentido sin ella. Las plantillas no se tocan porque no cuelgan de
        // ningun usuario.
        truck.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(t => t.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        // Toda consulta de camiones filtra por dueno.
        truck.HasIndex(t => t.OwnerId);

        var poi = modelBuilder.Entity<PointOfInterest>();

        poi.HasKey(p => p.Id);
        poi.Property(p => p.Name).IsRequired().HasMaxLength(200);
        poi.Property(p => p.Category).HasConversion<string>().HasMaxLength(48);
        poi.Property(p => p.VerificationLevel).HasConversion<string>().HasMaxLength(32);
        poi.Property(p => p.Address).HasMaxLength(300);
        poi.Property(p => p.Neighbourhood).HasMaxLength(120);
        poi.Property(p => p.Phone).HasMaxLength(80);
        poi.Property(p => p.Website).HasMaxLength(300);
        poi.Property(p => p.OpeningHours).HasMaxLength(200);
        poi.Property(p => p.Description).HasMaxLength(1000);

        // La fuente es obligatoria a nivel de esquema: un punto sin origen citable no
        // deberia poder guardarse, del mismo modo que una restriccion no se emite sin
        // su referencia normativa.
        poi.Property(p => p.Source).IsRequired().HasMaxLength(600);

        // SQLite no tiene tipo lista. Se guarda como JSON, con el comparador que EF
        // necesita para detectar cambios: sin el, modificar la coleccion pasa
        // inadvertido porque la referencia sigue siendo la misma.
        poi.Property(p => p.Services)
            .HasConversion(
                services => JsonSerializer.Serialize(services, (JsonSerializerOptions?)null),
                json => JsonSerializer.Deserialize<List<string>>(json, (JsonSerializerOptions?)null)
                        ?? new List<string>(),
                new ValueComparer<IReadOnlyList<string>>(
                    (left, right) => left != null && right != null && left.SequenceEqual(right),
                    list => list.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
                    list => list.ToList()))
            .HasColumnType("TEXT");

        // Las consultas de la app siempre llegan filtradas por categoria.
        poi.HasIndex(p => p.Category);

        var driver = modelBuilder.Entity<DriverProfile>();

        // La clave es la misma que la del usuario de Identity: la relacion es uno a
        // uno y el perfil no tiene identidad propia sin su cuenta.
        driver.HasKey(d => d.Id);
        driver.Property(d => d.Alias).HasMaxLength(DriverAlias.MaxLength);
        driver.Property(d => d.NormalizedAlias).HasMaxLength(DriverAlias.MaxLength);
        driver.Property(d => d.FirstName).HasMaxLength(80);
        driver.Property(d => d.LastName).HasMaxLength(80);
        driver.Property(d => d.AvatarId).HasMaxLength(64);
        driver.Property(d => d.CreatedAt).HasConversion(UtcTicks);

        driver.Ignore(d => d.IsComplete);

        // "El nickname es unico e irrepetible". La regla de formato vive en el
        // dominio; la unicidad la hace cumplir la base, que es la unica que puede
        // verla entre todas las cuentas a la vez.
        //
        // El indice es sobre la forma normalizada, asi que "ElGaucho" y "elgaucho"
        // chocan. SQLite admite varios NULL en un indice unico, que es lo que
        // permite que convivan las cuentas que todavia no eligieron alias.
        driver.HasIndex(d => d.NormalizedAlias).IsUnique();

        // Borrar la cuenta borra el perfil. No tiene sentido que sobreviva.
        driver.HasOne<AppUser>()
            .WithOne()
            .HasForeignKey<DriverProfile>(d => d.Id)
            .OnDelete(DeleteBehavior.Cascade);

        var trip = modelBuilder.Entity<Trip>();

        trip.HasKey(t => t.Id);
        trip.Property(t => t.Status).HasConversion<string>().HasMaxLength(24);
        trip.Property(t => t.TruckName).IsRequired().HasMaxLength(120);
        trip.Property(t => t.OriginLabel).HasMaxLength(300);
        trip.Property(t => t.DestinationLabel).HasMaxLength(300);
        trip.Property(t => t.StartedAt).HasConversion(UtcTicks);
        trip.Property(t => t.FinishedAt).HasConversion(NullableUtcTicks);

        trip.Ignore(t => t.Elapsed);
        trip.Ignore(t => t.IsOpen);

        // El viaje es historial de la persona: si se borra la cuenta, se va con ella.
        trip.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(t => t.DriverId)
            .OnDelete(DeleteBehavior.Cascade);

        // Borrar un camion NO borra los viajes que se hicieron con el: la referencia
        // queda en null y el nombre copiado mantiene legible el historial.
        trip.HasOne<TruckProfile>()
            .WithMany()
            .HasForeignKey(t => t.TruckId)
            .OnDelete(DeleteBehavior.SetNull);

        // El historial se lee siempre por camionero y de lo mas nuevo a lo mas viejo.
        trip.HasIndex(t => new { t.DriverId, t.StartedAt });
    }
}
