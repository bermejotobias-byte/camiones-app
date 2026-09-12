using System.Text.Json;
using TruckNavigator.Api.Contracts;
using TruckNavigator.Domain.Trucks;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Los contratos del carnet, tal como cruzan el HTTP.
/// </summary>
/// <remarks>
/// La leccion de siempre: lo que cruza una frontera hay que probarlo cruzandola.
/// Aca cruzan dos cosas nuevas: una <c>DateOnly</c>, que es un tipo que
/// System.Text.Json trata distinto de <c>DateTime</c>, y una patente que se guarda
/// canonica pero se muestra como en la chapa.
/// </remarks>
public class CarnetContractsTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <remarks>
    /// El telefono manda la fecha como la escribe un <c>&lt;input type="date"&gt;</c>:
    /// <c>AAAA-MM-DD</c>, sin hora. Tiene que llegar como el dia que es, no como un
    /// instante que despues se corre un dia por el huso.
    /// </remarks>
    [Fact]
    public void The_birth_date_arrives_as_a_plain_day()
    {
        var request = JsonSerializer.Deserialize<SaveDriverProfileRequest>(
            """{"firstName":"Demo","birthDate":"1988-03-27"}""", Web);

        Assert.Equal(new DateOnly(1988, 3, 27), request!.BirthDate);
    }

    [Fact]
    public void A_missing_birth_date_is_null_not_an_error()
    {
        var request = JsonSerializer.Deserialize<SaveDriverProfileRequest>(
            """{"firstName":"Demo"}""", Web);

        Assert.Null(request!.BirthDate);
    }

    /// <remarks>
    /// El DTO del dueño SI lleva la fecha. Es el unico DTO de perfil que existe hoy;
    /// el dia que haya una vista publica, esa tiene que ser otra proyeccion que la
    /// omita. Este test fija que la fecha sale con forma de dia.
    /// </remarks>
    [Fact]
    public void The_owner_dto_carries_the_birth_date_as_a_plain_day()
    {
        var profile = new DriverProfile { Id = Guid.NewGuid(), BirthDate = new DateOnly(1988, 3, 27) };
        var user = new AppUser { Id = profile.Id, Email = "uno@camiones.test" };

        var json = JsonSerializer.Serialize(DriverProfileDto.From(profile, user), Web);

        Assert.Contains("\"birthDate\":\"1988-03-27\"", json);
    }

    /// <remarks>
    /// El DTO del camion lleva la patente dos veces a proposito: canonica, para el
    /// formulario y para comparar, y como esta estampada, para mostrar. La regla de
    /// como se estampa vive en el dominio y no se duplica en el telefono.
    /// </remarks>
    [Fact]
    public void The_truck_dto_carries_the_plate_canonical_and_stamped()
    {
        var truck = new TruckProfile { Name = "El Rayo", Brand = "Scania", Model = "R 450", Plate = "AB123CD" };

        var dto = TruckProfileDto.From(truck);

        Assert.Equal("Scania", dto.Brand);
        Assert.Equal("R 450", dto.Model);
        Assert.Equal("AB123CD", dto.Plate);
        Assert.Equal("AB 123 CD", dto.PlateDisplay);
    }

    [Fact]
    public void A_truck_without_plate_has_no_stamped_form_either()
    {
        var dto = TruckProfileDto.From(new TruckProfile { Name = "Plantilla" });

        Assert.Null(dto.Plate);
        Assert.Null(dto.PlateDisplay);
    }

    /// <remarks>
    /// Lo que el usuario escribe se normaliza al aplicar: "ab 123 cd" queda
    /// guardado como "AB123CD". La validacion de forma la hace el endpoint antes;
    /// aca se prueba que ApplyTo no guarda la forma cruda.
    /// </remarks>
    [Fact]
    public void Applying_the_request_stores_the_plate_in_canonical_form()
    {
        var request = new SaveTruckProfileRequest
        {
            Name = "El Rayo",
            Brand = "  Scania ",
            Model = "R 450",
            Plate = "ab 123 cd",
            GrossWeightKg = 30_000,
            HeightMeters = 4,
            WidthMeters = 2.6,
            LengthMeters = 16,
            NumberOfAxles = 5
        };

        var truck = new TruckProfile();
        request.ApplyTo(truck);

        Assert.Equal("Scania", truck.Brand);
        Assert.Equal("R 450", truck.Model);
        Assert.Equal("AB123CD", truck.Plate);
    }
}
