namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Estado compartido entre pantallas. Es deliberadamente minimo: el MVP solo
/// necesita recordar que camion eligio el usuario mientras navega.
/// </summary>
public static class AppState
{
    public static TruckProfileDto? SelectedTruck { get; set; }
}
