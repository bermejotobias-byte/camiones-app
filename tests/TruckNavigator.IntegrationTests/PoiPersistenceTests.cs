using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Pois;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Infrastructure.Persistence;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Verifica el camino completo dataset -> migration -> base -> consulta.
/// </summary>
/// <remarks>
/// Corre contra SQLite de verdad, no contra un proveedor en memoria: lo que mas
/// facilmente se rompe en esta parte es el conversor de la lista de servicios, y un
/// proveedor falso no lo ejercita.
/// </remarks>
public sealed class PoiPersistenceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        // La base en memoria vive mientras la conexion siga abierta.
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options);

        await PointOfInterestSeed.ApplyAsync(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task The_dataset_lands_in_the_database()
    {
        var stored = await _db.PointsOfInterest.AsNoTracking().ToListAsync();

        Assert.NotEmpty(stored);
        Assert.All(stored, poi => Assert.False(string.IsNullOrWhiteSpace(poi.Source)));
    }

    /// <summary>
    /// La lista de servicios se guarda como JSON. Si el conversor estuviera mal, esto
    /// vuelve vacio o explota al leer.
    /// </summary>
    /// <remarks>
    /// El filtrado se hace despues de materializar a proposito: al ser una columna JSON,
    /// <c>Services</c> no se puede consultar desde SQL. Vale tambien para el endpoint,
    /// que filtra por categoria en la base y nunca por servicios.
    /// </remarks>
    [Fact]
    public async Task Service_lists_survive_the_round_trip()
    {
        var stored = await _db.PointsOfInterest.AsNoTracking().ToListAsync();

        var withServices = stored.FirstOrDefault(p => p.Services.Count > 0);

        Assert.NotNull(withServices);
        Assert.NotEmpty(withServices.Services);
    }

    [Fact]
    public async Task Points_can_be_filtered_by_category()
    {
        var stations = await _db.PointsOfInterest
            .AsNoTracking()
            .Where(p => p.Category == PoiCategory.FuelStation)
            .ToListAsync();

        Assert.NotEmpty(stations);
        Assert.All(stations, poi => Assert.Equal(PoiCategory.FuelStation, poi.Category));
    }

    [Fact]
    public async Task Enums_are_stored_as_text_so_the_database_is_readable()
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "SELECT Category, VerificationLevel FROM PointsOfInterest LIMIT 1";

        await using var reader = await command.ExecuteReaderAsync();

        Assert.True(await reader.ReadAsync());
        Assert.True(Enum.TryParse<PoiCategory>(reader.GetString(0), out _));
        Assert.True(Enum.TryParse<VerificationLevel>(reader.GetString(1), out _));
    }

    /// <summary>
    /// El seed se corre cada vez que arranca la API. Correrlo dos veces no puede
    /// duplicar puntos ni multiplicar filas.
    /// </summary>
    [Fact]
    public async Task Running_the_seed_twice_does_not_duplicate_points()
    {
        var before = await _db.PointsOfInterest.CountAsync();

        await PointOfInterestSeed.ApplyAsync(_db);

        Assert.Equal(before, await _db.PointsOfInterest.CountAsync());
    }

    /// <summary>
    /// Regenerar el dataset tiene que reflejarse en una base ya creada. Con el criterio
    /// de "sembrar solo si la tabla esta vacia" esto no pasaria.
    /// </summary>
    [Fact]
    public async Task The_seed_refreshes_points_that_changed_in_the_dataset()
    {
        var stored = await _db.PointsOfInterest.FirstAsync();
        var original = stored.Name;

        stored.Name = "Nombre viejo que ya no esta en el dataset";
        await _db.SaveChangesAsync();

        await PointOfInterestSeed.ApplyAsync(_db);

        var refreshed = await _db.PointsOfInterest.AsNoTracking().FirstAsync(p => p.Id == stored.Id);
        Assert.Equal(original, refreshed.Name);
    }

    /// <summary>
    /// Lo que no viene del dataset es del usuario y el seed no lo puede tocar.
    /// </summary>
    [Fact]
    public async Task The_seed_leaves_user_loaded_points_alone()
    {
        var own = new PointOfInterest
        {
            Name = "Playa propia",
            Category = PoiCategory.TruckParking,
            Latitude = -34.62,
            Longitude = -58.41,
            Source = "Cargado a mano en la prueba",
            SourceRetrievedOn = new DateOnly(2026, 8, 14),
            VerificationLevel = VerificationLevel.Confirmed,
            IsSampleData = false
        };

        _db.PointsOfInterest.Add(own);
        await _db.SaveChangesAsync();

        await PointOfInterestSeed.ApplyAsync(_db);

        var stored = await _db.PointsOfInterest.AsNoTracking().FirstOrDefaultAsync(p => p.Id == own.Id);

        Assert.NotNull(stored);
        Assert.Equal("Playa propia", stored.Name);
    }

    /// <summary>
    /// La regla de aptitud aplicada sobre los datos reales: para un semirremolque, hoy
    /// ninguna fuente confirma nada, asi que el filtro estricto no devuelve puntos. Es
    /// el resultado correcto, no una falla: lo que falta es el dato.
    /// </summary>
    [Fact]
    public async Task Unknown_suitability_never_counts_as_suitable()
    {
        var semi = new TruckProfile
        {
            Name = "Semirremolque",
            GrossWeightKg = 40_000,
            HeightMeters = 4.20,
            WidthMeters = 2.55,
            LengthMeters = 6.00,
            NumberOfAxles = 5,
            VehicleType = VehicleType.SemiTrailer,
            HasTrailer = true,
            TrailerLengthMeters = 12.00
        };

        var points = await _db.PointsOfInterest.AsNoTracking().ToListAsync();

        var suitable = points.Where(p => PoiSuitability.Accepts(p, semi) == true).ToList();
        var unknown = points.Where(p => PoiSuitability.Accepts(p, semi) is null).ToList();

        Assert.NotEmpty(unknown);
        Assert.All(suitable, poi => Assert.True(poi.SuitableForSemiTrailer));
    }
}
