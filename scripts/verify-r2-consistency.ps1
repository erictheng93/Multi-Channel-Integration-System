# R2 Bucket 一致性驗證腳本
# 驗證所有 R2 相關配置的一致性
# Usage: .\verify-r2-consistency.ps1

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Multi-Channel Platform R2 一致性驗證 ===" -ForegroundColor Green
Write-Host ""

# 定義預期的配置
$EXPECTED_CONFIG = @{
    Development = @{
        BucketName = "multi-channel-platform-attachments-dev"
        WranglerBinding = "R2_BUCKET"
        CustomDomain = "s3-dev.imfinethankyouandyou.com"
    }
    Production = @{
        BucketName = "multi-channel-platform-attachments"
        WranglerBinding = "R2_BUCKET" 
        CustomDomain = "s3.imfinethankyouandyou.com"
    }
}

# 檢查結果記錄
$checkResults = @()

# 檢查 Wrangler 登入狀態
Write-Host "檢查 Cloudflare 登入狀態..." -ForegroundColor Yellow
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 已登入: $whoami" -ForegroundColor Green
        $checkResults += @{ Name="Cloudflare認證"; Status="✓"; Details=$whoami }
    } else {
        throw "未登入"
    }
} catch {
    Write-Host "❌ 請先登入 Cloudflare: wrangler login" -ForegroundColor Red
    $checkResults += @{ Name="Cloudflare認證"; Status="❌"; Details="未登入" }
}

Write-Host ""

# 檢查 wrangler.toml 配置
Write-Host "檢查 wrangler.toml 配置..." -ForegroundColor Yellow
$wranglerTomlPath = "wrangler.toml"

if (Test-Path $wranglerTomlPath) {
    try {
        $wranglerContent = Get-Content $wranglerTomlPath -Raw
        
        # 檢查開發環境 R2 配置
        if ($wranglerContent -match 'bucket_name\s*=\s*"multi-channel-platform-attachments-dev"') {
            Write-Host "✓ 開發環境 R2 bucket 配置正確" -ForegroundColor Green
            $checkResults += @{ Name="開發環境R2配置"; Status="✓"; Details="multi-channel-platform-attachments-dev" }
        } else {
            Write-Host "❌ 開發環境 R2 bucket 配置錯誤" -ForegroundColor Red
            $checkResults += @{ Name="開發環境R2配置"; Status="❌"; Details="配置不匹配" }
        }
        
        # 檢查生產環境 R2 配置
        if ($wranglerContent -match '\[env\.production\.r2_buckets\][\s\S]*?bucket_name\s*=\s*"multi-channel-platform-attachments"') {
            Write-Host "✓ 生產環境 R2 bucket 配置正確" -ForegroundColor Green
            $checkResults += @{ Name="生產環境R2配置"; Status="✓"; Details="multi-channel-platform-attachments" }
        } else {
            Write-Host "❌ 生產環境 R2 bucket 配置錯誤" -ForegroundColor Red
            $checkResults += @{ Name="生產環境R2配置"; Status="❌"; Details="配置不匹配" }
        }
        
    } catch {
        Write-Host "❌ 讀取 wrangler.toml 失敗: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="wrangler.toml讀取"; Status="❌"; Details=$_.Exception.Message }
    }
} else {
    Write-Host "❌ wrangler.toml 檔案不存在" -ForegroundColor Red
    $checkResults += @{ Name="wrangler.toml存在"; Status="❌"; Details="檔案不存在" }
}

Write-Host ""

# 檢查 setup-r2-storage.ts 配置
Write-Host "檢查 setup-r2-storage.ts 配置..." -ForegroundColor Yellow
$setupScriptPath = "scripts/setup-r2-storage.ts"

