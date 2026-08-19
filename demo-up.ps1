<#
.SYNOPSIS
    Levanta todo lo que la demo necesita y publica la API por HTTPS.

.DESCRIPTION
    Arranca GraphHopper y la API en local, y expone la API con un tunel de
    Cloudflare. El resultado es una URL publica con TLS a la que el telefono
    llega desde cualquier red, sin depender del WiFi de casa.

    Se expone SOLO la API. GraphHopper queda en localhost: la app nunca lo
    consulta directo.

    La contra de este modo es que la maquina tiene que quedar prendida mientras
    dure la demo, y que la URL cambia en cada arranque del tunel. Si la demo
    tiene que andar sola, el deploy en servidor esta en docs/deploy.md.

.PARAMETER SkipTunnel
    Levanta solo GraphHopper y la API, para probar en la red local.

.EXAMPLE
    ./demo-up.ps1
#>
[CmdletBinding()]
param(
    [switch] $SkipTunnel
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$log = Join-Path $env:TEMP "trucknavigator-tunnel-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Wait-For {
    param([string] $Url, [string] $Name, [int] $Seconds = 180, [int] $TimeoutSec = 3)

    for ($i = 0; $i -lt $Seconds; $i += 3) {
        try {
            Invoke-RestMethod $Url -TimeoutSec $TimeoutSec | Out-Null
            Write-Host "  $Name listo" -ForegroundColor Green
            return $true
        }
        catch {
            Start-Sleep -Seconds 3
        }
    }

    return $false
}

<#
.SYNOPSIS
    Distingue "el tunel no anda" de "mi DNS todavia no lo ve".
.DESCRIPTION
    Los hostnames de trycloudflare.com se crean recien al abrir el tunel, y
    algunos resolvedores tardan en verlos o directamente no resuelven los
    subdominios nuevos. Eso NO significa que el tunel este caido: el telefono usa
    otro resolvedor y suele llegar sin problema. Preguntarle a 1.1.1.1 separa los
    dos casos en vez de reportar un fallo generico.
#>
function Test-DnsElsewhere {
    param([string] $Hostname)

    try {
        $answer = Resolve-DnsName $Hostname -Server 1.1.1.1 -Type A -ErrorAction Stop |
            Where-Object IPAddress | Select-Object -First 1

        return $null -ne $answer
    }
    catch {
        return $false
    }
}

# --- Motor de ruteo ------------------------------------------------------

if (Get-Process java -ErrorAction SilentlyContinue) {
    Write-Host "GraphHopper ya estaba corriendo" -ForegroundColor DarkGray
}
else {
    Write-Host "Levantando GraphHopper ..." -ForegroundColor Cyan
    Start-Process -FilePath 'pwsh' `
        -ArgumentList '-NoProfile', '-File', (Join-Path $root 'routing\run-graphhopper.ps1') `
        -WindowStyle Hidden
}

if (-not (Wait-For -Url 'http://localhost:8989/health' -Name 'GraphHopper')) {
    throw 'GraphHopper no respondio. Revisa routing/run-graphhopper.ps1.'
}

# --- API -----------------------------------------------------------------

if (Get-Process -Name 'TruckNavigator.Api' -ErrorAction SilentlyContinue) {
    Write-Host "La API ya estaba corriendo" -ForegroundColor DarkGray
}
else {
    Write-Host "Levantando la API ..." -ForegroundColor Cyan
    Start-Process -FilePath 'dotnet' `
        -ArgumentList 'run', '--project', 'src/TruckNavigator.Api' `
        -WorkingDirectory $root -WindowStyle Hidden
}

if (-not (Wait-For -Url 'http://localhost:5080/api/health' -Name 'API')) {
    throw 'La API no respondio. Probala a mano con: dotnet run --project src/TruckNavigator.Api'
}

if ($SkipTunnel) {
    Write-Host "`nListo en la red local: http://localhost:5080" -ForegroundColor Green
    return
}

# --- Tunel ---------------------------------------------------------------

$cloudflared = Join-Path ${env:ProgramFiles(x86)} 'cloudflared\cloudflared.exe'

if (-not (Test-Path $cloudflared)) {
    $cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
}

if (-not $cloudflared) {
    throw "Falta cloudflared. Instalalo con: winget install --id Cloudflare.cloudflared"
}

Write-Host "Abriendo el tunel ..." -ForegroundColor Cyan

Start-Process -FilePath $cloudflared `
    -ArgumentList 'tunnel', '--url', 'http://localhost:5080', '--no-autoupdate' `
    -RedirectStandardError $log -WindowStyle Hidden

$url = $null

for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 2

    if (Test-Path $log) {
        $match = (Select-String -LiteralPath $log `
            -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches).Matches.Value |
            Select-Object -First 1

        if ($match) { $url = $match }
    }
}

if (-not $url) {
    throw "El tunel no publico una URL. Log: $log"
}

Write-Host "  comprobando la URL publica ..." -ForegroundColor DarkGray

$reachable = Wait-For -Url "$url/api/health" -Name 'Tunel' -Seconds 90 -TimeoutSec 15

Write-Host ""
Write-Host "  URL publica: $url" -ForegroundColor Green
Write-Host ""

if (-not $reachable) {
    $tunnelHost = ([Uri] $url).Host

    if (Test-DnsElsewhere -Hostname $tunnelHost) {
        Write-Warning @"
El tunel esta arriba pero TU resolvedor de DNS todavia no ve el hostname
($tunnelHost). Desde 1.1.1.1 si resuelve, asi que el telefono probablemente
llegue igual. Comprobalo con:

  adb shell "curl -s -m 20 $url/api/health"

Si tampoco anda desde el telefono, cerra y volve a abrir con ./demo-down.ps1 y
./demo-up.ps1 para que el tunel tome otro nombre.
"@
    }
    else {
        Write-Warning @"
El tunel publico la URL pero no responde ni resuelve por DNS publico. Revisa el
log: $log
"@
    }
}

Write-Host "Si no coincide con la que trae la APK, tenes dos opciones:" -ForegroundColor Yellow
Write-Host "  a) en el telefono: Configurar servidor -> pegar esta URL"
Write-Host "  b) recompilar: cambiar DefaultBaseUrl en"
Write-Host "     src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs y correr ./build-apk.ps1"
Write-Host ""
Write-Host "Para bajar todo: ./demo-down.ps1" -ForegroundColor DarkGray
