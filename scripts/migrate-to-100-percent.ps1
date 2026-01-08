# WebSocket 100% ?∑Áßª?≥Êú¨ (PowerShell ?àÊú¨)
# ?™Â??ñÂü∑Ë°åÂ? 50% ??75% ??100% ?ÑÈÅ∑ÁßªÊ?Á®?

param(
    [string]$ApiBase = "https://your-api-domain.example.com",
    [string]$AdminToken = $env:ADMIN_TOKEN
)

Write-Host "?? WebSocket ?∑Áßª??100% ?™Â??ñËÖ≥?? -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Ê™¢Êü• token
if (-not $AdminToken) {
    Write-Host "???ØË™§: ?™Ë®≠ÁΩ?ADMIN_TOKEN ?∞Â?ËÆäÊï∏" -ForegroundColor Red
    Write-Host ""
    Write-Host "Ë´ãÂ??≤Â?ÁÆ°Á???token:" -ForegroundColor Yellow
    Write-Host "1. ?ªÂÖ• https://your-api-domain.example.com" -ForegroundColor Yellow
    Write-Host "2. ?ãÂ? DevTools (F12) ??Application ??Local Storage" -ForegroundColor Yellow
    Write-Host "3. Ë§áË£Ω 'auth_token' ?ÑÂÄ? -ForegroundColor Yellow
    Write-Host ""
    Write-Host "?∂Â??ãË?:" -ForegroundColor Yellow
    Write-Host '  $env:ADMIN_TOKEN = "your-token-here"' -ForegroundColor White
    Write-Host "  .\scripts\migrate-to-100-percent.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "?ñÂ??? GET_ADMIN_TOKEN_GUIDE.md" -ForegroundColor Yellow
    exit 1
}

Write-Host "??Token Â∑≤Ë®≠ÁΩ? -ForegroundColor Green
Write-Host ""

# ?ΩÊï∏: Ê™¢Êü•?∂Â??Ä??
function Check-Status {
    Write-Host "?? Ê™¢Êü•?∂Â??∑Áßª?Ä??.." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$ApiBase/api/websocket/migration-status" -Method Get
        $rollout = $response.rolloutPercentage
        Write-Host "?∂Â? Rollout: $rollout%" -ForegroundColor Green
        Write-Host ""
        return $rollout
    } catch {
        Write-Host "???°Ê??≤Â??Ä?? $_" -ForegroundColor Red
        throw
    }
}

