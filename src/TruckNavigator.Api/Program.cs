using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Api.Identity;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trips;
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

// La app Android carga la interfaz desde el origen virtual del WebView y le pega
// a este backend: eso es cross-origin y sin CORS el navegador lo bloquea antes
// de que salga el pedido.
//
// Se permite cualquier origen a proposito. La API se autentica con tokens de
// portador y no con cookies, asi que un origen ajeno no consigue nada que no
// consiga un cliente HTTP cualquiera: no hay sesion implicita que robar. Si
// algun dia se agregan cookies, esto tiene que volverse una lista blanca.
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .AllowAnyOrigin()
    .AllowAnyHeader()
    .AllowAnyMethod()));

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

    // En desarrollo se agrega una cuenta de prueba con el mail ya confirmado.
    // Sin SMTP el enlace de verificacion va al log, y mandar a buscarlo a la
    // consola de la maquina para poder entrar desde el telefono no sirve.
    // Fuera de Development esta rama no corre.
    if (app.Environment.IsDevelopment())
    {
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        await DevUserSeed.ApplyAsync(users, db);

        app.Logger.LogInformation(
            "Cuenta de prueba disponible: {Email} / {Password}",
            DevUserSeed.Email,
            DevUserSeed.Password);
    }
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

app.UseCors();

// La app vive en wwwroot y se sirve desde aca mismo. Es el mismo bundle que
// empaqueta la app Android: un solo frontend para los dos hosts.
app.UseDefaultFiles();

// Las extensiones que el middleware no conoce las rechaza con 404 en vez de
// servirlas, que es lo correcto pero cuesta un rato entenderlo: el archivo esta
// en disco, la ruta es la buena, y el servidor igual dice que no existe.
//
// Se declaran las dos que usa el mapa en lugar de habilitar cualquier extension:
// la lista blanca es la que hay que tocar cuando aparezca un formato nuevo.
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".geojson"] = "application/geo+json";
contentTypes.Mappings[".pbf"] = "application/x-protobuf";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypes,

    // "no-cache" no significa "no guardar": significa preguntar siempre antes de
    // reusar. El navegador revalida y el servidor contesta 304 sin cuerpo, asi
    // que el costo es un viaje de ida y vuelta y nada de datos.
    //
    // Hace falta porque la app se sirve sin paso de compilacion y por lo tanto
    // sin nombres versionados. Sin esto, el navegador se queda con la version
    // vieja de un modulo y sigue ejecutandola: en desarrollo se edita un archivo
    // y no cambia nada, y en produccion una correccion publicada no le llega al
    // usuario. Cuesta un rato largo darse cuenta, porque el codigo en disco esta
    // bien y lo que el servidor entrega tambien.
    //
    // El dia que haya empaquetador con nombres versionados, esto se reemplaza
    // por un max-age largo sobre los archivos con hash.
    OnPrepareResponse = context =>
        context.Context.Response.Headers.CacheControl = "no-cache, must-revalidate"
});
// ------------------------------------------------------------- mapa base
//
// El mapa base vectorial (.pmtiles) se sirve desde fuera de wwwroot a
// proposito. wwwroot entero viaja adentro del APK, y este archivo pesa decenas
// de megas: empaquetarlo triplicaria el instalador para algo que igual necesita
// red, porque sin servidor tampoco hay ruteo.
//
// Vive junto a los otros artefactos pesados que se generan y no se versionan
// —el extract de OSM y el grafo de GraphHopper— y lo produce
// data/build-basemap.ps1.
//
// MapLibre lee el archivo por rangos de bytes; el middleware de estaticos
// responde 206 sin configuracion extra.
var basemapDirectory = Path.GetFullPath(Path.Combine(
    app.Environment.ContentRootPath,
    builder.Configuration["Basemap:Directory"] ?? "../../routing"));

if (Directory.Exists(basemapDirectory))
{
    contentTypes.Mappings[".pmtiles"] = "application/vnd.pmtiles";

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(basemapDirectory),
        RequestPath = "/tiles",
        ContentTypeProvider = contentTypes,

        // Este si se cachea fuerte: es un archivo grande que cambia sólo cuando
        // se regenera el mapa a mano.
        OnPrepareResponse = context =>
            context.Context.Response.Headers.CacheControl = "public, max-age=604800"
    });
}
else
{
    app.Logger.LogWarning(
        "No se encontro el mapa base en {Directorio}. El mapa va a quedar sin fondo: " +
        "generarlo con data/build-basemap.ps1.",
        basemapDirectory);
}

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

var profiles = app.MapGroup("/api/profile")
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

