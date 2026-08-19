<#
.SYNOPSIS
    Recorta el extract de OpenStreetMap al area metropolitana de Buenos Aires.

.DESCRIPTION
    El extract de Geofabrik cubre Argentina entera: 408 MB de .pbf que producen un
    grafo de 337 MB y algo mas de 1 GB de memoria en GraphHopper. La app trabaja
    sobre CABA, asi que para desplegar en un servidor chico no hace falta cargar
    el pais.

    El recorte usa el MISMO rectangulo con el que el geocoder recorta sus
    resultados (seccion Geocoding de appsettings.json). Esa coincidencia no es
    casual y conviene mantenerla: garantiza que todo lo que el buscador puede
    encontrar, el motor lo puede rutear. Si se amplia uno, hay que ampliar el otro.

    Se usa Osmosis porque es Java puro y corre con el mismo JDK que ya hace falta
    para compilar MAUI, sin instalar nada mas.

.PARAMETER Rebuild
    Borra tambien el grafo para que GraphHopper lo reconstruya desde el recorte.

.EXAMPLE
    ./routing/crop-amba.ps1 -Rebuild
#>
[CmdletBinding()]
param(
    [switch] $Rebuild,

    # Mismo recorte que GeocodingOptions: MinLongitude, MinLatitude, MaxLongitude, MaxLatitude.
    [double] $Left = -59.30,
    [double] $Bottom = -35.20,
    [double] $Right = -57.90,
    [double] $Top = -34.00,

    [string] $Source = 'argentina-latest.osm.pbf',
    [string] $Output = 'amba-latest.osm.pbf'
)

$ErrorActionPreference = 'Stop'

# Push/Pop en lugar de Set-Location: si se invoca el script en la sesion actual,
# un Set-Location le deja el directorio cambiado al que lo llamo.
Push-Location $PSScriptRoot
try {

$osmosis = Join-Path $PSScriptRoot 'tools\osmosis\osmosis-0.49.2\bin\osmosis.bat'

if (-not (Test-Path $osmosis)) {
    throw "Falta Osmosis en $osmosis. Descargalo de " +
          "https://github.com/openstreetmap/osmosis/releases y descomprimilo ahi."
}

if (-not (Test-Path $Source)) {
    throw "Falta $Source. Corre run-graphhopper.ps1 una vez para que lo descargue."
}

# Osmosis usa el JAVACMD del entorno. Se apunta al mismo JDK que usa el resto del
# proyecto para no depender del java del PATH, que puede ser otra version.
$microsoftJdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

if ($microsoftJdk) {
    $env:JAVACMD = Join-Path $microsoftJdk.FullName 'bin\java.exe'
}

# completeWays mantiene enteras las calles que cruzan el borde del rectangulo. Sin
# esto, una avenida que sale del area queda cortada y el ruteo se topa con un
# callejon sin salida artificial.
$env:JAVACMD_OPTIONS = '-Xmx6g'

Write-Host "Recortando $Source a [$Left, $Bottom, $Right, $Top] ..." -ForegroundColor Cyan
$started = Get-Date

& $osmosis --read-pbf file=$Source `
           --bounding-box left=$Left bottom=$Bottom right=$Right top=$Top completeWays=yes `
           --write-pbf file=$Output

if ($LASTEXITCODE -ne 0) {
    throw "Osmosis fallo con codigo $LASTEXITCODE."
}

$before = (Get-Item $Source).Length / 1MB
$after = (Get-Item $Output).Length / 1MB

Write-Host ("Listo en {0:N0} s: {1:N0} MB -> {2:N0} MB ({3:N0} % del original)" -f `
    ((Get-Date) - $started).TotalSeconds, $before, $after, ($after / $before * 100)) -ForegroundColor Green

if ($Rebuild -and (Test-Path 'graph-cache')) {
    Write-Host 'Borrando el grafo para que se reconstruya desde el recorte ...' -ForegroundColor Yellow
    Remove-Item 'graph-cache' -Recurse -Force
}

Write-Host "Apunta datareader.file a $Output en config-truck.yml y volve a levantar GraphHopper."
}
finally {
    Pop-Location
}
