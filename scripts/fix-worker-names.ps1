# Fix Worker Names Script
# 確�?�?��?��??�環�?Worker ?�稱?�置
# Usage: .\fix-worker-names.ps1

param(
    [switch]$DryRun,
    [switch]$DeleteIncorrectWorkers
)

$ErrorActionPreference = "Stop"

Write-Host "=== Multi-Channel Platform Worker ?�稱修正工具 ===" -ForegroundColor Green
Write-Host ""

# �?��??Worker ?�稱
$CORRECT_PRODUCTION_WORKER = "mcis-worker"

# 檢查 Wrangler ?�入?�??
Write-Host "檢查 Cloudflare ?�入?�??.." -ForegroundColor Yellow
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "??已登?? $whoami" -ForegroundColor Green
    } else {
        throw "?�登??
    }
} catch {
    Write-Host "??請�??�入 Cloudflare:" -ForegroundColor Red
    Write-Host "   wrangler login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ?�出?�??Workers
Write-Host "檢查?��? Workers..." -ForegroundColor Yellow
try {
    $workers = wrangler deploy --dry-run --env production 2>&1 | Out-String
    Write-Host "?��??�置?�覽:" -ForegroundColor Cyan
    Write-Host $workers -ForegroundColor Gray
    
    # ?�出實�???Workers
    Write-Host ""
    Write-Host "?�出?�??Workers..." -ForegroundColor Yellow
    $workerList = wrangler whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        # ?�為 wrangler 沒�??�接??list workers ?�令，�??��?試其他方�?
        Write-Host "請�??�檢??Cloudflare Dashboard 中�? Workers" -ForegroundColor Yellow
        Write-Host "Dashboard: https://dash.cloudflare.com/workers" -ForegroundColor Cyan
    }
} catch {
    Write-Host "警�?: ?��??�出 Workers，�??��?檢查" -ForegroundColor Yellow
}

Write-Host ""

# 顯示�?��?��?�?
Write-Host "=== �?��??Worker ?�置 ===" -ForegroundColor Green
Write-Host ""
Write-Host "?�產?��? Worker:" -ForegroundColor Cyan
Write-Host "  ?�稱: $CORRECT_PRODUCTION_WORKER" -ForegroundColor White
Write-Host "  ?�署?�令: wrangler deploy --env production" -ForegroundColor Gray
Write-Host ""
Write-Host ""

# 檢查?�置?�件
Write-Host "=== 檢查?�置?�件 ===" -ForegroundColor Green
Write-Host ""

# 檢查 wrangler.toml
if (Test-Path "wrangler.toml") {
    Write-Host "??wrangler.toml 存在" -ForegroundColor Green
    
    $wranglerContent = Get-Content "wrangler.toml" -Raw
    if ($wranglerContent -match 'name\s*=\s*"mcis-worker"') {
        Write-Host "??wrangler.toml ?��??�稱�?��" -ForegroundColor Green
    } else {
        Write-Host "??wrangler.toml ?��??�稱?�誤" -ForegroundColor Red
    }
    
    # 檢查?�產?��??�否?��??��?�?name
    if ($wranglerContent -match '\[env\.production\].*?name\s*=') {
        Write-Host "???�產?��?不�??�新定義 name" -ForegroundColor Red
    } else {
        Write-Host "???�產?��??�置�?��" -ForegroundColor Green
    }
} else {
    Write-Host "??wrangler.toml 不�??? -ForegroundColor Red
}

# 檢查 Terraform ?�置
if (Test-Path "main.tf") {
    Write-Host "??main.tf 存在" -ForegroundColor Green
    
    $terraformContent = Get-Content "main.tf" -Raw
    if ($terraformContent -match 'base_project_name\s*=\s*"mcis-worker"') {
        Write-Host "??Terraform ?�置�?��" -ForegroundColor Green
    } else {
        Write-Host "??Terraform ?�置?�能?��?�? -ForegroundColor Red
    }
} else {
    Write-Host "??main.tf 不�??��??�選�? -ForegroundColor Yellow
}

Write-Host ""

# ?��?修正建議
Write-Host "=== 修正步�? ===" -ForegroundColor Green
Write-Host ""

Write-Host "如�??�現?�誤??Worker (�?mcis-worker-production):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ?��??�除?�誤??Worker:" -ForegroundColor Cyan
Write-Host "   ??訪�? https://dash.cloudflare.com/workers" -ForegroundColor Gray
Write-Host "   ???�到?�誤??Worker 並刪?? -ForegroundColor Gray
Write-Host ""
Write-Host "2. ?�新?�署�?��??Worker:" -ForegroundColor Cyan
Write-Host "   wrangler deploy --env production" -ForegroundColor White
Write-Host ""
Write-Host "3. 驗�??�署:" -ForegroundColor Cyan
Write-Host "   curl https://mcis-backend.daiwandist.com/api/system/health" -ForegroundColor White
Write-Host ""

# 測試?��??�置
Write-Host "=== 測試?��??�置 ===" -ForegroundColor Green
Write-Host ""

if (-not $DryRun) {
    Write-Host "測試 wrangler deploy --env production (dry-run)..." -ForegroundColor Yellow
    try {
        $deployTest = wrangler deploy --dry-run --env production 2>&1
        Write-Host "?�署?�覽:" -ForegroundColor Cyan
        Write-Host $deployTest -ForegroundColor Gray
        
        if ($deployTest -match $CORRECT_PRODUCTION_WORKER) {
            Write-Host "???�置�?��，�??�署?? $CORRECT_PRODUCTION_WORKER" -ForegroundColor Green
        } else {
            Write-Host "???�置?�誤，�?檢查設�?" -ForegroundColor Red
        }
    } catch {
        Write-Host "???��?測試?�署?�置: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== 檢查完�? ===" -ForegroundColor Green
Write-Host ""
Write-Host "?��??��?:" -ForegroundColor Yellow
Write-Host "???�產?��? Worker ?�稱必�??? $CORRECT_PRODUCTION_WORKER" -ForegroundColor White
Write-Host "??如�?任�? mcis-worker-production Worker，�??��??�除" -ForegroundColor White
Write-Host ""
Write-Host "如�??�助，�?檢查 Cloudflare Dashboard:" -ForegroundColor Cyan
Write-Host "https://dash.cloudflare.com/workers" -ForegroundColor White