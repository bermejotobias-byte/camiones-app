using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Progression;

namespace TruckNavigator.Infrastructure.Reports;

/// <summary>
/// Lo que vuelve despues de crear: el reporte, o por que no —el que ya habia
/// cerca, cuanto esperar, o el motivo escrito para la persona—.
/// </summary>
public sealed record CreateReportResult(
    Report? Report,
    Guid? DuplicateOf,
    int RetryAfterSeconds,
    string? Error);

/// <summary>
/// Crear un reporte: la guardia contra el abuso con lo que hay en la base, y la
/// calle de Photon solo si el cliente no la sabia y llega a tiempo.
/// </summary>
/// <remarks>
/// <para>
/// Un reporte no se demora ni se rechaza por la calle: el geocoder tiene
/// <see cref="StreetLookupTimeout"/> y si no llega la calle queda en null. La
/// ficha dice "cerca de aca" y no inventa.
/// </para>
/// <para>
/// Crear no paga EXP (spec del 19/09/2026): lo que paga es que otros lo
/// validen, y eso pasa al votar.
/// </para>
/// </remarks>
public sealed class ReportWriter(AppDbContext db, ProgressionRecorder progression, IPlaceSearch places)
{
    /// <summary>Cuanto se espera a Photon por la calle. Mas que esto, sin calle.</summary>
    public static readonly TimeSpan StreetLookupTimeout = TimeSpan.FromMilliseconds(1500);

    /// <summary>Hasta donde se buscan duplicados: un poco mas que el umbral, en grados.</summary>
    private const double DuplicateSearchDegrees = 0.003;

    public async Task<CreateReportResult> CreateAsync(
        Guid driverId,
        NewReport input,
        DateTimeOffset when,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);

        Report report;

        try
        {
            // El dominio valida antes de tocar la base: area y valor. Tira con motivo.
            report = Report.Create(driverId, input, when);
        }
        catch (ArgumentException error)
        {
            return new CreateReportResult(null, null, 0, ForThePerson(error));
        }

        var reputation = await ReputationOfAsync(driverId, ct);
        var mine = await RecentOfAsync(driverId, when, ct);
        var nearby = await ActiveNearAsync(input, when, ct);

        var verdict = ReportAbuseGuard.Check(input, mine, nearby, reputation, when);

        if (!verdict.Allowed)
        {
            return new CreateReportResult(null, verdict.DuplicateOf, verdict.RetryAfterSeconds, verdict.Reason);
        }

        report.Street ??= await StreetOfAsync(input, ct);

        db.Reports.Add(report);
        await db.SaveChangesAsync(ct);

        return new CreateReportResult(report, null, 0, null);
    }

    /// <summary>La reputacion de un camionero: la fila, o el arranque si no hay.</summary>
    public async Task<int> ReputationOfAsync(Guid driverId, CancellationToken ct = default)
    {
        var row = await db.DriverReputations.AsNoTracking().FirstOrDefaultAsync(r => r.DriverId == driverId, ct);

        return row?.Score ?? ReputationScale.Start;
    }

    private async Task<List<RecentReport>> RecentOfAsync(Guid driverId, DateTimeOffset when, CancellationToken ct)
    {
        var since = when - TimeSpan.FromHours(1);

        return await db.Reports
            .AsNoTracking()
            .Where(r => r.CreatedBy == driverId && r.CreatedAt > since)
            .Select(r => new RecentReport(r.Type, r.Latitude, r.Longitude, r.CreatedAt, r.Id, r.ExpiresAt == null || r.ExpiresAt > when))
            .ToListAsync(ct);
    }

    private async Task<List<RecentReport>> ActiveNearAsync(NewReport input, DateTimeOffset when, CancellationToken ct)
    {
        var since = when - ReportAbuseGuard.DuplicateWindow;

        return await db.Reports
            .AsNoTracking()
            .Where(r => r.Type == input.Type
                        && r.CreatedAt > since
                        && (r.ExpiresAt == null || r.ExpiresAt > when)
                        && r.Latitude > input.Latitude - DuplicateSearchDegrees
                        && r.Latitude < input.Latitude + DuplicateSearchDegrees
                        && r.Longitude > input.Longitude - DuplicateSearchDegrees
                        && r.Longitude < input.Longitude + DuplicateSearchDegrees)
            .Select(r => new RecentReport(r.Type, r.Latitude, r.Longitude, r.CreatedAt, r.Id, true))
            .ToListAsync(ct);
    }

    private async Task<string?> StreetOfAsync(NewReport input, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(StreetLookupTimeout);

        try
        {
            var place = await places.ReverseAsync(new GeoPoint(input.Latitude, input.Longitude), timeout.Token);

            return string.IsNullOrWhiteSpace(place?.Label) ? null : place.Label;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // Se acabo el tiempo de la calle, no el pedido: el reporte sigue.
            return null;
        }
        catch (Exception)
        {
            // Un geocoder caido no puede impedir un reporte. Photon ya loguea lo suyo.
            return null;
        }
    }

    /// <summary>
    /// <c>ArgumentException.Message</c> arrastra "(Parameter 'x')", que no es para
    /// una persona. Se recorta.
    /// </summary>
    private static string ForThePerson(ArgumentException error)
    {
        var message = error.Message;
        var cut = message.IndexOf(" (Parameter", StringComparison.Ordinal);

        return cut < 0 ? message : message[..cut];
    }
}
