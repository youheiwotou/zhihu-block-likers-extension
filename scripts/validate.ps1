$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  Get-Content manifest.json -Raw | ConvertFrom-Json | Out-Null

  foreach ($file in @("src\popup.js", "src\content.js")) {
    node --check $file
  }

  foreach ($file in @(
    "scripts\build-package.ps1",
    "scripts\build-user-release.ps1",
    "scripts\generate-icons.ps1",
    "scripts\install-local.ps1",
    "scripts\test-fixture.ps1",
    "scripts\validate.ps1"
  )) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $root $file), [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
      throw "PowerShell syntax error in $file`: $($errors[0].Message)"
    }
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
