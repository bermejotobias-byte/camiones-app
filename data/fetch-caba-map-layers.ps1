<#
.SYNOPSIS
    Genera las capas de camion del mapa de CABA a partir de OpenStreetMap.

.DESCRIPTION
    Consulta Overpass y escribe src/TruckNavigator.Api/wwwroot/data/*.geojson.

    Estas tres capas son el diferencial del producto y no vienen en ningun mapa
    del mundo: ningun proveedor de tiles incluye hgv, maxheight ni los pasos a
    nivel como datos consultables. Hay que armarlas.

      red-transito-pesado   las avenidas por las que un camion pesado SI puede
                            circular. Se muestran con el nombre destacado, sin
                            pintarlas de color, para que sirvan de referencia
                            aunque no sean parte de la ruta.
      alturas               tramos con galibo declarado: puentes y bajo vias.
      pasos-a-nivel         los "sapitos", con que tipo de barrera tienen.

    Se corre en tiempo de autoria, nunca en tiempo de ejecucion: la app trabaja
    contra los archivos generados, igual que el ruteo trabaja contra el grafo
    local y no contra Overpass (ver docs/data-sources.md).

    Reglas que el script respeta y que no hay que relajar:

    - maxheight="default" NO es una altura. Significa "rige el limite legal", no
      un galibo medido, y hoy son 105 de 685 tramos. Esos quedan afuera: mostrar
      un numero inventado sobre un puente es peor que no mostrar nada.
    - Lo que la fuente no declara queda como null, nunca como un valor por
      defecto. Un paso a nivel sin tipo de barrera declarado no es un paso a
      nivel sin barrera.
    - Las coordenadas se redondean a 6 decimales: son ~11 cm, mas precision de
      la que tiene el dato y de la que sirve para dibujar, y el archivo pesa
      casi la mitad.

.PARAMETER Endpoint
    Instancia de Overpass. El endpoint principal suele estar saturado.

.EXAMPLE
    ./data/fetch-caba-map-layers.ps1
#>
[CmdletBinding()]
param(
    [string] $Endpoint = 'https://overpass-api.de/api/interpreter',
    [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'

# La ruta por defecto se arma ACA y no en el bloque param(): ahi $PSScriptRoot
# puede venir vacio, y entonces "$PSScriptRoot/../src/..." se ancla en la raiz
# del disco. El script escribe igual, informa que grabo, y los archivos aparecen
# en C:\src — un rato entero buscandolos donde no estaban.
if (-not $OutputDirectory) {
    $scriptFolder = Split-Path -Parent $PSCommandPath
    $OutputDirectory = Join-Path $scriptFolder '..\src\TruckNavigator.Api\wwwroot\data'
}

# Relacion de OSM para la Ciudad Autonoma de Buenos Aires (3600000000 + 1224652).
$cabaArea = 3601224652

if (-not (Test-Path $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

# Se resuelve a ruta absoluta y se informa. Con rutas relativas que llevan ".."
# es facil escribir en un lugar y buscar en otro, y el script queda diciendo que
# grabo archivos que despues no aparecen.
$OutputDirectory = (Resolve-Path $OutputDirectory).Path
Write-Host "Escribiendo en: $OutputDirectory" -ForegroundColor DarkGray

function Invoke-Overpass {
    param([string] $Query, [string] $What)

    Write-Host "Consultando Overpass: $What ..." -ForegroundColor Cyan

    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            # El query va como campo "data" de un formulario. Mandarlo como cuerpo
            # crudo hace que Overpass conteste 406: no es que el query este mal,
            # es que no reconoce el envoltorio.
            #
            # NO se usa Invoke-RestMethod: cuando la respuesta no declara charset
            # —y Overpass no lo declara— PowerShell 5.1 la decodifica como
            # ISO-8859-1. Los nombres en UTF-8 quedan doblemente codificados y en
            # el mapa se lee "Avenida San MartÃ­n" y "RAÃšL R. ALFONSÃN". Se leen
            # los bytes crudos y se decodifican como UTF-8 a mano.
            $respuesta = Invoke-WebRequest -Uri $Endpoint -Method Post `
                -Body @{ data = $Query } `
                -UserAgent 'TruckNavigator-CABA/0.1 (generador de capas)' `
                -TimeoutSec 300 -UseBasicParsing

            $bytes = $respuesta.RawContentStream.ToArray()

            return [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
        }
        catch {
            # Overpass devuelve 429 cuando no hay slot libre. Es lo normal si se
            # corre el script entero de una vez, no un error del que haya que salir.
            if ($attempt -eq 4) { throw }
            Write-Host "  sin slot libre, reintento en 20 s ($attempt/3)" -ForegroundColor DarkGray
            Start-Sleep -Seconds 20
        }
    }
}

# Seis decimales son unos 11 cm. Mas que eso es ruido y peso.
function Get-Coordinates {
    param($Geometry)

    $points = New-Object System.Collections.ArrayList

    foreach ($point in $Geometry) {
        # GeoJSON va [longitud, latitud].
        [void] $points.Add(@([math]::Round($point.lon, 6), [math]::Round($point.lat, 6)))
    }

    return $points
}

function Write-GeoJson {
    param($Features, [string] $Name, [string] $Description)

    $document = [ordered] @{
        type        = 'FeatureCollection'
        name        = $Name
        description = $Description
        attribution = 'Datos de OpenStreetMap (ODbL)'
        generatedOn = (Get-Date).ToString('yyyy-MM-dd')
        features    = $Features
    }

    $path = Join-Path $OutputDirectory "$Name.geojson"

    # Depth alto: las lineas son arrays de arrays y el serializador las corta sin avisar.
    $document | ConvertTo-Json -Depth 12 -Compress | Set-Content -Path $path -Encoding UTF8

    $size = [math]::Round((Get-Item $path).Length / 1KB)
    Write-Host ("  {0,-24} {1,5} objetos  {2,6} KB" -f $Name, $Features.Count, $size) -ForegroundColor Green
}

# ---------------------------------------------------------------- Red pesada

$red = Invoke-Overpass -What 'Red de Transito Pesado' -Query @"
[out:json][timeout:180];
area($cabaArea)->.caba;
way["hgv"="designated"](area.caba);
out geom;
"@

$redFeatures = New-Object System.Collections.ArrayList

foreach ($way in $red.elements) {
    if (-not $way.geometry -or $way.geometry.Count -lt 2) { continue }

    [void] $redFeatures.Add([ordered] @{
        type       = 'Feature'
        properties = [ordered] @{
            # Sin nombre no sirve de referencia, que es justamente para lo que se
            # dibuja esta capa. Igual se conserva el tramo: la linea aporta.
            name = if ($way.tags.name) { $way.tags.name } else { $null }
            ref  = if ($way.tags.ref) { $way.tags.ref } else { $null }
            osm  = "way/$($way.id)"
        }
        geometry   = [ordered] @{
            type        = 'LineString'
            coordinates = Get-Coordinates $way.geometry
        }
    })
}

Write-GeoJson -Features $redFeatures -Name 'red-transito-pesado' `
    -Description 'Tramos con hgv=designated: la Red de Transito Pesado segun OpenStreetMap. Transcripcion comunitaria, no la capa oficial del GCBA (ver L-1).'

# ------------------------------------------------------------------ Alturas

$alturas = Invoke-Overpass -What 'galibos declarados' -Query @"
[out:json][timeout:180];
area($cabaArea)->.caba;
way["maxheight"](area.caba);
out geom;
"@

$alturaFeatures = New-Object System.Collections.ArrayList
$sinNumero = 0

foreach ($way in $alturas.elements) {
    if (-not $way.geometry -or $way.geometry.Count -lt 2) { continue }

    $raw = "$($way.tags.maxheight)".Trim()

    # "default" significa "rige el limite legal", no un galibo medido. Tambien
    # aparecen valores con unidad ("3.5 m"). Lo que no se pueda leer como numero
    # se descarta: un numero inventado sobre un puente es peor que nada.
    $metres = $null
    $cleaned = $raw -replace '\s*m$', ''

    if ([double]::TryParse($cleaned, [ref] ([double] $parsed = 0))) {
        $metres = [math]::Round([double] $cleaned, 2)
    }

    if ($null -eq $metres) { $sinNumero++; continue }

    # El punto medio del tramo es donde se pone la etiqueta.
    $middle = $way.geometry[[int] [math]::Floor($way.geometry.Count / 2)]

    [void] $alturaFeatures.Add([ordered] @{
        type       = 'Feature'
        properties = [ordered] @{
            metres = $metres
            name   = if ($way.tags.name) { $way.tags.name } else { $null }
            osm    = "way/$($way.id)"
        }
        geometry   = [ordered] @{
            type        = 'Point'
            coordinates = @([math]::Round($middle.lon, 6), [math]::Round($middle.lat, 6))
        }
    })
}

Write-Host "  $sinNumero tramos sin altura numerica (maxheight=default o sin parsear): quedaron afuera" -ForegroundColor DarkYellow

Write-GeoJson -Features $alturaFeatures -Name 'alturas' `
    -Description 'Galibos declarados en OpenStreetMap. Solo los que informan una altura numerica; maxheight=default queda afuera porque no es una medida.'

# ------------------------------------------------------------ Pasos a nivel

$pasos = Invoke-Overpass -What 'pasos a nivel' -Query @"
[out:json][timeout:180];
area($cabaArea)->.caba;
node["railway"="level_crossing"](area.caba);
out body;
"@

$pasoFeatures = New-Object System.Collections.ArrayList

foreach ($node in $pasos.elements) {
    $barrier = "$($node.tags.'crossing:barrier')".Trim()

    # Lo que la fuente no declara queda en null. Un paso a nivel sin tipo de
    # barrera declarado NO es un paso a nivel sin barrera.
    if ([string]::IsNullOrWhiteSpace($barrier)) { $barrier = $null }

    [void] $pasoFeatures.Add([ordered] @{
        type       = 'Feature'
        properties = [ordered] @{
            barrier = $barrier
            name    = if ($node.tags.name) { $node.tags.name } else { $null }
            osm     = "node/$($node.id)"
        }
        geometry   = [ordered] @{
            type        = 'Point'
            coordinates = @([math]::Round($node.lon, 6), [math]::Round($node.lat, 6))
        }
    })
}

Write-GeoJson -Features $pasoFeatures -Name 'pasos-a-nivel' `
    -Description 'Pasos a nivel ferroviarios ("sapitos"). El GCBA no publica este dato: sale de OpenStreetMap.'

Write-Host ''
Write-Host 'Listo. Las capas se sirven desde wwwroot/data y viajan dentro del APK.' -ForegroundColor Green
