namespace TruckNavigator.Domain.Reports;

/// <summary>
/// Lo que llega del telefono al reportar: el tipo y el ultimo fix de GPS, tal
/// como lo entrego el aparato. Que se guarda de esto lo decide <see cref="Report.Create"/>.
/// </summary>
/// <param name="HeadingDegrees">Rumbo del fix, si lo traia.</param>
/// <param name="SpeedMps">Velocidad del fix en metros por segundo, si la traia.</param>
/// <param name="Street">La calle, si el cliente la sabia (en viaje, la del paso actual).</param>
/// <param name="Value">Los metros del galibo; ignorado para los tipos que no llevan valor.</param>
public sealed record NewReport(
    ReportType Type,
    double Latitude,
    double Longitude,
    double? HeadingDegrees,
    double? SpeedMps,
    string? Street,
    double? Value);
