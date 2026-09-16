using TruckNavigator.Domain.Restrictions;

namespace TruckNavigator.Domain.Routing;

/// <summary>
/// Que rutas se pueden ofrecer al conductor.
/// </summary>
/// <remarks>
/// <para>
/// El custom model excluye del calculo los tramos por los que el camion no
/// puede pasar, asi que una ruta con un tramo prohibido no deberia existir. Si
/// aparece —por una divergencia entre lo que sabe el motor y lo que dice el
/// evaluador, o entre dos versiones del mapa— <b>no se ofrece</b>: ni como
/// recomendada ni como alternativa. Ofrecerla y avisar despues "por aca no
/// pasas" es exactamente lo que el producto promete que nunca pasa.
/// </para>
/// <para>
/// Salir de la Red de Transito Pesado para llegar al destino no es un tramo
/// prohibido: la norma lo admite, y esas rutas se ofrecen con su nota.
/// </para>
/// </remarks>
public static class RouteOffer
{
    /// <summary>Una ruta es ofrecible si ninguno de sus tramos esta prohibido para el camion.</summary>
    public static bool IsOfferable(TruckRoute route) =>
        route.RestrictionNotes.All(note => note.RequiresAccessException);

    /// <summary>
    /// La recomendada y las alternativas ofrecibles, en el mismo orden;
    /// <c>null</c> si no hay rutas o la recomendada no se puede ofrecer.
    /// </summary>
    public static IReadOnlyList<TruckRoute>? Offerable(IReadOnlyList<TruckRoute> routes)
    {
        if (routes.Count == 0 || !IsOfferable(routes[0]))
        {
            return null;
        }

        return routes.Where(IsOfferable).ToList();
    }

    /// <summary>
    /// La ruta por la que arranca el viaje: la que el usuario eligio entre las
    /// ofrecidas, por su posicion en esa lista. Sin eleccion, o con una posicion
    /// que ya no existe, la recomendada.
    /// </summary>
    /// <remarks>
    /// Una posicion fuera de rango no cae en la ultima ni en la mas parecida:
    /// significa que la lista cambio entre que se mostro y que se arranco, y
    /// ante la duda la unica ruta que el usuario vio seguro es la recomendada.
    /// </remarks>
    public static TruckRoute Chosen(IReadOnlyList<TruckRoute> offerable, int? index)
    {
        if (offerable.Count == 0)
        {
            throw new ArgumentException("No hay rutas ofrecibles entre las que elegir.", nameof(offerable));
        }

        return index is >= 0 && index < offerable.Count ? offerable[index.Value] : offerable[0];
    }

    /// <summary>El primer hallazgo que prohibe la ruta, para explicarselo al usuario; <c>null</c> si es ofrecible.</summary>
    public static RestrictionFinding? WhyNot(TruckRoute route) =>
        route.RestrictionNotes
            .Where(note => !note.RequiresAccessException)
            .SelectMany(note => note.Findings)
            .FirstOrDefault(finding => finding.Kind != RestrictionKind.OutsideHeavyTrafficNetwork);
}
