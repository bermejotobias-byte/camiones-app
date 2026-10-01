using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Con cinco votos de apto de un mismo tipo de camion, el lugar aportado se
/// incorpora a la base: Probable, con evidencia de la comunidad y apto para ese
/// tipo. Decision del usuario del 19/09/2026: "este mismo sistema se implementa
/// en marcar lugares nuevos de interes comun". Lo del dataset no se toca.
/// </summary>
public class PoiPromotionTests
{
    private static readonly DateTimeOffset When = new(2026, 9, 19, 23, 30, 0, TimeSpan.FromHours(-3));

    private static PointOfInterest Contributed() => PoiContribution.Create(
        Guid.NewGuid(),
        "Gomeria La Curva",
        PoiCategory.TyreShop,
        -34.6515,
        -58.4085,
        null,
        null,
        When.AddDays(-3));

    private static PointOfInterest FromDataset()
    {
        var poi = Contributed();
        poi.ManagedByDataset = true;
        poi.VerificationLevel = VerificationLevel.Confirmed;
        poi.SuitabilityEvidenceKind = SuitabilityEvidenceKind.Official;
        poi.SuitableForHeavyTruck = null;
        return poi;
    }

    [Fact]
    public void Five_suitable_votes_of_heavy_trucks_establish_the_place_for_heavy_trucks()
    {
        var poi = Contributed();

        var changed = PoiPromotion.Apply(poi, PoiSuitabilityField.HeavyTruck, suitable: 5, notSuitable: 0, When);

        Assert.True(changed);
        Assert.Equal(VerificationLevel.Probable, poi.VerificationLevel);
        Assert.Equal(SuitabilityEvidenceKind.Community, poi.SuitabilityEvidenceKind);
        Assert.True(poi.SuitableForHeavyTruck);
        Assert.Null(poi.SuitableForLightTruck);
        Assert.Null(poi.SuitableForSemiTrailer);
        Assert.Null(poi.SuitableForTrailer);
        Assert.Equal("Confirmado apto para camion pesado por 5 camioneros de la comunidad (19/09/2026)", poi.SuitabilityEvidence);
    }

    [Fact]
    public void Four_votes_change_nothing()
    {
        var poi = Contributed();

        Assert.False(PoiPromotion.Apply(poi, PoiSuitabilityField.HeavyTruck, 4, 0, When));
        Assert.Equal(VerificationLevel.NotConfirmed, poi.VerificationLevel);
        Assert.Null(poi.SuitableForHeavyTruck);
    }

    [Fact]
    public void Five_not_suitable_votes_settle_it_the_other_way()
    {
        var poi = Contributed();

        Assert.True(PoiPromotion.Apply(poi, PoiSuitabilityField.SemiTrailer, 1, 5, When));
        Assert.False(poi.SuitableForSemiTrailer);
        Assert.Equal(VerificationLevel.Probable, poi.VerificationLevel);
        Assert.Contains("no apto para semirremolque", poi.SuitabilityEvidence);
    }

    [Fact]
    public void Five_and_five_settle_nothing()
    {
        var poi = Contributed();

        Assert.False(PoiPromotion.Apply(poi, PoiSuitabilityField.HeavyTruck, 5, 5, When));
        Assert.Null(poi.SuitableForHeavyTruck);
    }

    [Fact]
    public void A_place_of_the_dataset_is_never_touched_by_votes()
    {
        var poi = FromDataset();

        Assert.False(PoiPromotion.Apply(poi, PoiSuitabilityField.HeavyTruck, 9, 0, When));
        Assert.Null(poi.SuitableForHeavyTruck);
        Assert.Equal(VerificationLevel.Confirmed, poi.VerificationLevel);
        Assert.Equal(SuitabilityEvidenceKind.Official, poi.SuitabilityEvidenceKind);
    }

    [Fact]
    public void Applying_again_does_not_rewrite_what_is_already_settled()
    {
        var poi = Contributed();
        PoiPromotion.Apply(poi, PoiSuitabilityField.HeavyTruck, 5, 0, When);
        var evidence = poi.SuitabilityEvidence;

        Assert.False(PoiPromotion.Apply(poi, PoiSuitabilityField.HeavyTruck, 6, 0, When.AddDays(10)));
        Assert.Equal(evidence, poi.SuitabilityEvidence);
    }

    [Fact]
    public void The_threshold_is_the_principle_of_five()
    {
        Assert.Equal(5, PoiPromotion.Threshold);
    }
}
