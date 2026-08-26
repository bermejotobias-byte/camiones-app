namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Convierte lo que una persona escribe en la direccion de un backend.
/// </summary>
/// <remarks>
/// <para>
/// Vive en su propio archivo y <b>no depende de MAUI ni de nada de Android</b>, a
/// proposito: asi el proyecto de tests lo puede enlazar y probar de verdad. El
/// resto de la cascara solo compila para Android, donde no llegan los tests.
/// </para>
/// <para>
/// Existe porque su ausencia dejo la app inutilizable: la direccion escrita a
/// mano se guardaba sin validar, le ganaba a la del build y sobrevivia a
/// reinstalar. Una IP sin <c>http://</c> —lo que cualquiera escribe— bastaba
/// para que no hubiera forma de volver atras. Ver AD-33.
/// </para>
/// </remarks>
public static class BackendAddress
{
    /// <summary>
    /// Normaliza una direccion escrita a mano.
    /// </summary>
    /// <param name="input">Lo que escribio la persona.</param>
    /// <param name="url">Esquema, host y puerto. Sin barra final, sin ruta.</param>
    /// <param name="problem">Que tiene de malo, en criollo, para mostrarselo.</param>
    /// <remarks>
    /// Indulgente con lo que la gente escribe de verdad y estricta con lo que
    /// devuelve. <c>192.168.1.5:5080</c> se completa a
    /// <c>http://192.168.1.5:5080</c>: nadie tipea el esquema al poner una IP en
    /// un telefono, y rechazarlo seria correcto y a la vez inutil. Lo que no pasa
    /// es lo que no puede funcionar, y se dice por que.
    /// </remarks>
    public static bool TryNormalize(string? input, out string url, out string problem)
    {
        url = string.Empty;
        problem = string.Empty;

        var text = input?.Trim() ?? string.Empty;

        if (text.Length == 0)
        {
            problem = "Escribí la dirección del servidor.";
            return false;
        }

        // Un esquema ausente es lo normal al tipear una IP: se completa. Uno
        // presente pero que no es HTTP es otra cosa, y no se toca.
        if (!text.Contains("://", StringComparison.Ordinal))
        {
            text = "http://" + text;
        }

        if (!Uri.TryCreate(text, UriKind.Absolute, out var parsed))
        {
            problem = "Esa dirección no se entiende. Va algo como " +
                      "192.168.1.5:5080 o http://mi-servidor.com";
            return false;
        }

        if (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps)
        {
            problem = "La dirección tiene que empezar con http:// o https://, " +
                      $"no con {parsed.Scheme}://";
            return false;
        }

        if (string.IsNullOrWhiteSpace(parsed.Host))
        {
            problem = "Falta la dirección del servidor: una IP o un nombre.";
            return false;
        }

        // Se reconstruye desde lo parseado y no desde el texto: asi se descartan
        // la ruta, la consulta y el fragmento que se hayan colado. La base es
        // solo esquema, host y puerto — pegarle "/api/health" a algo que ya trae
        // una ruta da una direccion que no existe.
        url = parsed.GetLeftPart(UriPartial.Authority);

        return true;
    }
}
