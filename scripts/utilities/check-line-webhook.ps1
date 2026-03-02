# LINE Webhook 檢查?�本

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    LINE Webhook ?��?檢查工具" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 檢查 webhook endpoint ?�否?�訪??
Write-Host "[1] 檢查 Webhook Endpoint..." -ForegroundColor Yellow
$webhookUrl = "https://mcis-backend.daiwandist.com/api/webhook"
try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"test":"ping"}' -UseBasicParsing -ErrorAction Stop
    Write-Host "    ??Webhook endpoint ?�訪?? -ForegroundColor Green
    Write-Host "    Response Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "    ??Webhook endpoint ?��?訪�?" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""

# 2. 檢查後端?��?
Write-Host "[2] ?��?後端?��?..." -ForegroundColor Yellow
Write-Host "    ?��?以�??�令?��?實�??��?�? -ForegroundColor Cyan
Write-Host "    wrangler tail --format pretty" -ForegroundColor White
Write-Host ""
Write-Host "    請在?��??��?端執行�?述命令�??��?�?LINE ?�送測試�??? -ForegroundColor Gray
Write-Host ""

# 3. 檢查?��?變數
Write-Host "[3] 檢查?��?變數?�置..." -ForegroundColor Yellow
Write-Host "    請確�?wrangler.toml ?�含以�?設�?�? -ForegroundColor Cyan
Write-Host @"
    [vars]
    LINE_CHANNEL_SECRET = "你�?_channel_secret"
    LINE_CHANNEL_ACCESS_TOKEN = "你�?_access_token"
"@ -ForegroundColor White
Write-Host ""

# 4. 檢查?��?�?
Write-Host "[4] 檢查 D1 ?��?�?.." -ForegroundColor Yellow
Write-Host "    ?��?以�??�令?��??�近�?訊息�? -ForegroundColor Cyan
Write-Host '    wrangler d1 execute mcis-db --command "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5"' -ForegroundColor White
Write-Host ""

# 5. LINE 官方驗�?
Write-Host "[5] LINE 官方驗�?..." -ForegroundColor Yellow
Write-Host "    1. ?�入 LINE Developers Console" -ForegroundColor Cyan
Write-Host "    2. ?�入你�? Messaging API Channel" -ForegroundColor Cyan
Write-Host "    3. ??Messaging API 標籤?�到 Webhook settings" -ForegroundColor Cyan
Write-Host "    4. 確�? Webhook URL ?��?$webhookUrl" -ForegroundColor Cyan
Write-Host "    5. 點�? 'Verify' ?��?測試??��" -ForegroundColor Cyan
Write-Host ""

# 6. 測試簽�?驗�?
Write-Host "[6] ?�建測試?�本..." -ForegroundColor Yellow
$testScript = @'
const crypto = require('crypto');

// 請填?��??�實??channel secret
const CHANNEL_SECRET = 'YOUR_CHANNEL_SECRET_HERE';
const WEBHOOK_URL = 'https://mcis-backend.daiwandist.com/api/webhook';

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
Write-Host "    ??測試?�本已創�? test-line-signature.js" -ForegroundColor Green
Write-Host "    請修??CHANNEL_SECRET ?��??��?：node test-line-signature.js" -ForegroundColor Cyan
Write-Host ""

# 7. ?��?診斷建議
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    ?��?診斷建議" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "如�?訊息沒�?存儲?�數?�庫，可?��??��?�? -ForegroundColor Yellow
Write-Host ""
Write-Host "1. LINE Webhook URL 設�??�誤" -ForegroundColor White
Write-Host "   ??檢查 LINE Developers Console ??Webhook URL" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 簽�?驗�?失�?" -ForegroundColor White
Write-Host "   ??確�? LINE_CHANNEL_SECRET �?��?�誤" -ForegroundColor Gray
Write-Host "   ??檢查 wrangler tail ?��??�否顯示 'Invalid signature'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 後端?�本沒收?��?�? -ForegroundColor White
Write-Host "   ??使用 wrangler tail 確�??�否?�日誌輸?? -ForegroundColor Gray
Write-Host "   ????LINE Console 使用 Verify ?��?測試" -ForegroundColor Gray
Write-Host ""
Write-Host "4. 路由?��??�錯�? -ForegroundColor White
Write-Host "   ??檢查 src/index.ts ?�否�?��導入 webhookHandler" -ForegroundColor Gray
Write-Host "   ??確�?路由路�???/api/webhook" -ForegroundColor Gray
Write-Host ""
Write-Host "5. ?��?庫寫?�失?? -ForegroundColor White
Write-Host "   ??檢查 D1 ?��?庫�?定是?�正�? -ForegroundColor Gray
Write-Host "   ???��??�誤?��?中�??��?庫錯�? -ForegroundColor Gray
Write-Host ""

Write-Host "?�任?�鍵?�??.." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")