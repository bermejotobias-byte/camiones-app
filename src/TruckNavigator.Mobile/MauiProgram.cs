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

        builder.Services.AddTransient<TruckListPage>();
        builder.Services.AddTransient<TruckEditPage>();
        builder.Services.AddTransient<MapPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
