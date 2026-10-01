using TruckNavigator.Domain.Users;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Las reglas de un contacto de emergencia.
/// </summary>
/// <remarks>
/// <para>
/// Acá la validación tiene un sesgo deliberado y conviene entenderlo antes de
/// endurecerla: <b>rechazar un número válido es peor que aceptar uno raro</b>. Un
/// número raro se llama y no atiende nadie; uno rechazado <b>nunca se guardó</b>,
/// y eso se descubre el día que hacía falta.
/// </para>
/// <para>
/// Por eso no se valida forma argentina —el 0, el 15, el +54 9— sino sólo que sea
/// plausible: los caracteres que una persona escribe y una cantidad de dígitos
/// razonable.
/// </para>
/// </remarks>
public class EmergencyContactTests
{
    /* ------------------------------------------------------------- acepta */

    [Theory]
    [InlineData("1145678900")]              // como lo escribe alguien apurado
    [InlineData("11 4567-8900")]            // como viene de la agenda
    [InlineData("+54 9 11 5555-1234")]      // internacional completo
    [InlineData("(011) 4567.8900")]         // con parentesis y puntos
    [InlineData("0800/333/1234")]           // un 0800 con barras
    public void AceptaLosFormatosEnQueLaGenteEscribeUnTelefono(string phone)
    {
        var result = EmergencyContactRules.Validate("Rosa", phone);

        Assert.True(result.IsValid, $"deberia aceptar '{phone}': {result.Error}");
    }

    [Fact]
    public void DevuelveLosValoresRecortadosParaQueElLlamadorNoLosLimpieDeNuevo()
    {
        var result = EmergencyContactRules.Validate("  Rosa  ", "  11 4567-8900  ");

        Assert.True(result.IsValid);
        Assert.Equal("Rosa", result.Name);
        Assert.Equal("11 4567-8900", result.Phone);
    }

    [Fact]
    public void NoReescribeElNumero()
    {
        // Se guarda TAL COMO SE CARGO. Normalizarlo seria inventar reglas que no
        // valen fuera del pais, y un numero reescrito mal es un numero que no
        // llama. Ver AD-42.
        var result = EmergencyContactRules.Validate("Taller", "+54 9 11 5555-1234");

        Assert.Equal("+54 9 11 5555-1234", result.Phone);
    }

    /* ------------------------------------------------------------ rechaza */

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void SinNombreNoHayContacto(string? name)
    {
        // El nombre no es decorativo: es lo que se lee apurado para saber a quien
        // se esta por llamar.
        var result = EmergencyContactRules.Validate(name, "1145678900");

        Assert.False(result.IsValid);
        Assert.NotNull(result.Error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void SinTelefonoTampoco(string? phone)
    {
        var result = EmergencyContactRules.Validate("Rosa", phone);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void RechazaLoQueNoEsUnTelefono()
    {
        var result = EmergencyContactRules.Validate("Rosa", "llamar al taller");

        Assert.False(result.IsValid);
    }

    [Fact]
    public void RechazaUnNumeroDemasiadoCorto()
    {
        // Tres digitos es un error de tipeo. Para los numeros cortos de verdad
        // —el 911— ya esta el boton propio arriba de la pantalla.
        var result = EmergencyContactRules.Validate("Rosa", "123");

        Assert.False(result.IsValid);
    }

    [Fact]
    public void RechazaMasDigitosDeLosQueExisteEnElMundo()
    {
        // Quince es el tope de E.164. Mas que eso no es un telefono de nadie.
        var result = EmergencyContactRules.Validate("Rosa", "12345678901234567");

        Assert.False(result.IsValid);
    }

    [Fact]
    public void RechazaUnNombreMasLargoQueElLimiteDeLaColumna()
    {
        // El limite tiene que saltar en el dominio y no en la base: un
        // DbUpdateException le llega al usuario como "error del servidor".
        var result = EmergencyContactRules.Validate(
            new string('a', EmergencyContactRules.MaxNameLength + 1),
            "1145678900");

        Assert.False(result.IsValid);
    }

    [Fact]
    public void ElErrorEstaEscritoParaMostrarseTalCual()
    {
        var result = EmergencyContactRules.Validate("", "1145678900");

        // No es un codigo ni un nombre de campo: es una frase que se le puede
        // mostrar a una persona sin traducirla.
        Assert.NotNull(result.Error);
        Assert.Contains(' ', result.Error);
        Assert.True(char.IsUpper(result.Error![0]));
    }

    /* -------------------------------------------------------------- limite */

    [Fact]
    public void ElMaximoEsTresYEsUnaDecisionDeProducto()
    {
        // No es una restriccion tecnica: esta pantalla se lee en el peor momento
        // posible, y una lista larga obliga a elegir justo cuando nadie puede.
        Assert.Equal(3, EmergencyContact.MaxPerDriver);
    }

    [Fact]
    public void UnContactoNuevoTraeIdYFecha()
    {
        // El Id lo pone el dominio y no la base: el endpoint devuelve el contacto
        // creado y la app lo necesita para poder borrarlo sin recargar la lista.
        var contact = new EmergencyContact();

        Assert.NotEqual(Guid.Empty, contact.Id);
        Assert.NotEqual(default, contact.AddedAt);
    }
}
