using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trips;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Pois;

namespace TruckNavigator.Api.Contracts;

public sealed record TruckProfileDto(
    Guid Id,
    string Name,
    int GrossWeightKg,
    double HeightMeters,
    double WidthMeters,
    double LengthMeters,
    int NumberOfAxles,
    string VehicleType,
    bool HasTrailer,
    double? TrailerLengthMeters,
    double TotalLengthMeters,
    bool IsSampleData,
    /// <summary>
    /// Plantilla del catalogo: la comparten todas las cuentas y no se puede editar
    /// ni borrar. Sirve de punto de partida para cargar un camion propio.
    /// </summary>
    bool IsTemplate,
    string? Brand,
    string? Model,
    /// <summary>Patente canonica (sin espacios), para el formulario y para comparar.</summary>
    string? Plate,
    /// <summary>
    /// Patente como esta estampada en la chapa (<c>AB 123 CD</c>), para mostrar.
    /// Va calculada del lado del servidor para que la regla de como se estampa viva
    /// en un solo lugar y no se duplique en el telefono.
    /// </summary>
    string? PlateDisplay)
{
    public static TruckProfileDto From(TruckProfile truck) => new(
        truck.Id,
        truck.Name,
        truck.GrossWeightKg,
        truck.HeightMeters,
        truck.WidthMeters,
        truck.LengthMeters,
        truck.NumberOfAxles,
        truck.VehicleType.ToString(),
        truck.HasTrailer,
        truck.TrailerLengthMeters,
        truck.TotalLengthMeters,
        truck.IsSampleData,
        truck.IsTemplate,
        truck.Brand,
        truck.Model,
        truck.Plate,
        truck.Plate is null ? null : LicensePlate.Display(truck.Plate));
}

public sealed class SaveTruckProfileRequest
{
    [Required, StringLength(120, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Range(500, 100_000)]
    public int GrossWeightKg { get; set; }

    [Range(1.0, 6.0)]
    public double HeightMeters { get; set; }

    [Range(1.0, 4.0)]
    public double WidthMeters { get; set; }

    [Range(1.0, 40.0)]
    public double LengthMeters { get; set; }

    [Range(2, 12)]
    public int NumberOfAxles { get; set; }

    public VehicleType VehicleType { get; set; }

    public bool HasTrailer { get; set; }

    [Range(0.0, 30.0)]
    public double? TrailerLengthMeters { get; set; }

    [StringLength(40)]
    public string? Brand { get; set; }

    [StringLength(40)]
    public string? Model { get; set; }

    /// <summary>
    /// Patente, como la escriba el usuario. El formato lo valida
    /// <see cref="LicensePlate"/> en el endpoint, no un atributo: es una regla de
    /// dominio y tiene que dar el mismo veredicto desde cualquier llamador. El tope
    /// de largo es holgado para dejar pasar espacios y guiones, que despues se sacan.
    /// </summary>
    [StringLength(12)]
    public string? Plate { get; set; }

    public void ApplyTo(TruckProfile truck)
    {
        truck.Name = Name.Trim();
        truck.GrossWeightKg = GrossWeightKg;
        truck.HeightMeters = HeightMeters;
        truck.WidthMeters = WidthMeters;
        truck.LengthMeters = LengthMeters;
        truck.NumberOfAxles = NumberOfAxles;
        truck.VehicleType = VehicleType;
        truck.HasTrailer = HasTrailer;
        truck.TrailerLengthMeters = HasTrailer ? TrailerLengthMeters : null;
        truck.IsSampleData = false;

        truck.Brand = string.IsNullOrWhiteSpace(Brand) ? null : Brand.Trim();
        truck.Model = string.IsNullOrWhiteSpace(Model) ? null : Model.Trim();

        // Se guarda la forma canonica. Se asume ya validada: el endpoint corta
        // antes con 400 si la forma no es una patente.
        truck.Plate = LicensePlate.Validate(Plate).Value;
    }
}

public sealed class RouteRequest
{
    [Required]
    public Guid TruckId { get; set; }

    [Required]
    public CoordinateDto? Origin { get; set; }

