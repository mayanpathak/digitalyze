Write-Host "Starting Backend Server..." -ForegroundColor Green
Set-Location $PSScriptRoot

# Set environment variables
$env:PORT = "5000"
$env:NODE_ENV = "development"
$env:FRONTEND_URL = "http://localhost:3000"

Write-Host "Environment configured:" -ForegroundColor Yellow
Write-Host "PORT: $env:PORT"
Write-Host "NODE_ENV: $env:NODE_ENV"
Write-Host "FRONTEND_URL: $env:FRONTEND_URL"

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting server..." -ForegroundColor Green
npm start 