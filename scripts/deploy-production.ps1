# 生產環境完整部署腳本
# 使用方法: .\deploy-production.ps1

Write-Host "🚀 開始部署到生產環境..." -ForegroundColor Green

# 檢查環境
Write-Host "🔍 檢查部署環境..." -ForegroundColor Yellow

# 檢查 Wrangler 登入狀態
try {
    $whoami = wrangler whoami
    Write-Host "✅ Cloudflare 已登入: $whoami" -ForegroundColor Green
} catch {
    Write-Error "❌ 請先登入 Cloudflare: wrangler login"
    exit 1
}

# 檢查 Git 狀態
try {
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Host "⚠️  有未提交的更改，建議先提交代碼" -ForegroundColor Yellow
        Write-Host "繼續部署嗎？(y/N): " -NoNewline -ForegroundColor Yellow
        $continue = Read-Host
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "部署已取消" -ForegroundColor Red
            exit 0
        }
    }
} catch {
    Write-Host "⚠️  無法檢查 Git 狀態，繼續部署..." -ForegroundColor Yellow
}

# 步驟 1: 測試本地環境
Write-Host "`n📋 步驟 1: 測試本地環境" -ForegroundColor Cyan
Write-Host "=" * 50

.\test-api.ps1 local
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 本地環境測試失敗，請先修復問題" -ForegroundColor Red
    exit 1
}

# 步驟 2: 建置和測試前端
Write-Host "`n📋 步驟 2: 建置前端" -ForegroundColor Cyan
Write-Host "=" * 50

Set-Location frontend

# 安裝依賴
Write-Host "📦 安裝前端依賴..." -ForegroundColor Yellow
npm ci

# 類型檢查
Write-Host "🔍 執行類型檢查..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ 類型檢查失敗"
    Set-Location ..
    exit 1
}

# Lint 檢查
Write-Host "🧹 執行 Lint 檢查..." -ForegroundColor Yellow
npm run lint:check
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Lint 檢查失敗"
    Set-Location ..
    exit 1
}

# 建置前端
Write-Host "🏗️ 建置前端..." -ForegroundColor Yellow
$env:NODE_ENV = "production"
npm run build:pages
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ 前端建置失敗"
    Set-Location ..
    exit 1
}

Write-Host "✅ 前端建置完成" -ForegroundColor Green
Set-Location ..

# 步驟 3: 部署後端 Worker
Write-Host "`n📋 步驟 3: 部署後端 Worker" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "🚀 部署 Worker 到生產環境..." -ForegroundColor Yellow
wrangler deploy --env production
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Worker 部署失敗"
    exit 1
}

Write-Host "✅ Worker 部署完成" -ForegroundColor Green

# 等待 Worker 啟動
Write-Host "⏳ 等待 Worker 啟動..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 測試生產 Worker
Write-Host "🧪 測試生產 Worker..." -ForegroundColor Yellow
.\test-api.ps1 production
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Worker 測試失敗，但繼續部署前端..." -ForegroundColor Yellow
}

# 步驟 4: 部署前端到 Pages
Write-Host "`n📋 步驟 4: 部署前端到 Cloudflare Pages" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "🌐 部署前端到 Pages..." -ForegroundColor Yellow

# 檢查是否已有 Pages 專案
$projectName = "multi-channel-platform-frontend"
try {
    $existingProject = wrangler pages project list | Select-String $projectName
    if (-not $existingProject) {
        Write-Host "📝 創建新的 Pages 專案..." -ForegroundColor Yellow
        wrangler pages project create $projectName
    }
} catch {
    Write-Host "⚠️  無法檢查現有專案，嘗試直接部署..." -ForegroundColor Yellow
}

# 部署到 Pages
wrangler pages deploy frontend/dist --project-name=$projectName --compatibility-date=2024-01-01
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Pages 部署失敗"
    exit 1
}

Write-Host "✅ 前端部署完成" -ForegroundColor Green

# 步驟 5: 設定環境變數提醒
Write-Host "`n📋 步驟 5: 環境變數設定" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "⚠️  請在 Cloudflare Pages Dashboard 中設定以下環境變數:" -ForegroundColor Yellow
Write-Host ""
Write-Host "生產環境變數:" -ForegroundColor White
Write-Host "  VITE_API_BASE_URL = https://multi-channel.imfinethankyouandyou.com" -ForegroundColor Cyan
Write-Host "  VITE_DEV_MODE = false" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_DEBUG_LOGS = false" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_PERFORMANCE_MONITORING = true" -ForegroundColor Cyan
Write-Host ""
Write-Host "預覽環境變數:" -ForegroundColor White
Write-Host "  VITE_API_BASE_URL = https://multi-channel.imfinethankyouandyou.com" -ForegroundColor Cyan
Write-Host "  VITE_DEV_MODE = true" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_DEBUG_LOGS = true" -ForegroundColor Cyan

# 步驟 6: 最終測試
Write-Host "`n📋 步驟 6: 最終測試" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "⏳ 等待 Pages 部署完成..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 獲取 Pages URL
try {
    $pagesInfo = wrangler pages project list | Select-String $projectName
    if ($pagesInfo) {
        Write-Host "🌐 Pages 專案已部署" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  無法獲取 Pages 資訊" -ForegroundColor Yellow
}

# 部署完成總結
Write-Host "`n🎉 部署完成！" -ForegroundColor Green
Write-Host "=" * 50

Write-Host "📍 部署資訊:" -ForegroundColor Cyan
Write-Host "  後端 Worker: https://multi-channel.imfinethankyouandyou.com" -ForegroundColor White
Write-Host "  前端 Pages: https://$projectName.pages.dev" -ForegroundColor White
Write-Host ""

Write-Host "🔗 重要連結:" -ForegroundColor Cyan
Write-Host "  Cloudflare Dashboard: https://dash.cloudflare.com" -ForegroundColor White
Write-Host "  Pages 設定: https://dash.cloudflare.com/pages" -ForegroundColor White
Write-Host "  Workers 設定: https://dash.cloudflare.com/workers" -ForegroundColor White
Write-Host ""

Write-Host "📝 後續步驟:" -ForegroundColor Yellow
Write-Host "  1. 在 Pages Dashboard 中設定環境變數" -ForegroundColor White
Write-Host "  2. 設定自定義域名 (可選)" -ForegroundColor White
Write-Host "  3. 測試完整的應用功能" -ForegroundColor White
Write-Host "  4. 設定監控和警報" -ForegroundColor White
Write-Host ""

Write-Host "🧪 測試部署:" -ForegroundColor Yellow
Write-Host "  .\test-api.ps1 production" -ForegroundColor White
Write-Host ""

Write-Host "🎯 如果需要重新部署:" -ForegroundColor Yellow
Write-Host "  後端: wrangler deploy --env production" -ForegroundColor White
Write-Host "  前端: wrangler pages deploy frontend/dist --project-name=$projectName" -ForegroundColor White

Write-Host "`n✨ 部署成功完成！" -ForegroundColor Green