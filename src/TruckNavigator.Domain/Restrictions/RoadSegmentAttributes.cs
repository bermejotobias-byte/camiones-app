namespace TruckNavigator.Domain.Restrictions;

/// <summary>
/// Acceso de vehiculos pesados declarado sobre la via.
/// Refleja los valores del encoded value <c>hgv</c> de GraphHopper, que a su vez
/// derivan de la clave <c>hgv</c> de OpenStreetMap.
/// </summary>
public enum HgvAccess
{
    /// <summary>La via no declara nada sobre camiones.</summary>
    Missing = 0,

    Yes = 1,

    /// <summary>
    /// Via designada para transito pesado. En CABA es la marca que la comunidad
    /// de OSM usa para la Red de Transito Pesado.
    /// </summary>
    Designated = 2,

    /// <summary>Solo se admite el ingreso si el destino esta sobre la via.</summary>
    Destination = 3,

    /// <summary>Solo se admite el ingreso para operaciones de reparto.</summary>
    Delivery = 4,

    /// <summary>Circulacion de camiones prohibida.</summary>
    No = 5
}

/// <summary>
/// Atributos de un tramo de via relevantes para decidir si un camion puede
/// circular por el. Se completa a partir de los <c>path_details</c> que devuelve
/// GraphHopper, de modo que lo que se evalua es exactamente lo que el motor de
/// ruteo uso para calcular.
/// </summary>
/// <param name="MaxWeightTons">Limite de peso de la via, en toneladas. <c>null</c> si no hay limite declarado.</param>
/// <param name="MaxHeightMeters">Galibo de la via, en metros. <c>null</c> si no hay limite declarado.</param>
/// <param name="MaxWidthMeters">Ancho maximo de la via, en metros. <c>null</c> si no hay limite declarado.</param>
/// <param name="MaxLengthMeters">Longitud maxima admitida, en metros. <c>null</c> si no hay limite declarado.</param>
/// <param name="MaxWeightExcept">
/// Excepcion declarada al limite de peso, tal como la codifica GraphHopper en
/// <c>max_weight_except</c> ("delivery", "destination", "forestry"). <c>null</c> o
/// "missing" cuando no hay excepcion. El motor deja pasar el tramo cuando hay
/// una, asi que el evaluador tiene que leerla para decir lo mismo.
/// </param>
public readonly record struct RoadSegmentAttributes(
    string? StreetName = null,
    string? RoadClass = null,
    double? MaxWeightTons = null,
    double? MaxHeightMeters = null,
    double? MaxWidthMeters = null,
    double? MaxLengthMeters = null,
    HgvAccess Hgv = HgvAccess.Missing,
    string? MaxWeightExcept = null)
{
    /// <summary>Si la via declara una excepcion al limite de peso.</summary>
    public bool HasWeightException =>
        !string.IsNullOrWhiteSpace(MaxWeightExcept) &&
        !string.Equals(MaxWeightExcept, "missing", StringComparison.OrdinalIgnoreCase);

    /// <summary>Nombre legible del tramo, para mensajes al usuario.</summary>
    public string DisplayName =>
        string.IsNullOrWhiteSpace(StreetName) ? "tramo sin nombre" : StreetName!;
}
