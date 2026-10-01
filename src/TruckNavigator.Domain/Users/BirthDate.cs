namespace TruckNavigator.Domain.Users;

/// <summary>
/// Reglas de la fecha de nacimiento del camionero.
/// </summary>
/// <remarks>
/// <para>
/// Es dato del carnet y es <b>sensible</b>: se guarda, pero solo la ve el dueño.
/// Esa restriccion vive en el contrato de la API, que decide que se publica; aca
/// va solo la plausibilidad.
/// </para>
/// <para>
/// <b>No hay minimo de edad, a proposito.</b> La app no verifica licencias, y
/// ponerle un piso seria inventar una norma que no le toca aplicar. Lo que si se
/// rechaza es lo imposible: una fecha del futuro, o una edad de mas de 120 años,
/// que es casi seguro un dedo que se fue en el año.
/// </para>
/// </remarks>
public static class BirthDate
{
    public const int MaxAge = 120;

    public static BirthDateValidation Validate(DateOnly? date, DateOnly today)
    {
        if (date is not { } birth)
        {
            return BirthDateValidation.Valid();
        }

        if (birth > today)
        {
            return BirthDateValidation.Invalid("La fecha de nacimiento no puede ser del futuro.");
        }

        if (AgeOn(birth, today) > MaxAge)
        {
            return BirthDateValidation.Invalid("Revisa el año: esa fecha da una edad imposible.");
        }

        return BirthDateValidation.Valid();
    }

    /// <summary>
    /// Edad cumplida. Se resta un año si el cumpleaños de este año todavia no llego.
    /// </summary>
    public static int AgeOn(DateOnly birth, DateOnly today)
    {
        var age = today.Year - birth.Year;

        if (today < birth.AddYears(age))
        {
            age--;
        }

        return age;
    }
}

public sealed record BirthDateValidation(bool IsValid, string? Error)
{
    public static BirthDateValidation Valid() => new(true, null);

    public static BirthDateValidation Invalid(string error) => new(false, error);
}
