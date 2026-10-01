<#
.SYNOPSIS
    Genera los candidatos del relevamiento de POIs para camiones.

.DESCRIPTION
    Escribe en data/relevamiento/:
      - candidatos-osm.json      todo lo que OpenStreetMap tiene en el rectangulo
                                 de CABA + anillo para las categorias del relevamiento,
                                 SIN corte por cantidad.
      - candidatos-energia.json  el registro oficial de estaciones (Secretaria de
                                 Energia, Res. 314/2016, CC-BY-4.0), una fila por
                                 estacion con sus productos, cruzado con OSM por
                                 cercania (<= 80 m).

    Ademas marca en los dos si el punto esta a <= 40 m de un tramo de la Red de
    Transito Pesado (wwwroot/data/red-transito-pesado.geojson) y sobre que calle.
    Son candidatos, no el dataset: la evidencia de aptitud se releva a mano y se
    escribe en pois-caba-relevamiento-*.json. Ver data/relevamiento/README.md.

.EXAMPLE
    ./data/fetch-poi-candidatos.ps1
#>
[CmdletBinding()]
param(
    [string] $Endpoint = 'https://overpass.kumi.systems/api/interpreter',
    [string] $EnergiaCsv = 'http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/precios-en-surtidor-resolucin-3142016.csv'
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot viene vacio dentro de param(): las rutas se calculan aca.
$raiz = Split-Path (Split-Path $PSCommandPath -Parent) -Parent
$salida = Join-Path $raiz 'data\relevamiento'
$redPath = Join-Path $raiz 'src\TruckNavigator.Api\wwwroot\data\red-transito-pesado.geojson'
New-Item -ItemType Directory -Force $salida | Out-Null

# El rectangulo del alcance (spec 15/09/2026, §3): CABA mas el anillo de acceso.
$latMin = -34.725; $latMax = -34.505; $lonMin = -58.555; $lonMax = -58.315
$retrievedOn = (Get-Date).ToString('yyyy-MM-dd')

# ---------------------------------------------------------------------------
# La Red de Transito Pesado, para marcar que candidatos estan sobre ella.
# Proyeccion plana a metros: a esta escala el error es de centimetros. Los
# segmentos se indexan por celda de ~1 km para no recorrer 2.425 tramos por punto.
# ---------------------------------------------------------------------------
$metrosPorGradoLat = 111320.0
$metrosPorGradoLon = 111320.0 * [math]::Cos(-34.6 * [math]::PI / 180)

$red = (Get-Content $redPath -Raw | ConvertFrom-Json).features
$celdas = @{}
$celda = 0.01
foreach ($f in $red) {
    $nombre = if ($f.properties.name) { $f.properties.name } elseif ($f.properties.ref) { $f.properties.ref } else { 'sin nombre' }
    $c = $f.geometry.coordinates
    for ($i = 0; $i -lt $c.Count - 1; $i++) {
        $seg = [pscustomobject]@{
            ax = $c[$i][0] * $metrosPorGradoLon; ay = $c[$i][1] * $metrosPorGradoLat
            bx = $c[$i + 1][0] * $metrosPorGradoLon; by = $c[$i + 1][1] * $metrosPorGradoLat
            nombre = $nombre
        }
        # el segmento entra en las celdas de sus dos extremos (y las vecinas al consultar)
        foreach ($p in @($c[$i], $c[$i + 1])) {
            $k = "$([math]::Floor($p[1] / $celda)),$([math]::Floor($p[0] / $celda))"
            if (-not $celdas.ContainsKey($k)) { $celdas[$k] = New-Object System.Collections.Generic.List[object] }
            $celdas[$k].Add($seg)
        }
    }
}

function Get-DistanciaASegmento([double] $px, [double] $py, $s) {
    $dx = $s.bx - $s.ax; $dy = $s.by - $s.ay
    $l2 = $dx * $dx + $dy * $dy
    if ($l2 -eq 0) { return [math]::Sqrt(($px - $s.ax) * ($px - $s.ax) + ($py - $s.ay) * ($py - $s.ay)) }
    $t = (($px - $s.ax) * $dx + ($py - $s.ay) * $dy) / $l2
    if ($t -lt 0) { $t = 0 } elseif ($t -gt 1) { $t = 1 }
    $cx = $s.ax + $t * $dx; $cy = $s.ay + $t * $dy
    return [math]::Sqrt(($px - $cx) * ($px - $cx) + ($py - $cy) * ($py - $cy))
}

# Devuelve el nombre del tramo de la Red a <= 40 m, o $null.
function Get-CalleRed([double] $lat, [double] $lon) {
    $px = $lon * $metrosPorGradoLon; $py = $lat * $metrosPorGradoLat
    $fila = [math]::Floor($lat / $celda); $col = [math]::Floor($lon / $celda)
    $mejor = $null; $mejorD = 41
    for ($df = -1; $df -le 1; $df++) {
        for ($dc = -1; $dc -le 1; $dc++) {
            $k = "$($fila + $df),$($col + $dc)"
            if (-not $celdas.ContainsKey($k)) { continue }
            foreach ($s in $celdas[$k]) {
                $d = Get-DistanciaASegmento $px $py $s
                if ($d -lt $mejorD) { $mejorD = $d; $mejor = $s.nombre }
            }
        }
    }
    return $mejor
}

# ---------------------------------------------------------------------------
# OSM: todo lo que hay, sin corte
# ---------------------------------------------------------------------------
$bbox = "$latMin,$lonMin,$latMax,$lonMax"
$query = @"
[out:json][timeout:180];
(
  nwr["amenity"="fuel"]($bbox);
  nwr["shop"="tyres"]($bbox);
  nwr["shop"~"^(truck_repair|truck)$"]($bbox);
  nwr["amenity"="truck_stop"]($bbox);
  nwr["amenity"="parking"]["hgv"]($bbox);
  nwr["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]["hgv"]($bbox);
);
out center tags;
"@

Write-Host "Consultando Overpass ($Endpoint)..." -ForegroundColor Cyan
# overpass-api.de responde 406 a un agente de usuario generico: hay que decir quien
# consulta. El cuerpo va como formulario (data=...), que aceptan todas las instancias.
$agente = 'camiones-app/relevamiento (+https://github.com/bermejotobias-byte/camiones-app)'
$osm = Invoke-RestMethod -Uri $Endpoint -Method Post -Body @{ data = $query } -UserAgent $agente -TimeoutSec 300

function Get-CategoriaOsm($tags) {
    if ($tags.amenity -eq 'truck_stop') { return 'TruckParking' }
    if ($tags.amenity -eq 'parking') { return 'TruckParking' }
    if ($tags.amenity -eq 'fuel') { return 'FuelStation' }
    if ($tags.shop -eq 'tyres') { return 'TyreShop' }
    if ($tags.shop -in @('truck_repair', 'truck')) { return 'RepairShop' }
    if ($tags.amenity -in @('restaurant', 'fast_food', 'cafe', 'food_court')) { return 'TruckFriendlyEatery' }
    return $null
}

$candidatosOsm = New-Object System.Collections.Generic.List[object]
foreach ($e in $osm.elements) {
    $t = $e.tags
    if (-not $t) { continue }
    $lat = if ($e.center) { $e.center.lat } else { $e.lat }
    $lon = if ($e.center) { $e.center.lon } else { $e.lon }
    if ($null -eq $lat) { continue }
    $cat = Get-CategoriaOsm $t
    if (-not $cat) { continue }

    $services = New-Object System.Collections.Generic.List[string]
    if ($t.'fuel:diesel' -eq 'yes') { $services.Add('Gasoil') }
    if ($t.'fuel:HGV_diesel' -eq 'yes') { $services.Add('Gasoil para camiones') }
    if ($t.'fuel:GNC' -eq 'yes' -or $t.'fuel:cng' -eq 'yes') { $services.Add('GNC') }
    if ($t.'fuel:adblue' -eq 'yes') { $services.Add('AdBlue') }
    if ($t.compressed_air -eq 'yes') { $services.Add('Aire comprimido') }
    if ($t.car_wash -eq 'yes') { $services.Add('Lavadero') }

    $calle = Get-CalleRed $lat $lon
    $candidatosOsm.Add([ordered]@{
        osm           = "$($e.type)/$($e.id)"
        name          = $t.name
        category      = $cat
        lat           = [math]::Round($lat, 6)
        lon           = [math]::Round($lon, 6)
        address       = if ($t.'addr:street') { "$($t.'addr:street') $($t.'addr:housenumber')".Trim() } else { $null }
        suburb        = $t.'addr:suburb'
        phone         = if ($t.phone) { $t.phone } else { $t.'contact:phone' }
        website       = if ($t.website) { $t.website } else { $t.'contact:website' }
        openingHours  = $t.opening_hours
        brand         = $t.brand
        operator      = $t.operator
        hgv           = if ($t.hgv) { $t.hgv } else { $t.'access:hgv' }
        fuelHgvDiesel = $t.'fuel:HGV_diesel'
        services      = $services.ToArray()
        enRedPesada   = [bool] $calle
        calleRed      = $calle
    })
}

# ---------------------------------------------------------------------------
# El registro oficial de estaciones: una fila por estacion, con sus productos
# ---------------------------------------------------------------------------
Write-Host "Bajando el registro de estaciones ($EnergiaCsv)..." -ForegroundColor Cyan
$csvPath = Join-Path ([System.IO.Path]::GetTempPath()) 'precios-en-surtidor.csv'
Invoke-WebRequest -Uri $EnergiaCsv -OutFile $csvPath -TimeoutSec 300
$filas = Import-Csv $csvPath -Encoding UTF8

$estaciones = @{}
foreach ($r in $filas) {
    if (-not $r.latitud -or -not $r.longitud) { continue }
    $lat = [double]::Parse($r.latitud, [cultureinfo]::InvariantCulture)
    $lon = [double]::Parse($r.longitud, [cultureinfo]::InvariantCulture)
    if ($lat -lt $latMin -or $lat -gt $latMax -or $lon -lt $lonMin -or $lon -gt $lonMax) { continue }
    $clave = $r.idempresa
    if (-not $estaciones.ContainsKey($clave)) {
        $estaciones[$clave] = [ordered]@{
            idempresa   = $r.idempresa
            empresa     = $r.empresa
            bandera     = $r.empresabandera
            address     = $r.direccion
            localidad   = $r.localidad
            lat         = [math]::Round($lat, 6)
            lon         = [math]::Round($lon, 6)
            productos   = New-Object System.Collections.Generic.List[string]
            osm         = $null
            enRedPesada = $false
            calleRed    = $null
        }
    }
    if ($r.producto -and -not $estaciones[$clave].productos.Contains($r.producto)) {
        $estaciones[$clave].productos.Add($r.producto)
    }
}

# Cruce con OSM por cercania: <= 80 m es la misma estacion.
$fuelOsm = @($candidatosOsm | Where-Object { $_.category -eq 'FuelStation' })
$cruzadas = 0
foreach ($s in $estaciones.Values) {
    $mejor = $null; $mejorD = 81
    foreach ($o in $fuelOsm) {
        $dx = ($o.lon - $s.lon) * $metrosPorGradoLon
        $dy = ($o.lat - $s.lat) * $metrosPorGradoLat
        $d = [math]::Sqrt($dx * $dx + $dy * $dy)
        if ($d -lt $mejorD) { $mejorD = $d; $mejor = $o }
    }
    if ($mejor) { $s.osm = $mejor.osm; $cruzadas++ }
    $calle = Get-CalleRed $s.lat $s.lon
    $s.enRedPesada = [bool] $calle
    $s.calleRed = $calle
    $s.productos = $s.productos.ToArray()
}

# ---------------------------------------------------------------------------
# Salida y conteos
# ---------------------------------------------------------------------------
$porCategoria = ($candidatosOsm | Group-Object { $_.category } | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '
Write-Host "OSM: $($candidatosOsm.Count) candidatos ($porCategoria); con nombre: $(@($candidatosOsm | Where-Object name).Count); sobre la Red: $(@($candidatosOsm | Where-Object enRedPesada).Count)" -ForegroundColor Green
Write-Host "Energia: $($estaciones.Count) estaciones en el rectangulo; cruzadas con OSM: $cruzadas; sobre la Red: $(@($estaciones.Values | Where-Object enRedPesada).Count); con GNC: $(@($estaciones.Values | Where-Object { $_.productos -contains 'GNC' }).Count)" -ForegroundColor Green

[ordered]@{ generatedOn = $retrievedOn; bbox = @($latMin, $lonMin, $latMax, $lonMax); source = 'OpenStreetMap via Overpass (ODbL)'; candidatos = $candidatosOsm.ToArray() } |
    ConvertTo-Json -Depth 6 | Set-Content (Join-Path $salida 'candidatos-osm.json') -Encoding UTF8
[ordered]@{ generatedOn = $retrievedOn; bbox = @($latMin, $lonMin, $latMax, $lonMax); source = 'Secretaria de Energia, Precios en surtidor Res. 314/2016 (CC-BY-4.0)'; estaciones = @($estaciones.Values | Sort-Object localidad, empresa) } |
    ConvertTo-Json -Depth 6 | Set-Content (Join-Path $salida 'candidatos-energia.json') -Encoding UTF8

Write-Host "Escrito en $salida" -ForegroundColor Green
