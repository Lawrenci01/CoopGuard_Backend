$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgLocal = Join-Path $cgBackend '.local'
if (-not (Test-Path -LiteralPath (Join-Path $cgLocal 'tls\server.key'))) { throw 'Run npm run tls first.' }
if (Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue) {
  Write-Output 'Port 8443 is already listening. Check https://localhost:8443/health before starting another server.'
  exit 0
}
$cgNode = (Get-Command node.exe -ErrorAction Stop).Source
$cgProcess = Start-Process -FilePath $cgNode -ArgumentList @('--import', 'tsx', 'src/server.ts') -WorkingDirectory $cgBackend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $cgLocal 'server.out.log') -RedirectStandardError (Join-Path $cgLocal 'server.err.log') -PassThru
$cgProcess.Id | Set-Content -LiteralPath (Join-Path $cgLocal 'server.pid')
Write-Output "CoopGuard started in the background (PID $($cgProcess.Id)). Logs: $cgLocal"
