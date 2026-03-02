# R2 Bucket 一?�性�?證腳??
# 驗�??�??R2 ?��??�置?��??��?
# Usage: .\verify-r2-consistency.ps1

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Multi-Channel Platform R2 一?�性�?�?===" -ForegroundColor Green
Write-Host ""

# 定義?��??��?�?
$EXPECTED_CONFIG = @{
    Development = @{
        BucketName = "mcis-files"
        WranglerBinding = "R2_BUCKET"
        CustomDomain = "s3-dev.example.com"
    }
    Production = @{
        BucketName = "mcis-files"
        WranglerBinding = "R2_BUCKET" 
        CustomDomain = "your-storage-domain.example.com"
    }
}

# 檢查結�?記�?
$checkResults = @()

# 檢查 Wrangler ?�入?�??
Write-Host "檢查 Cloudflare ?�入?�??.." -ForegroundColor Yellow
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "??已登?? $whoami" -ForegroundColor Green
        $checkResults += @{ Name="Cloudflare認�?"; Status="??; Details=$whoami }
    } else {
        throw "?�登??
    }
} catch {
    Write-Host "??請�??�入 Cloudflare: wrangler login" -ForegroundColor Red
    $checkResults += @{ Name="Cloudflare認�?"; Status="??; Details="?�登?? }
}

Write-Host ""

# 檢查 wrangler.toml ?�置
Write-Host "檢查 wrangler.toml ?�置..." -ForegroundColor Yellow
$wranglerTomlPath = "wrangler.toml"

