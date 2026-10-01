using TruckNavigator.Domain.Pois;

namespace TruckNavigator.Domain.Reports;

/// <summary>Lo minimo de un reporte reciente que la guardia necesita mirar.</summary>
public sealed record RecentReport(
    ReportType Type,
    double Latitude,
    double Longitude,
    DateTimeOffset CreatedAt,
    Guid Id,
    bool Active);

/// <summary>Lo que la guardia decide sobre un reporte nuevo.</summary>
/// <param name="RetryAfterSeconds">Cuanto esperar si no se permite por tiempo; 0 si no es por eso.</param>
/// <param name="DuplicateOf">El reporte igual que ya hay cerca, para ofrecer confirmarlo.</param>
/// <param name="Reason">El motivo, escrito para la persona.</param>
public sealed record AbuseVerdict(bool Allowed, int RetryAfterSeconds, Guid? DuplicateOf, string? Reason)
{
    public static readonly AbuseVerdict Ok = new(true, 0, null, null);
}

/// <summary>
/// Proteccion basica contra el abuso: demasiados reportes en poco tiempo,
/// repetidos, o de una cuenta desacreditada.
/// </summary>
/// <remarks>
/// <para>
/// Es una funcion pura: recibe lo reciente de la misma cuenta, lo activo que hay
/// cerca, la reputacion y el reloj. Quien la llama trae las listas de la base.
/// </para>
/// <para>
/// El duplicado no es un error a secas: se devuelve el id del que ya esta para
/// que la app ofrezca "sigue ahi" en vez de crear otro. Es el mismo trato que
/// reciben los lugares aportados a menos de 25 m.
/// </para>
/// </remarks>
public static class ReportAbuseGuard
{
    /// <summary>Espera entre dos reportes de la misma cuenta.</summary>
    public static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(45);

    /// <summary>Por debajo de esta reputacion la espera se duplica.</summary>
    public const int LowReputationBelow = 25;

    public const int MaxPerHour = 20;

    /// <summary>Mismo tipo, activo, a menos de esto y dentro de la ventana: es el mismo hecho.</summary>
    public const double DuplicateMeters = 150;

    public static readonly TimeSpan DuplicateWindow = TimeSpan.FromMinutes(15);

    public static AbuseVerdict Check(
        NewReport input,
        IReadOnlyList<RecentReport> mine,
        IReadOnlyList<RecentReport> nearby,
        int reputation,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(mine);
        ArgumentNullException.ThrowIfNull(nearby);

        var cooldown = reputation < LowReputationBelow ? Cooldown * 2 : Cooldown;
        var last = mine.Count == 0 ? (DateTimeOffset?)null : mine.Max(r => r.CreatedAt);

        if (last is { } lastAt && lastAt + cooldown > now)
        {
            var wait = (int)Math.Ceiling((lastAt + cooldown - now).TotalSeconds);

            return new AbuseVerdict(false, wait, null,
                $"Espera {wait} segundos antes de reportar otra cosa.");
        }

        var lastHour = mine.Where(r => r.CreatedAt > now - TimeSpan.FromHours(1)).ToList();

        if (lastHour.Count >= MaxPerHour)
        {
            var oldest = lastHour.Min(r => r.CreatedAt);
            var wait = (int)Math.Ceiling((oldest + TimeSpan.FromHours(1) - now).TotalSeconds);

            return new AbuseVerdict(false, Math.Max(wait, 1), null,
                "Ya reportaste muchas cosas en la ultima hora. Espera un rato.");
        }

        var duplicate = nearby
            .Where(r => r.Active
                        && r.Type == input.Type
                        && r.CreatedAt > now - DuplicateWindow
                        && GeoDistance.Meters(r.Latitude, r.Longitude, input.Latitude, input.Longitude) <= DuplicateMeters)
            .OrderBy(r => GeoDistance.Meters(r.Latitude, r.Longitude, input.Latitude, input.Longitude))
            .FirstOrDefault();

        if (duplicate is not null)
        {
            return new AbuseVerdict(false, 0, duplicate.Id,
                "Ya hay un reporte igual cerca. Podes confirmar que sigue ahi.");
        }

        return AbuseVerdict.Ok;
    }
}
