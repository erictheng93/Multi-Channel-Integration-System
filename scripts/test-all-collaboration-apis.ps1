# Collaboration API ÂÆåÊï¥Ê∏¨Ë©¶?≥Êú¨
# ?®ÈÄ? Ê∏¨Ë©¶?Ä?âÂ?‰ΩúÂ???API Á´ØÈ?

param(
    [string]$Email = "admin@dacit.net",
    [string]$Password = "16011587DaC",
    [string]$ApiUrl = "https://your-api-domain.example.com"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Collaboration API ÂÆåÊï¥Ê∏¨Ë©¶Â∑•ÂÖ∑" -ForegroundColor Cyan
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
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# Ê∏¨Ë©¶ÁµêÊ?Áµ±Ë?
$totalTests = 0
$passedTests = 0
$failedTests = 0

# Ê∏¨Ë©¶?ΩÊï∏
function Test-API {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [bool]$ExpectSuccess = $true
    )

    $script:totalTests++
    Write-Host "?? Ê∏¨Ë©¶ $totalTests : $Name" -ForegroundColor Yellow
    Write-Host "   ?πÊ?: $Method $Endpoint" -ForegroundColor Gray

    try {
        $params = @{
            Uri = "$ApiUrl$Endpoint"
            Method = $Method
            Headers = $headers
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            Write-Host "   Ë´ãÊ?È´? $($params.Body)" -ForegroundColor Gray
        }

        $response = Invoke-RestMethod @params

        if ($response.success -eq $ExpectSuccess) {
            $script:passedTests++
            Write-Host "   ???öÈ?" -ForegroundColor Green
            if ($response.data) {
                Write-Host "   ?øÊ??∏Ê?:" -ForegroundColor Gray
                Write-Host "   $($response.data | ConvertTo-Json -Compress)" -ForegroundColor Gray
            }
        } else {
            $script:failedTests++
            Write-Host "   ??Â§±Ê?: ?êÊ? success=$ExpectSuccess, ÂØ¶È? success=$($response.success)" -ForegroundColor Red
        }

    } catch {
        $script:failedTests++
        Write-Host "   ??Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "?ãÂ? API Ê∏¨Ë©¶" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Ê∏¨Ë©¶ 1: Health Check
Test-API -Name "?•Â∫∑Ê™¢Êü•" `
    -Method "GET" `
    -Endpoint "/api/collaboration/health"

# Ê∏¨Ë©¶ 2: Stats
Test-API -Name "?≤Â?Áµ±Ë??∏Ê?" `
    -Method "GET" `
    -Endpoint "/api/collaboration/stats"

# Ê∏¨Ë©¶ 3: Update Presence
Test-API -Name "?¥Êñ∞?®Á??Ä??(online)" `
    -Method "POST" `
    -Endpoint "/api/collaboration/presence" `
    -Body @{
        status = "online"
        metadata = @{
            device = "PowerShell Test"
        }
    }

# Ê∏¨Ë©¶ 4: Join Conversation
Test-API -Name "?†ÂÖ•Â∞çË©± (ID: 1)" `
    -Method "POST" `
    -Endpoint "/api/collaboration/conversations/1/join" `
    -Body @{}

# Ê∏¨Ë©¶ 5: Get Conversation State
Test-API -Name "?≤Â?Â∞çË©±?Ä??(ID: 1)" `
    -Method "GET" `
    -Endpoint "/api/collaboration/conversations/1/state"

# Ê∏¨Ë©¶ 6: Get Conversation Viewers
Test-API -Name "?≤Â?Â∞çË©±?•Á??ÖÂ?Ë°?(ID: 1)" `
    -Method "GET" `
    -Endpoint "/api/collaboration/conversations/1/viewers"

# Ê∏¨Ë©¶ 7: Send Typing Start
Test-API -Name "?ºÈÄÅËº∏?•È?ÂßãÁ??? `
    -Method "POST" `
    -Endpoint "/api/collaboration/typing" `
    -Body @{
        conversationId = 1
        status = "start"
    }

# Ê∏¨Ë©¶ 8: Send Typing Stop
Test-API -Name "?ºÈÄÅËº∏?•Â?Ê≠¢Á??? `
    -Method "POST" `
    -Endpoint "/api/collaboration/typing" `
    -Body @{
        conversationId = 1
        status = "stop"
    }

# Ê∏¨Ë©¶ 9: Leave Conversation
Test-API -Name "?¢È?Â∞çË©± (ID: 1)" `
    -Method "POST" `
    -Endpoint "/api/collaboration/conversations/1/leave" `
    -Body @{}

# Ê∏¨Ë©¶ 10: Cleanup (Admin only)
Test-API -Name "Ê∏ÖÁ??éÊ??Ä?? `
    -Method "POST" `
    -Endpoint "/api/collaboration/cleanup" `
    -Body @{}

# WebSocket ?∏È?Ê∏¨Ë©¶ (?°È?Ë™çË?)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "WebSocket ?∫Á?Ë®≠ÊñΩÊ∏¨Ë©¶" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ÁßªÈô§Ë™çË? header ?≤Ë??¨È?Á´ØÈ?Ê∏¨Ë©¶
$publicHeaders = @{
    "Content-Type" = "application/json"
}

Write-Host "?? Ê∏¨Ë©¶: WebSocket ?•Â∫∑Ê™¢Êü•" -ForegroundColor Yellow
try {
    $wsHealth = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/health"
    $script:totalTests++
    $script:passedTests++
    Write-Host "   ???öÈ?" -ForegroundColor Green
    Write-Host "   ?Ä?? $($wsHealth.status)" -ForegroundColor Gray
    Write-Host "   ?∞Â?: $($wsHealth.environment)" -ForegroundColor Gray
} catch {
    $script:totalTests++
    $script:failedTests++
    Write-Host "   ??Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "?? Ê∏¨Ë©¶: WebSocket ?∑Áßª?Ä?? -ForegroundColor Yellow
try {
    $wsMigration = Invoke-RestMethod -Uri "$ApiUrl/api/websocket/migration-status"
    $script:totalTests++
    $script:passedTests++
    Write-Host "   ???öÈ?" -ForegroundColor Green
    Write-Host "   WebSocket ?üÁî®: $($wsMigration.websocketEnabled)" -ForegroundColor Gray
    Write-Host "   SSE ?üÁî®: $($wsMigration.sseEnabled)" -ForegroundColor Gray
} catch {
    $script:totalTests++
    $script:failedTests++
    Write-Host "   ??Â§±Ê?: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Ê∏¨Ë©¶ÁµêÊ?Á∏ΩÁ?
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Ê∏¨Ë©¶ÁµêÊ?Á∏ΩÁ?" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Á∏ΩÊ∏¨Ë©¶Êï∏: $totalTests" -ForegroundColor White
Write-Host "???öÈ?: $passedTests" -ForegroundColor Green
Write-Host "??Â§±Ê?: $failedTests" -ForegroundColor Red

if ($failedTests -eq 0) {
    Write-Host ""
    Write-Host "?? ?Ä?âÊ∏¨Ë©¶ÈÄöÈ?Ôº? -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "?†Ô? ??$failedTests ?ãÊ∏¨Ë©¶Â§±?? -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Ê∏¨Ë©¶ÂÆåÊ?" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