profiles.MapGet("/alias-available", async (
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

// ------------------------------------------------ contactos de emergencia
//
// Hasta tres personas a las que llamar de un toque. Cuelgan del grupo de perfil
// porque son datos de la cuenta y ya exige sesion.
//
// Viven en el servidor y no en el telefono a proposito: un contacto de
// emergencia que se pierde al reinstalar la app, o al cambiar de equipo, es un
// contacto que no esta el dia que hace falta.

profiles.MapGet("/emergency-contacts", async (
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    var contacts = await db.EmergencyContacts
        .Where(c => c.OwnerId == userId)
        .OrderBy(c => c.AddedAt)
        .AsNoTracking()
        .ToListAsync(ct);

    return Results.Ok(contacts.Select(EmergencyContactDto.From));
})
.WithSummary("Los contactos de emergencia del camionero, en orden de carga.");

profiles.MapPost("/emergency-contacts", async (
    SaveEmergencyContactRequest request,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    var validation = EmergencyContactRules.Validate(request.Name, request.Phone);

    if (!validation.IsValid)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["contacto"] = [validation.Error!]
        });
    }

    var already = await db.EmergencyContacts.CountAsync(c => c.OwnerId == userId, ct);

    if (already >= EmergencyContact.MaxPerDriver)
    {
        return Results.Problem(
            title: "Ya tenes tres contactos",
            detail: $"Se pueden guardar hasta {EmergencyContact.MaxPerDriver}. " +
                    "Borra uno para agregar otro.",
            statusCode: StatusCodes.Status409Conflict);
    }

    var contact = new EmergencyContact
    {
        OwnerId = userId,
        Name = validation.Name!,
        Phone = validation.Phone!
    };

    db.EmergencyContacts.Add(contact);
    await db.SaveChangesAsync(ct);

    return Results.Created(
        $"/api/profile/emergency-contacts/{contact.Id}",
        EmergencyContactDto.From(contact));
})
.WithSummary("Agrega un contacto de emergencia. Hasta tres por camionero.");

profiles.MapDelete("/emergency-contacts/{id:guid}", async (
    Guid id,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    // El filtro por dueno va en la consulta y no despues: buscar por Id solo y
    // comparar el dueno a continuacion deja la puerta abierta a borrar el
    // contacto de otra persona si alguna vez se olvida la comparacion.
    var contact = await db.EmergencyContacts
        .FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == userId, ct);

    if (contact is null)
    {
        return Results.NotFound();
    }

    db.EmergencyContacts.Remove(contact);
    await db.SaveChangesAsync(ct);

    return Results.NoContent();
})
.WithSummary("Borra un contacto de emergencia propio.");

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

