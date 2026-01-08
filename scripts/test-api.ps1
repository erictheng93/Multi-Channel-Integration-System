# API ??¥æ¸¬è©¦?³æœ¬
# ä½¿ç”¨?¹æ?: .\test-api.ps1 [local|production]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "production", "all")]
    [string]$Environment = "all"
)

function Test-ApiEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSec = 10
    )
    
    Write-Host "?§ª æ¸¬è©¦ $Name..." -ForegroundColor Yellow
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "??$Name - ??¥?å? (200 OK)" -ForegroundColor Green
            
            # ?—è©¦è§?? JSON ?¿æ?
            try {
                $jsonContent = $response.Content | ConvertFrom-Json
                Write-Host "   ?¿æ?: $($jsonContent | ConvertTo-Json -Compress)" -ForegroundColor Cyan
            } catch {
                Write-Host "   ?¿æ?: $($response.Content)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "? ï?  $Name - ?€?‹ç¢¼: $($response.StatusCode)" -ForegroundColor Yellow
        }
        
        return $true
    } catch {
        Write-Host "??$Name - ??¥å¤±æ?" -ForegroundColor Red
        Write-Host "   ?¯èª¤: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "?? API ??¥æ¸¬è©¦?‹å?..." -ForegroundColor Green
Write-Host ""

$testResults = @{}

# æ¸¬è©¦?¬åœ°?°å?
if ($Environment -eq "local" -or $Environment -eq "all") {
    Write-Host "?? æ¸¬è©¦?¬åœ°?‹ç™¼?°å?" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    # æ¸¬è©¦?¬åœ° Worker
    $testResults["local-worker"] = Test-ApiEndpoint -Url "http://localhost:8787/api/health" -Name "?¬åœ° Worker"
    
    # æ¸¬è©¦?ç«¯ä»??
    $testResults["local-proxy"] = Test-ApiEndpoint -Url "http://localhost:3000/api/health" -Name "?ç«¯ä»??"
    
    Write-Host ""
}

# æ¸¬è©¦?Ÿç”¢?°å?
if ($Environment -eq "production" -or $Environment -eq "all") {
    Write-Host "?? æ¸¬è©¦?Ÿç”¢?°å?" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    # æ¸¬è©¦?Ÿç”¢ Worker
    $testResults["prod-worker"] = Test-ApiEndpoint -Url "https://your-api-domain.example.com/api/health" -Name "?Ÿç”¢ Worker"
    
    Write-Host ""
}

# æ¸¬è©¦?¶ä?å¸¸ç”¨ç«¯é?
if ($Environment -eq "all") {
    Write-Host "?? æ¸¬è©¦?¶ä? API ç«¯é?" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    $endpoints = @(
        @{ Url = "http://localhost:8787/api/auth/profile"; Name = "?¬åœ°èªè?ç«¯é?" },
        @{ Url = "http://localhost:3000/api/auth/profile"; Name = "?ç«¯ä»??èªè?ç«¯é?" }
    )
    
    foreach ($endpoint in $endpoints) {
        $testResults[$endpoint.Name] = Test-ApiEndpoint -Url $endpoint.Url -Name $endpoint.Name -TimeoutSec 5
    }
    
    Write-Host ""
}

# æ¸¬è©¦çµæ?ç¸½ç?
Write-Host "?? æ¸¬è©¦çµæ?ç¸½ç?" -ForegroundColor Green
Write-Host "=" * 50

$successCount = 0
$totalCount = 0

foreach ($test in $testResults.GetEnumerator()) {
    $totalCount++
    if ($test.Value) {
        $successCount++
        Write-Host "??$($test.Key)" -ForegroundColor Green
    } else {
        Write-Host "??$($test.Key)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "?å?: $successCount/$totalCount" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })

# ?ä??…é??’é™¤å»ºè­°
if ($successCount -lt $totalCount) {
    Write-Host ""
    Write-Host "?”§ ?…é??’é™¤å»ºè­°:" -ForegroundColor Yellow
    
    if ($testResults["local-worker"] -eq $false) {
        Write-Host "  - ç¢ºè?å¾Œç«¯ Worker æ­?œ¨?‹è?: wrangler dev" -ForegroundColor White
        Write-Host "  - æª¢æŸ¥ç«¯å£ 8787 ?¯å¦è¢«å??? -ForegroundColor White
    }
    
    if ($testResults["local-proxy"] -eq $false) {
        Write-Host "  - ç¢ºè??ç«¯?‹ç™¼?å??¨æ­£?¨é?è¡? npm run dev" -ForegroundColor White
        Write-Host "  - æª¢æŸ¥ Vite ä»???ç½®" -ForegroundColor White
    }
    
    if ($testResults["prod-worker"] -eq $false) {
        Write-Host "  - ç¢ºè??Ÿç”¢ Worker å·²éƒ¨ç½? wrangler deploy" -ForegroundColor White
        Write-Host "  - æª¢æŸ¥?Ÿå? DNS è¨­å?" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "?¯ ä¸‹ä?æ­¥æ?ä½?" -ForegroundColor Cyan
if ($Environment -eq "local" -or $Environment -eq "all") {
    Write-Host "  - è¨ªå??ç«¯?‰ç”¨: http://localhost:3000" -ForegroundColor White
    Write-Host "  - ?¥ç? API ?‡æ?: http://localhost:8787/docs (å¦‚æ???" -ForegroundColor White
}
if ($Environment -eq "production" -or $Environment -eq "all") {
    Write-Host "  - ?¨ç½²?ç«¯??Pages: .\deploy-frontend.ps1" -ForegroundColor White
}

Write-Host ""