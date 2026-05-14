$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
  $dist = Join-Path $root "dist"
  $packageDir = Join-Path $dist "package"
  $zipPath = Join-Path $dist "zhihu-blacklist-sync-extension-$($manifest.version).zip"

  New-Item -ItemType Directory -Force -Path $dist | Out-Null
  if (Test-Path $packageDir) {
    Remove-Item -LiteralPath $packageDir -Recurse -Force
  }
  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

  foreach ($item in @("manifest.json", "src", "_locales", "LICENSE")) {
    Copy-Item -LiteralPath (Join-Path $root $item) -Destination $packageDir -Recurse
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "assets") | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "assets\icons") -Destination (Join-Path $packageDir "assets") -Recurse

  Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $zipPath -Force
  Write-Host "Created $zipPath"
}
finally {
  Pop-Location
}
