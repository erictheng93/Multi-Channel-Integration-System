# Switch frontend to point to local backend (localhost:8787)
Write-Host "🔧 Switching frontend to LOCAL backend..." -ForegroundColor Green

# Backup current .env.local if it doesn't point to localhost
$envFile = ".env.local"
$content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue

if ($content -and $content -notmatch "localhost:8787") {
    Copy-Item $envFile ".env.local.backup" -Force
    Write-Host "📦 Backed up current .env.local to .env.local.backup" -ForegroundColor Yellow
}

# Create .env.local pointing to localhost
@"
# Local Development Environment Variables
# This file points to local backend (localhost:8787)

# Security Configuration
VITE_ENCRYPTION_KEY=2d73e9057d04b4f1a3e7176e0249db24b2d866924abcbf6f5686675e6941f370

# API Configuration - Local Backend
VITE_API_BASE_URL=http://localhost:8787

# Development Configuration
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
"@ | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "✅ Frontend now points to LOCAL backend (localhost:8787)" -ForegroundColor Green
Write-Host "💡 Start your backend with: npm run dev:local" -ForegroundColor Cyan