if (Test-Path $setupScriptPath) {
    try {
        $setupContent = Get-Content $setupScriptPath -Raw
        
        # 檢查開發環境配置
        if ($setupContent -match "bucketName:\s*'multi-channel-platform-attachments-develop'") {
            Write-Host "✓ setup-r2-storage.ts 開發環境配置正確" -ForegroundColor Green
            $checkResults += @{ Name="setup腳本開發配置"; Status="✓"; Details="develop bucket正確" }
        } else {
            Write-Host "❌ setup-r2-storage.ts 開發環境配置錯誤" -ForegroundColor Red
            $checkResults += @{ Name="setup腳本開發配置"; Status="❌"; Details="develop bucket不匹配" }
        }
        
        # 檢查生產環境配置
        if ($setupContent -match "bucketName:\s*'multi-channel-platform-attachments-production'") {
            Write-Host "✓ setup-r2-storage.ts 生產環境配置正確" -ForegroundColor Green
            $checkResults += @{ Name="setup腳本生產配置"; Status="✓"; Details="production bucket正確" }
        } else {
            Write-Host "❌ setup-r2-storage.ts 生產環境配置錯誤" -ForegroundColor Red
            $checkResults += @{ Name="setup腳本生產配置"; Status="❌"; Details="production bucket不匹配" }
        }
        
    } catch {
        Write-Host "❌ 讀取 setup-r2-storage.ts 失敗: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="setup腳本讀取"; Status="❌"; Details=$_.Exception.Message }
    }
} else {
    Write-Host "⚠ setup-r2-storage.ts 檔案不存在" -ForegroundColor Yellow
    $checkResults += @{ Name="setup腳本存在"; Status="⚠"; Details="檔案不存在" }
}

Write-Host ""

# 檢查 verify-r2-domain.ts 配置
Write-Host "檢查 verify-r2-domain.ts 配置..." -ForegroundColor Yellow
$verifyScriptPath = "scripts/verify-r2-domain.ts"

if (Test-Path $verifyScriptPath) {
    try {
        $verifyContent = Get-Content $verifyScriptPath -Raw
        
        # 檢查配置數組
        if ($verifyContent -match "bucketName:\s*'multi-channel-platform-attachments-develop'" -and 
            $verifyContent -match "bucketName:\s*'multi-channel-platform-attachments-production'") {
            Write-Host "✓ verify-r2-domain.ts 配置正確" -ForegroundColor Green
            $checkResults += @{ Name="verify腳本配置"; Status="✓"; Details="兩個環境bucket都正確" }
        } else {
            Write-Host "❌ verify-r2-domain.ts 配置錯誤" -ForegroundColor Red
            $checkResults += @{ Name="verify腳本配置"; Status="❌"; Details="bucket名稱不匹配" }
        }
        
    } catch {
        Write-Host "❌ 讀取 verify-r2-domain.ts 失敗: $($_.Exception.Message)" -ForegroundColor Red
        $checkResults += @{ Name="verify腳本讀取"; Status="❌"; Details=$_.Exception.Message }
    }
} else {
    Write-Host "⚠ verify-r2-domain.ts 檔案不存在" -ForegroundColor Yellow
    $checkResults += @{ Name="verify腳本存在"; Status="⚠"; Details="檔案不存在" }
}

Write-Host ""

