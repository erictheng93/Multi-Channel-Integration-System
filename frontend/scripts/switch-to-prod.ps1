# Switch frontend to point to remote production environment
Write-Host "🔧 Switching frontend to REMOTE PRODUCTION environment..." -ForegroundColor Green

# Backup current .env.local if needed
$envFile = ".env.local"
$content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue

if ($content) {
    Copy-Item $envFile ".env.local.backup" -Force
    Write-Host "📦 Backed up current .env.local to .env.local.backup" -ForegroundColor Yellow
}

# Create .env.local pointing to production
@"
# Production Environment Variables - Remote Production
# This file points to remote production environment

# Security Configuration
VITE_ENCRYPTION_KEY=2d73e9057d04b4f1a3e7176e0249db24b2d866924abcbf6f5686675e6941f370

# API Configuration - Remote Production Backend
VITE_API_BASE_URL=https://multi-channel.imfinethankyouandyou.com

# Development Configuration (testing against prod)
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
"@ | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "✅ Frontend now points to REMOTE PRODUCTION environment" -ForegroundColor Red
Write-Host "⚠️  WARNING: You're now connecting to PRODUCTION!" -ForegroundColor Red
Write-Host "💡 Production backend is always running (no need to start locally)" -ForegroundColor Cyan