    [Required]
    public CoordinateDto? Destination { get; set; }

    /// <summary>Momento de partida. Si no se indica, se usa la hora actual.</summary>
    public DateTimeOffset? DepartureTime { get; set; }
}

public sealed record PlaceDto(
    string Label,
    string? Secondary,
    double Latitude,
    double Longitude)
{
    public static PlaceDto From(Domain.Places.Place place) => new(
        place.Label,
        place.Secondary,
        place.Location.Latitude,
        place.Location.Longitude);
}

public sealed class CoordinateDto
{
    [Range(-90.0, 90.0)]
    public double Latitude { get; set; }

    [Range(-180.0, 180.0)]
    public double Longitude { get; set; }
}

/// <summary>Los votos de un tipo de camion sobre un lugar: los de camiones como el tuyo.</summary>
public sealed record CommunityForTruckDto(string TruckClass, int Suitable, int NotSuitable, string Seal);

/// <summary>Quien aporto el lugar y cuando; solo en los lugares de la comunidad.</summary>
public sealed record ContributedDto(DateOnly At, string? ByAlias);

/// <summary>
/// Lo que la comunidad dice de un lugar. Viaja APARTE de lo verificado: la ficha
/// tiene que poder marcar distinto cada origen (decision del usuario del 15/09/2026).
/// </summary>
/// <param name="Suitable">Cuantos dijeron apto, entre todos los tipos de camion.</param>
/// <param name="NotSuitable">Cuantos dijeron no apto.</param>
/// <param name="Seal">El sello sobre todos los votos, en texto: NoVotesYet, Recommended, Disputed.</param>
/// <param name="ForYourTruck">Solo los votos de camiones del tipo del indicado en la consulta; null sin camion.</param>
/// <param name="YourVote">El voto de quien consulta; null sin sesion o sin voto.</param>
/// <param name="Contributed">Quien lo aporto; null en lo relevado.</param>
public sealed record CommunityDto(
    int Suitable,
    int NotSuitable,
    string Seal,
    CommunityForTruckDto? ForYourTruck,
    string? YourVote,
    ContributedDto? Contributed)
{
    public static CommunityDto From(CommunityView view, PointOfInterest poi, string? contributedByAlias) => new(
        view.All.Suitable,
        view.All.NotSuitable,
        view.Seal.ToString(),
        view.ForTruck is null
            ? null
            : new CommunityForTruckDto(view.TruckClass!.Value.ToString(), view.ForTruck.Suitable, view.ForTruck.NotSuitable, view.SealForTruck!.Value.ToString()),
        view.YourVote?.ToString(),
        poi.ContributedAt is { } at
            ? new ContributedDto(DateOnly.FromDateTime(at.ToOffset(TimeSpan.FromHours(-3)).DateTime), contributedByAlias)
            : null);

    /// <summary>Sin votos y sin camion: lo que tiene un lugar del que todavia nadie opino.</summary>
    public static CommunityDto Empty(PointOfInterest poi, string? contributedByAlias) =>
        From(new CommunityView(new CommunityCount(0, 0), CommunitySeal.NoVotesYet, null, null, null, null), poi, contributedByAlias);
}

/// <summary>
/// Un punto de interes tal como lo consume la app.
/// </summary>
/// <param name="SuitableForSelectedTruck">
/// Resultado de aplicar <see cref="Domain.Pois.PoiSuitability"/> al camion indicado en
/// la consulta: <c>true</c> apto, <c>false</c> no apto, <c>null</c> la fuente no lo
/// dice o no se indico camion. Lo calcula el servidor a proposito, para que el cliente
/// no tenga que reimplementar la regla.
/// </param>
/// <param name="Community">
/// Lo que la comunidad dice, aparte de lo verificado. Nunca falta: un lugar sin
/// votos trae ceros y el sello "NoVotesYet".
/// </param>
public sealed record PoiDto(
    Guid Id,
    string Name,
    string Category,
    string? Address,
    string? Neighbourhood,
    double Latitude,
    double Longitude,
    string? Phone,
    string? Website,
    string? OpeningHours,
    string? Description,
    IReadOnlyList<string> Services,
    bool? SuitableForLightTruck,
    bool? SuitableForHeavyTruck,
    bool? SuitableForSemiTrailer,
    bool? SuitableForTrailer,
    string Source,
    DateOnly SourceRetrievedOn,
    string VerificationLevel,
    string? SuitabilityEvidence,
    string SuitabilityEvidenceKind,
    bool IsSampleData,
    bool? SuitableForSelectedTruck,
    CommunityDto Community)
{
    public static PoiDto From(PointOfInterest poi, TruckProfile? truck, CommunityView? community, string? contributedByAlias) => new(
        poi.Id,
        poi.Name,
        poi.Category.ToString(),
        poi.Address,
        poi.Neighbourhood,
        poi.Latitude,
        poi.Longitude,
        poi.Phone,
        poi.Website,
        poi.OpeningHours,
        poi.Description,
        poi.Services,
        poi.SuitableForLightTruck,
        poi.SuitableForHeavyTruck,
        poi.SuitableForSemiTrailer,
        poi.SuitableForTrailer,
        poi.Source,
        poi.SourceRetrievedOn,
        poi.VerificationLevel.ToString(),
        poi.SuitabilityEvidence,
        poi.SuitabilityEvidenceKind.ToString(),
        poi.IsSampleData,
        truck is null ? null : PoiSuitability.Accepts(poi, truck),
        community is null ? CommunityDto.Empty(poi, contributedByAlias) : CommunityDto.From(community, poi, contributedByAlias));
}

public sealed record RestrictionFindingDto(
    string Kind,
    string Description,
    double? LimitValue,
    string? Unit,
    string RuleSource,
    string RuleReference,
    string DataSource,
    string DataReference)
{
    public static RestrictionFindingDto From(RestrictionFinding finding) => new(
        finding.Kind.ToString(),
        finding.Description,
        finding.LimitValue,
        finding.Unit,
        finding.RuleSource.ToString(),
        finding.RuleReference,
        finding.DataSource.ToString(),
        finding.DataReference);
}

public sealed record RouteRestrictionNoteDto(
    int FromPointIndex,
    int ToPointIndex,
    string StreetName,
    double DistanceMeters,
    bool RequiresAccessException,
    IReadOnlyList<RestrictionFindingDto> Findings)
{
    public static RouteRestrictionNoteDto From(RouteRestrictionNote note) => new(
        note.FromPointIndex,
        note.ToPointIndex,
        note.StreetName,
        note.DistanceMeters,
        note.RequiresAccessException,
        note.Findings.Select(RestrictionFindingDto.From).ToList());
}

/// <summary>
/// Un paso de la navegacion.
/// </summary>
/// <param name="Kind">
/// Maniobra con nombre. De aca salen la flecha en pantalla y el verbo que se
/// dice en voz alta.
/// </param>
/// <param name="FromPointIndex">
/// Indice en la geometria <b>donde se hace la maniobra</b>. Es lo que permite
/// calcular a que distancia esta el proximo giro; sin esto no hay navegacion
/// paso a paso.
/// </param>
/// <param name="DistanceMeters">
/// Lo que se recorre <b>despues</b> de la maniobra, hasta la siguiente.
/// </param>
public sealed record RouteInstructionDto(
    string Text,
    double DistanceMeters,
    double DurationSeconds,
    string? StreetName,
    string Kind,
    int FromPointIndex,
    int ToPointIndex,
    int? ExitNumber)
{
    public static RouteInstructionDto From(RouteInstruction instruction) => new(
        instruction.Text,
        instruction.DistanceMeters,
        instruction.DurationSeconds,
        instruction.StreetName,
        instruction.Kind.ToString(),
        instruction.FromPointIndex,
        instruction.ToPointIndex,
        instruction.ExitNumber);
}

public sealed record RouteResponse(
    double DistanceMeters,
    double DurationSeconds,
    /// <summary>GeoJSON LineString con las coordenadas en orden [lon, lat].</summary>
    GeoJsonLineString Geometry,
    IReadOnlyList<RouteInstructionDto> Instructions,
    IReadOnlyList<RouteRestrictionNoteDto> RestrictionNotes,
    IReadOnlyList<RouteRestrictionNoteDto> AccessLegs,
    double HeavyNetworkSharePercent,
    string TruckName,
    string Attribution,

    /// <summary>
    /// Otras rutas posibles, ya ordenadas por lo que le conviene a un camion.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Va como campo opcional de la misma respuesta y NO como un envoltorio
    /// nuevo: asi la raiz conserva exactamente la forma de siempre y la app que
    /// ya esta instalada en el telefono sigue funcionando —lee lo que siempre
    /// leyo e ignora este campo—. Cambiar la raiz a <c>{ route, alternatives }</c>
    /// la habria roto hasta actualizarla.
    /// </para>
    /// <para>
    /// Cada alternativa viene completa, con su geometria, porque la app las
    /// dibuja para que uno elija mirando el mapa y no leyendo minutos.
    /// </para>
    /// </remarks>
    IReadOnlyList<RouteResponse>? Alternatives = null,

    /// <summary>
    /// Lo que hay sobre la ruta y conviene avisar al pasar —hoy, los galibos
    /// declarados en los tramos que la ruta recorre—. Sale de la ruta misma y
    /// no de la capa del mapa, asi que siempre es informativo: un galibo mas
    /// bajo que el camion no llega aca porque el motor lo excluye (AD-47).
    /// Campo opcional, para que la app instalada siga leyendo lo de siempre.
    /// </summary>
    IReadOnlyList<RouteHazardDto>? Hazards = null)
{
    /// <summary>
    /// Arma la respuesta a partir de la ruta del dominio. Existe porque la usan
    /// dos endpoints —calcular una ruta y arrancar un viaje— y duplicar el mapeo
    /// dejaria que uno de los dos se quedara viejo sin que nada avise.
    /// </summary>
    public static RouteResponse From(TruckRoute route, string truckName, string attribution) => new(
        route.DistanceMeters,
        route.DurationSeconds,
        new GeoJsonLineString(route.Geometry
            .Select(p => new[] { p.Longitude, p.Latitude })
            .ToList()),
        route.Instructions.Select(RouteInstructionDto.From).ToList(),
        route.RestrictionNotes.Select(RouteRestrictionNoteDto.From).ToList(),
        route.AccessLegs.Select(RouteRestrictionNoteDto.From).ToList(),
        route.HeavyNetworkSharePercent,
        truckName,
        attribution,
        Hazards: route.Hazards.Select(RouteHazardDto.From).ToList());
}

public sealed record RouteHazardDto(string Kind, double Metres, string StreetName, int FromPointIndex, int ToPointIndex)
{
    public static RouteHazardDto From(RouteHazard hazard) =>
        new(hazard.Kind, hazard.Metres, hazard.StreetName, hazard.FromPointIndex, hazard.ToPointIndex);
}

public sealed record GeoJsonLineString(IReadOnlyList<double[]> Coordinates)
{
    public string Type => "LineString";
}

/// <summary>Un reparto: origen y hasta diez paradas, en cualquier orden.</summary>
public sealed class DeliveryRequest
{
    [Required]
    public Guid TruckId { get; set; }

