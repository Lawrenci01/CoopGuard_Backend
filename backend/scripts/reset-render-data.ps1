param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^libsql://')]
  [string]$DatabaseUrl
)

$secureToken = Read-Host 'New Turso database token' -AsSecureString
$plainToken = [Net.NetworkCredential]::new('', $secureToken).Password
if ([string]::IsNullOrWhiteSpace($plainToken)) {
  throw 'A Turso database token is required. Nothing was deleted.'
}

$resetExit = 1
try {
  $env:TURSO_DATABASE_URL = $DatabaseUrl
  $env:TURSO_AUTH_TOKEN = $plainToken
  npm run reset-data -- --require-cloud --confirm DELETE_ALL_FARMS --preserve-technician cg.technician
  $resetExit = $LASTEXITCODE
}
finally {
  Remove-Item Env:TURSO_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:TURSO_AUTH_TOKEN -ErrorAction SilentlyContinue
  $plainToken = $null
  Remove-Variable secureToken -ErrorAction SilentlyContinue
}

if ($resetExit -ne 0) {
  throw 'Cloud reset failed. Review the error above; no successful reset was reported.'
}

Write-Output 'Cloud farm and account reset completed.'
