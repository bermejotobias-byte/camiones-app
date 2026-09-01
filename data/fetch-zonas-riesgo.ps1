<#
.SYNOPSIS
    Genera la capa de zonas de riesgo de CABA desde el Mapa del Delito oficial.

.DESCRIPTION
    Fuente: dataset "Delitos" de Buenos Aires Data, publicado por el Ministerio
    de Justicia y Seguridad del GCBA. Licencia CC-BY. Un archivo por anio, con
    latitud y longitud por hecho. El de 2025 trae 133.203 registros.

    QUE HECHOS ENTRAN, Y POR QUE ESOS

    De los seis tipos del dataset se usan dos cosas y se descartan cuatro:

        Robo               50.069   ENTRA  hay fuerza o violencia: es lo que
                                           amenaza a alguien parado en la calle
        Hurto automotor     4.539   ENTRA  le roban el vehiculo
        Hurto (resto)      45.102   queda afuera: carterismo y descuidos, no
                                    cambia por donde conviene pasar con un camion
        Lesiones           11.544   queda afuera: violencia interpersonal, buena
        Amenazas           10.111   parte en ambito privado
        Homicidios             78   queda afuera por lo mismo
        Vialidad           11.760   queda afuera: son siniestros de transito, otro
                                    fenomeno. Serian una capa distinta, no esta.

    Quedan 54.475 hechos ubicados. El criterio esta explicito aca arriba a
    proposito: es un recorte discutible y quien lo quiera cambiar tiene que poder
    ver que se decidio y con que numeros.

    COMO SE ARMA LA ESCALA

    Grilla de 250 m. Cada celda se compara contra la densidad media de la Ciudad
    —hechos totales sobre los 204 km2 de CABA— y se emite SOLO si duplica esa
    media. Ese corte no es cosmetico: en 2025 el 92% de las celdas de la Ciudad
    registro al menos un hecho, asi que pintar todo lo que tiene delito es pintar
    CABA entera de rojo y no informar nada. La informacion esta en los extremos.

        x2 a x3 la media    alta
        x3 a x5             muy alta
        x5 o mas            extrema

    Expresar el nivel en multiplos de la media —y no en cuantiles— es lo que hace
    que la leyenda se explique sola: "el triple que el promedio de la ciudad" se
    entiende sin saber estadistica.

    LO QUE ESTE DATO NO DICE

    - Que no haya zona pintada NO significa que ahi no pase nada: significa que
      no llega al doble de la media. La leyenda de la app tiene que decirlo.
    - Son hechos DENUNCIADOS. El delito no denunciado no esta, y la propension a
      denunciar no es igual en toda la Ciudad.
    - Es densidad absoluta, sin normalizar por cuanta gente circula. Una celda de
      microcentro tiene mas hechos en parte porque pasa mas gente. Para decidir
      donde parar un camion eso igual sirve: lo que importa es que tan probable
      es que pase algo ahi, no la tasa per capita.
    - Solo CABA. El dataset es del Gobierno de la Ciudad y no cubre el conurbano.

.PARAMETER Anio
    Anio del dataset. 2025 es el ultimo completo publicado.

.PARAMETER LadoMetros
    Lado de la celda. 250 m son unas dos manzanas por lado.

.EXAMPLE
    .\data\fetch-zonas-riesgo.ps1
