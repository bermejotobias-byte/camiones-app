using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La confiabilidad de un reporte: la formula propia de la spec del 19/09/2026,
/// con sus ejemplos fijados por test.
/// </summary>
/// <remarks>
/// score = clamp((35 + 0,30 x reputacion + 12 x min(confirmaciones, 4) - 18 x rechazos) x frescura)
/// con frescura = 1 - 0,40 x (edad / vida util), acotada. Los ejemplos de abajo
/// son los de la spec, palabra por palabra: si la formula cambia, cambian ellos.
/// </remarks>
public class ReportStandingTests
{
    private static readonly DateTimeOffset Created = new(2026, 9, 19, 10, 0, 0, TimeSpan.FromHours(-3));

    private static Report Fresh(int confirmations = 0, int rejections = 0, ReportType type = ReportType.Accident)
    {
        var report = Report.Create(
            Guid.NewGuid(),
            new NewReport(type, -34.6037, -58.3816, null, null, null, null),
            Created);

        report.Confirmations = confirmations;
        report.Rejections = rejections;
        return report;
    }

    [Theory]
    [InlineData(50, 0, 0, 50)]    // recien creado, reputacion promedio
    [InlineData(50, 2, 0, 74)]    // dos confirmaciones
    [InlineData(50, 2, 1, 56)]    // dos confirmaciones y un rechazo
    [InlineData(90, 0, 0, 62)]    // reputacion alta, sin votos
    [InlineData(10, 0, 0, 38)]    // reputacion baja
    [InlineData(10, 2, 0, 62)]    // baja con dos confirmaciones: no llega a validarse
    [InlineData(10, 3, 0, 74)]    // baja con tres: si
    [InlineData(90, 5, 0, 100)]   // la quinta confirmacion ya no suma, y el tope es 100
    [InlineData(0, 0, 3, 0)]      // nunca por debajo de cero
    public void The_examples_of_the_spec(int reputation, int confirmations, int rejections, int expected)
    {
        var score = ReportStanding.ScoreFor(Fresh(confirmations, rejections), reputation, Created);

        Assert.Equal(expected, score);
    }

    [Fact]
    public void Freshness_drops_up_to_forty_percent_as_the_report_ages()
    {
        var report = Fresh();
        var lifetime = ReportCatalog.Get(ReportType.Accident).Lifetime;

        Assert.Equal(40, ReportStanding.ScoreFor(report, 50, Created + lifetime / 2));
        Assert.Equal(30, ReportStanding.ScoreFor(report, 50, Created + lifetime));

        // Mas alla de la vida util no sigue cayendo: la edad se acota a la vida.
        Assert.Equal(30, ReportStanding.ScoreFor(report, 50, Created + lifetime * 3));
    }

    [Fact]
    public void A_fixed_report_is_always_fresh()
    {
        var camera = Fresh(type: ReportType.Camera);
        camera.Status = ReportStatus.Fixed;
        camera.ExpiresAt = null;

        Assert.Equal(50, ReportStanding.ScoreFor(camera, 50, Created.AddDays(400)));
    }

    [Fact]
    public void A_high_reputation_alone_does_not_make_it_confirmed()
    {
        var report = Fresh();

        Assert.Equal(ReliabilityLabel.New, ReportStanding.LabelFor(report, 62));
    }

    [Theory]
    [InlineData(1, 0, 62, ReliabilityLabel.Confirmed)]
    [InlineData(1, 0, 55, ReliabilityLabel.New)]        // confirmado pero con el score bajo
    [InlineData(1, 1, 60, ReliabilityLabel.Disputed)]
    [InlineData(0, 1, 40, ReliabilityLabel.Disputed)]
    [InlineData(3, 1, 80, ReliabilityLabel.Confirmed)]  // un rechazo solo no alcanza contra tres
    public void The_label_reads_the_votes_and_the_score(int confirmations, int rejections, int score, ReliabilityLabel expected)
    {
        Assert.Equal(expected, ReportStanding.LabelFor(Fresh(confirmations, rejections), score));
    }

    [Theory]
    [InlineData(2, 74, true)]
    [InlineData(2, 62, false)]   // dos confirmaciones pero el score no llega
    [InlineData(1, 80, false)]   // el score llega pero falta una confirmacion
    [InlineData(3, 70, true)]
    public void Validation_needs_two_confirmations_and_seventy(int confirmations, int score, bool expected)
    {
        Assert.Equal(expected, ReportStanding.IsValidated(Fresh(confirmations), score));
    }

    [Fact]
    public void The_constants_are_the_ones_of_the_spec()
    {
        Assert.Equal(35, ReportStanding.Base);
        Assert.Equal(0.30, ReportStanding.PerReputationPoint);
        Assert.Equal(12, ReportStanding.PerConfirmation);
        Assert.Equal(4, ReportStanding.MaxCountedConfirmations);
        Assert.Equal(18, ReportStanding.PerRejection);
        Assert.Equal(0.40, ReportStanding.FreshnessDrop);
        Assert.Equal(60, ReportStanding.ConfirmedFrom);
        Assert.Equal(70, ReportStanding.ValidatedFrom);
        Assert.Equal(2, ReportStanding.ValidatedConfirmations);
    }
}
