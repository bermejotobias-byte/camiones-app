using TruckNavigator.Domain.Progression;
using TruckNavigator.Domain.Trips;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Que pistas hace avanzar un viaje.
/// </summary>
/// <remarks>
/// La pista de kilometraje NO sale de aca: se recalcula del total acreditado, para
/// que no se pierdan los metros sueltos de cada viaje al redondear y para que el
/// contador siempre pueda reconstruirse desde los viajes.
/// </remarks>
public class TripProgressionTests
{
    private static Trip Completed(
        string startedAtUtc = "2026-03-14T15:00:00Z",
        bool withStops = false)
    {
        var trip = new Trip
        {
            DriverId = Guid.NewGuid(),
            TruckName = "Semi",
            PlannedDistanceMeters = 120_000,
            PlannedDurationSeconds = 7_200,
            StartedAt = DateTimeOffset.Parse(startedAtUtc),
            Stops = withStops ? [new TripStop(-34.6, -58.4, "Una parada")] : []
        };

        trip.Finish(trip.StartedAt.AddHours(2));

        return trip;
    }

    [Fact]
    public void A_completed_trip_counts_as_one_trip()
    {
        var increments = TripProgression.IncrementsFor(Completed());

        Assert.Equal(1, increments["viajes"]);
    }

    [Fact]
    public void A_trip_with_stops_also_counts_as_a_delivery_run()
    {
        Assert.Equal(1, TripProgression.IncrementsFor(Completed(withStops: true))["repartos"]);
    }

    [Fact]
    public void A_trip_without_stops_is_not_a_delivery_run()
    {
        Assert.False(TripProgression.IncrementsFor(Completed()).ContainsKey("repartos"));
    }

    /// <remarks>
    /// <b>La hora que importa es la local, no la UTC.</b> Las 23:00 en Buenos Aires
    /// son las 02:00 UTC del dia siguiente: mirando la hora UTC se marcarian como
    /// nocturnos los viajes del mediodia y viceversa.
    /// </remarks>
    [Theory]
    [InlineData("2026-03-14T02:00:00Z", true)]   // 23:00 local
    [InlineData("2026-03-14T05:59:00Z", true)]   // 02:59 local
    [InlineData("2026-03-14T08:59:00Z", true)]   // 05:59 local
    [InlineData("2026-03-14T09:00:00Z", false)]  // 06:00 local
    [InlineData("2026-03-14T15:00:00Z", false)]  // 12:00 local
    [InlineData("2026-03-15T00:59:00Z", false)]  // 21:59 local
    [InlineData("2026-03-15T01:00:00Z", true)]   // 22:00 local
    public void A_night_trip_is_decided_by_the_local_hour(string startedAtUtc, bool isNight)
    {
        var increments = TripProgression.IncrementsFor(Completed(startedAtUtc));

        Assert.Equal(isNight, increments.ContainsKey("nocturnos"));
    }

    /// <remarks>
    /// Un viaje cancelado no acredita kilometros, y tampoco tiene que mover ninguna
    /// otra pista: si contara como viaje, arrancar y cancelar seria una forma de
    /// subir de escalon sin manejar.
    /// </remarks>
    [Fact]
    public void A_cancelled_trip_advances_nothing()
    {
        var trip = new Trip
        {
            DriverId = Guid.NewGuid(),
            TruckName = "Semi",
            PlannedDistanceMeters = 120_000,
            PlannedDurationSeconds = 7_200,
            StartedAt = DateTimeOffset.Parse("2026-03-14T15:00:00Z")
        };

        trip.Cancel(trip.StartedAt.AddHours(2));

        Assert.Empty(TripProgression.IncrementsFor(trip));
    }
}
