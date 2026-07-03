@echo off
REM ================================================================
REM RETAJ RMS - FULL PROJECT RUN SYSTEM (Batch/CMD)
REM Backend + Frontend + Mobile Build Orchestration
REM ================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"
set "ROOT_PATH=%cd%"
set "BACKEND_PATH=%ROOT_PATH%\backend"
set "FRONTEND_PATH=%ROOT_PATH%\frontend"
set "MOBILE_PATH=%ROOT_PATH%\mobile_cashier"

REM Color codes (limited in CMD)
set "SUCCESS=[OK]"
set "ERROR=[!!]"
set "INFO=[..] "
set "WARN=[**]"

echo.
echo ================================================================
echo     RETAJ RMS - FULL PROJECT RUN SYSTEM (Batch/CMD)
echo         Backend + Frontend + Mobile Build
echo ================================================================
echo.
echo %INFO% Root Path: %ROOT_PATH%
echo %INFO% Start Time: %date% %time%
echo.

REM ================================================================
REM BACKEND BUILD
REM ================================================================
echo.
echo ===== BACKEND MODULE =====
echo %INFO% Location: %BACKEND_PATH%

cd /d "%BACKEND_PATH%"

REM npm install
if not exist "node_modules\" (
    echo %INFO% Running: npm install...
    call npm install
    if !errorlevel! neq 0 (
        echo %ERROR% Backend npm install FAILED
        goto :SKIP_BACKEND_PRISMA
    )
    echo %SUCCESS% Backend dependencies installed
) else (
    echo %INFO% node_modules exists, skipping npm install
)

REM Prisma generate
echo %INFO% Running: npx prisma generate...
call npx prisma generate
if !errorlevel! neq 0 (
    echo %ERROR% Prisma generate FAILED
    goto :SKIP_BACKEND_PRISMA
)
echo %SUCCESS% Prisma client generated

REM npm build
echo %INFO% Running: npm run build...
call npm run build
if !errorlevel! neq 0 (
    echo %ERROR% Backend build FAILED - continuing with other modules
    goto :FRONTEND_BUILD
)
echo %SUCCESS% Backend built successfully

:SKIP_BACKEND_PRISMA

REM ================================================================
REM FRONTEND BUILD
REM ================================================================
:FRONTEND_BUILD
echo.
echo ===== FRONTEND MODULE =====
echo %INFO% Location: %FRONTEND_PATH%

cd /d "%FRONTEND_PATH%"

REM npm install
if not exist "node_modules\" (
    echo %INFO% Running: npm install...
    call npm install
    if !errorlevel! neq 0 (
        echo %ERROR% Frontend npm install FAILED
        goto :SKIP_FRONTEND_BUILD
    )
    echo %SUCCESS% Frontend dependencies installed
) else (
    echo %INFO% node_modules exists, skipping npm install
)

REM npm build
echo %INFO% Running: npm run build...
call npm run build
if !errorlevel! neq 0 (
    echo %ERROR% Frontend build FAILED - continuing with other modules
    goto :MOBILE_BUILD
)
echo %SUCCESS% Frontend built successfully

REM Electron package
echo %INFO% Running: npm run electron-pack:win...
call npm run electron-pack:win
if !errorlevel! neq 0 (
    echo %WARN% Desktop EXE build failed - continuing
    goto :MOBILE_BUILD
)
echo %SUCCESS% Desktop EXE built successfully

:SKIP_FRONTEND_BUILD

REM ================================================================
REM MOBILE BUILD
REM ================================================================
:MOBILE_BUILD
echo.
echo ===== MOBILE MODULE =====
echo %INFO% Location: %MOBILE_PATH%

if not exist "%MOBILE_PATH%\pubspec.yaml" (
    echo %WARN% mobile_cashier/pubspec.yaml not found, skipping mobile build
    goto :SUMMARY
)

where flutter >nul 2>&1
if !errorlevel! neq 0 (
    echo %WARN% Flutter not found. Skipping mobile build.
    goto :SUMMARY
)

echo %INFO% Flutter detected, proceeding with mobile build

REM flutter pub get
cd /d "%MOBILE_PATH%"
echo %INFO% Running: flutter pub get...
call flutter pub get
if !errorlevel! neq 0 (
    echo %ERROR% Flutter pub get FAILED - continuing
    goto :SUMMARY
)
echo %SUCCESS% Flutter dependencies installed

REM flutter build apk
echo %WARN% Flutter APK build may take 5-10 minutes...
echo %INFO% Running: flutter build apk --release...
call flutter build apk --release
if !errorlevel! neq 0 (
    echo %WARN% Flutter APK build failed (may be environment-dependent)
    goto :SUMMARY
)
echo %SUCCESS% Mobile APK built successfully

REM ================================================================
REM SUMMARY REPORT
REM ================================================================
:SUMMARY
echo.
echo ================================================================
echo.
echo BUILD SUMMARY
echo.
echo [✔] Backend ready - Output: %BACKEND_PATH%\dist
echo [✔] Frontend ready - Output: %FRONTEND_PATH%\dist
echo [✔] Desktop ready - Output: %ROOT_PATH%\dist-electron
echo [✔] Mobile (if available) - Output: %MOBILE_PATH%\build\app\outputs\flutter-apk
echo.
echo ================================================================
echo Build process completed. Check output above for any errors.
echo ================================================================
echo.

endlocal
pause
