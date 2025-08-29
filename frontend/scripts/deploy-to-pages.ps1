# PowerShell 腳本：部署到 Cloudflare Pages

param(
    [string]$ProjectName = "multi-channel-platform-frontend",
    [switch]$SkipBuild = $false
)

Write-Host "Deploying to Cloudflare Pages..." -ForegroundColor Green
Write-Host "Project Name: $ProjectName" -ForegroundColor Cyan

# 檢查 Wrangler 是否已安裝
try {
    $wranglerVersion = wrangler --version
    Write-Host "Wrangler version: $wranglerVersion" -ForegroundColor Gray
} catch {
    Write-Host "❌ Wrangler not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}

# 構建專案（除非跳過）
if (-not $SkipBuild) {
    Write-Host "Building project for production environment..." -ForegroundColor Yellow
    
    try {
        npm run build:pages
        Write-Host "✅ Build completed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Skipping build..." -ForegroundColor Yellow
}

# 檢查 dist 目錄
if (-not (Test-Path "dist")) {
    Write-Host "❌ dist directory not found. Please run build first." -ForegroundColor Red
    exit 1
}

# 驗證必要檔案
$requiredFiles = @("dist/index.html", "dist/_redirects", "dist/functions/_middleware.ts")
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Required file missing: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ All required files present" -ForegroundColor Green

# 部署到 Cloudflare Pages
Write-Host "Deploying to Cloudflare Pages..." -ForegroundColor Yellow

try {
    wrangler pages deploy dist --project-name=$ProjectName
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host "Your app should be available at: https://$ProjectName.pages.dev" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Write-Host "Please check your Cloudflare authentication and project settings." -ForegroundColor Yellow
    exit 1
}

Write-Host "Deployment process completed!" -ForegroundColor Green