using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TruckNavigator.Domain.Users;
using TruckNavigator.Infrastructure.Identity;

namespace TruckNavigator.Infrastructure.Persistence;

/// <summary>
/// Cuenta de prueba para desarrollo, con el mail ya confirmado y el perfil
/// completo.
/// </summary>
/// <remarks>
/// <para>
/// Existe por una razon concreta: sin SMTP configurado el enlace de verificacion
/// va al log del backend, asi que darse de alta desde el telefono obliga a ir a
/// buscarlo a la consola de la maquina. Para probar la app manejando eso no
/// sirve. Con esta cuenta se entra directo.
/// </para>
/// <para>
/// <b>Solo se siembra en Development</b>, y quien la llama es el que decide el
/// entorno: esta clase no lo consulta. Una cuenta con contrasena publicada en el
/// repositorio no puede existir en un servidor real, y el arranque en Production
/// ya corta si falta SMTP, pero la barrera de verdad es que Program.cs no la
/// invoca fuera de desarrollo.
/// </para>
/// <para>
/// Es idempotente: si la cuenta ya esta, no la toca. No se le reescribe la
/// contrasena ni el perfil, para que lo que se cambie probando sobreviva al
/// siguiente arranque.
/// </para>
/// </remarks>
public static class DevUserSeed
{
    public const string Email = "demo@camiones.test";

    /// <summary>
    /// Cumple la politica: ocho caracteres o mas y al menos un digito.
    /// </summary>
    public const string Password = "camion2026";

    public const string Alias = "demo";

    public static async Task<bool> ApplyAsync(
        UserManager<AppUser> users,
        AppDbContext db,
        CancellationToken cancellationToken = default)
    {
        if (await users.FindByEmailAsync(Email) is not null)
        {
            return false;
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = Email,
            Email = Email,

            // El alta normal lo deja en false y lo confirma el enlace del mail.
            // Aca se saltea ese paso, que es todo el punto de esta cuenta.
            EmailConfirmed = true
        };

        var creation = await users.CreateAsync(user, Password);

        if (!creation.Succeeded)
        {
            var motivos = string.Join("; ", creation.Errors.Select(e => e.Description));

            throw new InvalidOperationException(
                $"No se pudo crear la cuenta de prueba {Email}: {motivos}");
        }

        // El perfil se crea solo al primer acceso, pero sin alias la app manda a
        // completar el perfil antes de dejar navegar. Se siembra completo para
        // que la cuenta entre directo al mapa.
        if (!await db.DriverProfiles.AnyAsync(p => p.Id == user.Id, cancellationToken))
        {
            var profile = new DriverProfile
            {
                Id = user.Id,
                FirstName = "Demo",
                LastName = "Camionero"
            };

            profile.SetAlias(Alias);

            db.DriverProfiles.Add(profile);
            await db.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}
