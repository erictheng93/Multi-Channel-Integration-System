#!/usr/bin/env pwsh

<#
.SYNOPSIS
    LINE OA ?™å???¥æ¸¬è©¦?³æœ¬
    
.DESCRIPTION
    æ¸¬è©¦ LINE OA ?‡ç³»çµ±ç?å®Œæ•´??¥?€?‹ï??…æ‹¬ï¼?
    - Webhook ç«¯é??¯é???
    - äº‹ä»¶?•ç??Ÿèƒ½
    - LINE API ??¥
    - ?¨é€è??¯å???
    
.PARAMETER WebhookUrl
    Webhook URL (?è¨­: https://your-api-domain.example.com/api/webhook)
    
.PARAMETER AccessToken
    LINE Channel Access Token
    
.PARAMETER ChannelSecret
    LINE Channel Secret
    
.PARAMETER TestUserId
    æ¸¬è©¦?¨æˆ¶ ID (?¨æ–¼?¨é€è??¯æ¸¬è©?
    
.PARAMETER Timeout
    è«‹æ?è¶…æ??‚é? (æ¯«ç?ï¼Œé?è¨? 15000)
    
.EXAMPLE
    .\scripts\test-line-connection.ps1
    
.EXAMPLE
    .\scripts\test-line-connection.ps1 -AccessToken "your-access-token" -ChannelSecret "your-channel-secret"
    
.EXAMPLE
    .\scripts\test-line-connection.ps1 -TestUserId "U1234567890abcdef" -AccessToken "your-token"
#>

param(
    [string]$WebhookUrl = "https://your-api-domain.example.com/api/webhook",
    [string]$AccessToken = "",
    [string]$ChannelSecret = "",
    [string]$TestUserId = "",
    [int]$Timeout = 15000
)

# é¡è‰²è¼¸å‡º?½æ•¸
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $colorMap = @{
        "Red" = [ConsoleColor]::Red
        "Green" = [ConsoleColor]::Green
        "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue
        "Magenta" = [ConsoleColor]::Magenta
        "Cyan" = [ConsoleColor]::Cyan
        "White" = [ConsoleColor]::White
    }
    
    Write-Host $Message -ForegroundColor $colorMap[$Color]
}

# æª¢æŸ¥ Node.js ?¯å¦å®‰è?
function Test-NodeJs {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-ColorOutput "??Node.js ?ˆæœ¬: $nodeVersion" "Green"
            return $true
        }
    } catch {
        Write-ColorOutput "???ªæ‰¾??Node.jsï¼Œè??ˆå?è£?Node.js" "Red"
        return $false
    }
    return $false
}

# æª¢æŸ¥æ¸¬è©¦æª”æ??¯å¦å­˜åœ¨
function Test-TestFile {
    $testFile = "tests/test-line-connection.ts"
    if (Test-Path $testFile) {
        Write-ColorOutput "???¾åˆ°æ¸¬è©¦æª”æ?: $testFile" "Green"
        return $true
    } else {
        Write-ColorOutput "???ªæ‰¾?°æ¸¬è©¦æ?æ¡? $testFile" "Red"
        return $false
    }
}

# å¾ç’°å¢ƒè??¸æ? .env æª”æ?è®€?–è¨­å®?
function Get-EnvironmentConfig {
    $envFile = ".env"
    $config = @{}
    
    # è®€??.env æª”æ?
    if (Test-Path $envFile) {
        Write-ColorOutput "?? è®€?–ç’°å¢ƒè??¸æ?æ¡? $envFile" "Blue"
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                $config[$key] = $value
            }
        }
    }
    
    # æª¢æŸ¥?¸é??„ç’°å¢ƒè???
    $envVars = @(
        "LINE_CHANNEL_ACCESS_TOKEN",
        "LINE_CHANNEL_SECRET",
        "WEBHOOK_URL",
        "TEST_USER_ID"
    )
    
    foreach ($envVar in $envVars) {
        $value = [Environment]::GetEnvironmentVariable($envVar)
        if ($value) {
            $config[$envVar] = $value
        }
    }
    
    return $config
}

