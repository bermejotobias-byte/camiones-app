<#
.SYNOPSIS
    Compila el APK de Android y opcionalmente lo copia al teléfono.

.DESCRIPTION
    Limpia los artefactos de compilación antes de construir. No es paranoia:
    una compilación incremental en Release rompe el APK con el error

        Compressed assembly '<assembly_store>' is larger than when the
        application was built. Assemblies don't grow just like that!

    y la app aborta al arrancar (SIGABRT). El runtime de .NET Android guarda el
    tamaño máximo de los assemblies comprimidos en una cabecera al compilar, y
    una recompilación incremental actualiza los assemblies sin actualizarla.

.PARAMETER Push
    Copia el APK a la carpeta Descargas del teléfono conectado por adb, para
    instalarlo tocando el archivo. Es el camino cuando "Instalar vía USB" está
    deshabilitado (habitual en Xiaomi sin cuenta Mi).

.PARAMETER ApiUrl
    Backend con el que queda el APK. Evita tener que editar a mano
    TruckNavigatorApi.DefaultBaseUrl cada vez que cambia la URL del túnel, que es
    en cada arranque.

.EXAMPLE
    .\build-apk.ps1 -Push

.EXAMPLE
    .\build-apk.ps1 -ApiUrl https://algo.trycloudflare.com
#>
[CmdletBinding()]
param(
    [switch]$Push,
    [string]$ApiUrl,
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$project = 'src/TruckNavigator.Mobile'

if ($ApiUrl) {
    $apiFile = "$project/Services/TruckNavigatorApi.cs"
    $url = $ApiUrl.Trim().TrimEnd('/')

    if ($url -notmatch '^https?://') {
        throw "ApiUrl tiene que empezar con http:// o https:// (llego '$ApiUrl')."
    }

    # Android bloquea el trafico sin TLS salvo las excepciones declaradas en
    # network_security_config.xml, que solo cubren la red de desarrollo.
    if ($url -match '^http://' -and $url -notmatch '^http://(192\.168\.|10\.0\.2\.2|localhost)') {
        Write-Warning "$url es HTTP sin TLS: Android lo va a bloquear salvo que agregues el dominio a network_security_config.xml."
    }

    $content = Get-Content $apiFile -Raw
    $pattern = '(public const string DefaultBaseUrl = ")[^"]*(";)'

    if ($content -notmatch $pattern) {
        throw "No se encontro DefaultBaseUrl en $apiFile."
    }

    Set-Content $apiFile -Value ($content -replace $pattern, "`${1}$url`${2}") -NoNewline
    Write-Host "Backend del APK: $url" -ForegroundColor Cyan
}

# .NET Android soporta JDK 17-21. Si el JDK del PATH es más nuevo, el build falla.
$microsoftJdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

if ($microsoftJdk) {
    $env:JAVA_HOME = $microsoftJdk.FullName
    Write-Host "JDK: $env:JAVA_HOME" -ForegroundColor DarkGray
}

Write-Host 'Limpiando artefactos previos ...' -ForegroundColor Cyan
Remove-Item "$project/obj" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$project/bin" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Compilando $Configuration ..." -ForegroundColor Cyan
dotnet build $project -f net10.0-android -c $Configuration -p:AndroidPackageFormat=apk --nologo

if ($LASTEXITCODE -ne 0) {
    throw 'Falló la compilación.'
}

$built = "$project/bin/$Configuration/net10.0-android/ar.com.trucknavigator.caba-Signed.apk"
Copy-Item $built 'NavegadorCamiones.apk' -Force

$size = [math]::Round((Get-Item 'NavegadorCamiones.apk').Length / 1MB, 1)
Write-Host "APK listo: NavegadorCamiones.apk ($size MB)" -ForegroundColor Green

if (-not $Push) {
    return
}

$adb = 'C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe'

if (-not (Test-Path $adb)) {
    Write-Warning "No se encontró adb en $adb"
    return
}

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' }

if (-not $devices) {
    Write-Warning 'No hay ningún dispositivo conectado y autorizado.'
    return
}

# Se intenta la instalación directa; si el teléfono la restringe, se deja el
# archivo en Descargas para instalarlo a mano.
& $adb install -r 'NavegadorCamiones.apk'

if ($LASTEXITCODE -ne 0) {
    Write-Host 'La instalación directa está restringida; copiando a Descargas ...' -ForegroundColor Yellow
    & $adb push 'NavegadorCamiones.apk' /sdcard/Download/NavegadorCamiones.apk
    Write-Host 'Instalalo desde el gestor de archivos del teléfono.' -ForegroundColor Green
}
