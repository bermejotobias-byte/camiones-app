<#
.SYNOPSIS
    Genera la capa de zonas peligrosas de CABA desde el mapa comunitario.

.DESCRIPTION
    Fuente: mapa colaborativo "Zonas Peligrosas" de Google My Maps, que circula
    entre repartidores del AMBA. Lo eligio el usuario del proyecto como criterio
    despues de descartar el Mapa del Delito del GCBA.

    POR QUE NO SE USA EL DATO OFICIAL DE DELITOS

    Se intento antes y el resultado era inservible, por dos motivos distintos:

    1. Contar delitos denunciados mide DONDE HAY GENTE, no donde hay peligro.
       Palermo encabezaba la Ciudad. Filtrar a robos a mano armada corregia parte
       del sesgo, pero no el fondo.
    2. El dataset del GCBA cubre exactamente CABA, asi que el mapa de calor
       terminaba dibujando la silueta de la Ciudad: un manchon rojo con la forma
       del limite administrativo, que decia "toda la Ciudad es peligrosa y el
       conurbano es seguro". Absurdo, y al reves de la realidad.

    El problema de fondo es que un conteo de hechos no es un mapa de peligro. Las
    zonas que un repartidero evita son un juicio, y este mapa las tiene marcadas
    a mano por gente que anda por ahi todos los dias.

    QUE SE QUEDA

    De los 403 poligonos del mapa, solo 19 tocan CABA — el resto es conurbano y
    otras provincias. Esos 19 cubren 8,8 km2, el 4,3% de la Ciudad, y caen donde
    uno esperaria:

        Villa Soldati          2,49 km2
        Barracas (Villa 21-24) 2,02
        Villa Lugano           1,54
        Retiro (Villa 31)      0,86
        Flores (Villa 1-11-14) 0,78
        y menores en La Boca, Nueva Pompeya, Parque Avellaneda, Recoleta,
        Puerto Madero, Saavedra, Paternal, Parque Patricios y Chacarita.

    QUE EMITE

    Dos clases de objeto, distinguidas por la propiedad `t`:

      t = "h"   puntos muestreados adentro de las zonas, cada 60 m, en un solo
                MultiPoint. Son los que alimentan el mapa de calor: una capa
                `heatmap` de MapLibre solo acepta puntos, y ademas el difuminado
                es lo que evita prometer un borde exacto que este dato no tiene.
      t = "f"   los poligonos, para contestar al tocar el mapa.

    LO QUE ESTE DATO NO ES

    - **No es oficial.** Es un mapa de autoria anonima, sin metodologia escrita,
      sin fecha y sin licencia declarada. Se usa como lo que es: el juicio de
      gente que trabaja en la calle, no un registro.
    - **No tiene grados.** Los 403 poligonos son del mismo color y ninguno se
      superpone con otro dentro de CABA: del dato salen dos estados —marcada y no
      marcada—, no una escala.
    - **Que una zona no este marcada NO significa que sea segura.** Significa que
      nadie la marco. La app no dice "zona segura" en ningun lado por eso.

.PARAMETER KmlPath
    KML ya descargado. Si no se pasa, se baja del mapa publicado.

.EXAMPLE
    .\data\fetch-zonas-riesgo.ps1
