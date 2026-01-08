# é©—è??°å??è·¯?±è…³??
# æ¸¬è©¦ your-api-domain.example.com ?¯å¦æ­?¸¸å·¥ä?

Write-Host "?? é©—è??°å??è·¯??.." -ForegroundColor Cyan
Write-Host "?Ÿå?: your-api-domain.example.com" -ForegroundColor Yellow
Write-Host ""

# æ¸¬è©¦?½æ•¸
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Description,
        [int]$TimeoutSeconds = 10
    )
    
    Write-Host "æ¸¬è©¦: $Description" -ForegroundColor White
    Write-Host "URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            Write-Host "???å? - HTTP $($response.StatusCode)" -ForegroundColor Green
            
            # ?—è©¦è§?? JSON ?æ?
            try {
                $jsonContent = $response.Content | ConvertFrom-Json
                if ($jsonContent.status) {
                    Write-Host "   ?€?? $($jsonContent.status)" -ForegroundColor Green
                }
                if ($jsonContent.message) {
                    Write-Host "   è¨Šæ¯: $($jsonContent.message)" -ForegroundColor Green
                }
                if ($jsonContent.timestamp) {
                    Write-Host "   ?‚é??? $($jsonContent.timestamp)" -ForegroundColor Green
                }
            } catch {
                Write-Host "   ?æ??§å®¹: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Green
            }
            
            return $true
        } else {
            Write-Host "? ï?  HTTP $($response.StatusCode)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "??å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    Write-Host ""
}

# æ¸¬è©¦ç«¯é??—è¡¨
$endpoints = @(
    @{
        Url = "https://your-api-domain.example.com/api/health"
        Description = "?¥åº·æª¢æŸ¥ç«¯é?"
    },
    @{
        Url = "https://your-api-domain.example.com/api/system/status"
        Description = "ç³»çµ±?€?‹ç«¯é»?
    },
    @{
        Url = "https://your-api-domain.example.com/"
        Description = "?¹è·¯å¾?
    },
    @{
        Url = "https://your-api-domain.example.com/admin-dashboard.html"
        Description = "ç®¡ç?å¾Œå°"
    }
)

# ?·è?æ¸¬è©¦
$successCount = 0
$totalCount = $endpoints.Count

Write-Host "=== ?‹å?ç«¯é?æ¸¬è©¦ ===" -ForegroundColor Magenta
Write-Host ""

foreach ($endpoint in $endpoints) {
    if (Test-Endpoint -Url $endpoint.Url -Description $endpoint.Description) {
        $successCount++
    }
}

Write-Host ""
Write-Host "=== æ¸¬è©¦çµæ??˜è? ===" -ForegroundColor Magenta
Write-Host "?å?: $successCount / $totalCount" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })

if ($successCount -eq $totalCount) {
    Write-Host "?? ?€?‰ç«¯é»éƒ½æ­?¸¸å·¥ä?ï¼? -ForegroundColor Green
} elseif ($successCount -gt 0) {
    Write-Host "? ï?  ?¨å?ç«¯é?å·¥ä?æ­?¸¸ï¼Œè?æª¢æŸ¥å¤±æ??„ç«¯é»? -ForegroundColor Yellow
} else {
    Write-Host "???€?‰ç«¯é»éƒ½?¡æ?è¨ªå?" -ForegroundColor Red
}

Write-Host ""

# DNS è§??æ¸¬è©¦
Write-Host "=== DNS è§??æ¸¬è©¦ ===" -ForegroundColor Magenta
try {
    $dnsResult = Resolve-DnsName -Name "your-api-domain.example.com" -Type A
    Write-Host "??DNS è§???å?" -ForegroundColor Green
    foreach ($record in $dnsResult) {
        if ($record.Type -eq "A") {
            Write-Host "   IP ?°å?: $($record.IPAddress)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "??DNS è§??å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# ?ä??…é??’é™¤å»ºè­°
Write-Host "=== ?…é??’é™¤å»ºè­° ===" -ForegroundColor Magenta

if ($successCount -eq 0) {
    Write-Host "å¦‚æ??€?‰ç«¯é»éƒ½?¡æ?è¨ªå?ï¼Œè?æª¢æŸ¥ï¼? -ForegroundColor Yellow
    Write-Host "1. Cloudflare è·¯ç”±?ç½®?¯å¦æ­?¢º" -ForegroundColor White
    Write-Host "2. Worker ?¯å¦å·²éƒ¨ç½? -ForegroundColor White
    Write-Host "3. DNS è¨˜é??¯å¦?‡å?æ­?¢º??IP" -ForegroundColor White
    Write-Host "4. SSL/TLS è¨­ç½®?¯å¦æ­?¢º" -ForegroundColor White
    Write-Host ""
    Write-Host "å»ºè­°?·è??„å‘½ä»¤ï?" -ForegroundColor Yellow
    Write-Host "wrangler deploy" -ForegroundColor Cyan
    Write-Host "wrangler tail" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== ?‹å?é©—è?æ­¥é? ===" -ForegroundColor Magenta
Write-Host "1. ?¨ç€è¦½?¨ä¸­è¨ªå?: https://your-api-domain.example.com/api/health" -ForegroundColor White
Write-Host "2. æª¢æŸ¥ Cloudflare Dashboard ä¸­ç? Workers ?¨ç½²?€?? -ForegroundColor White
Write-Host "3. æª¢æŸ¥ DNS è¨­ç½®?Œè·¯?±é?ç½? -ForegroundColor White
Write-Host "4. ?¥ç? Worker ?¥è?: wrangler tail" -ForegroundColor White