using TruckNavigator.Domain.Trips;
using TruckNavigator.Domain.Users;

namespace TruckNavigator.UnitTests;

/// <summary>
/// Los lugares del camionero: Casa y Deposito, que se guardan, y los
/// recientes, que salen de los viajes. Viven en el servidor porque un atajo
/// que se pierde al reinstalar la app es un atajo que no esta el dia que se
/// necesita, igual que los contactos de emergencia (AD-43).
/// </summary>
public class SavedPlacesTests
{
    private static Trip TripTo(string label, double lat, double lng, int minutesAgo) => new()
    {
        DriverId = Guid.NewGuid(),
        TruckName = "El Rayo",
        DestinationLabel = label,
        DestinationLatitude = lat,
        DestinationLongitude = lng,
        StartedAt = new DateTimeOffset(2026, 9, 16, 12, 0, 0, TimeSpan.Zero).AddMinutes(-minutesAgo)
    };

    [Fact]
    public void Recent_places_are_the_latest_destinations_newest_first()
    {
        var trips = new[]
        {
            TripTo("Mercado Central", -34.70, -58.50, minutesAgo: 60),
            TripTo("Puerto", -34.60, -58.36, minutesAgo: 10),
            TripTo("Deposito Pompeya", -34.65, -58.41, minutesAgo: 30)
        };

        var recent = RecentPlaces.From(trips);

        Assert.Equal(["Puerto", "Deposito Pompeya", "Mercado Central"], recent.Select(p => p.Label));
    }

    [Fact]
    public void The_same_destination_twice_is_one_recent_place_dated_by_the_latest_trip()
    {
        var trips = new[]
        {
            TripTo("Puerto", -34.60, -58.36, minutesAgo: 90),
            TripTo("Mercado Central", -34.70, -58.50, minutesAgo: 60),
            TripTo("Puerto", -34.60, -58.36, minutesAgo: 10)
        };

        var recent = RecentPlaces.From(trips);

        Assert.Equal(2, recent.Count);
        Assert.Equal("Puerto", recent[0].Label);
        Assert.Equal(trips[2].StartedAt, recent[0].LastUsedAt);
    }

    [Fact]
    public void Recent_places_are_capped_at_eight()
    {
        var trips = Enumerable.Range(0, 12)
            .Select(i => TripTo($"Destino {i}", -34.6 - i * 0.01, -58.4, minutesAgo: i))
            .ToArray();

        Assert.Equal(RecentPlaces.Max, RecentPlaces.From(trips).Count);
        Assert.Equal("Destino 0", RecentPlaces.From(trips)[0].Label);
    }

    [Fact]
    public void A_trip_without_a_destination_label_is_not_a_recent_place()
    {
        var trips = new[] { TripTo("", -34.6, -58.4, minutesAgo: 1), TripTo("Puerto", -34.60, -58.36, minutesAgo: 2) };

        Assert.Equal(["Puerto"], RecentPlaces.From(trips).Select(p => p.Label));
    }

    [Theory]
    [InlineData("Casa", -34.65, -58.41, true)]
    [InlineData("", -34.65, -58.41, false)]
    [InlineData("Casa", 91, -58.41, false)]
    [InlineData("Casa", -34.65, -181, false)]
    public void A_saved_place_needs_a_label_and_plausible_coordinates(string label, double lat, double lng, bool valid)
    {
        Assert.Equal(valid, SavedPlaceRules.Validate(label, lat, lng).IsValid);
    }

    [Fact]
    public void The_label_is_trimmed_and_capped()
    {
        var result = SavedPlaceRules.Validate("  Deposito de Pompeya  ", -34.65, -58.41);

        Assert.True(result.IsValid);
        Assert.Equal("Deposito de Pompeya", result.Label);

        Assert.False(SavedPlaceRules.Validate(new string('x', SavedPlaceRules.MaxLabelLength + 1), -34.65, -58.41).IsValid);
    }
}
