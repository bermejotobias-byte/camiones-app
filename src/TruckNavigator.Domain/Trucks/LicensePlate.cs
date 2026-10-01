using System.Text.RegularExpressions;

namespace TruckNavigator.Domain.Trucks;

/// <summary>
/// Reglas de la patente del camion.
/// </summary>
/// <remarks>
/// <para>
/// Es dato de un vehiculo real, asi que se valida contra los formatos que existen
/// en la Argentina y no contra "algo que parezca una patente": el viejo de tres
/// letras y tres numeros (<c>AAA123</c>, 1995–2016) y el Mercosur de dos letras,
/// tres numeros y dos letras (<c>AA123BB</c>, desde 2016). Los dos circulan hoy.
/// </para>
/// <para>
/// <b>Se guarda sin espacios ni guiones y en mayusculas</b>, para comparar; se
/// muestra como esta estampada en la chapa (<c>AB 123 CD</c>), que es la forma que
/// la gente reconoce. <see cref="Display"/> hace esa traduccion.
/// </para>
/// <para>
/// <b>Vacia es valida</b> y significa "sin patente": el campo es opcional. Exigirla
/// obligaria a inventar una para poder guardar el camion, que es peor que no tenerla.
/// </para>
/// </remarks>
public static partial class LicensePlate
{
    [GeneratedRegex("^[A-Z]{3}[0-9]{3}$")]
    private static partial Regex OldFormat();

    [GeneratedRegex("^[A-Z]{2}[0-9]{3}[A-Z]{2}$")]
    private static partial Regex MercosurFormat();

    public static PlateValidation Validate(string? plate)
    {
        if (string.IsNullOrWhiteSpace(plate))
        {
            return PlateValidation.None();
        }

        var normalized = Normalize(plate);

        if (OldFormat().IsMatch(normalized) || MercosurFormat().IsMatch(normalized))
        {
            return PlateValidation.Valid(normalized);
        }

        return PlateValidation.Invalid(
            "La patente tiene que ser como AAA 123 o como AB 123 CD.");
    }

    /// <summary>
    /// Forma canonica: mayusculas, sin espacios ni guiones. Solo letras ASCII: una
    /// chapa no lleva acentos, y una Á que pase como A haria que dos patentes
    /// distintas se comparen iguales.
    /// </summary>
    public static string Normalize(string plate) =>
        new([.. plate.ToUpperInvariant().Where(c => c is not (' ' or '-'))]);

    /// <summary>Como esta estampada en la chapa.</summary>
    public static string Display(string stored) => stored.Length switch
    {
        6 => $"{stored[..3]} {stored[3..]}",
        7 => $"{stored[..2]} {stored[2..5]} {stored[5..]}",
        _ => stored
    };
}

/// <summary>
/// Resultado de validar una patente. <see cref="Value"/> es la forma canonica
/// cuando hay patente, y <c>null</c> cuando es valida pero vacia.
/// </summary>
public sealed record PlateValidation(bool IsValid, string? Error, string? Value)
{
    public static PlateValidation Valid(string value) => new(true, null, value);

    public static PlateValidation None() => new(true, null, null);

    public static PlateValidation Invalid(string error) => new(false, error, null);
}
