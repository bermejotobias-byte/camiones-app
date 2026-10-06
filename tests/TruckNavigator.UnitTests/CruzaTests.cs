using TruckNavigator.Domain.Juegos;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Las reglas de Cruza, Mono que necesita el servidor: cuanto vale una partida y que
/// partidas son posibles. El cliente usa los mismos numeros (reglas.js).
/// </summary>
public class CruzaTests
{
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 0, 10)]
    [InlineData(73, 4, 930)]
    [InlineData(312, 20, 4120)]
    public void The_score_is_ten_per_row_and_fifty_per_box(int filas, int cajas, long puntos)
    {
        Assert.Equal(puntos, Cruza.Puntos(filas, cajas));
    }

    [Fact]
    public void The_numbers_are_the_ones_of_the_client()
    {
        Assert.Equal("cruza", Cruza.RecordCode);
        Assert.Equal(10, Cruza.PuntosPorFila);
        Assert.Equal(50, Cruza.PuntosPorCaja);
        Assert.Equal(140, Cruza.PasoMs);
    }

    [Fact]
    public void Negative_rows_or_boxes_are_impossible()
    {
        Assert.False(Cruza.EsPosible(-1, 0, 60_000));
        Assert.False(Cruza.EsPosible(10, -1, 60_000));
        Assert.Equal(0, Cruza.Puntos(-3, -1));
    }

    [Fact]
    public void Each_box_needs_its_own_row()
    {
        Assert.True(Cruza.EsPosible(5, 5, 60_000));
        Assert.False(Cruza.EsPosible(5, 6, 60_000));
    }

    [Fact]
    public void Each_row_takes_at_least_one_step()
    {
        Assert.True(Cruza.EsPosible(10, 0, 10 * 140));
        Assert.False(Cruza.EsPosible(10, 0, 10 * 140 - 1));
        Assert.True(Cruza.EsPosible(0, 0, 0));
        Assert.False(Cruza.EsPosible(0, 0, -1));
    }
}
