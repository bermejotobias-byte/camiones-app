using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace TruckNavigator.Api.RateLimiting;

/// <summary>
/// El limitador de tasa de la API: una canasta por tipo de pedido y por quien
/// pide, encadenadas por minuto y por hora.
///
/// Se arma con dos limitadores en cadena, no con atributos en cada endpoint: el
/// del minuto mide todo, y el de la hora solo las cuentas. Encadenados, un
/// pedido de cuenta tiene que pasar los dos.
///
/// Lo que no es /api queda sin medir: los tiles del mapa base son cientos de
/// pedidos de rango por pantalla y frenarlos seria romper el mapa para cuidar
/// algo que no cuesta nada. Eso es trabajo del proxy.
/// </summary>
public static class TruckRateLimiter
{
    /// <summary>Cuanto se espera cuando el limitador no dice cuanto.</summary>
    private const int EsperaPorDefecto = 60;

    /// <summary>La canasta del minuto: todas las clases de pedido, con su numero.</summary>
    public static PartitionedRateLimiter<HttpContext> PerMinute(RateLimitSettings settings) =>
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
        {
            var canasta = BucketOf(context, settings);

            if (canasta == RateBucket.None)
            {
                return RateLimitPartition.GetNoLimiter("libre");
            }

            var clave = $"{canasta}:{ClientKey.For(context, settings.TrustForwardedFor)}";

            // La lectura va como balde de fichas y no como ventana fija: el mapa
            // pide de a rafagas cuando el camionero arrastra, y un balde aguanta
            // la rafaga sin regalar el minuto entero de golpe.
            if (canasta == RateBucket.Read)
            {
                return RateLimitPartition.GetTokenBucketLimiter(clave, _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = settings.ReadPerMinute,
                    TokensPerPeriod = Math.Max(1, settings.ReadPerMinute / 60),
                    ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                    AutoReplenishment = true,
                    QueueLimit = 0
                });
            }

            return RateLimitPartition.GetFixedWindowLimiter(clave, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = settings.PerMinuteFor(canasta),
                Window = TimeSpan.FromMinutes(1),
                AutoReplenishment = true,
                QueueLimit = 0
            });
        });

    /// <summary>
    /// La canasta de la hora, solo para las cuentas: sin esto, diez altas por
    /// minuto son seiscientas en una tarde.
    /// </summary>
    public static PartitionedRateLimiter<HttpContext> PerHour(RateLimitSettings settings) =>
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
        {
            if (BucketOf(context, settings) != RateBucket.Auth)
            {
                return RateLimitPartition.GetNoLimiter("libre");
            }

            var clave = $"AuthHora:{ClientKey.For(context, settings.TrustForwardedFor)}";

            return RateLimitPartition.GetFixedWindowLimiter(clave, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = settings.AuthPerHour,
                Window = TimeSpan.FromHours(1),
                AutoReplenishment = true,
                QueueLimit = 0
            });
        });

    /// <summary>Las dos en cadena, que es como las usa la API.</summary>
    public static PartitionedRateLimiter<HttpContext> Chained(RateLimitSettings settings) =>
        PartitionedRateLimiter.CreateChained(PerMinute(settings), PerHour(settings));

    /// <summary>Registra el limitador y lo que se contesta cuando corta.</summary>
    public static void AddTo(IServiceCollection services, RateLimitSettings settings)
    {
        services.AddRateLimiter(options =>
        {
            options.GlobalLimiter = Chained(settings);

            options.OnRejected = async (contexto, ct) =>
            {
                var http = contexto.HttpContext;
                var canasta = RateLimitPlan.BucketFor(http.Request.Method, http.Request.Path.Value ?? string.Empty);

                var espera = SecondsFrom(
                    contexto.Lease.TryGetMetadata(MetadataName.RetryAfter, out var cuanto) ? cuanto : null);

                // Misma forma que el 429 del abuso de reportes: la app muestra
                // problem.detail tal como viene, y Retry-After es para cualquier
                // otro cliente.
                http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                http.Response.Headers.RetryAfter = espera.ToString(CultureInfo.InvariantCulture);

                var problema = new ProblemDetails
                {
                    Title = "Muy seguido",
                    Detail = Message(canasta, espera),
                    Status = StatusCodes.Status429TooManyRequests
                };

                problema.Extensions["retryAfterSeconds"] = espera;

                await http.Response.WriteAsJsonAsync(problema, options: null, contentType: "application/problem+json", ct);
            };
        });
    }

    /// <summary>Segundos enteros, nunca cero: "espera 0 segundos" no es una instruccion.</summary>
    public static int SecondsFrom(TimeSpan? retryAfter) =>
        retryAfter is null
            ? EsperaPorDefecto
            : Math.Max(1, (int)Math.Ceiling(retryAfter.Value.TotalSeconds));

    /// <summary>
    /// Que se le dice al que espera, segun por que lo frenaron.
    ///
    /// La espera va como techo ("hasta N") y no como dato exacto: medido el
    /// 29/09/2026, la ventana fija de .NET informa el minuto entero y no lo que
    /// falta, asi que decir "espera 60 segundos" cuando quedan cinco es mentirle
    /// al que espera. El 429 de los reportes si tiene el numero exacto, porque ese
    /// lo calcula el dominio.
    /// </summary>
    public static string Message(RateBucket bucket, int seconds)
    {
        var espera = $"hasta {seconds} {(seconds == 1 ? "segundo" : "segundos")}";

        return bucket switch
        {
            RateBucket.Auth =>
                $"Demasiados intentos con esta cuenta o desde esta red. Espera {espera}.",
            RateBucket.Search =>
                $"Muchas busquedas seguidas. Espera {espera} y proba de nuevo.",
            _ =>
                $"Estas pidiendo muy seguido. Espera {espera} y proba de nuevo."
        };
    }

    private static RateBucket BucketOf(HttpContext context, RateLimitSettings settings) =>
        settings.Enabled
            ? RateLimitPlan.BucketFor(context.Request.Method, context.Request.Path.Value ?? string.Empty)
            : RateBucket.None;
}
