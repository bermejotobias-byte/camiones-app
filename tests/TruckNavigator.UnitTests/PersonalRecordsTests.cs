using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Los records personales: la mejor marca historica, con su fecha.
/// </summary>
/// <remarks>
/// No son progresion y no otorgan nada, por eso viven fuera del libro de
/// movimientos. Son "mas kilometros en un dia", "el viaje mas largo", "la racha mas
/// larga". Lo que los hace valiosos es <b>cuando</b> ocurrieron.
/// </remarks>
public class PersonalRecordsTests
{
    private static readonly DateTimeOffset Antes =
        new(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);

    private static readonly DateTimeOffset Ahora =
        new(2026, 9, 10, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void The_first_mark_becomes_the_record()
    {
        var improved = PersonalRecords.Improve(current: null, candidate: 420, when: Ahora);

        Assert.NotNull(improved);
        Assert.Equal(420, improved.Value.Value);
        Assert.Equal(Ahora, improved.Value.AchievedAt);
    }

    [Fact]
    public void Beating_the_record_replaces_the_value_and_the_date()
    {
        var current = new RecordStanding(420, Antes);

        var improved = PersonalRecords.Improve(current, candidate: 610, when: Ahora);

        Assert.NotNull(improved);
        Assert.Equal(610, improved.Value.Value);
        Assert.Equal(Ahora, improved.Value.AchievedAt);
    }

    /// <remarks>
    /// Igualar no es superar: la fecha tiene que seguir siendo la del dia en que se
    /// consiguio la marca por primera vez.
    /// </remarks>
    [Theory]
    [InlineData(420)]
    [InlineData(419)]
    [InlineData(0)]
    public void Not_beating_the_record_changes_nothing(long candidate)
    {
        var current = new RecordStanding(420, Antes);

        Assert.Null(PersonalRecords.Improve(current, candidate, Ahora));
    }
}
