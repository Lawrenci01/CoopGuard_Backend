$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgLocal = Join-Path $cgBackend '.local'
$cgPidFile = Join-Path $cgLocal 'tunnel.pid'
$cgUrlFile = Join-Path $cgLocal 'public-url.txt'

if (Test-Path -LiteralPath $cgPidFile) {
  $cgTunnelPid = [int](Get-Content -LiteralPath $cgPidFile -Raw)
  $cgTunnel = Get-Process -Id $cgTunnelPid -ErrorAction SilentlyContinue
  if ($cgTunnel -and $cgTunnel.ProcessName -eq 'cloudflared') {
    Stop-Process -Id $cgTunnelPid -Force
    Write-Output "Stopped the CoopGuard public tunnel (PID $cgTunnelPid)."
  }
  Remove-Item -LiteralPath $cgPidFile -Force
}
Remove-Item -LiteralPath $cgUrlFile -Force -ErrorAction SilentlyContinue
