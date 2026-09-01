using TruckNavigator.Mobile.Services;

namespace TruckNavigator.UnitTests;

/// <summary>
/// La politica de reintentos de la conexion inicial.
/// </summary>
/// <remarks>
/// Estos tests existen por un defecto medido: la app hacia <b>un solo intento</b>
/// al arrancar, fallaba al abrirla y a la segunda andaba. Al abrir la app la red
/// del telefono suele no estar lista todavia —la WiFi reconecta al salir de
/// suspension— y ese unico intento agarraba el hueco.
///
/// Lo que se prueba no es que reintente: es que los tiempos sigan siendo
/// razonables. Un reintento demasiado corto no le da lugar a la red a levantar y
/// no arregla nada; uno demasiado largo deja al usuario mirando un cartel hasta
/// que la app parece colgada. Son las dos formas de romper esto sin darse cuenta.
/// </remarks>
public class ConnectionRetryTests
{
    /// <summary>Peor caso: los tres intentos agotan su espera y nadie contesta.</summary>
    private static TimeSpan PeorCaso()
    {
        var total = TimeSpan.Zero;

        for (var intento = 1; intento <= ConnectionRetry.MaxAttempts; intento++)
        {
            total += ConnectionRetry.DelayBefore(intento) + ConnectionRetry.TimeoutFor(intento);
        }

        return total;
    }

    /* ----------------------------------------------------------------------
       Que reintente, que es el defecto que motivo todo esto
    ---------------------------------------------------------------------- */

    [Fact]
    public void Reintenta_mas_de_una_vez()
    {
        // Con un solo intento volveriamos exactamente al defecto original.
        Assert.True(ConnectionRetry.MaxAttempts > 1,
            "un solo intento es el defecto que esto vino a arreglar");
    }

    [Fact]
    public void El_primer_intento_sale_sin_esperar()
    {
        // Con la red sana el backend contesta en milisegundos. Meter una demora
        // aca seria castigar el caso normal para cubrir el excepcional.
        Assert.Equal(TimeSpan.Zero, ConnectionRetry.DelayBefore(1));
    }

    [Fact]
    public void Cada_reintento_espera_mas_que_el_anterior()
    {
        for (var intento = 2; intento <= ConnectionRetry.MaxAttempts; intento++)
        {
            Assert.True(
                ConnectionRetry.DelayBefore(intento) > ConnectionRetry.DelayBefore(intento - 1),
                $"el intento {intento} no espera mas que el {intento - 1}: sin backoff, " +
                "los tres intentos caen dentro del mismo hueco de red y valen por uno");
        }
    }

    /* ----------------------------------------------------------------------
       Que las esperas sirvan de algo, y que no se vayan de las manos
    ---------------------------------------------------------------------- */

    [Fact]
    public void Le_da_a_la_red_al_menos_tres_segundos_para_levantar()
    {
        var esperaAcumulada = TimeSpan.Zero;

        for (var intento = 1; intento <= ConnectionRetry.MaxAttempts; intento++)
        {
            esperaAcumulada += ConnectionRetry.DelayBefore(intento);
        }

        // Si el ultimo intento sale casi pegado al primero, la red no tuvo tiempo
        // de terminar de conectar y el reintento no arregla el caso real.
        Assert.True(esperaAcumulada >= TimeSpan.FromSeconds(3),
            $"entre el primer intento y el ultimo pasan apenas {esperaAcumulada.TotalSeconds:N1} s");
    }

    [Fact]
    public void El_peor_caso_no_pasa_de_treinta_segundos()
    {
        // Con el servidor apagado se agotan los tres intentos. Pasado ese rato la
        // app parece colgada aunque el cartel diga lo que esta haciendo, y lo que
        // el usuario necesita es llegar a la pantalla de configurar servidor.
        Assert.True(PeorCaso() <= TimeSpan.FromSeconds(30),
            $"el peor caso son {PeorCaso().TotalSeconds:N1} s de espera antes de poder tocar nada");
    }

