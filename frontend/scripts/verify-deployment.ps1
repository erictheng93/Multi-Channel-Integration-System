# PowerShell 腳本：驗證 Cloudflare Pages 部署和後端通信

param(
    [string]$Environment = "production"
)

Write-Host "正在驗證 $Environment 環境的部署配置..." -ForegroundColor Green

# 讀取環境變數
$envFile = if ($Environment -eq "production") { ".env.production" } else { ".env.development" }

if (-not (Test-Path $envFile)) {
    Write-Host "錯誤：找不到環境配置檔案 $envFile" -ForegroundColor Red
    exit 1
}

$apiBaseUrl = (Get-Content $envFile | Where-Object { $_ -match "VITE_API_BASE_URL=" }) -replace "VITE_API_BASE_URL=", ""
$apiBaseUrl = $apiBaseUrl.Trim()

Write-Host "API 基礎 URL: $apiBaseUrl" -ForegroundColor Cyan

# 測試後端 API 連通性
Write-Host "正在測試後端 API 連通性..." -ForegroundColor Yellow

try {
    # 測試健康檢查端點
    $healthUrl = "$apiBaseUrl/api/health"
    Write-Host "測試健康檢查端點: $healthUrl" -ForegroundColor Cyan
    
    $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 10
    Write-Host "✅ 健康檢查成功" -ForegroundColor Green
    Write-Host "回應: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
} catch {
    Write-Host "❌ 健康檢查失敗: $($_.Exception.Message)" -ForegroundColor Red
}

# 測試 CORS 配置
Write-Host "正在測試 CORS 配置..." -ForegroundColor Yellow

try {
    $headers = @{
        'Origin' = 'https://multi-channel-platform-frontend.pages.dev'
        'Access-Control-Request-Method' = 'POST'
        'Access-Control-Request-Headers' = 'Content-Type, Authorization'
    }
    
    $corsUrl = "$apiBaseUrl/api/auth/login"
    $response = Invoke-WebRequest -Uri $corsUrl -Method OPTIONS -Headers $headers -TimeoutSec 10
    
    if ($response.Headers['Access-Control-Allow-Origin']) {
        Write-Host "✅ CORS 配置正確" -ForegroundColor Green
    } else {
        Write-Host "⚠️  CORS 標頭可能缺失" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ CORS 測試失敗: $($_.Exception.Message)" -ForegroundColor Red
}

# 檢查必要的配置檔案
Write-Host "正在檢查配置檔案..." -ForegroundColor Yellow

$requiredFiles = @("_redirects", "functions/_middleware.ts", ".pages.toml")

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file 存在" -ForegroundColor Green
    } else {
        Write-Host "❌ $file 缺失" -ForegroundColor Red
    }
}

# 檢查構建輸出
if (Test-Path "dist") {
    Write-Host "✅ dist 目錄存在" -ForegroundColor Green
    
    $distFiles = @("dist/_redirects", "dist/functions/_middleware.ts")
    foreach ($file in $distFiles) {
        if (Test-Path $file) {
            Write-Host "✅ $file 存在" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $file 可能需要重新構建" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  dist 目錄不存在，請執行 npm run build:pages" -ForegroundColor Yellow
}

Write-Host "部署驗證完成！" -ForegroundColor Green