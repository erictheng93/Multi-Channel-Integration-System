# Cloudflare Pages 前端部署腳本
# 使用方法: .\deploy-frontend.ps1 [production|preview]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("production", "preview")]
    [string]$Environment = "preview"
)

Write-Host "🚀 開始部署前端到 Cloudflare Pages..." -ForegroundColor Green

# 檢查是否在正確的目錄
if (-not (Test-Path "frontend")) {
    Write-Error "請在專案根目錄執行此腳本"
    exit 1
}

# 進入前端目錄
Set-Location frontend

try {
    # 安裝依賴
    Write-Host "📦 安裝依賴..." -ForegroundColor Yellow
    npm ci

    # 類型檢查
    Write-Host "🔍 執行類型檢查..." -ForegroundColor Yellow
    npm run type-check

    # Lint 檢查
    Write-Host "🧹 執行 Lint 檢查..." -ForegroundColor Yellow
    npm run lint:check

    # 建置專案
    Write-Host "🏗️ 建置專案..." -ForegroundColor Yellow
    if ($Environment -eq "production") {
        $env:NODE_ENV = "production"
    }
    npm run build

    # 檢查建置結果
    if (-not (Test-Path "dist")) {
        Write-Error "建置失敗：找不到 dist 目錄"
        exit 1
    }

    Write-Host "✅ 前端建置完成！" -ForegroundColor Green
    Write-Host "📁 建置文件位於: frontend/dist/" -ForegroundColor Cyan
    
    # 顯示建置統計
    $distSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "📊 建置大小: $([math]::Round($distSize, 2)) MB" -ForegroundColor Cyan

    Write-Host "`n🌐 接下來的步驟:" -ForegroundColor Yellow
    Write-Host "1. 登入 Cloudflare Dashboard" -ForegroundColor White
    Write-Host "2. 前往 Pages 服務" -ForegroundColor White
    Write-Host "3. 創建新專案或連接到現有專案" -ForegroundColor White
    Write-Host "4. 上傳 frontend/dist/ 目錄中的所有文件" -ForegroundColor White
    Write-Host "5. 設定環境變數 (參考 .env.production)" -ForegroundColor White
    Write-Host "6. 配置自定義域名 (可選)" -ForegroundColor White

} catch {
    Write-Error "部署過程中發生錯誤: $_"
    exit 1
} finally {
    # 回到原目錄
    Set-Location ..
}

Write-Host "`n🎉 前端部署準備完成！" -ForegroundColor Green