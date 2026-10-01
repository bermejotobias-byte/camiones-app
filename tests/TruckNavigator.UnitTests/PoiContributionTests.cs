using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Como nace un lugar que carga un camionero.
/// </summary>
/// <remarks>
/// Nace sin aptitud verificada y fuera del dataset: la aptitud verificada la
/// escribe un relevamiento con fuente, y lo que la comunidad opina va en los
/// votos. Es lo que hace que lo aportado complemente y no reemplace (decision
/// del usuario del 15/09/2026).
/// </remarks>
public class PoiContributionTests
{
    private static readonly DateTimeOffset When = new(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(-3));

    [Fact]
    public void A_contributed_place_is_born_unverified_and_outside_the_dataset()
    {
        var driver = Guid.NewGuid();

        var poi = PoiContribution.Create(driver, "Gomería del Puerto", PoiCategory.TyreShop, -34.65, -58.36, "Debenedetti 100", null, When);

        Assert.Equal(VerificationLevel.NotConfirmed, poi.VerificationLevel);
        Assert.Equal(SuitabilityEvidenceKind.None, poi.SuitabilityEvidenceKind);
        Assert.Null(poi.SuitabilityEvidence);
        Assert.Null(poi.SuitableForLightTruck);
        Assert.Null(poi.SuitableForHeavyTruck);
        Assert.Null(poi.SuitableForSemiTrailer);
        Assert.Null(poi.SuitableForTrailer);
        Assert.False(poi.ManagedByDataset);
        Assert.False(poi.IsSampleData);
        Assert.Equal(driver, poi.ContributedBy);
        Assert.Equal(When, poi.ContributedAt);
        Assert.Equal(new DateOnly(2026, 9, 15), poi.SourceRetrievedOn);
        Assert.Contains("comunidad", poi.Source);
        Assert.Contains("15/09/2026", poi.Source);
        Assert.Equal("Debenedetti 100", poi.Address);
        Assert.NotEqual(Guid.Empty, poi.Id);
    }

    /// <remarks>
    /// La fecha de la fuente es la LOCAL: un aporte a las 23:00 de Buenos Aires es
    /// del dia en que se hizo, no del siguiente en UTC.
    /// </remarks>
    [Fact]
    public void The_source_date_is_the_local_date()
    {
        var lateAtNight = new DateTimeOffset(2026, 9, 16, 1, 30, 0, TimeSpan.Zero); // 22:30 del 15 en Buenos Aires

        var poi = PoiContribution.Create(Guid.NewGuid(), "Parador", PoiCategory.TruckFriendlyEatery, -34.6, -58.4, null, null, lateAtNight);

        Assert.Equal(new DateOnly(2026, 9, 15), poi.SourceRetrievedOn);
    }

    [Theory]
    [InlineData(-34.80, -58.40)]   // al sur del anillo
    [InlineData(-34.60, -58.60)]   // al oeste
    [InlineData(-34.50, -58.40)]   // al norte, sobre el rio
    public void A_place_outside_caba_and_its_ring_is_refused(double lat, double lon)
    {
        var ex = Assert.Throws<ArgumentException>(() =>
            PoiContribution.Create(Guid.NewGuid(), "Afuera", PoiCategory.FuelStation, lat, lon, null, null, When));

        Assert.Contains("CABA", ex.Message);
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("   ")]
    [InlineData(null)]
    public void A_name_that_is_too_short_is_refused(string? name)
    {
        Assert.Throws<ArgumentException>(() =>
            PoiContribution.Create(Guid.NewGuid(), name!, PoiCategory.FuelStation, -34.6, -58.4, null, null, When));
    }

    [Fact]
    public void The_name_is_trimmed_and_capped_at_eighty()
    {
        var poi = PoiContribution.Create(Guid.NewGuid(), "  Parador  ", PoiCategory.TruckFriendlyEatery, -34.6, -58.4, null, null, When);

        Assert.Equal("Parador", poi.Name);

        Assert.Throws<ArgumentException>(() =>
            PoiContribution.Create(Guid.NewGuid(), new string('x', 81), PoiCategory.FuelStation, -34.6, -58.4, null, null, When));
    }

    [Fact]
    public void Blank_address_and_description_are_stored_as_nothing()
    {
        var poi = PoiContribution.Create(Guid.NewGuid(), "Parador", PoiCategory.TruckFriendlyEatery, -34.6, -58.4, "   ", "", When);

        Assert.Null(poi.Address);
        Assert.Null(poi.Description);
    }
}
