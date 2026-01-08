# ä¸€?µç’°å¢ƒè??¸è¨­å®šè…³??
# ?™å€‹è…³?¬æ??ªå??Ÿæ??€?‰å?è¦ç??°å?è®Šæ•¸æª”æ?

param(
    [string]$Environment = "development",
    [switch]$Force = $false
)

Write-Host "?? ?‹å?è¨­å??°å?è®Šæ•¸..." -ForegroundColor Green

# æª¢æŸ¥?¯å¦å·²å??¨ç’°å¢ƒè??¸æ?æ¡?
$rootEnvFile = ".env"
$frontendEnvFile = "frontend\.env.local"

if ((Test-Path $rootEnvFile) -and !$Force) {
    Write-Host "? ï?  ?¹ç›®??.env å·²å??¨ï?ä½¿ç”¨ -Force ?ƒæ•¸è¦†è?" -ForegroundColor Yellow
} else {
    Write-Host "?? å»ºç??¹ç›®??.env æª”æ?..." -ForegroundColor Cyan
    
    # ?Ÿæ??¨æ? JWT Secret
    $jwtSecret = [System.Web.Security.Membership]::GeneratePassword(64, 0)
    
    # ?Ÿæ??¨æ? Facebook Verify Token
    $fbVerifyToken = [System.Web.Security.Membership]::GeneratePassword(32, 0)
    
    $rootEnvContent = @"
# å¤šé »?“å®¢?ç³»çµ?- å¾Œç«¯?°å?è®Šæ•¸
# ?ªå??Ÿæ???$(Get-Date)

# JWT å¯†é‘° (?ªå??Ÿæ?)
JWT_SECRET=$jwtSecret

# LINE Bot ?ç½® (è«‹å¡«?¥å¯¦?›å€?
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# Facebook Messenger ?ç½® (è«‹å¡«?¥å¯¦?›å€?
FACEBOOK_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_VERIFY_TOKEN=$fbVerifyToken

# Cloudflare R2 ?ç½®
# ?Ÿç”¢?°å?: https://your-storage-domain.example.com
R2_PUBLIC_URL=https://your-storage-domain.example.com
R2_ACCOUNT_ID=your-cloudflare-account-id

# æª”æ?ä¸Šå‚³?ç½®
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# è³‡æ?åº«é?ç½?
DATABASE_URL=your-d1-database-url

# ?‰ç”¨ç¨‹å??ç½®
ENVIRONMENT=$Environment
APP_URL=http://localhost:8787
FRONTEND_URL=http://localhost:5173
"@
    
    $rootEnvContent | Out-File -FilePath $rootEnvFile -Encoding UTF8
    Write-Host "???¹ç›®??.env æª”æ?å·²å»ºç«? -ForegroundColor Green
}

if ((Test-Path $frontendEnvFile) -and !$Force) {
    Write-Host "? ï?  ?ç«¯ .env.local å·²å??¨ï?ä½¿ç”¨ -Force ?ƒæ•¸è¦†è?" -ForegroundColor Yellow
} else {
    Write-Host "?? å»ºç??ç«¯ .env.local æª”æ?..." -ForegroundColor Cyan
    
    # ?Ÿæ?? å?å¯†é‘°
    $encryptionKey = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)})
    
    $frontendEnvContent = @"
# å¤šé »?“å®¢?ç³»çµ?- ?ç«¯?°å?è®Šæ•¸
# ?ªå??Ÿæ???$(Get-Date)

# å®‰å…¨?ç½® (?ªå??Ÿæ? 64 å­—å?? å?å¯†é‘°)
VITE_ENCRYPTION_KEY=$encryptionKey

# API ?ç½®
VITE_API_BASE_URL=http://localhost:8787

# ?‹ç™¼?ç½®
VITE_DEV_MODE=true

# ?Ÿèƒ½?‹é?
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false

# ç¬¬ä??¹æ•´??(?¯é¸)
# VITE_ANALYTICS_ID=
# VITE_ERROR_REPORTING_DSN=
"@
    
    $frontendEnvContent | Out-File -FilePath $frontendEnvFile -Encoding UTF8
    Write-Host "???ç«¯ .env.local æª”æ?å·²å»ºç«? -ForegroundColor Green
}

# å»ºç?å¿«é€Ÿé?ç½®æ???
$configGuide = @"
# ?¯ å¿«é€Ÿé?ç½®æ???

## å¿…è??ç½®?…ç›® (?€è¦æ??•å¡«??

### LINE Bot è¨­å?
1. ?å? LINE Developers Console: https://developers.line.biz/
2. ?–å? Channel Access Token ??Channel Secret
3. ?´æ–° .env æª”æ?ä¸­ç?å°æ???

### Facebook Messenger è¨­å? (?¯é¸)
1. ?å? Facebook for Developers: https://developers.facebook.com/
2. å»ºç??‰ç”¨ç¨‹å?ä¸¦è¨­å®?Messenger
3. ?´æ–° .env æª”æ?ä¸­ç?å°æ???

### Cloudflare è¨­å?
1. ?»å…¥ Cloudflare Dashboard
2. è¨­å? R2 å­˜å„²ä¸¦å?å¾—å¸³??ID
3. ?´æ–° .env æª”æ?ä¸­ç?å°æ???

## å·²è‡ª?•é?ç½®é?????
- JWT Secret (å·²ç??éš¨æ©Ÿå???
- Frontend ? å?å¯†é‘° (å·²ç???
- Facebook Verify Token (å·²ç???
- ?ºæœ¬?‰ç”¨ç¨‹å??ç½®

## ä¸‹ä?æ­?
1. ?·è?: .\database\init-database.ps1
2. ?·è?: .\start-dev.ps1
3. ?‹å??‹ç™¼ï¼?
"@

$configGuide | Out-File -FilePath "ENV-SETUP-GUIDE.md" -Encoding UTF8

Write-Host ""
Write-Host "?? ?°å?è®Šæ•¸è¨­å?å®Œæ?ï¼? -ForegroundColor Green
Write-Host "?? è«‹æŸ¥??ENV-SETUP-GUIDE.md äº†è§£ä¸‹ä?æ­¥é?ç½? -ForegroundColor Cyan
Write-Host ""
Write-Host "å·²å»ºç«‹ç?æª”æ?:" -ForegroundColor White
Write-Host "  ??.env (å¾Œç«¯?°å?è®Šæ•¸)" -ForegroundColor Green
Write-Host "  ??frontend\.env.local (?ç«¯?°å?è®Šæ•¸)" -ForegroundColor Green
Write-Host "  ??ENV-SETUP-GUIDE.md (?ç½®?‡å?)" -ForegroundColor Green
Write-Host ""
Write-Host "?’¡ ?ç¤º: ä½¿ç”¨ -Force ?ƒæ•¸?¯ä»¥è¦†è??¾æ?æª”æ?" -ForegroundColor Yellow