# ä¸»è??·è??½æ•¸
function Invoke-LineConnectionTest {
    Write-ColorOutput "?? LINE OA ?™å???¥æ¸¬è©¦" "Cyan"
    Write-ColorOutput "=" * 50 "Cyan"
    
    # æª¢æŸ¥?ˆæ±ºæ¢ä»¶
    if (-not (Test-NodeJs)) {
        exit 1
    }
    
    if (-not (Test-TestFile)) {
        exit 1
    }
    
    # ?²å??°å?è¨­å?
    $envConfig = Get-EnvironmentConfig()
    
    # ä½¿ç”¨?ƒæ•¸?–ç’°å¢ƒè???
    $finalWebhookUrl = if ($WebhookUrl) { $WebhookUrl } else { $envConfig["WEBHOOK_URL"] }
    $finalAccessToken = if ($AccessToken) { $AccessToken } else { $envConfig["LINE_CHANNEL_ACCESS_TOKEN"] }
    $finalChannelSecret = if ($ChannelSecret) { $ChannelSecret } else { $envConfig["LINE_CHANNEL_SECRET"] }
    $finalTestUserId = if ($TestUserId) { $TestUserId } else { $envConfig["TEST_USER_ID"] }
    
    if (-not $finalWebhookUrl) {
        $finalWebhookUrl = "https://your-api-domain.example.com/api/webhook"
    }
    
    # é¡¯ç¤ºæ¸¬è©¦?ç½®
    Write-ColorOutput "`n?? æ¸¬è©¦?ç½®:" "Yellow"
    Write-ColorOutput "   Webhook URL: $finalWebhookUrl" "White"
    Write-ColorOutput "   Access Token: $(if ($finalAccessToken) { 'å·²è¨­å®?(' + $finalAccessToken.Substring(0, [Math]::Min(10, $finalAccessToken.Length)) + '...)' } else { '?ªè¨­å®? })" "White"
    Write-ColorOutput "   Channel Secret: $(if ($finalChannelSecret) { 'å·²è¨­å®? } else { '?ªè¨­å®? })" "White"
    Write-ColorOutput "   Test User ID: $(if ($finalTestUserId) { $finalTestUserId.Substring(0, [Math]::Min(8, $finalTestUserId.Length)) + '...' } else { '?ªè¨­å®? })" "White"
    Write-ColorOutput "   Timeout: $Timeout ms" "White"
    
    # å»ºæ??½ä»¤?ƒæ•¸
    $args = @($finalWebhookUrl)
    if ($finalAccessToken) { $args += $finalAccessToken }
    if ($finalChannelSecret) { $args += $finalChannelSecret }
    if ($finalTestUserId) { $args += $finalTestUserId }
    $args += $Timeout.ToString()
    
    Write-ColorOutput "`n?? ?·è?æ¸¬è©¦..." "Blue"
    
    try {
        # ?·è?æ¸¬è©¦
        $process = Start-Process -FilePath "node" -ArgumentList @("--loader", "tsx", "tests/test-line-connection.ts") + $args -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-ColorOutput "`n??æ¸¬è©¦?·è?å®Œæ?" "Green"
            
            # æª¢æŸ¥?¯å¦?‰ç??å ±??
            $reportFile = "line-connection-test-report.json"
            if (Test-Path $reportFile) {
                Write-ColorOutput "?? æ¸¬è©¦?±å?å·²ç??? $reportFile" "Green"
                
                # é¡¯ç¤º?±å??˜è?
                try {
                    $report = Get-Content $reportFile | ConvertFrom-Json
                    Write-ColorOutput "`n?? æ¸¬è©¦?˜è?:" "Yellow"
                    Write-ColorOutput "   ç¸½æ¸¬è©¦æ•¸: $($report.summary.total)" "White"
                    Write-ColorOutput "   ?å?: $($report.summary.successful)" "Green"
                    Write-ColorOutput "   å¤±æ?: $($report.summary.failed)" "Red"
                    $successRate = [Math]::Round(($report.summary.successful / $report.summary.total) * 100, 1)
                    Write-ColorOutput "   ?å??? $successRate%" "White"
                } catch {
                    Write-ColorOutput "? ï? ?¡æ?è§??æ¸¬è©¦?±å?" "Yellow"
                }
            }
        } else {
            Write-ColorOutput "??æ¸¬è©¦?·è?å¤±æ? (?€?ºç¢¼: $($process.ExitCode))" "Red"
            exit $process.ExitCode
        }
    } catch {
        Write-ColorOutput "???·è?æ¸¬è©¦?‚ç™¼?ŸéŒ¯èª? $($_.Exception.Message)" "Red"
        exit 1
    }
}

# é¡¯ç¤ºå¹«åŠ©è³‡è?
function Show-Help {
    Write-ColorOutput @"
LINE OA ?™å???¥æ¸¬è©¦å·¥å…·

?¨æ?:
    .\scripts\test-line-connection.ps1 [?¸é?]

?¸é?:
    -WebhookUrl <url>      Webhook URL (?è¨­: https://your-api-domain.example.com/api/webhook)
    -AccessToken <token>   LINE Channel Access Token
    -ChannelSecret <secret> LINE Channel Secret  
    -TestUserId <userId>   æ¸¬è©¦?¨æˆ¶ ID (?¨æ–¼?¨é€è??¯æ¸¬è©?
    -Timeout <ms>          è«‹æ?è¶…æ??‚é? (?è¨­: 15000ms)
    -Help                  é¡¯ç¤ºæ­¤å¹«?©è?è¨?

ç¯„ä?:
    # ?ºæœ¬æ¸¬è©¦ (?ªæ¸¬è©?Webhook ?¯é???
    .\scripts\test-line-connection.ps1
    
    # å®Œæ•´æ¸¬è©¦ (?…å« LINE API ?Ÿèƒ½)
    .\scripts\test-line-connection.ps1 -AccessToken "your-token" -ChannelSecret "your-secret"
    
    # ?…å«?¨é€è??¯æ¸¬è©?
    .\scripts\test-line-connection.ps1 -AccessToken "your-token" -TestUserId "U1234567890abcdef"

?°å?è®Šæ•¸:
    ä¹Ÿå¯ä»¥é€é??°å?è®Šæ•¸??.env æª”æ?è¨­å?ï¼?
    - LINE_CHANNEL_ACCESS_TOKEN
    - LINE_CHANNEL_SECRET  
    - WEBHOOK_URL
    - TEST_USER_ID

æ¸¬è©¦?…ç›®:
    ??ç³»çµ±?¥åº·?€?‹æª¢??
    ??Webhook ç«¯é??¯é??§æ¸¬è©?
    ??Webhook äº‹ä»¶?•ç?æ¸¬è©¦
    ??LINE API ??¥æ¸¬è©¦ (?€è¦?Access Token)
    ???¨é€è??¯å??½æ¸¬è©?(?€è¦?Access Token ??User ID)
"@ "White"
}

# æª¢æŸ¥?¯å¦è¦é¡¯ç¤ºå¹«??
if ($args -contains "-Help" -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    exit 0
}

# ?·è?ä¸»è??Ÿèƒ½
Invoke-LineConnectionTest