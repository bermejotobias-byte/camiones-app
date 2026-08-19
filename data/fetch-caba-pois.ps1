<#
.SYNOPSIS
    Genera el dataset de puntos de interes de CABA a partir de OpenStreetMap.

.DESCRIPTION
    Consulta Overpass y escribe src/TruckNavigator.Infrastructure/Data/pois-caba-osm.json.

    Se corre en tiempo de autoria, nunca en tiempo de ejecucion: la app y la API
    trabajan siempre contra el JSON generado, igual que el ruteo trabaja contra el
    grafo local y no contra Overpass (ver docs/data-sources.md).

    Reglas que el script respeta y que no hay que relajar:

    - Solo entran objetos con nombre. Un "taller sin nombre" no le sirve a nadie.
    - La aptitud para camion se marca SOLO si el objeto tiene una etiqueta hgv
      explicita. Si no la tiene, queda en null ("no consta"), nunca en false.
    - Cada punto arrastra su identificador de OSM como fuente.

.PARAMETER MaxPerCategory
    Cuantos puntos conservar por categoria, ordenados por completitud de datos.
    El dataset completo son cientos de objetos; el MVP no necesita dibujarlos todos.

.PARAMETER Endpoint
    Instancia de Overpass. El endpoint principal suele estar saturado.

.EXAMPLE
    ./data/fetch-caba-pois.ps1 -MaxPerCategory 25
#>
[CmdletBinding()]
param(
    [int] $MaxPerCategory = 25,
    [string] $Endpoint = 'https://overpass.kumi.systems/api/interpreter',
    [string] $OutputPath = "$PSScriptRoot/../src/TruckNavigator.Infrastructure/Data/pois-caba-osm.json"
)

$ErrorActionPreference = 'Stop'

# Relacion de OSM para la Ciudad Autonoma de Buenos Aires (3600000000 + 1224652).
$cabaArea = 3601224652

$query = @"
[out:json][timeout:180];
area($cabaArea)->.caba;
(
  nwr["amenity"="fuel"]["name"](area.caba);
  nwr["shop"~"^(car_repair|truck_repair|truck)$"]["name"](area.caba);
  nwr["shop"="tyres"]["name"](area.caba);
  nwr["amenity"="parking"]["hgv"](area.caba);
  nwr["amenity"="parking"]["access"="hgv"](area.caba);
  nwr["amenity"="truck_stop"](area.caba);
);
out center tags;
"@

Write-Host "Consultando Overpass ($Endpoint)..." -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $query -TimeoutSec 300

$retrievedOn = (Get-Date).ToString('yyyy-MM-dd')

Write-Host "Objetos recibidos: $($response.elements.Count)" -ForegroundColor Cyan

function Get-Category {
    param($tags)

    if ($tags.amenity -eq 'truck_stop') { return 'TruckParking' }
    if ($tags.amenity -eq 'parking') { return 'TruckParking' }
    if ($tags.amenity -eq 'fuel') { return 'FuelStation' }
    if ($tags.shop -eq 'tyres') { return 'TyreShop' }
    if ($tags.shop -in @('car_repair', 'truck_repair', 'truck')) { return 'RepairShop' }

    return $null
}

function Get-Address {
    param($tags)

    $street = $tags.'addr:street'
    if (-not $street) { return $null }

    $number = $tags.'addr:housenumber'
    if ($number) { return "$street $number" }

    return $street
}

# La aptitud se declara solo cuando OSM la declara. La ausencia de etiqueta hgv es
# ausencia de dato, no una negativa.
function Get-HgvSuitability {
    param($tags)

    $hgv = $tags.hgv
    if (-not $hgv) { $hgv = $tags.'access:hgv' }

    switch ($hgv) {
        { $_ -in @('yes', 'designated', 'permissive') } { return $true }
        { $_ -in @('no', 'private') } { return $false }
        default { return $null }
    }
}

