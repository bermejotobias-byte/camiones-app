using TruckNavigator.Api.RateLimiting;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Que canasta le toca a cada pedido. Es la decision que decide todo el limite
/// de tasa, y por eso vive suelta y pura: un metodo y una ruta entran, una
/// canasta sale. Los numeros de cada canasta se fijan en RateLimitSettingsTests.
/// </summary>
public class RateLimitPlanTests
{
    [Theory]
    [InlineData("GET", "/api/reports")]
    [InlineData("GET", "/api/pois")]
    [InlineData("GET", "/api/trucks")]
    [InlineData("GET", "/api/trucks/templates")]
    [InlineData("GET", "/api/profile")]
    [InlineData("GET", "/api/profile/places")]
    [InlineData("GET", "/api/trips/active")]
    [InlineData("GET", "/api/progress")]
    public void Reading_the_map_goes_to_the_generous_bucket(string method, string path)
    {
        Assert.Equal(RateBucket.Read, RateLimitPlan.BucketFor(method, path));
    }

    [Theory]
    [InlineData("POST", "/api/reports")]
    [InlineData("PUT", "/api/reports/0d9b2e64-0000-0000-0000-000000000001/vote")]
    [InlineData("DELETE", "/api/reports/0d9b2e64-0000-0000-0000-000000000001")]
    [InlineData("POST", "/api/pois")]
    [InlineData("PUT", "/api/pois/0d9b2e64-0000-0000-0000-000000000001/vote")]
    [InlineData("DELETE", "/api/pois/0d9b2e64-0000-0000-0000-000000000001/vote")]
    [InlineData("POST", "/api/trucks")]
    [InlineData("PUT", "/api/profile")]
    [InlineData("POST", "/api/profile/emergency-contacts")]
    [InlineData("POST", "/api/trips")]
    [InlineData("POST", "/api/progress/seen")]
    public void Writing_goes_to_its_own_bucket(string method, string path)
    {
        Assert.Equal(RateBucket.Write, RateLimitPlan.BucketFor(method, path));
    }

    [Theory]
    [InlineData("/api/places")]
    [InlineData("/api/places/reverse")]
    public void Searching_an_address_has_its_own_bucket_because_it_hits_Photon(string path)
    {
        Assert.Equal(RateBucket.Search, RateLimitPlan.BucketFor("GET", path));
    }

    [Fact]
    public void Routing_and_delivery_are_separate_buckets()
    {
        Assert.Equal(RateBucket.Routing, RateLimitPlan.BucketFor("POST", "/api/routes"));
        Assert.Equal(RateBucket.Delivery, RateLimitPlan.BucketFor("POST", "/api/routes/delivery"));
    }

    [Theory]
    [InlineData("POST", "/api/auth/login")]
    [InlineData("POST", "/api/auth/register")]
    [InlineData("POST", "/api/auth/refresh")]
    [InlineData("POST", "/api/auth/forgotPassword")]
    [InlineData("POST", "/api/auth/resendConfirmationEmail")]
    [InlineData("GET", "/api/auth/confirmEmail")]
    public void Everything_about_accounts_goes_to_the_strict_bucket(string method, string path)
    {
        Assert.Equal(RateBucket.Auth, RateLimitPlan.BucketFor(method, path));
    }

    [Theory]
    [InlineData("GET", "/api/health")]
    [InlineData("GET", "/tiles/amba.pmtiles")]
    [InlineData("GET", "/js/app.js")]
    [InlineData("GET", "/data/galibos.geojson")]
    [InlineData("GET", "/")]
    [InlineData("GET", "/swagger/index.html")]
    public void What_is_not_the_API_is_not_limited_here(string method, string path)
    {
        Assert.Equal(RateBucket.None, RateLimitPlan.BucketFor(method, path));
    }

    [Fact]
    public void The_case_and_the_trailing_slash_do_not_change_the_bucket()
    {
        Assert.Equal(RateBucket.Read, RateLimitPlan.BucketFor("get", "/API/Reports"));
        Assert.Equal(RateBucket.Read, RateLimitPlan.BucketFor("GET", "/api/reports/"));
        Assert.Equal(RateBucket.Delivery, RateLimitPlan.BucketFor("post", "/API/Routes/Delivery/"));
    }

    [Fact]
    public void An_unknown_corner_of_the_API_still_falls_in_a_bucket()
    {
        // Un endpoint nuevo que nadie clasifico no puede quedar sin limite: lee o
        // escribe, y eso ya alcanza para elegir canasta.
        Assert.Equal(RateBucket.Read, RateLimitPlan.BucketFor("GET", "/api/loquevenga"));
        Assert.Equal(RateBucket.Write, RateLimitPlan.BucketFor("POST", "/api/loquevenga"));
        Assert.Equal(RateBucket.Write, RateLimitPlan.BucketFor("PATCH", "/api/loquevenga"));
    }
}
