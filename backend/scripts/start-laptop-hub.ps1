$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgLocal = Join-Path $cgBackend '.local'
$cgConfig = Join-Path $cgLocal 'hub-config.json'
if (-not $env:TURSO_DATABASE_URL -or -not $env:TURSO_AUTH_TOKEN) {
  throw 'The laptop hub requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the Render service. Set both in this PowerShell session before creating or starting the hub.'
}
if (-not (Test-Path -LiteralPath $cgConfig)) {
  throw 'Create the laptop hub first: npm run hub:create -- --wifi https://YOUR-LAPTOP-IP:8443'
}
if (-not (Test-Path -LiteralPath (Join-Path $cgLocal 'tls\server.key'))) {
  throw 'Run npm run tls first.'
}
if (Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue) {
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
Write-Output "CoopGuard laptop hub started (PID $($cgProcess.Id))."
Write-Output 'Database: cloud-synchronized local replica (.local\coopguard-hub-sync.sqlite)'
Write-Output 'Developer console: https://localhost:8443/developer'
