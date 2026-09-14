# Prepara las imagenes del lienzo de diseño: poses achicadas a 320 px y la cabeza
param([int[]] $Cabeza = @(120, 36, 271, 214))
# sola (recortada de la pose de la torta) para el sello, en color y en silueta.
Add-Type -AssemblyName System.Drawing

$origen = Join-Path $PSScriptRoot "..\..\..\src\TruckNavigator.Api\wwwroot\img\mascota"
$destino = $PSScriptRoot

$cs = @'
using System;
public static class Px {
  public static void Posterizar(byte[] px, int n, int bits) {
    int paso = 1 << (8 - bits);
    for (int i = 0; i < n; i++) {
      if (px[i*4+3] == 0) { px[i*4] = px[i*4+1] = px[i*4+2] = 0; continue; }
      for (int c = 0; c < 3; c++) { int v = px[i*4+c]; v = (v + paso/2) / paso * paso; px[i*4+c] = (byte)Math.Min(255, v); }
    }
  }
  public static void Silueta(byte[] px, int n) {
    for (int i = 0; i < n; i++) { if (px[i*4+3] > 0) { px[i*4] = px[i*4+1] = px[i*4+2] = 255; px[i*4+3] = (byte)(px[i*4+3] >= 96 ? 255 : 0); } }
  }
}
'@
Add-Type -TypeDefinition $cs

function Guardar($bmpPre, [string] $salida, [bool] $silueta = $false) {
  $w = $bmpPre.Width; $h = $bmpPre.Height
  $plana = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($plana)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.DrawImage($bmpPre, 0, 0, $w, $h); $g.Dispose()
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $plana.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($data.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
  if ($silueta) { [Px]::Silueta($buf, $data.Stride * $h / 4) } else { [Px]::Posterizar($buf, $data.Stride * $h / 4, 5) }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $buf.Length)
  $plana.UnlockBits($data)
  $plana.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png); $plana.Dispose()
  "{0,-18} {1}x{2}  {3:n0} KB" -f (Split-Path $salida -Leaf), $w, $h, ((Get-Item $salida).Length / 1KB)
}

function Dibujar($src, [int] $sx, [int] $sy, [int] $sw, [int] $sh, [int] $lado, [int] $dw, [int] $dh) {
  # premultiplicado para que la interpolacion no arrastre negro
  $pre = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g0 = [System.Drawing.Graphics]::FromImage($pre); $g0.CompositingMode = 'SourceCopy'; $g0.DrawImage($src, 0, 0, $src.Width, $src.Height); $g0.Dispose()
  $tela = New-Object System.Drawing.Bitmap $lado, $lado, ([System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($tela)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes; $attrs.SetWrapMode('TileFlipXY')
  $dest = New-Object System.Drawing.Rectangle ([int](($lado - $dw) / 2)), ([int](($lado - $dh) / 2)), $dw, $dh
  $g.DrawImage($pre, $dest, $sx, $sy, $sw, $sh, 'Pixel', $attrs); $g.Dispose(); $pre.Dispose()
  return $tela
}

# --- poses a 320 --------------------------------------------------------------
foreach ($pose in @('festejo', 'mapa', 'rueda', 'binoculares', 'mate', 'combustible', 'durmiendo', 'joystick', 'torta', 'radar')) {
  $src = New-Object System.Drawing.Bitmap (Join-Path $origen "$pose.png")
  $tela = Dibujar $src 0 0 $src.Width $src.Height 320 320 320
  Guardar $tela (Join-Path $destino "$pose.png")
  $tela.Dispose(); $src.Dispose()
}

# --- la cabeza, recortada de la torta (512): gorra arriba, menton abajo ---------
$src = New-Object System.Drawing.Bitmap (Join-Path $origen "torta.png")
$cx = $Cabeza[0]; $cy = $Cabeza[1]; $cw = $Cabeza[2]; $ch = $Cabeza[3]
$lado = 256; $escala = [math]::Min(($lado - 16) / $cw, ($lado - 16) / $ch)
$tela = Dibujar $src $cx $cy $cw $ch $lado ([int]($cw * $escala)) ([int]($ch * $escala))
Guardar $tela (Join-Path $destino "cabeza.png")
$tela.Dispose()
$tela = Dibujar $src $cx $cy $cw $ch $lado ([int]($cw * $escala)) ([int]($ch * $escala))
Guardar $tela (Join-Path $destino "cabeza-silueta.png") $true
$tela.Dispose(); $src.Dispose()
