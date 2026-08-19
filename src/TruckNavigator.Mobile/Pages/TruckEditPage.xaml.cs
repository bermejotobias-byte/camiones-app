using System.Globalization;
using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile.Pages;

public partial class TruckEditPage : ContentPage
{
    private static readonly string[] VehicleTypes =
        ["RigidTruck", "TruckWithTrailer", "SemiTrailer"];

    private readonly TruckNavigatorApi _api;

    public TruckEditPage(TruckNavigatorApi api)
    {
        InitializeComponent();
        _api = api;
        VehicleTypePicker.SelectedIndex = 0;
    }

    private void OnTrailerToggled(object? sender, ToggledEventArgs e) =>
        TrailerPanel.IsVisible = e.Value;

    private async void OnSave(object? sender, EventArgs e)
    {
        ErrorLabel.IsVisible = false;

        if (!TryBuildRequest(out var request, out var error))
        {
            ErrorLabel.Text = error;
            ErrorLabel.IsVisible = true;
            return;
        }

        SaveButton.IsEnabled = false;

        try
        {
            await _api.CreateTruckAsync(request!);
            await Shell.Current.GoToAsync("..");
        }
        catch (Exception ex)
        {
            ErrorLabel.Text = ex.Message;
            ErrorLabel.IsVisible = true;
        }
        finally
        {
            SaveButton.IsEnabled = true;
        }
    }

    private bool TryBuildRequest(out SaveTruckProfileRequest? request, out string error)
    {
        request = null;
        error = string.Empty;

        if (string.IsNullOrWhiteSpace(NameEntry.Text))
        {
            error = "Ingresá un nombre para el camión.";
            return false;
        }

        if (!TryParseInt(WeightEntry.Text, out var weight))
        {
            error = "El peso total bruto tiene que ser un número entero en kilogramos.";
            return false;
        }

        if (!TryParseDouble(HeightEntry.Text, out var height) ||
            !TryParseDouble(WidthEntry.Text, out var width) ||
            !TryParseDouble(LengthEntry.Text, out var length))
        {
            error = "Revisá altura, ancho y longitud: tienen que ser números en metros.";
            return false;
        }

        if (!TryParseInt(AxlesEntry.Text, out var axles))
        {
            error = "La cantidad de ejes tiene que ser un número entero.";
            return false;
        }

        double? trailerLength = null;

        if (TrailerSwitch.IsToggled)
        {
            if (!TryParseDouble(TrailerLengthEntry.Text, out var parsed))
            {
                error = "Indicá la longitud del acoplado en metros.";
                return false;
            }

            trailerLength = parsed;
        }

        request = new SaveTruckProfileRequest
        {
            Name = NameEntry.Text.Trim(),
            GrossWeightKg = weight,
            HeightMeters = height,
            WidthMeters = width,
            LengthMeters = length,
            NumberOfAxles = axles,
            VehicleType = VehicleTypes[Math.Max(VehicleTypePicker.SelectedIndex, 0)],
            HasTrailer = TrailerSwitch.IsToggled,
            TrailerLengthMeters = trailerLength
        };

        return true;
    }

    /// <summary>
    /// Acepta coma o punto decimal: el teclado numerico de Android en es-AR
    /// ofrece coma, y forzar el punto seria una molestia gratuita.
    /// </summary>
    private static bool TryParseDouble(string? text, out double value)
    {
        value = 0;

        return !string.IsNullOrWhiteSpace(text)
               && double.TryParse(
                   text.Replace(',', '.'),
                   NumberStyles.Float,
                   CultureInfo.InvariantCulture,
                   out value)
               && value > 0;
    }

    private static bool TryParseInt(string? text, out int value) =>
        int.TryParse(text?.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value)
        && value > 0;
}
