$ErrorActionPreference = 'Stop'
$cgBackend = Split-Path -Parent $PSScriptRoot
$cgBin = Join-Path $cgBackend '.local\bin'
$cgCloudflared = Join-Path $cgBin 'cloudflared.exe'

New-Item -ItemType Directory -Path $cgBin -Force | Out-Null
Invoke-WebRequest `
  -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
  -OutFile $cgCloudflared

Get-FileHash -LiteralPath $cgCloudflared -Algorithm SHA256 | Format-List
& $cgCloudflared --version
Write-Output "Installed cloudflared at $cgCloudflared"