# 檢查實際的 R2 buckets 是否存在
Write-Host "檢查 Cloudflare R2 buckets 是否存在..." -ForegroundColor Yellow
try {
    $bucketList = wrangler r2 bucket list 2>$null
    if ($LASTEXITCODE -eq 0) {
        
        # 檢查開發環境 bucket
        if ($bucketList -match "multi-channel-platform-attachments-develop") {
            Write-Host "✓ 開發環境 bucket 存在" -ForegroundColor Green
            $checkResults += @{ Name="開發bucket存在"; Status="✓"; Details="multi-channel-platform-attachments-develop" }
        } else {
            Write-Host "❌ 開發環境 bucket 不存在" -ForegroundColor Red
            $checkResults += @{ Name="開發bucket存在"; Status="❌"; Details="bucket未找到" }
        }
        
        # 檢查生產環境 bucket
        if ($bucketList -match "multi-channel-platform-attachments-production") {
            Write-Host "✓ 生產環境 bucket 存在" -ForegroundColor Green
            $checkResults += @{ Name="生產bucket存在"; Status="✓"; Details="multi-channel-platform-attachments-production" }
        } else {
            Write-Host "❌ 生產環境 bucket 不存在" -ForegroundColor Red
            $checkResults += @{ Name="生產bucket存在"; Status="❌"; Details="bucket未找到" }
        }
        
        if ($Verbose) {
            Write-Host ""
            Write-Host "所有 R2 Buckets:" -ForegroundColor Cyan
            Write-Host $bucketList -ForegroundColor Gray
        }
        
    } else {
        Write-Host "❌ 無法列出 R2 buckets" -ForegroundColor Red
        $checkResults += @{ Name="R2列表"; Status="❌"; Details="wrangler命令失敗" }
    }
} catch {
    Write-Host "❌ 檢查 R2 buckets 失敗: $($_.Exception.Message)" -ForegroundColor Red
    $checkResults += @{ Name="R2檢查"; Status="❌"; Details=$_.Exception.Message }
}

Write-Host ""

# 生成檢查報告
Write-Host "=== 一致性檢查報告 ===" -ForegroundColor Green
Write-Host ""

$successCount = 0
$warningCount = 0
$errorCount = 0

foreach ($result in $checkResults) {
    $status = $result.Status
    $name = $result.Name.PadRight(20)
    $details = if ($Verbose) { " - $($result.Details)" } else { "" }
    
    switch ($status) {
        "✓" { 
            Write-Host "$status $name$details" -ForegroundColor Green
            $successCount++
        }
        "⚠" { 
            Write-Host "$status $name$details" -ForegroundColor Yellow
            $warningCount++
        }
        "❌" { 
            Write-Host "$status $name$details" -ForegroundColor Red
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "檢查總結:" -ForegroundColor Cyan
Write-Host "  成功: $successCount" -ForegroundColor Green
Write-Host "  警告: $warningCount" -ForegroundColor Yellow  
Write-Host "  錯誤: $errorCount" -ForegroundColor Red

Write-Host ""

# 提供修復建議
if ($errorCount -gt 0) {
    Write-Host "=== 修復建議 ===" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "如果發現配置不一致，請執行以下步驟:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. 如果 bucket 不存在，創建它們:" -ForegroundColor Cyan
    Write-Host "   wrangler r2 bucket create multi-channel-platform-attachments-develop" -ForegroundColor Gray
    Write-Host "   wrangler r2 bucket create multi-channel-platform-attachments-production" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 如果想要統一命名規則，使用重命名腳本:" -ForegroundColor Cyan
    Write-Host "   .\scripts\fix-r2-bucket-names.ps1 -DryRun" -ForegroundColor Gray
    Write-Host "   .\scripts\fix-r2-bucket-names.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 設置 R2 buckets 的 CORS 和域名:" -ForegroundColor Cyan
    Write-Host "   npm run setup:r2" -ForegroundColor Gray
    Write-Host "   npm run setup:r2:prod" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. 測試 R2 域名配置:" -ForegroundColor Cyan
    Write-Host "   npx tsx scripts/verify-r2-domain.ts" -ForegroundColor Gray
    
    exit 1
} elseif ($warningCount -gt 0) {
    Write-Host "⚠ 發現警告，但系統應該能正常運行" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "🎉 所有 R2 配置一致性檢查通過！" -ForegroundColor Green
    Write-Host ""
    Write-Host "您的 R2 配置已正確設置:" -ForegroundColor Cyan
    Write-Host "• 開發環境: multi-channel-platform-attachments-develop" -ForegroundColor White
    Write-Host "• 生產環境: multi-channel-platform-attachments-production" -ForegroundColor White
    Write-Host ""
    Write-Host "可以安全地進行部署了！" -ForegroundColor Green
    exit 0
}