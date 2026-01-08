# Collaboration API Ê∏¨Ë©¶?≥Êú¨
# ?®ÈÄ? ?≤Â? JWT Token ‰∏¶Ê∏¨Ë©¶Â?‰ΩúÂ???API

param(
    [string]$Email = "admin@dacit.net",
    [string]$Password = "",
    [string]$ApiUrl = "https://your-api-domain.example.com"
)

# Â¶ÇÊ?Ê≤íÊ??ê‰?ÂØÜÁ¢ºÔºåÊ?Á§∫Ëº∏??
if ([string]::IsNullOrEmpty($Password)) {
    $SecurePassword = Read-Host "Ë´ãËº∏?•Â?Á¢? -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Collaboration API Ê∏¨Ë©¶Â∑•ÂÖ∑" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Ê≠•È? 1: ?ªÂÖ•?≤Â? Token
Write-Host "?? Ê≠•È? 1: ?ªÂÖ•?≤Â? JWT Token..." -ForegroundColor Yellow
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

    Write-Host "   ???ªÂÖ•?êÂ?Ôº? -ForegroundColor Green
    Write-Host "   ?®Êà∂: $($user.displayName) ($($user.role))" -ForegroundColor Gray
    Write-Host "   Token: $($TOKEN.Substring(0, 50))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ???ªÂÖ•Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "?í° ?êÁ§∫:" -ForegroundColor Yellow
    Write-Host "   1. Á¢∫Ë?ÂØÜÁ¢ºÊ≠?¢∫" -ForegroundColor Gray
    Write-Host "   2. Á¢∫Ë?Á∂≤Áµ°??é•Ê≠?∏∏" -ForegroundColor Gray
    Write-Host "   3. Á¢∫Ë? API URL Ê≠?¢∫: $ApiUrl" -ForegroundColor Gray
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# Ê≠•È? 2: Ê∏¨Ë©¶?î‰??•Â∫∑Á´ØÈ?
Write-Host "?è• Ê≠•È? 2: Ê∏¨Ë©¶?î‰?Ê®°Á??•Â∫∑?Ä??.." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/api/collaboration/health" -Headers $headers

    Write-Host "   ???•Â∫∑Ê™¢Êü•?êÂ?Ôº? -ForegroundColor Green
    Write-Host "   ?Ä?? $($healthResponse.data.status)" -ForegroundColor Gray
    Write-Host "   ?êË®≠?îË≠∞: $($healthResponse.data.config.defaultProtocol)" -ForegroundColor Gray
    Write-Host "   WebSocket ?üÁî®: $($healthResponse.data.config.enableWebSocket)" -ForegroundColor Gray
    Write-Host "   ?ØÁî®?îË≠∞: $($healthResponse.data.availableProtocols -join ', ')" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ?†Ô? ?•Â∫∑Ê™¢Êü•Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Ê≠•È? 3: Ê∏¨Ë©¶?î‰?Áµ±Ë?
Write-Host "?? Ê≠•È? 3: ?≤Â??î‰?Áµ±Ë??∏Ê?..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "$ApiUrl/api/collaboration/stats" -Headers $headers

    Write-Host "   ??Áµ±Ë??∏Ê??≤Â??êÂ?Ôº? -ForegroundColor Green
    Write-Host "   ?•Á??ÖÁ∏Ω?? $($statsResponse.data.totalViewers)" -ForegroundColor Gray
    Write-Host "   Ê≠?ú®Ëº∏ÂÖ•: $($statsResponse.data.totalTyping)" -ForegroundColor Gray
    Write-Host "   Ê¥ªË??øÈ?: $($statsResponse.data.totalRooms)" -ForegroundColor Gray
    Write-Host "   ?îË≠∞?ÜÂ?:" -ForegroundColor Gray
    Write-Host "     - SSE: $($statsResponse.data.connectionsByProtocol.sse)" -ForegroundColor Gray
    Write-Host "     - WebSocket: $($statsResponse.data.connectionsByProtocol.websocket)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ?†Ô? Áµ±Ë??∏Ê??≤Â?Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Ê≠•È? 4: Ê∏¨Ë©¶ WebSocket ?•Â∫∑ÔºàÁÑ°?ÄË™çË?Ôº?
Write-Host "?? Ê≠•È? 4: Ê∏¨Ë©¶ WebSocket ?•Â∫∑?Ä?ãÔ??°È?Ë™çË?Ôº?.." -ForegroundColor Yellow
try {
    $wsHealthResponse = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/health"

    Write-Host "   ??WebSocket ?•Â∫∑Ê™¢Êü•?êÂ?Ôº? -ForegroundColor Green
    Write-Host "   ?Ä?? $($wsHealthResponse.status)" -ForegroundColor Gray
    Write-Host "   ?∞Â?: $($wsHealthResponse.environment)" -ForegroundColor Gray
    Write-Host "   ÁµÑ‰ª∂?Ä??" -ForegroundColor Gray
    Write-Host "     - Durable Objects: $($wsHealthResponse.components.durableObjects.status)" -ForegroundColor Gray
    Write-Host "     - WebSocket: $($wsHealthResponse.components.websocket.status)" -ForegroundColor Gray
    Write-Host "     - SSE: $($wsHealthResponse.components.sse.status)" -ForegroundColor Gray
    Write-Host "     - Database: $($wsHealthResponse.components.database.status)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ?†Ô? WebSocket ?•Â∫∑Ê™¢Êü•Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Ê≠•È? 5: Ê∏¨Ë©¶ WebSocket ?∑Áßª?Ä??
Write-Host "?? Ê≠•È? 5: Ê∏¨Ë©¶ WebSocket ?∑Áßª?Ä??.." -ForegroundColor Yellow
try {
    $migrationResponse = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/migration-status"

    Write-Host "   ???∑Áßª?Ä?ãÁç≤?ñÊ??üÔ?" -ForegroundColor Green
    Write-Host "   WebSocket ?üÁî®: $($migrationResponse.websocketEnabled)" -ForegroundColor Gray
    Write-Host "   SSE ?üÁî®: $($migrationResponse.sseEnabled)" -ForegroundColor Gray
    Write-Host "   Durable Objects ?ØÁî®: $($migrationResponse.durableObjectsAvailable)" -ForegroundColor Gray
    Write-Host "   ?®Âá∫?æÂ?ÊØ? $($migrationResponse.rolloutPercentage)%" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ?†Ô? ?∑Áßª?Ä?ãÁç≤?ñÂ§±?? $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Á∏ΩÁ?
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Ê∏¨Ë©¶ÂÆåÊ?Ôº? -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "?í° ?®Á? JWT Token:" -ForegroundColor Yellow
Write-Host $TOKEN -ForegroundColor Green
Write-Host ""
Write-Host "?? Â¶Ç‰?‰ΩøÁî®?ôÂÄ?Token:" -ForegroundColor Yellow
Write-Host "   curl -H 'Authorization: Bearer $TOKEN' \" -ForegroundColor Gray
Write-Host "     $ApiUrl/api/collaboration/health" -ForegroundColor Gray
Write-Host ""
Write-Host "   ?ñËÄÖÂú® PowerShell ‰∏?" -ForegroundColor Gray
Write-Host "   `$headers = @{'Authorization'='Bearer $TOKEN'}" -ForegroundColor Gray
Write-Host "   Invoke-RestMethod -Uri '$ApiUrl/api/...' -Headers `$headers" -ForegroundColor Gray
Write-Host ""

# Â∞?Token ‰øùÂ??∞Ââ™Ë≤ºÊùøÔºàÂèØ?∏Ô?
$saveToClipboard = Read-Host "?ØÂê¶Â∞?Token Ë§áË£Ω?∞Ââ™Ë≤ºÊùøÔº?Y/N)"
if ($saveToClipboard -eq 'Y' -or $saveToClipboard -eq 'y') {
    Set-Clipboard -Value $TOKEN
    Write-Host "??Token Â∑≤Ë?Ë£ΩÂà∞?™Ë≤º?øÔ?" -ForegroundColor Green
}

Write-Host ""
Write-Host "?? Ê∏¨Ë©¶?≥Êú¨?∑Ë?ÂÆåÁï¢Ôº? -ForegroundColor Cyan
