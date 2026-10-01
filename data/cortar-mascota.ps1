<#
  Corta las hojas de referencia de la mascota (docs/referencias/mascota) en poses
  sueltas, cada una en un PNG cuadrado con fondo transparente, y las deja en
  src/TruckNavigator.Api/wwwroot/img/mascota/<pose>.png. Correr desde la raiz:

      .\data\cortar-mascota.ps1

  Solo necesita .NET (System.Drawing), nada que instalar.

  - Las hojas ya sin fondo (las convirtio el usuario el 12/09/2026 con una
    herramienta en linea) se cortan por los huecos de alfa entre sprites.
  - La hoja del festejo es un JPEG con el damero "transparente" pintado: se le
    saca el damero por inundacion desde el borde (blanco y gris claro, neutros),
    que se frena en el contorno oscuro del dibujo y deja intactos los blancos de
    adentro (ojos, dientes, la gorra). Despues se comen dos pixeles de borde
    claros, que son el halo gris del JPEG y sobre fondo oscuro se veian.
  - Cada hoja tiene su escala: se normaliza para que el mono PARADO mida lo mismo
    en todas, y las poses agachadas quedan mas bajas, como corresponde. No se
    agranda ninguna: si la hoja es chica, el lienzo se achica con ella.
  - Se compone en un lienzo cuadrado, pies al piso, centrado, y el color se
    posteriza a 5 bits por canal: el ruido del JPEG en las zonas planas era lo
    que inflaba los PNG al doble, y el pixel art no tiene degradados que perder.
  - Solo entran las hojas con gorra TBF. Las de gorra MACK quedan afuera: es
    una marca ajena. Por eso falta "neutro" (parado sin hacer nada): la unica
    hoja que lo tiene es de las MACK.
#>
param(
  [int] $Lienzo = 512,       # lado del PNG de salida
  [int] $AltoParado = 464,   # alto del mono parado dentro del lienzo
  [int] $Piso = 12,          # margen abajo
  [int] $Bits = 5            # bits por canal de color al guardar: menos ruido del JPEG, PNG mas chico
)

Add-Type -AssemblyName System.Drawing

$cs = @'
using System;
using System.Collections.Generic;

public static class Sprites
{
    // Saca el damero: inunda desde el borde por pixeles claros y neutros.
    public static void QuitarDamero(byte[] px, int w, int h)
    {
        bool[] fondo = new bool[w * h];
        var cola = new Queue<int>();
        Func<int, bool> claro = i => {
            int b = px[i*4], g = px[i*4+1], r = px[i*4+2];
            int max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
            return min >= 196 && (max - min) <= 14;
        };
        Action<int> meter = i => { if (!fondo[i] && claro(i)) { fondo[i] = true; cola.Enqueue(i); } };
        for (int x = 0; x < w; x++) { meter(x); meter((h-1)*w + x); }
        for (int y = 0; y < h; y++) { meter(y*w); meter(y*w + w-1); }
        while (cola.Count > 0)
        {
            int i = cola.Dequeue(); int x = i % w, y = i / w;
            if (x > 0) meter(i-1); if (x < w-1) meter(i+1);
            if (y > 0) meter(i-w); if (y < h-1) meter(i+w);
        }
        // Entre el damero y el contorno el JPEG deja medios tonos grises, que sobre
        // fondo oscuro se ven como un halo. Se comen dos pixeles de borde que no
        // sean oscuros: el contorno del dibujo tiene ocho de ancho y no se nota.
        for (int pasada = 0; pasada < 2; pasada++)
        {
            var comer = new List<int>();
            for (int i = 0; i < w*h; i++)
            {
                if (fondo[i]) continue;
                int x = i % w, y = i / w;
                bool vecinoFondo = (x > 0 && fondo[i-1]) || (x < w-1 && fondo[i+1]) || (y > 0 && fondo[i-w]) || (y < h-1 && fondo[i+w]);
                if (!vecinoFondo) continue;
                int lum = (px[i*4] + px[i*4+1] + px[i*4+2]) / 3;
                if (lum > 90) comer.Add(i);
            }
            foreach (int i in comer) fondo[i] = true;
        }
        for (int i = 0; i < w*h; i++) if (fondo[i]) px[i*4+3] = 0;
    }