trucks.MapGet("/templates", async (AppDbContext db, CancellationToken ct) =>
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

// ------------------------------------------------------------------- viajes
//
// El viaje es la unidad del historial y la fuente de los kilometros. Todo lo que
// se desbloquea manejando sale de esta tabla.
//
// Arrancar un viaje RUTEA en el servidor y guarda la distancia que devolvio el
// motor. El cliente no informa kilometros en ningun momento: si pudiera, el
// total del camionero seria un numero que cualquiera se regala.

var trips = app.MapGroup("/api/trips").WithTags("Trips").RequireAuthorization();

trips.MapPost("/", async (
    StartTripRequest request,
    ClaimsPrincipal principal,
    AppDbContext db,
    ITruckRouteCalculator calculator,
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

    // Un camionero maneja un camion por vez. Dos viajes abiertos ademas dejarian
    // sin respuesta a cual de los dos acreditarle el recorrido.
    var open = await db.Trips
        .AsNoTracking()
        .FirstOrDefaultAsync(t => t.DriverId == userId && t.Status == TripStatus.InProgress, ct);

    if (open is not null)
    {
        return Results.Problem(
            title: "Ya tenes un viaje sin terminar",
            detail: "Todavia hay un viaje abierto. Cerralo o cancelalo antes de arrancar otro.",
            statusCode: StatusCodes.Status409Conflict,
            extensions: new Dictionary<string, object?> { ["tripId"] = open.Id });
    }

    var truck = await FindUsableTruckAsync(db, request.TruckId, userId, ct);

    if (truck is null)
    {
        return Results.Problem(
            title: "Camion inexistente",
            detail: $"No existe un camion con id {request.TruckId} que puedas usar.",
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

        var trip = new Trip
        {
            DriverId = userId,
            TruckId = truck.Id,

            // Copiado, no solo referenciado: el camion se puede borrar y el
            // historial tiene que seguir diciendo con cual se hizo el viaje.
            TruckName = truck.Name,

            OriginLatitude = request.Origin.Latitude,
            OriginLongitude = request.Origin.Longitude,
            OriginLabel = Clean(request.OriginLabel),
            DestinationLatitude = request.Destination.Latitude,
            DestinationLongitude = request.Destination.Longitude,
            DestinationLabel = Clean(request.DestinationLabel),

            PlannedDistanceMeters = route.DistanceMeters,
            PlannedDurationSeconds = route.DurationSeconds,
            HeavyNetworkSharePercent = route.HeavyNetworkSharePercent,

            StartedAt = DateTimeOffset.UtcNow
        };

        db.Trips.Add(trip);
        await db.SaveChangesAsync(ct);

        return Results.Created(
            $"/api/trips/{trip.Id}",
            new StartedTripDto(TripDto.From(trip), RouteResponse.From(route, truck.Name, Attribution)));
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
.WithSummary("Arranca un viaje: rutea, lo registra y devuelve la ruta para navegar.");

// El viaje vive en el servidor, no en la pantalla. Sin este endpoint la app no
// tiene como enterarse de que dejo uno abierto: al volver a abrirla su estado
// arranca vacio, deja planificar otro viaje y recien al arrancarlo se choca con
// el 409 de mas arriba, sin entender por que.
trips.MapGet("/active", async (
    ClaimsPrincipal principal,
    AppDbContext db,
    ITruckRouteCalculator calculator,
    CancellationToken ct) =>
{
    if (CurrentUserId(principal) is not { } userId)
    {
        return Results.Unauthorized();
    }

    var trip = await db.Trips
        .AsNoTracking()
        .FirstOrDefaultAsync(t => t.DriverId == userId && t.Status == TripStatus.InProgress, ct);

    if (trip is null)
    {
        return Results.NoContent();
    }

    var truck = trip.TruckId is { } truckId
        ? await FindUsableTruckAsync(db, truckId, userId, ct)
        : null;

    if (truck is null)
    {
        return Results.Ok(new ActiveTripDto(
            TripDto.From(trip),
            null,
            "El camion con el que se arranco este viaje ya no esta disponible."));
    }

    try
    {
        var route = await calculator.CalculateAsync(
            truck,
            new GeoPoint(trip.OriginLatitude, trip.OriginLongitude),
            new GeoPoint(trip.DestinationLatitude, trip.DestinationLongitude),
            DateTimeOffset.Now,
            ct);

        return Results.Ok(new ActiveTripDto(
            TripDto.From(trip),
            RouteResponse.From(route, truck.Name, Attribution),
            null));
    }
    catch (Exception ex) when (ex is RoutingException or HttpRequestException)
    {
        // Sin ruta el viaje se sigue devolviendo: cerrarlo o abandonarlo no
        // necesita rutear, y es lo que el camionero tiene que poder hacer.
        return Results.Ok(new ActiveTripDto(TripDto.From(trip), null, ex.Message));
    }
})
.WithSummary("El viaje que quedo abierto, con su ruta. 204 si no hay ninguno.");

trips.MapPost("/{id:guid}/finish", async (
    Guid id,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
    await CloseTripAsync(db, id, CurrentUserId(principal), arrived: true, ct))
.WithSummary("Marca el viaje como llegado y acredita los kilometros que correspondan.");

trips.MapPost("/{id:guid}/cancel", async (
    Guid id,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
    await CloseTripAsync(db, id, CurrentUserId(principal), arrived: false, ct))
.WithSummary("Abandona el viaje. No acredita kilometros.");

trips.MapGet("/", async (
    int? limit,
    int? offset,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);

    var take = Math.Clamp(limit ?? 20, 1, 100);
    var skip = Math.Max(offset ?? 0, 0);

    var history = await db.Trips
        .Where(t => t.DriverId == userId)
        .OrderByDescending(t => t.StartedAt)
        .Skip(skip)
        .Take(take)
        .AsNoTracking()
        .ToListAsync(ct);

    return Results.Ok(history.Select(TripDto.From));
})
.WithSummary("Historial de viajes, del mas nuevo al mas viejo.");

trips.MapGet("/stats", async (
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);

    var mine = db.Trips.Where(t => t.DriverId == userId).AsNoTracking();

    var total = await mine.CountAsync(ct);
    var completed = await mine.CountAsync(t => t.Status == TripStatus.Completed, ct);

    // Suma lo acreditado y no lo planeado: un viaje cancelado tiene distancia
    // prevista y no suma nada.
    var meters = total == 0 ? 0 : await mine.SumAsync(t => t.CreditedDistanceMeters, ct);

    // Los tiempos se proyectan y se suman en memoria porque restar dos fechas no
    // se traduce a SQL de forma portable. Es una lectura angosta y con estos
    // volumenes no pesa; si algun dia pesa, corresponde un contador guardado.
    var spans = await mine
        .Where(t => t.FinishedAt != null)
        .Select(t => new { t.StartedAt, t.FinishedAt })
        .ToListAsync(ct);

    var drivenSeconds = spans.Sum(s => (s.FinishedAt!.Value - s.StartedAt).TotalSeconds);

    var first = await mine
        .OrderBy(t => t.StartedAt)
        .Select(t => (DateTimeOffset?)t.StartedAt)
        .FirstOrDefaultAsync(ct);

    var last = await mine
        .OrderByDescending(t => t.StartedAt)
        .Select(t => (DateTimeOffset?)t.StartedAt)
        .FirstOrDefaultAsync(ct);

    return Results.Ok(new TripStatsDto(
        total,
        completed,
        Math.Round(meters / 1000.0, 1),
        Math.Round(drivenSeconds),
        first,
        last));
})
.WithSummary("Kilometros acumulados, viajes y tiempo al volante.");

trips.MapGet("/{id:guid}", async (
    Guid id,
    ClaimsPrincipal principal,
    AppDbContext db,
    CancellationToken ct) =>
{
    var userId = CurrentUserId(principal);

    var trip = await db.Trips
        .AsNoTracking()
        .FirstOrDefaultAsync(t => t.Id == id && t.DriverId == userId, ct);

    return trip is null ? Results.NotFound() : Results.Ok(TripDto.From(trip));
});

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
        var routes = await calculator.CalculateAlternativesAsync(
            truck,
            new GeoPoint(request.Origin!.Latitude, request.Origin.Longitude),
            new GeoPoint(request.Destination!.Latitude, request.Destination.Longitude),
            departure,
            ct);

        // La raiz de la respuesta conserva EXACTAMENTE la forma de antes —la ruta
        // recomendada— y `alternatives` se suma como campo. Asi la app que ya
        // esta instalada en el telefono sigue funcionando sin cambios: lee lo que
        // siempre leyo e ignora el campo nuevo.
        var alternativas = routes.Skip(1)
            .Select(r => RouteResponse.From(r, truck.Name, Attribution))
            .ToList();

        return Results.Ok(RouteResponse.From(routes[0], truck.Name, Attribution) with
        {
            Alternatives = alternativas
        });
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
.WithSummary("Calcula una ruta compatible con el camion indicado, con alternativas.");

// ------------------------------------------------------------------- reparto

app.MapPost("/api/routes/delivery", async (
    DeliveryRequest request,
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

    try
    {
        var delivery = await calculator.CalculateDeliveryAsync(
            truck,
            new GeoPoint(request.Origin!.Latitude, request.Origin.Longitude),
            request.Stops.Select(s => new GeoPoint(s.Latitude, s.Longitude)).ToList(),
            request.DepartureTime ?? DateTimeOffset.Now,
            ct);

        return Results.Ok(DeliveryResponse.From(delivery, truck.Name, Attribution));
    }
    catch (RoutingException ex)
    {
        return Results.Problem(
            title: "No se pudo armar el reparto",
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
.WithSummary("Ordena hasta 10 paradas y calcula la ruta que las recorre.");

app.Run();

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

/// <summary>
/// Cierra un viaje abierto, como llegado o como abandonado.
/// </summary>
/// <remarks>
/// Los dos caminos comparten todo salvo que uno acredita y el otro no, asi que
/// la diferencia queda en el dominio —<c>Finish</c> contra <c>Cancel</c>— y no
/// duplicada en dos endpoints. El filtro por camionero va en la misma consulta:
/// el viaje de otro tiene que dar 404 y no 403.
/// </remarks>
static async Task<IResult> CloseTripAsync(
    AppDbContext db,
    Guid tripId,
    Guid? userId,
    bool arrived,
    CancellationToken ct)
{
    if (userId is null)
    {
        return Results.Unauthorized();
    }

    var trip = await db.Trips.FirstOrDefaultAsync(t => t.Id == tripId && t.DriverId == userId, ct);

    if (trip is null)
    {
        return Results.NotFound();
    }

    if (!trip.IsOpen)
    {
        return Results.Problem(
            title: "El viaje ya estaba cerrado",
            detail: $"Quedo como {trip.Status} el {trip.FinishedAt:g}.",
            statusCode: StatusCodes.Status409Conflict);
    }

    var now = DateTimeOffset.UtcNow;

    if (arrived)
    {
        trip.Finish(now);
    }
    else
    {
        trip.Cancel(now);
    }

    await db.SaveChangesAsync(ct);

    return Results.Ok(TripDto.From(trip));
}

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
