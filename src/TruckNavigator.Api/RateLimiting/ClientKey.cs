using System.Net;
using System.Security.Claims;

namespace TruckNavigator.Api.RateLimiting;

/// <summary>
/// Contra quien se cuentan los pedidos.
///
/// Con sesion, el camionero: asi el limite lo sigue cuando el telefono pasa del
/// wifi del deposito a los datos, que es justo lo que hace un camion. Sin
/// sesion, la direccion desde la que llega.
/// </summary>
public static class ClientKey
{
    private const string Header = "X-Forwarded-For";

    public static string For(HttpContext context, bool trustForwardedFor)
    {
        var camionero = context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!string.IsNullOrWhiteSpace(camionero))
        {
            return $"u:{camionero}";
        }

        return $"ip:{Address(context, trustForwardedFor)}";
    }

    private static string Address(HttpContext context, bool trustForwardedFor)
    {
        if (trustForwardedFor && Forwarded(context) is { } reenviada)
        {
            return reenviada;
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "desconocida";
    }

    /// <summary>
    /// La IP que escribio el proxy: la ULTIMA entrada de la cabecera.
    ///
    /// Caddy agrega la direccion que ve al final de lo que ya venia, asi que un
    /// cliente que manda su propia cabecera queda a la izquierda. Creerle a la
    /// primera entrada seria dejar que cualquiera elija su canasta. Vale con un
    /// solo proxy adelante, que es el del deploy; con dos habria que contar
    /// saltos.
    /// </summary>
    private static string? Forwarded(HttpContext context)
    {
        var cabecera = context.Request.Headers[Header].ToString();

        if (string.IsNullOrWhiteSpace(cabecera))
        {
            return null;
        }

        var partes = cabecera.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        for (var i = partes.Length - 1; i >= 0; i--)
        {
            if (IPAddress.TryParse(Pelada(partes[i]), out var direccion))
            {
                return direccion.ToString();
            }
        }

        return null;
    }

    /// <summary>Saca el puerto y los corchetes de un IPv6, que algunos proxies mandan.</summary>
    private static string Pelada(string entrada)
    {
        if (entrada.StartsWith('['))
        {
            var cierre = entrada.IndexOf(']');
            return cierre > 0 ? entrada[1..cierre] : entrada;
        }

        var puerto = entrada.LastIndexOf(':');

        return puerto > 0 && entrada.IndexOf(':') == puerto ? entrada[..puerto] : entrada;
    }
}
