$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  .\scripts\validate.ps1

  $manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
  $dist = Join-Path $root "dist"
  $releaseDir = Join-Path $dist "user-release"
  $zipPath = Join-Path $dist "zhihu-block-likers-extension-user-$($manifest.version).zip"

  New-Item -ItemType Directory -Force -Path $dist | Out-Null
  if (Test-Path $releaseDir) {
    Remove-Item -LiteralPath $releaseDir -Recurse -Force
  }
  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

  foreach ($item in @("manifest.json", "src", "_locales", "install.bat", "INSTALL.zh-CN.md", "README.md", "LICENSE")) {
    Copy-Item -LiteralPath (Join-Path $root $item) -Destination $releaseDir -Recurse
  }

  New-Item -ItemType Directory -Force -Path (Join-Path $releaseDir "assets") | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "assets\icons") -Destination (Join-Path $releaseDir "assets") -Recurse

  New-Item -ItemType Directory -Force -Path (Join-Path $releaseDir "scripts") | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "scripts\install-local.ps1") -Destination (Join-Path $releaseDir "scripts")

  Compress-Archive -Path (Join-Path $releaseDir "*") -DestinationPath $zipPath -Force
  Write-Host "Created $zipPath"
}
finally {
  Pop-Location
}
