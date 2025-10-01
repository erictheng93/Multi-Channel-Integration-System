# LINE Webhook 檢查腳本

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    LINE Webhook 整合檢查工具" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 檢查 webhook endpoint 是否可訪問
Write-Host "[1] 檢查 Webhook Endpoint..." -ForegroundColor Yellow
$webhookUrl = "https://multi-channel.imfinethankyouandyou.com/api/webhook"
try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"test":"ping"}' -UseBasicParsing -ErrorAction Stop
    Write-Host "    ✓ Webhook endpoint 可訪問" -ForegroundColor Green
    Write-Host "    Response Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "    ✗ Webhook endpoint 無法訪問" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""

# 2. 檢查後端日誌
Write-Host "[2] 查看後端日誌..." -ForegroundColor Yellow
Write-Host "    執行以下命令查看實時日誌：" -ForegroundColor Cyan
Write-Host "    wrangler tail --format pretty" -ForegroundColor White
Write-Host ""
Write-Host "    請在另一個終端執行上述命令，然後從 LINE 發送測試訊息" -ForegroundColor Gray
Write-Host ""

# 3. 檢查環境變數
Write-Host "[3] 檢查環境變數配置..." -ForegroundColor Yellow
Write-Host "    請確認 wrangler.toml 包含以下設定：" -ForegroundColor Cyan
Write-Host @"
    [vars]
    LINE_CHANNEL_SECRET = "你的_channel_secret"
    LINE_CHANNEL_ACCESS_TOKEN = "你的_access_token"
"@ -ForegroundColor White
Write-Host ""

# 4. 檢查數據庫
Write-Host "[4] 檢查 D1 數據庫..." -ForegroundColor Yellow
Write-Host "    執行以下命令查看最近的訊息：" -ForegroundColor Cyan
Write-Host '    wrangler d1 execute multi-channel-platform --command "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5"' -ForegroundColor White
Write-Host ""

# 5. LINE 官方驗證
Write-Host "[5] LINE 官方驗證..." -ForegroundColor Yellow
Write-Host "    1. 登入 LINE Developers Console" -ForegroundColor Cyan
Write-Host "    2. 進入你的 Messaging API Channel" -ForegroundColor Cyan
Write-Host "    3. 在 Messaging API 標籤找到 Webhook settings" -ForegroundColor Cyan
Write-Host "    4. 確認 Webhook URL 為：$webhookUrl" -ForegroundColor Cyan
Write-Host "    5. 點擊 'Verify' 按鈕測試連接" -ForegroundColor Cyan
Write-Host ""

# 6. 測試簽名驗證
Write-Host "[6] 創建測試腳本..." -ForegroundColor Yellow
$testScript = @'
const crypto = require('crypto');

// 請填入你的實際 channel secret
const CHANNEL_SECRET = 'YOUR_CHANNEL_SECRET_HERE';
const WEBHOOK_URL = 'https://multi-channel.imfinethankyouandyou.com/api/webhook';

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
Write-Host "    ✓ 測試腳本已創建: test-line-signature.js" -ForegroundColor Green
Write-Host "    請修改 CHANNEL_SECRET 然後執行：node test-line-signature.js" -ForegroundColor Cyan
Write-Host ""

# 7. 問題診斷建議
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    問題診斷建議" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果訊息沒有存儲到數據庫，可能的原因：" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. LINE Webhook URL 設定錯誤" -ForegroundColor White
Write-Host "   → 檢查 LINE Developers Console 的 Webhook URL" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 簽名驗證失敗" -ForegroundColor White
Write-Host "   → 確認 LINE_CHANNEL_SECRET 正確無誤" -ForegroundColor Gray
Write-Host "   → 檢查 wrangler tail 日誌是否顯示 'Invalid signature'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 後端根本沒收到請求" -ForegroundColor White
Write-Host "   → 使用 wrangler tail 確認是否有日誌輸出" -ForegroundColor Gray
Write-Host "   → 在 LINE Console 使用 Verify 按鈕測試" -ForegroundColor Gray
Write-Host ""
Write-Host "4. 路由處理器錯誤" -ForegroundColor White
Write-Host "   → 檢查 src/index.ts 是否正確導入 webhookHandler" -ForegroundColor Gray
Write-Host "   → 確認路由路徑為 /api/webhook" -ForegroundColor Gray
Write-Host ""
Write-Host "5. 數據庫寫入失敗" -ForegroundColor White
Write-Host "   → 檢查 D1 數據庫綁定是否正確" -ForegroundColor Gray
Write-Host "   → 查看錯誤日誌中的數據庫錯誤" -ForegroundColor Gray
Write-Host ""

Write-Host "按任意鍵退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")