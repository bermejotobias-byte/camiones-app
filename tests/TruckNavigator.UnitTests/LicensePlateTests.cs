using TruckNavigator.Domain.Trucks;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La patente del camion.
/// </summary>
/// <remarks>
/// <para>
/// Decision del usuario del 11/09/2026: el dorso del carnet identifica al camion
/// por <b>patente y nombre</b>. La patente es dato real de un vehiculo real, asi
/// que se valida contra los formatos que existen y no contra "algo que parezca una
/// patente".
/// </para>
/// <para>
/// Dos formatos vigentes en la Argentina: el viejo de tres letras y tres numeros
/// (<c>AAA123</c>, 1995–2016) y el Mercosur de dos letras, tres numeros y dos letras
/// (<c>AA123BB</c>, desde 2016). Los dos siguen circulando.
/// </para>
/// </remarks>
public class LicensePlateTests
{
    [Theory]
    [InlineData("AAA123", "AAA123")]
    [InlineData("AB123CD", "AB123CD")]
    [InlineData("aaa123", "AAA123")]          // se normaliza a mayusculas
    [InlineData("ab 123 cd", "AB123CD")]      // los espacios de la chapa no cuentan
    [InlineData("AB-123-CD", "AB123CD")]      // ni los guiones
    [InlineData("  AAA123  ", "AAA123")]
    public void Valid_plates_are_accepted_and_normalized(string input, string expected)
    {
        var result = LicensePlate.Validate(input);

        Assert.True(result.IsValid, result.Error);
        Assert.Equal(expected, result.Value);
    }

    /// <remarks>
    /// Una patente vacia es valida: el campo es opcional. El carnet dice "sin
    /// patente" y listo. Rechazarla obligaria a inventar una para poder guardar el
    /// camion, que es peor que no tenerla.
    /// </remarks>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void An_empty_plate_is_valid_and_means_none(string? input)
    {
        var result = LicensePlate.Validate(input);

        Assert.True(result.IsValid);
        Assert.Null(result.Value);
    }

    [Theory]
    [InlineData("AA123")]        // corta
    [InlineData("AAAA123")]      // cuatro letras
    [InlineData("AAA1234")]      // cuatro numeros
    [InlineData("123AAA")]       // al reves
    [InlineData("A1B2C3")]       // mezclada
    [InlineData("AB123C")]       // Mercosur incompleta
    [InlineData("ÁÁÁ123")]       // acentos
    [InlineData("AAA12!")]       // simbolo
    public void Malformed_plates_are_rejected_with_a_readable_reason(string input)
    {
        var result = LicensePlate.Validate(input);

        Assert.False(result.IsValid);
        Assert.False(string.IsNullOrWhiteSpace(result.Error));
    }

    /// <remarks>
    /// Como se muestra en la chapa: <c>AAA 123</c> y <c>AB 123 CD</c>. Es la forma
    /// que la gente reconoce; la guardada, sin espacios, es para comparar.
    /// </remarks>
    [Theory]
    [InlineData("AAA123", "AAA 123")]
    [InlineData("AB123CD", "AB 123 CD")]
    public void A_plate_is_displayed_the_way_it_is_stamped(string stored, string displayed)
    {
        Assert.Equal(displayed, LicensePlate.Display(stored));
    }
}
