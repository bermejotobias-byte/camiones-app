using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Api.Identity;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure;
using TruckNavigator.Infrastructure.Email;
using TruckNavigator.Infrastructure.Identity;
using TruckNavigator.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    // Permite probar los endpoints protegidos desde /swagger pegando el token que
    // devuelve /api/auth/login.
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JSON",
        In = ParameterLocation.Header,
        Description = "Pegar el accessToken que devuelve /api/auth/login."
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});
builder.Services.AddProblemDetails();

// ------------------------------------------------------------- identidad
//
// AddIdentityApiEndpoints arma de una sola vez el nucleo de Identity, el esquema
// de autenticacion por bearer token y los endpoints del ciclo de vida de la
// cuenta. Se prefiere a una implementacion propia por una razon simple: el
// hasheo de contrasenas, los tokens de verificacion y el bloqueo por intentos
// fallidos son codigo de seguridad, y este proyecto no tiene por que reescribirlo.
builder.Services.AddAuthorization();

builder.Services.AddIdentityApiEndpoints<AppUser>(options =>
{
    // Sin mail verificado no se puede iniciar sesion. Es el requisito del
    // documento y ademas lo que hace que un alias tenga alguien detras.
    options.SignIn.RequireConfirmedEmail = true;
    options.User.RequireUniqueEmail = true;

    // Se privilegia la longitud por sobre la composicion. Exigir mayusculas y
    // simbolos en un teclado de telefono, dentro de un camion, produce
    // contrasenas anotadas en un papel: es peor seguridad, no mejor.
    options.Password.RequiredLength = 8;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;

    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
})
.AddEntityFrameworkStores<AppDbContext>();

// Los mails de Identity salen por el envio propio de Infrastructure.
builder.Services.AddSingleton<IEmailSender<AppUser>, IdentityEmailSender>();

var app = builder.Build();

// El seed corre al arrancar para que el MVP sea usable sin pasos manuales.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await TruckProfileSeed.ApplyAsync(db);
    await PointOfInterestSeed.ApplyAsync(db);
}

// Sin SMTP configurado no se envia ningun mail y los enlaces de verificacion van
// al log. Alcanza para desarrollar, pero en produccion dejaria cualquier cuenta
// al alcance de quien lea el log, asi que ahi el arranque se corta.
{
    var emailOptions = app.Services.GetRequiredService<IOptions<EmailOptions>>().Value;

    if (!emailOptions.IsConfigured)
    {
        if (app.Environment.IsProduction())
        {
            throw new InvalidOperationException(
                "Falta configurar la seccion Email de appsettings: sin SMTP no se puede " +
                "verificar ninguna cuenta. Ver docs/deploy.md.");
        }

        app.Logger.LogWarning(
            "SMTP sin configurar: no se envian mails. Los enlaces de verificacion " +
            "aparecen en este log.");
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger();
app.UseSwaggerUI();

const string Attribution = "Datos de mapa © colaboradores de OpenStreetMap (ODbL). " +
                           "Restricciones regulatorias: Ley 2148 CABA.";

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    utc = DateTimeOffset.UtcNow
}))
.WithSummary("Chequeo de conectividad, usado por la app movil.");

// ------------------------------------------------------------------ cuenta

// Alta, verificacion por mail, login, refresh, logout y recuperacion de
// contrasena. Los sirve Identity; se montan bajo /api/auth para que queden
// agrupados con el resto de la API.
app.MapGroup("/api/auth")
   .WithTags("Cuenta")
   .MapIdentityApi<AppUser>();

// ------------------------------------------------------------------ perfil

var profiles = app.MapGroup("/api/perfil")
                  .WithTags("Perfil")
                  .RequireAuthorization();

