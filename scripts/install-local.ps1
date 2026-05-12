$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$installDir = Join-Path $env:LOCALAPPDATA "ZhihuBlockLikersExtension"
$required = @("manifest.json", "src", "assets\icons", "_locales")

function Assert-SourceReady {
  foreach ($item in $required) {
    $path = Join-Path $root $item
    if (-not (Test-Path $path)) {
      throw "Missing required extension file or folder: $path"
    }
  }
}

function Reset-InstallDir {
  $localAppData = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA)
  $target = [System.IO.Path]::GetFullPath($installDir)

  if (-not $target.StartsWith($localAppData, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside LOCALAPPDATA: $target"
  }

  if (Test-Path $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $target | Out-Null
}

function Copy-ExtensionFiles {
  Copy-Item -LiteralPath (Join-Path $root "manifest.json") -Destination $installDir
  Copy-Item -LiteralPath (Join-Path $root "src") -Destination $installDir -Recurse
  Copy-Item -LiteralPath (Join-Path $root "_locales") -Destination $installDir -Recurse

  $assetDir = Join-Path $installDir "assets"
  New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "assets\icons") -Destination $assetDir -Recurse
}

function Copy-InstallPathToClipboard {
  try {
    Set-Clipboard -Value $installDir
    return $true
  }
  catch {
    return $false
  }
}

function Open-ExtensionPages {
  $browserCandidates = @(
    @{ Name = "Chrome"; Url = "chrome://extensions/"; Paths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
      )
    },
    @{ Name = "Edge"; Url = "edge://extensions/"; Paths = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
      )
    }
  )

  $opened = @()
  foreach ($browser in $browserCandidates) {
    $exe = $browser.Paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($exe) {
      Start-Process -FilePath $exe -ArgumentList $browser.Url | Out-Null
      $opened += $browser.Name
    }
  }

  return $opened
}

Assert-SourceReady
Reset-InstallDir
Copy-ExtensionFiles
$clipboardOk = Copy-InstallPathToClipboard
$opened = Open-ExtensionPages

Write-Host ""
Write-Host "知乎点赞用户屏蔽助手 - 本地安装准备完成" -ForegroundColor Green
Write-Host ""
Write-Host "扩展目录:"
Write-Host "  $installDir" -ForegroundColor Cyan
Write-Host ""

if ($clipboardOk) {
  Write-Host "扩展目录已复制到剪贴板。" -ForegroundColor Green
}
else {
  Write-Host "未能复制到剪贴板，请手动复制上面的目录。" -ForegroundColor Yellow
}

if ($opened.Count -gt 0) {
  Write-Host "已打开扩展管理页: $($opened -join ', ')"
}
else {
  Write-Host "没有检测到 Chrome 或 Edge，请手动打开 chrome://extensions/ 或 edge://extensions/" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "最后一步:"
Write-Host "  1. 在浏览器扩展页开启 开发者模式"
Write-Host "  2. 点击 加载已解压的扩展"
Write-Host "  3. 粘贴并选择上面的扩展目录"
Write-Host "  4. 打开知乎页面后刷新一次，再点击扩展图标"
Write-Host ""
