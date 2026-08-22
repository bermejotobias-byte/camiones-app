namespace TruckNavigator.Domain.Users;

/// <summary>
/// El camionero como persona: como se llama, como se lo ve y como se lo nombra en
/// la comunidad.
/// </summary>
/// <remarks>
/// <para>
/// Esta separado de las credenciales a proposito. El mail, la contrasena y la
/// verificacion son responsabilidad de ASP.NET Core Identity y viven en
/// Infrastructure; lo que hay aca es dominio puro y se puede testear sin base de
/// datos ni HTTP, igual que el motor de restricciones.
/// </para>
/// <para>
/// <see cref="Id"/> es el mismo identificador que el del usuario de Identity. La
/// relacion es uno a uno y el perfil no existe sin su cuenta.
/// </para>
/// <para>
/// Nombre, apellido y avatar son opcionales porque el flujo de alta permite
/// saltear ese paso: el usuario queda operativo apenas verifica el mail, y
/// completa el perfil cuando quiere.
/// </para>
/// </remarks>
public sealed class DriverProfile
{
    public Guid Id { get; set; }

    /// <summary>Alias tal como lo escribio el usuario. Es lo que se muestra.</summary>
    public string? Alias { get; private set; }

    /// <summary>
    /// Forma canonica del alias. Existe para que el indice unico compare sin
    /// distinguir mayusculas. No se muestra nunca.
    /// </summary>
    public string? NormalizedAlias { get; private set; }

    public string? FirstName { get; set; }

    public string? LastName { get; set; }

    /// <summary>
    /// Avatar elegido, del catalogo de la app. Es un identificador y no una URL:
    /// las imagenes las resuelve el cliente, asi que cambiarlas no toca la base.
    /// </summary>
    public string? AvatarId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Si el usuario termino de cargar sus datos. Sirve para saber si conviene
    /// ofrecerle completar el perfil, no para bloquearle nada.
    /// </summary>
    public bool IsComplete =>
        !string.IsNullOrWhiteSpace(Alias)
        && !string.IsNullOrWhiteSpace(FirstName)
        && !string.IsNullOrWhiteSpace(LastName);

    /// <summary>
    /// Asigna el alias validando el formato. La unicidad no se puede resolver aca
    /// —depende de las demas cuentas— y la garantiza el indice unico de la base.
    /// </summary>
    /// <exception cref="ArgumentException">Si el alias no cumple el formato.</exception>
    public void SetAlias(string alias)
    {
        var validation = DriverAlias.Validate(alias);

        if (!validation.IsValid)
        {
            throw new ArgumentException(validation.Error, nameof(alias));
        }

        Alias = validation.Value;
        NormalizedAlias = DriverAlias.Normalize(validation.Value!);
    }
}
