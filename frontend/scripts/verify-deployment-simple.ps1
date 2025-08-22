# PowerShell 腳本：簡化的部署驗證

param(
    [string]$Environment = "production"
)

Write-Host "Verifying $Environment environment deployment..." -ForegroundColor Green

# 讀取環境變數
$envFile = if ($Environment -eq "production") { ".env.production" } else { ".env.development" }

if (-not (Test-Path $envFile)) {
    Write-Host "Error: Environment config file $envFile not found" -ForegroundColor Red
    exit 1
}

$apiBaseUrl = (Get-Content $envFile | Where-Object { $_ -match "VITE_API_BASE_URL=" }) -replace "VITE_API_BASE_URL=", ""
$apiBaseUrl = $apiBaseUrl.Trim()

Write-Host "API Base URL: $apiBaseUrl" -ForegroundColor Cyan

# 測試後端 API 連通性
Write-Host "Testing backend API connectivity..." -ForegroundColor Yellow

try {
    $healthUrl = "$apiBaseUrl/api/health"
    Write-Host "Testing health endpoint: $healthUrl" -ForegroundColor Cyan
    
    $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 10
    Write-Host "✅ Health check successful" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 檢查必要的配置檔案
Write-Host "Checking configuration files..." -ForegroundColor Yellow

$requiredFiles = @("_redirects", "functions/_middleware.ts", ".pages.toml")

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
    }
}

# 檢查構建輸出
if (Test-Path "dist") {
    Write-Host "✅ dist directory exists" -ForegroundColor Green
    
    $distFiles = @("dist/_redirects", "dist/functions/_middleware.ts")
    foreach ($file in $distFiles) {
        if (Test-Path $file) {
            Write-Host "✅ $file exists" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $file may need rebuild" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  dist directory not found, please run npm run build:pages" -ForegroundColor Yellow
}

Write-Host "Deployment verification completed!" -ForegroundColor Green