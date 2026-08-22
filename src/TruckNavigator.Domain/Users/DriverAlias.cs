namespace TruckNavigator.Domain.Users;

/// <summary>
/// Reglas del alias publico del camionero.
/// </summary>
/// <remarks>
/// <para>
/// El alias es el nombre con el que el usuario aparece en la comunidad y en el
/// chat, y la norma del proyecto es que sea <b>unico e irrepetible</b>.
/// </para>
/// <para>
/// La unicidad se resuelve sobre la forma normalizada y no sobre lo que el usuario
/// escribe: "ElGaucho" y "elgaucho" son el mismo alias. Sin esa normalizacion dos
/// cuentas podrian verse casi identicas en el chat, que es justamente el terreno
/// donde la suplantacion hace dano.
/// </para>
/// <para>
/// Vive en el dominio y no en la capa de datos porque es una regla de negocio: el
/// indice unico de la base la hace cumplir, pero no la define.
/// </para>
/// </remarks>
public static class DriverAlias
{
    public const int MinLength = 3;

    public const int MaxLength = 20;

    /// <summary>
    /// Forma canonica usada para comparar. No es lo que se muestra: el usuario ve
    /// el alias tal como lo escribio.
    /// </summary>
    public static string Normalize(string alias) =>
        (alias ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>
    /// Valida el formato. Devuelve el motivo del rechazo en un mensaje pensado para
    /// mostrarse tal cual al usuario, no para un log.
    /// </summary>
    public static AliasValidation Validate(string? alias)
    {
        if (string.IsNullOrWhiteSpace(alias))
        {
            return AliasValidation.Invalid("Elegi un alias.");
        }

        var trimmed = alias.Trim();

        if (trimmed.Length < MinLength)
        {
            return AliasValidation.Invalid($"El alias necesita al menos {MinLength} caracteres.");
        }

        if (trimmed.Length > MaxLength)
        {
            return AliasValidation.Invalid($"El alias no puede pasar de {MaxLength} caracteres.");
        }

        if (!char.IsAsciiLetter(trimmed[0]))
        {
            return AliasValidation.Invalid("El alias tiene que empezar con una letra.");
        }

        foreach (var character in trimmed)
        {
            if (!IsAllowed(character))
            {
                return AliasValidation.Invalid(
                    "El alias solo admite letras, numeros, punto y guion bajo.");
            }
        }

        // Un alias terminado en separador se lee como incompleto y ademas se
        // confunde con el de al lado cuando se lista en el chat.
        if (trimmed[^1] is '.' or '_')
        {
            return AliasValidation.Invalid("El alias no puede terminar en punto ni en guion bajo.");
        }

        return AliasValidation.Valid(trimmed);
    }

    private static bool IsAllowed(char character) =>
        char.IsAsciiLetterOrDigit(character) || character is '.' or '_';
}

/// <summary>
/// Resultado de validar un alias. <see cref="Value"/> trae el alias ya recortado
/// cuando es valido, para que el llamador no tenga que volver a limpiarlo.
/// </summary>
public sealed record AliasValidation(bool IsValid, string? Error, string? Value)
{
    public static AliasValidation Valid(string value) => new(true, null, value);

    public static AliasValidation Invalid(string error) => new(false, error, null);
}
