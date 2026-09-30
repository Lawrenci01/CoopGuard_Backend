param([string]$Architectures = 'arm64-v8a,armeabi-v7a')
$ErrorActionPreference = 'Stop'
$cgFrontend = Split-Path -Parent $PSScriptRoot
$cgSdk = $env:ANDROID_HOME
if (-not $cgSdk) { $cgSdk = $env:ANDROID_SDK_ROOT }
if (-not $cgSdk -and (Test-Path -LiteralPath 'C:\Android\platform-tools')) { $cgSdk = 'C:\Android' }
if (-not $cgSdk) { throw 'Install the Android SDK and set ANDROID_HOME first. See README.md.' }
$env:ANDROID_HOME = $cgSdk
$env:ANDROID_SDK_ROOT = $cgSdk
$env:NODE_ENV = 'production'
$env:CI = '1'
$env:COOPGUARD_OFFLINE_APK = '1'
Push-Location $cgFrontend
try {
  & npx.cmd expo prebuild --platform android --no-install --no-clean
  if ($LASTEXITCODE -ne 0) { throw 'Android project generation failed.' }
  Push-Location (Join-Path $cgFrontend 'android')
  try {
    & .\gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=$Architectures" --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
  } finally { Pop-Location }
  $cgOutput = Join-Path $cgFrontend 'dist\android'
  New-Item -ItemType Directory -Path $cgOutput -Force | Out-Null
  $cgApk = Join-Path $cgOutput 'CoopGuard.apk'
  Copy-Item -LiteralPath (Join-Path $cgFrontend 'android\app\build\outputs\apk\release\app-release.apk') -Destination $cgApk -Force
  Get-FileHash -LiteralPath $cgApk -Algorithm SHA256 | Format-List
  Write-Output "Installable APK: $cgApk"
  Write-Output 'This internal build uses the Android test signing key. App code and assets are embedded; Metro and Expo Go are not needed.'
} finally { Pop-Location }
