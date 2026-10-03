$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgLocal = Join-Path $cgBackend '.local'
$cgCloudflared = Join-Path $cgLocal 'bin\cloudflared.exe'
$cgCa = Join-Path $cgLocal 'tls\ca.crt'
$cgPidFile = Join-Path $cgLocal 'tunnel.pid'
$cgUrlFile = Join-Path $cgLocal 'public-url.txt'
$cgOut = Join-Path $cgLocal 'tunnel.out.log'
$cgErr = Join-Path $cgLocal 'tunnel.err.log'

if (-not (Test-Path -LiteralPath $cgCloudflared)) {
  throw 'Run scripts\install-cloudflared.ps1 first.'
}
if (-not (Test-Path -LiteralPath $cgCa)) { throw 'Run npm run tls first.' }

if (Test-Path -LiteralPath $cgPidFile) {
  $cgExistingPid = [int](Get-Content -LiteralPath $cgPidFile -Raw)
  $cgExisting = Get-Process -Id $cgExistingPid -ErrorAction SilentlyContinue
  if ($cgExisting -and $cgExisting.ProcessName -eq 'cloudflared') {
    if (Test-Path -LiteralPath $cgUrlFile) {
      $cgExistingUrl = (Get-Content -LiteralPath $cgUrlFile -Raw).Trim()
      Write-Output "CoopGuard is already online at $cgExistingUrl"
      exit 0
    }
    throw 'The tunnel is running but its public address is missing. Run stop-online.ps1 first.'
  }
  Remove-Item -LiteralPath $cgPidFile -Force
}

if (-not (Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)) {
  & (Join-Path $PSScriptRoot 'start-pc.ps1')
}

$cgReady = $false
for ($cgAttempt = 0; $cgAttempt -lt 30; $cgAttempt++) {
  if (Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue) {
    $cgReady = $true
    break
  }
  Start-Sleep -Seconds 1
}
if (-not $cgReady) { throw 'The CoopGuard backend did not start on port 8443.' }

Remove-Item -LiteralPath $cgOut, $cgErr -Force -ErrorAction SilentlyContinue
$cgTunnel = Start-Process `
  -FilePath $cgCloudflared `
  -ArgumentList @('tunnel', '--url', 'https://localhost:8443', '--origin-ca-pool', $cgCa, '--loglevel', 'info') `
  -WorkingDirectory $cgBackend `
  -WindowStyle Hidden `
  -RedirectStandardOutput $cgOut `
  -RedirectStandardError $cgErr `
  -PassThru
$cgTunnel.Id | Set-Content -LiteralPath $cgPidFile

$cgUrl = $null
for ($cgAttempt = 0; $cgAttempt -lt 45; $cgAttempt++) {
  if ($cgTunnel.HasExited) { break }
  $cgText = ''
  if (Test-Path -LiteralPath $cgOut) { $cgText += Get-Content -LiteralPath $cgOut -Raw }
  if (Test-Path -LiteralPath $cgErr) { $cgText += Get-Content -LiteralPath $cgErr -Raw }
  $cgMatch = [regex]::Match($cgText, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($cgMatch.Success) {
    $cgUrl = $cgMatch.Value
    break
  }
  Start-Sleep -Seconds 1
}
if (-not $cgUrl) {
  if (-not $cgTunnel.HasExited) { Stop-Process -Id $cgTunnel.Id -Force }
  Remove-Item -LiteralPath $cgPidFile -Force -ErrorAction SilentlyContinue
  $cgDetails = if (Test-Path -LiteralPath $cgErr) { Get-Content -LiteralPath $cgErr -Raw } else { '' }
  throw "The public tunnel did not return an address. $cgDetails"
}

$cgHealthy = $false
for ($cgAttempt = 0; $cgAttempt -lt 20; $cgAttempt++) {
  try {
    $cgHealth = Invoke-RestMethod -Uri "$cgUrl/health" -TimeoutSec 5
    if ($cgHealth.service -eq 'CoopGuard') {
      $cgHealthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $cgHealthy) {
  Stop-Process -Id $cgTunnel.Id -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $cgPidFile -Force -ErrorAction SilentlyContinue
  throw 'The tunnel started but its public health check failed.'
}

$cgUrl | Set-Content -LiteralPath $cgUrlFile
Write-Output "CoopGuard is online at $cgUrl"
Write-Output "Public address saved to $cgUrlFile"
Write-Output 'Keep this PC, the backend, and the tunnel running.'
