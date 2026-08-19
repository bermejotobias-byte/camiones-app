using System.Net.Sockets;

namespace TruckNavigator.IntegrationTests;

/// <summary>
/// Marca un test que necesita el servidor GraphHopper corriendo. Si no esta
/// disponible el test se saltea en vez de fallar, para que la suite siga siendo
/// util en una maquina sin el motor levantado.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class GraphHopperFactAttribute : FactAttribute
{
    private static readonly Lazy<bool> IsAvailable = new(() =>
    {
        try
        {
            using var client = new TcpClient();
            return client.ConnectAsync("localhost", 8989).Wait(TimeSpan.FromSeconds(3))
                   && client.Connected;
        }
        catch (Exception)
        {
            return false;
        }
    });

    public GraphHopperFactAttribute()
    {
        if (!IsAvailable.Value)
        {
            Skip = "GraphHopper no responde en localhost:8989. " +
                   "Levantalo con routing/run-graphhopper.ps1.";
        }
    }
}
