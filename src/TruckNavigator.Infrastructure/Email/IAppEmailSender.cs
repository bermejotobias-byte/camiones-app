namespace TruckNavigator.Infrastructure.Email;

/// <summary>
/// Envio de mail transaccional.
/// </summary>
/// <remarks>
/// Es un contrato propio y no el <c>IEmailSender&lt;TUser&gt;</c> de Identity a
/// proposito: ese vive en el framework web, y adoptarlo aca obligaria a que
/// Infrastructure dependiera de ASP.NET Core. El adaptador que traduce entre
/// ambos vive en la capa web, que es donde esa dependencia ya existe.
/// </remarks>
public interface IAppEmailSender
{
    /// <param name="purpose">
    /// Para que es el mail, en dos palabras. Se usa en los logs para poder seguir
    /// un envio sin registrar el cuerpo del mensaje.
    /// </param>
    Task SendAsync(
        string toAddress,
        string subject,
        string body,
        string purpose,
        CancellationToken cancellationToken = default);
}
