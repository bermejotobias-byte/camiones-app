using TruckNavigator.Domain.Restrictions;

namespace TruckNavigator.UnitTests;

public class CabaRestrictionEvaluatorTests
{
    private readonly CabaRestrictionEvaluator _evaluator = new();
    private static readonly DateTimeOffset Noon =
        new(2026, 8, 13, 12, 0, 0, TimeSpan.FromHours(-3));

    // ---------- Limites fisicos ----------

    [Fact]
    public void Truck_heavier_than_the_segment_weight_limit_is_forbidden()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle con limite de peso", MaxWeightTons: 10);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        Assert.False(verdict.IsAllowed);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.MaxWeight);
    }

    [Fact]
    public void Truck_taller_than_the_segment_clearance_is_forbidden()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Bajo puente", MaxHeightMeters: 3.50);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        Assert.False(verdict.IsAllowed);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.MaxHeight);
    }

    [Fact]
    public void Truck_shorter_than_the_segment_clearance_is_allowed()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Bajo puente alto", MaxHeightMeters: 4.00, Hgv: HgvAccess.Designated);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        Assert.True(verdict.IsAllowed);
        Assert.Empty(verdict.Findings);
    }

    [Fact]
    public void Length_check_uses_the_whole_combination_not_just_the_tractor()
    {
        // El tractor mide 6 m pero el conjunto mide 18 m.
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle angosta", MaxLengthMeters: 12);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.SemiTrailer(), Noon);

        Assert.False(verdict.IsAllowed);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.MaxLength);
    }

    [Fact]
    public void Segment_without_declared_limits_does_not_restrict_a_light_truck()
    {
        var segment = new RoadSegmentAttributes(StreetName: "Calle comun");

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Light(), Noon);

        Assert.True(verdict.IsAllowed);
        Assert.False(verdict.RequiresAccessException);
        Assert.Empty(verdict.Findings);
    }

    // ---------- Prohibicion explicita ----------

    [Fact]
    public void Segment_tagged_hgv_no_is_forbidden_even_for_a_light_truck()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle prohibida", Hgv: HgvAccess.No);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Light(), Noon);

        Assert.False(verdict.IsAllowed);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.HgvProhibited);
    }

    // ---------- Red de Transito Pesado ----------

    [Fact]
    public void Heavy_truck_on_the_heavy_traffic_network_is_allowed_without_conditions()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Av. Juan B. Justo", Hgv: HgvAccess.Designated);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        Assert.True(verdict.IsAllowed);
        Assert.False(verdict.RequiresAccessException);
        Assert.Empty(verdict.Findings);
    }

    [Fact]
    public void Heavy_truck_off_the_network_is_conditioned_but_not_forbidden()
    {
        // Este es el caso que NO hay que modelar como prohibicion: la normativa
        // habilita salir de la Red para llegar a origen y destino.
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle fuera de la Red", Hgv: HgvAccess.Missing);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        Assert.True(verdict.IsAllowed);
        Assert.True(verdict.RequiresAccessException);

        var finding = Assert.Single(verdict.Findings);
        Assert.Equal(RestrictionKind.OutsideHeavyTrafficNetwork, finding.Kind);
        Assert.Equal(RestrictionSourceType.CabaOfficial, finding.RuleSource);
        Assert.Contains("Ley 2148", finding.RuleReference);
    }

    [Fact]
    public void Truck_below_the_weight_threshold_may_use_streets_off_the_network()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle fuera de la Red", Hgv: HgvAccess.Missing);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Light(), Noon);

        Assert.True(verdict.IsAllowed);
        Assert.False(verdict.RequiresAccessException);
        Assert.Empty(verdict.Findings);
    }

    [Fact]
    public void Weight_threshold_is_exclusive_at_exactly_twelve_tonnes()
    {
        // La norma habla de peso "superior a 12 toneladas": 12 t justas no entra.
        var truck = SampleTrucks.Light();
        truck.GrossWeightKg = 12_000;

        var segment = new RoadSegmentAttributes(Hgv: HgvAccess.Missing);

        var verdict = _evaluator.Evaluate(segment, truck, Noon);

        Assert.False(verdict.RequiresAccessException);
    }

    // ---------- Combinaciones y trazabilidad ----------

    [Fact]
    public void All_violated_restrictions_are_reported_not_only_the_first()
    {
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle con varias restricciones",
            MaxWeightTons: 10,
            MaxHeightMeters: 3.50,
            MaxWidthMeters: 2.30,
            Hgv: HgvAccess.Missing);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        Assert.False(verdict.IsAllowed);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.MaxWeight);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.MaxHeight);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.MaxWidth);
        Assert.Contains(verdict.Findings, f => f.Kind == RestrictionKind.OutsideHeavyTrafficNetwork);
    }

    [Fact]
    public void Every_finding_carries_an_identifiable_rule_and_data_source()
    {
        // Criterio de exito nº 11 del MVP: toda restriccion usada tiene que
        // poder rastrearse a una fuente.
        var segment = new RoadSegmentAttributes(
            StreetName: "Calle con varias restricciones",
            MaxWeightTons: 10,
            MaxHeightMeters: 3.50,
            Hgv: HgvAccess.Missing);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.SemiTrailer(), Noon);

        Assert.NotEmpty(verdict.Findings);
        Assert.All(verdict.Findings, f =>
        {
            Assert.False(string.IsNullOrWhiteSpace(f.RuleReference));
            Assert.False(string.IsNullOrWhiteSpace(f.DataReference));
            Assert.False(string.IsNullOrWhiteSpace(f.Description));
        });
    }

    [Fact]
    public void Physical_limits_are_attributed_to_osm_and_network_rule_to_caba()
    {
        var segment = new RoadSegmentAttributes(
            MaxHeightMeters: 3.50, Hgv: HgvAccess.Missing);

        var verdict = _evaluator.Evaluate(segment, SampleTrucks.Heavy(), Noon);

        var height = verdict.Findings.Single(f => f.Kind == RestrictionKind.MaxHeight);
        Assert.Equal(RestrictionSourceType.Osm, height.RuleSource);

        var network = verdict.Findings.Single(f => f.Kind == RestrictionKind.OutsideHeavyTrafficNetwork);
        Assert.Equal(RestrictionSourceType.CabaOfficial, network.RuleSource);
        Assert.Equal(RestrictionSourceType.Osm, network.DataSource);
    }
}
