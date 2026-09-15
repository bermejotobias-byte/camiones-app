using TruckNavigator.Domain.Pois;
using TruckNavigator.Infrastructure.Pois;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Candados sobre los datasets que se publican con la app.
/// </summary>
/// <remarks>
/// Son la contraparte mecanica de la regla del proyecto: nada entra al sistema sin
/// fuente citable, y los datos que acompanan al MVP tienen que quedar distinguibles de
/// un relevamiento verificado para produccion. Si alguien agrega un punto inventado o
/// sin fuente, estos tests lo frenan antes de que llegue al mapa.
/// </remarks>
public class PoiDatasetTests
{
    private static readonly IReadOnlyList<PointOfInterest> Dataset = PoiDataset.Load();

    [Fact]
    public void The_shipped_dataset_parses_and_is_not_empty()
    {
        Assert.NotEmpty(Dataset);
    }

    [Fact]
    public void Every_point_declares_its_source()
    {
        Assert.All(Dataset, poi =>
        {
            Assert.False(
                string.IsNullOrWhiteSpace(poi.Source),
                $"El punto '{poi.Name}' no declara fuente.");

            Assert.NotEqual(default, poi.SourceRetrievedOn);
        });
    }

    /// <summary>
    /// Los datasets de agosto de 2026 son el dato inicial del MVP; todo lo relevado
    /// desde septiembre es produccion. La fecha de consulta es lo que los separa.
    /// </summary>
    [Fact]
    public void Sample_data_is_the_august_2026_datasets_only()
    {
        var september = new DateOnly(2026, 9, 1);

        Assert.All(Dataset, poi => Assert.True(
            (poi.SourceRetrievedOn < september) == poi.IsSampleData,
            $"El punto '{poi.Name}' (consultado {poi.SourceRetrievedOn}) tiene IsSampleData = {poi.IsSampleData}."));
    }

    /// <summary>
    /// Todo lo que sale de los archivos embebidos es del seed: sin esta marca, un
    /// archivo con isSampleData en false se reinsertaria en cada arranque.
    /// </summary>
    [Fact]
    public void Every_point_loaded_from_files_is_managed_by_the_dataset()
    {
        Assert.All(Dataset, poi => Assert.True(poi.ManagedByDataset, poi.Name));
    }

    [Fact]
    public void Ids_are_unique()
    {
        var duplicated = Dataset
            .GroupBy(poi => poi.Id)
            .Where(group => group.Count() > 1)
            .Select(group => group.First().Name)
            .ToList();

        Assert.True(
            duplicated.Count == 0,
            "Puntos con id repetido (fuentes identicas): " + string.Join(", ", duplicated));
    }

    /// <summary>
    /// Dos puntos de la misma categoria a menos de 25 m son la misma estacion dos
    /// veces. Paso con el registro oficial de estaciones: una misma boca figura con
    /// dos idempresa (liquidos y GNC), y como la fuente es el id, salian dos puntos
    /// encimados en el mapa.
    /// </summary>
    [Fact]
    public void No_two_points_of_the_same_category_share_the_same_spot()
    {
        var encimados = new List<string>();
        var lista = Dataset.ToList();
        for (var i = 0; i < lista.Count; i++)
            for (var j = i + 1; j < lista.Count; j++)
            {
                if (lista[i].Category != lista[j].Category) continue;
                if (Metros(lista[i], lista[j]) < 25) encimados.Add(lista[i].Name + " / " + lista[j].Name);
            }

        Assert.True(encimados.Count == 0, "Puntos encimados: " + string.Join("; ", encimados));
    }

    private static double Metros(PointOfInterest a, PointOfInterest b)
    {
        const double radio = 6_371_000;
        var dLat = (b.Latitude - a.Latitude) * Math.PI / 180;
        var dLon = (b.Longitude - a.Longitude) * Math.PI / 180;
        var s = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(a.Latitude * Math.PI / 180) * Math.Cos(b.Latitude * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * radio * Math.Asin(Math.Sqrt(s));
    }

    [Fact]
    public void Every_point_has_a_name_and_a_known_category()
    {
        Assert.All(Dataset, poi =>
        {
            Assert.False(string.IsNullOrWhiteSpace(poi.Name));
            Assert.True(Enum.IsDefined(poi.Category));
        });
    }

    /// <summary>
    /// El alcance es CABA mas el anillo de acceso (spec del 15/09/2026, §3): la General
    /// Paz con sus colectoras, el Mercado Central, Dock Sud y los accesos. Un punto mas
    /// lejos no le sirve a un viaje que empieza o termina en la Ciudad.
    /// </summary>
    [Fact]
    public void Every_point_falls_inside_caba_and_its_access_ring()
    {
        Assert.All(Dataset, poi =>
        {
            Assert.InRange(poi.Latitude, -34.725, -34.505);
            Assert.InRange(poi.Longitude, -58.555, -58.315);
        });
    }

    /// <summary>
    /// El nivel de verificacion tiene que corresponderse con el tipo de evidencia:
    /// Confirmed se apoya en el operador, una fuente oficial o el testimonio de
    /// conductores; Probable en señales indirectas; NotConfirmed en nada. Y toda
    /// evidencia lleva fecha, porque las reseñas envejecen. Es la misma separacion
    /// que hace el motor de restricciones entre el origen de la regla y el del dato.
    /// </summary>
    [Fact]
    public void The_verification_level_matches_the_kind_of_evidence()
    {
        Assert.All(Dataset, poi =>
        {
            var expected = poi.SuitabilityEvidenceKind switch
            {
                SuitabilityEvidenceKind.Operator or SuitabilityEvidenceKind.Official or SuitabilityEvidenceKind.Reviews
                    => VerificationLevel.Confirmed,
                SuitabilityEvidenceKind.Signals => VerificationLevel.Probable,
                _ => VerificationLevel.NotConfirmed
            };

            Assert.True(
                expected == poi.VerificationLevel,
                $"'{poi.Name}': evidencia {poi.SuitabilityEvidenceKind} pero nivel {poi.VerificationLevel}.");

            if (poi.SuitabilityEvidenceKind != SuitabilityEvidenceKind.None)
            {
                Assert.False(string.IsNullOrWhiteSpace(poi.SuitabilityEvidence), $"'{poi.Name}' no escribe su evidencia.");
                Assert.Matches(@"\d{1,2}/\d{2}/20\d{2}", poi.SuitabilityEvidence);
            }
        });
    }

    /// <summary>
    /// Una gomeria de autos o un restaurante sin playa no le sirven a nadie en esta
    /// app: esas dos categorias entran solo con evidencia (spec §6.3).
    /// </summary>
    [Fact]
    public void Tyre_shops_and_eateries_never_enter_without_evidence()
    {
        var strict = Dataset.Where(p =>
            p.Category is PoiCategory.TyreShop or PoiCategory.TruckFriendlyEatery
            && !p.IsSampleData);

        Assert.All(strict, poi => Assert.NotEqual(VerificationLevel.NotConfirmed, poi.VerificationLevel));
    }

    /// <summary>
    /// Los puntos importados de OSM no pueden declararse verificados: la fuente ubica
    /// el establecimiento, no certifica que reciba camiones.
    /// </summary>
    [Fact]
    public void Points_imported_from_osm_are_never_marked_confirmed()
    {
        var fromOsm = Dataset.Where(p =>
            p.Source.StartsWith("OpenStreetMap", StringComparison.OrdinalIgnoreCase));

        Assert.NotEmpty(fromOsm);

        Assert.All(fromOsm, poi => Assert.NotEqual(VerificationLevel.Confirmed, poi.VerificationLevel));
    }
}