    // Posteriza el color (no el alfa): el ruido del JPEG en las zonas planas es lo
    // que infla el PNG, y el pixel art no tiene degradados que perder.
    public static void Posterizar(byte[] px, int n, int bits)
    {
        int paso = 1 << (8 - bits);
        for (int i = 0; i < n; i++)
        {
            if (px[i*4+3] == 0) { px[i*4] = px[i*4+1] = px[i*4+2] = 0; continue; }
            for (int c = 0; c < 3; c++) { int v = px[i*4+c]; v = (v + paso / 2) / paso * paso; px[i*4+c] = (byte)Math.Min(255, v); }
        }
    }

    public static void LimpiarAlfa(byte[] px, int n, int umbral)
    {
        for (int i = 0; i < n; i++) if (px[i*4+3] < umbral) px[i*4+3] = 0;
    }

    // Tramos [ini, fin] de columnas (o filas) con alfa, separados por huecos.
    public static List<int[]> Tramos(byte[] px, int w, int h, int x0, int y0, int x1, int y1, bool porColumnas, int hueco)
    {
        int n = porColumnas ? (x1 - x0 + 1) : (y1 - y0 + 1);
        int[] cuenta = new int[n];
        for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++)
                if (px[(y*w + x)*4 + 3] >= 128) cuenta[porColumnas ? x - x0 : y - y0]++;
        var tramos = new List<int[]>();
        bool en = false; int ini = 0, vacio = 0;
        for (int i = 0; i < n; i++)
        {
            if (cuenta[i] > 0) { if (!en) { en = true; ini = i; } vacio = 0; }
            else if (en) { vacio++; if (vacio >= hueco) { tramos.Add(new[]{ ini, i - vacio }); en = false; vacio = 0; } }
        }
        if (en) tramos.Add(new[]{ ini, n - 1 - (vacio) });
        int off = porColumnas ? x0 : y0;
        foreach (var t in tramos) { t[0] += off; t[1] += off; }
        return tramos;
    }

    // Caja [x0,y0,x1,y1] del alfa dentro de una region.
    public static int[] Caja(byte[] px, int w, int x0, int y0, int x1, int y1)
    {
        int cx0 = int.MaxValue, cy0 = int.MaxValue, cx1 = -1, cy1 = -1;
        for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++)
                if (px[(y*w + x)*4 + 3] >= 128) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; }
        return new[]{ cx0, cy0, cx1, cy1 };
    }
}
'@
Add-Type -TypeDefinition $cs

function Leer([string] $ruta) {
  $bmp = New-Object System.Drawing.Bitmap $ruta
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $px = New-Object byte[] ($w * $h * 4)
  for ($y = 0; $y -lt $h; $y++) {
    [System.Runtime.InteropServices.Marshal]::Copy([IntPtr]::Add($data.Scan0, $y * $data.Stride), $px, $y * $w * 4, $w * 4)
  }
  $bmp.UnlockBits($data); $bmp.Dispose()
  return @{ px = $px; w = $w; h = $h }
}

function Recortar($img, [int[]] $caja) {
  $cw = $caja[2] - $caja[0] + 1; $ch = $caja[3] - $caja[1] + 1
  $bmp = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $cw, $ch
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $ch; $y++) {
    $desde = (($caja[1] + $y) * $img.w + $caja[0]) * 4
    [System.Runtime.InteropServices.Marshal]::Copy($img.px, $desde, [IntPtr]::Add($data.Scan0, $y * $data.Stride), $cw * 4)
  }
  $bmp.UnlockBits($data)
  # premultiplicado: asi la interpolacion no arrastra el negro de los pixeles transparentes
  $pre = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($pre)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.DrawImage($bmp, 0, 0, $cw, $ch)
  $g.Dispose(); $bmp.Dispose()
  return $pre
}

