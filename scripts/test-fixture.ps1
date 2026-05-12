$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path $root "tests\fixtures\liker-list.html"
if (-not (Test-Path $fixture)) {
  throw "Missing fixture: $fixture"
}

$browserPaths = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

$browser = $browserPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) {
  throw "Chrome or Edge was not found. Install one of them or run this fixture manually."
}

$fixtureUrl = "file:///" + ([System.IO.Path]::GetFullPath($fixture).Replace("\", "/"))
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$profileDir = Join-Path $tempRoot ("zhihu-block-fixture-" + [System.Guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
try {
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $browser
  foreach ($arg in @(
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--user-data-dir=$profileDir",
    "--dump-dom",
    $fixtureUrl
  )) {
    [void]$startInfo.ArgumentList.Add($arg)
  }
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $process = [System.Diagnostics.Process]::Start($startInfo)
  $dom = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  if (-not $process.WaitForExit(30000)) {
    $process.Kill()
    throw "Browser fixture timed out."
  }

  if ($process.ExitCode -ne 0) {
    throw "Browser fixture run failed with exit code $($process.ExitCode): $stderr"
  }
}
finally {
  $profilePath = [System.IO.Path]::GetFullPath($profileDir)
  if ($profilePath.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $profilePath)) {
    Remove-Item -LiteralPath $profilePath -Recurse -Force
  }
}

if ($dom -notmatch '"found":\s*2') {
  throw "Expected fixture to detect 2 visible profile links."
}

if ($dom -notmatch "首个用户行菜单按钮 1") {
  throw "Expected fixture to detect exactly one action menu button in the first row."
}

if ($dom -match "首个用户行菜单按钮[^<]*关注") {
  throw "Follow button was incorrectly treated as an action menu button."
}

Write-Host "Fixture test passed."
