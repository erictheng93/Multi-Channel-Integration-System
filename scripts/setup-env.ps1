# 一鍵環境變數設定腳本
# 這個腳本會自動生成所有必要的環境變數檔案

param(
    [string]$Environment = "development",
    [switch]$Force = $false
)

Write-Host "🚀 開始設定環境變數..." -ForegroundColor Green

# 檢查是否已存在環境變數檔案
$rootEnvFile = ".env"
$frontendEnvFile = "frontend\.env.local"

if ((Test-Path $rootEnvFile) -and !$Force) {
    Write-Host "⚠️  根目錄 .env 已存在，使用 -Force 參數覆蓋" -ForegroundColor Yellow
} else {
    Write-Host "📝 建立根目錄 .env 檔案..." -ForegroundColor Cyan
    
    # 生成隨機 JWT Secret
    $jwtSecret = [System.Web.Security.Membership]::GeneratePassword(64, 0)
    
    # 生成隨機 Facebook Verify Token
    $fbVerifyToken = [System.Web.Security.Membership]::GeneratePassword(32, 0)
    
    $rootEnvContent = @"
# 多頻道客服系統 - 後端環境變數
# 自動生成於 $(Get-Date)

# JWT 密鑰 (自動生成)
JWT_SECRET=$jwtSecret

# LINE Bot 配置 (請填入實際值)
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# Facebook Messenger 配置 (請填入實際值)
FACEBOOK_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_VERIFY_TOKEN=$fbVerifyToken

# Cloudflare R2 配置
# 開發環境: https://s3dev.imfinethankyouandyou.com
# 生產環境: https://s3.imfinethankyouandyou.com
R2_PUBLIC_URL=https://s3dev.imfinethankyouandyou.com
R2_ACCOUNT_ID=your-cloudflare-account-id

# 檔案上傳配置
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# 資料庫配置
DATABASE_URL=your-d1-database-url

# 應用程式配置
ENVIRONMENT=$Environment
APP_URL=http://localhost:8787
FRONTEND_URL=http://localhost:5173
"@
    
    $rootEnvContent | Out-File -FilePath $rootEnvFile -Encoding UTF8
    Write-Host "✅ 根目錄 .env 檔案已建立" -ForegroundColor Green
}

if ((Test-Path $frontendEnvFile) -and !$Force) {
    Write-Host "⚠️  前端 .env.local 已存在，使用 -Force 參數覆蓋" -ForegroundColor Yellow
} else {
    Write-Host "📝 建立前端 .env.local 檔案..." -ForegroundColor Cyan
    
    # 生成加密密鑰
    $encryptionKey = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)})
    
    $frontendEnvContent = @"
# 多頻道客服系統 - 前端環境變數
# 自動生成於 $(Get-Date)

# 安全配置 (自動生成 64 字元加密密鑰)
VITE_ENCRYPTION_KEY=$encryptionKey

# API 配置
VITE_API_BASE_URL=http://localhost:8787

# 開發配置
VITE_DEV_MODE=true

# 功能開關
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false

# 第三方整合 (可選)
# VITE_ANALYTICS_ID=
# VITE_ERROR_REPORTING_DSN=
"@
    
    $frontendEnvContent | Out-File -FilePath $frontendEnvFile -Encoding UTF8
    Write-Host "✅ 前端 .env.local 檔案已建立" -ForegroundColor Green
}

# 建立快速配置指南
$configGuide = @"
# 🎯 快速配置指南

## 必要配置項目 (需要手動填入)

### LINE Bot 設定
1. 前往 LINE Developers Console: https://developers.line.biz/
2. 取得 Channel Access Token 和 Channel Secret
3. 更新 .env 檔案中的對應值

### Facebook Messenger 設定 (可選)
1. 前往 Facebook for Developers: https://developers.facebook.com/
2. 建立應用程式並設定 Messenger
3. 更新 .env 檔案中的對應值

### Cloudflare 設定
1. 登入 Cloudflare Dashboard
2. 設定 R2 存儲並取得帳號 ID
3. 更新 .env 檔案中的對應值

## 已自動配置項目 ✅
- JWT Secret (已生成隨機密鑰)
- Frontend 加密密鑰 (已生成)
- Facebook Verify Token (已生成)
- 基本應用程式配置

## 下一步
1. 執行: .\database\init-database.ps1
2. 執行: .\start-dev.ps1
3. 開始開發！
"@

$configGuide | Out-File -FilePath "ENV-SETUP-GUIDE.md" -Encoding UTF8

Write-Host ""
Write-Host "🎉 環境變數設定完成！" -ForegroundColor Green
Write-Host "📋 請查看 ENV-SETUP-GUIDE.md 了解下一步配置" -ForegroundColor Cyan
Write-Host ""
Write-Host "已建立的檔案:" -ForegroundColor White
Write-Host "  ✅ .env (後端環境變數)" -ForegroundColor Green
Write-Host "  ✅ frontend\.env.local (前端環境變數)" -ForegroundColor Green
Write-Host "  ✅ ENV-SETUP-GUIDE.md (配置指南)" -ForegroundColor Green
Write-Host ""
Write-Host "💡 提示: 使用 -Force 參數可以覆蓋現有檔案" -ForegroundColor Yellow