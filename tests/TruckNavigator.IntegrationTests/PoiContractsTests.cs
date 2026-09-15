using System.Text.Json;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Infrastructure.Pois;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El contrato de los POIs, tal como cruza el HTTP: la evidencia tiene que llegar
/// a la ficha con su tipo, en texto, como la categoria y el nivel.
/// </summary>
public class PoiContractsTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void The_evidence_and_its_kind_cross_the_wire_as_text()
    {
        var poi = new PointOfInterest
        {
            Name = "Gomeria del Camionero",
            Category = PoiCategory.TyreShop,
            Source = "https://ejemplo.test (15/09/2026)",
            SourceRetrievedOn = new DateOnly(2026, 9, 15),
            VerificationLevel = VerificationLevel.Confirmed,
            SuitabilityEvidenceKind = SuitabilityEvidenceKind.Reviews,
            SuitabilityEvidence = "Según reseñas de conductores consultadas el 15/09/2026: entran semis."
        };

        var json = JsonSerializer.Serialize(PoiDto.From(poi, truck: null, community: null, contributedByAlias: null), Web);

        Assert.Contains("\"suitabilityEvidenceKind\":\"Reviews\"", json);
        Assert.Contains("\"suitabilityEvidence\":\"Seg", json);
        Assert.Contains("\"category\":\"TyreShop\"", json);
    }

    /// <remarks>
    /// Lo que la comunidad dice viaja aparte de lo verificado, con el sello en
    /// texto y el detalle para el tipo de camion del que consulta: la ficha tiene
    /// que poder mostrar "3 camioneros como vos lo recomiendan" y marcar distinto
    /// cada origen (decision del usuario del 15/09/2026).
    /// </remarks>
    [Fact]
    public void The_community_block_crosses_the_wire_with_the_detail_for_your_truck()
    {
        var driver = Guid.NewGuid();
        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, null, null,
            new DateTimeOffset(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3)));

        var community = new CommunityView(
            new CommunityCount(3, 1), CommunitySeal.Recommended,
            PoiSuitabilityField.SemiTrailer, new CommunityCount(3, 0), CommunitySeal.Recommended,
            PoiVerdict.Suitable);

        var json = JsonSerializer.Serialize(PoiDto.From(poi, truck: null, community, contributedByAlias: "tobi"), Web);

        Assert.Contains("\"community\":{", json);
        Assert.Contains("\"suitable\":3,\"notSuitable\":1,\"seal\":\"Recommended\"", json);
        Assert.Contains("\"forYourTruck\":{\"truckClass\":\"SemiTrailer\",\"suitable\":3,\"notSuitable\":0,\"seal\":\"Recommended\"}", json);
        Assert.Contains("\"yourVote\":\"Suitable\"", json);
        Assert.Contains("\"contributed\":{\"at\":\"2026-09-15\",\"byAlias\":\"tobi\"}", json);
    }

    [Fact]
    public void A_surveyed_place_has_no_contributed_block_and_no_detail_without_a_truck()
    {
        var poi = new PointOfInterest
        {
            Name = "Gomeria del Camionero",
            Category = PoiCategory.TyreShop,
            Source = "https://ejemplo.test (15/09/2026)",
            SourceRetrievedOn = new DateOnly(2026, 9, 15)
        };

        var community = new CommunityView(new CommunityCount(0, 0), CommunitySeal.NoVotesYet, null, null, null, null);

        var json = JsonSerializer.Serialize(PoiDto.From(poi, truck: null, community, contributedByAlias: null), Web);

        Assert.Contains("\"forYourTruck\":null", json);
        Assert.Contains("\"yourVote\":null", json);
        Assert.Contains("\"contributed\":null", json);
    }
}
