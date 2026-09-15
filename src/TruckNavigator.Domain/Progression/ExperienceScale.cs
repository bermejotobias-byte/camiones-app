namespace TruckNavigator.Domain.Progression;

/// <summary>
/// Cuanta experiencia vale cada cosa.
/// </summary>
/// <remarks>
/// <para>
/// <b>La EXP mide esfuerzo, no cantidad.</b> Decision del usuario del 10/09/2026.
/// Antes era fija: un viaje de 300 km y uno de 20 km pagaban los dos 20, y el
/// escalon —que cuesta semanas— pagaba 50, o sea dos viajes y medio.
/// </para>
/// <para>
/// No compite con el nivel aunque los dos miren la distancia. El nivel se calcula
/// del <b>total acumulado</b> y no se puede perder ni comprar; la EXP se paga
/// <b>por viaje</b> y es el contador de actividad. Uno dice hasta donde llegaste,
/// el otro cuanto hiciste — y por eso el escalon paga mas que cualquier viaje.
/// </para>
/// <para>
/// Vive en el dominio y no en el registrador porque es una regla, no una forma de
/// guardar: se prueba sin base, y el dia que existan los bonos, la segunda moneda
/// se agrega al lado sin tocar la persistencia.
/// </para>
/// </remarks>
public static class ExperienceScale
{
    /// <summary>Lo que paga cualquier viaje cerrado, por corto que sea.</summary>
    /// <remarks>
    /// El piso existe para que un reparto de cuatro cuadras no de casi cero. Sigue
    /// siendo un viaje que alguien manejo.
    /// </remarks>
    public const int TripBase = 10;

    /// <summary>Cada cuantos metros se paga uno mas.</summary>
    public const int MetersPerExtraPoint = 10_000;

    /// <summary>
    /// EXP por completar un escalon.
    /// </summary>
    /// <remarks>
    /// Tiene que ganarle al viaje mas largo que se pueda hacer para llegar a el; si
    /// no, el escalon se sentiria menos que el camino hacia el escalon. Hay un test
    /// que lo fija contra el viaje de 300 km.
    /// </remarks>
    public const int PerTier = 100;

    /// <summary>
    /// EXP por agregar un lugar: como un viaje corto, porque hay que cargar nombre,
    /// categoria, ubicacion y camion. Se paga una vez por lugar creado.
    /// </summary>
    public const int PlaceAdded = 10;

    /// <summary>
    /// EXP por votar un lugar, una sola vez por lugar: cambiar el voto no vuelve a
    /// pagar y retirarlo no devuelve.
    /// </summary>
    /// <remarks>
    /// <b>Sin tope diario</b>, por decision del usuario del 15/09/2026: "hoy por
    /// hoy, al arrancar, sirve la interaccion de los usuarios por mas que sea sin
    /// filtro". Se revisa cuando haya datos de como se usa.
    /// </remarks>
    public const int PlaceVote = 2;

    /// <summary>EXP que paga un viaje cerrado.</summary>
    public static int ForTrip(double creditedMeters)
    {
        // Una distancia sin sentido —negativa, o NaN por una division que salio mal—
        // no puede restar: el libro no tiene forma de devolver, y una entrada
        // negativa quedaria para siempre. Se cobra el piso y listo.
        if (!double.IsFinite(creditedMeters) || creditedMeters <= 0)
        {
            return TripBase;
        }

        // Se trunca, no se redondea: 19 km pagan lo mismo que 10. Hacia arriba, un
        // viaje de 5 km cobraria el tramo de 10 que no hizo.
        return TripBase + (int)(creditedMeters / MetersPerExtraPoint);
    }
}
