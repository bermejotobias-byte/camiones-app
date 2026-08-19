namespace TruckNavigator.Infrastructure.Routing;

public sealed class GraphHopperOptions
{
    public const string SectionName = "GraphHopper";

    public string BaseUrl { get; set; } = "http://localhost:8989";

    /// <summary>Nombre del perfil definido en routing/config-truck.yml.</summary>
    public string Profile { get; set; } = "truck";

    public int TimeoutSeconds { get; set; } = 60;
}
