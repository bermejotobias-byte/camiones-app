using TruckNavigator.Domain.Users;

namespace TruckNavigator.UnitTests;

public class DriverProfileTests
{
    [Fact]
    public void Setting_the_alias_stores_both_the_shown_and_the_comparable_form()
    {
        var profile = new DriverProfile { Id = Guid.NewGuid() };

        profile.SetAlias("ElGaucho");

        Assert.Equal("ElGaucho", profile.Alias);
        Assert.Equal("elgaucho", profile.NormalizedAlias);
    }

    [Fact]
    public void A_malformed_alias_is_rejected_before_it_reaches_the_database()
    {
        var profile = new DriverProfile { Id = Guid.NewGuid() };

        Assert.Throws<ArgumentException>(() => profile.SetAlias("el gaucho"));
    }

    /// <summary>
    /// El alta permite saltear el paso de datos personales, asi que un perfil recien
    /// creado tiene que ser valido aunque este vacio.
    /// </summary>
    [Fact]
    public void A_brand_new_profile_is_usable_but_not_complete()
    {
        var profile = new DriverProfile { Id = Guid.NewGuid() };

        Assert.Null(profile.Alias);
        Assert.False(profile.IsComplete);
    }

    [Fact]
    public void The_profile_is_complete_only_with_alias_name_and_surname()
    {
        var profile = new DriverProfile { Id = Guid.NewGuid() };
        profile.SetAlias("ElGaucho");

        Assert.False(profile.IsComplete);

        profile.FirstName = "Tobias";
        Assert.False(profile.IsComplete);

        profile.LastName = "Bermejo";
        Assert.True(profile.IsComplete);
    }
}
