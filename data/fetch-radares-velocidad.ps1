<#
.SYNOPSIS
    Genera la capa de radares de velocidad de CABA desde el dato oficial.

.DESCRIPTION
    Fuente: dataset "Camaras fijas de control vehicular" de Buenos Aires Data,
    publicado por la Direccion General Cuerpo de Agentes de Control de Transito y
    Seguridad Vial. Licencia CC-BY-2.5-AR. Se actualiza cada seis meses.

    El dataset trae 224 puntos de dos tipos, y SOLO uno de los dos es un radar de
    velocidad:

        Cinemometro        129   mide velocidad
        Analitica de video  95   semaforo en rojo, celular, cinturon

    Se queda con los cinemometros. Meter los otros seria decirle al camionero que
    hay un radar donde no lo hay, que es exactamente la clase de dato inventado
    que el proyecto no admite.

    A diferencia de las capas de camion, que salen de OpenStreetMap, esta sale de
    un portal de datos abiertos del gobierno de la Ciudad. Por eso vive en su
    propio script: son fuentes distintas, con licencias y cadencias distintas.

.EXAMPLE
    .\data\fetch-radares-velocidad.ps1
#>
[CmdletBinding()]
param(
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

# Recurso CSV del dataset. Si alguna vez devuelve 404, el id del recurso cambio:
# se busca de nuevo en https://data.buenosaires.gob.ar/dataset/camaras-fijas-control-vehicular
$url = 'https://data.buenosaires.gob.ar/dataset/camaras-fijas-control-vehicular/resource/juqdkmgo-311-resource/download'

$temporal = Join-Path ([System.IO.Path]::GetTempPath()) 'camaras-control-vehicular.csv'

Write-Host 'Descargando el dataset oficial ...' -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $temporal -UseBasicParsing

# El archivo viene en Latin-1, no en UTF-8, y separado por punto y coma.
#
# La decodificacion se hace byte a byte y no con -Encoding Default: aquel usa la
# pagina de codigos de la maquina, que cambia de equipo en equipo y convirtio
# "MARIA" con tilde en "MAR?A". En Latin-1 cada byte ES su punto de codigo, asi
# que este mapeo es exacto para los acentos del castellano y anda igual en
# PowerShell 5.1 y en 7, que difieren en que encodings traen registrados.
$bytes = [System.IO.File]::ReadAllBytes($temporal)
$chars = [char[]]::new($bytes.Length)

for ($i = 0; $i -lt $bytes.Length; $i++) {
    $chars[$i] = [char] $bytes[$i]
}

# Los encabezados se declaran a mano: el original trae "ubicacion" con tilde y
# depender de ese caracter para acceder a la columna es fragil.
$filas = [string]::new($chars) | ConvertFrom-Csv -Delimiter ';' `
    -Header 'tipo', 'ubicacion', 'latitud', 'longitud' | Select-Object -Skip 1

Write-Host "Registros en el dataset: $($filas.Count)" -ForegroundColor DarkGray

# 'Cinemometro' lleva tilde en el original. Se compara por prefijo para no
# depender de como haya sobrevivido ese caracter a la codificacion.
$radares = $filas | Where-Object { $_.tipo -like 'Cinem*' }

if ($radares.Count -eq 0) {
    throw 'No se encontro ningun cinemometro. Cambio el formato del dataset: revisar la fuente antes de seguir.'
}

$features = @()

foreach ($fila in $radares) {
    # Decimales con coma: parsear con la cultura del sistema daria numeros mal o
    # nulos segun la maquina. Se fuerza invariante despues de normalizar.
    $lat = [double]::Parse(($fila.latitud -replace ',', '.'), [Globalization.CultureInfo]::InvariantCulture)
    $lng = [double]::Parse(($fila.longitud -replace ',', '.'), [Globalization.CultureInfo]::InvariantCulture)

    # Control de cordura: si un punto cae fuera de la Ciudad, algo se leyo mal.
    if ($lat -lt -34.75 -or $lat -gt -34.50 -or $lng -lt -58.55 -or $lng -gt -58.32) {
        Write-Warning "Punto fuera de CABA, se descarta: $($fila.ubicacion) ($lat, $lng)"
        continue
    }

    $features += [ordered] @{
        type       = 'Feature'
        geometry   = [ordered] @{ type = 'Point'; coordinates = @($lng, $lat) }
        properties = [ordered] @{ ubicacion = $fila.ubicacion.Trim() }
    }
}

$documento = [ordered] @{
    type        = 'FeatureCollection'
    name        = 'radares-velocidad'
    description = 'Cinemometros (radares de velocidad) fijos de la Ciudad de Buenos Aires.'
    attribution = 'Buenos Aires Data - Camaras fijas de control vehicular (CC-BY-2.5-AR)'
    source      = 'https://data.buenosaires.gob.ar/dataset/camaras-fijas-control-vehicular'
    generatedOn = (Get-Date).ToString('yyyy-MM-dd')
    features    = $features
}

$destino = Join-Path $OutputDirectory 'radares-velocidad.geojson'
$documento | ConvertTo-Json -Depth 8 -Compress | Set-Content -Path $destino -Encoding UTF8

$peso = [math]::Round((Get-Item $destino).Length / 1KB, 1)
Write-Host "Radares de velocidad: $($features.Count) -> $destino ($peso KB)" -ForegroundColor Green
