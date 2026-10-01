namespace TruckNavigator.Domain.Reports;

/// <summary>
/// Que tan confiable es un camionero como fuente de reportes, de 0 a 100.
/// </summary>
/// <remarks>
/// <para>
/// Es una cosa distinta de la EXP, por decision del usuario del 19/09/2026: la EXP
/// es de la gamificacion y mide esfuerzo; esto mide credibilidad y pondera la
/// confiabilidad de lo que la persona reporta. No se muestra como numero: se ve
/// en la etiqueta de sus reportes.
/// </para>
/// <para>
/// Sin fila, la reputacion es <see cref="ReputationScale.Start"/>: no hace falta
/// sembrar una por camionero.
/// </para>
/// </remarks>
public sealed class DriverReputation
{
    public Guid DriverId { get; set; }

    public int Score { get; set; } = ReputationScale.Start;

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// Como se mueve la reputacion: solo por lo que la comunidad dice de tus reportes.
/// </summary>
/// <remarks>
/// Votar no la toca (extension posible, fuera de esta version). Sube poco y baja
/// mas, para que hagan falta varios aciertos por cada reporte falso.
/// </remarks>
public static class ReputationScale
{
    public const int Start = 50;
    public const int Min = 0;
    public const int Max = 100;

    /// <summary>La primera vez que un reporte tuyo queda validado.</summary>
    public const int OnValidated = 3;

    /// <summary>Cuando la comunidad rechaza uno tuyo.</summary>
    public const int OnRejected = -5;

    public static int Apply(int score, int delta) => Math.Clamp(score + delta, Min, Max);
}