#>
[CmdletBinding()]
param(
    [string] $KmlPath,
    [int] $PasoMetros = 60,
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

$mid = '1ZVh-1tRfDFTc4O1eITKjEkASCXFQExtL'

if (-not $KmlPath) {
    # forcekml=1 devuelve KML plano; sin eso viene KMZ comprimido.
    $KmlPath = Join-Path ([System.IO.Path]::GetTempPath()) 'zonas-peligrosas.kml'

    if (-not (Test-Path $KmlPath)) {
        Write-Host 'Descargando el mapa comunitario ...' -ForegroundColor Cyan
        Invoke-WebRequest -Uri "https://www.google.com/maps/d/kml?mid=$mid&forcekml=1" `
            -OutFile $KmlPath -UseBasicParsing -TimeoutSec 120
    }
    else {
        Write-Host "Reusando la descarga previa: $KmlPath" -ForegroundColor DarkGray
    }
}

$kml = [System.IO.File]::ReadAllText($KmlPath, [System.Text.Encoding]::UTF8)

# ---------------------------------------------------------------- Limite de CABA
#
# Se necesita por dos razones: para quedarse solo con las zonas de la Ciudad, y
# para recortar los puntos de muestreo que caen del otro lado del Riachuelo o de
# General Paz. Sin el recorte, una zona a caballo del limite pintaria conurbano
# donde no hay ningun otro dato de la app.
#
# Sale del dataset oficial "Barrios" de Buenos Aires Data (CC-BY-2.5-AR). Se baja
# aparte y no se versiona: es medio mega y solo hace falta al generar.

$barriosPath = Join-Path ([System.IO.Path]::GetTempPath()) 'barrios-caba.geojson'

if (-not (Test-Path $barriosPath)) {
    Write-Host 'Descargando el limite de CABA (barrios oficiales) ...' -ForegroundColor Cyan
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -OutFile $barriosPath `
        -Uri 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/barrios/barrios.geojson'
}

$barrios = Get-Content $barriosPath -Raw -Encoding UTF8 | ConvertFrom-Json

$anillosCaba = New-Object System.Collections.ArrayList
$nombreBarrio = New-Object System.Collections.ArrayList

# Los dos casos se escriben aparte y sin el truco del operador coma para envolver
# el Polygon: PowerShell desenrolla arrays anidados al asignarlos, y con
# `, $geometry.coordinates` se perdia un nivel — los "anillos" quedaban siendo
# pares sueltos de numeros, ninguna zona caia adentro de la Ciudad y el script
# cortaba diciendo que el mapa de origen habia cambiado. No habia cambiado nada.
foreach ($f in $barrios.features) {
    if ($f.geometry.type -eq 'MultiPolygon') {
        foreach ($poli in $f.geometry.coordinates) {
            [void] $anillosCaba.Add($poli[0])
            [void] $nombreBarrio.Add($f.properties.nombre)
        }
    }
    else {
        [void] $anillosCaba.Add($f.geometry.coordinates[0])
        [void] $nombreBarrio.Add($f.properties.nombre)
    }
}

Write-Host "Limite de CABA: $($anillosCaba.Count) anillos de barrio" -ForegroundColor DarkGray

# Punto en poligono, por cruce de rayos.
function Test-Dentro {
    param($Lng, $Lat, $Anillo)

    $dentro = $false
    $j = $Anillo.Count - 1

    for ($i = 0; $i -lt $Anillo.Count; $i++) {
        $yi = $Anillo[$i][1]; $xi = $Anillo[$i][0]
        $yj = $Anillo[$j][1]; $xj = $Anillo[$j][0]

        if ((($yi -gt $Lat) -ne ($yj -gt $Lat)) -and
            ($Lng -lt (($xj - $xi) * ($Lat - $yi) / ($yj - $yi) + $xi))) {
            $dentro = -not $dentro
        }

        $j = $i
    }

    return $dentro
}

function Get-Barrio {
    param($Lng, $Lat)

    for ($i = 0; $i -lt $anillosCaba.Count; $i++) {
        if (Test-Dentro -Lng $Lng -Lat $Lat -Anillo $anillosCaba[$i]) { return $nombreBarrio[$i] }
    }

    return $null
}

# CONTROL DEL INSTRUMENTO. Antes de creerle al limite, se le pregunta por lugares
# cuya respuesta se sabe. Sin esto, un limite mal armado no da error: simplemente
# no encuentra ninguna zona, y el sintoma —"cambio el mapa de origen"— manda a
# buscar el problema al lado equivocado. Ya paso.
$control = @(
    @{ nombre = 'Obelisco';       lng = -58.38159; lat = -34.60373; dentro = $true },
    @{ nombre = 'Villa Soldati';  lng = -58.44200; lat = -34.67200; dentro = $true },
    @{ nombre = 'Avellaneda';     lng = -58.36500; lat = -34.66200; dentro = $false },
    @{ nombre = 'Vicente Lopez';  lng = -58.47800; lat = -34.52700; dentro = $false }
)

foreach ($c in $control) {
    $hay = $null -ne (Get-Barrio -Lng $c.lng -Lat $c.lat)
    if ($hay -ne $c.dentro) {
        throw "El limite de CABA no pasa el control: $($c.nombre) dio dentro=$hay y se esperaba $($c.dentro)."
    }
}

Write-Host "  control del limite: ok" -ForegroundColor DarkGray

# ------------------------------------------------------------------ Las zonas

$zonas = New-Object System.Collections.ArrayList
$totalPoligonos = 0

foreach ($marca in ($kml -split '<Placemark>') | Select-Object -Skip 1) {
    if ($marca -notmatch '(?s)<coordinates>(.*?)</coordinates>') { continue }

    $totalPoligonos++

    $anillo = New-Object System.Collections.ArrayList
    foreach ($par in ($matches[1].Trim() -split '\s+')) {
        $c = $par -split ','
        if ($c.Count -lt 2) { continue }
        [void] $anillo.Add(@(
            [double]::Parse($c[0], [Globalization.CultureInfo]::InvariantCulture),
            [double]::Parse($c[1], [Globalization.CultureInfo]::InvariantCulture)
        ))
    }

    if ($anillo.Count -lt 3) { continue }

    # Toca CABA si alguno de sus vertices cae adentro de la Ciudad.
    $toca = $false
    foreach ($v in $anillo) {
        if ($null -ne (Get-Barrio -Lng $v[0] -Lat $v[1])) { $toca = $true; break }
    }

    if (-not $toca) { continue }

    $titulo = if ($marca -match '<value>(ZP[^<]*)</value>') { $matches[1] } else { $null }

    [void] $zonas.Add([pscustomobject] @{ titulo = $titulo; anillo = $anillo })
}

Write-Host "Poligonos en el mapa: $totalPoligonos   ->   tocan CABA: $($zonas.Count)" -ForegroundColor DarkGray

if ($zonas.Count -eq 0) {
    throw 'Ninguna zona toca CABA. Cambio el mapa de origen: revisar antes de seguir.'
}

# ------------------------------------------------- Muestreo para el mapa de calor

$kLat = 110574.0
$kLng = 111320.0 * [math]::Cos(-34.61 * [math]::PI / 180.0)

$puntos = New-Object System.Collections.ArrayList
$recortados = 0
$porBarrio = @{}

foreach ($z in $zonas) {
    $mnLat = 90.0; $mxLat = -90.0; $mnLng = 180.0; $mxLng = -180.0
    foreach ($v in $z.anillo) {
        if ($v[1] -lt $mnLat) { $mnLat = $v[1] }
        if ($v[1] -gt $mxLat) { $mxLat = $v[1] }
        if ($v[0] -lt $mnLng) { $mnLng = $v[0] }
        if ($v[0] -gt $mxLng) { $mxLng = $v[0] }
    }

    for ($y = [math]::Floor($mnLat * $kLat / $PasoMetros); $y -le [math]::Ceiling($mxLat * $kLat / $PasoMetros); $y++) {
        for ($x = [math]::Floor($mnLng * $kLng / $PasoMetros); $x -le [math]::Ceiling($mxLng * $kLng / $PasoMetros); $x++) {
            $lat = ($y + 0.5) * $PasoMetros / $kLat
            $lng = ($x + 0.5) * $PasoMetros / $kLng

            if (-not (Test-Dentro -Lng $lng -Lat $lat -Anillo $z.anillo)) { continue }

            # Recorte a CABA: una zona a caballo del Riachuelo no puede pintar
            # conurbano, donde la app no tiene ningun otro dato que mostrar.
            $barrio = Get-Barrio -Lng $lng -Lat $lat
            if (-not $barrio) { $recortados++; continue }

            $porBarrio[$barrio] = 1 + $porBarrio[$barrio]

            [void] $puntos.Add(@(
                [math]::Round($lng, 5),
                [math]::Round($lat, 5)
            ))
        }
    }
}

$areaKm2 = $puntos.Count * [math]::Pow($PasoMetros / 1000.0, 2)

Write-Host ""
Write-Host ("Puntos de calor: {0} (cada {1} m) = {2:N1} km2, el {3:N1}% de CABA" -f `
    $puntos.Count, $PasoMetros, $areaKm2, ($areaKm2 / 203.99 * 100)) -ForegroundColor Yellow
Write-Host "  recortados por caer fuera de CABA: $recortados" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Barrios alcanzados:" -ForegroundColor DarkGray
foreach ($b in ($porBarrio.GetEnumerator() | Sort-Object Value -Descending)) {
    Write-Host ("  {0,5:N2} km2  {1}" -f ($b.Value * [math]::Pow($PasoMetros / 1000.0, 2)), $b.Key) -ForegroundColor DarkGray
}

# ------------------------------------------------------------------- GeoJSON

$features = New-Object System.Collections.ArrayList

# Los puntos van en UN SOLO MultiPoint: MapLibre lo expande y el mapa de calor
# cuenta cada punto por separado. Como Feature suelta, la envoltura pesaria mas
# que la coordenada que contiene.
[void] $features.Add([ordered] @{
    type       = 'Feature'
    properties = [ordered] @{ t = 'h' }
    geometry   = [ordered] @{ type = 'MultiPoint'; coordinates = $puntos }
})

foreach ($z in $zonas) {
    # El anillo va cerrado, como pide GeoJSON.
    $coords = New-Object System.Collections.ArrayList
    foreach ($v in $z.anillo) {
        [void] $coords.Add(@([math]::Round($v[0], 6), [math]::Round($v[1], 6)))
    }
    if ($coords[0][0] -ne $coords[$coords.Count - 1][0] -or $coords[0][1] -ne $coords[$coords.Count - 1][1]) {
        [void] $coords.Add($coords[0])
    }

    # Barrio dominante, para nombrar la zona al tocarla.
    $centroLng = 0.0; $centroLat = 0.0
    foreach ($v in $z.anillo) { $centroLng += $v[0]; $centroLat += $v[1] }
    $centroLng /= $z.anillo.Count; $centroLat /= $z.anillo.Count

    $barrio = Get-Barrio -Lng $centroLng -Lat $centroLat

    [void] $features.Add([ordered] @{
        type       = 'Feature'
        properties = [ordered] @{
            t      = 'f'
            barrio = $barrio
        }
        geometry   = [ordered] @{ type = 'Polygon'; coordinates = @(, $coords) }
    })
}

$documento = [ordered] @{
    type        = 'FeatureCollection'
    name        = 'zonas-riesgo'
    description = "Zonas marcadas como peligrosas en un mapa colaborativo del AMBA, recortadas a CABA. Los objetos con t='h' son puntos muestreados cada $PasoMetros m que alimentan el mapa de calor; los que tienen t='f' son los poligonos, para contestar al tocar. NO es un dato oficial y NO tiene grados: que una zona no este marcada significa que nadie la marco, no que sea segura."
    attribution = 'Mapa colaborativo "Zonas Peligrosas" (Google My Maps), de autoria anonima. Limite de CABA: Buenos Aires Data (CC-BY-2.5-AR)'
    source      = "https://www.google.com/maps/d/u/0/viewer?mid=$mid"
    oficial     = $false
    pasoMetros  = $PasoMetros
    baseline    = [ordered] @{
        poligonosEnElMapa = $totalPoligonos
        poligonosEnCaba   = $zonas.Count
        puntosDeCalor     = $puntos.Count
        areaKm2           = [math]::Round($areaKm2, 2)
    }
    generatedOn = (Get-Date).ToString('yyyy-MM-dd')
    features    = $features
}

$destino = Join-Path $OutputDirectory 'zonas-riesgo.geojson'
$documento | ConvertTo-Json -Depth 10 -Compress | Set-Content -Path $destino -Encoding UTF8

$peso = [math]::Round((Get-Item $destino).Length / 1KB, 1)

Write-Host ""
Write-Host ("Zonas peligrosas -> {0} ({1} KB)" -f $destino, $peso) -ForegroundColor Green
Write-Host ("  {0} zonas  ·  {1} puntos de calor" -f $zonas.Count, $puntos.Count) -ForegroundColor DarkGray
