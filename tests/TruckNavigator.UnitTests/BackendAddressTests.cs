using TruckNavigator.Mobile.Services;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La direccion del backend escrita a mano.
/// </summary>
/// <remarks>
/// Estos tests existen por una falla concreta: la app aceptaba y guardaba
/// cualquier texto como direccion del servidor. Escribir la IP sin
/// <c>http://</c> —lo que cualquiera escribe— producia algo que ni siquiera es
/// una URI absoluta; el valor quedaba guardado, le ganaba al del build y
/// sobrevivia a reinstalar la app. Resultado: la aplicacion quedaba inutilizable
/// y el unico mensaje era <c>net_http_client_invalid_requesturi</c>. Ver AD-33.
/// </remarks>
public class BackendAddressTests
{
    private static string Normalized(string? input)
    {
        Assert.True(BackendAddress.TryNormalize(input, out var url, out var problem),
            $"deberia haber aceptado '{input}' pero dijo: {problem}");

        return url;
    }

    private static string Rejected(string? input)
    {
        Assert.False(BackendAddress.TryNormalize(input, out var url, out var problem),
            $"deberia haber rechazado '{input}' pero devolvio '{url}'");

        Assert.False(string.IsNullOrWhiteSpace(problem), "un rechazo sin motivo no sirve");

        return problem;
    }

    /* ----------------------------------------------------------------------
       Lo que la gente escribe de verdad
    ---------------------------------------------------------------------- */

    [Theory]
    [InlineData("192.168.1.5:5080")]
    [InlineData("  192.168.1.5:5080  ")]
    public void Una_IP_sin_esquema_se_completa_con_http(string escrito)
    {
        // Es EL caso que rompio la app: nadie tipea "http://" en un telefono.
        Assert.Equal("http://192.168.1.5:5080", Normalized(escrito));
    }

    [Fact]
    public void Un_nombre_sin_esquema_tambien_se_completa()
    {
        Assert.Equal("http://mi-servidor.local:5080", Normalized("mi-servidor.local:5080"));
    }

    [Fact]
    public void Una_direccion_ya_completa_no_se_toca()
    {
        Assert.Equal("http://192.168.1.5:5080", Normalized("http://192.168.1.5:5080"));
    }

    [Fact]
    public void Https_se_respeta_y_no_se_degrada_a_http()
    {
        Assert.Equal("https://algo.trycloudflare.com", Normalized("https://algo.trycloudflare.com"));
    }

    [Fact]
    public void La_barra_final_se_descarta()
    {
        // Si sobrevive, cada pedido queda con doble barra: ".../api//health".
        Assert.Equal("http://192.168.1.5:5080", Normalized("http://192.168.1.5:5080/"));
    }

    [Fact]
    public void Una_ruta_pegada_se_descarta()
    {
        // Pasa al copiar la URL del navegador. Si sobrevive, el chequeo termina
        // pidiendo ".../api/health/api/health".
        Assert.Equal("http://192.168.1.5:5080", Normalized("http://192.168.1.5:5080/api/health"));
    }

    [Fact]
    public void La_consulta_y_el_fragmento_se_descartan()
    {
        Assert.Equal("http://192.168.1.5:5080", Normalized("http://192.168.1.5:5080/?a=1#x"));
    }

    [Fact]
    public void El_puerto_por_defecto_no_se_escribe()
    {
        Assert.Equal("https://mi-servidor.com", Normalized("https://mi-servidor.com:443"));
    }

    /* ----------------------------------------------------------------------
       Lo que no puede funcionar
    ---------------------------------------------------------------------- */

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Sin_texto_no_se_guarda_nada(string? escrito) => Rejected(escrito);

    [Fact]
    public void Un_esquema_que_no_es_http_se_rechaza_diciendo_cual_es()
    {
        var problema = Rejected("ftp://192.168.1.5");
        Assert.Contains("ftp", problema);
    }

    [Fact]
    public void Un_esquema_sin_host_se_rechaza()
    {
        Rejected("http://");
    }

    /* ----------------------------------------------------------------------
       La propiedad que importa

       Lo que salga de aca tiene que poder pegarse con "/api/health" y dar una
       direccion valida. Si esa invariante se rompe, vuelve la falla original.
    ---------------------------------------------------------------------- */

    [Theory]
    [InlineData("192.168.1.5:5080")]
    [InlineData("http://192.168.1.5:5080/")]
    [InlineData("https://algo.trycloudflare.com")]
    [InlineData("http://192.168.1.5:5080/api/health")]
    [InlineData("localhost:5080")]
    [InlineData("127.0.0.1:5080")]
    public void Lo_normalizado_siempre_arma_un_pedido_valido(string escrito)
    {
        var url = $"{Normalized(escrito)}/api/health";

        Assert.True(Uri.TryCreate(url, UriKind.Absolute, out var uri),
            $"'{url}' no es una URI absoluta");

        Assert.Equal("/api/health", uri!.AbsolutePath);
    }
}
