using System.Text.Json;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Pois;

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

        var json = JsonSerializer.Serialize(PoiDto.From(poi, truck: null), Web);

        Assert.Contains("\"suitabilityEvidenceKind\":\"Reviews\"", json);
        Assert.Contains("\"suitabilityEvidence\":\"Seg", json);
        Assert.Contains("\"category\":\"TyreShop\"", json);
    }
}