    [Required]
    public CoordinateDto? Origin { get; set; }

    /// <summary>
    /// Las paradas tal como las cargo el usuario. El orden que llega NO importa:
    /// justamente lo que hace este endpoint es decidir en cual conviene.
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "Un reparto necesita al menos una parada.")]
    [MaxLength(10, ErrorMessage = "Un reparto admite hasta 10 paradas.")]
    public List<CoordinateDto> Stops { get; set; } = [];

    public DateTimeOffset? DepartureTime { get; set; }
}

/// <summary>
/// La ruta del reparto y en que orden quedaron las paradas.
/// </summary>
/// <param name="StopOrder">
/// Indices de las paradas <b>tal como las envio el cliente</b>, en el orden de
/// visita. Se devuelven los indices y no las paradas reordenadas para que la app
/// pueda decir "tu parada 3 se visita quinta": con la lista ya ordenada esa
/// correspondencia se pierde y el usuario no reconoce sus propias direcciones.
/// </param>
public sealed record DeliveryResponse(
    RouteResponse Route,
    IReadOnlyList<int> StopOrder)
{
    public static DeliveryResponse From(DeliveryRoute delivery, string truckName, string attribution) =>
        new(RouteResponse.From(delivery.Route, truckName, attribution), delivery.StopOrder);
}


