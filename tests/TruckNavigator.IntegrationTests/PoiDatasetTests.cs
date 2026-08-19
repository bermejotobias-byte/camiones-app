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
    /// Todo lo que se publica hoy es dataset inicial. El dia que se cargue un
    /// relevamiento verificado entrara con IsSampleData en false y habra que actualizar
    /// este test a proposito, no por accidente.
    /// </summary>
    [Fact]
    public void The_initial_dataset_is_marked_as_sample_data()
    {
        Assert.All(Dataset, poi => Assert.True(
            poi.IsSampleData,
            $"El punto '{poi.Name}' no esta marcado como dato inicial."));
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
    /// El dataset es de CABA. Se admite el conurbano porque hay prestadores de auxilio
    /// con base fuera de la Ciudad y cobertura declarada dentro, pero nada mas lejos.
    /// </summary>
    [Fact]
    public void Every_point_falls_inside_the_amba_box()
    {
        Assert.All(Dataset, poi =>
        {
            Assert.InRange(poi.Latitude, -35.20, -34.00);
            Assert.InRange(poi.Longitude, -59.30, -57.90);
        });
    }

    /// <summary>
    /// Un punto "confirmado" tiene que apoyarse en una fuente oficial o del operador,
    /// no en una etiqueta comunitaria. Es la misma separacion que hace el motor de
    /// restricciones entre el origen de la regla y el origen del dato.
    /// </summary>
    [Fact]
    public void Confirmed_points_do_not_rest_on_community_data_alone()
    {
        var confirmed = Dataset.Where(p => p.VerificationLevel == VerificationLevel.Confirmed);

        Assert.All(confirmed, poi => Assert.DoesNotContain(
            "OpenStreetMap",
            poi.Source,
            StringComparison.OrdinalIgnoreCase));
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
