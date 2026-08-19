namespace TruckNavigator.Domain.Restrictions;

/// <summary>
/// Constantes y citas de la normativa de transito pesado de CABA.
/// </summary>
/// <remarks>
/// Todo numero o regla de este archivo tiene que poder rastrearse a una norma
/// publicada. No agregar reglas aca sin la cita correspondiente: si la normativa
/// no se puede modelar con seguridad, se documenta la limitacion en
/// docs/restrictions.md en lugar de inventar una regla.
/// </remarks>
public static class CabaHeavyTrafficRules
{
    /// <summary>
    /// Peso total bruto a partir del cual es obligatorio circular por la Red de
    /// Transito Pesado. Fuente: Ley 2148, art. 9.10.1 (mod. Ley 6.401/2020).
    /// </summary>
    public const int HeavyNetworkWeightThresholdKg = 12_000;

    /// <summary>
    /// Cita de la norma que obliga a circular por la Red y habilita la excepcion
    /// de acceso a destino.
    /// </summary>
    public const string HeavyNetworkLegalReference =
        "Ley 2148 (Codigo de Transito y Transporte CABA), arts. 9.10.1 y 9.10.5, " +
        "modificados por Ley 6.401/2020";

    /// <summary>
    /// Texto que se le muestra al usuario cuando la ruta sale de la Red.
    /// Refleja la excepcion normativa: se puede salir de la Red unicamente para
    /// llegar al destino y volver, por el camino mas corto.
    /// </summary>
    public const string AccessExceptionExplanation =
        "Fuera de la Red de Transito Pesado. La normativa admite circular por " +
        "estos tramos solo para llegar al destino y regresar, por el recorrido " +
        "mas corto desde o hacia la Red.";

    /// <summary>
    /// Como se identifica hoy la pertenencia a la Red. Es dato de OSM, no la
    /// capa oficial del GCBA: ver la limitacion registrada en docs/data-sources.md.
    /// </summary>
    public const string HeavyNetworkDataReference =
        "OpenStreetMap, etiqueta hgv=designated (transcripcion comunitaria de la " +
        "Red de Transito Pesado)";
}
