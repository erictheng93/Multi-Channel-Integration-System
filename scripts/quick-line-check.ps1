#!/usr/bin/env pwsh

param(
    [string]$WebhookUrl = "https://your-api-domain.example.com/api/webhook"
)

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    $colorMap = @{
        "Red" = [ConsoleColor]::Red; "Green" = [ConsoleColor]::Green; "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue; "Magenta" = [ConsoleColor]::Magenta; "Cyan" = [ConsoleColor]::Cyan; "White" = [ConsoleColor]::White
    }
    Write-Host $Message -ForegroundColor $colorMap[$Color]
}

Write-ColorOutput "Quick LINE OA Connection Check" "Cyan"
Write-ColorOutput "=" * 40 "Cyan"
Write-ColorOutput "Webhook URL: $WebhookUrl" "White"
Write-ColorOutput ""

# Test 1: Basic connection
Write-ColorOutput "1. Testing basic connection..." "Blue"
try {
    $response = Invoke-WebRequest -Uri $WebhookUrl -Method POST -ContentType "application/json" -Body '{"events":[]}' -Headers @{"x-line-signature"="test-signature"} -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "   OK Webhook endpoint reachable ($($response.StatusCode))" "Green"
    } else {
        Write-ColorOutput "   WARNING Webhook returned status: $($response.StatusCode)" "Yellow"
    }
} catch {
    Write-ColorOutput "   ERROR Webhook unreachable: $($_.Exception.Message)" "Red"
}

# Test 2: System health
Write-ColorOutput "`n2. Testing system health..." "Blue"
try {
    $healthUrl = $WebhookUrl -replace "/api/webhook", "/api/health"
    $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "   OK System health normal ($($response.StatusCode))" "Green"
        try {
            $healthData = $response.Content | ConvertFrom-Json
            if ($healthData.status) {
                Write-ColorOutput "   Status: $($healthData.status)" "White"
            }
        } catch {
            Write-ColorOutput "   Response: $($response.Content)" "White"
        }
    } else {
        Write-ColorOutput "   WARNING Health check returned: $($response.StatusCode)" "Yellow"
    }
} catch {
    Write-ColorOutput "   ERROR Health check failed: $($_.Exception.Message)" "Red"
}

# Test 3: LINE event simulation
Write-ColorOutput "`n3. Testing LINE event processing..." "Blue"
try {
    $testEvent = @{
        events = @(
            @{
                type = "message"
                message = @{
                    type = "text"
                    text = "Connection test"
                    id = "test-message-$(Get-Date -Format 'yyyyMMddHHmmss')"
                }
                source = @{
                    userId = "test-user-$(Get-Date -Format 'yyyyMMddHHmmss')"
                }
                replyToken = "test-reply-token"
                timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            }
        )
        destination = "test-destination"
    } | ConvertTo-Json -Depth 10

    $response = Invoke-WebRequest -Uri $WebhookUrl -Method POST -ContentType "application/json" -Body $testEvent -Headers @{"x-line-signature"="test-signature"} -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "   OK LINE event processing normal ($($response.StatusCode))" "Green"
    } else {
        Write-ColorOutput "   WARNING Event processing returned: $($response.StatusCode)" "Yellow"
    }
} catch {
    Write-ColorOutput "   ERROR Event processing failed: $($_.Exception.Message)" "Red"
}

# Test 4: DNS resolution
Write-ColorOutput "`n4. Testing DNS resolution..." "Blue"
try {
    $domain = ([System.Uri]$WebhookUrl).Host
    $dnsResult = Resolve-DnsName -Name $domain -Type A -ErrorAction Stop
    if ($dnsResult) {
        Write-ColorOutput "   OK DNS resolution: $domain -> $($dnsResult[0].IPAddress)" "Green"
    }
} catch {
    Write-ColorOutput "   ERROR DNS resolution failed: $($_.Exception.Message)" "Red"
}

Write-ColorOutput "`n" "White"
Write-ColorOutput "Check completed!" "Cyan"
Write-ColorOutput "=" * 40 "Cyan"

Write-ColorOutput "`nNext steps:" "Yellow"
Write-ColorOutput "1. If basic connection works, set up LINE Channel Access Token and Secret" "White"
Write-ColorOutput "2. Configure Webhook URL in LINE Developers Console: $WebhookUrl" "White"
Write-ColorOutput "3. Run full test: .\scripts\test-line-connection.ps1 -AccessToken 'your-token'" "White"
Write-ColorOutput "4. Check LINE Bot settings: https://developers.line.biz/console/" "White"