using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TruckNavigator.Domain.Places;
using TruckNavigator.Domain.Restrictions;
using TruckNavigator.Domain.Routing;
using TruckNavigator.Infrastructure.Email;
using TruckNavigator.Infrastructure.Persistence;
using TruckNavigator.Infrastructure.Places;
using TruckNavigator.Infrastructure.Routing;

namespace TruckNavigator.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite(configuration.GetConnectionString("Default")
                              ?? "Data Source=trucknavigator.db"));

        services.AddOptions<GraphHopperOptions>()
            .Bind(configuration.GetSection(GraphHopperOptions.SectionName))
            .ValidateOnStart();

        services.AddOptions<GeocodingOptions>()
            .Bind(configuration.GetSection(GeocodingOptions.SectionName))
            .ValidateOnStart();

        services.AddOptions<EmailOptions>()
            .Bind(configuration.GetSection(EmailOptions.SectionName))
            .ValidateOnStart();

        // El envio de mail es infraestructura. Que Identity lo use se cablea en la
        // capa web, junto con el resto de la configuracion de autenticacion.
        services.AddSingleton<IAppEmailSender, SmtpEmailSender>();

        // Las reglas viven una sola vez: la politica las traduce al motor de
        // ruteo y el evaluador las explica. Ambas se registran juntas para que
        // no puedan divergir por configuracion.
        services.AddSingleton<ITruckRoutingPolicy, CabaTruckRoutingPolicy>();
        services.AddSingleton<IRestrictionEvaluator, CabaRestrictionEvaluator>();

        services.AddHttpClient<ITruckRouteCalculator, GraphHopperRouteCalculator>(
            (provider, client) =>
            {
                var options = provider
                    .GetRequiredService<Microsoft.Extensions.Options.IOptions<GraphHopperOptions>>()
                    .Value;

                // La barra final es necesaria para que la ruta relativa "route"
                // no reemplace el ultimo segmento del path base.
                client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            });

        services.AddHttpClient<IPlaceSearch, PhotonPlaceSearch>((provider, client) =>
        {
            var options = provider
                .GetRequiredService<Microsoft.Extensions.Options.IOptions<GeocodingOptions>>()
                .Value;

            client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            client.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
        });

        return services;
    }
}
