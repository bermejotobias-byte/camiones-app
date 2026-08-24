using Android.Content;
using TruckNavigator.Mobile.Services;

namespace TruckNavigator.Mobile.Platforms.Android;

/// <summary>
/// Arranca y para el servicio de navegacion, y traduce sus posiciones.
/// </summary>
/// <remarks>
/// Es la capa delgada entre el servicio de Android y el resto de la app: acá
/// viven los permisos y el manejo del Intent, para que la pagina que hospeda la
/// web no tenga que conocer ninguna de las dos cosas.
/// </remarks>
public sealed class AndroidTripTracker : ITripTracker
{
    public event EventHandler<TrackedPosition>? PositionChanged;

    public bool IsTracking => NavigationForegroundService.IsRunning;

    public async Task<bool> StartAsync(string? destination)
    {
        if (!await EnsureLocationPermissionAsync())
        {
            return false;
        }

        // El permiso de notificaciones se pide pero no se exige: si el usuario lo
        // niega, el servicio igual corre y la navegacion funciona — lo unico que
        // se pierde es ver el aviso en la barra. Cortar el viaje por eso seria
        // desproporcionado.
        await RequestNotificationPermissionAsync();

        NavigationForegroundService.PositionChanged -= OnServicePosition;
        NavigationForegroundService.PositionChanged += OnServicePosition;

        var context = global::Android.App.Application.Context;
        var intent = new Intent(context, typeof(NavigationForegroundService));
        intent.SetAction(NavigationForegroundService.ActionStart);
        intent.PutExtra(NavigationForegroundService.ExtraDestination, destination ?? string.Empty);

        // Desde Android 8 un servicio en primer plano tiene que arrancarse con
        // StartForegroundService; con StartService el sistema lo rechaza.
        if (OperatingSystem.IsAndroidVersionAtLeast(26))
        {
            context.StartForegroundService(intent);
        }
        else
        {
            context.StartService(intent);
        }

        return true;
    }

    public void Stop()
    {
        NavigationForegroundService.PositionChanged -= OnServicePosition;

        var context = global::Android.App.Application.Context;
        var intent = new Intent(context, typeof(NavigationForegroundService));
        intent.SetAction(NavigationForegroundService.ActionStop);

        try
        {
            context.StartService(intent);
        }
        catch (Java.Lang.IllegalStateException)
        {
            // Android puede rechazar arrancar un servicio con la app en segundo
            // plano. Si el servicio ya no estaba, no hay nada que parar.
        }
    }

    private void OnServicePosition(object? sender, global::Android.Locations.Location location) =>
        PositionChanged?.Invoke(this, new TrackedPosition(
            location.Latitude,
            location.Longitude,
            location.HasAccuracy ? location.Accuracy : null,
            location.HasSpeed ? location.Speed : null,
            location.HasBearing ? location.Bearing : null));

    private static async Task<bool> EnsureLocationPermissionAsync()
    {
        var status = await Permissions.CheckStatusAsync<Permissions.LocationWhenInUse>();

        if (status != PermissionStatus.Granted)
        {
            status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
        }

        return status == PermissionStatus.Granted;
    }

    private static async Task RequestNotificationPermissionAsync()
    {
        if (!OperatingSystem.IsAndroidVersionAtLeast(33))
        {
            return;
        }

        try
        {
            var status = await Permissions.CheckStatusAsync<Permissions.PostNotifications>();

            if (status != PermissionStatus.Granted)
            {
                await Permissions.RequestAsync<Permissions.PostNotifications>();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"No se pudo pedir el permiso de notificaciones: {ex.Message}");
        }
    }
}
