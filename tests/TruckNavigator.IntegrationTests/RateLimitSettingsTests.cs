using Microsoft.Extensions.Configuration;
using TruckNavigator.Api.RateLimiting;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los numeros del limite de tasa. Estan fijados aca a proposito: cambiarlos es
/// una decision, no un accidente, y el de lectura sale de una medicion.
/// </summary>
public class RateLimitSettingsTests
{
    [Fact]
    public void The_numbers_that_ship_are_the_ones_that_were_decided()
    {
        var settings = new RateLimitSettings();

        Assert.True(settings.Enabled);
        Assert.False(settings.TrustForwardedFor);   // sin proxy adelante, la cabecera se falsifica
        Assert.Equal(10, settings.AuthPerMinute);
        Assert.Equal(30, settings.AuthPerHour);
        Assert.Equal(40, settings.SearchPerMinute);
        Assert.Equal(20, settings.RoutingPerMinute);
        Assert.Equal(6, settings.DeliveryPerMinute);
        Assert.Equal(40, settings.WritePerMinute);
        Assert.Equal(300, settings.ReadPerMinute);
    }

    [Fact]
    public void Reading_leaves_room_over_what_a_person_really_does()
    {
        // Medido el 29/09/2026 en el navegador a 375x812: arrastrando el mapa cada
        // 1,1 segundos —el peor caso de alguien buscando— la app manda 37 pedidos
        // por minuto, y el techo del debounce de un segundo es 57. La canasta de
        // lectura tiene que dejar varias veces eso: si aprieta, no frena a un
        // abusador, rompe el mapa de un camionero.
        var settings = new RateLimitSettings();

        Assert.True(settings.ReadPerMinute >= 37 * 5, "la lectura tiene que dejar al menos cinco veces el pico medido");
        Assert.True(settings.ReadPerMinute >= 57 * 3, "y al menos tres veces el techo del debounce");
    }

    [Fact]
    public void Each_bucket_knows_its_own_number_and_what_is_outside_has_none()
    {
        var settings = new RateLimitSettings();

        Assert.Equal(10, settings.PerMinuteFor(RateBucket.Auth));
        Assert.Equal(40, settings.PerMinuteFor(RateBucket.Search));
        Assert.Equal(20, settings.PerMinuteFor(RateBucket.Routing));
        Assert.Equal(6, settings.PerMinuteFor(RateBucket.Delivery));
        Assert.Equal(40, settings.PerMinuteFor(RateBucket.Write));
        Assert.Equal(300, settings.PerMinuteFor(RateBucket.Read));
        Assert.Equal(0, settings.PerMinuteFor(RateBucket.None));
    }

    [Fact]
    public void The_configuration_can_move_a_number_without_touching_the_others()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimit:ReadPerMinute"] = "600",
                ["RateLimit:TrustForwardedFor"] = "true"
            })
            .Build();

        var settings = RateLimitSettings.From(config);

        Assert.Equal(600, settings.ReadPerMinute);
        Assert.True(settings.TrustForwardedFor);
        Assert.Equal(40, settings.WritePerMinute);   // lo que no se toca queda como venia
        Assert.True(settings.Enabled);
    }

    [Fact]
    public void Without_the_section_the_defaults_stand()
    {
        var settings = RateLimitSettings.From(new ConfigurationBuilder().Build());

        Assert.Equal(300, settings.ReadPerMinute);
        Assert.True(settings.Enabled);
    }

    [Fact]
    public void It_can_be_turned_off_whole_from_the_configuration()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimit:Enabled"] = "false" })
            .Build();

        Assert.False(RateLimitSettings.From(config).Enabled);
    }

    [Theory]
    [InlineData("RateLimit:ReadPerMinute", "0")]
    [InlineData("RateLimit:WritePerMinute", "-1")]
    [InlineData("RateLimit:AuthPerHour", "0")]
    public void A_number_that_would_lock_everyone_out_stops_the_arranque(string key, string value)
    {
        // Un cero no apaga el limite: lo pone en "nadie pasa". Si alguien escribe
        // eso en el .env del servidor, tiene que enterarse al arrancar y no cuando
        // el primer camionero no puede entrar.
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [key] = value })
            .Build();

        var error = Assert.Throws<InvalidOperationException>(() => RateLimitSettings.From(config));

        Assert.Contains("RateLimit", error.Message);
    }
}
