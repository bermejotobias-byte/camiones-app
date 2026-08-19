using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Infrastructure.Persistence;

/// <summary>
/// Perfiles de ejemplo para poder probar el MVP sin cargar datos a mano.
/// </summary>
/// <remarks>
/// Los valores son de prueba y no representan limites legales. Quedan marcados
/// con <see cref="TruckProfile.IsSampleData"/> para que se puedan distinguir de
/// los vehiculos que cargue el usuario.
/// </remarks>
public static class TruckProfileSeed
{
    // Ids fijos para que el seed sea idempotente entre arranques.
    private static readonly Guid LightId = new("6f0f1f9c-1a2b-4c3d-8e4f-000000000001");
    private static readonly Guid HeavyId = new("6f0f1f9c-1a2b-4c3d-8e4f-000000000002");
    private static readonly Guid SemiId = new("6f0f1f9c-1a2b-4c3d-8e4f-000000000003");

    public static IReadOnlyList<TruckProfile> Profiles { get; } =
    [
        new TruckProfile
        {
            Id = LightId,
            Name = "Camion liviano",
            GrossWeightKg = 7_500,
            HeightMeters = 3.20,
            WidthMeters = 2.40,
            LengthMeters = 8.00,
            NumberOfAxles = 2,
            VehicleType = VehicleType.RigidTruck,
            HasTrailer = false,
            IsSampleData = true
        },
        new TruckProfile
        {
            Id = HeavyId,
            Name = "Camion pesado",
            GrossWeightKg = 18_000,
            HeightMeters = 3.80,
            WidthMeters = 2.50,
            LengthMeters = 12.00,
            NumberOfAxles = 3,
            VehicleType = VehicleType.RigidTruck,
            HasTrailer = false,
            IsSampleData = true
        },
        new TruckProfile
        {
            Id = SemiId,
            Name = "Semirremolque",
            GrossWeightKg = 40_000,
            HeightMeters = 4.20,
            WidthMeters = 2.55,
            LengthMeters = 6.00,
            NumberOfAxles = 5,
            VehicleType = VehicleType.SemiTrailer,
            HasTrailer = true,
            TrailerLengthMeters = 12.00,
            IsSampleData = true
        }
    ];

    public static async Task ApplyAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);

        if (await db.TruckProfiles.AnyAsync(cancellationToken))
        {
            return;
        }

        db.TruckProfiles.AddRange(Profiles);
        await db.SaveChangesAsync(cancellationToken);
    }
}
