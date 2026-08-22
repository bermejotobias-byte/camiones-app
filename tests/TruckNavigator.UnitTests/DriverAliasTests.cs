using TruckNavigator.Domain.Users;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El alias es la identidad publica del camionero en la comunidad, asi que sus
/// reglas se testean con el mismo detalle que las de restricciones.
/// </summary>
public class DriverAliasTests
{
    [Theory]
    [InlineData("elgaucho")]
    [InlineData("ElGaucho")]
    [InlineData("el_gaucho_del_sur")]
    [InlineData("juan.perez")]
    [InlineData("truck2026")]
    [InlineData("abc")]
    public void Well_formed_aliases_are_accepted(string alias)
    {
        Assert.True(DriverAlias.Validate(alias).IsValid);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("ab")]                       // corto
    [InlineData("1camionero")]               // empieza con numero
    [InlineData("_camionero")]               // empieza con separador
    [InlineData("el gaucho")]                // espacio
    [InlineData("el-gaucho")]                // guion medio
    [InlineData("gaucho!")]                  // simbolo
    [InlineData("gaucho.")]                  // termina en separador
    [InlineData("gaucho_")]
    [InlineData("camioneroquenoentraentreintacaracteres")]
    public void Malformed_aliases_are_rejected(string? alias)
    {
        var result = DriverAlias.Validate(alias);

        Assert.False(result.IsValid);

        // El motivo se le muestra al usuario, asi que no puede venir vacio.
        Assert.False(string.IsNullOrWhiteSpace(result.Error));
    }

    [Fact]
    public void The_alias_is_trimmed_but_its_capitalisation_is_kept()
    {
        var result = DriverAlias.Validate("  ElGaucho  ");

        Assert.True(result.IsValid);
        Assert.Equal("ElGaucho", result.Value);
    }

    /// <summary>
    /// La razon de existir de la normalizacion: dos alias que se leen igual tienen
    /// que chocar, porque el parecido es justamente lo que permite suplantar a otro
    /// en el chat.
    /// </summary>
    [Fact]
    public void Aliases_that_differ_only_in_capitalisation_collide()
    {
        Assert.Equal(
            DriverAlias.Normalize("ElGaucho"),
            DriverAlias.Normalize("elgaucho"));
    }

    [Fact]
    public void Different_aliases_do_not_collide()
    {
        Assert.NotEqual(
            DriverAlias.Normalize("elgaucho"),
            DriverAlias.Normalize("el_gaucho"));
    }
}
