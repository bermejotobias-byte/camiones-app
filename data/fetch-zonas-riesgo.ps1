<#
.SYNOPSIS
    Genera la capa de zonas de riesgo de CABA desde el Mapa del Delito oficial.

.DESCRIPTION
    Fuente: dataset "Delitos" de Buenos Aires Data, publicado por el Ministerio
    de Justicia y Seguridad del GCBA. Licencia CC-BY. Un archivo por anio, con
    latitud y longitud por hecho. El de 2025 trae 133.203 registros.

    QUE SE CUENTA: ROBOS A MANO ARMADA, NO CANTIDAD DE ROBOS

    Esta es la decision central del archivo y reemplaza a la anterior, que
    contaba todos los robos por igual. Contar cantidad mide EXPOSICION —cuanta
    gente pasa por ahi— y no peligro, y el resultado se lee al reves de la
    realidad. Medido en 2025, en un radio de 500 m:

        Villa 21-24 (Barracas)   336 hechos   121 con arma   36,0%
        Villa 1-11-14 (Flores)   559 hechos    69 con arma   12,3%
        Villa Soldati             66 hechos    28 con arma   42,4%
        Palermo (Plaza Serrano)  446 hechos    26 con arma    5,8%
        Palermo (Av. Santa Fe)   425 hechos    18 con arma    4,2%

    Por cantidad, Palermo encabeza la Ciudad y Villa Soldati aparece como la zona
    MAS SEGURA del cuadro. Por robos con arma el orden se da vuelta y coincide con
    lo que cualquiera que maneje por la Ciudad sabe. En Villa Soldati uno de cada
    tres robos es a mano armada; en Palermo, uno de cada dieciseis.

    Para un camionero la diferencia no es academica: un arrebato de celular en una
    esquina concurrida no le cambia la ruta, y un asalto armado si.

    Se cuentan los 5.551 robos con `uso_arma = SI`. Sin ponderaciones inventadas:
    un hecho con arma cuenta, uno sin arma no. El criterio es nitido y se puede
    discutir mirando el numero.

    Los robos armados ademas son mas nocturnos que el resto —33,5% entre las 22 y
    las 6, contra 24,5% del total—, que es justo cuando un camion queda parado.

    QUE EMITE EL ARCHIVO

    Dos clases de objeto, distinguidas por la propiedad `t`:

      t = "h"   los 5.551 hechos, uno por punto, sin agregar. Son los que
                alimentan el mapa de calor. Van crudos y no en grilla porque una
                capa `heatmap` normaliza por densidad de PUNTOS: alimentada con
                una grilla regular redibuja la grilla en forma de lunares
                alineados, sin importar el radio. Ver AD-36.
      t = "f"   los focos: celdas de 300 m que al menos duplican la densidad
                media de robos armados de la Ciudad. No se dibujan — son las que
                contestan al tocar el mapa y las que llevan el triangulo.

    LO QUE ESTE DATO NO DICE

    - Son hechos DENUNCIADOS, y la propension a denunciar no es igual en toda la
      Ciudad. En los barrios mas precarios se denuncia menos, asi que el mapa
      SUBESTIMA justamente las zonas mas duras. Villa Soldati registra 66 hechos
      en 500 m contra 446 de Palermo: eso no es que sea mas tranquila, es que ahi
      no se denuncia. La proporcion armada (42% contra 6%) es lo que sobrevive a
      ese sesgo, y es la razon de usarla.
    - Que no haya calor NO significa que ahi no pase nada.
    - Solo CABA: el dataset es del Gobierno de la Ciudad y no cubre el conurbano.

.PARAMETER Anio
    Anio del dataset. 2025 es el ultimo completo publicado.

.PARAMETER LadoMetros
    Lado de la celda de los focos. Con 300 m la media es 2,45 hechos por celda;
    achicarla mas deja conteos de uno o dos, donde el ruido manda.

.EXAMPLE
    .\data\fetch-zonas-riesgo.ps1
