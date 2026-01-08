# æ·»å? WebSocket ?°å?è®Šæ•¸?°å?ç«¯é?ç½?
$envFile = "D:\Code\Multi_Channel_Integration_System\frontend\.env.development"
$websocketConfig = @"

# WebSocket ?ç½® (?è¨­?œé?ï¼Œä½¿??SSE)
VITE_WEBSOCKET_ENABLED=false
VITE_WEBSOCKET_URL=wss://your-api-domain.example.com/ws
VITE_FALLBACK_TO_SSE=true
VITE_WEBSOCKET_AUTO_RECONNECT=true
VITE_WEBSOCKET_DEBUG=true
"@

# æª¢æŸ¥æª”æ??¯å¦å·²å???WebSocket ?ç½®
$content = Get-Content $envFile -Raw
if ($content -notmatch "VITE_WEBSOCKET") {
    Add-Content -Path $envFile -Value $websocketConfig -NoNewline
    Write-Host "??WebSocket ?°å?è®Šæ•¸å·²æ·»? åˆ° .env.development"
} else {
    Write-Host "? ï? WebSocket ?°å?è®Šæ•¸å·²å??¨ï?è·³é?"
}

# é¡¯ç¤º?€çµ‚å…§å®?
Write-Host "`n?? ?¶å? .env.development ?§å®¹:"
Get-Content $envFile
