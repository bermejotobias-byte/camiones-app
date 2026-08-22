namespace TruckNavigator.Infrastructure.Email;

/// <summary>
/// Configuracion del envio de mail, usada para verificar la cuenta y para
/// recuperar la contrasena.
/// </summary>
/// <remarks>
/// Si <see cref="Host"/> queda vacio, la aplicacion <b>no envia mails</b> y
/// escribe los enlaces en el log. Es el modo de desarrollo, y esta pensado asi a
/// proposito: sin credenciales SMTP no hay forma de mandar un mail, y simular que
/// se mando dejaria al usuario esperando algo que nunca llega.
/// </remarks>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    /// <summary>Servidor SMTP. Vacio significa modo desarrollo: se loguea, no se envia.</summary>
    public string Host { get; set; } = string.Empty;

    public int Port { get; set; } = 587;

    public bool UseStartTls { get; set; } = true;

    public string User { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string FromAddress { get; set; } = "no-responder@trucknavigator.local";

    public string FromName { get; set; } = "Navegador de Transito Pesado";

    public int TimeoutSeconds { get; set; } = 20;

    /// <summary>Si hay servidor configurado y por lo tanto se pueden enviar mails.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host);
}
