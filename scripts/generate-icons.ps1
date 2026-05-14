$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "assets\icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Brush($hex) {
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen($hex, $width) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $pen
}

foreach ($size in @(16, 32, 48, 128)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $blue = New-Brush "#1677ff"
  $white = New-Brush "#ffffff"
  $green = New-Brush "#12b76a"
  $whitePen = New-Pen "#ffffff" ([Math]::Max(2, [Math]::Round($size * 0.06)))

  $margin = [Math]::Max(1, [Math]::Round($size * 0.06))
  $rectSize = $size - ($margin * 2)
  $graphics.FillRectangle($blue, $margin, $margin, $rectSize, $rectSize)

  $fontSize = [Math]::Max(9, [Math]::Round($size * 0.56))
  $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = [System.Drawing.RectangleF]::new(0, [Math]::Round($size * -0.02), $size, $size)
  $graphics.DrawString("Z", $font, $white, $textRect, $format)

  $badge = [Math]::Max(6, [Math]::Round($size * 0.36))
  $badgeX = $size - $badge - $margin
  $badgeY = $size - $badge - $margin
  $graphics.FillEllipse($green, $badgeX, $badgeY, $badge, $badge)
  foreach ($offset in @(0.34, 0.5, 0.66)) {
    $y = $badgeY + ($badge * $offset)
    $graphics.DrawLine($whitePen, $badgeX + ($badge * 0.27), $y, $badgeX + ($badge * 0.73), $y)
  }

  $path = Join-Path $outDir "icon$size.png"
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose()
  $font.Dispose()
  $whitePen.Dispose()
  $blue.Dispose()
  $white.Dispose()
  $green.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Host "Generated icons in $outDir"
