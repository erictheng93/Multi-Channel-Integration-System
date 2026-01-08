# R2 Bucket ä¸€?´æ€§é?è­‰è…³??
# é©—è??€??R2 ?¸é??ç½®?„ä??´æ€?
# Usage: .\verify-r2-consistency.ps1

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Multi-Channel Platform R2 ä¸€?´æ€§é?è­?===" -ForegroundColor Green
Write-Host ""

# å®šç¾©?æ??„é?ç½?
$EXPECTED_CONFIG = @{
    Development = @{
        BucketName = "multi-channel-platform-attachments-dev"
        WranglerBinding = "R2_BUCKET"
        CustomDomain = "s3-dev.example.com"
    }
    Production = @{
        BucketName = "multi-channel-platform-attachments"
        WranglerBinding = "R2_BUCKET" 
        CustomDomain = "your-storage-domain.example.com"
    }
}

# æª¢æŸ¥çµæ?è¨˜é?
$checkResults = @()

# æª¢æŸ¥ Wrangler ?»å…¥?€??
Write-Host "æª¢æŸ¥ Cloudflare ?»å…¥?€??.." -ForegroundColor Yellow
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "??å·²ç™»?? $whoami" -ForegroundColor Green
        $checkResults += @{ Name="Cloudflareèªè?"; Status="??; Details=$whoami }
    } else {
        throw "?ªç™»??
    }
} catch {
    Write-Host "??è«‹å??»å…¥ Cloudflare: wrangler login" -ForegroundColor Red
    $checkResults += @{ Name="Cloudflareèªè?"; Status="??; Details="?ªç™»?? }
}

Write-Host ""

# æª¢æŸ¥ wrangler.toml ?ç½®
Write-Host "æª¢æŸ¥ wrangler.toml ?ç½®..." -ForegroundColor Yellow
$wranglerTomlPath = "wrangler.toml"