# ?ΩÊï∏: ?¥Êñ∞ rollout
function Update-Rollout {
    param([int]$Target)

    Write-Host "???êÂ? Rollout ??$Target%..." -ForegroundColor Yellow

    try {
        $headers = @{
            "Authorization" = "Bearer $AdminToken"
            "Content-Type" = "application/json"
        }
        $body = @{
            rolloutPercentage = $Target
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$ApiBase/api/websocket/migration-config" `
            -Method Post `
            -Headers $headers `
            -Body $body

        Write-Host "???êÂ??êÂ???$Target%" -ForegroundColor Green
        Write-Host ""
        return $true
    } catch {
        Write-Host "???¥Êñ∞Â§±Ê?: $_" -ForegroundColor Red
        Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
        return $false
    }
}

# ?ΩÊï∏: È©óË??•Â∫∑?Ä??
function Check-Health {
    Write-Host "?è• Ê™¢Êü•Á≥ªÁµ±?•Â∫∑?Ä??.." -ForegroundColor Cyan
    try {
        $health = Invoke-RestMethod -Uri "$ApiBase/api/websocket/health" -Method Get
        $status = $health.status

        if ($status -ne "healthy") {
            Write-Host "?†Ô?  Ë≠¶Â?: Á≥ªÁµ±?Ä?ã‰??•Â∫∑: $status" -ForegroundColor Yellow
            $health | ConvertTo-Json -Depth 10 | Write-Host
            return $false
        }

        Write-Host "??Á≥ªÁµ±?•Â∫∑" -ForegroundColor Green
        Write-Host ""
        return $true
    } catch {
        Write-Host "?†Ô?  ?•Â∫∑Ê™¢Êü•Â§±Ê?: $_" -ForegroundColor Yellow
        return $false
    }
}

# ?ΩÊï∏: Á≠âÂ?‰∏¶Áõ£??
function Monitor {
    param([int]$Duration)

    Write-Host "????éß $Duration Áß?.." -ForegroundColor Cyan
    for ($i = 1; $i -le $Duration; $i++) {
        if ($i % 10 -eq 0) {
            Write-Host "  ?? $i/$Duration Áß?.." -ForegroundColor Gray
            if (-not (Check-Health)) {
                Write-Host "  ?†Ô?  ?•Â∫∑Ê™¢Êü•Â§±Ê?" -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "????éßÂÆåÊ?" -ForegroundColor Green
    Write-Host ""
}

# ============================================
# ‰∏ªÂü∑Ë°åÊ?Á®?
# ============================================

Write-Host "?éÊÆµ 1: È©óË??ùÂ??Ä?? -ForegroundColor Magenta
Write-Host "--------------------------------------------" -ForegroundColor Gray
$currentRollout = Check-Status
Check-Health | Out-Null

# Ê±∫Á??èËºØ
if ($currentRollout -eq 50) {
    Write-Host "?éÊÆµ 2: ?êÂ???75%" -ForegroundColor Magenta
    Write-Host "--------------------------------------------" -ForegroundColor Gray

    if (Update-Rollout -Target 75) {
        Monitor -Duration 30  # ??éß 30 Áß?

        Write-Host "?éÊÆµ 3: ?êÂ???100%" -ForegroundColor Magenta
        Write-Host "--------------------------------------------" -ForegroundColor Gray
        Write-Host "?†Ô?  Ê∫ñÂ??®È??∑Áßª..." -ForegroundColor Yellow
        Write-Host "??Enter ÁπºÁ?ÔºåÊ? Ctrl+C ?ñÊ?" -ForegroundColor Yellow
        Read-Host

        Update-Rollout -Target 100 | Out-Null
    }
}
elseif ($currentRollout -eq 75) {
    Write-Host "?éÊÆµ 2: ?êÂ???100%ÔºàË∑≥??75%Ôº? -ForegroundColor Magenta
    Write-Host "--------------------------------------------" -ForegroundColor Gray
    Write-Host "?†Ô?  Ê∫ñÂ??®È??∑Áßª..." -ForegroundColor Yellow
    Write-Host "??Enter ÁπºÁ?ÔºåÊ? Ctrl+C ?ñÊ?" -ForegroundColor Yellow
    Read-Host

    Update-Rollout -Target 100 | Out-Null
}
elseif ($currentRollout -eq 100) {
    Write-Host "??Â∑≤Á???100% Rollout" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host "???™Áü•??Rollout ?Ä?? $currentRollout%" -ForegroundColor Red
    exit 1
}

Write-Host "?éÊÆµ 4: È©óË??ÄÁµÇÁ??? -ForegroundColor Magenta
Write-Host "--------------------------------------------" -ForegroundColor Gray
$finalRollout = Check-Status
Check-Health | Out-Null

# È°ØÁ§∫?ÄÁµÇÈ?ÁΩ?
Write-Host "?? ?ÄÁµÇÈ?ÁΩ?" -ForegroundColor Cyan
$finalConfig = Invoke-RestMethod -Uri "$ApiBase/api/websocket/migration-status" -Method Get
$finalConfig | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "?? ?∑ÁßªÂÆåÊ?Ôº? -ForegroundColor Green
Write-Host ""
Write-Host "‰∏ã‰?Ê≠?" -ForegroundColor Yellow
Write-Host "1. ?ÅÁ???éß 24-48 Â∞èÊ?" -ForegroundColor White
Write-Host "2. Á¢∫Ë??Ä?âÁî®?∂‰Ωø??WebSocket" -ForegroundColor White
Write-Host "3. ?∑Ë? SSE ‰ª?¢ºÊ∏ÖÁ?" -ForegroundColor White
Write-Host ""
Write-Host "??éß?Ω‰ª§:" -ForegroundColor Yellow
Write-Host "  Invoke-RestMethod -Uri $ApiBase/api/websocket/health | ConvertTo-Json" -ForegroundColor White
Write-Host "  Invoke-RestMethod -Uri $ApiBase/api/websocket/migration-status | ConvertTo-Json" -ForegroundColor White
Write-Host ""
