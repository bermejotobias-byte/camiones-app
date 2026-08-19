<#
.SYNOPSIS
    Levanta el motor de ruteo GraphHopper con el perfil de camion de CABA.

.DESCRIPTION
    La primera ejecucion importa el extract de OSM y construye el grafo en
    routing/graph-cache (tarda alrededor de un minuto). Las siguientes arrancan
    directamente desde el cache.

    Si cambiaste graph.encoded_values en config-truck.yml hay que borrar
    graph-cache para que el grafo se reconstruya.
#>
[CmdletBinding()]
param(
    [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$jar = 'graphhopper-web-11.0.jar'
$pbf = 'argentina-latest.osm.pbf'

if (-not (Test-Path $jar)) {
    Write-Host "Descargando $jar ..." -ForegroundColor Cyan
    Invoke-WebRequest `
        -Uri "https://github.com/graphhopper/graphhopper/releases/download/11.0/$jar" `
        -OutFile $jar
}

if (-not (Test-Path $pbf)) {
    Write-Host "Descargando $pbf (407 MB, datos de Geofabrik bajo ODbL) ..." -ForegroundColor Cyan
    Invoke-WebRequest `
        -Uri "https://download.geofabrik.de/south-america/argentina-latest.osm.pbf" `
        -OutFile $pbf
}

if ($Rebuild -and (Test-Path 'graph-cache')) {
    Write-Host 'Borrando el grafo para reconstruirlo ...' -ForegroundColor Yellow
    Remove-Item 'graph-cache' -Recurse -Force
}

# .NET Android exige JDK 17-21; GraphHopper necesita 17 o superior. Se usa el
# OpenJDK de Microsoft si esta presente para no depender del java del PATH.
$microsoftJdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

$java = if ($microsoftJdk) { Join-Path $microsoftJdk.FullName 'bin\java.exe' } else { 'java' }

Write-Host "Iniciando GraphHopper en http://localhost:8989 ..." -ForegroundColor Green
& $java -Xmx8g -jar $jar server config-truck.yml
