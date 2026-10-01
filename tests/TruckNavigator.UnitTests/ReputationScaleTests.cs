using TruckNavigator.Domain.Reports;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La reputacion de quien reporta: arranca en 50, sube cuando la comunidad
/// valida lo suyo, baja cuando lo rechaza, y vive entre 0 y 100. Es una cosa
/// distinta de la EXP: mide credibilidad, no esfuerzo.
/// </summary>
public class ReputationScaleTests
{
    [Fact]
    public void Everyone_starts_at_fifty()
    {
        Assert.Equal(50, ReputationScale.Start);
    }

    [Theory]
    [InlineData(50, ReputationScale.OnValidated, 53)]
    [InlineData(50, ReputationScale.OnRejected, 45)]
    [InlineData(2, ReputationScale.OnRejected, 0)]      // nunca negativa
    [InlineData(99, ReputationScale.OnValidated, 100)]  // nunca mas de cien
    public void It_moves_by_what_the_community_says_and_stays_in_range(int score, int delta, int expected)
    {
        Assert.Equal(expected, ReputationScale.Apply(score, delta));
    }

    [Fact]
    public void The_steps_are_the_ones_of_the_spec()
    {
        Assert.Equal(3, ReputationScale.OnValidated);
        Assert.Equal(-5, ReputationScale.OnRejected);
    }
}
