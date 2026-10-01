namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Cuantas veces y cada cuanto se reintenta la conexion inicial con el backend.
/// </summary>
/// <remarks>
/// <para>
/// Vive en su propio archivo y <b>no depende de MAUI ni de nada de Android</b>, a
/// proposito: asi el proyecto de tests lo puede enlazar y probar de verdad. Es la
/// misma razon por la que <see cref="BackendAddress"/> esta separado.
/// </para>
/// <para>
/// Existe por un defecto medido: la app hacia <b>un solo intento</b> al arrancar y
/// fallaba al abrirla, pero a la segunda andaba. El motivo es que al abrir la app
/// la red del telefono suele no estar lista todavia —la WiFi reconecta al salir
/// de suspension— y ese primer intento agarra el hueco. Un solo intento convierte
/// medio segundo de red dormida en una pantalla de error.
/// </para>
/// <para>
/// Y el costo de equivocarse no es parejo: reintentar de mas cuesta segundos de
/// espera <i>con el cartel explicando que esta reintentando</i>; reintentar de
/// menos manda al usuario a la pantalla de configurar servidor a tocar una
/// direccion que estaba bien. Lo segundo es mucho peor, y ademas es como se
/// terminan rompiendo direcciones que funcionaban.
/// </para>
/// </remarks>
public static class ConnectionRetry
{
    /// <summary>
    /// Cuantos intentos se hacen antes de darse por vencido.
    /// </summary>
    /// <remarks>
    /// Tres y no mas. Con los tiempos de abajo, el peor caso —servidor apagado,
    /// los tres intentos agotando su espera— son unos 22 segundos. Estirarlo a
    /// cuatro se iba a mas de medio minuto mirando un cartel, y a esa altura la
    /// app ya parece colgada aunque diga lo que esta haciendo.
    /// </remarks>
    public const int MaxAttempts = 3;

    /// <summary>
    /// Cuanto esperar ANTES del intento numero <paramref name="attempt"/>, que se
    /// cuenta desde 1.
    /// </summary>
    /// <remarks>
    /// El primero sale sin esperar: cuando la red esta bien, el backend contesta
    /// en milisegundos y meter una demora ahi seria castigar el caso normal para
    /// cubrir el excepcional. Los siguientes esperan cada vez mas, que es lo que
    /// le da tiempo a la interfaz de red a terminar de levantar.
    /// </remarks>
    public static TimeSpan DelayBefore(int attempt) => attempt switch
    {
        <= 1 => TimeSpan.Zero,
        2 => TimeSpan.FromMilliseconds(1200),
        _ => TimeSpan.FromMilliseconds(2500)
    };

    /// <summary>
    /// Cuanto se le da al intento numero <paramref name="attempt"/> para contestar.
    /// </summary>
    /// <remarks>
    /// El primero es corto porque con la red sana la respuesta es inmediata: si no
    /// llego en cuatro segundos, casi seguro no va a llegar, y conviene volver a
    /// intentar antes que seguir esperando. Los siguientes son mas largos para
    /// darle lugar a un backend lento de verdad — un tunel Cloudflare recien
    /// levantado tarda varios segundos en la primera respuesta.
    ///
    /// Nunca hereda el timeout del <see cref="System.Net.Http.HttpClient"/>, que
    /// esta dimensionado para calcular rutas: con aquel, la app se quedaba casi
    /// dos minutos en "Conectando…" antes de admitir que no llegaba.
    /// </remarks>
    public static TimeSpan TimeoutFor(int attempt) => attempt switch
    {
        <= 1 => TimeSpan.FromSeconds(4),
        _ => TimeSpan.FromSeconds(7)
    };

    /// <summary>
    /// Si despues del intento <paramref name="attempt"/> corresponde intentar otra vez.
    /// </summary>
    /// <param name="attempt">Numero del intento que acaba de terminar, desde 1.</param>
    /// <param name="reachable">Si ese intento encontro el backend.</param>
    /// <param name="retriable">
    /// Si la falla es de las que pueden resolverse solas. Una direccion mal
    /// escrita no lo es: va a fallar igual las tres veces, y reintentarla es
    /// hacer esperar veinte segundos para dar el error que ya se sabia.
    /// </param>
    public static bool ShouldRetry(int attempt, bool reachable, bool retriable) =>
        !reachable && retriable && attempt < MaxAttempts;

    /// <summary>
    /// Lo que se le muestra al usuario mientras espera.
    /// </summary>
    /// <remarks>
    /// El primer intento NO dice "intento 1 de 3": en el caso normal dura
    /// milisegundos y anunciar reintentos que no van a pasar solo siembra la duda
    /// de que algo anda mal. El numero aparece recien cuando efectivamente se
    /// esta reintentando, que es cuando explica la demora.
    /// </remarks>
    public static string Describe(int attempt, string address) =>
        attempt <= 1
            ? $"Conectando con {address}…"
            : $"Sin respuesta. Reintentando… ({attempt} de {MaxAttempts})";
}
