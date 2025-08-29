# Fix Worker Names Script
# 確保正確的生產環境 Worker 名稱配置
# Usage: .\fix-worker-names.ps1

param(
    [switch]$DryRun,
    [switch]$DeleteIncorrectWorkers
)

$ErrorActionPreference = "Stop"

Write-Host "=== Multi-Channel Platform Worker 名稱修正工具 ===" -ForegroundColor Green
Write-Host ""

# 正確的 Worker 名稱
$CORRECT_PRODUCTION_WORKER = "multi-channel-platform"

# 檢查 Wrangler 登入狀態
Write-Host "檢查 Cloudflare 登入狀態..." -ForegroundColor Yellow
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 已登入: $whoami" -ForegroundColor Green
    } else {
        throw "未登入"
    }
} catch {
    Write-Host "❌ 請先登入 Cloudflare:" -ForegroundColor Red
    Write-Host "   wrangler login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 列出所有 Workers
Write-Host "檢查現有 Workers..." -ForegroundColor Yellow
try {
    $workers = wrangler deploy --dry-run --env production 2>&1 | Out-String
    Write-Host "當前配置預覽:" -ForegroundColor Cyan
    Write-Host $workers -ForegroundColor Gray
    
    # 列出實際的 Workers
    Write-Host ""
    Write-Host "列出所有 Workers..." -ForegroundColor Yellow
    $workerList = wrangler whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        # 因為 wrangler 沒有直接的 list workers 命令，我們嘗試其他方法
        Write-Host "請手動檢查 Cloudflare Dashboard 中的 Workers" -ForegroundColor Yellow
        Write-Host "Dashboard: https://dash.cloudflare.com/workers" -ForegroundColor Cyan
    }
} catch {
    Write-Host "警告: 無法列出 Workers，請手動檢查" -ForegroundColor Yellow
}

Write-Host ""

# 顯示正確的配置
Write-Host "=== 正確的 Worker 配置 ===" -ForegroundColor Green
Write-Host ""
Write-Host "生產環境 Worker:" -ForegroundColor Cyan
Write-Host "  名稱: $CORRECT_PRODUCTION_WORKER" -ForegroundColor White
Write-Host "  部署命令: wrangler deploy --env production" -ForegroundColor Gray
Write-Host ""
Write-Host ""

# 檢查配置文件
Write-Host "=== 檢查配置文件 ===" -ForegroundColor Green
Write-Host ""

# 檢查 wrangler.toml
if (Test-Path "wrangler.toml") {
    Write-Host "✓ wrangler.toml 存在" -ForegroundColor Green
    
    $wranglerContent = Get-Content "wrangler.toml" -Raw
    if ($wranglerContent -match 'name\s*=\s*"multi-channel-platform"') {
        Write-Host "✓ wrangler.toml 基礎名稱正確" -ForegroundColor Green
    } else {
        Write-Host "❌ wrangler.toml 基礎名稱錯誤" -ForegroundColor Red
    }
    
    # 檢查生產環境是否有重新定義 name
    if ($wranglerContent -match '\[env\.production\].*?name\s*=') {
        Write-Host "❌ 生產環境不應重新定義 name" -ForegroundColor Red
    } else {
        Write-Host "✓ 生產環境配置正確" -ForegroundColor Green
    }
} else {
    Write-Host "❌ wrangler.toml 不存在" -ForegroundColor Red
}

# 檢查 Terraform 配置
if (Test-Path "main.tf") {
    Write-Host "✓ main.tf 存在" -ForegroundColor Green
    
    $terraformContent = Get-Content "main.tf" -Raw
    if ($terraformContent -match 'base_project_name\s*=\s*"multi-channel-platform"') {
        Write-Host "✓ Terraform 配置正確" -ForegroundColor Green
    } else {
        Write-Host "❌ Terraform 配置可能有問題" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ main.tf 不存在（可選）" -ForegroundColor Yellow
}

Write-Host ""

# 提供修正建議
Write-Host "=== 修正步驟 ===" -ForegroundColor Green
Write-Host ""

Write-Host "如果發現錯誤的 Worker (如 multi-channel-platform-production):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 手動刪除錯誤的 Worker:" -ForegroundColor Cyan
Write-Host "   • 訪問 https://dash.cloudflare.com/workers" -ForegroundColor Gray
Write-Host "   • 找到錯誤的 Worker 並刪除" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 重新部署正確的 Worker:" -ForegroundColor Cyan
Write-Host "   wrangler deploy --env production" -ForegroundColor White
Write-Host ""
Write-Host "3. 驗證部署:" -ForegroundColor Cyan
Write-Host "   curl https://multi-channel.imfinethankyouandyou.com/api/system/health" -ForegroundColor White
Write-Host ""

# 測試當前配置
Write-Host "=== 測試當前配置 ===" -ForegroundColor Green
Write-Host ""

if (-not $DryRun) {
    Write-Host "測試 wrangler deploy --env production (dry-run)..." -ForegroundColor Yellow
    try {
        $deployTest = wrangler deploy --dry-run --env production 2>&1
        Write-Host "部署預覽:" -ForegroundColor Cyan
        Write-Host $deployTest -ForegroundColor Gray
        
        if ($deployTest -match $CORRECT_PRODUCTION_WORKER) {
            Write-Host "✓ 配置正確，將部署到: $CORRECT_PRODUCTION_WORKER" -ForegroundColor Green
        } else {
            Write-Host "❌ 配置錯誤，請檢查設定" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ 無法測試部署配置: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== 檢查完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "重要提醒:" -ForegroundColor Yellow
Write-Host "• 生產環境 Worker 名稱必須是: $CORRECT_PRODUCTION_WORKER" -ForegroundColor White
Write-Host "• 如有任何 multi-channel-platform-production Worker，請手動刪除" -ForegroundColor White
Write-Host ""
Write-Host "如需協助，請檢查 Cloudflare Dashboard:" -ForegroundColor Cyan
Write-Host "https://dash.cloudflare.com/workers" -ForegroundColor White