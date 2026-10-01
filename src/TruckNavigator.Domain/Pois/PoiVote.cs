namespace TruckNavigator.Domain.Pois;

/// <summary>Lo que un camionero dice de un lugar.</summary>
public enum PoiVerdict
{
    Suitable = 0,
    NotSuitable = 1
}

/// <summary>
/// El voto de un camionero sobre un lugar: apto o no, y con que tipo de camion.
/// </summary>
/// <remarks>
/// <para>
/// Un voto por camionero y lugar —la clave compuesta lo garantiza—: cambiar de
/// opinion reescribe la fila, no agrega otra. Se guarda el <b>tipo</b> de camion
/// y no su id, para que borrar el camion no borre el voto y para que el voto siga
/// diciendo con que clase de vehiculo se emitio. Decision del usuario del
/// 15/09/2026: la ficha muestra los votos de camiones como el tuyo.
/// </para>
/// <para>
/// El voto no lleva EXP encima: lo que pago queda en el libro de progresion, con
/// el lugar como clave. Por eso retirarlo no devuelve nada y volver a votar el
/// mismo lugar no vuelve a cobrar.
/// </para>
/// </remarks>
public sealed class PoiVote
{
    public Guid PoiId { get; set; }

    public Guid DriverId { get; set; }

    /// <summary>Con que tipo de camion voto: sale de <see cref="PoiSuitability.FieldFor"/>.</summary>
    public PoiSuitabilityField TruckClass { get; set; }

    public PoiVerdict Verdict { get; set; }

    /// <summary>La primera vez que voto este lugar.</summary>
    public DateTimeOffset CastAt { get; set; }

    /// <summary>La ultima vez que cambio el voto.</summary>
    public DateTimeOffset UpdatedAt { get; set; }
}
