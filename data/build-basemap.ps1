<#
.SYNOPSIS
    Genera el mapa base vectorial del AMBA en formato PMTiles.

.DESCRIPTION
    Extrae la region del build diario del planeta que publica Protomaps y deja
    routing/amba.pmtiles, que la API sirve bajo /tiles.

    Reemplaza a los tiles raster de OpenStreetMap y resuelve tres cosas de una
    vez: el mapa minimalista, el modo dia y noche del fondo, y la limitacion L-4
    —la politica de uso de tile.openstreetmap.org desaconseja el consumo desde
    aplicaciones, asi que con raster la app no se podia distribuir—.

    Por que un extract y no generar los tiles con Planetiler desde el .pbf que ya
    tenemos: Planetiler necesita ademas descargar Natural Earth y los poligonos
    de agua, casi 900 MB, y unos 4 GB de memoria para procesar. El extract baja
    SOLO los rangos de bytes de la region —56 MB en unos veinte segundos— porque
    PMTiles es direccionable por rango. Para una ciudad no hay comparacion.

    El archivo NO se versiona: pesa decenas de megas y se regenera con este
    script, igual que el extract de OSM y el grafo de GraphHopper.

    Tampoco viaja adentro del APK. Se sirve desde fuera de wwwroot a proposito:
    empaquetarlo triplicaria el instalador para algo que igual necesita red,
    porque sin servidor tampoco hay ruteo.

.PARAMETER Build
    Fecha del build de Protomaps, en formato aaaammdd. Por defecto busca el mas
    reciente disponible hacia atras desde ayer.

.PARAMETER MaxZoom
    Zoom maximo. 15 alcanza para navegar; cada nivel mas multiplica el tamano.

.PARAMETER Bounds
    Region a extraer. Por defecto el AMBA, el mismo rectangulo con el que se
    recorta el grafo de ruteo y se acotan los resultados del geocoder — que
    coincidan garantiza que todo lo que se puede buscar se puede ver y rutear.

.EXAMPLE
    ./data/build-basemap.ps1
#>
[CmdletBinding()]
param(
    [string] $Build,
    [int] $MaxZoom = 15,
    [string] $Bounds = '-59.30,-35.20,-57.90,-34.00',
    [string] $Output
)

$ErrorActionPreference = 'Stop'

# La ruta se arma aca y no en param(): ahi $PSScriptRoot puede venir vacio y la
# ruta relativa se ancla en la raiz del disco, con el script informando exito.
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$toolsDirectory = Join-Path $root 'routing\tools'
$pmtiles = Join-Path $toolsDirectory 'pmtiles.exe'

if (-not $Output) {
    $Output = Join-Path $root 'routing\amba.pmtiles'
}

# ------------------------------------------------------------ herramienta

if (-not (Test-Path $pmtiles)) {
    Write-Host 'Descargando la herramienta pmtiles ...' -ForegroundColor Cyan

    if (-not (Test-Path $toolsDirectory)) {
        New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null
    }

    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/protomaps/go-pmtiles/releases/latest' `
        -Headers @{ 'User-Agent' = 'TruckNavigator-CABA' }

    $asset = $release.assets | Where-Object { $_.name -like '*Windows_x86_64.zip' } | Select-Object -First 1

    if (-not $asset) {
        throw 'No se encontro el binario de pmtiles para Windows en el ultimo release.'
    }

    $zip = Join-Path $toolsDirectory 'pmtiles.zip'
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $toolsDirectory -Force
    Remove-Item $zip -Force
}

# ------------------------------------------------------------------ build

function Test-Build {
    param([string] $Date)

    try {
        $response = Invoke-WebRequest -Uri "https://build.protomaps.com/$Date.pmtiles" `
            -Method Head -TimeoutSec 30
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

if (-not $Build) {
    Write-Host 'Buscando el build mas reciente de Protomaps ...' -ForegroundColor Cyan

    # Se arranca en ayer: el de hoy puede no estar publicado todavia.
    for ($back = 1; $back -le 10; $back++) {
        $candidate = (Get-Date).AddDays(-$back).ToString('yyyyMMdd')

        if (Test-Build $candidate) {
            $Build = $candidate
            break
        }
    }

    if (-not $Build) {
        throw 'No se encontro ningun build de Protomaps en los ultimos 10 dias.'
    }
}

Write-Host "Build: $Build" -ForegroundColor DarkGray
Write-Host "Region: $Bounds   zoom maximo: $MaxZoom" -ForegroundColor DarkGray
Write-Host ''

& $pmtiles extract "https://build.protomaps.com/$Build.pmtiles" $Output `
    --bbox=$Bounds --maxzoom=$MaxZoom

if ($LASTEXITCODE -ne 0) {
    throw "pmtiles extract fallo con codigo $LASTEXITCODE."
}

$size = [math]::Round((Get-Item $Output).Length / 1MB)

Write-Host ''
Write-Host "Listo: $Output ($size MB)" -ForegroundColor Green
Write-Host 'La API lo sirve bajo /tiles. Reiniciarla si estaba corriendo.' -ForegroundColor DarkGray