#>
[CmdletBinding()]
param(
    [int] $Anio = 2025,
    [int] $LadoMetros = 250,
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

foreach ($obligatoria in 'tipo', 'subtipo', 'latitud', 'longitud', 'barrio', 'franja') {
    if (-not $col.ContainsKey($obligatoria)) {
        throw "El dataset no trae la columna '$obligatoria'. Cambio el formato: revisar la fuente antes de seguir."
    }
}

# Proyeccion plana local. A la latitud de Buenos Aires y sobre 200 km2 el error
# es de centimetros: no hace falta nada mas caro para agrupar en celdas.
$metrosPorGradoLat = 110574.0
$metrosPorGradoLng = 111320.0 * [math]::Cos(-34.61 * [math]::PI / 180.0)

$celdas = @{}
$total = 0
$sinCoordenada = 0
$descartados = 0

foreach ($linea in $lineas[1..($lineas.Count - 1)]) {
    if ([string]::IsNullOrWhiteSpace($linea)) { continue }

    $f = $linea.Split(',')
    $tipo = $f[$col['tipo']].Trim('"')
    $subtipo = $f[$col['subtipo']].Trim('"')

    # Robo (cualquier subtipo) mas el hurto de vehiculos. Ver el encabezado.
    $esAutomotor = $subtipo -like '*automotor*'
    if (-not ($tipo -eq 'Robo' -or $esAutomotor)) { $descartados++; continue }

    $lat = 0.0; $lng = 0.0
    $okLat = [double]::TryParse($f[$col['latitud']].Trim('"'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref] $lat)
    $okLng = [double]::TryParse($f[$col['longitud']].Trim('"'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref] $lng)

    # El 2% de los registros viene sin ubicar. Se cuentan y se informan: son
    # hechos que existieron y que este mapa no puede mostrar.
    if (-not $okLat -or -not $okLng -or $lat -eq 0 -or $lng -eq 0) { $sinCoordenada++; continue }

    # Control de cordura. Si un punto cae fuera de la Ciudad, algo se leyo mal.
    if ($lat -lt -34.75 -or $lat -gt -34.50 -or $lng -lt -58.56 -or $lng -gt -58.32) {
        $sinCoordenada++; continue
    }

    $total++

    $cx = [math]::Floor($lng * $metrosPorGradoLng / $LadoMetros)
    $cy = [math]::Floor($lat * $metrosPorGradoLat / $LadoMetros)
    $clave = "$cx|$cy"

    if (-not $celdas.ContainsKey($clave)) {
        $celdas[$clave] = [pscustomobject] @{
            cx = $cx; cy = $cy; hechos = 0; automotor = 0; noche = 0
            barrios = @{}
        }
    }

    $celda = $celdas[$clave]
    $celda.hechos++
    if ($esAutomotor) { $celda.automotor++ }

    # Franja horaria: el dataset la da como hora entera 0..23. Se cuenta como
    # nocturno de 22 a 5 inclusive, que es cuando el camion suele estar parado.
    $franja = -1
    [void] [int]::TryParse($f[$col['franja']].Trim('"'), [ref] $franja)
    if ($franja -ge 22 -or ($franja -ge 0 -and $franja -le 5)) { $celda.noche++ }

    $barrio = $f[$col['barrio']].Trim('"')
    if ($barrio) { $celda.barrios[$barrio] = 1 + $celda.barrios[$barrio] }
}

$areaCelda = [math]::Pow($LadoMetros / 1000.0, 2)
$densidadMedia = $total / $superficieCaba
$mediaPorCelda = $densidadMedia * $areaCelda

Write-Host ""
Write-Host "Hechos considerados (robo + hurto automotor): $total" -ForegroundColor DarkGray
Write-Host "  descartados por tipo:            $descartados" -ForegroundColor DarkGray
Write-Host "  sin coordenada utilizable:       $sinCoordenada" -ForegroundColor DarkYellow
Write-Host ("  densidad media de CABA:          {0:N0} hechos/km2 = {1:N1} por celda de {2} m" -f $densidadMedia, $mediaPorCelda, $LadoMetros) -ForegroundColor DarkGray
Write-Host "  celdas con al menos un hecho:    $($celdas.Count)" -ForegroundColor DarkGray

# Los cortes. Ver el encabezado: en multiplos de la media, no en cuantiles.
$corteAlta    = $mediaPorCelda * 2
$corteMuyAlta = $mediaPorCelda * 3
$corteExtrema = $mediaPorCelda * 5

$features = New-Object System.Collections.ArrayList
$porNivel = @{ alta = 0; 'muy-alta' = 0; extrema = 0 }

foreach ($celda in $celdas.Values) {
    if ($celda.hechos -lt $corteAlta) { continue }

    $nivel = if ($celda.hechos -ge $corteExtrema) { 'extrema' }
             elseif ($celda.hechos -ge $corteMuyAlta) { 'muy-alta' }
             else { 'alta' }

    $porNivel[$nivel]++

    # CENTRO de la celda, no su cuadrado.
    #
    # La app dibuja cada celda como un circulo difuminado que se funde con sus
    # vecinos, y una capa `circle` de MapLibre solo dibuja geometrias de tipo
    # punto: con un poligono no dibuja nada y tampoco avisa. Ademas el cuadrado
    # de 250 m es una unidad de calculo, no un hecho del territorio, asi que
    # publicarlo invitaba a dibujarlo.
    $centroLng = [math]::Round(($celda.cx + 0.5) * $LadoMetros / $metrosPorGradoLng, 6)
    $centroLat = [math]::Round(($celda.cy + 0.5) * $LadoMetros / $metrosPorGradoLat, 6)

    $barrio = ($celda.barrios.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key

    [void] $features.Add([ordered] @{
        type       = 'Feature'
        properties = [ordered] @{
            nivel     = $nivel
            hechos    = $celda.hechos
            veces     = [math]::Round($celda.hechos / $mediaPorCelda, 1)
            automotor = $celda.automotor
            noche     = $celda.noche
            barrio    = $barrio
            # El anio se repite en cada celda aunque ya este en la cabecera del
            # documento. Son 4 KB bien gastados: la app arma el texto del toque
            # con las propiedades de la feature y sin esto tendria que llevar el
            # anio escrito en el codigo, que es como se termina mostrando una
            # fecha vieja durante meses sin que nadie lo note.
            anio      = $Anio
        }
        geometry   = [ordered] @{
            type        = 'Point'
            coordinates = @($centroLng, $centroLat)
        }
    })
}

$documento = [ordered] @{
    type        = 'FeatureCollection'
    name        = 'zonas-riesgo'
    description = "Celdas de $LadoMetros m donde los robos y hurtos de vehiculos denunciados en $Anio superan el doble de la densidad media de la Ciudad. Que una celda no aparezca no significa que no haya hechos: significa que no llega a ese doble."
    attribution = "Buenos Aires Data - Mapa del Delito $Anio (CC-BY), Ministerio de Justicia y Seguridad del GCBA"
    source      = 'https://data.buenosaires.gob.ar/dataset/delitos'
    anio        = $Anio
    ladoMetros  = $LadoMetros
    # Se guardan los numeros con los que se armo la escala: sin ellos las
    # propiedades "veces" y "nivel" no se pueden auditar ni reproducir.
    baseline    = [ordered] @{
        hechos            = $total
        sinCoordenada     = $sinCoordenada
        superficieKm2     = $superficieCaba
        densidadMediaKm2  = [math]::Round($densidadMedia, 1)
        mediaPorCelda     = [math]::Round($mediaPorCelda, 2)
    }
    generatedOn = (Get-Date).ToString('yyyy-MM-dd')
    features    = $features
}

$destino = Join-Path $OutputDirectory 'zonas-riesgo.geojson'
$documento | ConvertTo-Json -Depth 10 -Compress | Set-Content -Path $destino -Encoding UTF8

$peso = [math]::Round((Get-Item $destino).Length / 1KB, 1)

Write-Host ""
Write-Host ("Zonas de riesgo: {0} celdas -> {1} ({2} KB)" -f $features.Count, $destino, $peso) -ForegroundColor Green
Write-Host ("  alta (x2 a x3):      {0,4}   desde {1:N0} hechos" -f $porNivel['alta'], [math]::Ceiling($corteAlta)) -ForegroundColor DarkGray
Write-Host ("  muy alta (x3 a x5):  {0,4}   desde {1:N0} hechos" -f $porNivel['muy-alta'], [math]::Ceiling($corteMuyAlta)) -ForegroundColor DarkGray
Write-Host ("  extrema (x5 o mas):  {0,4}   desde {1:N0} hechos" -f $porNivel['extrema'], [math]::Ceiling($corteExtrema)) -ForegroundColor DarkGray
