using Android.Webkit;

namespace TruckNavigator.Mobile.Platforms.Android;

/// <summary>
/// Saca la consola del WebView al log del sistema.
/// </summary>
/// <remarks>
/// <para>
/// <b>Es la herramienta que faltaba.</b> Adentro del APK la interfaz entera es
/// JavaScript, y hasta ahora todo lo que esa capa dijera —un <c>console.error</c>,
/// una excepcion sin atrapar, un modulo que no carga— <b>ocurria sin dejar
/// rastro</b>: MAUI no instala ningun <c>WebChromeClient</c>, y sin uno Android
/// descarta los mensajes de consola en silencio. Es la misma ausencia que hacia
/// que <c>confirm()</c> devolviera <c>false</c> sin mostrar nada (ver AD-28).
/// </para>
/// <para>
/// Las cinco fallas que costaron mas tiempo en este proyecto estuvieron todas en
/// la costura entre la cascara nativa y la web, y todas se diagnosticaron a
/// ciegas por no tener esto. Ahora se leen con:
/// </para>
/// <code>adb logcat -s Web</code>
/// <para>
/// No se implementan <c>onJsAlert</c> ni <c>onJsConfirm</c> a proposito. Que los
/// dialogos del navegador no existan es una decision tomada, no una carencia: la
/// app pide las decisiones con su propia hoja, que se toca sin apuntar y se lee
/// manejando (AD-28). Atenderlos aca seria reabrir esa puerta.
/// </para>
/// </remarks>
public sealed class WebViewConsole : WebChromeClient
{
    private const string LogTag = "Web";

    public override bool OnConsoleMessage(ConsoleMessage? consoleMessage)
    {
        if (consoleMessage is null)
        {
            return false;
        }

        // El origen y la linea importan tanto como el mensaje: los modulos son
        // varios y "undefined is not a function" sin archivo no dice nada.
        var origin = Shorten(consoleMessage.SourceId());
        var text = $"{consoleMessage.Message()}  [{origin}:{consoleMessage.LineNumber()}]";

        // El nivel es un enum de Java, no de C#: sus miembros no son constantes y
        // no sirven como etiquetas de un switch. Se compara por nombre, que es lo
        // que devuelve toString() de cualquier enum de Java.
        switch (consoleMessage.InvokeMessageLevel()?.ToString())
        {
            case "ERROR":
                global::Android.Util.Log.Error(LogTag, text);
                break;

            case "WARNING":
                global::Android.Util.Log.Warn(LogTag, text);
                break;

            default:
                global::Android.Util.Log.Info(LogTag, text);
                break;
        }

        // false para que Android siga haciendo lo suyo con el mensaje.
        return false;
    }

    /// <summary>
    /// Deja solo el nombre del archivo.
    /// </summary>
    /// <remarks>
    /// El origen viene como URL completa desde el host virtual del WebView, que
    /// es larguisima e igual en todas las lineas. Lo unico que distingue una de
    /// otra es el final.
    /// </remarks>
    private static string Shorten(string? sourceId)
    {
        if (string.IsNullOrEmpty(sourceId))
        {
            return "?";
        }

        var slash = sourceId.LastIndexOf('/');
        return slash >= 0 && slash < sourceId.Length - 1 ? sourceId[(slash + 1)..] : sourceId;
    }
}
