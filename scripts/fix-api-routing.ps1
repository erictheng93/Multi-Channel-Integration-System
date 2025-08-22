# 修復 API 路由問題腳本

Write-Host "🔧 修復 API 路由問題..." -ForegroundColor Cyan
Write-Host ""

# 1. 檢查當前部署狀態
Write-Host "1. 檢查當前部署狀態..." -ForegroundColor Yellow
wrangler deployments list

Write-Host ""

# 2. 重新部署 Worker
Write-Host "2. 重新部署 Worker..." -ForegroundColor Yellow
Write-Host "執行: wrangler deploy" -ForegroundColor White
wrangler deploy

Write-Host ""

# 3. 等待部署完成
Write-Host "3. 等待部署完成 (10秒)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. 測試 API 端點
Write-Host "4. 測試 API 端點..." -ForegroundColor Yellow

$endpoints = @(
    "https://multi-channel.imfinethankyouandyou.com/health",
    "https://multi-channel.imfinethankyouandyou.com/api/health",
    "https://multi-channel.imfinethankyouandyou.com/api/system/status",
    "https://multi-channel.imfinethankyouandyou.com/api/stats"
)

foreach ($endpoint in $endpoints) {
    Write-Host "測試: $endpoint" -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 成功 - HTTP $($response.StatusCode)" -ForegroundColor Green
            # 顯示回應內容的前100個字符
            $content = $response.Content
            if ($content.Length -gt 100) {
                $content = $content.Substring(0, 100) + "..."
            }
            Write-Host "   回應: $content" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  HTTP $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ 失敗: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# 5. 檢查 Worker 日誌
Write-Host "5. 如果問題仍然存在，檢查 Worker 日誌..." -ForegroundColor Yellow
Write-Host "執行: wrangler tail" -ForegroundColor White
Write-Host "然後在另一個終端測試 API 端點以查看日誌" -ForegroundColor White

Write-Host ""
Write-Host "🎯 修復完成！" -ForegroundColor Green