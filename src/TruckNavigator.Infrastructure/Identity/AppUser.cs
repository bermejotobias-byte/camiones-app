using Microsoft.AspNetCore.Identity;

namespace TruckNavigator.Infrastructure.Identity;

/// <summary>
/// La cuenta: mail, contrasena y estado de verificacion.
/// </summary>
/// <remarks>
/// <para>
/// Deliberadamente no tiene ni un campo de negocio. Todo lo que describe a la
/// persona —alias, nombre, avatar— vive en
/// <see cref="Domain.Users.DriverProfile"/>, que es dominio puro y se testea sin
/// infraestructura.
/// </para>
/// <para>
/// La division no es ceremonia: mantiene a <c>Domain</c> sin dependencias
/// externas, que es la regla estructural del proyecto. Si manana se cambia
/// Identity por otro proveedor de identidad, el perfil del camionero y sus tests
/// quedan intactos.
/// </para>
/// <para>
/// Se usa <see cref="Guid"/> como clave en lugar del <c>string</c> por defecto de
/// Identity para que coincida con el resto del modelo, donde todas las entidades
/// ya usan Guid.
/// </para>
/// </remarks>
public sealed class AppUser : IdentityUser<Guid>
{
}