if (Test-Path $wranglerTomlPath) {
    try {
        $wranglerContent = Get-Content $wranglerTomlPath -Raw
        
        # æª¢æŸ¥?‹ç™¼?°å? R2 ?ç½®
        if ($wranglerContent -match 'bucket_name\s*=\s*"multi-channel-platform-attachments-dev"') {
            Write-Host "???‹ç™¼?°å? R2 bucket ?ç½®æ­?¢º" -ForegroundColor Green
            $checkResults += @{ Name="?‹ç™¼?°å?R2?ç½®"; Status="??; Details="multi-channel-platform-attachments-dev" }
        } else {
            Write-Host "???‹ç™¼?°å? R2 bucket ?ç½®?¯èª¤" -ForegroundColor Red
            $checkResults += @{ Name="?‹ç™¼?°å?R2?ç½®"; Status="??; Details="?ç½®ä¸åŒ¹?? }
        }
        
        # æª¢æŸ¥?Ÿç”¢?°å? R2 ?ç½®
        if ($wranglerContent -match '\[env\.production\.r2_buckets\][\s\S]*?bucket_name\s*=\s*"multi-channel-platform-attachments"') {
            Write-Host "???Ÿç”¢?°å? R2 bucket ?ç½®æ­?¢º" -ForegroundColor Green
            $checkResults += @{ Name="?Ÿç”¢?°å?R2?ç½®"; Status="??; Details="multi-channel-platform-attachments" }
        } else {
            Write-Host "???Ÿç”¢?°å? R2 bucket ?ç½®?¯èª¤" -ForegroundColor Red
            $checkResults += @{ Name="?Ÿç”¢?°å?R2?ç½®"; Status="??; Details="?ç½®ä¸åŒ¹?? }
        }
        
    } catch {
        Write-Host "??è®€??wrangler.toml å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="wrangler.tomlè®€??; Status="??; Details=$_.Exception.Message }
    }
} else {
    Write-Host "??wrangler.toml æª”æ?ä¸å??? -ForegroundColor Red
    $checkResults += @{ Name="wrangler.tomlå­˜åœ¨"; Status="??; Details="æª”æ?ä¸å??? }
}

Write-Host ""

# æª¢æŸ¥ setup-r2-storage.ts ?ç½®
Write-Host "æª¢æŸ¥ setup-r2-storage.ts ?ç½®..." -ForegroundColor Yellow
$setupScriptPath = "scripts/setup-r2-storage.ts"

if (Test-Path $setupScriptPath) {
    try {
        $setupContent = Get-Content $setupScriptPath -Raw
        
        # æª¢æŸ¥?‹ç™¼?°å??ç½®
        if ($setupContent -match "bucketName:\s*'multi-channel-platform-attachments-develop'") {
            Write-Host "??setup-r2-storage.ts ?‹ç™¼?°å??ç½®æ­?¢º" -ForegroundColor Green
            $checkResults += @{ Name="setup?³æœ¬?‹ç™¼?ç½®"; Status="??; Details="develop bucketæ­?¢º" }
        } else {
            Write-Host "??setup-r2-storage.ts ?‹ç™¼?°å??ç½®?¯èª¤" -ForegroundColor Red
            $checkResults += @{ Name="setup?³æœ¬?‹ç™¼?ç½®"; Status="??; Details="develop bucketä¸åŒ¹?? }
        }
        
        # æª¢æŸ¥?Ÿç”¢?°å??ç½®
        if ($setupContent -match "bucketName:\s*'multi-channel-platform-attachments-production'") {
            Write-Host "??setup-r2-storage.ts ?Ÿç”¢?°å??ç½®æ­?¢º" -ForegroundColor Green
            $checkResults += @{ Name="setup?³æœ¬?Ÿç”¢?ç½®"; Status="??; Details="production bucketæ­?¢º" }
        } else {
            Write-Host "??setup-r2-storage.ts ?Ÿç”¢?°å??ç½®?¯èª¤" -ForegroundColor Red
            $checkResults += @{ Name="setup?³æœ¬?Ÿç”¢?ç½®"; Status="??; Details="production bucketä¸åŒ¹?? }
        }
        
    } catch {
        Write-Host "??è®€??setup-r2-storage.ts å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="setup?³æœ¬è®€??; Status="??; Details=$_.Exception.Message }
    }
} else {
    Write-Host "??setup-r2-storage.ts æª”æ?ä¸å??? -ForegroundColor Yellow
    $checkResults += @{ Name="setup?³æœ¬å­˜åœ¨"; Status="??; Details="æª”æ?ä¸å??? }
}

Write-Host ""

# æª¢æŸ¥ verify-r2-domain.ts ?ç½®
Write-Host "æª¢æŸ¥ verify-r2-domain.ts ?ç½®..." -ForegroundColor Yellow
$verifyScriptPath = "scripts/verify-r2-domain.ts"

if (Test-Path $verifyScriptPath) {
    try {
        $verifyContent = Get-Content $verifyScriptPath -Raw
        
        # æª¢æŸ¥?ç½®?¸ç?
        if ($verifyContent -match "bucketName:\s*'multi-channel-platform-attachments-develop'" -and 
            $verifyContent -match "bucketName:\s*'multi-channel-platform-attachments-production'") {
            Write-Host "??verify-r2-domain.ts ?ç½®æ­?¢º" -ForegroundColor Green
            $checkResults += @{ Name="verify?³æœ¬?ç½®"; Status="??; Details="?©å€‹ç’°å¢ƒbucket?½æ­£ç¢? }
        } else {
            Write-Host "??verify-r2-domain.ts ?ç½®?¯èª¤" -ForegroundColor Red
            $checkResults += @{ Name="verify?³æœ¬?ç½®"; Status="??; Details="bucket?ç¨±ä¸åŒ¹?? }
        }
        
    } catch {
        Write-Host "??è®€??verify-r2-domain.ts å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="verify?³æœ¬è®€??; Status="??; Details=$_.Exception.Message }
    }
} else {
    Write-Host "??verify-r2-domain.ts æª”æ?ä¸å??? -ForegroundColor Yellow
    $checkResults += @{ Name="verify?³æœ¬å­˜åœ¨"; Status="??; Details="æª”æ?ä¸å??? }
}

Write-Host ""

# æª¢æŸ¥å¯¦é???R2 buckets ?¯å¦å­˜åœ¨
Write-Host "æª¢æŸ¥ Cloudflare R2 buckets ?¯å¦å­˜åœ¨..." -ForegroundColor Yellow
try {
    $bucketList = wrangler r2 bucket list 2>$null
    if ($LASTEXITCODE -eq 0) {
        
        # æª¢æŸ¥?‹ç™¼?°å? bucket
        if ($bucketList -match "multi-channel-platform-attachments-develop") {
            Write-Host "???‹ç™¼?°å? bucket å­˜åœ¨" -ForegroundColor Green
            $checkResults += @{ Name="?‹ç™¼bucketå­˜åœ¨"; Status="??; Details="multi-channel-platform-attachments-develop" }
        } else {
            Write-Host "???‹ç™¼?°å? bucket ä¸å??? -ForegroundColor Red
            $checkResults += @{ Name="?‹ç™¼bucketå­˜åœ¨"; Status="??; Details="bucket?ªæ‰¾?? }
        }
        
        # æª¢æŸ¥?Ÿç”¢?°å? bucket
        if ($bucketList -match "multi-channel-platform-attachments-production") {
            Write-Host "???Ÿç”¢?°å? bucket å­˜åœ¨" -ForegroundColor Green
            $checkResults += @{ Name="?Ÿç”¢bucketå­˜åœ¨"; Status="??; Details="multi-channel-platform-attachments-production" }
        } else {
            Write-Host "???Ÿç”¢?°å? bucket ä¸å??? -ForegroundColor Red
            $checkResults += @{ Name="?Ÿç”¢bucketå­˜åœ¨"; Status="??; Details="bucket?ªæ‰¾?? }
        }
        
        if ($Verbose) {
            Write-Host ""
            Write-Host "?€??R2 Buckets:" -ForegroundColor Cyan
            Write-Host $bucketList -ForegroundColor Gray
        }
        
    } else {
        Write-Host "???¡æ??—å‡º R2 buckets" -ForegroundColor Red
        $checkResults += @{ Name="R2?—è¡¨"; Status="??; Details="wrangler?½ä»¤å¤±æ?" }
    }
} catch {
    Write-Host "??æª¢æŸ¥ R2 buckets å¤±æ?: $($_.Exception.Message)" -ForegroundColor Red
    $checkResults += @{ Name="R2æª¢æŸ¥"; Status="??; Details=$_.Exception.Message }
}

Write-Host ""

# ?Ÿæ?æª¢æŸ¥?±å?
Write-Host "=== ä¸€?´æ€§æª¢?¥å ±??===" -ForegroundColor Green
Write-Host ""

$successCount = 0
$warningCount = 0
$errorCount = 0

foreach ($result in $checkResults) {
    $status = $result.Status
    $name = $result.Name.PadRight(20)
    $details = if ($Verbose) { " - $($result.Details)" } else { "" }
    
    switch ($status) {
        "?? { 
            Write-Host "$status $name$details" -ForegroundColor Green
            $successCount++
        }
        "?? { 
            Write-Host "$status $name$details" -ForegroundColor Yellow
            $warningCount++
        }
        "?? { 
            Write-Host "$status $name$details" -ForegroundColor Red
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "æª¢æŸ¥ç¸½ç?:" -ForegroundColor Cyan
Write-Host "  ?å?: $successCount" -ForegroundColor Green
Write-Host "  è­¦å?: $warningCount" -ForegroundColor Yellow  
Write-Host "  ?¯èª¤: $errorCount" -ForegroundColor Red

Write-Host ""

# ?ä?ä¿®å¾©å»ºè­°
if ($errorCount -gt 0) {
    Write-Host "=== ä¿®å¾©å»ºè­° ===" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "å¦‚æ??¼ç¾?ç½®ä¸ä??´ï?è«‹åŸ·è¡Œä»¥ä¸‹æ­¥é©?" -ForegroundColor White
    Write-Host ""
    Write-Host "1. å¦‚æ? bucket ä¸å??¨ï??µå»ºå®ƒå€?" -ForegroundColor Cyan
    Write-Host "   wrangler r2 bucket create multi-channel-platform-attachments-develop" -ForegroundColor Gray
    Write-Host "   wrangler r2 bucket create multi-channel-platform-attachments-production" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. å¦‚æ??³è?çµ±ä??½å?è¦å?ï¼Œä½¿?¨é??½å??³æœ¬:" -ForegroundColor Cyan
    Write-Host "   .\scripts\fix-r2-bucket-names.ps1 -DryRun" -ForegroundColor Gray
    Write-Host "   .\scripts\fix-r2-bucket-names.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. è¨­ç½® R2 buckets ??CORS ?Œå???" -ForegroundColor Cyan
    Write-Host "   npm run setup:r2" -ForegroundColor Gray
    Write-Host "   npm run setup:r2:prod" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. æ¸¬è©¦ R2 ?Ÿå??ç½®:" -ForegroundColor Cyan
    Write-Host "   npx tsx scripts/verify-r2-domain.ts" -ForegroundColor Gray
    
    exit 1
} elseif ($warningCount -gt 0) {
    Write-Host "???¼ç¾è­¦å?ï¼Œä?ç³»çµ±?‰è©²?½æ­£å¸¸é?è¡? -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "?? ?€??R2 ?ç½®ä¸€?´æ€§æª¢?¥é€šé?ï¼? -ForegroundColor Green
    Write-Host ""
    Write-Host "?¨ç? R2 ?ç½®å·²æ­£ç¢ºè¨­ç½?" -ForegroundColor Cyan
    Write-Host "???‹ç™¼?°å?: multi-channel-platform-attachments-develop" -ForegroundColor White
    Write-Host "???Ÿç”¢?°å?: multi-channel-platform-attachments-production" -ForegroundColor White
    Write-Host ""
    Write-Host "?¯ä»¥å®‰å…¨?°é€²è??¨ç½²äº†ï?" -ForegroundColor Green
    exit 0
}