using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using TruckNavigator.Api.RateLimiting;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// El limitador armado tal como lo usa la API, atacado de verdad: se piden
/// permisos hasta que corta. No hace falta HTTP para eso, y asi el test mide la
/// configuracion real y no una copia.
/// </summary>
public class TruckRateLimiterTests
{
    private static readonly RateLimitSettings Settings = new();

    private static HttpContext Pedido(string method, string path, string ip = "200.1.2.3", Guid? usuario = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);

        if (usuario is not null)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, usuario.Value.ToString())], "Bearer"));
        }

        return context;
    }

    /// <summary>Cuantos permisos se consiguen antes del primer no.</summary>
    private static async Task<int> PasanAsync(PartitionedRateLimiter<HttpContext> limiter, HttpContext pedido, int tope)
    {
        for (var i = 0; i < tope; i++)
        {
            using var lease = await limiter.AcquireAsync(pedido, 1, CancellationToken.None);

            if (!lease.IsAcquired)
            {
                return i;
            }
        }

        return tope;
    }

    [Fact]
    public async Task Reading_the_map_holds_what_a_person_does_and_cuts_the_script()
    {
        using var limiter = TruckRateLimiter.PerMinute(Settings);

        // La canasta es un balde de 300 que se rellena de a 5 por segundo, asi que
        // mientras corre el bucle entran unos pocos mas. Lo que importa es que una
        // persona (37 por minuto, medido) no se acerca, y un script se come el tope.
        var pasaron = await PasanAsync(limiter, Pedido("GET", "/api/reports"), 400);

        Assert.InRange(pasaron, Settings.ReadPerMinute, Settings.ReadPerMinute + 30);
    }

    [Fact]
    public async Task The_rejection_says_how_long_to_wait()
    {
        using var limiter = TruckRateLimiter.PerMinute(Settings);
        var pedido = Pedido("POST", "/api/routes/delivery");

        await PasanAsync(limiter, pedido, Settings.DeliveryPerMinute);

        using var lease = await limiter.AcquireAsync(pedido, 1, CancellationToken.None);

        Assert.False(lease.IsAcquired);
        Assert.True(lease.TryGetMetadata(MetadataName.RetryAfter, out var espera));
        Assert.InRange(espera.TotalSeconds, 1, 60);
    }

    [Fact]
    public async Task Two_drivers_do_not_share_a_bucket()
    {
        using var limiter = TruckRateLimiter.PerMinute(Settings);
        var uno = Guid.NewGuid();
        var otro = Guid.NewGuid();

        await PasanAsync(limiter, Pedido("POST", "/api/reports", usuario: uno), Settings.WritePerMinute + 1);

        var delOtro = await PasanAsync(limiter, Pedido("POST", "/api/reports", usuario: otro), 1);

        Assert.Equal(1, delOtro);
    }

    [Fact]
    public async Task Burning_the_routing_bucket_does_not_take_the_map_with_it()
    {
        // La separacion por canastas es la razon de ser del diseno: alguien que
        // abusa del calculo de rutas tiene que seguir viendo el mapa.
        using var limiter = TruckRateLimiter.PerMinute(Settings);
        var camionero = Guid.NewGuid();

        await PasanAsync(limiter, Pedido("POST", "/api/routes", usuario: camionero), Settings.RoutingPerMinute + 1);

        var leyendo = await PasanAsync(limiter, Pedido("GET", "/api/pois", usuario: camionero), 1);

        Assert.Equal(1, leyendo);
    }

    [Theory]
    [InlineData("POST", "/api/auth/login", 10)]
    [InlineData("GET", "/api/places", 40)]
    [InlineData("POST", "/api/routes", 20)]
    [InlineData("POST", "/api/routes/delivery", 6)]
    [InlineData("POST", "/api/reports", 40)]
    public async Task Each_bucket_cuts_where_it_says(string method, string path, int esperados)
    {
        using var limiter = TruckRateLimiter.PerMinute(Settings);

        var pasaron = await PasanAsync(limiter, Pedido(method, path), esperados + 5);

        Assert.Equal(esperados, pasaron);
    }

    [Fact]
    public async Task Accounts_also_have_a_cap_for_the_whole_hour()
    {
        using var limiter = TruckRateLimiter.PerHour(Settings);
        var pedido = Pedido("POST", "/api/auth/register");

        var pasaron = await PasanAsync(limiter, pedido, Settings.AuthPerHour + 5);

        Assert.Equal(Settings.AuthPerHour, pasaron);
    }

    [Fact]
    public async Task The_hour_cap_is_only_about_accounts()
    {
        using var limiter = TruckRateLimiter.PerHour(Settings);

        var pasaron = await PasanAsync(limiter, Pedido("GET", "/api/reports"), 500);

        Assert.Equal(500, pasaron);
    }

    [Theory]
    [InlineData("GET", "/api/health")]
    [InlineData("GET", "/tiles/amba.pmtiles")]
    [InlineData("GET", "/js/app.js")]
    public async Task What_is_not_the_API_never_gets_cut(string method, string path)
    {
        using var limiter = TruckRateLimiter.Chained(Settings);

        var pasaron = await PasanAsync(limiter, Pedido(method, path), 1_000);

        Assert.Equal(1_000, pasaron);
    }

    [Fact]
    public async Task With_the_limit_turned_off_nothing_gets_cut()
    {
        using var limiter = TruckRateLimiter.Chained(new RateLimitSettings { Enabled = false });

        var pasaron = await PasanAsync(limiter, Pedido("POST", "/api/routes/delivery"), 100);

        Assert.Equal(100, pasaron);
    }

    [Fact]
    public void The_wait_is_always_a_whole_second_that_a_person_can_read()
    {
        Assert.Equal(1, TruckRateLimiter.SecondsFrom(TimeSpan.FromMilliseconds(120)));
        Assert.Equal(24, TruckRateLimiter.SecondsFrom(TimeSpan.FromSeconds(23.4)));
        Assert.Equal(60, TruckRateLimiter.SecondsFrom(null));
    }

    [Fact]
    public void The_message_tells_the_driver_what_to_do()
    {
        Assert.Contains("23 segundos", TruckRateLimiter.Message(RateBucket.Read, 23));

        // Los intentos de cuenta merecen otra frase: ahi el que espera suele ser
        // alguien que se equivoco de contrasena, no un script.
        Assert.NotEqual(TruckRateLimiter.Message(RateBucket.Read, 23), TruckRateLimiter.Message(RateBucket.Auth, 23));
        Assert.Contains("23 segundos", TruckRateLimiter.Message(RateBucket.Auth, 23));

        // La espera es un techo, no un dato exacto: medido el 29/09/2026, la ventana
        // fija de .NET informa el minuto entero y no lo que falta. Decir "espera 60"
        // cuando quedan cinco es mentirle al que espera.
        Assert.Contains("hasta 23 segundos", TruckRateLimiter.Message(RateBucket.Read, 23));

        // Y un segundo no son "1 segundos".
        Assert.Contains("hasta 1 segundo", TruckRateLimiter.Message(RateBucket.Read, 1));
        Assert.DoesNotContain("1 segundos", TruckRateLimiter.Message(RateBucket.Read, 1));
    }
}