profiles.MapGet("/", async (
    ClaimsPrincipal principal,
    AppDbContext db,
    UserManager<AppUser> users,
    CancellationToken ct) =>
{
    var user = await users.GetUserAsync(principal);

    if (user is null)
    {
        return Results.Unauthorized();
    }

    var profile = await db.DriverProfiles.FirstOrDefaultAsync(d => d.Id == user.Id, ct);

    // El perfil se crea al primer acceso y no durante el alta. /api/auth/register
    // lo sirve Identity y no ofrece un gancho donde colgar esto; crearlo aca deja
    // un solo camino posible y evita cuentas sin perfil si el alta se corta.
    if (profile is null)
    {
        profile = new DriverProfile { Id = user.Id };
        db.DriverProfiles.Add(profile);
        await db.SaveChangesAsync(ct);
    }

    return Results.Ok(DriverProfileDto.From(profile, user));
})
.WithSummary("Perfil del camionero autenticado. Lo crea si es el primer acceso.");

profiles.MapPut("/", async (
    SaveDriverProfileRequest request,
    ClaimsPrincipal principal,
    AppDbContext db,
    UserManager<AppUser> users,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    var user = await users.GetUserAsync(principal);

    if (user is null)
    {
        return Results.Unauthorized();
    }

    var profile = await db.DriverProfiles.FirstOrDefaultAsync(d => d.Id == user.Id, ct);

    if (profile is null)
    {
        profile = new DriverProfile { Id = user.Id };
        db.DriverProfiles.Add(profile);
    }

    if (!string.IsNullOrWhiteSpace(request.Alias))
    {
        var validation = DriverAlias.Validate(request.Alias);

        if (!validation.IsValid)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["alias"] = [validation.Error!]
            });
        }

        var normalized = DriverAlias.Normalize(validation.Value!);

        // Se consulta antes de guardar solo para poder dar un mensaje claro. La
        // garantia real es el indice unico: entre esta consulta y el SaveChanges
        // otra alta puede quedarse con el alias.
        var taken = await db.DriverProfiles
            .AnyAsync(d => d.NormalizedAlias == normalized && d.Id != user.Id, ct);

        if (taken)
        {
            return AliasConflict(validation.Value!);
        }

        profile.SetAlias(validation.Value!);
    }

    profile.FirstName = Clean(request.FirstName);
    profile.LastName = Clean(request.LastName);
    profile.AvatarId = Clean(request.AvatarId);

    try
    {
        await db.SaveChangesAsync(ct);
    }
    catch (DbUpdateException ex) when (IsAliasConflict(ex))
    {
        return AliasConflict(profile.Alias ?? request.Alias!);
    }

    return Results.Ok(DriverProfileDto.From(profile, user));
})
.WithSummary("Guarda nombre, apellido, alias y avatar. El alias es unico.");

profiles.MapGet("/alias-disponible", async (
    string alias,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    var validation = DriverAlias.Validate(alias);

    if (!validation.IsValid)
    {
        return Results.Ok(new AliasAvailabilityDto(alias, false, validation.Error));
    }

    var normalized = DriverAlias.Normalize(validation.Value!);
    var currentUserId = CurrentUserId(principal);

    // El alias propio no cuenta como ocupado: sin esto, revisar el formulario sin
    // cambiar nada diria que el alias que ya tenes no esta disponible.
    var taken = await db.DriverProfiles
        .AnyAsync(d => d.NormalizedAlias == normalized && d.Id != currentUserId, ct);

    return Results.Ok(new AliasAvailabilityDto(
        validation.Value!,
        !taken,
        taken ? "Ese alias ya esta en uso." : null));
})
.WithSummary("Consulta si un alias esta libre, para avisar mientras se escribe.");

// ---------------------------------------------------------------- camiones
//
// Un camion pertenece a una cuenta. Las tres plantillas del catalogo no son de
// nadie (OwnerId nulo) y las ve cualquiera: son el punto de partida para cargar
// el propio, y muestran altura, peso y largo de cada tipo antes de elegir.
//
// Leer esta abierto —la app todavia no tiene login y necesita las plantillas
// para poder rutear—, pero crear, editar y borrar exigen sesion: son datos
// personales y sin dueno no se pueden guardar.

var trucks = app.MapGroup("/api/trucks").WithTags("Trucks");

