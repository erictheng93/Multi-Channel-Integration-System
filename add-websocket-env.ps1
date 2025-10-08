# 添加 WebSocket 環境變數到前端配置
$envFile = "D:\Code\Multi_Channel_Integration_System\frontend\.env.development"
$websocketConfig = @"

# WebSocket 配置 (預設關閉，使用 SSE)
VITE_WEBSOCKET_ENABLED=false
VITE_WEBSOCKET_URL=wss://multi-channel.imfinethankyouandyou.com/ws
VITE_FALLBACK_TO_SSE=true
VITE_WEBSOCKET_AUTO_RECONNECT=true
VITE_WEBSOCKET_DEBUG=true
"@

# 檢查檔案是否已包含 WebSocket 配置
$content = Get-Content $envFile -Raw
if ($content -notmatch "VITE_WEBSOCKET") {
    Add-Content -Path $envFile -Value $websocketConfig -NoNewline
    Write-Host "✅ WebSocket 環境變數已添加到 .env.development"
} else {
    Write-Host "⚠️ WebSocket 環境變數已存在，跳過"
}

# 顯示最終內容
Write-Host "`n📄 當前 .env.development 內容:"
Get-Content $envFile
