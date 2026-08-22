using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace TruckNavigator.Infrastructure.Email;

/// <summary>
/// Envia por SMTP. Sin servidor configurado, escribe el contenido en el log.
/// </summary>
/// <remarks>
/// <para>
/// El modo sin configurar es lo que permite desarrollar y probar el alta sin
/// contratar un proveedor de mail: el enlace de verificacion aparece en la
/// consola del backend. <b>No es apto para produccion</b> —cualquiera con acceso
/// al log podria verificar cuentas ajenas— y el arranque lo advierte.
/// </para>
/// <para>
/// Usa <see cref="SmtpClient"/> del framework para no sumar dependencias al MVP.
/// Si hacen falta reintentos, adjuntos o DKIM, el reemplazo natural es MailKit y
/// se cambia solo esta clase.
/// </para>
/// </remarks>
public sealed class SmtpEmailSender(
    IOptions<EmailOptions> options,
    ILogger<SmtpEmailSender> logger) : IAppEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(
        string toAddress,
        string subject,
        string body,
        string purpose,
        CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
        {
            // El cuerpo va al log a proposito: es la unica forma de completar el
            // alta en desarrollo.
            logger.LogWarning(
                "SMTP sin configurar: no se envio ningun mail. {Purpose} para {Email}:\n{Body}",
                purpose, toAddress, body);

            return;
        }

        using var message = new MailMessage
        {
            From = new MailAddress(_options.FromAddress, _options.FromName),
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };

        message.To.Add(toAddress);

        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.UseStartTls,
            Timeout = _options.TimeoutSeconds * 1000
        };

        if (!string.IsNullOrWhiteSpace(_options.User))
        {
            client.Credentials = new NetworkCredential(_options.User, _options.Password);
        }

        try
        {
            await client.SendMailAsync(message, cancellationToken);

            logger.LogInformation("Enviado: {Purpose} a {Email}.", purpose, toAddress);
        }
        catch (SmtpException ex)
        {
            // Se registra y se propaga: si el mail no sale, el usuario tiene que
            // enterarse de que su alta quedo a medias en vez de esperar de balde.
            logger.LogError(ex, "Fallo el envio de {Purpose} a {Email}.", purpose, toAddress);
            throw;
        }
    }
}
