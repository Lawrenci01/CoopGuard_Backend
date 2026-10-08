$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgPidFile = Join-Path $cgBackend '.local\server.pid'
if (-not (Test-Path -LiteralPath $cgPidFile)) {
  Write-Output 'The CoopGuard laptop hub is not running.'
  exit 0
}
$cgServerPid = [int](Get-Content -LiteralPath $cgPidFile -Raw)
$cgProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$cgServerPid" -ErrorAction SilentlyContinue
if ($cgProcess -and $cgProcess.Name -eq 'node.exe' -and $cgProcess.CommandLine -like '*src/server.ts*') {
  Stop-Process -Id $cgServerPid
  Write-Output "Stopped the CoopGuard laptop hub (PID $cgServerPid)."
} elseif ($cgProcess) {
  throw "PID $cgServerPid does not belong to the CoopGuard server. The process was not stopped."
} else {
  Write-Output 'Removed a stale CoopGuard server PID file.'
}
Remove-Item -LiteralPath $cgPidFile -Force
