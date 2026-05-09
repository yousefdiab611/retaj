@echo off
echo ========================================
echo   RETAJ POS - Desktop Launcher
echo ========================================
echo.

cd /d "%~dp0"

echo Starting Retaj POS Desktop Application...
echo.

REM Check if backend is running
echo Checking backend status...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Backend not running. Starting backend...
    start /B cmd /C "cd backend && npm run dev"
    timeout /t 5 /nobreak >nul
) else (
    echo Backend is already running.
)

echo Starting frontend...
start /B cmd /C "cd frontend && npm run electron"

echo.
echo Retaj POS Desktop Application started!
echo Close this window to stop all services.
echo.
pause