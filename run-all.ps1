#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Full project run system for Retaj RMS - Backend, Frontend, and Mobile
.DESCRIPTION
    Orchestrates installation, Prisma generation, and production builds for all modules.
    Provides colored output, error tracking, and summary report.
.EXAMPLE
    .\run-all.ps1
#>

param(
    [switch]$SkipMobile = $false
)

# ======================== COLOR DEFINITIONS ========================
function Write-Success { param([string]$Message); Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Error-Custom { param([string]$Message); Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message); Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Warning-Custom { param([string]$Message); Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Header { param([string]$Message); Write-Host "`n========== $Message ==========" -ForegroundColor Blue }

$ErrorLogs = @{}
$SuccessLogs = @{}
$BuildPaths = @{}
$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartTime = Get-Date

Write-Host "`n" -ForegroundColor Blue
Write-Host "===================================================" -ForegroundColor Blue
Write-Host "  RETAJ RMS - FULL PROJECT RUN SYSTEM (PowerShell)" -ForegroundColor Blue
Write-Host "  Backend + Frontend + Mobile Build               " -ForegroundColor Blue
Write-Host "===================================================" -ForegroundColor Blue
Write-Info "Root Path: $RootPath"
Write-Info "Start Time: $StartTime"

# ======================== BACKEND BUILD ========================
Write-Header "BACKEND MODULE"
Write-Info "Location: $RootPath\backend"

try {
    Push-Location "$RootPath\backend"
    
    # 1. npm install
    Write-Info "Running: npm install..."
    if (-not (Test-Path "node_modules")) {
        npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend dependencies installed"
            $SuccessLogs["backend_install"] = "npm install completed"
        } else {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
    } else {
        Write-Info "node_modules exists, skipping npm install"
    }

    # 2. Prisma generate
    Write-Info "Running: npx prisma generate..."
    npx prisma generate 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Prisma client generated"
        $SuccessLogs["backend_prisma"] = "prisma generate completed"
    } else {
        throw "Prisma generate failed with exit code $LASTEXITCODE"
    }

    # 3. TypeScript build
    Write-Info "Running: npm run build..."
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend built successfully"
        $SuccessLogs["backend_build"] = "TypeScript compilation completed"
        $BuildPaths["Backend"] = "$RootPath\backend\dist"
    } else {
        throw "Backend build failed with exit code $LASTEXITCODE"
    }

    Pop-Location
} catch {
    Write-Error-Custom "BACKEND ERROR: $_"
    $ErrorLogs["backend"] = $_
    Write-Warning-Custom "Continuing with other modules..."
}

# ======================== FRONTEND BUILD ========================
Write-Header "FRONTEND MODULE"
Write-Info "Location: $RootPath\frontend"

try {
    Push-Location "$RootPath\frontend"
    
    # 1. npm install
    Write-Info "Running: npm install..."
    if (-not (Test-Path "node_modules")) {
        npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend dependencies installed"
            $SuccessLogs["frontend_install"] = "npm install completed"
        } else {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
    } else {
        Write-Info "node_modules exists, skipping npm install"
    }

    # 2. Vite build
    Write-Info "Running: npm run build..."
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend built successfully"
        $SuccessLogs["frontend_build"] = "Vite build completed"
        $BuildPaths["Frontend"] = "$RootPath\frontend\dist"
    } else {
        throw "Frontend build failed with exit code $LASTEXITCODE"
    }

    # 3. Electron package (Windows EXE)
    Write-Info "Running: npm run electron-pack:win..."
    npm run electron-pack:win 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Desktop EXE built successfully"
        $SuccessLogs["desktop_build"] = "Electron Windows EXE packaged"
        $BuildPaths["Desktop"] = "$RootPath\dist-electron"
    } else {
        Write-Warning-Custom "Desktop EXE build failed (requires admin privileges for code signing) - continuing without desktop app"
        $ErrorLogs["desktop"] = "Electron packaging failed - requires admin privileges for code signing tools"
    }

    Pop-Location
} catch {
    Write-Error-Custom "FRONTEND ERROR: $_"
    $ErrorLogs["frontend"] = $_
    Write-Warning-Custom "Continuing with other modules..."
}

# ======================== MOBILE BUILD ========================
Write-Header "MOBILE MODULE"

