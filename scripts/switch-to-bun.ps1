# Switch to Bun Development Environment
# This script switches the project to use Bun for local development

Write-Host ""
Write-Host "🔄 Switching to Bun development environment..." -ForegroundColor Cyan
Write-Host ""

# Check if Bun is installed
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Bun is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Bun first:" -ForegroundColor Yellow
    Write-Host "  powershell -c `"irm bun.sh/install.ps1|iex`"" -ForegroundColor White
    Write-Host ""
    Write-Host "Or visit: https://bun.sh" -ForegroundColor Cyan
    exit 1
}

# Display Bun version
$bunVersion = bun --version
Write-Host "✓ Bun detected: v$bunVersion" -ForegroundColor Green
Write-Host ""

# Install backend dependencies
Write-Host "📦 Installing backend dependencies with Bun..." -ForegroundColor Yellow
bun install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# Install frontend dependencies
Write-Host "📦 Installing frontend dependencies with Bun..." -ForegroundColor Yellow
Set-Location frontend
bun install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..
Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
Write-Host ""

# Success message
Write-Host "✅ Successfully switched to Bun!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "You can now use Bun commands:" -ForegroundColor Cyan
Write-Host "  • Backend:  " -NoNewline -ForegroundColor White
Write-Host "bun run dev" -ForegroundColor Yellow
Write-Host "  • Frontend: " -NoNewline -ForegroundColor White
Write-Host "cd frontend && bun run bun:dev" -ForegroundColor Yellow
Write-Host "  • Tests:    " -NoNewline -ForegroundColor White
Write-Host "bun test" -ForegroundColor Yellow
Write-Host ""
Write-Host "To switch back to npm:" -ForegroundColor Cyan
Write-Host "  .\scripts\switch-to-npm.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
