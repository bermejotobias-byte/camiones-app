namespace TruckNavigator.Domain.Pois;

/// <summary>
/// Como nace un lugar que carga un camionero.
/// </summary>
/// <remarks>
/// <para>
/// Nace <b>sin aptitud verificada</b>: los cuatro campos en <c>null</c> y evidencia
/// <c>None</c>. La aptitud verificada la escribe un relevamiento con fuente; lo que
/// la comunidad opina va en los votos. Es lo que hace que lo aportado complemente
/// y no reemplace (decision del usuario del 15/09/2026).
/// </para>
/// <para>
/// Y nace fuera del dataset (<c>ManagedByDataset = false</c>): el seed no lo pisa ni
/// lo borra al arrancar.
/// </para>
/// </remarks>
public static class PoiContribution
{
    // El mismo rectangulo del relevamiento: CABA mas un anillo de ~2 km. Afuera la
    // app no tiene mapa ni capas (L-11), y un lugar que nadie va a ver no sirve.
    public const double LatMin = -34.725;
    public const double LatMax = -34.505;
    public const double LonMin = -58.555;
    public const double LonMax = -58.315;

    public const int NameMinLength = 3;
    public const int NameMaxLength = 80;

    /// <summary>
    /// Huso de la Ciudad de Buenos Aires, fijo porque Argentina no aplica horario de
    /// verano. La fecha de la fuente es la local: un aporte a las 23:00 es del dia en
    /// que se hizo, no del siguiente en UTC.
    /// </summary>
    private static readonly TimeSpan LocalOffset = TimeSpan.FromHours(-3);

    public static bool IsInsideCoverage(double latitude, double longitude) =>
        latitude >= LatMin && latitude <= LatMax && longitude >= LonMin && longitude <= LonMax;

    /// <summary>
    /// Arma el punto. Tira <see cref="ArgumentException"/> con el motivo escrito
    /// para la persona si el nombre no sirve o el lugar cae fuera del area.
    /// </summary>
    public static PointOfInterest Create(
        Guid driverId,
        string name,
        PoiCategory category,
        double latitude,
        double longitude,
        string? address,
        string? description,
        DateTimeOffset when)
    {
        var cleanName = (name ?? string.Empty).Trim();

        if (cleanName.Length < NameMinLength || cleanName.Length > NameMaxLength)
        {
            throw new ArgumentException(
                $"El nombre tiene que tener entre {NameMinLength} y {NameMaxLength} caracteres.",
                nameof(name));
        }

        if (!IsInsideCoverage(latitude, longitude))
        {
            throw new ArgumentException(
                "El lugar tiene que estar dentro de CABA o de su anillo de acceso: mas alla la app todavia no tiene mapa.",
                nameof(latitude));
        }

        var local = when.ToOffset(LocalOffset);

        return new PointOfInterest
        {
            Id = Guid.NewGuid(),
            Name = cleanName,
            Category = category,
            Latitude = latitude,
            Longitude = longitude,
            Address = Clean(address),
            Description = Clean(description),
            Services = [],
            Source = $"Aporte de la comunidad ({local:dd/MM/yyyy})",
            SourceRetrievedOn = DateOnly.FromDateTime(local.DateTime),
            VerificationLevel = VerificationLevel.NotConfirmed,
            SuitabilityEvidenceKind = SuitabilityEvidenceKind.None,
            SuitabilityEvidence = null,
            ManagedByDataset = false,
            IsSampleData = false,
            ContributedBy = driverId,
            ContributedAt = when
        };
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