/// <summary>
/// El perfil del camionero tal como lo consume la app.
/// </summary>
/// <remarks>
/// Junta en una sola respuesta lo que vive en dos tablas: los datos de la persona
/// —que son dominio— y el estado de la cuenta —que es de Identity—. La app
/// necesita ambos para decidir que pantalla mostrar, y pedirlos por separado
/// obligaria a dos viajes para una sola decision.
/// </remarks>
public sealed record DriverProfileDto(
    Guid Id,
    string? Alias,
    string? FirstName,
    string? LastName,
    string? AvatarId,
    string? Nationality,
    Guid? ActiveTruckId,
    string? ActiveTruckName,
    VehicleType? ActiveTruckType,
    /// <summary>
    /// Fecha de nacimiento. <b>Este DTO es la vista del DUEÑO</b>: es el unico
    /// perfil que existe hoy y lo pide la propia cuenta. El dia que haya una vista
    /// publica del perfil o del carnet, va como OTRA proyeccion que omita este
    /// campo — decision del usuario del 11/09/2026: la fecha se guarda pero no se
    /// publica.
    /// </summary>
    DateOnly? BirthDate,
    string? Email,
    bool EmailConfirmed,
    bool IsComplete,
    DateTimeOffset CreatedAt)
{
    /// <remarks>
    /// El nombre y el tipo del camion activo se resuelven <b>del lado del
    /// servidor</b> y no se dejan para que el cliente los busque en su lista. El
    /// perfil lo ven otros usuarios, y esos otros no tienen la lista de camiones de
    /// esta persona: resolverlo aca hace que la vista publica funcione sin cambios.
    /// </remarks>
    public static DriverProfileDto From(
        DriverProfile profile,
        AppUser user,
        TruckProfile? activeTruck = null) => new(
        profile.Id,
        profile.Alias,
        profile.FirstName,
        profile.LastName,
        profile.AvatarId,
        profile.Nationality,
        profile.ActiveTruckId,
        activeTruck?.Name,
        activeTruck?.VehicleType,
        profile.BirthDate,
        user.Email,
        user.EmailConfirmed,
        profile.IsComplete,
        profile.CreatedAt);
}