if (Test-Path $wranglerTomlPath) {
    try {
        $wranglerContent = Get-Content $wranglerTomlPath -Raw
        
        # 檢查?�發?��? R2 ?�置
        if ($wranglerContent -match 'bucket_name\s*=\s*"mcis-files"') {
            Write-Host "???�發?��? R2 bucket ?�置�?��" -ForegroundColor Green
            $checkResults += @{ Name="?�發?��?R2?�置"; Status="??; Details="mcis-files" }
        } else {
            Write-Host "???�發?��? R2 bucket ?�置?�誤" -ForegroundColor Red
            $checkResults += @{ Name="?�發?��?R2?�置"; Status="??; Details="?�置不匹?? }
        }
        
        # 檢查?�產?��? R2 ?�置
        if ($wranglerContent -match '\[env\.production\.r2_buckets\][\s\S]*?bucket_name\s*=\s*"mcis-files"') {
            Write-Host "???�產?��? R2 bucket ?�置�?��" -ForegroundColor Green
            $checkResults += @{ Name="?�產?��?R2?�置"; Status="??; Details="mcis-files" }
        } else {
            Write-Host "???�產?��? R2 bucket ?�置?�誤" -ForegroundColor Red
            $checkResults += @{ Name="?�產?��?R2?�置"; Status="??; Details="?�置不匹?? }
        }
        
    } catch {
        Write-Host "??讀??wrangler.toml 失�?: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="wrangler.toml讀??; Status="??; Details=$_.Exception.Message }
    }
} else {
    Write-Host "??wrangler.toml 檔�?不�??? -ForegroundColor Red
    $checkResults += @{ Name="wrangler.toml存在"; Status="??; Details="檔�?不�??? }
}

Write-Host ""

# 檢查 setup-r2-storage.ts ?�置
Write-Host "檢查 setup-r2-storage.ts ?�置..." -ForegroundColor Yellow
$setupScriptPath = "scripts/setup-r2-storage.ts"

if (Test-Path $setupScriptPath) {
    try {
        $setupContent = Get-Content $setupScriptPath -Raw
        
        # 檢查?�發?��??�置
        if ($setupContent -match "bucketName:\s*'mcis-files'") {
            Write-Host "??setup-r2-storage.ts ?�發?��??�置�?��" -ForegroundColor Green
            $checkResults += @{ Name="setup?�本?�發?�置"; Status="??; Details="develop bucket�?��" }
        } else {
            Write-Host "??setup-r2-storage.ts ?�發?��??�置?�誤" -ForegroundColor Red
            $checkResults += @{ Name="setup?�本?�發?�置"; Status="??; Details="develop bucket不匹?? }
        }
        
        # 檢查?�產?��??�置
        if ($setupContent -match "bucketName:\s*'mcis-files'") {
            Write-Host "??setup-r2-storage.ts ?�產?��??�置�?��" -ForegroundColor Green
            $checkResults += @{ Name="setup?�本?�產?�置"; Status="??; Details="production bucket�?��" }
        } else {
            Write-Host "??setup-r2-storage.ts ?�產?��??�置?�誤" -ForegroundColor Red
            $checkResults += @{ Name="setup?�本?�產?�置"; Status="??; Details="production bucket不匹?? }
        }
        
    } catch {
        Write-Host "??讀??setup-r2-storage.ts 失�?: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="setup?�本讀??; Status="??; Details=$_.Exception.Message }
    }
} else {
    Write-Host "??setup-r2-storage.ts 檔�?不�??? -ForegroundColor Yellow
    $checkResults += @{ Name="setup?�本存在"; Status="??; Details="檔�?不�??? }
}

Write-Host ""

# 檢查 verify-r2-domain.ts ?�置
Write-Host "檢查 verify-r2-domain.ts ?�置..." -ForegroundColor Yellow
$verifyScriptPath = "scripts/verify-r2-domain.ts"

if (Test-Path $verifyScriptPath) {
    try {
        $verifyContent = Get-Content $verifyScriptPath -Raw
        
        # 檢查?�置?��?
        if ($verifyContent -match "bucketName:\s*'mcis-files'" -and 
            $verifyContent -match "bucketName:\s*'mcis-files'") {
            Write-Host "??verify-r2-domain.ts ?�置�?��" -ForegroundColor Green
            $checkResults += @{ Name="verify?�本?�置"; Status="??; Details="?�個環境bucket?�正�? }
        } else {
            Write-Host "??verify-r2-domain.ts ?�置?�誤" -ForegroundColor Red
            $checkResults += @{ Name="verify?�本?�置"; Status="??; Details="bucket?�稱不匹?? }
        }
        
    } catch {
        Write-Host "??讀??verify-r2-domain.ts 失�?: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="verify?�本讀??; Status="??; Details=$_.Exception.Message }
    }
} else {
    Write-Host "??verify-r2-domain.ts 檔�?不�??? -ForegroundColor Yellow
    $checkResults += @{ Name="verify?�本存在"; Status="??; Details="檔�?不�??? }
}

Write-Host ""

# 檢查實�???R2 buckets ?�否存在
Write-Host "檢查 Cloudflare R2 buckets ?�否存在..." -ForegroundColor Yellow
try {
    $bucketList = wrangler r2 bucket list 2>$null
    if ($LASTEXITCODE -eq 0) {
        
        # 檢查?�發?��? bucket
        if ($bucketList -match "mcis-files") {
            Write-Host "???�發?��? bucket 存在" -ForegroundColor Green
            $checkResults += @{ Name="?�發bucket存在"; Status="??; Details="mcis-files" }
        } else {
            Write-Host "???�發?��? bucket 不�??? -ForegroundColor Red
            $checkResults += @{ Name="?�發bucket存在"; Status="??; Details="bucket?�找?? }
        }
        
        # 檢查?�產?��? bucket
        if ($bucketList -match "mcis-files") {
            Write-Host "???�產?��? bucket 存在" -ForegroundColor Green
            $checkResults += @{ Name="?�產bucket存在"; Status="??; Details="mcis-files" }
        } else {
            Write-Host "???�產?��? bucket 不�??? -ForegroundColor Red
            $checkResults += @{ Name="?�產bucket存在"; Status="??; Details="bucket?�找?? }
        }
        
        if ($Verbose) {
            Write-Host ""
            Write-Host "?�??R2 Buckets:" -ForegroundColor Cyan
            Write-Host $bucketList -ForegroundColor Gray
        }
        
    } else {
        Write-Host "???��??�出 R2 buckets" -ForegroundColor Red
        $checkResults += @{ Name="R2?�表"; Status="??; Details="wrangler?�令失�?" }
    }
} catch {
    Write-Host "??檢查 R2 buckets 失�?: $($_.Exception.Message)" -ForegroundColor Red
    $checkResults += @{ Name="R2檢查"; Status="??; Details=$_.Exception.Message }
}

Write-Host ""

# ?��?檢查?��?
Write-Host "=== 一?�性檢?�報??===" -ForegroundColor Green
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
Write-Host "檢查總�?:" -ForegroundColor Cyan
Write-Host "  ?��?: $successCount" -ForegroundColor Green
Write-Host "  警�?: $warningCount" -ForegroundColor Yellow  
Write-Host "  ?�誤: $errorCount" -ForegroundColor Red

Write-Host ""

# ?��?修復建議
if ($errorCount -gt 0) {
    Write-Host "=== 修復建議 ===" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "如�??�現?�置不�??��?請執行以下步�?" -ForegroundColor White
    Write-Host ""
    Write-Host "1. 如�? bucket 不�??��??�建它�?" -ForegroundColor Cyan
    Write-Host "   wrangler r2 bucket create mcis-files" -ForegroundColor Gray
    Write-Host "   wrangler r2 bucket create mcis-files" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 如�??��?統�??��?規�?，使?��??��??�本:" -ForegroundColor Cyan
    Write-Host "   .\scripts\fix-r2-bucket-names.ps1 -DryRun" -ForegroundColor Gray
    Write-Host "   .\scripts\fix-r2-bucket-names.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 設置 R2 buckets ??CORS ?��???" -ForegroundColor Cyan
    Write-Host "   npm run setup:r2" -ForegroundColor Gray
    Write-Host "   npm run setup:r2:prod" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. 測試 R2 ?��??�置:" -ForegroundColor Cyan
    Write-Host "   npx tsx scripts/verify-r2-domain.ts" -ForegroundColor Gray
    
    exit 1
} elseif ($warningCount -gt 0) {
    Write-Host "???�現警�?，�?系統?�該?�正常�?�? -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "?? ?�??R2 ?�置一?�性檢?�通�?�? -ForegroundColor Green
    Write-Host ""
    Write-Host "?��? R2 ?�置已正確設�?" -ForegroundColor Cyan
    Write-Host "???�發?��?: mcis-files" -ForegroundColor White
    Write-Host "???�產?��?: mcis-files" -ForegroundColor White
    Write-Host ""
    Write-Host "?�以安全?�進�??�署了�?" -ForegroundColor Green
    exit 0
}