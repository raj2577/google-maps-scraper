@echo off
title G-Maps Scraper Studio Launcher
echo ===================================================
echo   Starting Google Maps Scraper Studio...
echo ===================================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

:: Check if Docker network exists, create if not
echo [1/3] Ensuring Docker network 'shark' exists...
docker network create shark >nul 2>&1

:: Build and start Docker container in detached mode
echo [2/3] Building and starting Docker containers...
docker compose up --build -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start Docker containers.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

:: Wait for a couple of seconds for FastAPI server initialization
echo [3/3] Launching web interface...
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:8001

echo.
echo ===================================================
echo   Studio is running at http://localhost:8001
echo   To stop, run: docker compose down
echo ===================================================
echo.
pause