/// <summary>
/// Datos que el usuario puede cargar o cambiar de su perfil.
/// </summary>
/// <remarks>
/// Todos los campos son opcionales porque el alta permite saltear este paso. Un
/// campo ausente se interpreta como "dejalo vacio", no como "no lo toques": es un
/// PUT y reemplaza el perfil entero, que es lo que hace el formulario de la app.
/// </remarks>
public sealed class SaveDriverProfileRequest
{
    /// <summary>
    /// El formato lo valida <see cref="DriverAlias"/>, no un atributo: es una regla
    /// de dominio y tiene que dar el mismo veredicto desde cualquier llamador.
    /// </summary>
    public string? Alias { get; set; }

    [StringLength(80)]
    public string? FirstName { get; set; }

    [StringLength(80)]
    public string? LastName { get; set; }

    [StringLength(64)]
    public string? AvatarId { get; set; }

    /// <summary>Codigo de pais de dos letras.</summary>
    [StringLength(2, MinimumLength = 2)]
    public string? Nationality { get; set; }

    /// <summary>
    /// El camion que se exhibe en el perfil.
    /// </summary>
    /// <remarks>
    /// Tiene que ser propio o una plantilla del catalogo. Uno ajeno se rechaza: es
    /// la misma regla por la que no se puede equipar una recompensa que no se
    /// desbloqueo.
    /// </remarks>
    public Guid? ActiveTruckId { get; set; }

