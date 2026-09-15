using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Infrastructure.Pois;

namespace TruckNavigator.Infrastructure.Persistence;

/// <summary>
/// Carga los puntos de interes de los datasets embebidos a la base.
/// </summary>
/// <remarks>
/// A diferencia de <see cref="TruckProfileSeed"/>, no alcanza con "si la tabla esta
/// vacia, insertar": los datasets se regeneran (correr <c>data/fetch-caba-pois.ps1</c>)
/// y con ese criterio los cambios nunca llegarian a una base ya creada. En su lugar
/// hace upsert por id, que es determinístico a partir de la fuente.
///
/// Reconoce lo suyo por <see cref="PointOfInterest.ManagedByDataset"/>, no por
/// <see cref="PointOfInterest.IsSampleData"/>: hasta el 15/09/2026 filtraba por la
/// segunda, y un archivo de relevamiento con <c>isSampleData: false</c> se
/// reinsertaba en cada arranque y chocaba por clave en el segundo. Lo que haya
/// cargado el usuario u otro proceso (<c>ManagedByDataset = false</c> y un id que no
/// esta en los archivos) no se pisa ni se borra.
/// </remarks>
public static class PointOfInterestSeed
{
    public static Task ApplyAsync(AppDbContext db, CancellationToken cancellationToken = default) =>
        ApplyAsync(db, PoiDataset.Load(), cancellationToken);

    /// <summary>
    /// Siembra un dataset dado. Los tests lo usan para inyectar puntos sin tocar los
    /// archivos embebidos.
    /// </summary>
    public static async Task ApplyAsync(
        AppDbContext db,
        IReadOnlyList<PointOfInterest> dataset,
        CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);

        var datasetIds = dataset.Select(p => p.Id).ToHashSet();

        // Las filas del seed son las marcadas como suyas, mas las que coinciden por id
        // con el dataset aunque no esten marcadas: son las de una base creada antes de
        // la columna, y se adoptan en vez de duplicarse.
        var existing = await db.PointsOfInterest
            .Where(p => p.ManagedByDataset || datasetIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        foreach (var point in dataset)
        {
            if (existing.TryGetValue(point.Id, out var stored))
            {
                Copy(from: point, to: stored);
            }
            else
            {
                point.ManagedByDataset = true;
                db.PointsOfInterest.Add(point);
            }
        }

        // Un punto que salio del dataset (cerro, o la fuente dejo de listarlo) tiene que
        // desaparecer del mapa, no quedar como fantasma de una corrida anterior.
        var removed = existing.Values.Where(p => !datasetIds.Contains(p.Id)).ToList();

        if (removed.Count > 0)
        {
            db.PointsOfInterest.RemoveRange(removed);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static void Copy(PointOfInterest from, PointOfInterest to)
    {
        to.Name = from.Name;
        to.Category = from.Category;
        to.Address = from.Address;
        to.Neighbourhood = from.Neighbourhood;
        to.Latitude = from.Latitude;
        to.Longitude = from.Longitude;
        to.Phone = from.Phone;
        to.Website = from.Website;
        to.OpeningHours = from.OpeningHours;
        to.Description = from.Description;
        to.Services = from.Services;
        to.SuitableForLightTruck = from.SuitableForLightTruck;
        to.SuitableForHeavyTruck = from.SuitableForHeavyTruck;
        to.SuitableForSemiTrailer = from.SuitableForSemiTrailer;
        to.SuitableForTrailer = from.SuitableForTrailer;
        to.Source = from.Source;
        to.SourceRetrievedOn = from.SourceRetrievedOn;
        to.VerificationLevel = from.VerificationLevel;
        to.SuitabilityEvidence = from.SuitabilityEvidence;
        to.SuitabilityEvidenceKind = from.SuitabilityEvidenceKind;
        to.IsSampleData = from.IsSampleData;
        to.ManagedByDataset = true;
    }
}
