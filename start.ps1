# G-Maps Scraper Studio PowerShell Launcher

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Google Maps Scraper Studio..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
& docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Ensure Docker network exists
Write-Host "[1/3] Ensuring Docker network 'shark' exists..." -ForegroundColor Gray
& docker network create shark 2>$null

# Build and start Docker containers
Write-Host "[2/3] Building and starting Docker containers..." -ForegroundColor Gray
& docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Failed to start Docker containers." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
}

# Wait for server initialization
Write-Host "[3/3] Launching web interface..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Open browser
Start-Process "http://localhost:8001"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  Studio is running at http://localhost:8001" -ForegroundColor Green
Write-Host "  To stop the application, run: docker compose down" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close this window"
