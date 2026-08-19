namespace TruckNavigator.Mobile.Services;

/// <summary>
/// Qué categorías de puntos de interés se muestran, entre sesiones.
/// </summary>
/// <remarks>
/// Usa <see cref="Preferences"/>, el mismo mecanismo con el que se recuerda la URL de
/// la API. No hace falta nada más pesado: son seis booleanos.
/// </remarks>
public static class PoiFilterState
{
    private const string CategoryPrefix = "poi_category_";
    private const string SuitableOnlyKey = "poi_suitable_only";

    /// <summary>
    /// Las categorías arrancan encendidas y el filtro por camión apagado.
    /// </summary>
    /// <remarks>
    /// Arrancar con el filtro por camión encendido dejaría el mapa casi vacío: hoy casi
    /// ninguna fuente declara aptitud, así que el filtro esconde de entrada la mayoría
    /// de los puntos. Parecería una pantalla rota en lugar de un filtro estricto.
    /// </remarks>
    public static bool IsEnabled(PoiCategory category) =>
        Preferences.Default.Get(CategoryPrefix + category, true);

    public static void SetEnabled(PoiCategory category, bool enabled) =>
        Preferences.Default.Set(CategoryPrefix + category, enabled);

    public static bool SuitableOnly
    {
        get => Preferences.Default.Get(SuitableOnlyKey, false);
        set => Preferences.Default.Set(SuitableOnlyKey, value);
    }

    public static IReadOnlyList<PoiCategory> EnabledCategories() =>
        PoiPresentation.All.Where(IsEnabled).ToList();
}
