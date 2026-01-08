# Fix Worker Names Script
# ç¢ºä?æ­?¢º?„ç??¢ç’°å¢?Worker ?ç¨±?ç½®
# Usage: .\fix-worker-names.ps1

param(
    [switch]$DryRun,
    [switch]$DeleteIncorrectWorkers
)

$ErrorActionPreference = "Stop"

Write-Host "=== Multi-Channel Platform Worker ?ç¨±ä¿®æ­£å·¥å…· ===" -ForegroundColor Green
Write-Host ""

# æ­?¢º??Worker ?ç¨±
$CORRECT_PRODUCTION_WORKER = "multi-channel-platform"

# æª¢æŸ¥ Wrangler ?»å…¥?€??
Write-Host "æª¢æŸ¥ Cloudflare ?»å…¥?€??.." -ForegroundColor Yellow
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "??å·²ç™»?? $whoami" -ForegroundColor Green
    } else {
        throw "?ªç™»??
    }
} catch {
    Write-Host "??è«‹å??»å…¥ Cloudflare:" -ForegroundColor Red
    Write-Host "   wrangler login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ?—å‡º?€??Workers
Write-Host "æª¢æŸ¥?¾æ? Workers..." -ForegroundColor Yellow
try {
    $workers = wrangler deploy --dry-run --env production 2>&1 | Out-String
    Write-Host "?¶å??ç½®?è¦½:" -ForegroundColor Cyan
    Write-Host $workers -ForegroundColor Gray
    
    # ?—å‡ºå¯¦é???Workers
    Write-Host ""
    Write-Host "?—å‡º?€??Workers..." -ForegroundColor Yellow
    $workerList = wrangler whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        # ? ç‚º wrangler æ²’æ??´æ¥??list workers ?½ä»¤ï¼Œæ??‘å?è©¦å…¶ä»–æ–¹æ³?
        Write-Host "è«‹æ??•æª¢??Cloudflare Dashboard ä¸­ç? Workers" -ForegroundColor Yellow
        Write-Host "Dashboard: https://dash.cloudflare.com/workers" -ForegroundColor Cyan
    }
} catch {
    Write-Host "è­¦å?: ?¡æ??—å‡º Workersï¼Œè??‹å?æª¢æŸ¥" -ForegroundColor Yellow
}

Write-Host ""

# é¡¯ç¤ºæ­?¢º?„é?ç½?
Write-Host "=== æ­?¢º??Worker ?ç½® ===" -ForegroundColor Green
Write-Host ""
Write-Host "?Ÿç”¢?°å? Worker:" -ForegroundColor Cyan
Write-Host "  ?ç¨±: $CORRECT_PRODUCTION_WORKER" -ForegroundColor White
Write-Host "  ?¨ç½²?½ä»¤: wrangler deploy --env production" -ForegroundColor Gray
Write-Host ""
Write-Host ""

# æª¢æŸ¥?ç½®?‡ä»¶
Write-Host "=== æª¢æŸ¥?ç½®?‡ä»¶ ===" -ForegroundColor Green
Write-Host ""

# æª¢æŸ¥ wrangler.toml
if (Test-Path "wrangler.toml") {
    Write-Host "??wrangler.toml å­˜åœ¨" -ForegroundColor Green
    
    $wranglerContent = Get-Content "wrangler.toml" -Raw
    if ($wranglerContent -match 'name\s*=\s*"multi-channel-platform"') {
        Write-Host "??wrangler.toml ?ºç??ç¨±æ­?¢º" -ForegroundColor Green
    } else {
        Write-Host "??wrangler.toml ?ºç??ç¨±?¯èª¤" -ForegroundColor Red
    }
    
    # æª¢æŸ¥?Ÿç”¢?°å??¯å¦?‰é??°å?ç¾?name
    if ($wranglerContent -match '\[env\.production\].*?name\s*=') {
        Write-Host "???Ÿç”¢?°å?ä¸æ??æ–°å®šç¾© name" -ForegroundColor Red
    } else {
        Write-Host "???Ÿç”¢?°å??ç½®æ­?¢º" -ForegroundColor Green
    }
} else {
    Write-Host "??wrangler.toml ä¸å??? -ForegroundColor Red
}

