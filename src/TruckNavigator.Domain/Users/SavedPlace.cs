namespace TruckNavigator.Domain.Users;

/// <summary>Los dos lugares fijos del camionero: adonde vuelve y desde donde sale.</summary>
public enum SavedPlaceKind
{
    Home = 1,
    Depot = 2
}

/// <summary>
/// Un lugar guardado del camionero: Casa o Deposito, con su direccion legible y
/// sus coordenadas.
/// </summary>
/// <remarks>
/// <para>
/// Vive en el <b>servidor</b> y no en el telefono, por lo mismo que los contactos
/// de emergencia (AD-43): un atajo que se pierde al reinstalar la app, o al
/// cambiar de equipo, es un atajo que no esta el dia que se necesita, y nadie
/// se entera hasta ese dia.
/// </para>
/// <para>
/// Hay <b>uno por tipo</b>: guardar Casa de nuevo reemplaza a la anterior. El
/// indice unico sobre (dueno, tipo) es la garantia; el endpoint solo decide si
/// crea o pisa.
/// </para>
/// </remarks>
public sealed class SavedPlace
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>La cuenta a la que pertenece. Sin dueno no existe.</summary>
    public Guid OwnerId { get; set; }

    public SavedPlaceKind Kind { get; set; }

    /// <summary>La direccion como la ve el camionero, ya recortada.</summary>
    public string Label { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public DateTimeOffset SavedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Lo que hace falta para guardar un lugar: un nombre y un punto plausible.</summary>
public static class SavedPlaceRules
{
    /// <summary>El mismo tope que el rotulo del destino de un viaje.</summary>
    public const int MaxLabelLength = 300;

    public sealed record Result(bool IsValid, string? Label, string? Error);

    public static Result Validate(string? label, double latitude, double longitude)
    {
        var clean = (label ?? string.Empty).Trim();

        if (clean.Length == 0)
        {
            return new Result(false, null, "El lugar necesita un nombre o una direccion.");
        }

        if (clean.Length > MaxLabelLength)
        {
            return new Result(false, null, $"El nombre no puede pasar de {MaxLabelLength} caracteres.");
        }

        if (double.IsNaN(latitude) || double.IsNaN(longitude) || Math.Abs(latitude) > 90 || Math.Abs(longitude) > 180)
        {
            return new Result(false, null, "Las coordenadas no son un punto del mapa.");
        }

        return new Result(true, clean, null);
    }
}
