<#
.SYNOPSIS
    Baja el tunel, la API y el motor de ruteo que levanto demo-up.ps1.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

foreach ($name in @('cloudflared', 'TruckNavigator.Api', 'java')) {
    $processes = Get-Process -Name $name -ErrorAction SilentlyContinue

    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "$name detenido" -ForegroundColor DarkGray
    }
    else {
        Write-Host "$name no estaba corriendo" -ForegroundColor DarkGray
    }
}