trucks.MapGet("/", async (
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);

    var profiles = await db.TruckProfiles
        .Where(t => t.OwnerId == null || t.OwnerId == userId)
        .OrderBy(t => t.OwnerId == null)   // primero los propios, despues el catalogo
        .ThenBy(t => t.GrossWeightKg)
        .AsNoTracking()
        .ToListAsync(ct);

    return Results.Ok(profiles.Select(TruckProfileDto.From));
})
.WithSummary("Los camiones del usuario mas las plantillas del catalogo.");

trucks.MapGet("/plantillas", async (AppDbContext db, CancellationToken ct) =>
{
    var templates = await db.TruckProfiles
        .Where(t => t.OwnerId == null)
        .OrderBy(t => t.GrossWeightKg)
        .AsNoTracking()
        .ToListAsync(ct);

    return Results.Ok(templates.Select(TruckProfileDto.From));
})
.WithSummary("Tipos de transporte con sus medidas, para elegir la primera vez.");

trucks.MapGet("/{id:guid}", async (
    Guid id,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    var truck = await FindUsableTruckAsync(db, id, CurrentUserId(principal), ct);

    return truck is null
        ? Results.NotFound()
        : Results.Ok(TruckProfileDto.From(truck));
});

trucks.MapPost("/", async (
    SaveTruckProfileRequest request,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    var truck = new TruckProfile { OwnerId = userId };
    request.ApplyTo(truck);

    db.TruckProfiles.Add(truck);
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/trucks/{truck.Id}", TruckProfileDto.From(truck));
})
.RequireAuthorization()
.WithSummary("Carga un camion propio. Se pueden tener todos los que hagan falta.");

trucks.MapPut("/{id:guid}", async (
    Guid id,
    SaveTruckProfileRequest request,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    // Se filtra por dueno en la misma consulta: el camion de otro tiene que dar
    // 404 y no 403, para no confirmar que ese id existe.
    var truck = await db.TruckProfiles
        .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);

    if (truck is null)
    {
        return await TruckIsATemplateAsync(db, id, ct)
            ? TemplateIsReadOnly()
            : Results.NotFound();
    }

    request.ApplyTo(truck);
    await db.SaveChangesAsync(ct);

    return Results.Ok(TruckProfileDto.From(truck));
})
.RequireAuthorization();

trucks.MapDelete("/{id:guid}", async (
    Guid id,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    var truck = await db.TruckProfiles
        .FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == userId, ct);

    if (truck is null)
    {
        return await TruckIsATemplateAsync(db, id, ct)
            ? TemplateIsReadOnly()
            : Results.NotFound();
    }

    db.TruckProfiles.Remove(truck);
    await db.SaveChangesAsync(ct);

    return Results.NoContent();
})
.RequireAuthorization();

// ------------------------------------------------------------------ lugares

var places = app.MapGroup("/api/places").WithTags("Places");

places.MapGet("/", async (
    string? q,
    int? limit,
    IPlaceSearch search,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(q))
    {
        return Results.Ok(Array.Empty<PlaceDto>());
    }

    var results = await search.SearchAsync(q, limit ?? 8, ct);

    return Results.Ok(results.Select(PlaceDto.From));
})
.WithSummary("Autocompletado de direcciones para elegir origen y destino.");

places.MapGet("/reverse", async (
    double lat,
    double lng,
    IPlaceSearch search,
    CancellationToken ct) =>
{
    var place = await search.ReverseAsync(new GeoPoint(lat, lng), ct);

    return place is null ? Results.NoContent() : Results.Ok(PlaceDto.From(place));
})
.WithSummary("Qué hay en unas coordenadas. Se usa al marcar un punto en el mapa.");

// ------------------------------------------------- puntos de interes (POIs)

var pois = app.MapGroup("/api/pois").WithTags("Pois");

