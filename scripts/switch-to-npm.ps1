# Switch to npm Development Environment
# This script switches the project back to use npm for local development

Write-Host ""
Write-Host "🔄 Switching back to npm development environment..." -ForegroundColor Cyan
Write-Host ""

# Remove Bun lockfile if exists
if (Test-Path "bun.lockb") {
    Write-Host "🗑️  Removing bun.lockb..." -ForegroundColor Yellow
    Remove-Item "bun.lockb" -Force
    Write-Host "✓ Removed bun.lockb" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No bun.lockb found (already using npm)" -ForegroundColor Gray
}

if (Test-Path "frontend/bun.lockb") {
    Write-Host "🗑️  Removing frontend/bun.lockb..." -ForegroundColor Yellow
    Remove-Item "frontend/bun.lockb" -Force
    Write-Host "✓ Removed frontend/bun.lockb" -ForegroundColor Green
}

Write-Host ""

# Check if npm is available
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js and npm first:" -ForegroundColor Yellow
    Write-Host "  https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}

# Display npm version
$npmVersion = npm --version
Write-Host "✓ npm detected: v$npmVersion" -ForegroundColor Green
Write-Host ""

# Reinstall backend dependencies with npm
Write-Host "📦 Reinstalling backend dependencies with npm..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# Reinstall frontend dependencies with npm
Write-Host "📦 Reinstalling frontend dependencies with npm..." -ForegroundColor Yellow
Set-Location frontend
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..
Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
Write-Host ""

# Success message
Write-Host "✅ Successfully switched back to npm!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "You can now use npm commands:" -ForegroundColor Cyan
Write-Host "  • Backend:  " -NoNewline -ForegroundColor White
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host "  • Frontend: " -NoNewline -ForegroundColor White
Write-Host "cd frontend && npm run dev" -ForegroundColor Yellow
Write-Host "  • Tests:    " -NoNewline -ForegroundColor White
Write-Host "npm test" -ForegroundColor Yellow
Write-Host ""
Write-Host "To switch to Bun:" -ForegroundColor Cyan
Write-Host "  .\scripts\switch-to-bun.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
