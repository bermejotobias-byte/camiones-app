using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.Infrastructure.Routing;

/// <summary>
/// Calcula rutas contra un servidor GraphHopper aplicando el custom model del
/// camion, y anota el resultado con las restricciones que explican el trazado.
/// </summary>
public sealed class GraphHopperRouteCalculator(
    HttpClient httpClient,
    ITruckRoutingPolicy routingPolicy,
    IRestrictionEvaluator restrictionEvaluator,
    IOptions<GraphHopperOptions> options,
    ILogger<GraphHopperRouteCalculator> logger) : ITruckRouteCalculator
{
    private static readonly string[] RequestedDetails =
        ["street_name", "road_class", "max_height", "max_weight", "max_width", "max_length", "hgv"];

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly GraphHopperOptions _options = options.Value;

    public async Task<TruckRoute> CalculateAsync(
        TruckProfile truck,
        GeoPoint origin,
        GeoPoint destination,
        DateTimeOffset departure,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(truck);

        var customModel = routingPolicy.BuildCustomModel(truck, departure);

        var request = new
        {
            points = new[]
            {
                new[] { origin.Longitude, origin.Latitude },
                new[] { destination.Longitude, destination.Latitude }
            },
            profile = _options.Profile,
            ch_disable = true,
            points_encoded = false,
            instructions = true,
            locale = "es",
            details = RequestedDetails,
            custom_model = customModel
        };

        // GraphHopper espera la clave literal "ch.disable"; el punto no es un
        // identificador valido en C#, asi que se reescribe al serializar.
        var payload = JsonSerializer.SerializeToNode(request, SerializerOptions)!.AsObject();
        payload.Remove("ch_disable");
        payload["ch.disable"] = true;

        logger.LogDebug("Solicitando ruta a GraphHopper para el camion {TruckName}", truck.Name);

        using var response = await httpClient.PostAsJsonAsync("route", payload, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("GraphHopper respondio {Status}: {Body}", response.StatusCode, body);
            throw new RoutingException(ExtractMessage(body, response.StatusCode.ToString()));
        }

        var document = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

        if (!document.TryGetProperty("paths", out var paths) || paths.GetArrayLength() == 0)
        {
            throw new RoutingException("El motor de ruteo no encontro ninguna ruta valida para este vehiculo.");
        }

        return BuildRoute(paths[0], truck, departure);
    }

    private TruckRoute BuildRoute(JsonElement path, TruckProfile truck, DateTimeOffset departure)
    {
        var geometry = ReadGeometry(path);
        var instructions = ReadInstructions(path);

        var details = path.TryGetProperty("details", out var detailsElement)
            ? PathDetails.Parse(detailsElement)
            : PathDetails.Parse(null);

        var distanceMeters = path.GetProperty("distance").GetDouble();
        var totalPointSpan = Math.Max(geometry.Count - 1, 1);

        var notes = new List<RouteRestrictionNote>();
        var accessLegs = new List<RouteRestrictionNote>();
        var heavyNetworkSpan = 0;

        foreach (var (from, to, attributes) in details.ToSegments())
        {
            if (attributes.Hgv == HgvAccess.Designated)
            {
                heavyNetworkSpan += to - from;
            }

            var verdict = restrictionEvaluator.Evaluate(attributes, truck, departure);

            if (verdict.Findings.Count == 0)
            {
                continue;
            }

            // El largo del tramo se aproxima por su proporcion de puntos. Alcanza
            // para ordenar y mostrar; no se usa para decidir nada.
            var segmentDistance = distanceMeters * (to - from) / totalPointSpan;

            var note = new RouteRestrictionNote(
                from,
                to,
                attributes.DisplayName,
                segmentDistance,
                verdict.RequiresAccessException,
                verdict.Findings);

            notes.Add(note);

            if (verdict.RequiresAccessException)
            {
                accessLegs.Add(note);
            }

            if (!verdict.IsAllowed)
            {
                // No deberia ocurrir: el custom model bloquea estos tramos antes
                // de que el algoritmo los considere. Si aparece, hay una
                // divergencia entre la politica de ruteo y el evaluador.
                logger.LogWarning(
                    "La ruta contiene un tramo incompatible con {TruckName} en {Street}. " +
                    "Revisar la coherencia entre CabaTruckRoutingPolicy y CabaRestrictionEvaluator.",
                    truck.Name, attributes.DisplayName);
            }
        }

        return new TruckRoute(
            distanceMeters,
            path.GetProperty("time").GetDouble() / 1000.0,
            geometry,
            instructions,
            notes,
            accessLegs,
            Math.Round(100.0 * heavyNetworkSpan / totalPointSpan, 1));
    }

    private static List<GeoPoint> ReadGeometry(JsonElement path)
    {
        var points = new List<GeoPoint>();

        if (!path.TryGetProperty("points", out var pointsElement) ||
            !pointsElement.TryGetProperty("coordinates", out var coordinates))
        {
            return points;
        }

        foreach (var coordinate in coordinates.EnumerateArray())
        {
            // GeoJSON: [longitud, latitud].
            points.Add(new GeoPoint(coordinate[1].GetDouble(), coordinate[0].GetDouble()));
        }

        return points;
    }

    private static List<RouteInstruction> ReadInstructions(JsonElement path)
    {
        var instructions = new List<RouteInstruction>();

        if (!path.TryGetProperty("instructions", out var element))
        {
            return instructions;
        }

        foreach (var instruction in element.EnumerateArray())
        {
            instructions.Add(new RouteInstruction(
                instruction.GetProperty("text").GetString() ?? string.Empty,
                instruction.GetProperty("distance").GetDouble(),
                instruction.GetProperty("time").GetDouble() / 1000.0,
                instruction.TryGetProperty("street_name", out var street) ? street.GetString() : null));
        }

        return instructions;
    }

    private static string ExtractMessage(string body, string fallback)
    {
        try
        {
            var error = JsonSerializer.Deserialize<JsonElement>(body);

            if (error.TryGetProperty("message", out var message))
            {
                return message.GetString() ?? fallback;
            }
        }
        catch (JsonException)
        {
            // El cuerpo no era JSON; se usa el fallback.
        }

        return fallback;
    }
}
