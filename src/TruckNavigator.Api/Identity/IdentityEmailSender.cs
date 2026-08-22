using System.Net;
using Microsoft.AspNetCore.Identity;
using TruckNavigator.Infrastructure.Email;
using TruckNavigator.Infrastructure.Identity;

namespace TruckNavigator.Api.Identity;

/// <summary>
/// Traduce lo que Identity necesita mandar por mail al contrato de envio propio.
/// </summary>
/// <remarks>
/// Vive en la capa web porque <see cref="IEmailSender{TUser}"/> es un contrato de
/// ASP.NET Core: adoptarlo en Infrastructure obligaria a que esa capa dependiera
/// del framework web. Aca ademas quedan los textos, que son copy que ve el
/// usuario y no infraestructura.
/// </remarks>
public sealed class IdentityEmailSender(IAppEmailSender sender) : IEmailSender<AppUser>
{
    public Task SendConfirmationLinkAsync(AppUser user, string email, string confirmationLink) =>
        sender.SendAsync(
            email,
            "Confirma tu cuenta",
            $"""
             Hola,

             Para empezar a usar el navegador confirma tu direccion de mail entrando aca:

             {PlainLink(confirmationLink)}

             Si no fuiste vos, ignora este mensaje: sin confirmar, la cuenta no se activa.
             """,
            "confirmacion de cuenta");

    public Task SendPasswordResetLinkAsync(AppUser user, string email, string resetLink) =>
        sender.SendAsync(
            email,
            "Recuperar tu contrasena",
            $"""
             Hola,

             Para elegir una contrasena nueva entra aca:

             {PlainLink(resetLink)}

             Si no pediste cambiarla, ignora este mensaje: tu contrasena actual sigue valiendo.
             """,
            "recuperacion de contrasena");

    public Task SendPasswordResetCodeAsync(AppUser user, string email, string resetCode) =>
        sender.SendAsync(
            email,
            "Codigo para recuperar tu contrasena",
            $"""
             Hola,

             Tu codigo para elegir una contrasena nueva es:

             {resetCode}

             Si no pediste cambiarla, ignora este mensaje.
             """,
            "codigo de recuperacion");

    /// <summary>
    /// Identity arma el enlace codificado para HTML, porque su mail por defecto
    /// tiene formato. Estos mensajes son texto plano: sin decodificar, el separador
    /// de parametros llegaria como "&amp;" literal y la URL no funcionaria.
    /// </summary>
    private static string PlainLink(string link) => WebUtility.HtmlDecode(link);
}
