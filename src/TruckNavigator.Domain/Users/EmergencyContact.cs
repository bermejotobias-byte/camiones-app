namespace TruckNavigator.Domain.Users;

/// <summary>
/// Alguien a quien el camionero quiere poder llamar de un toque si pasa algo.
/// </summary>
/// <remarks>
/// <para>
/// Son <b>hasta tres</b> y el limite es a proposito, no una restriccion tecnica:
/// esta pantalla se usa una vez cada mucho tiempo y en el peor momento posible.
/// Una lista larga obliga a leer y a elegir justo cuando nadie esta en
/// condiciones de hacerlo. Ver <see cref="MaxPerDriver"/>.
/// </para>
/// <para>
/// El telefono se guarda <b>tal como se cargo</b>. La app no lo normaliza: las
/// reglas argentinas —el 0 de larga distancia, el 15, el +54 9— son de verdad
/// pero no valen fuera del pais, y un numero reescrito mal es un numero que no
/// llama. Lo que se valida es que sea plausible, no que tenga una forma.
/// </para>
/// </remarks>
public sealed class EmergencyContact
{
    /// <summary>Tres, y el motivo esta en la documentacion del tipo.</summary>
    public const int MaxPerDriver = 3;

    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>La cuenta a la que pertenece. Sin dueno no existe.</summary>
    public Guid OwnerId { get; set; }

    /// <summary>Como lo ve el camionero. Es lo que va a leer apurado.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Tal como se cargo, sin reescribir.</summary>
    public string Phone { get; set; } = string.Empty;

    /// <summary>
    /// Para listarlos siempre en el mismo orden.
    /// </summary>
    /// <remarks>
    /// Que el orden no cambie entre una pantalla y la siguiente importa mas de lo
    /// que parece: se busca por posicion, no leyendo, y una lista que se reordena
    /// obliga a leer justo cuando no se puede.
    /// </remarks>
    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Reglas de lo que se puede guardar como contacto de emergencia.
/// </summary>
/// <remarks>
/// Viven en el dominio porque son de negocio y no de la base: la base puede
/// hacerlas cumplir con un largo maximo, pero no sabe por que.
/// </remarks>
public static class EmergencyContactRules
{
    public const int MaxNameLength = 80;

    public const int MaxPhoneLength = 40;

    /// <summary>
    /// Minimo de digitos para que un numero sea plausible.
    /// </summary>
    /// <remarks>
    /// Seis, y no ocho ni diez. Un contacto personal argentino tiene mas, pero un
    /// interno de empresa o un numero de otro pais puede tener menos, y
    /// <b>rechazar un numero valido es peor que aceptar uno raro</b>: el que se
    /// rechaza no queda guardado el dia que hace falta. Seis alcanza para
    /// descartar un error de tipeo sin discutirle al usuario cual es su telefono.
    /// </remarks>
    public const int MinPhoneDigits = 6;

    /// <summary>
    /// Maximo de digitos. Quince es el tope del formato internacional E.164.
    /// </summary>
    public const int MaxPhoneDigits = 15;

    /// <summary>Signos que aparecen en un telefono escrito por una persona.</summary>
    private static bool IsAllowedInPhone(char character) =>
        char.IsDigit(character) || character is ' ' or '-' or '(' or ')' or '+' or '.' or '/';

    /// <summary>
    /// Valida nombre y telefono. El error vuelve escrito para mostrarse tal cual.
    /// </summary>
    public static ContactValidation Validate(string? name, string? phone)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return ContactValidation.Invalid("Poné un nombre para reconocerlo.");
        }

        var cleanName = name.Trim();

        if (cleanName.Length > MaxNameLength)
        {
            return ContactValidation.Invalid(
                $"El nombre no puede pasar de {MaxNameLength} caracteres.");
        }

        if (string.IsNullOrWhiteSpace(phone))
        {
            return ContactValidation.Invalid("Falta el número de teléfono.");
        }

        var cleanPhone = phone.Trim();

        if (cleanPhone.Length > MaxPhoneLength)
        {
            return ContactValidation.Invalid("Ese número es demasiado largo.");
        }

        foreach (var character in cleanPhone)
        {
            if (!IsAllowedInPhone(character))
            {
                return ContactValidation.Invalid(
                    "El teléfono solo admite números y los signos + - ( ) . /");
            }
        }

        var digits = cleanPhone.Count(char.IsDigit);

        if (digits < MinPhoneDigits)
        {
            return ContactValidation.Invalid("Ese número parece incompleto.");
        }

        if (digits > MaxPhoneDigits)
        {
            return ContactValidation.Invalid("Ese número tiene demasiados dígitos.");
        }

        return ContactValidation.Valid(cleanName, cleanPhone);
    }
}

/// <summary>
/// Resultado de validar un contacto, con los valores ya recortados.
/// </summary>
public sealed record ContactValidation(bool IsValid, string? Error, string? Name, string? Phone)
{
    public static ContactValidation Valid(string name, string phone) =>
        new(true, null, name, phone);

    public static ContactValidation Invalid(string error) => new(false, error, null, null);
}
