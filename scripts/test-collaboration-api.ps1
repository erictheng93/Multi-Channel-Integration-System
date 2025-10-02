# Collaboration API 測試腳本
# 用途: 獲取 JWT Token 並測試協作功能 API

param(
    [string]$Email = "admin@dacit.net",
    [string]$Password = "",
    [string]$ApiUrl = "https://multi-channel.imfinethankyouandyou.com"
)

# 如果沒有提供密碼，提示輸入
if ([string]::IsNullOrEmpty($Password)) {
    $SecurePassword = Read-Host "請輸入密碼" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Collaboration API 測試工具" -ForegroundColor Cyan
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
    Write-Host ""
    Write-Host "💡 提示:" -ForegroundColor Yellow
    Write-Host "   1. 確認密碼正確" -ForegroundColor Gray
    Write-Host "   2. 確認網絡連接正常" -ForegroundColor Gray
    Write-Host "   3. 確認 API URL 正確: $ApiUrl" -ForegroundColor Gray
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# 步驟 2: 測試協作健康端點
Write-Host "🏥 步驟 2: 測試協作模組健康狀態..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/api/collaboration/health" -Headers $headers

    Write-Host "   ✅ 健康檢查成功！" -ForegroundColor Green
    Write-Host "   狀態: $($healthResponse.data.status)" -ForegroundColor Gray
    Write-Host "   預設協議: $($healthResponse.data.config.defaultProtocol)" -ForegroundColor Gray
    Write-Host "   WebSocket 啟用: $($healthResponse.data.config.enableWebSocket)" -ForegroundColor Gray
    Write-Host "   可用協議: $($healthResponse.data.availableProtocols -join ', ')" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ⚠️ 健康檢查失敗: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# 步驟 3: 測試協作統計
Write-Host "📊 步驟 3: 獲取協作統計數據..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "$ApiUrl/api/collaboration/stats" -Headers $headers

    Write-Host "   ✅ 統計數據獲取成功！" -ForegroundColor Green
    Write-Host "   查看者總數: $($statsResponse.data.totalViewers)" -ForegroundColor Gray
    Write-Host "   正在輸入: $($statsResponse.data.totalTyping)" -ForegroundColor Gray
    Write-Host "   活躍房間: $($statsResponse.data.totalRooms)" -ForegroundColor Gray
    Write-Host "   協議分布:" -ForegroundColor Gray
    Write-Host "     - SSE: $($statsResponse.data.connectionsByProtocol.sse)" -ForegroundColor Gray
    Write-Host "     - WebSocket: $($statsResponse.data.connectionsByProtocol.websocket)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ⚠️ 統計數據獲取失敗: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# 步驟 4: 測試 WebSocket 健康（無需認證）
Write-Host "🔌 步驟 4: 測試 WebSocket 健康狀態（無需認證）..." -ForegroundColor Yellow
try {
    $wsHealthResponse = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/health"

    Write-Host "   ✅ WebSocket 健康檢查成功！" -ForegroundColor Green
    Write-Host "   狀態: $($wsHealthResponse.status)" -ForegroundColor Gray
    Write-Host "   環境: $($wsHealthResponse.environment)" -ForegroundColor Gray
    Write-Host "   組件狀態:" -ForegroundColor Gray
    Write-Host "     - Durable Objects: $($wsHealthResponse.components.durableObjects.status)" -ForegroundColor Gray
    Write-Host "     - WebSocket: $($wsHealthResponse.components.websocket.status)" -ForegroundColor Gray
    Write-Host "     - SSE: $($wsHealthResponse.components.sse.status)" -ForegroundColor Gray
    Write-Host "     - Database: $($wsHealthResponse.components.database.status)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ⚠️ WebSocket 健康檢查失敗: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# 步驟 5: 測試 WebSocket 遷移狀態
Write-Host "🚀 步驟 5: 測試 WebSocket 遷移狀態..." -ForegroundColor Yellow
try {
    $migrationResponse = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/migration-status"

    Write-Host "   ✅ 遷移狀態獲取成功！" -ForegroundColor Green
    Write-Host "   WebSocket 啟用: $($migrationResponse.websocketEnabled)" -ForegroundColor Gray
    Write-Host "   SSE 啟用: $($migrationResponse.sseEnabled)" -ForegroundColor Gray
    Write-Host "   Durable Objects 可用: $($migrationResponse.durableObjectsAvailable)" -ForegroundColor Gray
    Write-Host "   推出百分比: $($migrationResponse.rolloutPercentage)%" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ⚠️ 遷移狀態獲取失敗: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# 總結
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    測試完成！" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 您的 JWT Token:" -ForegroundColor Yellow
Write-Host $TOKEN -ForegroundColor Green
Write-Host ""
Write-Host "📝 如何使用這個 Token:" -ForegroundColor Yellow
Write-Host "   curl -H 'Authorization: Bearer $TOKEN' \" -ForegroundColor Gray
Write-Host "     $ApiUrl/api/collaboration/health" -ForegroundColor Gray
Write-Host ""
Write-Host "   或者在 PowerShell 中:" -ForegroundColor Gray
Write-Host "   `$headers = @{'Authorization'='Bearer $TOKEN'}" -ForegroundColor Gray
Write-Host "   Invoke-RestMethod -Uri '$ApiUrl/api/...' -Headers `$headers" -ForegroundColor Gray
Write-Host ""

# 將 Token 保存到剪貼板（可選）
$saveToClipboard = Read-Host "是否將 Token 複製到剪貼板？(Y/N)"
if ($saveToClipboard -eq 'Y' -or $saveToClipboard -eq 'y') {
    Set-Clipboard -Value $TOKEN
    Write-Host "✅ Token 已複製到剪貼板！" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 測試腳本執行完畢！" -ForegroundColor Cyan