#>
[CmdletBinding()]
param(
    [int] $Anio = 2025,
    [int] $LadoMetros = 300,
    [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot viene vacio adentro del bloque param(): una ruta relativa con
# '..' se anclaria en la raiz del disco y el script escribiria en C:\src\...
# informando exito. Se calcula aca, con $PSCommandPath.
$scriptFolder = Split-Path -Parent $PSCommandPath

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $scriptFolder '..\src\TruckNavigator.Api\wwwroot\data'
}

$OutputDirectory = (Resolve-Path $OutputDirectory).Path

# Superficie de CABA: 203,99 km2, que es la suma de los 48 barrios del dataset
# oficial "Barrios" de Buenos Aires Data. Se deja como constante en vez de bajar
# ese archivo cada vez —un limite administrativo no cambia— pero se anota de
# donde salio para que sea verificable y no un numero de memoria.
$superficieCaba = 203.99

$url = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-justicia-y-seguridad/delitos/delitos_$Anio.csv"
$temporal = Join-Path ([System.IO.Path]::GetTempPath()) "delitos_$Anio.csv"

if (-not (Test-Path $temporal)) {
    Write-Host "Descargando el Mapa del Delito $Anio ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $temporal -UseBasicParsing -TimeoutSec 600
}
else {
    Write-Host "Reusando la descarga previa: $temporal" -ForegroundColor DarkGray
}

# Este CSV SI viene en UTF-8 —a diferencia del de camaras de control vehicular,
# que viene en Latin-1— y separado por comas. Se verifico que ningun campo trae
# comas adentro: las 133.204 lineas parten en exactamente 15 campos. Por eso
# alcanza con un split manual, que sobre 133 mil filas es varios ordenes de
# magnitud mas rapido que ConvertFrom-Csv.
$lineas = [System.IO.File]::ReadAllLines($temporal, [System.Text.Encoding]::UTF8)

$encabezado = $lineas[0].Split(',') | ForEach-Object { $_.Trim('"') }
$col = @{}
for ($i = 0; $i -lt $encabezado.Count; $i++) { $col[$encabezado[$i]] = $i }

foreach ($obligatoria in 'tipo', 'subtipo', 'latitud', 'longitud', 'barrio', 'franja', 'uso_arma') {
    if (-not $col.ContainsKey($obligatoria)) {
        throw "El dataset no trae la columna '$obligatoria'. Cambio el formato: revisar la fuente antes de seguir."
    }
}

# Proyeccion plana local. A la latitud de Buenos Aires y sobre 200 km2 el error
# es de centimetros: no hace falta nada mas caro para agrupar en celdas.
$metrosPorGradoLat = 110574.0
$metrosPorGradoLng = 111320.0 * [math]::Cos(-34.61 * [math]::PI / 180.0)

$hechos = New-Object System.Collections.ArrayList
$celdas = @{}
$robosTotales = 0
$sinCoordenada = 0

foreach ($linea in $lineas[1..($lineas.Count - 1)]) {
    if ([string]::IsNullOrWhiteSpace($linea)) { continue }

    $f = $linea.Split(',')
    $tipo = $f[$col['tipo']].Trim('"')
    $subtipo = $f[$col['subtipo']].Trim('"')

    # Robo (cualquier subtipo) mas el hurto de vehiculos.
    if (-not ($tipo -eq 'Robo' -or $subtipo -like '*automotor*')) { continue }

    $lat = 0.0; $lng = 0.0
    $okLat = [double]::TryParse($f[$col['latitud']].Trim('"'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref] $lat)
    $okLng = [double]::TryParse($f[$col['longitud']].Trim('"'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref] $lng)

    if (-not $okLat -or -not $okLng -or $lat -eq 0 -or $lng -eq 0) { $sinCoordenada++; continue }

    # Control de cordura. Si un punto cae fuera de la Ciudad, algo se leyo mal.
    if ($lat -lt -34.75 -or $lat -gt -34.50 -or $lng -lt -58.56 -or $lng -gt -58.32) {
        $sinCoordenada++; continue
    }

    $robosTotales++

    # A partir de aca, SOLO los que llevaron arma. Ver el encabezado.
    if ($f[$col['uso_arma']].Trim('"') -ne 'SI') { continue }

    # Cinco decimales son ~1,1 m: mas precision de la que tiene el dato y mucha
    # mas de la que necesita un mapa de calor. Sobre 5.500 puntos, el redondeo
    # decide buena parte del peso del archivo.
    [void] $hechos.Add(@(
        [math]::Round($lng, 5),
        [math]::Round($lat, 5)
    ))

    $cx = [math]::Floor($lng * $metrosPorGradoLng / $LadoMetros)
    $cy = [math]::Floor($lat * $metrosPorGradoLat / $LadoMetros)
    $clave = "$cx|$cy"

    if (-not $celdas.ContainsKey($clave)) {
        $celdas[$clave] = [pscustomobject] @{
            cx = $cx; cy = $cy; armados = 0; noche = 0; barrios = @{}
        }
    }

    $celda = $celdas[$clave]
    $celda.armados++

    # Franja horaria: el dataset la da como hora entera 0..23. Se cuenta como
    # nocturno de 22 a 5 inclusive, que es cuando el camion suele estar parado.
    $franja = -1
    [void] [int]::TryParse($f[$col['franja']].Trim('"'), [ref] $franja)
    if ($franja -ge 22 -or ($franja -ge 0 -and $franja -le 5)) { $celda.noche++ }

    $barrio = $f[$col['barrio']].Trim('"')
    if ($barrio) { $celda.barrios[$barrio] = 1 + $celda.barrios[$barrio] }
}

$areaCelda = [math]::Pow($LadoMetros / 1000.0, 2)
$densidadMedia = $hechos.Count / $superficieCaba
$mediaPorCelda = $densidadMedia * $areaCelda

Write-Host ""
Write-Host "Robos y hurtos de vehiculos ubicados: $robosTotales" -ForegroundColor DarkGray
Write-Host ("  de esos, A MANO ARMADA:          {0}  ({1:N1}%)" -f $hechos.Count, ($hechos.Count / $robosTotales * 100)) -ForegroundColor Yellow
Write-Host "  sin coordenada utilizable:       $sinCoordenada" -ForegroundColor DarkYellow
Write-Host ("  densidad media de CABA:          {0:N1} armados/km2 = {1:N2} por celda de {2} m" -f $densidadMedia, $mediaPorCelda, $LadoMetros) -ForegroundColor DarkGray
Write-Host "  celdas con al menos un armado:   $($celdas.Count)" -ForegroundColor DarkGray

# Los cortes, en multiplos de la media. Expresarlos asi —y no en cuantiles— es lo
# que hace que la leyenda se explique sola: "el triple que el promedio de la
# Ciudad" se entiende sin saber estadistica.
$corteAlta    = $mediaPorCelda * 2
$corteMuyAlta = $mediaPorCelda * 3
$corteExtrema = $mediaPorCelda * 5

$features = New-Object System.Collections.ArrayList

# Los hechos crudos van en UN SOLO objeto MultiPoint, no en 5.551 features.
#
# MapLibre expande un MultiPoint y el mapa de calor cuenta cada punto por
# separado, que es exactamente lo que hace falta. La diferencia es de peso: cada
# Feature arrastra su `type`, su `properties` y su `geometry`, y esa envoltura
# pesa mas que la coordenada que contiene — 636 KB contra unos 90.
[void] $features.Add([ordered] @{
    type       = 'Feature'
    properties = [ordered] @{ t = 'h' }
    geometry   = [ordered] @{ type = 'MultiPoint'; coordinates = $hechos }
})

$porNivel = @{ alta = 0; 'muy-alta' = 0; extrema = 0 }

foreach ($celda in $celdas.Values) {
    if ($celda.armados -lt $corteAlta) { continue }

    $nivel = if ($celda.armados -ge $corteExtrema) { 'extrema' }
             elseif ($celda.armados -ge $corteMuyAlta) { 'muy-alta' }
             else { 'alta' }

    $porNivel[$nivel]++

    $centroLng = [math]::Round(($celda.cx + 0.5) * $LadoMetros / $metrosPorGradoLng, 5)
    $centroLat = [math]::Round(($celda.cy + 0.5) * $LadoMetros / $metrosPorGradoLat, 5)

    $barrio = ($celda.barrios.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key

    [void] $features.Add([ordered] @{
        type       = 'Feature'
        properties = [ordered] @{
            t       = 'f'
            nivel   = $nivel
            armados = $celda.armados
            veces   = [math]::Round($celda.armados / $mediaPorCelda, 1)
            noche   = $celda.noche
            barrio  = $barrio
            # El anio se repite en cada foco aunque ya este en la cabecera del
            # documento. La app arma el texto del toque con las propiedades de la
            # feature, y sin esto tendria el anio escrito en el codigo, que es
            # como se termina mostrando una fecha vieja durante meses.
            anio    = $Anio
        }
        geometry   = [ordered] @{ type = 'Point'; coordinates = @($centroLng, $centroLat) }
    })
}

$documento = [ordered] @{
    type        = 'FeatureCollection'
    name        = 'zonas-riesgo'
    description = "Robos a mano armada denunciados en $Anio. Los objetos con t='h' son los hechos, uno por punto, y alimentan el mapa de calor; los que tienen t='f' son focos agregados en celdas de $LadoMetros m que al menos duplican la densidad media de la Ciudad. Se cuentan robos CON ARMA y no cantidad de robos: la cantidad mide cuanta gente circula, no peligro."
    attribution = "Buenos Aires Data - Mapa del Delito $Anio (CC-BY), Ministerio de Justicia y Seguridad del GCBA"
    source      = 'https://data.buenosaires.gob.ar/dataset/delitos'
    anio        = $Anio
    ladoMetros  = $LadoMetros
    # Se guardan los numeros con los que se armo la escala: sin ellos las
    # propiedades "veces" y "nivel" no se pueden auditar ni reproducir.
    baseline    = [ordered] @{
        robosTotales     = $robosTotales
        armados          = $hechos.Count
        sinCoordenada    = $sinCoordenada
        superficieKm2    = $superficieCaba
        densidadMediaKm2 = [math]::Round($densidadMedia, 1)
        mediaPorCelda    = [math]::Round($mediaPorCelda, 2)
    }
    generatedOn = (Get-Date).ToString('yyyy-MM-dd')
    features    = $features
}

$destino = Join-Path $OutputDirectory 'zonas-riesgo.geojson'
$documento | ConvertTo-Json -Depth 10 -Compress | Set-Content -Path $destino -Encoding UTF8

$peso = [math]::Round((Get-Item $destino).Length / 1KB, 1)
$focos = $porNivel['alta'] + $porNivel['muy-alta'] + $porNivel['extrema']

Write-Host ""
Write-Host ("Zonas de riesgo -> {0} ({1} KB)" -f $destino, $peso) -ForegroundColor Green
Write-Host ("  hechos para el mapa de calor: {0}" -f $hechos.Count) -ForegroundColor DarkGray
Write-Host ("  focos consultables:           {0}" -f $focos) -ForegroundColor DarkGray
Write-Host ("     alta (x2 a x3):      {0,4}   desde {1:N0} armados" -f $porNivel['alta'], [math]::Ceiling($corteAlta)) -ForegroundColor DarkGray
Write-Host ("     muy alta (x3 a x5):  {0,4}   desde {1:N0} armados" -f $porNivel['muy-alta'], [math]::Ceiling($corteMuyAlta)) -ForegroundColor DarkGray
Write-Host ("     extrema (x5 o mas):  {0,4}   desde {1:N0} armados" -f $porNivel['extrema'], [math]::Ceiling($corteExtrema)) -ForegroundColor DarkGray
