using TruckNavigator.Domain.Users;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La fecha de nacimiento del camionero.
/// </summary>
/// <remarks>
/// <para>
/// Es dato del carnet (decision del 11/09/2026) y es <b>sensible</b>: se guarda,
/// pero solo la ve el dueño. Eso lo resuelve el contrato de la API, no esta clase.
/// </para>
/// <para>
/// Aca va solo la <b>plausibilidad</b>: que no sea del futuro y que no implique
/// una edad imposible. No hay minimo de edad, a proposito: la app no verifica
/// licencias, y ponerle un piso seria inventar una norma que no le toca aplicar.
/// </para>
/// </remarks>
public class BirthDateTests
{
    private static readonly DateOnly Today = new(2026, 9, 11);

    [Theory]
    [InlineData(1990, 5, 20)]
    [InlineData(2008, 9, 11)]     // 18 justos, hoy
    [InlineData(1930, 1, 1)]      // 96 años
    public void A_plausible_date_is_accepted(int year, int month, int day)
    {
        var result = BirthDate.Validate(new DateOnly(year, month, day), Today);

        Assert.True(result.IsValid, result.Error);
    }

    [Fact]
    public void A_date_in_the_future_is_rejected()
    {
        var result = BirthDate.Validate(Today.AddDays(1), Today);

        Assert.False(result.IsValid);
        Assert.Contains("futuro", result.Error, StringComparison.OrdinalIgnoreCase);
    }

    /// <remarks>
    /// 120 años es el tope: nadie que maneje un camion los tiene, y una fecha de
    /// 1800 es casi seguro un dedo que se fue en el año.
    /// </remarks>
    [Fact]
    public void An_impossible_age_is_rejected()
    {
        var result = BirthDate.Validate(Today.AddYears(-121), Today);

        Assert.False(result.IsValid);
    }

    /// <remarks>
    /// Sin fecha es valido: el campo es opcional y el carnet lo omite.
    /// </remarks>
    [Fact]
    public void No_date_is_valid_and_means_not_declared()
    {
        Assert.True(BirthDate.Validate(null, Today).IsValid);
    }

    /// <remarks>
    /// La edad se calcula bien alrededor del cumpleaños: el dia anterior todavia
    /// no cumpliste.
    /// </remarks>
    [Theory]
    [InlineData(2000, 9, 11, 26)]   // cumple hoy
    [InlineData(2000, 9, 12, 25)]   // cumple mañana
    [InlineData(2000, 9, 10, 26)]   // cumplio ayer
    public void Age_turns_on_the_birthday_not_before(int year, int month, int day, int expected)
    {
        Assert.Equal(expected, BirthDate.AgeOn(new DateOnly(year, month, day), Today));
    }
}