    /// <summary>
    /// Fecha de nacimiento, como la escribe un <c>&lt;input type="date"&gt;</c>:
    /// <c>AAAA-MM-DD</c>. La plausibilidad la decide <see cref="Domain.Users.BirthDate"/>.
    /// </summary>
    public DateOnly? BirthDate { get; set; }
}

/// <summary>Respuesta de la consulta de disponibilidad de un alias.</summary>
/// <param name="Available">
/// <c>true</c> si el alias esta libre y bien formado. Es una foto del momento: lo
/// unico que garantiza la unicidad es el indice de la base al guardar.
/// </param>
public sealed record AliasAvailabilityDto(string Alias, bool Available, string? Reason);

/// <summary>
/// Pedido para arrancar un viaje.
/// </summary>
/// <remarks>
/// No lleva distancia ni duracion: las calcula el servidor con el motor de ruteo
/// al crear el viaje. Si el cliente las informara, los kilometros del camionero
/// serian un numero que cualquiera se regala.
/// </remarks>
public sealed class StartTripRequest
{
    [Required]
    public Guid TruckId { get; set; }

    [Required]
    public CoordinateDto? Origin { get; set; }

    [Required]
    public CoordinateDto? Destination { get; set; }

    /// <summary>Direccion legible del origen, para que el historial no muestre coordenadas.</summary>
    [StringLength(300)]
    public string? OriginLabel { get; set; }

    [StringLength(300)]
    public string? DestinationLabel { get; set; }

    /// <summary>
    /// Paradas INTERMEDIAS, en el orden en que se visitan. Opcional.
    /// </summary>
    /// <remarks>
    /// <para>
    /// El recorrido completo es <c>Origin</c> + estas paradas + <c>Destination</c>.
    /// Sin ellas el viaje es de un tramo, como siempre: <b>es un campo opcional y
    /// no un contrato nuevo</b>, asi que la app ya instalada en el telefono sigue
    /// funcionando sin cambios.
    /// </para>
    /// <para>
    /// Vienen <b>ya ordenadas</b> y el servidor NO las reordena. El orden se
    /// calculo al armar el reparto y se le mostro al usuario en la pantalla:
    /// volver a optimizarlo aca podria devolver otro y mandarlo por donde no
    /// esperaba. Ver AD-45.
    /// </para>
    /// </remarks>
    public IReadOnlyList<CoordinateDto>? Stops { get; set; }

    /// <summary>
    /// Cual de las rutas que devolvio <c>POST /api/routes</c> eligio el usuario:
    /// 0 la recomendada, 1 la primera alternativa, y asi. Opcional; sin el, la
    /// recomendada.
    /// </summary>
    /// <remarks>
    /// El viaje se arranca con la MISMA ruta que se eligio en pantalla. Antes el
    /// servidor pedia una sola ruta al motor —la mas rapida por peso— y el viaje
    /// arrancaba por otra que la recomendada, con otros kilometros previstos y
    /// sin pasar por el filtro de AD-47. Una posicion que ya no existe cae en la
    /// recomendada (ver <c>RouteOffer.Chosen</c>). Se ignora con paradas: un
    /// reparto tiene una sola ruta, la que pasa por todas.
    /// </remarks>
    [Range(0, 9)]
    public int? RouteIndex { get; set; }

    public DateTimeOffset? DepartureTime { get; set; }
}

