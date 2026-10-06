using TruckNavigator.Domain.Juegos;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Las reglas de la Viborita TBF que necesita el servidor: cuanto vale una partida y
/// que partidas son posibles. El cliente usa los mismos numeros (reglas.js).
/// </summary>
public class ViboritaTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 3)]
    [InlineData(2, 7)]
    [InlineData(5, 25)]
    [InlineData(97, 4947)]
    public void Each_box_is_worth_as_many_points_as_trailers_after_picking_it(int cajas, long puntos)
    {
        Assert.Equal(puntos, Viborita.Puntos(cajas));
    }

    [Fact]
    public void Ninety_seven_boxes_fill_the_ten_by_ten_field()
    {
        Assert.Equal(97, Viborita.CajasMaximas);
        Assert.Equal("viborita", Viborita.RecordCode);
    }

    [Fact]
    public void More_boxes_than_fit_in_the_field_are_impossible()
    {
        Assert.True(Viborita.EsPosible(97, 60_000));
        Assert.False(Viborita.EsPosible(98, 60_000));
        Assert.False(Viborita.EsPosible(-1, 60_000));
    }

    [Fact]
    public void Each_box_takes_at_least_one_step_at_top_speed()
    {
        Assert.True(Viborita.EsPosible(10, 10 * 140));
        Assert.False(Viborita.EsPosible(10, 10 * 140 - 1));
        Assert.True(Viborita.EsPosible(0, 0));
        Assert.False(Viborita.EsPosible(0, -1));
    }
}
