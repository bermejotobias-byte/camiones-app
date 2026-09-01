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
        var rutas = await RequestAsync(truck, origin, destination, departure, alternativas: false, cancellationToken);

        return rutas[0];
    }

    public async Task<IReadOnlyList<TruckRoute>> CalculateAlternativesAsync(
        TruckProfile truck,
        GeoPoint origin,
        GeoPoint destination,
        DateTimeOffset departure,
        CancellationToken cancellationToken = default)
    {
        var rutas = await RequestAsync(truck, origin, destination, departure, alternativas: true, cancellationToken);

        // Se ordenan por lo que le conviene a un camion, NO por tiempo: el orden
        // que devuelve el motor es por peso, y ahi una ruta que obliga a salir de
        // la Red puede quedar primera solo por ser dos minutos mas rapida. El
        // criterio esta en el dominio, en TruckRouteComparer.
        var ordenadas = rutas.OrderBy(r => r, TruckRouteComparer.Instance).ToList();

        logger.LogDebug(
            "GraphHopper devolvio {Total} rutas para {TruckName}; la elegida tiene {Bloqueos} tramos bloqueados",
            ordenadas.Count, truck.Name,
            ordenadas[0].RestrictionNotes.Count(n => !n.RequiresAccessException));

        return ordenadas;
    }

    private async Task<IReadOnlyList<TruckRoute>> RequestAsync(
        TruckProfile truck,
        GeoPoint origin,
        GeoPoint destination,
        DateTimeOffset departure,
        bool alternativas,
        CancellationToken cancellationToken)
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

        if (alternativas)
        {
            // Las claves tambien llevan punto, por el mismo motivo que "ch.disable".
            payload["algorithm"] = "alternative_route";
            payload["alternative_route.max_paths"] = MaxAlternatives;

            // Cuanto mas larga puede ser una alternativa respecto de la mejor.
            // 1,6 deja entrar rodeos que valen la pena para un camion —esquivar
            // un tramo prohibido cuesta kilometros— sin llegar a ofrecer paseos.
            payload["alternative_route.max_weight_factor"] = 1.6;

            // Cuanto puede compartir con la mejor. Sin esto las "alternativas"
            // son la misma ruta con dos cuadras distintas, y elegir no cambia
            // nada.
            payload["alternative_route.max_share_factor"] = 0.7;
        }

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

        var rutas = new List<TruckRoute>(paths.GetArrayLength());

        foreach (var path in paths.EnumerateArray())
        {
            rutas.Add(BuildRoute(path, truck, departure));
        }

        return rutas;
    }

    /// <summary>
    /// Cuantas rutas se le piden al motor.
    /// </summary>
    /// <remarks>
    /// Tres. Cada alternativa se evalua entera contra el motor de restricciones
    /// —tramo por tramo, con sus galibos y su pertenencia a la Red—, asi que
    /// pedir mas cuesta tiempo de respuesta real. Y en la pantalla de un camion,
    /// elegir entre mas de tres opciones no es ayudar.
    /// </remarks>
    private const int MaxAlternatives = 3;

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
            var (from, to) = ReadInterval(instruction);

            instructions.Add(new RouteInstruction(
                instruction.GetProperty("text").GetString() ?? string.Empty,
                instruction.GetProperty("distance").GetDouble(),
                instruction.GetProperty("time").GetDouble() / 1000.0,
                instruction.TryGetProperty("street_name", out var street) ? street.GetString() : null,
                ToManeuver(instruction),
                from,
                to,
                instruction.TryGetProperty("exit_number", out var exit) && exit.TryGetInt32(out var number)
                    ? number
                    : null));
        }

        return instructions;
    }

    /// <summary>
    /// Lee el rango de puntos de geometria que cubre la instruccion.
    /// </summary>
    /// <remarks>
    /// El primer indice es donde se hace la maniobra. Si faltara, la instruccion
    /// queda sin ubicacion y el navegador no puede avisar a que distancia esta;
    /// se devuelve <c>(0, 0)</c> para no romper, y el consumidor decide.
    /// </remarks>
    private static (int From, int To) ReadInterval(JsonElement instruction)
    {
        if (!instruction.TryGetProperty("interval", out var interval) ||
            interval.ValueKind != JsonValueKind.Array ||
            interval.GetArrayLength() < 2)
        {
            return (0, 0);
        }

        return (interval[0].GetInt32(), interval[1].GetInt32());
    }

    /// <summary>
    /// Traduce el <c>sign</c> de GraphHopper a una maniobra con nombre.
    /// </summary>
    /// <remarks>
    /// La convencion del motor: negativo a la izquierda, positivo a la derecha, y
    /// la magnitud es lo cerrado del giro. Los valores estan documentados en
    /// <see href="https://docs.graphhopper.com/openapi/navigation/getroute"/>.
    ///
    /// Un valor desconocido cae en <see cref="ManeuverKind.Unknown"/> a proposito:
    /// mejor una flecha generica que adivinar un lado y mandar a doblar mal.
    /// </remarks>
    private static ManeuverKind ToManeuver(JsonElement instruction)
    {
        if (!instruction.TryGetProperty("sign", out var element) ||
            !element.TryGetInt32(out var sign))
        {
            return ManeuverKind.Unknown;
        }

        return sign switch
        {
            -98 or -8 or 8 => ManeuverKind.UTurn,
            -7 => ManeuverKind.KeepLeft,
            -3 => ManeuverKind.SharpLeft,
            -2 => ManeuverKind.Left,
            -1 => ManeuverKind.SlightLeft,
            0 => ManeuverKind.Continue,
            1 => ManeuverKind.SlightRight,
            2 => ManeuverKind.Right,
            3 => ManeuverKind.SharpRight,
            4 => ManeuverKind.Finish,
            5 => ManeuverKind.Waypoint,
            6 => ManeuverKind.Roundabout,
            7 => ManeuverKind.KeepRight,
            _ => ManeuverKind.Unknown
        };
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
