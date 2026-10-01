namespace TruckNavigator.Api.RateLimiting;

/// <summary>
/// Las canastas del limite de tasa. Cada una tiene su propio numero porque lo
/// que cuesta cada pedido es distinto: buscar una direccion sale de un servicio
/// de terceros, calcular una ruta es CPU del motor, y leer el mapa lo hace la
/// app sola cada vez que el camionero arrastra.
/// </summary>
public enum RateBucket
{
    /// <summary>Fuera del limite: la salud, los tiles, el mapa base y la web.</summary>
    None = 0,

    /// <summary>Altas, ingresos y mails de cuenta. La mas estricta.</summary>
    Auth = 1,

    /// <summary>Autocompletado y geocoding inverso: pegan a Photon, que es de otros.</summary>
    Search = 2,

    /// <summary>Calcular una ruta.</summary>
    Routing = 3,

    /// <summary>Ordenar un reparto: una matriz de distancias reales, la consulta mas cara.</summary>
    Delivery = 4,

    /// <summary>Crear, cambiar o borrar algo.</summary>
    Write = 5,

    /// <summary>Leer. Generosa a proposito: ver la nota de RateLimitSettings.</summary>
    Read = 6
}

/// <summary>
/// Que canasta le toca a un pedido, dado su metodo y su ruta.
///
/// Es una funcion pura a proposito, y no atributos sobre cada endpoint: asi la
/// decision entera se puede fijar con tests y un endpoint nuevo no queda sin
/// limite por olvidarse de ponerle el atributo. Lo que no empieza en /api no se
/// mide aca — los tiles del mapa base son cientos de pedidos de rango por
/// pantalla y son trabajo del proxy, no de la aplicacion.
/// </summary>
public static class RateLimitPlan
{
    public static RateBucket BucketFor(string method, string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return RateBucket.None;
        }

        var limpio = path.Length > 1 ? path.TrimEnd('/') : path;

        if (!limpio.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            return RateBucket.None;
        }

        var resto = limpio[4..];
        var primero = Segment(resto, 0);

        return primero switch
        {
            "health" => RateBucket.None,
            "auth" => RateBucket.Auth,
            "places" => RateBucket.Search,
            "routes" => Segment(resto, 1) == "delivery" ? RateBucket.Delivery : RateBucket.Routing,
            _ => IsRead(method) ? RateBucket.Read : RateBucket.Write
        };
    }

    /// <summary>El segmento n de una ruta que arranca con barra, en minuscula. Vacio si no esta.</summary>
    private static string Segment(string path, int index)
    {
        var desde = 0;

        for (var i = 0; i <= index; i++)
        {
            if (desde >= path.Length)
            {
                return string.Empty;
            }

            var siguiente = path.IndexOf('/', desde + 1);

            if (i == index)
            {
                var fin = siguiente < 0 ? path.Length : siguiente;
                return path[(desde + 1)..fin].ToLowerInvariant();
            }

            if (siguiente < 0)
            {
                return string.Empty;
            }

            desde = siguiente;
        }

        return string.Empty;
    }

    private static bool IsRead(string method) =>
        HttpMethods.IsGet(method)
        || HttpMethods.IsHead(method)
        || HttpMethods.IsOptions(method);
}
