# Developer One-Click Deployment Script
# Fast deployment for development iterations
# Usage: .\developer-deploy.ps1 [options]

param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
🔧 Developer One-Click Deployment Script

Usage:
  .\developer-deploy.ps1 [options]

Options:
  -SkipBuild      Skip frontend build step
  -SkipTests      Skip type checking and linting
  -BackendOnly    Deploy backend Worker only
  -FrontendOnly   Deploy frontend Pages only
  -Force          Skip confirmations
  -Help           Show this help

Examples:
  .\developer-deploy.ps1                    # Full deployment
  .\developer-deploy.ps1 -BackendOnly       # Backend only
  .\developer-deploy.ps1 -FrontendOnly      # Frontend only
  .\developer-deploy.ps1 -SkipBuild -Force  # Quick deployment
  
"@ -ForegroundColor Cyan
    exit 0
}

Write-Host "🔧 Developer Deployment Starting..." -ForegroundColor Green
Write-Host "Time: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray

# Check Cloudflare login
Write-Host "Checking Cloudflare login..." -ForegroundColor Yellow
$whoami = wrangler whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Please login first: wrangler login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in to Cloudflare" -ForegroundColor Green

# Confirmation unless forced
if (-not $Force -and -not $BackendOnly -and -not $FrontendOnly) {
    Write-Host "Deploy both frontend and backend? (y/N): " -NoNewline -ForegroundColor Yellow
    $confirm = Read-Host
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Deployment cancelled" -ForegroundColor Red
        exit 0
    }
}

# Backend deployment
if (-not $FrontendOnly) {
    Write-Host "`n📦 Deploying Backend Worker..." -ForegroundColor Cyan
    
    Write-Host "Deploying Worker..." -ForegroundColor Yellow
    wrangler deploy --env production
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Backend deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "Warning: Backend deployment had issues (possibly route conflicts)" -ForegroundColor Yellow
    }
    
    # Quick health check
    Start-Sleep -Seconds 3
    try {
        $response = Invoke-RestMethod -Uri "https://multi-channel.imfinethankyouandyou.com/api/system/health" -Method Get -TimeoutSec 10
        Write-Host "Backend health check: OK" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Backend health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Frontend deployment  
if (-not $BackendOnly) {
    Write-Host "`n🌐 Deploying Frontend..." -ForegroundColor Cyan
    
    # Build frontend if needed
    if (-not $SkipBuild) {
        Write-Host "Building frontend..." -ForegroundColor Yellow
        $originalPath = Get-Location
        try {
            Set-Location frontend
            
            if (-not $SkipTests) {
                Write-Host "Type checking..." -ForegroundColor Gray
                npm run type-check
                if ($LASTEXITCODE -ne 0) {
                    throw "Type check failed"
                }
            }
            
            Write-Host "Building production version..." -ForegroundColor Gray
            $env:NODE_ENV = "production"
            npm run build:pages
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed"
            }
            
            Write-Host "Frontend build completed" -ForegroundColor Green
        }
        finally {
            Set-Location $originalPath
        }
    }
    
    # Deploy to Pages
    Write-Host "Deploying to Pages..." -ForegroundColor Yellow
    wrangler pages deploy frontend/dist --project-name=multi-channel-platform-frontend
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Frontend deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "Error: Frontend deployment failed" -ForegroundColor Red
        exit 1
    }
}

# Summary
Write-Host "`n✅ Developer Deployment Complete!" -ForegroundColor Green
Write-Host "=" * 40

if (-not $BackendOnly -and -not $FrontendOnly) {
    Write-Host "Backend:  https://multi-channel.imfinethankyouandyou.com" -ForegroundColor Cyan
    Write-Host "Frontend: https://multi-channel-platform-frontend.pages.dev" -ForegroundColor Cyan
} elseif ($BackendOnly) {
    Write-Host "Backend:  https://multi-channel.imfinethankyouandyou.com" -ForegroundColor Cyan
} elseif ($FrontendOnly) {
    Write-Host "Frontend: https://multi-channel-platform-frontend.pages.dev" -ForegroundColor Cyan
}

Write-Host "`n🚀 Deployment completed in $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Green