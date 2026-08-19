namespace TruckNavigator.Infrastructure.Places;

public sealed class GeocodingOptions
{
    public const string SectionName = "Geocoding";

    /// <summary>
    /// Instancia de Photon. La publica es gratuita y esta pensada para
    /// autocompletado; para produccion conviene autohospedarla.
    /// Ver docs/data-sources.md.
    /// </summary>
    public string BaseUrl { get; set; } = "https://photon.komoot.io";

    /// <summary>
    /// Punto de sesgo: los resultados cercanos se priorizan. Por defecto, el
    /// centro de CABA.
    /// </summary>
    /// <remarks>
    /// Se usa sesgo por coordenada y NO el parametro <c>bbox</c> de Photon.
    /// El <c>bbox</c> filtra en vez de priorizar: con una caja de CABA, buscar
    /// "Unicenter" no encontraba el de Martinez y las calles de San Martin
    /// quedaban afuera. Ver AD-11 en docs/decisions.md.
    /// </remarks>
    public double BiasLatitude { get; set; } = -34.6083;
    public double BiasLongitude { get; set; } = -58.4370;

    /// <summary>
    /// Cuanto pesa la cercania al punto de sesgo, entre 0 y 1. Valores altos
    /// priorizan mas lo cercano.
    /// </summary>
    public double BiasScale { get; set; } = 0.4;

    /// <summary>
    /// Caja de recorte efectiva: se descartan los resultados de afuera. Cubre
    /// el AMBA con holgura. El grafo de ruteo abarca el pais entero, asi que
    /// esto se puede ampliar sin tocar nada mas.
    /// </summary>
    public double MinLongitude { get; set; } = -59.30;
    public double MinLatitude { get; set; } = -35.20;
    public double MaxLongitude { get; set; } = -57.90;
    public double MaxLatitude { get; set; } = -34.00;

    public int MaxResults { get; set; } = 8;

    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>
    /// Photon pide identificar al cliente. Es una cortesia con un servicio
    /// gratuito y ademas nos permite ser contactados si generamos carga.
    /// </summary>
    public string UserAgent { get; set; } = "TruckNavigator-CABA/0.1";
}
