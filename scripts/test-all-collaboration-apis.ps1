# Collaboration API 完整測試腳本
# 用途: 測試所有協作功能 API 端點

param(
    [string]$Email = "admin@dacit.net",
    [string]$Password = "16011587DaC",
    [string]$ApiUrl = "https://multi-channel.imfinethankyouandyou.com"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Collaboration API 完整測試工具" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 步驟 1: 登入獲取 Token
Write-Host "🔐 步驟 1: 登入獲取 JWT Token..." -ForegroundColor Yellow
Write-Host "   Email: $Email" -ForegroundColor Gray

$loginBody = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$ApiUrl/api/auth/login" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $loginBody

    $TOKEN = $loginResponse.data.token
    $user = $loginResponse.data.user

    Write-Host "   ✅ 登入成功！" -ForegroundColor Green
    Write-Host "   用戶: $($user.displayName) ($($user.role))" -ForegroundColor Gray
    Write-Host "   Token: $($TOKEN.Substring(0, 50))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ❌ 登入失敗: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# 測試結果統計
$totalTests = 0
$passedTests = 0
$failedTests = 0

# 測試函數
function Test-API {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [bool]$ExpectSuccess = $true
    )

    $script:totalTests++
    Write-Host "📝 測試 $totalTests : $Name" -ForegroundColor Yellow
    Write-Host "   方法: $Method $Endpoint" -ForegroundColor Gray

    try {
        $params = @{
            Uri = "$ApiUrl$Endpoint"
            Method = $Method
            Headers = $headers
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            Write-Host "   請求體: $($params.Body)" -ForegroundColor Gray
        }

        $response = Invoke-RestMethod @params

        if ($response.success -eq $ExpectSuccess) {
            $script:passedTests++
            Write-Host "   ✅ 通過" -ForegroundColor Green
            if ($response.data) {
                Write-Host "   響應數據:" -ForegroundColor Gray
                Write-Host "   $($response.data | ConvertTo-Json -Compress)" -ForegroundColor Gray
            }
        } else {
            $script:failedTests++
            Write-Host "   ❌ 失敗: 預期 success=$ExpectSuccess, 實際 success=$($response.success)" -ForegroundColor Red
        }

    } catch {
        $script:failedTests++
        Write-Host "   ❌ 失敗: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "開始 API 測試" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 測試 1: Health Check
Test-API -Name "健康檢查" `
    -Method "GET" `
    -Endpoint "/api/collaboration/health"

# 測試 2: Stats
Test-API -Name "獲取統計數據" `
    -Method "GET" `
    -Endpoint "/api/collaboration/stats"

# 測試 3: Update Presence
Test-API -Name "更新在線狀態 (online)" `
    -Method "POST" `
    -Endpoint "/api/collaboration/presence" `
    -Body @{
        status = "online"
        metadata = @{
            device = "PowerShell Test"
        }
    }

# 測試 4: Join Conversation
Test-API -Name "加入對話 (ID: 1)" `
    -Method "POST" `
    -Endpoint "/api/collaboration/conversations/1/join" `
    -Body @{}

# 測試 5: Get Conversation State
Test-API -Name "獲取對話狀態 (ID: 1)" `
    -Method "GET" `
    -Endpoint "/api/collaboration/conversations/1/state"

# 測試 6: Get Conversation Viewers
Test-API -Name "獲取對話查看者列表 (ID: 1)" `
    -Method "GET" `
    -Endpoint "/api/collaboration/conversations/1/viewers"

# 測試 7: Send Typing Start
Test-API -Name "發送輸入開始狀態" `
    -Method "POST" `
    -Endpoint "/api/collaboration/typing" `
    -Body @{
        conversationId = 1
        status = "start"
    }

# 測試 8: Send Typing Stop
Test-API -Name "發送輸入停止狀態" `
    -Method "POST" `
    -Endpoint "/api/collaboration/typing" `
    -Body @{
        conversationId = 1
        status = "stop"
    }

# 測試 9: Leave Conversation
Test-API -Name "離開對話 (ID: 1)" `
    -Method "POST" `
    -Endpoint "/api/collaboration/conversations/1/leave" `
    -Body @{}

# 測試 10: Cleanup (Admin only)
Test-API -Name "清理過期狀態" `
    -Method "POST" `
    -Endpoint "/api/collaboration/cleanup" `
    -Body @{}

# WebSocket 相關測試 (無需認證)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "WebSocket 基礎設施測試" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 移除認證 header 進行公開端點測試
$publicHeaders = @{
    "Content-Type" = "application/json"
}

Write-Host "📝 測試: WebSocket 健康檢查" -ForegroundColor Yellow
try {
    $wsHealth = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/health"
    $script:totalTests++
    $script:passedTests++
    Write-Host "   ✅ 通過" -ForegroundColor Green
    Write-Host "   狀態: $($wsHealth.status)" -ForegroundColor Gray
    Write-Host "   環境: $($wsHealth.environment)" -ForegroundColor Gray
} catch {
    $script:totalTests++
    $script:failedTests++
    Write-Host "   ❌ 失敗: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "📝 測試: WebSocket 遷移狀態" -ForegroundColor Yellow
try {
    $wsMigration = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/migration-status"
    $script:totalTests++
    $script:passedTests++
    Write-Host "   ✅ 通過" -ForegroundColor Green
    Write-Host "   WebSocket 啟用: $($wsMigration.websocketEnabled)" -ForegroundColor Gray
    Write-Host "   SSE 啟用: $($wsMigration.sseEnabled)" -ForegroundColor Gray
} catch {
    $script:totalTests++
    $script:failedTests++
    Write-Host "   ❌ 失敗: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 測試結果總結
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "測試結果總結" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "總測試數: $totalTests" -ForegroundColor White
Write-Host "✅ 通過: $passedTests" -ForegroundColor Green
Write-Host "❌ 失敗: $failedTests" -ForegroundColor Red

if ($failedTests -eq 0) {
    Write-Host ""
    Write-Host "🎉 所有測試通過！" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ 有 $failedTests 個測試失敗" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "測試完成" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
