# Switch frontend to point to remote -dev environment
Write-Host "🔧 Switching frontend to REMOTE DEV environment..." -ForegroundColor Green

# Backup current .env.local if needed
$envFile = ".env.local" 
$content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue

if ($content -and $content -match "localhost:8787") {
    Copy-Item $envFile ".env.local.backup" -Force
    Write-Host "📦 Backed up current .env.local to .env.local.backup" -ForegroundColor Yellow
}

# Create .env.local pointing to remote dev
@"
# Development Environment Variables - Remote Dev Environment
# This file points to remote -dev environment

# Security Configuration
VITE_ENCRYPTION_KEY=2d73e9057d04b4f1a3e7176e0249db24b2d866924abcbf6f5686675e6941f370

# API Configuration - Remote Dev Backend
VITE_API_BASE_URL=https://multi-channel-dev.imfinethankyouandyou.com

# Development Configuration
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
"@ | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "✅ Frontend now points to REMOTE DEV environment" -ForegroundColor Green
Write-Host "💡 Start your backend with: npm run dev (remote -dev)" -ForegroundColor Cyan