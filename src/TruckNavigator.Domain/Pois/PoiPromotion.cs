namespace TruckNavigator.Domain.Pois;

/// <summary>
/// Con cinco votos de un mismo tipo de camion, el lugar aportado se incorpora
/// a la base.
/// </summary>
/// <remarks>
/// <para>
/// Decision del usuario del 19/09/2026, la misma que vuelve fija una camara muy
/// confirmada: "este mismo sistema se implementa en marcar lugares nuevos de
/// interes comun". El lugar pasa a <see cref="VerificationLevel.Probable"/> con
/// evidencia <see cref="SuitabilityEvidenceKind.Community"/>, y el campo de
/// aptitud del tipo que voto queda escrito: apto si ganaron los aptos, no apto
/// si ganaron los otros. Los otros tres campos siguen sin dato.
/// </para>
/// <para>
/// <b>Los lugares del dataset no se tocan</b>: AD-46 sigue valiendo para lo
/// verificado —los votos nunca lo modifican— y se enmienda solo para lo
/// aportado. Y <c>Confirmed</c> sigue siendo exclusivo de una fuente: un lugar
/// aportado llega a Probable, no mas.
/// </para>
/// </remarks>
public static class PoiPromotion
{
    /// <summary>Votos de un mismo lado y tipo que escriben el dato. "+5 es un principio".</summary>
    public const int Threshold = 5;

    private static readonly TimeSpan LocalOffset = TimeSpan.FromHours(-3);

    /// <summary>
    /// Aplica la graduacion si corresponde. Devuelve si cambio algo: quien llama
    /// guarda solo en ese caso.
    /// </summary>
    public static bool Apply(
        PointOfInterest poi,
        PoiSuitabilityField field,
        int suitable,
        int notSuitable,
        DateTimeOffset when)
    {
        ArgumentNullException.ThrowIfNull(poi);

        if (poi.ManagedByDataset)
        {
            return false;
        }

        bool verdict;

        if (suitable >= Threshold && suitable > notSuitable)
        {
            verdict = true;
        }
        else if (notSuitable >= Threshold && notSuitable > suitable)
        {
            verdict = false;
        }
        else
        {
            return false;
        }

        if (Current(poi, field) == verdict)
        {
            return false;
        }

        Set(poi, field, verdict);

        var votes = verdict ? suitable : notSuitable;
        var local = when.ToOffset(LocalOffset);

        poi.SuitabilityEvidenceKind = SuitabilityEvidenceKind.Community;
        poi.SuitabilityEvidence =
            $"Confirmado {(verdict ? "apto" : "no apto")} para {Name(field)} por {votes} camioneros de la comunidad ({local:dd/MM/yyyy})";

        // Probable, nunca Confirmed: eso es de una fuente. Y si por algun motivo
        // ya estuviera mas arriba, no se lo baja.
        if (poi.VerificationLevel < VerificationLevel.Probable)
        {
            poi.VerificationLevel = VerificationLevel.Probable;
        }

        return true;
    }

    private static bool? Current(PointOfInterest poi, PoiSuitabilityField field) => field switch
    {
        PoiSuitabilityField.SemiTrailer => poi.SuitableForSemiTrailer,
        PoiSuitabilityField.Trailer => poi.SuitableForTrailer,
        PoiSuitabilityField.HeavyTruck => poi.SuitableForHeavyTruck,
        _ => poi.SuitableForLightTruck
    };

    private static void Set(PointOfInterest poi, PoiSuitabilityField field, bool value)
    {
        switch (field)
        {
            case PoiSuitabilityField.SemiTrailer:
                poi.SuitableForSemiTrailer = value;
                break;
            case PoiSuitabilityField.Trailer:
                poi.SuitableForTrailer = value;
                break;
            case PoiSuitabilityField.HeavyTruck:
                poi.SuitableForHeavyTruck = value;
                break;
            default:
                poi.SuitableForLightTruck = value;
                break;
        }
    }

    private static string Name(PoiSuitabilityField field) => field switch
    {
        PoiSuitabilityField.SemiTrailer => "semirremolque",
        PoiSuitabilityField.Trailer => "camion con acoplado",
        PoiSuitabilityField.HeavyTruck => "camion pesado",
        _ => "camion liviano"
    };
}
