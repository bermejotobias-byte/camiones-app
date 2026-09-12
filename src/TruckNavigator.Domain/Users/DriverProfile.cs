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

    /// <summary>
    /// Nacionalidad del camionero, como codigo de pais de dos letras.
    /// </summary>
    /// <remarks>
    /// Se guarda el codigo y no el nombre: el nombre depende del idioma en que se
    /// muestre, y la app va a tener varios. La bandera y el texto los resuelve el
    /// cliente, igual que con el avatar.
    /// </remarks>
    public string? Nationality { get; set; }

    /// <summary>
    /// El camion que el camionero exhibe en su perfil.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Vive en el servidor y no en el telefono <b>porque el perfil lo ven otros
    /// usuarios</b>: una seleccion guardada en el aparato no se le puede mostrar a
    /// nadie mas.
    /// </para>
    /// <para>
    /// Borrar el camion deja esto en null y <b>no toca el perfil</b>. Es el mismo
    /// criterio que ya rige los viajes: perder un vehiculo no puede costarle a la
    /// persona su identidad ni su historial.
    /// </para>
    /// </remarks>
    public Guid? ActiveTruckId { get; set; }

    /// <summary>
    /// Fecha de nacimiento. Dato del carnet.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Es sensible y solo la ve el dueño.</b> Decision del usuario del
    /// 11/09/2026: el perfil es publico, la fecha no. La restriccion vive en el
    /// contrato de la API —el DTO que reciben terceros la omite—, no aca.
    /// </para>
    /// <para>
    /// <see cref="Domain.Users.BirthDate"/> decide que fechas son plausibles. Es
    /// <c>DateOnly</c> y no <c>DateTimeOffset</c>: un cumpleaños no tiene hora ni
    /// huso, y guardarlo con hora es la forma clasica de que se corra un dia.
    /// </para>
    /// </remarks>
    public DateOnly? BirthDate { get; set; }

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
