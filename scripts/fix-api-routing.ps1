# ä¿®å¾© API è·¯ç”±?é??³æœ¬

Write-Host "?”§ ä¿®å¾© API è·¯ç”±?é?..." -ForegroundColor Cyan
Write-Host ""

# 1. æª¢æŸ¥?¶å??¨ç½²?€??
Write-Host "1. æª¢æŸ¥?¶å??¨ç½²?€??.." -ForegroundColor Yellow
wrangler deployments list

Write-Host ""

# 2. ?æ–°?¨ç½² Worker
Write-Host "2. ?æ–°?¨ç½² Worker..." -ForegroundColor Yellow
Write-Host "?·è?: wrangler deploy" -ForegroundColor White
wrangler deploy

Write-Host ""

# 3. ç­‰å??¨ç½²å®Œæ?
Write-Host "3. ç­‰å??¨ç½²å®Œæ? (10ç§?..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. æ¸¬è©¦ API ç«¯é?
Write-Host "4. æ¸¬è©¦ API ç«¯é?..." -ForegroundColor Yellow

$endpoints = @(
    "https://your-api-domain.example.com/health",
    "https://your-api-domain.example.com/api/health",
    "https://your-api-domain.example.com/api/system/status",
    "https://your-api-domain.example.com/api/stats"
)

foreach ($endpoint in $endpoints) {
    Write-Host "æ¸¬è©¦: $endpoint" -ForegroundColor White
    try {
        $response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "???å? - HTTP $($response.StatusCode)" -ForegroundColor Green
            # é¡¯ç¤º?æ??§å®¹?„å?100?‹å?ç¬?
            $content = $response.Content
            if ($content.Length -gt 100) {
                $content = $content.Substring(0, 100) + "..."
            }
            Write-Host "   ?æ?: $content" -ForegroundColor Gray
        } else {
            Write-Host "? ï?  HTTP $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "??å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# 5. æª¢æŸ¥ Worker ?¥è?
Write-Host "5. å¦‚æ??é?ä»ç„¶å­˜åœ¨ï¼Œæª¢??Worker ?¥è?..." -ForegroundColor Yellow
Write-Host "?·è?: wrangler tail" -ForegroundColor White
Write-Host "?¶å??¨å¦ä¸€?‹ç?ç«¯æ¸¬è©?API ç«¯é?ä»¥æŸ¥?‹æ—¥èª? -ForegroundColor White

Write-Host ""
Write-Host "?¯ ä¿®å¾©å®Œæ?ï¼? -ForegroundColor Green