function Componer($sprite, [double] $escala, [string] $salida) {
  $sw = [int][math]::Round($sprite.Width * $escala); $sh = [int][math]::Round($sprite.Height * $escala)
  $lado = $script:Lado; $piso = [int][math]::Round($Piso * $lado / $Lienzo)
  $maxAncho = $lado - 2 * $piso
  if ($sw -gt $maxAncho) { $f = $maxAncho / $sw; $sw = $maxAncho; $sh = [int][math]::Round($sh * $f); Write-Host "    (ancho de mas: se achica a $sw x $sh)" }
  $tela = New-Object System.Drawing.Bitmap $lado, $lado, ([System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($tela)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes
  $attrs.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $x = [int](($lado - $sw) / 2); $y = $lado - $piso - $sh
  $dest = New-Object System.Drawing.Rectangle $x, $y, $sw, $sh
  $g.DrawImage($sprite, $dest, 0, 0, $sprite.Width, $sprite.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  $g.Dispose()
  # a ARGB comun, posterizado, y recien ahi a PNG
  $plana = New-Object System.Drawing.Bitmap $lado, $lado, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g2 = [System.Drawing.Graphics]::FromImage($plana)
  $g2.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g2.DrawImage($tela, 0, 0, $lado, $lado); $g2.Dispose(); $tela.Dispose()
  $rect = New-Object System.Drawing.Rectangle 0, 0, $lado, $lado
  $data = $plana.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($data.Stride * $lado)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
  [Sprites]::Posterizar($buf, $data.Stride * $lado / 4, $Bits)
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $buf.Length)
  $plana.UnlockBits($data)
  $plana.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $plana.Dispose()
  return "$sw x $sh"
}

function Hoja([string] $ruta, [string[]] $poses, [int] $parado, [bool] $damero) {
  Write-Host "== $(Split-Path $ruta -Leaf)"
  $img = Leer $ruta
  if ($damero) { [Sprites]::QuitarDamero($img.px, $img.w, $img.h) }
  [Sprites]::LimpiarAlfa($img.px, $img.w * $img.h, 24)

  # columnas, y adentro de cada columna filas: cubre la tira y la grilla de 2x2
  $cajas = @()
  foreach ($c in [Sprites]::Tramos($img.px, $img.w, $img.h, 0, 0, $img.w - 1, $img.h - 1, $true, 8)) {
    foreach ($f in [Sprites]::Tramos($img.px, $img.w, $img.h, $c[0], 0, $c[1], $img.h - 1, $false, 8)) {
      $cajas += ,([Sprites]::Caja($img.px, $img.w, $c[0], $f[0], $c[1], $f[1]))
    }
  }
  if ($cajas.Count -ne $poses.Count) { Write-Host "  !! $($cajas.Count) sprites y $($poses.Count) nombres: $(($cajas | ForEach-Object { "[$($_ -join ',')]" }) -join ' ')"; return }

  # No se agranda: si la hoja es chica, el lienzo se achica con ella y el mono
  # ocupa la misma fraccion. Agrandar solo desparrama el desenfoque del origen.
  $altoRef = $cajas[$parado][3] - $cajas[$parado][1] + 1
  $script:Lado = [math]::Min($Lienzo, [int][math]::Round($altoRef * $Lienzo / $AltoParado))
  $escala = ($AltoParado * $script:Lado / $Lienzo) / $altoRef
  Write-Host ("  parado = {0} px -> lienzo {1} px, escala {2:n3}" -f $altoRef, $script:Lado, $escala)

  for ($i = 0; $i -lt $poses.Count; $i++) {
    $caja = $cajas[$i]
    $sprite = Recortar $img $caja
    $salida = Join-Path $destino "$($poses[$i]).png"
    $medida = Componer $sprite $escala $salida
    $sprite.Dispose()
    Write-Host ("  {0,-12} caja [{1}] -> {2}  {3:n0} KB" -f $poses[$i], ($caja -join ','), $medida, ((Get-Item $salida).Length / 1KB))
  }
}

$raiz = Split-Path $PSScriptRoot -Parent
$destino = Join-Path $raiz "src\TruckNavigator.Api\wwwroot\img\mascota"
New-Item -ItemType Directory -Force $destino | Out-Null
$refs = Join-Path $raiz "docs\referencias\mascota"

# Por hoja: archivo, poses de izquierda a derecha, indice de una pose PARADA
# (la referencia del alto), y si hay que sacarle el damero.
Hoja "$refs\tbf-cafe-combustible-rueda-joystick.png" @('cafe', 'combustible', 'rueda', 'joystick') 0 $false
Hoja "$refs\tbf-comiendo-mate-cartas-mapa-binoculares.png" @('comiendo', 'mate', 'cartas', 'mapa', 'binoculares') 2 $false
# Grilla 2x2: columna izquierda de arriba abajo, despues la derecha.
Hoja "$refs\WhatsApp Image 2026-09-12 at 8.24.33 PM (2).jpeg" @('durmiendo', 'torta', 'festejo', 'radar') 1 $true