if ($SkipMobile) {
    Write-Warning-Custom "Mobile build skipped (--SkipMobile flag)"
} else {
    Write-Info "Location: $RootPath\mobile_cashier"
    
    if (Test-Path "$RootPath\mobile_cashier\pubspec.yaml") {
        try {
            Push-Location "$RootPath\mobile_cashier"
            
            # Check if Flutter is installed
            $flutterCheck = flutter --version 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Warning-Custom "Flutter not found. Skipping mobile build."
                $ErrorLogs["mobile"] = "Flutter SDK not installed"
            } else {
                Write-Info "Flutter detected: $($flutterCheck[0])"
                
                # 1. flutter pub get
                Write-Info "Running: flutter pub get..."
                flutter pub get 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Flutter dependencies installed"
                    $SuccessLogs["mobile_pubget"] = "flutter pub get completed"
                } else {
                    throw "flutter pub get failed with exit code $LASTEXITCODE"
                }

                # 2. flutter build apk (release)
                Write-Warning-Custom "Note: Flutter APK build is resource-intensive and may take 5-10 minutes..."
                Write-Info "Running: flutter build apk --release..."
                flutter build apk --release 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Mobile APK built successfully"
                    $SuccessLogs["mobile_build"] = "Flutter APK build completed"
                    $BuildPaths["Mobile"] = "$RootPath\mobile_cashier\build\app\outputs\flutter-apk"
                } else {
                    Write-Warning-Custom "Flutter APK build failed or skipped (common in CI/limited resources)"
                    $ErrorLogs["mobile"] = "Flutter APK build failed or environment limited"
                }
            }

            Pop-Location
        } catch {
            Write-Error-Custom "MOBILE ERROR: $_"
            $ErrorLogs["mobile"] = $_
        }
    } else {
        Write-Warning-Custom "mobile_cashier/pubspec.yaml not found, skipping mobile build"
    }
}

# ======================== SUMMARY REPORT ========================
$EndTime = Get-Date
$Duration = ($EndTime - $StartTime).TotalSeconds

Write-Host "`n========== BUILD SUMMARY ==========" -ForegroundColor Yellow

Write-Host "`n Module Status:`n" -ForegroundColor Yellow

if ($SuccessLogs["backend_build"]) {
    Write-Success "Backend ready"
} else {
    Write-Error-Custom "Backend failed or incomplete"
}

if ($SuccessLogs["frontend_build"]) {
    Write-Success "Frontend ready"
} else {
    Write-Error-Custom "Frontend failed or incomplete"
}

if ($SuccessLogs["mobile_build"]) {
    Write-Success "Mobile ready"
} elseif ($ErrorLogs["mobile"]) {
    Write-Warning-Custom "Mobile skipped/failed: $($ErrorLogs["mobile"])"
} else {
    Write-Info "Mobile not built"
}

if ($SuccessLogs["desktop_build"]) {
    Write-Success "Desktop ready"
} elseif ($ErrorLogs["desktop"]) {
    Write-Warning-Custom "Desktop build failed: $($ErrorLogs["desktop"])"
} else {
    Write-Info "Desktop not built"
}

Write-Host "`n Build Output Paths:`n" -ForegroundColor Yellow

foreach ($module in $BuildPaths.GetEnumerator()) {
    if (Test-Path $module.Value) {
        Write-Success "$($module.Name): $($module.Value)"
    } else {
        Write-Warning-Custom "$($module.Name) output path not found"
    }
}

# Special handling for EXE file
$exePath = "$RootPath\dist-electron\RetajPOS Setup *.exe"
if (Test-Path $exePath) {
    $exeFile = Get-Item $exePath | Select-Object -First 1
    Write-Success "Desktop EXE: $($exeFile.FullName)"
} elseif ($SuccessLogs["desktop_build"]) {
    Write-Warning-Custom "Desktop EXE: Build completed but file not found at expected location"
}

if ($ErrorLogs.Count -gt 0) {
    Write-Host "`n Error Log:`n" -ForegroundColor Yellow
    foreach ($err in $ErrorLogs.GetEnumerator()) {
        Write-Host "  [$($err.Name)] $($err.Value)" -ForegroundColor Red
    }
}

Write-Host "`n Execution Time: $([Math]::Round($Duration, 2)) seconds`n" -ForegroundColor Cyan

Write-Host "===================================================" -ForegroundColor Blue
if ($ErrorLogs.Count -eq 0) {
    Write-Success "All modules completed successfully!"
} else {
    Write-Warning-Custom "Build completed with $($ErrorLogs.Count) error(s) - see log above"
}
Write-Host "===================================================" -ForegroundColor Blue

# Exit with appropriate code
if ($ErrorLogs.Count -gt 0) {
    exit 1
} else {
    exit 0
}
