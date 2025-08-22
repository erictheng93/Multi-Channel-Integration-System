# 驗證新域名路由腳本
# 測試 multi-channel.imfinethankyouandyou.com 是否正常工作

Write-Host "🔍 驗證新域名路由..." -ForegroundColor Cyan
Write-Host "域名: multi-channel.imfinethankyouandyou.com" -ForegroundColor Yellow
Write-Host ""

# 測試函數
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Description,
        [int]$TimeoutSeconds = 10
    )
    
    Write-Host "測試: $Description" -ForegroundColor White
    Write-Host "URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 成功 - HTTP $($response.StatusCode)" -ForegroundColor Green
            
            # 嘗試解析 JSON 回應
            try {
                $jsonContent = $response.Content | ConvertFrom-Json
                if ($jsonContent.status) {
                    Write-Host "   狀態: $($jsonContent.status)" -ForegroundColor Green
                }
                if ($jsonContent.message) {
                    Write-Host "   訊息: $($jsonContent.message)" -ForegroundColor Green
                }
                if ($jsonContent.timestamp) {
                    Write-Host "   時間戳: $($jsonContent.timestamp)" -ForegroundColor Green
                }
            } catch {
                Write-Host "   回應內容: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Green
            }
            
            return $true
        } else {
            Write-Host "⚠️  HTTP $($response.StatusCode)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "❌ 失敗: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    Write-Host ""
}

# 測試端點列表
$endpoints = @(
    @{
        Url = "https://multi-channel.imfinethankyouandyou.com/api/health"
        Description = "健康檢查端點"
    },
    @{
        Url = "https://multi-channel.imfinethankyouandyou.com/api/system/status"
        Description = "系統狀態端點"
    },
    @{
        Url = "https://multi-channel.imfinethankyouandyou.com/"
        Description = "根路徑"
    },
    @{
        Url = "https://multi-channel.imfinethankyouandyou.com/admin-dashboard.html"
        Description = "管理後台"
    }
)

# 執行測試
$successCount = 0
$totalCount = $endpoints.Count

Write-Host "=== 開始端點測試 ===" -ForegroundColor Magenta
Write-Host ""

foreach ($endpoint in $endpoints) {
    if (Test-Endpoint -Url $endpoint.Url -Description $endpoint.Description) {
        $successCount++
    }
}

Write-Host ""
Write-Host "=== 測試結果摘要 ===" -ForegroundColor Magenta
Write-Host "成功: $successCount / $totalCount" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })

if ($successCount -eq $totalCount) {
    Write-Host "🎉 所有端點都正常工作！" -ForegroundColor Green
} elseif ($successCount -gt 0) {
    Write-Host "⚠️  部分端點工作正常，請檢查失敗的端點" -ForegroundColor Yellow
} else {
    Write-Host "❌ 所有端點都無法訪問" -ForegroundColor Red
}

Write-Host ""

# DNS 解析測試
Write-Host "=== DNS 解析測試 ===" -ForegroundColor Magenta
try {
    $dnsResult = Resolve-DnsName -Name "multi-channel.imfinethankyouandyou.com" -Type A
    Write-Host "✅ DNS 解析成功" -ForegroundColor Green
    foreach ($record in $dnsResult) {
        if ($record.Type -eq "A") {
            Write-Host "   IP 地址: $($record.IPAddress)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ DNS 解析失敗: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 提供故障排除建議
Write-Host "=== 故障排除建議 ===" -ForegroundColor Magenta

if ($successCount -eq 0) {
    Write-Host "如果所有端點都無法訪問，請檢查：" -ForegroundColor Yellow
    Write-Host "1. Cloudflare 路由配置是否正確" -ForegroundColor White
    Write-Host "2. Worker 是否已部署" -ForegroundColor White
    Write-Host "3. DNS 記錄是否指向正確的 IP" -ForegroundColor White
    Write-Host "4. SSL/TLS 設置是否正確" -ForegroundColor White
    Write-Host ""
    Write-Host "建議執行的命令：" -ForegroundColor Yellow
    Write-Host "wrangler deploy" -ForegroundColor Cyan
    Write-Host "wrangler tail" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== 手動驗證步驟 ===" -ForegroundColor Magenta
Write-Host "1. 在瀏覽器中訪問: https://multi-channel.imfinethankyouandyou.com/api/health" -ForegroundColor White
Write-Host "2. 檢查 Cloudflare Dashboard 中的 Workers 部署狀態" -ForegroundColor White
Write-Host "3. 檢查 DNS 設置和路由配置" -ForegroundColor White
Write-Host "4. 查看 Worker 日誌: wrangler tail" -ForegroundColor White