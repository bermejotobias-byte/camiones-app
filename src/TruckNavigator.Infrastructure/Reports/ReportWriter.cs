using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Reports;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
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

/// <summary>Por que un voto no entro, o que entro.</summary>
public enum VoteOutcome
{
    Ok = 0,
    OwnReport = 1,
    TooFar = 2,
    NotFound = 3,
    Expired = 4
}

/// <summary>Lo que vuelve despues de votar: el reporte como queda, y lo que pago el voto.</summary>
public sealed record ReportVoteResult(VoteOutcome Outcome, ReportView? View, ContributionEarnings? Earned);

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

    /// <summary>Mas lejos que esto del reporte, el voto no cuenta: hay que pasar por el lugar.</summary>
    public const double VoteMaxMeters = 500;

    /// <summary>
    /// "Sigue ahi" o "ya no esta": la fila del voto, el recuento desde las filas,
    /// y lo que el recuento decide —validar, fijar, rechazar— con lo que eso paga
    /// y mueve, todo en una transaccion.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Un voto nuevo de "sigue ahi" estira el vencimiento; cambiar el voto no
    /// vuelve a estirar ni a pagar. Validado y fijo son estados escritos aca, y
    /// la primera vez que se cruza cada umbral es la unica que paga al creador y
    /// le mueve la reputacion.
    /// </para>
    /// <para>
    /// Rechazado gana a validado: dos "ya no esta" que superan a las
    /// confirmaciones matan el reporte aunque antes estuviera validado. Un cambio
    /// de voto que deja 1 a 1 no lo degrada: no llega a dos rechazos.
    /// </para>
    /// </remarks>
    public async Task<ReportVoteResult> VoteAsync(
        Guid driverId,
        Guid reportId,
        ReportVerdict verdict,
        double latitude,
        double longitude,
        TruckProfile? truck,
        DateTimeOffset when,
        CancellationToken ct = default)
    {
        var report = await db.Reports.FirstOrDefaultAsync(r => r.Id == reportId, ct);

        if (report is null)
        {
            return new ReportVoteResult(VoteOutcome.NotFound, null, null);
        }

        if (ReportExpiry.IsExpired(report, when))
        {
            return new ReportVoteResult(VoteOutcome.Expired, null, null);
        }

        if (report.CreatedBy == driverId)
        {
            return new ReportVoteResult(VoteOutcome.OwnReport, null, null);
        }

        var distance = GeoDistance.Meters(report.Latitude, report.Longitude, latitude, longitude);

        if (distance > VoteMaxMeters)
        {
            return new ReportVoteResult(VoteOutcome.TooFar, null, null);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var vote = await db.ReportVotes.FirstOrDefaultAsync(v => v.ReportId == reportId && v.DriverId == driverId, ct);
        var isNew = vote is null;

        if (vote is null)
        {
            vote = new ReportVote { ReportId = reportId, DriverId = driverId, CastAt = when };
            db.ReportVotes.Add(vote);
        }

        vote.Verdict = verdict;
        vote.UpdatedAt = when;
        vote.DistanceMeters = distance;
        await db.SaveChangesAsync(ct);

        // La verdad son las filas: los contadores se recuentan, no se incrementan.
        var counts = await db.ReportVotes
            .Where(v => v.ReportId == reportId)
            .GroupBy(v => v.Verdict)
            .Select(g => new { Verdict = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        report.Confirmations = counts.FirstOrDefault(c => c.Verdict == ReportVerdict.StillThere)?.Count ?? 0;
        report.Rejections = counts.FirstOrDefault(c => c.Verdict == ReportVerdict.Gone)?.Count ?? 0;

        if (isNew && verdict == ReportVerdict.StillThere)
        {
            ReportExpiry.Confirm(report, when);
        }

        var statusBefore = report.Status;
        var wasValidated = statusBefore is ReportStatus.Validated or ReportStatus.Fixed;
        var creatorReputation = await ReputationOfAsync(report.CreatedBy, ct);
        var score = ReportStanding.ScoreFor(report, creatorReputation, when);

        if (ReportPromotion.ShouldUnfix(report))
        {
            ReportExpiry.Reject(report, when);
        }
        else if (ReportPromotion.ShouldFix(report))
        {
            ReportPromotion.Fix(report);
            report.ValidatedAt ??= when;
        }
        else if (report.Status is ReportStatus.Active or ReportStatus.Validated && ReportExpiry.ShouldReject(report))
        {
            ReportExpiry.Reject(report, when);
        }
        else if (report.Status == ReportStatus.Active && ReportStanding.IsValidated(report, score))
        {
            report.Status = ReportStatus.Validated;
            report.ValidatedAt ??= when;
        }

        var isValidated = report.Status is ReportStatus.Validated or ReportStatus.Fixed;

        if (!wasValidated && isValidated)
        {
            await AdjustReputationAsync(report.CreatedBy, ReputationScale.OnValidated, when, ct);
            await progression.RecordReportValidatedAsync(report.CreatedBy, report.Id, when, ct);
        }

        if (report.Status == ReportStatus.Rejected && statusBefore != ReportStatus.Rejected)
        {
            await AdjustReputationAsync(report.CreatedBy, ReputationScale.OnRejected, when, ct);
        }

        await db.SaveChangesAsync(ct);

        var earned = await progression.RecordReportVoteAsync(driverId, reportId, when, ct);

        await transaction.CommitAsync(ct);

        var view = ReportViews.Build(
            report,
            await ReputationOfAsync(report.CreatedBy, ct),
            truck,
            driverId,
            await AliasOfAsync(report.CreatedBy, ct),
            verdict,
            when);

        return new ReportVoteResult(VoteOutcome.Ok, view, earned);
    }

    /// <summary>El creador cierra el suyo. Devuelve si lo cerro: nadie mas puede.</summary>
    public async Task<bool> CloseAsync(Guid driverId, Guid reportId, DateTimeOffset when, CancellationToken ct = default)
    {
        var report = await db.Reports.FirstOrDefaultAsync(r => r.Id == reportId && r.CreatedBy == driverId, ct);

        if (report is null || ReportExpiry.IsExpired(report, when))
        {
            return false;
        }

        ReportExpiry.CloseByAuthor(report, when);
        await db.SaveChangesAsync(ct);

        return true;
    }

    /// <summary>La reputacion de un camionero: la fila, o el arranque si no hay.</summary>
    public async Task<int> ReputationOfAsync(Guid driverId, CancellationToken ct = default)
    {
        var row = await db.DriverReputations.AsNoTracking().FirstOrDefaultAsync(r => r.DriverId == driverId, ct);

        return row?.Score ?? ReputationScale.Start;
    }

    private async Task AdjustReputationAsync(Guid driverId, int delta, DateTimeOffset when, CancellationToken ct)
    {
        var row = await db.DriverReputations.FirstOrDefaultAsync(r => r.DriverId == driverId, ct);

        if (row is null)
        {
            row = new DriverReputation { DriverId = driverId };
            db.DriverReputations.Add(row);
        }

        row.Score = ReputationScale.Apply(row.Score, delta);
        row.UpdatedAt = when;
    }

    private Task<string?> AliasOfAsync(Guid driverId, CancellationToken ct) =>
        db.DriverProfiles
            .AsNoTracking()
            .Where(d => d.Id == driverId)
            .Select(d => d.Alias)
            .FirstOrDefaultAsync(ct);

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