# æª¢æŸ¥ Terraform ?ç½®
if (Test-Path "main.tf") {
    Write-Host "??main.tf å­˜åœ¨" -ForegroundColor Green
    
    $terraformContent = Get-Content "main.tf" -Raw
    if ($terraformContent -match 'base_project_name\s*=\s*"multi-channel-platform"') {
        Write-Host "??Terraform ?ç½®æ­?¢º" -ForegroundColor Green
    } else {
        Write-Host "??Terraform ?ç½®?¯èƒ½?‰å?é¡? -ForegroundColor Red
    }
} else {
    Write-Host "??main.tf ä¸å??¨ï??¯é¸ï¼? -ForegroundColor Yellow
}

Write-Host ""

# ?ä?ä¿®æ­£å»ºè­°
Write-Host "=== ä¿®æ­£æ­¥é? ===" -ForegroundColor Green
Write-Host ""

Write-Host "å¦‚æ??¼ç¾?¯èª¤??Worker (å¦?multi-channel-platform-production):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ?‹å??ªé™¤?¯èª¤??Worker:" -ForegroundColor Cyan
Write-Host "   ??è¨ªå? https://dash.cloudflare.com/workers" -ForegroundColor Gray
Write-Host "   ???¾åˆ°?¯èª¤??Worker ä¸¦åˆª?? -ForegroundColor Gray
Write-Host ""
Write-Host "2. ?æ–°?¨ç½²æ­?¢º??Worker:" -ForegroundColor Cyan
Write-Host "   wrangler deploy --env production" -ForegroundColor White
Write-Host ""
Write-Host "3. é©—è??¨ç½²:" -ForegroundColor Cyan
Write-Host "   curl https://your-api-domain.example.com/api/system/health" -ForegroundColor White
Write-Host ""

# æ¸¬è©¦?¶å??ç½®
Write-Host "=== æ¸¬è©¦?¶å??ç½® ===" -ForegroundColor Green
Write-Host ""

if (-not $DryRun) {
    Write-Host "æ¸¬è©¦ wrangler deploy --env production (dry-run)..." -ForegroundColor Yellow
    try {
        $deployTest = wrangler deploy --dry-run --env production 2>&1
        Write-Host "?¨ç½²?è¦½:" -ForegroundColor Cyan
        Write-Host $deployTest -ForegroundColor Gray
        
        if ($deployTest -match $CORRECT_PRODUCTION_WORKER) {
            Write-Host "???ç½®æ­?¢ºï¼Œå??¨ç½²?? $CORRECT_PRODUCTION_WORKER" -ForegroundColor Green
        } else {
            Write-Host "???ç½®?¯èª¤ï¼Œè?æª¢æŸ¥è¨­å?" -ForegroundColor Red
        }
    } catch {
        Write-Host "???¡æ?æ¸¬è©¦?¨ç½²?ç½®: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== æª¢æŸ¥å®Œæ? ===" -ForegroundColor Green
Write-Host ""
Write-Host "?è??é?:" -ForegroundColor Yellow
Write-Host "???Ÿç”¢?°å? Worker ?ç¨±å¿…é??? $CORRECT_PRODUCTION_WORKER" -ForegroundColor White
Write-Host "??å¦‚æ?ä»»ä? multi-channel-platform-production Workerï¼Œè??‹å??ªé™¤" -ForegroundColor White
Write-Host ""
Write-Host "å¦‚é??”åŠ©ï¼Œè?æª¢æŸ¥ Cloudflare Dashboard:" -ForegroundColor Cyan
Write-Host "https://dash.cloudflare.com/workers" -ForegroundColor White