public sealed record TripDto(
    Guid Id,
    Guid? TruckId,
    string TruckName,
    double OriginLatitude,
    double OriginLongitude,
    string? OriginLabel,
    double DestinationLatitude,
    double DestinationLongitude,
    string? DestinationLabel,
    double PlannedDistanceMeters,
    double PlannedDurationSeconds,
    double HeavyNetworkSharePercent,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    string Status,
    /// <summary>
    /// Metros que suman al total del camionero. Vale cero en un viaje cancelado o
    /// cerrado antes de que fuera posible haberlo hecho.
    /// </summary>
    double CreditedDistanceMeters,
    double? ElapsedSeconds,
    /// <summary>
    /// Lo que el viaje le dejo al camionero. <b>Solo viene en la respuesta de
    /// cerrar el viaje</b>, y solo si algo se acredito; en el historial y en un
    /// viaje cancelado es null y se omite. Es un campo opcional y no un envoltorio
    /// nuevo, para que la app ya instalada siga leyendo el viaje de la raiz.
    /// </summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    TripEarnedDto? Earned = null)
{
    public static TripDto From(Trip trip, TripEarnings? earnings = null) => new(
        trip.Id,
        trip.TruckId,
        trip.TruckName,
        trip.OriginLatitude,
        trip.OriginLongitude,
        trip.OriginLabel,
        trip.DestinationLatitude,
        trip.DestinationLongitude,
        trip.DestinationLabel,
        trip.PlannedDistanceMeters,
        trip.PlannedDurationSeconds,
        trip.HeavyNetworkSharePercent,
        trip.StartedAt,
        trip.FinishedAt,
        trip.Status.ToString(),
        trip.CreditedDistanceMeters,
        trip.Elapsed?.TotalSeconds,
        earnings is null ? null : TripEarnedDto.From(earnings));
}

/// <summary>
/// Lo que gano un viaje, para la pantalla de fin de viaje: la EXP del viaje y la
/// de los escalones, los escalones completados con su objetivo, y el nivel antes
/// y despues, para que la pantalla sepa si hay que festejar una subida.
/// </summary>
public sealed record TripEarnedDto(
    int TripExperience,
    int TierExperience,
    int TotalExperience,
    IReadOnlyList<CompletedTierDto> CompletedTiers,
    LevelDto LevelBefore,
    LevelDto LevelAfter,
    bool LeveledUp)
{
    public static TripEarnedDto From(TripEarnings e) => new(
        e.TripExperience,
        e.TierExperience,
        e.TotalExperience,
        [.. e.CompletedTiers.Select(CompletedTierDto.From)],
        LevelDto.From(e.LevelBefore),
        LevelDto.From(e.LevelAfter),
        e.LeveledUp);
}

/// <summary>
/// Lo que gano un aporte a los lugares, para festejarlo igual que un viaje: la EXP
/// del aporte y la de los escalones, y los escalones completados. Sin nivel: el
/// nivel es de kilometros y aportar no lo mueve.
/// </summary>
public sealed record ContributionEarnedDto(
    int ContributionExperience,
    int TierExperience,
    int TotalExperience,
    IReadOnlyList<CompletedTierDto> CompletedTiers)
{
    public static ContributionEarnedDto From(ContributionEarnings e) => new(
        e.ContributionExperience,
        e.TierExperience,
        e.TotalExperience,
        [.. e.CompletedTiers.Select(CompletedTierDto.From)]);
}

/// <summary>
/// Un lugar que carga un camionero. Las reglas —largo del nombre, area cubierta—
/// las valida el dominio (<see cref="PoiContribution"/>), no atributos: tienen que
/// dar el mismo veredicto desde cualquier llamador. La categoria va en texto, como
/// en todo el contrato.
/// </summary>
public sealed record AddPoiRequest(
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? Address,
    string? Description,
    Guid TruckId);

/// <summary>
/// Lo que vuelve al agregar: el lugar ya con su ficha comunitaria (un voto, el
/// tuyo) y lo que pago.
/// </summary>
public sealed record AddedPoiDto(PoiDto Poi, ContributionEarnedDto? Earned);

/// <summary>El voto que se emite: con que camion y que dice.</summary>
/// <param name="Verdict"><c>Suitable</c> o <c>NotSuitable</c>, en texto, como todo enum del contrato.</param>
public sealed record VoteRequest(Guid TruckId, string Verdict);

/// <summary>
/// Lo que vuelve despues de votar: la ficha ya actualizada y lo que pago —null si
/// ese lugar ya habia cobrado, que es lo normal al cambiar el voto—.
/// </summary>
public sealed record VoteResultDto(CommunityDto Community, ContributionEarnedDto? Earned);

/// <summary>Un escalon completado, con el objetivo que lo completo: es el numero que se muestra.</summary>
public sealed record CompletedTierDto(string TrackCode, int Tier, long Goal, string RewardCode)
{
    public static CompletedTierDto From(CompletedTier t) => new(
        t.TrackCode,
        t.Tier,
        TrackCatalog.Get(t.TrackCode).Tiers[t.Tier - 1].Goal,
        t.RewardCode);
}

public sealed record LevelDto(int Number, string Name)
{
    public static LevelDto From(LevelStanding l) => new(l.Number, l.Name);
}

/// <summary>
/// Lo que devuelve arrancar un viaje: el viaje creado y la ruta para navegarlo.
/// </summary>
/// <remarks>
/// Van juntos para que la app no tenga que pedir la ruta por separado y, sobre
/// todo, para que la ruta que se navega sea exactamente la que quedo registrada.
/// </remarks>
public sealed record StartedTripDto(TripDto Trip, RouteResponse Route);

/// <summary>
/// El viaje que quedo abierto, con la ruta para seguir navegandolo.
/// </summary>
/// <remarks>
/// <para>
/// La ruta es opcional a proposito, y es la diferencia con
/// <see cref="StartedTripDto"/>. Al arrancar un viaje, sin ruta no hay nada que
/// registrar y el pedido falla entero. Al retomarlo ya existe: el viaje esta
/// abierto en la base y el camionero necesita poder cerrarlo aunque el motor de
/// ruteo este caido o el camion ya no exista. Devolver un error ahi lo dejaria
/// trabado sin salida, que es exactamente lo que este endpoint viene a evitar.
/// </para>
/// <para>
/// <see cref="RouteUnavailableReason"/> explica por que falta, para que la app
/// pueda decirlo en vez de mostrar una pantalla de navegacion vacia.
/// </para>
/// </remarks>
public sealed record ActiveTripDto(TripDto Trip, RouteResponse? Route, string? RouteUnavailableReason);

/// <summary>Estadisticas acumuladas del camionero.</summary>
/// <remarks>
/// Se calculan agregando los viajes, no leyendo contadores guardados. Con los
/// volumenes de esta etapa el agregado es correcto por construccion y no puede
/// desincronizarse; si algun dia pesa, se agrega un contador y esta respuesta no
/// cambia de forma.
/// </remarks>
public sealed record TripStatsDto(
    int TotalTrips,
    int CompletedTrips,
    double CreditedKilometers,
    double DrivenSeconds,
    DateTimeOffset? FirstTripAt,
    DateTimeOffset? LastTripAt);

/// <summary>
/// Un contacto de emergencia tal como lo ve la aplicacion.
/// </summary>
/// <remarks>
/// El telefono viaja <b>tal como se guardo</b>. Ni el servidor ni la app lo
/// reescriben: un numero normalizado mal es un numero que no llama.
/// </remarks>
public sealed record EmergencyContactDto(Guid Id, string Name, string Phone)
{
    public static EmergencyContactDto From(EmergencyContact contact) =>
        new(contact.Id, contact.Name, contact.Phone);
}

/// <summary>
/// Alta de un contacto de emergencia.
/// </summary>
/// <remarks>
/// Los dos campos son obligatorios y los valida el dominio
/// (<see cref="EmergencyContactRules"/>): el nombre porque hay que saber a quien
/// se esta llamando, y el telefono porque sin el no hay contacto.
/// </remarks>
public sealed record SaveEmergencyContactRequest(string? Name, string? Phone);

/// <summary>
/// Pedido de equipar una recompensa.
/// </summary>
/// <remarks>
/// <para>
/// El cliente dice que quiere ponerse y donde. Si no lo tiene desbloqueado, el
/// servidor lo rechaza: equipar elige entre lo que ya se gano, no lo concede.
/// </para>
/// <para>
/// <b>La ranura viaja por su nombre, y el conversor no es opcional.</b> Sin el,
/// System.Text.Json no convierte <c>"Hat"</c> al enum y el endpoint responde 500 en
/// vez de hacer su trabajo — medido, no supuesto. Va sobre la propiedad y no global
/// para no cambiar como se serializan los enums que la app ya consume.
/// </para>
/// </remarks>
public sealed record EquipRequest(
    [property: JsonConverter(typeof(JsonStringEnumConverter))] LoadoutSlot Slot,
    string RewardCode);
