# API 連接測試腳本
# 使用方法: .\test-api.ps1 [local|production]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "production", "all")]
    [string]$Environment = "all"
)

function Test-ApiEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSec = 10
    )
    
    Write-Host "🧪 測試 $Name..." -ForegroundColor Yellow
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ $Name - 連接成功 (200 OK)" -ForegroundColor Green
            
            # 嘗試解析 JSON 響應
            try {
                $jsonContent = $response.Content | ConvertFrom-Json
                Write-Host "   響應: $($jsonContent | ConvertTo-Json -Compress)" -ForegroundColor Cyan
            } catch {
                Write-Host "   響應: $($response.Content)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "⚠️  $Name - 狀態碼: $($response.StatusCode)" -ForegroundColor Yellow
        }
        
        return $true
    } catch {
        Write-Host "❌ $Name - 連接失敗" -ForegroundColor Red
        Write-Host "   錯誤: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "🔍 API 連接測試開始..." -ForegroundColor Green
Write-Host ""

$testResults = @{}

# 測試本地環境
if ($Environment -eq "local" -or $Environment -eq "all") {
    Write-Host "📍 測試本地開發環境" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    # 測試本地 Worker
    $testResults["local-worker"] = Test-ApiEndpoint -Url "http://localhost:8787/api/health" -Name "本地 Worker"
    
    # 測試前端代理
    $testResults["local-proxy"] = Test-ApiEndpoint -Url "http://localhost:3000/api/health" -Name "前端代理"
    
    Write-Host ""
}

# 測試生產環境
if ($Environment -eq "production" -or $Environment -eq "all") {
    Write-Host "📍 測試生產環境" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    # 測試生產 Worker
    $testResults["prod-worker"] = Test-ApiEndpoint -Url "https://multi-channel.imfinethankyouandyou.com/api/health" -Name "生產 Worker"
    
    Write-Host ""
}

# 測試其他常用端點
if ($Environment -eq "all") {
    Write-Host "📍 測試其他 API 端點" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    $endpoints = @(
        @{ Url = "http://localhost:8787/api/auth/profile"; Name = "本地認證端點" },
        @{ Url = "http://localhost:3000/api/auth/profile"; Name = "前端代理認證端點" }
    )
    
    foreach ($endpoint in $endpoints) {
        $testResults[$endpoint.Name] = Test-ApiEndpoint -Url $endpoint.Url -Name $endpoint.Name -TimeoutSec 5
    }
    
    Write-Host ""
}

# 測試結果總結
Write-Host "📊 測試結果總結" -ForegroundColor Green
Write-Host "=" * 50

$successCount = 0
$totalCount = 0

foreach ($test in $testResults.GetEnumerator()) {
    $totalCount++
    if ($test.Value) {
        $successCount++
        Write-Host "✅ $($test.Key)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($test.Key)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "成功: $successCount/$totalCount" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })

# 提供故障排除建議
if ($successCount -lt $totalCount) {
    Write-Host ""
    Write-Host "🔧 故障排除建議:" -ForegroundColor Yellow
    
    if ($testResults["local-worker"] -eq $false) {
        Write-Host "  - 確認後端 Worker 正在運行: wrangler dev" -ForegroundColor White
        Write-Host "  - 檢查端口 8787 是否被占用" -ForegroundColor White
    }
    
    if ($testResults["local-proxy"] -eq $false) {
        Write-Host "  - 確認前端開發服務器正在運行: npm run dev" -ForegroundColor White
        Write-Host "  - 檢查 Vite 代理配置" -ForegroundColor White
    }
    
    if ($testResults["prod-worker"] -eq $false) {
        Write-Host "  - 確認生產 Worker 已部署: wrangler deploy" -ForegroundColor White
        Write-Host "  - 檢查域名 DNS 設定" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🎯 下一步操作:" -ForegroundColor Cyan
if ($Environment -eq "local" -or $Environment -eq "all") {
    Write-Host "  - 訪問前端應用: http://localhost:3000" -ForegroundColor White
    Write-Host "  - 查看 API 文檔: http://localhost:8787/docs (如果有)" -ForegroundColor White
}
if ($Environment -eq "production" -or $Environment -eq "all") {
    Write-Host "  - 部署前端到 Pages: .\deploy-frontend.ps1" -ForegroundColor White
}

Write-Host ""