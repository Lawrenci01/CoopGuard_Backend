$ErrorActionPreference = 'Stop'
# Run once from an Administrator PowerShell. Restricts access to the local subnet
# on networks Windows already classifies as Private.
if (-not (Get-NetFirewallRule -Name 'CoopGuard-Local-8443' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'CoopGuard-Local-8443' -DisplayName 'CoopGuard local farm server' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443 -Profile Private -RemoteAddress LocalSubnet | Out-Null
}
Write-Output 'CoopGuard HTTPS is allowed on private local networks, port 8443.'
