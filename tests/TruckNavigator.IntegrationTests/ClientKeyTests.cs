using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using TruckNavigator.Api.RateLimiting;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Contra quien se cuentan los pedidos: el camionero cuando hay sesion, la IP
/// cuando no. Detras del proxy la IP real viene en una cabecera, y cual de sus
/// entradas se cree no es un detalle: la de mas a la izquierda la escribe el
/// cliente.
/// </summary>
public class ClientKeyTests
{
    private static HttpContext Pedido(string? ip = "200.1.2.3", string? forwarded = null, Guid? usuario = null)
    {
        var context = new DefaultHttpContext();

        if (ip is not null)
        {
            context.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        }

        if (forwarded is not null)
        {
            context.Request.Headers["X-Forwarded-For"] = forwarded;
        }

        if (usuario is not null)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, usuario.Value.ToString())], "Bearer"));
        }

        return context;
    }

    [Fact]
    public void With_a_session_the_count_is_against_the_driver()
    {
        var camionero = Guid.NewGuid();

        Assert.Equal($"u:{camionero}", ClientKey.For(Pedido(usuario: camionero), trustForwardedFor: false));
    }

    [Fact]
    public void The_same_driver_keeps_his_key_when_changes_network()
    {
        // Un camion pasa de la red del deposito a los datos del telefono en medio
        // de un viaje. Si la clave fuera la IP, el limite se le reiniciaria solo.
        var camionero = Guid.NewGuid();

        var enElDeposito = ClientKey.For(Pedido("200.1.2.3", usuario: camionero), trustForwardedFor: false);
        var enLaRuta = ClientKey.For(Pedido("181.9.9.9", usuario: camionero), trustForwardedFor: false);

        Assert.Equal(enElDeposito, enLaRuta);
    }

    [Fact]
    public void Without_a_session_the_count_is_against_the_address()
    {
        Assert.Equal("ip:200.1.2.3", ClientKey.For(Pedido(), trustForwardedFor: false));
    }

    [Fact]
    public void Without_a_proxy_in_front_the_header_is_a_lie_and_is_ignored()
    {
        var pedido = Pedido("200.1.2.3", forwarded: "8.8.8.8");

        Assert.Equal("ip:200.1.2.3", ClientKey.For(pedido, trustForwardedFor: false));
    }

    [Fact]
    public void Behind_the_proxy_the_address_is_the_last_entry_the_proxy_wrote()
    {
        // Caddy AGREGA la IP que ve al final de lo que ya venia. Un cliente que
        // manda su propia cabecera queda a la izquierda: creerle a la primera
        // entrada es dejar que cualquiera elija su canasta.
        var pedido = Pedido("10.0.0.2", forwarded: "8.8.8.8, 181.9.9.9");

        Assert.Equal("ip:181.9.9.9", ClientKey.For(pedido, trustForwardedFor: true));
    }

    [Fact]
    public void Behind_the_proxy_with_a_single_entry_that_is_the_client()
    {
        var pedido = Pedido("10.0.0.2", forwarded: "181.9.9.9");

        Assert.Equal("ip:181.9.9.9", ClientKey.For(pedido, trustForwardedFor: true));
    }

    [Fact]
    public void A_header_that_is_not_an_address_falls_back_to_the_connection()
    {
        var pedido = Pedido("10.0.0.2", forwarded: "no-soy-una-ip");

        Assert.Equal("ip:10.0.0.2", ClientKey.For(pedido, trustForwardedFor: true));
    }

    [Fact]
    public void Without_any_address_the_key_is_still_stable()
    {
        // Sin IP todos caen en la misma canasta, que es lo unico honesto que se
        // puede hacer: es mejor que quedar sin limite.
        Assert.Equal("ip:desconocida", ClientKey.For(Pedido(ip: null), trustForwardedFor: false));
    }
}