    [Fact]
    public void El_primer_intento_no_se_cuelga_esperando()
    {
        // Corto a proposito: con la red sana la respuesta es inmediata, asi que
        // si no llego, conviene volver a intentar antes que seguir esperando.
        Assert.True(ConnectionRetry.TimeoutFor(1) <= TimeSpan.FromSeconds(5),
            "el primer intento espera de mas y retrasa el primer reintento");
    }

    [Fact]
    public void Los_reintentos_esperan_mas_que_el_primero()
    {
        // Le dan lugar a un backend lento de verdad: un tunel Cloudflare recien
        // levantado tarda varios segundos en la primera respuesta.
        Assert.True(ConnectionRetry.TimeoutFor(2) > ConnectionRetry.TimeoutFor(1));
    }

    [Fact]
    public void Ningun_intento_hereda_el_timeout_largo_del_cliente_http()
    {
        // El HttpClient esta dimensionado para calcular rutas. Heredar aquel
        // timeout dejaba la app casi dos minutos en "Conectando…" antes de
        // admitir que no llegaba al servidor. Ver AD-33.
        for (var intento = 1; intento <= ConnectionRetry.MaxAttempts; intento++)
        {
            Assert.True(ConnectionRetry.TimeoutFor(intento) <= TimeSpan.FromSeconds(10),
                $"el intento {intento} espera {ConnectionRetry.TimeoutFor(intento).TotalSeconds:N0} s");
        }
    }

    /* ----------------------------------------------------------------------
       Cuando conviene insistir y cuando no

       Es la parte que puede fallar sin que se note: reintentar de mas no
       "rompe" nada, solo hace esperar veinte segundos para dar un error que ya
       se sabia desde el primer intento.
    ---------------------------------------------------------------------- */

    [Fact]
    public void Si_contesto_no_se_reintenta()
    {
        Assert.False(ConnectionRetry.ShouldRetry(1, reachable: true, retriable: false));
        Assert.False(ConnectionRetry.ShouldRetry(1, reachable: true, retriable: true));
    }

    [Fact]
    public void Una_falla_que_no_se_va_a_arreglar_sola_no_se_reintenta()
    {
        // Una direccion mal escrita falla igual las tres veces.
        Assert.False(ConnectionRetry.ShouldRetry(1, reachable: false, retriable: false));
    }

    [Fact]
    public void Una_falla_de_red_se_reintenta_hasta_agotar_los_intentos()
    {
        for (var intento = 1; intento < ConnectionRetry.MaxAttempts; intento++)
        {
            Assert.True(ConnectionRetry.ShouldRetry(intento, reachable: false, retriable: true),
                $"deberia reintentar despues del intento {intento}");
        }
    }

    [Fact]
    public void No_reintenta_despues_del_ultimo()
    {
        // Sin esto el bucle daria una vuelta de mas, o peor, no terminaria.
        Assert.False(
            ConnectionRetry.ShouldRetry(ConnectionRetry.MaxAttempts, reachable: false, retriable: true));
    }

    /* ----------------------------------------------------------------------
       Lo que ve el usuario mientras espera
    ---------------------------------------------------------------------- */

    [Fact]
    public void El_primer_intento_no_anuncia_reintentos()
    {
        // En el caso normal dura milisegundos: anunciar "1 de 3" solo sembraria
        // la duda de que algo anda mal.
        var texto = ConnectionRetry.Describe(1, "http://192.168.1.5:5080");

        Assert.Contains("192.168.1.5:5080", texto);
        Assert.DoesNotContain("1 de", texto);
    }

    [Fact]
    public void Al_reintentar_se_dice_que_se_esta_reintentando()
    {
        // Una espera silenciosa no se distingue de una app colgada.
        var texto = ConnectionRetry.Describe(2, "http://192.168.1.5:5080");

        Assert.Contains("2", texto);
        Assert.Contains(ConnectionRetry.MaxAttempts.ToString(), texto);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Siempre_dice_algo(int intento)
    {
        Assert.False(string.IsNullOrWhiteSpace(ConnectionRetry.Describe(intento, "http://x:1")),
            "un intento sin mensaje deja la pantalla anterior, que dice otra cosa");
    }
}
