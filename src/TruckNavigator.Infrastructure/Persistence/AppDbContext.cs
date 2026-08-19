using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TruckProfile> TruckProfiles => Set<TruckProfile>();

    public DbSet<PointOfInterest> PointsOfInterest => Set<PointOfInterest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var truck = modelBuilder.Entity<TruckProfile>();

        truck.HasKey(t => t.Id);
        truck.Property(t => t.Name).IsRequired().HasMaxLength(120);
        truck.Property(t => t.VehicleType).HasConversion<string>().HasMaxLength(32);

        // Propiedades calculadas: viven en el dominio, no en la tabla.
        truck.Ignore(t => t.GrossWeightTons);
        truck.Ignore(t => t.TotalLengthMeters);

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
    }
}
