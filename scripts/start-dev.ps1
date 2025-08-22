# 本地開發環境啟動腳本
# 使用方法: .\start-dev.ps1

Write-Host "🚀 啟動多渠道客服系統本地開發環境..." -ForegroundColor Green

# 檢查是否安裝了必要的工具
Write-Host "🔍 檢查開發環境..." -ForegroundColor Yellow

# 檢查 Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "❌ 請先安裝 Node.js"
    exit 1
}

# 檢查 Wrangler
try {
    $wranglerVersion = wrangler --version
    Write-Host "✅ Wrangler: $wranglerVersion" -ForegroundColor Green
} catch {
    Write-Error "❌ 請先安裝 Wrangler: npm install -g wrangler"
    exit 1
}

# 檢查是否已登入 Cloudflare
try {
    wrangler whoami | Out-Null
    Write-Host "✅ Cloudflare 已登入" -ForegroundColor Green
} catch {
    Write-Host "⚠️  請先登入 Cloudflare: wrangler login" -ForegroundColor Yellow
}

# 安裝後端依賴
Write-Host "📦 安裝後端依賴..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
}

# 安裝前端依賴
Write-Host "📦 安裝前端依賴..." -ForegroundColor Yellow
if (-not (Test-Path "frontend/node_modules")) {
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host "🎯 準備啟動服務..." -ForegroundColor Yellow
Write-Host "後端將在 http://localhost:8787 啟動" -ForegroundColor Cyan
Write-Host "前端將在 http://localhost:3000 啟動" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意鍵繼續，或 Ctrl+C 取消..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 啟動後端 Worker (在新的 PowerShell 視窗中)
Write-Host "🔧 啟動後端 Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '🔧 後端 Worker 啟動中...' -ForegroundColor Green; wrangler dev --port 8787"

# 等待後端啟動
Write-Host "⏳ 等待後端啟動..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 測試後端連接
$maxRetries = 10
$retryCount = 0
$backendReady = $false

while ($retryCount -lt $maxRetries -and -not $backendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8787/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "✅ 後端 Worker 已就緒" -ForegroundColor Green
        }
    } catch {
        $retryCount++
        Write-Host "⏳ 等待後端啟動... ($retryCount/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $backendReady) {
    Write-Host "⚠️  後端可能需要更多時間啟動，繼續啟動前端..." -ForegroundColor Yellow
}

# 啟動前端 (在新的 PowerShell 視窗中)
Write-Host "🎨 啟動前端開發服務器..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; Write-Host '🎨 前端開發服務器啟動中...' -ForegroundColor Green; npm run dev"

# 等待前端啟動
Write-Host "⏳ 等待前端啟動..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 測試前端連接
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ 前端開發服務器已就緒" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  前端可能需要更多時間啟動" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 開發環境啟動完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📍 服務地址:" -ForegroundColor Cyan
Write-Host "  前端應用: http://localhost:3000" -ForegroundColor White
Write-Host "  後端 API: http://localhost:8787" -ForegroundColor White
Write-Host ""
Write-Host "🧪 測試 API 連接:" -ForegroundColor Cyan
Write-Host "  curl http://localhost:8787/api/health" -ForegroundColor White
Write-Host "  curl http://localhost:3000/api/health" -ForegroundColor White
Write-Host ""
Write-Host "📝 開發提示:" -ForegroundColor Yellow
Write-Host "  - 前端代碼修改會自動熱重載" -ForegroundColor White
Write-Host "  - 後端代碼修改會自動重啟 Worker" -ForegroundColor White
Write-Host "  - 查看瀏覽器控制台可以看到代理日誌" -ForegroundColor White
Write-Host ""
Write-Host "🛑 停止服務: 關閉對應的 PowerShell 視窗" -ForegroundColor Red

# 自動打開瀏覽器
Start-Sleep -Seconds 2
Write-Host "🌐 正在打開瀏覽器..." -ForegroundColor Green
Start-Process "http://localhost:3000"