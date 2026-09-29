namespace TruckNavigator.Api.RateLimiting;

/// <summary>
/// Cuantos pedidos por minuto aguanta cada canasta.
///
/// Los valores de fabrica son los de esta clase; la seccion "RateLimit" de la
/// configuracion los puede mover sin recompilar (en el servidor van por
/// variables de entorno, como el mail). Estan fijados por test: cambiar uno es
/// una decision.
///
/// El de lectura sale de una medicion, no de una corazonada: arrastrando el mapa
/// como lo hace una persona buscando, la app manda 37 pedidos por minuto, y el
/// techo del debounce de un segundo es 57. Una canasta apretada no frena a un
/// abusador, le rompe el mapa a un camionero.
/// </summary>
public sealed class RateLimitSettings
{
    public const string Section = "RateLimit";

    /// <summary>El interruptor entero. Queda apagado en Development desde Program.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Si la IP del pedido sale de X-Forwarded-For. Se prende SOLO donde hay un
    /// proxy de verdad adelante (el Caddy del deploy): sin proxy, cualquiera
    /// manda la cabecera que quiera y se cambia de canasta cuando le convenga.
    /// </summary>
    public bool TrustForwardedFor { get; set; }

    /// <summary>Altas, ingresos y mails de cuenta: la mas estricta, contra fuerza bruta.</summary>
    public int AuthPerMinute { get; set; } = 10;

    /// <summary>Y un tope por hora, para que no se junten cien altas en una tarde.</summary>
    public int AuthPerHour { get; set; } = 30;

    /// <summary>Autocompletado y geocoding inverso: pegan a Photon, que nos hace un favor.</summary>
    public int SearchPerMinute { get; set; } = 40;

    /// <summary>Calcular una ruta: CPU del motor.</summary>
    public int RoutingPerMinute { get; set; } = 20;

    /// <summary>Ordenar un reparto: una matriz de distancias reales, la consulta mas cara.</summary>
    public int DeliveryPerMinute { get; set; } = 6;

    /// <summary>Crear, cambiar o borrar. El cooldown por camionero del dominio es otra capa.</summary>
    public int WritePerMinute { get; set; } = 40;

    /// <summary>Leer. Generosa a proposito: ver la nota de arriba.</summary>
    public int ReadPerMinute { get; set; } = 300;

    /// <summary>Cuantos pedidos por minuto aguanta una canasta. Cero es "no se mide".</summary>
    public int PerMinuteFor(RateBucket bucket) => bucket switch
    {
        RateBucket.Auth => AuthPerMinute,
        RateBucket.Search => SearchPerMinute,
        RateBucket.Routing => RoutingPerMinute,
        RateBucket.Delivery => DeliveryPerMinute,
        RateBucket.Write => WritePerMinute,
        RateBucket.Read => ReadPerMinute,
        _ => 0
    };

    /// <summary>
    /// Lee la seccion "RateLimit". Lo que no este escrito queda como viene de
    /// fabrica, y un numero que dejaria a todos afuera corta el arranque.
    /// </summary>
    public static RateLimitSettings From(IConfiguration configuration)
    {
        var settings = configuration.GetSection(Section).Get<RateLimitSettings>() ?? new RateLimitSettings();

        settings.Validate();

        return settings;
    }

    /// <summary>
    /// Un cero no apaga el limite: lo pone en "nadie pasa". Si eso entro por la
    /// configuracion del servidor, hay que enterarse al arrancar y no cuando el
    /// primer camionero no puede entrar. Para apagarlo esta Enabled.
    /// </summary>
    public void Validate()
    {
        foreach (var bucket in new[]
                 {
                     RateBucket.Auth, RateBucket.Search, RateBucket.Routing,
                     RateBucket.Delivery, RateBucket.Write, RateBucket.Read
                 })
        {
            Positivo(PerMinuteFor(bucket), $"{Section}:{bucket}PerMinute");
        }

        Positivo(AuthPerHour, $"{Section}:AuthPerHour");
    }

    private static void Positivo(int valor, string nombre)
    {
        if (valor <= 0)
        {
            throw new InvalidOperationException(
                $"{nombre} tiene que ser mayor que cero: {valor} dejaria a todos afuera. Para apagar el limite va {Section}:Enabled en false.");
        }
    }
}
