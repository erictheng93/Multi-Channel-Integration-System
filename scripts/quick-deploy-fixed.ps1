# Multi-Channel Platform Quick Deploy Script
# Automated deployment for both backend (Workers) and frontend (Pages)

param(
    [string]$Environment = "production",
    [switch]$SkipBuild = $false,
    [switch]$AutoApprove = $false,
    [switch]$Destroy = $false,
    [switch]$Help = $false
)

# Show help information
if ($Help) {
    Write-Host @"
🚀 Multi-Channel Customer Support System - Quick Deploy Script

Usage:
  .\quick-deploy-fixed.ps1 [options]

Options:
  -Environment <env>    Deploy environment (development/staging/production)
  -SkipBuild           Skip build steps
  -AutoApprove         Auto-approve Terraform changes
  -Destroy             Destroy all resources
  -Help                Show this help information

Examples:
  .\quick-deploy-fixed.ps1                           # Deploy to production
  .\quick-deploy-fixed.ps1 -Environment staging      # Deploy to staging
  .\quick-deploy-fixed.ps1 -AutoApprove              # Auto-approve changes

"@ -ForegroundColor Cyan
    exit 0
}

Write-Host "🚀 Multi-Channel Platform - Quick Deploy Started" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Cyan

# Check required tools
function Test-RequiredTools {
    Write-Host "🔍 Checking required tools..." -ForegroundColor Yellow
    
    $tools = @(
        @{ Name = "wrangler"; Command = "wrangler --version" },
        @{ Name = "node"; Command = "node --version" },
        @{ Name = "npm"; Command = "npm --version" }
    )
    
    foreach ($tool in $tools) {
        try {
            $output = Invoke-Expression $tool.Command 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ $($tool.Name) is installed" -ForegroundColor Green
            } else {
                throw "Command failed"
            }
        }
        catch {
            Write-Host "  ❌ $($tool.Name) not installed or not in PATH" -ForegroundColor Red
            Write-Host "     Please install $($tool.Name) and try again" -ForegroundColor Red
            exit 1
        }
    }
}

# Check Cloudflare authentication
function Test-CloudflareAuth {
    Write-Host "🔐 Checking Cloudflare authentication..." -ForegroundColor Yellow
    
    try {
        $whoami = wrangler whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Cloudflare is authenticated" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Please login to Cloudflare: wrangler login" -ForegroundColor Red
            exit 1
        }
    }
    catch {
        Write-Host "  ❌ Unable to check Cloudflare authentication status" -ForegroundColor Red
        exit 1
    }
}

# Build backend
function Build-Backend {
    Write-Host "🔨 Building backend..." -ForegroundColor Yellow
    
    # Install backend dependencies
    Write-Host "  📦 Installing backend dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Backend dependency installation failed" -ForegroundColor Red
        exit 1
    }
    
    # Build backend
    Write-Host "  🔨 Building backend..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Backend build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Backend build completed" -ForegroundColor Green
}

# Build frontend
function Build-Frontend {
    Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
    
    # Change to frontend directory
    Push-Location frontend
    
    try {
        # Install frontend dependencies
        Write-Host "  📦 Installing frontend dependencies..." -ForegroundColor Cyan
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Frontend dependency installation failed" -ForegroundColor Red
            exit 1
        }
        
        # Build frontend
        Write-Host "  🔨 Building frontend..." -ForegroundColor Cyan
        npm run build:pages
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Frontend build failed" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "  ✅ Frontend build completed" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

# Deploy backend to Workers
function Deploy-Backend {
    Write-Host "🚀 Deploying backend to Cloudflare Workers..." -ForegroundColor Yellow
    
    npm run deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Backend deployment failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Backend deployed successfully" -ForegroundColor Green
}

# Deploy frontend to Pages
function Deploy-Frontend {
    Write-Host "🚀 Deploying frontend to Cloudflare Pages..." -ForegroundColor Yellow
    
    Push-Location frontend
    
    try {
        npm run deploy:pages
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Frontend deployment failed" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "  ✅ Frontend deployed successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

# Show deployment results
function Show-DeploymentResults {
    Write-Host ""
    Write-Host "📊 Deployment Results:" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Backend (Cloudflare Workers):" -ForegroundColor Cyan
    Write-Host "   - Worker: multi-channel-platform-$Environment" -ForegroundColor White
    Write-Host "   - Domain: multi-channel.imfinethankyouandyou.com" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ Frontend (Cloudflare Pages):" -ForegroundColor Cyan
    Write-Host "   - URL: https://multi-channel-platform-frontend.pages.dev" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
}

# Main execution flow
try {
    Test-RequiredTools
    Test-CloudflareAuth
    
    if (-not $SkipBuild) {
        Build-Backend
        Build-Frontend
    }
    
    Deploy-Backend
    Deploy-Frontend
    
    Show-DeploymentResults
    
    Write-Host ""
    Write-Host "✨ Quick deploy script completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error during deployment: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}