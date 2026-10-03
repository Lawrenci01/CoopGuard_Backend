param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^libsql://')]
  [string]$DatabaseUrl,

  [string]$AdminUsername = 'team.admin'
)

$secureToken = Read-Host 'New Turso database token' -AsSecureString
$plainToken = [Net.NetworkCredential]::new('', $secureToken).Password
if ([string]::IsNullOrWhiteSpace($plainToken)) {
  throw 'A Turso database token is required. Nothing was deleted.'
}

$resetExit = 1
$adminResetExit = 1
$credentialOutput = ".local/render-admin-reset-$((Get-Date).ToString('yyyyMMdd-HHmmss')).txt"
try {
  $env:TURSO_DATABASE_URL = $DatabaseUrl
  $env:TURSO_AUTH_TOKEN = $plainToken
  npm run reset-data -- --require-cloud --confirm DELETE_ALL_FARMS --preserve-technician cg.technician
  $resetExit = $LASTEXITCODE
  if ($resetExit -eq 0) {
    npm run provision -- --require-cloud --reset-user $AdminUsername --output $credentialOutput
    $adminResetExit = $LASTEXITCODE
  }
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
if ($adminResetExit -ne 0) {
  throw "Farm data was reset, but the administrator password reset failed. Review the error above."
}

Write-Output 'Cloud farm and account reset completed.'
Write-Output "New administrator credentials: $credentialOutput"
