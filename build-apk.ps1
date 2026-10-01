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
    [string]$Configuration = 'Release',

    # --- Firma ------------------------------------------------------------
    #
    # Los valores por defecto son de DESARROLLO. Su unico proposito es que la
    # firma no cambie entre compilaciones, para que el telefono acepte
    # actualizar la app en vez de exigir desinstalarla.
    #
    # NO sirven para distribuir. Para eso hay que generar una clave propia,
    # pasarla por estos parametros, guardarla fuera del repositorio y tener una
    # copia: si se pierde, no se puede volver a publicar una actualizacion de
    # esa aplicacion nunca mas.
    #
    # La clave vive fuera del repositorio a proposito, para que no pueda
    # commitearse por accidente.
    [string]$Keystore = "$env:LOCALAPPDATA\TruckNavigator\firma-desarrollo.keystore",
    [string]$KeyAlias = 'trucknavigator',
    [string]$KeystorePassword = $(
        if ($env:TRUCKNAVIGATOR_KEYSTORE_PASS) { $env:TRUCKNAVIGATOR_KEYSTORE_PASS }
        else { 'camiones-dev' }
    )
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

# --- Clave de firma estable -------------------------------------------------
#
# Sin esto, .NET Android firma con una clave de depuracion que genera solo. Esa
# clave puede regenerarse —y se regenero— dejando un APK que Android rechaza con
# INSTALL_FAILED_UPDATE_INCOMPATIBLE, porque no permite actualizar una app con
# una firma distinta a la instalada. La unica salida entonces es desinstalar,
# perdiendo la sesion y los ajustes del telefono en CADA version nueva.

$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'

if (-not (Test-Path $keytool)) {
    $keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
}

if (-not $keytool) {
    throw 'No se encontro keytool. Viene con el JDK; revisa que este instalado el OpenJDK 21.'
}

if (-not (Test-Path $Keystore)) {
    $carpeta = Split-Path $Keystore -Parent

    if ($carpeta -and -not (Test-Path $carpeta)) {
        New-Item -ItemType Directory -Force $carpeta | Out-Null
    }

    Write-Host "Creando la clave de firma en $Keystore ..." -ForegroundColor Cyan

    & $keytool -genkeypair -noprompt `
        -keystore $Keystore `
        -alias $KeyAlias `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $KeystorePassword -keypass $KeystorePassword `
        -dname 'CN=TruckNavigator Dev, O=TruckNavigator, C=AR' 2>&1 | Out-Null

    if (-not (Test-Path $Keystore)) {
        throw "No se pudo crear la clave de firma en $Keystore."
    }

    Write-Host 'Clave creada.' -ForegroundColor Green
    Write-Host 'Guardala: si se pierde, el telefono deja de poder actualizar la app.' -ForegroundColor Yellow
}

Write-Host 'Limpiando artefactos previos ...' -ForegroundColor Cyan
Remove-Item "$project/obj" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$project/bin" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Compilando $Configuration ..." -ForegroundColor Cyan
dotnet build $project -f net10.0-android -c $Configuration -p:AndroidPackageFormat=apk `
    -p:AndroidKeyStore=true `
    "-p:AndroidSigningKeyStore=$Keystore" `
    "-p:AndroidSigningStorePass=$KeystorePassword" `
    "-p:AndroidSigningKeyAlias=$KeyAlias" `
    "-p:AndroidSigningKeyPass=$KeystorePassword" `
    --nologo

if ($LASTEXITCODE -ne 0) {
    throw 'Falló la compilación.'
}

$built = "$project/bin/$Configuration/net10.0-android/ar.com.trucknavigator.caba-Signed.apk"
Copy-Item $built 'NavegadorCamiones.apk' -Force

$size = [math]::Round((Get-Item 'NavegadorCamiones.apk').Length / 1MB, 1)
Write-Host "APK listo: NavegadorCamiones.apk ($size MB)" -ForegroundColor Green

# La huella de la firma, para poder comprobar de un vistazo que no cambio. Si
# cambia entre dos compilaciones, el telefono va a rechazar la actualizacion y
# conviene saberlo aca y no al instalar.
$apksigner = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'apksigner.bat' } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

if ($apksigner) {
    $huella = & $apksigner verify --print-certs 'NavegadorCamiones.apk' 2>&1 |
        Select-String 'SHA-256 digest' |
        Select-Object -First 1

    if ($huella) {
        Write-Host "Firma: $(($huella.Line -split ':')[-1].Trim())" -ForegroundColor DarkGray
    }
}

if (-not $Push) {
    return
}

# adb vive donde haya quedado el SDK: el instalador de Visual Studio lo pone en
# Program Files (x86) y Android Studio en el perfil del usuario. Buscarlo en una
# sola ruta hacía que -Push avisara "no encontré adb" con el teléfono enchufado.
$candidatosAdb = @(
    if ($env:ANDROID_HOME) { "$env:ANDROID_HOME\platform-tools\adb.exe" }
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    'C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe'
    'C:\Program Files\Android\android-sdk\platform-tools\adb.exe'
    (Get-Command adb -ErrorAction SilentlyContinue).Source
) | Where-Object { $_ }

$adb = $candidatosAdb | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $adb) {
    Write-Warning "No se encontró adb. Buscado en:`n  $($candidatosAdb -join "`n  ")"
    return
}

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' }

if (-not $devices) {
    Write-Warning 'No hay ningún dispositivo conectado y autorizado.'
    return
}

# Se intenta la instalación directa; si el teléfono la rechaza, se deja el
# archivo en Descargas para instalarlo a mano.
#
# El motivo del rechazo se MUESTRA, no se resume. Antes este bloque decía
# siempre "la instalación directa está restringida", pasara lo que pasara: eso
# escondió un INSTALL_FAILED_UPDATE_INCOMPATIBLE —firma distinta— detrás de una
# explicación equivocada, y costó una noche de buscar en el lugar incorrecto.
$salida = & $adb install -r 'NavegadorCamiones.apk' 2>&1

if ($LASTEXITCODE -ne 0) {
    $motivo = ($salida | Select-String 'INSTALL_FAILED_\w+' -AllMatches).Matches.Value |
        Select-Object -First 1

    if (-not $motivo) { $motivo = 'motivo desconocido' }

    Write-Warning "adb no pudo instalar: $motivo"
    $salida | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

    switch ($motivo) {
        'INSTALL_FAILED_UPDATE_INCOMPATIBLE' {
            Write-Host 'La firma no coincide con la app instalada. Hay que desinstalarla una vez:' -ForegroundColor Yellow
            Write-Host '  adb uninstall ar.com.trucknavigator.caba' -ForegroundColor Yellow
        }
        'INSTALL_FAILED_USER_RESTRICTED' {
            Write-Host 'El teléfono bloqueó la instalación. Suele ser "Instalar vía USB" apagado' -ForegroundColor Yellow
            Write-Host 'en Opciones de desarrollador, o la pantalla bloqueada.' -ForegroundColor Yellow
        }
    }

    Write-Host 'Copiando a Descargas para instalarlo a mano ...' -ForegroundColor Cyan
    & $adb push 'NavegadorCamiones.apk' /sdcard/Download/NavegadorCamiones.apk
    Write-Host 'Instalalo desde el gestor de archivos del teléfono.' -ForegroundColor Green
}
