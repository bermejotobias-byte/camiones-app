using TruckNavigator.Domain.Progression;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La escala de niveles.
/// </summary>
/// <remarks>
/// El nivel sale <b>exclusivamente</b> de los kilometros acreditados: no se puede
/// comprar ni ganar jugando. Es una decision de producto que se sostiene desde el
/// principio, y estos tests son los que impiden que se erosione sin querer.
/// </remarks>
public class LevelScaleTests
{
    [Theory]
    [InlineData(0, 1, "Novato")]
    [InlineData(2_499, 1, "Novato")]
    [InlineData(2_500, 2, "Repartidor")]
    [InlineData(8_499, 2, "Repartidor")]
    [InlineData(8_500, 3, "Fletero")]
    [InlineData(20_500, 4, "Transportista")]
    [InlineData(45_500, 5, "Rutero")]
    [InlineData(85_500, 6, "Veterano")]
    [InlineData(150_500, 7, "Leyenda del asfalto")]
    public void The_level_comes_from_the_accumulated_kilometers(
        double kilometers,
        int expectedNumber,
        string expectedName)
    {
        var standing = LevelScale.For(kilometers);

        Assert.Equal(expectedNumber, standing.Number);
        Assert.Equal(expectedName, standing.Name);
    }

    [Theory]
    // Nivel 1: metas de 250 km, desde 0.
    [InlineData(0, 1)]
    [InlineData(249, 1)]
    [InlineData(250, 2)]
    [InlineData(2_250, 10)]
    [InlineData(2_499, 10)]
    // Nivel 2: metas de 600 km, desde 2.500.
    [InlineData(2_500, 1)]
    [InlineData(3_099, 1)]
    [InlineData(3_100, 2)]
    [InlineData(7_900, 10)]
    // Nivel 7: metas de 10.000 km, desde 150.500.
    [InlineData(150_500, 1)]
    [InlineData(160_500, 2)]
    public void Each_level_is_covered_in_ten_goals(double kilometers, int expectedGoal)
    {
        Assert.Equal(expectedGoal, LevelScale.For(kilometers).GoalInLevel);
    }

    /// <remarks>
    /// El ultimo nivel es el techo: quien lo termina sigue sumando kilometros y la
    /// meta no puede pasar de diez. Sin esto, un camionero con 500.000 km veria
    /// "meta 36 de 10".
    /// </remarks>
    [Theory]
    [InlineData(250_500)]
    [InlineData(500_000)]
    [InlineData(9_999_999)]
    public void The_last_level_is_the_ceiling_and_does_not_overflow(double kilometers)
    {
        var standing = LevelScale.For(kilometers);

        Assert.Equal(7, standing.Number);
        Assert.Equal(LevelScale.GoalsPerLevel, standing.GoalInLevel);
    }

    /// <remarks>
    /// Un kilometraje negativo no deberia existir, pero si aparece por un dato
    /// corrupto la escala tiene que devolver el primer nivel y no un indice roto.
    /// </remarks>
    [Theory]
    [InlineData(-1)]
    [InlineData(-100_000)]
    public void A_negative_mileage_falls_back_to_the_first_level(double kilometers)
    {
        var standing = LevelScale.For(kilometers);

        Assert.Equal(1, standing.Number);
        Assert.Equal(1, standing.GoalInLevel);
    }

    /// <remarks>
    /// Lo que el perfil necesita para dibujar la barra y el texto de "te faltan X
    /// para Y". Vivia en el cliente; se muda al servidor con la escala, porque son
    /// la misma regla.
    /// </remarks>
    [Theory]
    [InlineData(0, "Repartidor", 2_500, 0.0)]
    [InlineData(1_250, "Repartidor", 1_250, 0.5)]
    [InlineData(2_500, "Fletero", 6_000, 0.0)]
    [InlineData(5_500, "Fletero", 3_000, 0.5)]
    public void The_standing_says_what_is_left_for_the_next_level(
        double kilometers,
        string expectedNextName,
        long expectedRemaining,
        double expectedProgress)
    {
        var standing = LevelScale.For(kilometers);

        Assert.Equal(expectedNextName, standing.NextName);
        Assert.Equal(expectedRemaining, standing.KilometersToNextLevel);
        Assert.Equal(expectedProgress, standing.ProgressInLevel, precision: 4);
    }

    /// <remarks>
    /// En el ultimo nivel no hay siguiente. La barra se muestra llena en vez de
    /// dividir por cero, que es lo que ya hacia la version del cliente.
    /// </remarks>
    [Theory]
    [InlineData(150_500)]
    [InlineData(500_000)]
    public void The_last_level_has_no_next_one(double kilometers)
    {
        var standing = LevelScale.For(kilometers);

        Assert.Null(standing.NextName);
        Assert.Equal(0, standing.KilometersToNextLevel);
        Assert.Equal(1.0, standing.ProgressInLevel, precision: 4);
    }

    /// <remarks>
    /// Los escalones de la pista de kilometraje <b>se derivan de esta misma escala</b>
    /// en vez de escribirse aparte. Duplicarlos seria pedir que en algun momento
    /// dejen de coincidir, y ahi el nivel y la meta dirian cosas distintas.
    /// </remarks>
    [Fact]
    public void The_goal_thresholds_are_derived_from_the_scale()
    {
        var thresholds = LevelScale.GoalThresholds();

        Assert.Equal(70, thresholds.Count);

        // Nivel 1, metas de 250 km.
        Assert.Equal(250, thresholds[0]);
        Assert.Equal(2_500, thresholds[9]);

        // Nivel 2, metas de 600 km, arrancando en 2.500.
        Assert.Equal(3_100, thresholds[10]);
        Assert.Equal(8_500, thresholds[19]);

        // El ultimo escalon coincide con el techo de la escala.
        Assert.Equal(250_500, thresholds[^1]);
    }

    /// <remarks>
    /// Cada umbral tiene que ser mayor que el anterior. Un escalon que no avanza se
    /// completaria junto con el previo y regalaria dos recompensas de una.
    /// </remarks>
    [Fact]
    public void The_goal_thresholds_always_grow()
    {
        var thresholds = LevelScale.GoalThresholds();

        for (var i = 1; i < thresholds.Count; i++)
        {
            Assert.True(
                thresholds[i] > thresholds[i - 1],
                $"El escalon {i} ({thresholds[i]}) no supera al anterior ({thresholds[i - 1]}).");
        }
    }
}