pois.MapGet("/", async (
    string? categories,
    Guid? truckId,
    bool? suitableOnly,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (ParseCategories(categories) is not { } filter)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["categories"] =
            [
                "Categoria desconocida. Valores validos: " +
                string.Join(", ", Enum.GetNames<PoiCategory>()) + "."
            ]
        });
    }

    if (suitableOnly == true && truckId is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["truckId"] = ["Para filtrar por aptitud hay que indicar que camion."]
        });
    }

    TruckProfile? truck = null;

    if (truckId is { } id)
    {
        truck = await FindUsableTruckAsync(db, id, CurrentUserId(principal), ct);

        if (truck is null)
        {
            return Results.Problem(
                title: "Camion inexistente",
                detail: $"No existe un perfil de camion con id {id}.",
                statusCode: StatusCodes.Status404NotFound);
        }
    }

    var query = db.PointsOfInterest.AsNoTracking();

    if (filter.Count > 0)
    {
        query = query.Where(p => filter.Contains(p.Category));
    }

    var points = await query.OrderBy(p => p.Name).ToListAsync(ct);

    var results = points.Select(p => PoiDto.From(p, truck));

    // El filtro deja pasar solo la aptitud confirmada: lo desconocido se oculta
    // igual que lo no apto. Es la lectura estricta, y por eso el cliente lo trae
    // apagado por defecto y avisa cuantos puntos escondio.
    if (suitableOnly == true)
    {
        results = results.Where(p => p.SuitableForSelectedTruck == true);
    }

    return Results.Ok(results.ToList());
})
.WithSummary("Playas, estaciones, talleres, gomerias y auxilio pesado para camiones.");

// ------------------------------------------------------------------ rutas

