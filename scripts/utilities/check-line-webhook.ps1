# LINE Webhook æª¢æŸ¥?³æœ¬

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    LINE Webhook ?´å?æª¢æŸ¥å·¥å…·" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. æª¢æŸ¥ webhook endpoint ?¯å¦?¯è¨ª??
Write-Host "[1] æª¢æŸ¥ Webhook Endpoint..." -ForegroundColor Yellow
$webhookUrl = "https://your-api-domain.example.com/api/webhook"
try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"test":"ping"}' -UseBasicParsing -ErrorAction Stop
    Write-Host "    ??Webhook endpoint ?¯è¨ª?? -ForegroundColor Green
    Write-Host "    Response Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "    ??Webhook endpoint ?¡æ?è¨ªå?" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""

# 2. æª¢æŸ¥å¾Œç«¯?¥è?
Write-Host "[2] ?¥ç?å¾Œç«¯?¥è?..." -ForegroundColor Yellow
Write-Host "    ?·è?ä»¥ä??½ä»¤?¥ç?å¯¦æ??¥è?ï¼? -ForegroundColor Cyan
Write-Host "    wrangler tail --format pretty" -ForegroundColor White
Write-Host ""
Write-Host "    è«‹åœ¨?¦ä??‹ç?ç«¯åŸ·è¡Œä?è¿°å‘½ä»¤ï??¶å?å¾?LINE ?¼é€æ¸¬è©¦è??? -ForegroundColor Gray
Write-Host ""

# 3. æª¢æŸ¥?°å?è®Šæ•¸
Write-Host "[3] æª¢æŸ¥?°å?è®Šæ•¸?ç½®..." -ForegroundColor Yellow
Write-Host "    è«‹ç¢ºèª?wrangler.toml ?…å«ä»¥ä?è¨­å?ï¼? -ForegroundColor Cyan
Write-Host @"
    [vars]
    LINE_CHANNEL_SECRET = "ä½ ç?_channel_secret"
    LINE_CHANNEL_ACCESS_TOKEN = "ä½ ç?_access_token"
"@ -ForegroundColor White
Write-Host ""

# 4. æª¢æŸ¥?¸æ?åº?
Write-Host "[4] æª¢æŸ¥ D1 ?¸æ?åº?.." -ForegroundColor Yellow
Write-Host "    ?·è?ä»¥ä??½ä»¤?¥ç??€è¿‘ç?è¨Šæ¯ï¼? -ForegroundColor Cyan
Write-Host '    wrangler d1 execute multi-channel-platform --command "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5"' -ForegroundColor White
Write-Host ""

# 5. LINE å®˜æ–¹é©—è?
Write-Host "[5] LINE å®˜æ–¹é©—è?..." -ForegroundColor Yellow
Write-Host "    1. ?»å…¥ LINE Developers Console" -ForegroundColor Cyan
Write-Host "    2. ?²å…¥ä½ ç? Messaging API Channel" -ForegroundColor Cyan
Write-Host "    3. ??Messaging API æ¨™ç±¤?¾åˆ° Webhook settings" -ForegroundColor Cyan
Write-Host "    4. ç¢ºè? Webhook URL ?ºï?$webhookUrl" -ForegroundColor Cyan
Write-Host "    5. é»æ? 'Verify' ?‰é?æ¸¬è©¦??¥" -ForegroundColor Cyan
Write-Host ""

# 6. æ¸¬è©¦ç°½å?é©—è?
Write-Host "[6] ?µå»ºæ¸¬è©¦?³æœ¬..." -ForegroundColor Yellow
$testScript = @'
const crypto = require('crypto');

// è«‹å¡«?¥ä??„å¯¦??channel secret
const CHANNEL_SECRET = 'YOUR_CHANNEL_SECRET_HERE';
const WEBHOOK_URL = 'https://your-api-domain.example.com/api/webhook';

function generateSignature(body, secret) {
  const hmac = crypto.createHmac('SHA256', secret);
  hmac.update(body);
  return hmac.digest('base64');
}

async function test() {
  const body = JSON.stringify({
    destination: 'U1234567890',
    events: [{
      type: 'message',
      timestamp: Date.now(),
      source: { type: 'user', userId: 'Utest' },
      replyToken: 'test-token',
      message: { type: 'text', id: 'msg1', text: 'Test message' }
    }]
  });

  const signature = generateSignature(body, CHANNEL_SECRET);

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Line-Signature': signature
    },
    body: body
  });

  console.log('Response:', response.status, await response.text());
}

test().catch(console.error);
'@

$testScript | Out-File -FilePath "test-line-signature.js" -Encoding UTF8
Write-Host "    ??æ¸¬è©¦?³æœ¬å·²å‰µå»? test-line-signature.js" -ForegroundColor Green
Write-Host "    è«‹ä¿®??CHANNEL_SECRET ?¶å??·è?ï¼šnode test-line-signature.js" -ForegroundColor Cyan
Write-Host ""

# 7. ?é?è¨ºæ–·å»ºè­°
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    ?é?è¨ºæ–·å»ºè­°" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "å¦‚æ?è¨Šæ¯æ²’æ?å­˜å„²?°æ•¸?šåº«ï¼Œå¯?½ç??Ÿå?ï¼? -ForegroundColor Yellow
Write-Host ""
Write-Host "1. LINE Webhook URL è¨­å??¯èª¤" -ForegroundColor White
Write-Host "   ??æª¢æŸ¥ LINE Developers Console ??Webhook URL" -ForegroundColor Gray
Write-Host ""
Write-Host "2. ç°½å?é©—è?å¤±æ?" -ForegroundColor White
Write-Host "   ??ç¢ºè? LINE_CHANNEL_SECRET æ­?¢º?¡èª¤" -ForegroundColor Gray
Write-Host "   ??æª¢æŸ¥ wrangler tail ?¥è??¯å¦é¡¯ç¤º 'Invalid signature'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. å¾Œç«¯?¹æœ¬æ²’æ”¶?°è?æ±? -ForegroundColor White
Write-Host "   ??ä½¿ç”¨ wrangler tail ç¢ºè??¯å¦?‰æ—¥èªŒè¼¸?? -ForegroundColor Gray
Write-Host "   ????LINE Console ä½¿ç”¨ Verify ?‰é?æ¸¬è©¦" -ForegroundColor Gray
Write-Host ""
Write-Host "4. è·¯ç”±?•ç??¨éŒ¯èª? -ForegroundColor White
Write-Host "   ??æª¢æŸ¥ src/index.ts ?¯å¦æ­?¢ºå°å…¥ webhookHandler" -ForegroundColor Gray
Write-Host "   ??ç¢ºè?è·¯ç”±è·¯å???/api/webhook" -ForegroundColor Gray
Write-Host ""
Write-Host "5. ?¸æ?åº«å¯«?¥å¤±?? -ForegroundColor White
Write-Host "   ??æª¢æŸ¥ D1 ?¸æ?åº«ç?å®šæ˜¯?¦æ­£ç¢? -ForegroundColor Gray
Write-Host "   ???¥ç??¯èª¤?¥è?ä¸­ç??¸æ?åº«éŒ¯èª? -ForegroundColor Gray
Write-Host ""

Write-Host "?‰ä»»?éµ?€??.." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")