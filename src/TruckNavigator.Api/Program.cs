using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure;
using TruckNavigator.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

var app = builder.Build();

// El seed corre al arrancar para que el MVP sea usable sin pasos manuales.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await TruckProfileSeed.ApplyAsync(db);
    await PointOfInterestSeed.ApplyAsync(db);
}

app.UseExceptionHandler();
app.UseStatusCodePages();
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

// ---------------------------------------------------------------- camiones

var trucks = app.MapGroup("/api/trucks").WithTags("Trucks");

trucks.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
{
    var profiles = await db.TruckProfiles
        .OrderBy(t => t.GrossWeightKg)
        .AsNoTracking()
        .ToListAsync(ct);

    return Results.Ok(profiles.Select(TruckProfileDto.From));
})
.WithSummary("Lista los perfiles de camion disponibles.");

trucks.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
{
    var truck = await db.TruckProfiles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);

    return truck is null
        ? Results.NotFound()
        : Results.Ok(TruckProfileDto.From(truck));
});

trucks.MapPost("/", async (
    SaveTruckProfileRequest request,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    var truck = new TruckProfile();
    request.ApplyTo(truck);

    db.TruckProfiles.Add(truck);
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/trucks/{truck.Id}", TruckProfileDto.From(truck));
})
.WithSummary("Crea un perfil de camion.");

trucks.MapPut("/{id:guid}", async (
    Guid id,
    SaveTruckProfileRequest request,
    AppDbContext db,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    var truck = await db.TruckProfiles.FirstOrDefaultAsync(t => t.Id == id, ct);

    if (truck is null)
    {
        return Results.NotFound();
    }

    request.ApplyTo(truck);
    await db.SaveChangesAsync(ct);

    return Results.Ok(TruckProfileDto.From(truck));
});

trucks.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
{
    var truck = await db.TruckProfiles.FirstOrDefaultAsync(t => t.Id == id, ct);

    if (truck is null)
    {
        return Results.NotFound();
    }

    db.TruckProfiles.Remove(truck);
    await db.SaveChangesAsync(ct);

    return Results.NoContent();
});

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
        truck = await db.TruckProfiles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);

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
    AppDbContext db,
    ITruckRouteCalculator calculator,
    CancellationToken ct) =>
{
    if (Validate(request) is { } problem)
    {
        return problem;
    }

    var truck = await db.TruckProfiles
        .AsNoTracking()
        .FirstOrDefaultAsync(t => t.Id == request.TruckId, ct);

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
public partial class Program;
