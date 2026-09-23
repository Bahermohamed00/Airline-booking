# Airline Booking — Automated Setup Script (PowerShell)
# Run from repository root: .\setup.ps1

param(
    [switch]$SkipInstall,
    [switch]$SkipDatabase,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

function Test-Command($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "=== Airline Booking Setup ===" -ForegroundColor Cyan

# Check Node.js
if (-not (Test-Command node)) {
    throw "Node.js is not installed. Please install Node.js >= 22."
}
$nodeVersion = (node --version).TrimStart('v').Split('.')[0]
if ([int]$nodeVersion -lt 22) {
    throw "Node.js >= 22 required. Found: $(node --version)"
}
Write-Host "Node.js $(node --version) found." -ForegroundColor Green

# Install dependencies
if (-not $SkipInstall) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
    npm install
}

# Check PostgreSQL
$psql = $null
$possiblePaths = @(
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe"
)
foreach ($path in $possiblePaths) {
    if (Test-Path $path) { $psql = $path; break }
}
if (-not $psql -and (Test-Command psql)) { $psql = "psql" }

if (-not $SkipDatabase) {
    if (-not $psql) {
        Write-Host "psql not found. Install PostgreSQL or add it to PATH." -ForegroundColor Yellow
        Write-Host "Skipping database setup." -ForegroundColor Yellow
    }
    else {
        Write-Host "Configuring PostgreSQL..." -ForegroundColor Cyan
        $env:PGPASSWORD = "postgres"
        try {
            & $psql -U postgres -c "CREATE USER airline WITH PASSWORD 'airline' CREATEDB;" 2>$null
            Write-Host "User 'airline' created or already exists." -ForegroundColor Green
        }
        catch {
            Write-Host "Could not create user 'airline'. Ensure PostgreSQL superuser password is 'postgres' or run setup manually." -ForegroundColor Yellow
        }
        try {
            & $psql -U postgres -c "CREATE DATABASE airline_booking OWNER airline;" 2>$null
            & $psql -U postgres -c "CREATE DATABASE airline_booking_test OWNER airline;" 2>$null
            Write-Host "Databases created or already exist." -ForegroundColor Green
        }
        catch {
            Write-Host "Could not create databases." -ForegroundColor Yellow
        }
        $env:PGPASSWORD = $null
    }
}

# Environment file
if (-not (Test-Path .env)) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
}
else {
    Write-Host ".env already exists." -ForegroundColor Green
}

# Prisma
Write-Host "Generating Prisma client..." -ForegroundColor Cyan
npm run db:generate

Write-Host "Applying migrations..." -ForegroundColor Cyan
npm run db:migrate

if (-not $SkipSeed) {
    Write-Host "Seeding database..." -ForegroundColor Cyan
    npm run db:seed
}

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "Start the API with: npm run api:dev" -ForegroundColor Cyan
Write-Host "Start the web app with: npm run web:dev" -ForegroundColor Cyan
