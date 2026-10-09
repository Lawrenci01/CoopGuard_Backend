$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgLocal = Join-Path $cgBackend '.local'
$cgConfig = Join-Path $cgLocal 'hub-config.json'
$cgHotspotConfig = Join-Path $cgLocal 'hotspot-config.json'
if (-not $env:TURSO_DATABASE_URL -or -not $env:TURSO_AUTH_TOKEN) {
  throw 'The laptop hub requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the Render service. Set both in this PowerShell session before creating or starting the hub.'
}
if ($env:TURSO_DATABASE_URL -notmatch '^libsql://' -or $env:TURSO_DATABASE_URL -match 'YOUR-DATABASE|example') {
  throw 'Replace the TURSO_DATABASE_URL placeholder with the exact libsql:// database URL used by Render.'
}
if (-not (Test-Path -LiteralPath $cgConfig)) {
  throw 'Create the laptop hub first: npm run hotspot:start, then npm run hub:create'
}
$cgAlreadyListening = [bool](Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
if (Test-Path -LiteralPath $cgHotspotConfig) {
  if ($cgAlreadyListening) {
    & (Join-Path $PSScriptRoot 'start-laptop-hotspot.ps1') -SkipTls
  } else {
    & (Join-Path $PSScriptRoot 'start-laptop-hotspot.ps1')
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $cgLocal 'tls\server.key'))) {
  throw 'Run npm run tls first.'
}
if ($cgAlreadyListening) {
  Write-Output 'Port 8443 is already listening. Open https://localhost:8443/developer.'
  exit 0
}
$cgNode = (Get-Command node.exe -ErrorAction Stop).Source
$previousMode = $env:CG_MODE
$previousConfig = $env:CG_HUB_CONFIG
try {
  $env:CG_MODE = 'hub'
  $env:CG_HUB_CONFIG = $cgConfig
  $cgProcess = Start-Process -FilePath $cgNode -ArgumentList @('--import', 'tsx', 'src/server.ts') -WorkingDirectory $cgBackend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $cgLocal 'server.out.log') -RedirectStandardError (Join-Path $cgLocal 'server.err.log') -PassThru
  $cgProcess.Id | Set-Content -LiteralPath (Join-Path $cgLocal 'server.pid')
} finally {
  $env:CG_MODE = $previousMode
  $env:CG_HUB_CONFIG = $previousConfig
}
for ($attempt = 0; $attempt -lt 120; $attempt++) {
  if ($cgProcess.HasExited) {
    Remove-Item -LiteralPath (Join-Path $cgLocal 'server.pid') -Force -ErrorAction SilentlyContinue
    $cgErrorLog = Join-Path $cgLocal 'server.err.log'
    $cgDetails = if (Test-Path -LiteralPath $cgErrorLog) {
      (Get-Content -LiteralPath $cgErrorLog -Tail 12) -join [Environment]::NewLine
    } else {
      'No server error log was written.'
    }
    throw "The CoopGuard laptop hub failed to start.$([Environment]::NewLine)$cgDetails"
  }
  if (Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "CoopGuard laptop hub started (PID $($cgProcess.Id))."
    Write-Output 'Database: cloud-synchronized local replica (.local\coopguard-hub-sync.sqlite)'
    Write-Output 'Developer console: https://localhost:8443/developer'
    exit 0
  }
  Start-Sleep -Milliseconds 250
}
throw 'The CoopGuard laptop hub process is still running but did not become ready on port 8443 within 30 seconds. Check .local\server.err.log before retrying.'
