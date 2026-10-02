param(
  [string]$Farm = 'CoopGuard pilot farm',
  [string]$Owner = 'cg.owner',
  [string]$Technician = 'cg.technician',
  [string]$DatabaseUrl
)
$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { $DatabaseUrl = Read-Host 'Turso database URL' }
if ($DatabaseUrl -notmatch '^libsql://') { throw 'The Turso database URL must start with libsql://.' }
$secureToken = Read-Host 'Turso database token (input is hidden)' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$output = ".local/render-replacement-accounts-$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')).txt"
try {
  $env:TURSO_DATABASE_URL = $DatabaseUrl
  $env:TURSO_AUTH_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $npmArguments = @(
    'run', 'reprovision', '--',
    '--farm', $Farm,
    '--owner', $Owner,
    '--technician', $Technician,
    '--confirm', $Farm,
    '--output', $output
  )
  & npm.cmd @npmArguments
  if ($LASTEXITCODE -ne 0) { throw 'Account replacement failed. No credentials file should be used.' }
  Write-Output "Open this private file for the new temporary passwords: $output"
} finally {
  Remove-Item Env:TURSO_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:TURSO_AUTH_TOKEN -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  $secureToken = $null
}
