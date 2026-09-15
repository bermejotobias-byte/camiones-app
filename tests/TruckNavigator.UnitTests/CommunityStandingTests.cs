using TruckNavigator.Domain.Pois;

namespace TruckNavigator.UnitTests;

/// <summary>
/// El sello de la comunidad: una señal aparte de lo verificado, con umbrales fijos.
/// </summary>
/// <remarks>
/// Los umbrales los aprobo el usuario el 15/09/2026: tres votos para que el sello
/// diga algo, y el doble de aptos que de no aptos para recomendar. Entre "los no
/// aptos igualan" y "el doble de aptos" el sello calla a proposito.
/// </remarks>
public class CommunityStandingTests
{
    [Theory]
    [InlineData(0, 0, CommunitySeal.NoVotesYet)]
    [InlineData(2, 0, CommunitySeal.NoVotesYet)]   // menos de tres votos no dice nada
    [InlineData(3, 0, CommunitySeal.Recommended)]
    [InlineData(2, 1, CommunitySeal.NoVotesYet)]   // tres votos, pero sin el doble de aptos
    [InlineData(4, 2, CommunitySeal.Recommended)]
    [InlineData(5, 3, CommunitySeal.NoVotesYet)]
    [InlineData(3, 3, CommunitySeal.Disputed)]
    [InlineData(1, 4, CommunitySeal.Disputed)]
    [InlineData(0, 3, CommunitySeal.Disputed)]
    public void The_seal_follows_the_thresholds(int suitable, int notSuitable, CommunitySeal expected)
    {
        Assert.Equal(expected, CommunityStanding.SealFor(new CommunityCount(suitable, notSuitable)));
    }

    [Fact]
    public void The_thresholds_are_the_ones_the_user_approved()
    {
        Assert.Equal(3, CommunityStanding.MinimumVotes);
        Assert.Equal(2, CommunityStanding.ApprovalRatio);
    }
}
