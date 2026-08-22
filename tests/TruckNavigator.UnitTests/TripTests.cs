using TruckNavigator.Domain.Trips;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Los kilometros acreditados son la moneda de todo lo que se desbloquea
/// manejando, asi que la regla que decide cuantos se acreditan se prueba con el
/// mismo detalle que las restricciones.
/// </summary>
public class TripTests
{
    private const double ThirtyKilometers = 30_000;
    private static readonly double ThirtyMinutes = TimeSpan.FromMinutes(30).TotalSeconds;

    private static Trip Started(DateTimeOffset at) => new()
    {
        DriverId = Guid.NewGuid(),
        TruckName = "Camion de prueba",
        PlannedDistanceMeters = ThirtyKilometers,
        PlannedDurationSeconds = ThirtyMinutes,
        StartedAt = at
    };

    [Fact]
    public void A_trip_starts_open_and_credits_nothing()
    {
        var trip = Started(DateTimeOffset.UtcNow);

        Assert.True(trip.IsOpen);
        Assert.Equal(TripStatus.InProgress, trip.Status);
        Assert.Equal(0, trip.CreditedDistanceMeters);
        Assert.Null(trip.FinishedAt);
        Assert.Null(trip.Elapsed);
    }

    [Fact]
    public void Arriving_after_a_plausible_time_credits_the_whole_distance()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddMinutes(28));

        Assert.Equal(TripStatus.Completed, trip.Status);
        Assert.Equal(ThirtyKilometers, trip.CreditedDistanceMeters);
        Assert.False(trip.IsOpen);
    }

    /// <summary>
    /// El abuso obvio: arrancar un viaje y cerrarlo en el acto para regalarse los
    /// kilometros sin mover el camion.
    /// </summary>
    [Fact]
    public void Closing_a_trip_immediately_credits_nothing()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddSeconds(4));

        Assert.Equal(TripStatus.Completed, trip.Status);
        Assert.Equal(0, trip.CreditedDistanceMeters);
    }

    [Fact]
    public void Exactly_half_the_estimated_time_is_enough()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddMinutes(15));

        Assert.Equal(ThirtyKilometers, trip.CreditedDistanceMeters);
    }

    [Fact]
    public void A_shade_under_half_is_not_enough()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddMinutes(15).AddSeconds(-1));

        Assert.Equal(0, trip.CreditedDistanceMeters);
    }

    [Fact]
    public void Abandoning_a_trip_credits_nothing_however_long_it_took()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Cancel(start.AddHours(3));

        Assert.Equal(TripStatus.Cancelled, trip.Status);
        Assert.Equal(0, trip.CreditedDistanceMeters);
        Assert.NotNull(trip.FinishedAt);
    }

    /// <summary>
    /// Un reloj atrasado no puede producir un viaje de duracion negativa, que
    /// ademas seria el camino mas facil para romper el calculo.
    /// </summary>
    [Fact]
    public void A_clock_going_backwards_does_not_produce_a_negative_trip()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddMinutes(-40));

        Assert.Equal(start, trip.FinishedAt);
        Assert.Equal(TimeSpan.Zero, trip.Elapsed);
        Assert.Equal(0, trip.CreditedDistanceMeters);
    }

    [Fact]
    public void A_closed_trip_cannot_be_closed_again()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddMinutes(28));

        Assert.Throws<InvalidOperationException>(() => trip.Finish(start.AddMinutes(40)));
        Assert.Throws<InvalidOperationException>(() => trip.Cancel(start.AddMinutes(40)));
    }

    [Fact]
    public void A_cancelled_trip_cannot_be_finished_afterwards()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Cancel(start.AddMinutes(5));

        Assert.Throws<InvalidOperationException>(() => trip.Finish(start.AddMinutes(40)));
        Assert.Equal(0, trip.CreditedDistanceMeters);
    }

    [Fact]
    public void The_elapsed_time_is_measured_between_start_and_finish()
    {
        var start = DateTimeOffset.UtcNow;
        var trip = Started(start);

        trip.Finish(start.AddMinutes(42));

        Assert.Equal(TimeSpan.FromMinutes(42), trip.Elapsed);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(899, false)]
    [InlineData(900, true)]
    [InlineData(5_400, true)]
    public void The_crediting_rule_is_a_threshold_on_elapsed_time(int elapsedSeconds, bool credits)
    {
        var credited = TripCrediting.CreditFor(
            ThirtyKilometers,
            ThirtyMinutes,
            TimeSpan.FromSeconds(elapsedSeconds));

        Assert.Equal(credits ? ThirtyKilometers : 0, credited);
    }
}
