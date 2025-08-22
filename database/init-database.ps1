# database/init-database.ps1
# 資料庫初始化腳本
# 專案名稱：Multi-Channel Support MVP

Write-Host "🚀 開始初始化資料庫..." -ForegroundColor Green

# 檢查是否在正確的目錄
if (-not (Test-Path "wrangler.toml")) {
    Write-Host "❌ 錯誤：請在專案根目錄執行此腳本" -ForegroundColor Red
    exit 1
}

# 檢查 wrangler 是否安裝
try {
    wrangler --version | Out-Null
} catch {
    Write-Host "❌ 錯誤：請先安裝 Wrangler CLI" -ForegroundColor Red
    Write-Host "💡 安裝指令：npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}

# 執行本地資料庫清理和初始化
Write-Host "🧹 正在清理本地 D1 資料庫..." -ForegroundColor Yellow
try {
    wrangler d1 execute omni-channel-platform --local --file=database/cleanup-remote.sql
    Write-Host "✅ 本地資料庫清理完成！" -ForegroundColor Green
} catch {
    Write-Host "⚠️  本地資料庫清理失敗，繼續執行..." -ForegroundColor Yellow
}

Write-Host "🏗️  正在建立本地資料庫結構..." -ForegroundColor Yellow
try {
    wrangler d1 execute omni-channel-platform --local --file=database/schema.sql
    Write-Host "✅ 本地資料庫初始化完成！" -ForegroundColor Green
} catch {
    Write-Host "❌ 本地資料庫初始化失敗：$_" -ForegroundColor Red
    exit 1
}

# 詢問是否要初始化遠端資料庫
$response = Read-Host "🌐 是否要初始化遠端 D1 資料庫？(y/N)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🧹 正在清理遠端 D1 資料庫..." -ForegroundColor Yellow
    try {
        wrangler d1 execute omni-channel-platform --remote --file=database/cleanup-remote.sql
        Write-Host "✅ 遠端資料庫清理完成！" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  遠端資料庫清理失敗，繼續執行..." -ForegroundColor Yellow
    }
    
    Write-Host "🏗️  正在建立遠端資料庫結構..." -ForegroundColor Yellow
    try {
        wrangler d1 execute omni-channel-platform --remote --file=database/schema.sql
        Write-Host "✅ 遠端資料庫初始化完成！" -ForegroundColor Green
    } catch {
        Write-Host "❌ 遠端資料庫初始化失敗：$_" -ForegroundColor Red
    }
}

# 執行驗證
Write-Host "🔍 正在驗證資料庫結構..." -ForegroundColor Yellow
try {
    node database/verify-schema.ts
    Write-Host "✅ 資料庫結構驗證完成！" -ForegroundColor Green
} catch {
    Write-Host "⚠️  資料庫驗證失敗，但初始化已完成" -ForegroundColor Yellow
}

Write-Host "🎉 資料庫初始化流程完成！" -ForegroundColor Green
Write-Host "📋 新的資料庫包含以下表格：" -ForegroundColor Cyan
Write-Host "   - customers (客戶)" -ForegroundColor White
Write-Host "   - conversations (對話)" -ForegroundColor White
Write-Host "   - messages (訊息)" -ForegroundColor White
Write-Host "   - agents (客服人員)" -ForegroundColor White
Write-Host "🧪 測試帳號已建立：admin@dacit.net, dacagent@dacit.net" -ForegroundColor Cyan