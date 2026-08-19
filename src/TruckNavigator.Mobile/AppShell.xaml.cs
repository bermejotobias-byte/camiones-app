using TruckNavigator.Mobile.Pages;

namespace TruckNavigator.Mobile;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();

        Routing.RegisterRoute(nameof(TruckEditPage), typeof(TruckEditPage));
        Routing.RegisterRoute(nameof(MapPage), typeof(MapPage));
    }
}
