using System.Text.Json;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Reports;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El contrato de los reportes tal como cruza el HTTP: enums en texto, la clase
/// en minuscula como la lee la app, el vencimiento nulo de lo fijo, y lo que el
/// reporte le dice al camion.
/// </summary>
public class ReportContractsTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static readonly DateTimeOffset When = new(2026, 9, 19, 12, 0, 0, TimeSpan.FromHours(-3));

    private static Report Make(ReportType type, double? value = null)
    {
        var report = Report.Create(Guid.NewGuid(), new NewReport(type, -34.6037, -58.3816, 95, 8, "Av. Corrientes 1500", value), When);
        report.Confirmations = 2;
        return report;
    }

    private static TruckProfile Tall() => new()
    {
        Name = "Alto",
        GrossWeightKg = 18_000,
        HeightMeters = 4.1,
        WidthMeters = 2.5,
        LengthMeters = 12,
        NumberOfAxles = 3
    };

    [Fact]
    public void A_low_clearance_crosses_the_wire_as_a_restriction_with_what_it_says_to_your_truck()
    {
        var report = Make(ReportType.LowClearance, 3.8);
        report.Status = ReportStatus.Validated;
        var view = ReportViews.Build(report, 50, Tall(), report.CreatedBy, "elgaucho", null, When.AddMinutes(5));

        var json = JsonSerializer.Serialize(ReportDto.From(view), Web);

        Assert.Contains("\"type\":\"LowClearance\"", json);
        Assert.Contains("\"kind\":\"restriction\"", json);
        Assert.Contains("\"value\":3.8", json);
        Assert.Contains("\"street\":\"Av. Corrientes 1500\"", json);
        Assert.Contains("\"headingDegrees\":95", json);
        Assert.Contains("\"status\":\"Validated\"", json);
        Assert.Contains("\"validated\":true", json);
        Assert.Contains("\"fixed\":false", json);
        Assert.Contains("\"forYourTruck\":\"incompatible\"", json);
        Assert.Contains("\"reportedBy\":{\"alias\":\"elgaucho\"}", json);
        Assert.Contains("\"mine\":true", json);
        Assert.Contains("\"yourVote\":null", json);
        Assert.Contains("\"reliability\":{\"score\":74,\"label\":\"confirmed\"}", json);
        Assert.Contains("\"confirmations\":2", json);
    }

    [Fact]
    public void A_fixed_camera_has_no_expiry_and_information_has_no_truck_verdict()
    {
        var camera = Make(ReportType.Camera);
        ReportPromotion.Fix(camera);
        var view = ReportViews.Build(camera, 50, Tall(), null, null, ReportVerdict.StillThere, When);

        var json = JsonSerializer.Serialize(ReportDto.From(view), Web);

        Assert.Contains("\"kind\":\"info\"", json);
        Assert.Contains("\"expiresAt\":null", json);
        Assert.Contains("\"fixed\":true", json);
        Assert.Contains("\"forYourTruck\":null", json);
        Assert.Contains("\"yourVote\":\"StillThere\"", json);
        Assert.Contains("\"reportedBy\":{\"alias\":null}", json);
        Assert.Contains("\"mine\":false", json);
    }

    [Fact]
    public void A_disputed_report_says_so_in_lowercase()
    {
        var report = Make(ReportType.Accident);
        report.Confirmations = 1;
        report.Rejections = 1;
        var view = ReportViews.Build(report, 50, null, null, null, null, When);

        var json = JsonSerializer.Serialize(ReportDto.From(view), Web);

        Assert.Contains("\"label\":\"disputed\"", json);
    }

    [Fact]
    public void The_create_request_reads_the_type_by_name()
    {
        var request = JsonSerializer.Deserialize<CreateReportRequest>(
            "{\"type\":\"LowClearance\",\"latitude\":-34.6,\"longitude\":-58.4,\"headingDegrees\":90,\"speedMps\":6,\"street\":null,\"value\":3.8}",
            Web);

        Assert.NotNull(request);
        Assert.Equal("LowClearance", request!.Type);
        Assert.Equal(3.8, request.Value);
        Assert.Equal(90, request.HeadingDegrees);
    }

    [Fact]
    public void The_vote_request_reads_the_verdict_by_name_and_carries_the_position()
    {
        var request = JsonSerializer.Deserialize<ReportVoteRequest>(
            "{\"verdict\":\"Gone\",\"latitude\":-34.6,\"longitude\":-58.4}",
            Web);

        Assert.NotNull(request);
        Assert.Equal("Gone", request!.Verdict);
        Assert.Equal(-34.6, request.Latitude);
    }
}
