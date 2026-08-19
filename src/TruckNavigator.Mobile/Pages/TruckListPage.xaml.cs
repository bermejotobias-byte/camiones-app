using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile.Pages;

public partial class TruckListPage : ContentPage
{
    private readonly TruckNavigatorApi _api;

    public TruckListPage(TruckNavigatorApi api)
    {
        InitializeComponent();
        _api = api;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await LoadAsync();
    }

    private async Task LoadAsync()
    {
        try
        {
            StatusLabel.IsVisible = false;
            TrucksView.ItemsSource = await _api.GetTrucksAsync();
        }
        catch (Exception ex)
        {
            StatusLabel.Text =
                $"No se pudo contactar la API en {TruckNavigatorApi.BaseUrl}. {ex.Message}";
            StatusLabel.IsVisible = true;
        }
    }

    private async void OnRefreshing(object? sender, EventArgs e)
    {
        await LoadAsync();
        Refresher.IsRefreshing = false;
    }

    private async void OnTruckSelected(object? sender, EventArgs e)
    {
        if (sender is not Button { CommandParameter: TruckProfileDto truck })
        {
            return;
        }

        AppState.SelectedTruck = truck;
        await Shell.Current.GoToAsync(nameof(MapPage));
    }

    private async void OnNewTruck(object? sender, EventArgs e) =>
        await Shell.Current.GoToAsync(nameof(TruckEditPage));

    private async void OnConfigureServer(object? sender, EventArgs e)
    {
        var url = await DisplayPromptAsync(
            "Servidor",
            "URL base de la API. Dejalo como viene para usar el servidor de la app; " +
            $"escribí otro para apuntar a uno propio.\n\nDe fábrica: {TruckNavigatorApi.DefaultBaseUrl}",
            initialValue: TruckNavigatorApi.BaseUrl,
            keyboard: Keyboard.Url);

        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        TruckNavigatorApi.BaseUrl = url.Trim();
        await LoadAsync();
    }
}
