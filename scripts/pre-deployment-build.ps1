# Pre-deployment Build Script (Windows PowerShell)
# 這個腳本會在 Terraform 部署前準備所有必要的文件

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  多渠道客服系統 - 部署前準備" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 檢查必要的工具
Write-Host "🔍 檢查必要工具..." -ForegroundColor Yellow

$tools = @("node", "npm", "wrangler", "terraform")
foreach ($tool in $tools) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "❌ 錯誤: 需要安裝 $tool" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ 所有必要工具已安裝" -ForegroundColor Green
Write-Host ""

# 檢查 Cloudflare API Token
if ([string]::IsNullOrEmpty($env:CLOUDFLARE_API_TOKEN)) {
    Write-Host "⚠️  警告: 未設置 CLOUDFLARE_API_TOKEN 環境變數" -ForegroundColor Yellow
    Write-Host "   請執行: `$env:CLOUDFLARE_API_TOKEN=`"your-token-here`"" -ForegroundColor Yellow
    Write-Host ""
}

# 安裝後端依賴
Write-Host "📦 安裝後端依賴..." -ForegroundColor Yellow
npm install
Write-Host "✅ 後端依賴安裝完成" -ForegroundColor Green
Write-Host ""

# 安裝前端依賴
Write-Host "📦 安裝前端依賴..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..
Write-Host "✅ 前端依賴安裝完成" -ForegroundColor Green
Write-Host ""

# TypeScript 編譯檢查
Write-Host "🔨 執行 TypeScript 編譯檢查..." -ForegroundColor Yellow
npm run build
Write-Host "✅ TypeScript 編譯檢查通過" -ForegroundColor Green
Write-Host ""

# 建置 Worker
Write-Host "🏗️  建置 Cloudflare Worker..." -ForegroundColor Yellow
if (!(Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" | Out-Null
}

# 使用 esbuild 打包
npx wrangler deploy --dry-run --outdir=dist
Write-Host "✅ Worker 建置完成" -ForegroundColor Green
Write-Host ""

# 建置前端
Write-Host "🎨 建置前端應用..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..
Write-Host "✅ 前端建置完成" -ForegroundColor Green
Write-Host ""

# 驗證必要文件存在
Write-Host "✅ 驗證建置產物..." -ForegroundColor Yellow
if (!(Test-Path "dist\index.js")) {
    Write-Host "❌ 錯誤: dist\index.js 不存在" -ForegroundColor Red
    exit 1
}

if (!(Test-Path "frontend\dist")) {
    Write-Host "❌ 錯誤: frontend\dist 不存在" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 所有建置產物就緒" -ForegroundColor Green
Write-Host ""

# 檢查 terraform.tfvars
if (!(Test-Path "terraform.tfvars")) {
    Write-Host "⚠️  警告: terraform.tfvars 不存在" -ForegroundColor Yellow
    Write-Host "   建議執行: Copy-Item terraform.tfvars.example terraform.tfvars" -ForegroundColor Yellow
    Write-Host "   然後編輯 terraform.tfvars 填入實際配置" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ✅ 部署前準備完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "  1. 確保已設置 CLOUDFLARE_API_TOKEN" -ForegroundColor White
Write-Host "  2. 檢查 terraform.tfvars 配置" -ForegroundColor White
Write-Host "  3. 執行 terraform init" -ForegroundColor White
Write-Host "  4. 執行 terraform plan" -ForegroundColor White
Write-Host "  5. 執行 terraform apply" -ForegroundColor White
Write-Host ""
