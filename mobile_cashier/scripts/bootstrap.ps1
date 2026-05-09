$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
  Write-Error "Flutter SDK not found on PATH. Install from https://docs.flutter.dev/get-started/install"
  exit 1
}

Write-Host ">> flutter pub get"
flutter pub get

if (-not (Test-Path (Join-Path $root "android"))) {
  Write-Host ">> flutter create . (generating android/ ios/)"
  flutter create . --project-name retaj_cashier --org com.retaj.cashier
} else {
  Write-Host "android/ already present; skip flutter create"
}

Write-Host "Done. Apply docs/IOS_CONFIG.md and docs/ANDROID_CONFIG.md if not already merged."
Write-Host "Run: flutter run"