app.MapPost("/api/routes", async (
    RouteRequest request,
    ClaimsPrincipal principal,
    AppDbContext db,
    ITruckRouteCalculator calculator,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    var truck = await FindUsableTruckAsync(db, request.TruckId, CurrentUserId(principal), ct);

    if (truck is null)
    {
        return Results.Problem(
            title: "Camion inexistente",
            detail: $"No existe un perfil de camion con id {request.TruckId}.",
            statusCode: StatusCodes.Status404NotFound);
    }

    var departure = request.DepartureTime ?? DateTimeOffset.Now;

    try
    {
        var route = await calculator.CalculateAsync(
            truck,
            new GeoPoint(request.Origin!.Latitude, request.Origin.Longitude),
            new GeoPoint(request.Destination!.Latitude, request.Destination.Longitude),
            departure,
            ct);

        return Results.Ok(new RouteResponse(
            route.DistanceMeters,
            route.DurationSeconds,
            new GeoJsonLineString(route.Geometry
                .Select(p => new[] { p.Longitude, p.Latitude })
                .ToList()),
            route.Instructions
                .Select(i => new RouteInstructionDto(i.Text, i.DistanceMeters, i.DurationSeconds, i.StreetName))
                .ToList(),
            route.RestrictionNotes.Select(ToDto).ToList(),
            route.AccessLegs.Select(ToDto).ToList(),
            route.HeavyNetworkSharePercent,
            truck.Name,
            Attribution));
    }
    catch (RoutingException ex)
    {
        return Results.Problem(
            title: "No se pudo calcular la ruta",
            detail: ex.Message,
            statusCode: StatusCodes.Status422UnprocessableEntity);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(
            title: "Motor de ruteo no disponible",
            detail: $"No se pudo contactar a GraphHopper: {ex.Message}",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
})
.WithTags("Routing")
.WithSummary("Calcula una ruta compatible con el camion indicado.");

app.Run();

static RouteRestrictionNoteDto ToDto(RouteRestrictionNote note) => new(
    note.FromPointIndex,
    note.ToPointIndex,
    note.StreetName,
    note.DistanceMeters,
    note.RequiresAccessException,
    note.Findings.Select(f => new RestrictionFindingDto(
        f.Kind.ToString(),
        f.Description,
        f.LimitValue,
        f.Unit,
        f.RuleSource.ToString(),
        f.RuleReference,
        f.DataSource.ToString(),
        f.DataReference)).ToList());

/// <summary>
/// Convierte el parametro "categories" en una lista tipada. Devuelve <c>null</c> si
/// alguna categoria no existe, para poder responder 400 en vez de ignorarla en
/// silencio: un filtro mal escrito que devuelve todo es peor que un error.
/// </summary>
static List<PoiCategory>? ParseCategories(string? categories)
{
    if (string.IsNullOrWhiteSpace(categories))
    {
        return [];
    }

    var parsed = new List<PoiCategory>();

    foreach (var name in categories.Split(',', StringSplitOptions.RemoveEmptyEntries |
                                               StringSplitOptions.TrimEntries))
    {
        if (!Enum.TryParse<PoiCategory>(name, ignoreCase: true, out var category))
        {
            return null;
        }

        parsed.Add(category);
    }

    return parsed;
}

static IResult? Validate<T>(T instance) where T : notnull
{
    var results = new List<ValidationResult>();

    if (Validator.TryValidateObject(instance, new ValidationContext(instance), results, validateAllProperties: true))
    {
        return null;
    }

    var errors = results.ToDictionary(
        r => r.MemberNames.FirstOrDefault() ?? "request",
        r => new[] { r.ErrorMessage ?? "Valor invalido." });

    return Results.ValidationProblem(errors);
}

/// <summary>Punto de entrada expuesto para los tests de integracion.</summary>

/// <summary>
/// Id del usuario autenticado. Identity lo emite como <c>NameIdentifier</c>.
/// </summary>

/// <summary>
/// Trae el camion solo si quien pregunta puede usarlo: el suyo, o una plantilla
/// del catalogo.
/// </summary>
/// <remarks>
/// Devuelve <c>null</c> tanto si el camion no existe como si es de otra cuenta.
/// La indistincion es a proposito: responder distinto confirmaria que ese id
/// existe, y las medidas de un camion son dato de su dueno.
/// </remarks>
static Task<TruckProfile?> FindUsableTruckAsync(
    AppDbContext db,
    Guid truckId,
    Guid? userId,
    CancellationToken ct) =>
    db.TruckProfiles
        .AsNoTracking()
        .FirstOrDefaultAsync(
            t => t.Id == truckId && (t.OwnerId == null || t.OwnerId == userId),
            ct);

static Task<bool> TruckIsATemplateAsync(AppDbContext db, Guid truckId, CancellationToken ct) =>
    db.TruckProfiles.AnyAsync(t => t.Id == truckId && t.OwnerId == null, ct);

/// <summary>
/// Las plantillas del catalogo son de solo lectura: las comparten todas las
/// cuentas y editarlas afectaria a cualquiera. Se responde distinto de "no
/// existe" porque el id es publico y el usuario merece entender por que no puede.
/// </summary>
static IResult TemplateIsReadOnly() => Results.Problem(
    title: "Plantilla de solo lectura",
    detail: "Es un tipo de transporte del catalogo y lo comparten todas las cuentas. " +
            "Carga un camion propio a partir de el para poder cambiarle las medidas.",
    statusCode: StatusCodes.Status403Forbidden);

static Guid? CurrentUserId(ClaimsPrincipal principal) =>
    Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id
        : null;

/// <summary>Normaliza un campo opcional: en blanco y ausente son lo mismo.</summary>
static string? Clean(string? value) =>
    string.IsNullOrWhiteSpace(value) ? null : value.Trim();

static IResult AliasConflict(string alias) => Results.Problem(
    title: "Alias en uso",
    detail: $"El alias \"{alias}\" ya lo tiene otro camionero. Elegi otro.",
    statusCode: StatusCodes.Status409Conflict);

/// <summary>
/// Distingue el choque del indice unico del alias de cualquier otro fallo al
/// guardar. Se mira el mensaje del proveedor porque inspeccionar el tipo de
/// excepcion de SQLite obligaria a que la capa web conozca el motor de base de
/// datos, que es justamente lo que la arquitectura evita.
/// </summary>
static bool IsAliasConflict(DbUpdateException exception) =>
    exception.InnerException?.Message.Contains("NormalizedAlias", StringComparison.Ordinal) == true;

public partial class Program;
