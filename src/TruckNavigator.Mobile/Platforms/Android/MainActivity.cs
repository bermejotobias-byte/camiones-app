using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.OS;

namespace TruckNavigator.Mobile;

[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTop, ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    /// <summary>
    /// Resultado de una pantalla del sistema que la app abrio y espera.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Hace falta porque abrir el selector de contactos es un viaje de ida y
    /// vuelta por AFUERA de la aplicacion: se lanza un Intent, Android dibuja su
    /// propia pantalla, y la respuesta vuelve por aca y no por donde se pidio.
    /// La pagina que lo pidio no puede sobrescribir <c>OnActivityResult</c>
    /// —no es una Activity—, asi que se suscribe a esto.
    /// </para>
    /// <para>
    /// Es estatico porque la Activity la crea Android y no hay lugar donde
    /// inyectarle nada. <b>Quien se suscribe tiene que desuscribirse</b>: la
    /// Activity vive mas que la pagina, y un manejador olvidado la mantiene viva
    /// con ella.
    /// </para>
    /// </remarks>
    public static event Action<int, Result, Intent?>? ActivityResult;

    protected override void OnActivityResult(int requestCode, Result resultCode, Intent? data)
    {
        base.OnActivityResult(requestCode, resultCode, data);

        ActivityResult?.Invoke(requestCode, resultCode, data);
    }
}
