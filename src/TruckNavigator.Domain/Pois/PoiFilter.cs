namespace TruckNavigator.Domain.Pois;

/// <summary>
/// Que deja pasar el filtro "solo aptos para mi camion".
/// </summary>
/// <remarks>
/// <para>
/// Vive en el dominio por lo mismo que <see cref="PoiSuitability"/>: la regla se
/// escribe una vez y la usan la API y la ficha.
/// </para>
/// <para>
/// Decision del usuario del 15/09/2026: pasa lo verificado apto <b>o</b> lo
/// recomendado por la comunidad para el tipo de camion del que consulta. La
/// comunidad <b>completa</b> lo que la fuente no dice, no la contradice: un
/// "no apto" verificado sigue afuera aunque lo recomienden. Quien muestra el
/// resultado tiene que marcar distinto cada origen; por eso el DTO los trae por
/// separado.
/// </para>
/// </remarks>
public static class PoiFilter
{
    public static bool PassesSuitableOnly(bool? verified, CommunitySeal? sealForTruck) => verified switch
    {
        true => true,
        false => false,
        null => sealForTruck == CommunitySeal.Recommended
    };
}
