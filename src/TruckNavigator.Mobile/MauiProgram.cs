using Microsoft.Extensions.Logging;
using TruckNavigator.Mobile.Pages;
using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        builder.Services.AddSingleton(_ => new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(90)
        });

        builder.Services.AddSingleton<TruckNavigatorApi>();

        builder.Services.AddTransient<AppPage>();

        ConfigureWebView();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }

    /// <summary>
    /// Ajustes del WebView que la app necesita para poder hablar con el backend.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Contenido mixto.</b> HybridWebView sirve la interfaz desde un origen
    /// virtual <c>https</c>, y el backend en la red local es <c>http</c> plano.
    /// Chromium bloquea esa combinacion por defecto y el pedido no llega a salir:
    /// la app queda en blanco sin ningun error visible del lado del servidor.
    /// </para>
    /// <para>
    /// Es una concesion consciente y acotada: Android ademas exige que la IP este
    /// declarada en <c>network_security_config.xml</c>, asi que el trafico en
    /// claro sigue restringido a las direcciones que se listan ahi. Cuando el
    /// backend se publique por HTTPS, esta excepcion se puede sacar.
    /// </para>
    /// </remarks>
    private static void ConfigureWebView()
    {
#if ANDROID
        Microsoft.Maui.Handlers.HybridWebViewHandler.Mapper.AppendToMapping(
            "PermitirBackendEnClaro",
            (handler, _) =>
            {
                handler.PlatformView.Settings.MixedContentMode =
                    Android.Webkit.MixedContentHandling.AlwaysAllow;
            });
#endif
    }
}