function Get-Services {
    param($tags)

    $services = [System.Collections.Generic.List[string]]::new()

    if ($tags.'fuel:diesel' -eq 'yes') { $services.Add('Gasoil') }
    if ($tags.'fuel:HGV_diesel' -eq 'yes') { $services.Add('Gasoil para camiones') }
    if ($tags.'fuel:GNC' -eq 'yes' -or $tags.'fuel:cng' -eq 'yes') { $services.Add('GNC') }
    if ($tags.'fuel:adblue' -eq 'yes') { $services.Add('AdBlue') }
    if ($tags.compressed_air -eq 'yes') { $services.Add('Aire comprimido') }
    if ($tags.car_wash -eq 'yes') { $services.Add('Lavadero') }
    if ($tags.shop -eq 'tyres') { $services.Add('Cubiertas') }
    if ($tags.'service:vehicle:tyres' -eq 'yes') { $services.Add('Cubiertas') }

    return , @($services | Select-Object -Unique)
}

# Ordena por cuanta informacion util trae el objeto: si hay que recortar, que queden
# los mejor documentados.
function Get-Completeness {
    param($tags)

    $score = 0
    foreach ($key in @('addr:street', 'opening_hours', 'phone', 'contact:phone',
                       'website', 'contact:website', 'brand', 'operator', 'hgv')) {
        if ($tags.$key) { $score++ }
    }

    return $score
}

$points = foreach ($element in $response.elements) {
    $tags = $element.tags
    if (-not $tags -or -not $tags.name) { continue }

    $category = Get-Category $tags
    if (-not $category) { continue }

    $lat = if ($element.type -eq 'node') { $element.lat } else { $element.center.lat }
    $lon = if ($element.type -eq 'node') { $element.lon } else { $element.center.lon }
    if ($null -eq $lat -or $null -eq $lon) { continue }

    $hgv = Get-HgvSuitability $tags

    $phone = if ($tags.phone) { $tags.phone } else { $tags.'contact:phone' }
    $website = if ($tags.website) { $tags.website } else { $tags.'contact:website' }

    # El operador solo, sin etiquetar, se lee como una descripcion escrita por
    # nosotros. Con el prefijo queda claro que es un dato copiado de la fuente.
    $description = if ($tags.operator) { "Operador: $($tags.operator)" } else { $null }

    [pscustomobject]@{
        Category     = $category
        Completeness = Get-Completeness $tags
        Data         = [ordered]@{
            name                   = $tags.name
            category               = $category
            address                = Get-Address $tags
            neighbourhood          = $tags.'addr:suburb'
            latitude               = [math]::Round([double]$lat, 6)
            longitude              = [math]::Round([double]$lon, 6)
            phone                  = $phone
            website                = $website
            openingHours           = $tags.opening_hours
            description            = $description
            services               = Get-Services $tags
            suitableForLightTruck  = $hgv
            suitableForHeavyTruck  = $hgv
            suitableForSemiTrailer = $hgv
            suitableForTrailer     = $hgv
            source                 = "OpenStreetMap $($element.type)/$($element.id) (consultado $retrievedOn)"
            sourceRetrievedOn      = $retrievedOn
            # Una etiqueta hgv explicita es lo que declara el mapeador, no una
            # verificacion independiente: eso es "probable", no "confirmado".
            verificationLevel      = if ($null -ne $hgv) { 'Probable' } else { 'NotConfirmed' }
            isSampleData           = $true
        }
    }
}

$selected = $points |
    Group-Object Category |
    ForEach-Object {
        $_.Group |
            Sort-Object -Property @{ Expression = 'Completeness'; Descending = $true },
                                  @{ Expression = { $_.Data.name }; Descending = $false } |
            Select-Object -First $MaxPerCategory
    }

foreach ($group in $selected | Group-Object Category) {
    Write-Host ("  {0,-24} {1}" -f $group.Name, $group.Count) -ForegroundColor DarkGray
}

$document = [ordered]@{
    generatedOn = $retrievedOn
    generatedBy = 'data/fetch-caba-pois.ps1'
    sourceNote  = 'Extraido de OpenStreetMap (ODbL) via Overpass. Archivo generado: ' +
                  'no editar a mano, volver a correr el script. La aptitud para camion ' +
                  'solo se declara cuando OSM la etiqueta explicitamente.'
    pois        = @($selected | ForEach-Object { $_.Data })
}

$json = $document | ConvertTo-Json -Depth 6
Set-Content -Path $OutputPath -Value $json -Encoding UTF8

Write-Host "Escritos $($document.pois.Count) puntos en $OutputPath" -ForegroundColor Green
