$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Get-Content manifest.json -Raw | ConvertFrom-Json | Out-Null

  foreach ($file in @("src\popup.js", "src\content.js")) {
    node --check $file
  }

  foreach ($size in @(16, 32, 48, 128)) {
    $path = "assets\icons\icon$size.png"
    if (-not (Test-Path $path)) {
      throw "Missing icon: $path"
    }
  }

  Write-Host "Validation passed."
}
finally {
  Pop-Location
}
