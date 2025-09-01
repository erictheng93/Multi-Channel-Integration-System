# LINE Webhook 除錯指南

## 1. 檢查 LINE OA 設定

### 在 LINE Developers Console 確認：
```
Webhook URL: https://multi-channel.imfinethankyouandyou.com/api/webhook
Use webhook: 啟用
Webhook redelivery: 啟用（用於重試失敗的請求）
```

### 驗證 Webhook URL 可訪問性：
```bash
# 測試 webhook endpoint 是否存在
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'
```

## 2. 檢查 Cloudflare Workers 日誌

### 實時查看日誌：
```bash
# 在專案根目錄執行
wrangler tail --format pretty

# 然後從 LINE 發送測試訊息，觀察日誌輸出
```

### 應該看到的日誌：
- `Received webhook: {...}` - 表示收到請求
- `處理來自用戶 ... 的訊息` - 表示開始處理
- `客戶處理完成` - 表示客戶資料已處理
- `對話處理完成` - 表示對話已創建/更新
- `傳入訊息已儲存` - 表示訊息已寫入 D1

## 3. 檢查環境變數

### 在 wrangler.toml 確認：
```toml
[vars]
LINE_CHANNEL_SECRET = "你的實際 channel secret"
LINE_CHANNEL_ACCESS_TOKEN = "你的實際 access token"
```

### 驗證環境變數：
```bash
# 檢查部署的環境變數
wrangler secret list
```

## 4. 測試簽名驗證

### 使用 LINE 官方驗證工具：
在 LINE Developers Console 的 Webhook 頁面，點擊 "Verify" 按鈕

### 檢查簽名驗證失敗的日誌：
```
Invalid LINE signature
```

## 5. 直接檢查 D1 數據庫

### 查看訊息表：
```sql
-- 使用 wrangler d1 執行
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
```

### 查看客戶表：
```sql
SELECT * FROM customers WHERE platform = 'line' ORDER BY created_at DESC LIMIT 10;
```

### 查看對話表：
```sql
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 10;
```

## 6. 常見問題排查

### 問題 1: Webhook URL 未正確設定
**症狀**: Workers 日誌完全沒有任何輸出
**解決**: 在 LINE Developers Console 更新 Webhook URL

### 問題 2: 簽名驗證失敗
**症狀**: 日誌顯示 "Invalid LINE signature"
**解決**: 
- 確認 LINE_CHANNEL_SECRET 正確
- 確認沒有多餘的空格或換行

### 問題 3: 數據庫寫入失敗
**症狀**: 日誌顯示錯誤但沒有 "訊息已儲存"
**解決**: 檢查數據庫 schema 和權限

### 問題 4: 路由不匹配
**症狀**: 收到請求但返回 404
**解決**: 確認路由路徑正確

## 7. 測試腳本

創建測試文件 `test-webhook-direct.js`:
```javascript
const crypto = require('crypto');

// 配置
const WEBHOOK_URL = 'https://multi-channel.imfinethankyouandyou.com/api/webhook';
const CHANNEL_SECRET = '你的 channel secret'; // 從 LINE Developers Console 獲取

// 生成簽名
function generateSignature(body, secret) {
  const hmac = crypto.createHmac('SHA256', secret);
  hmac.update(body);
  return hmac.digest('base64');
}

// 測試 webhook
async function testWebhook() {
  const body = JSON.stringify({
    destination: 'Uxxxxxxxxxx',
    events: [{
      type: 'message',
      timestamp: Date.now(),
      source: { type: 'user', userId: 'Utest123' },
      replyToken: 'test-reply-token',
      message: { type: 'text', id: 'msg123', text: '測試訊息' }
    }]
  });

  const signature = generateSignature(body, CHANNEL_SECRET);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      body: body
    });

    console.log('Status:', response.status);
    console.log('Response:', await response.text());
  } catch (error) {
    console.error('Error:', error);
  }
}

testWebhook();
```

## 8. 逐步除錯流程

1. **先確認 webhook 能收到請求**
   ```bash
   wrangler tail --format pretty
   # 從 LINE 發送訊息，看是否有日誌
   ```

2. **如果沒有日誌，檢查 LINE 設定**
   - 登入 LINE Developers Console
   - 檢查 Webhook URL
   - 點擊 "Verify" 測試連接

3. **如果有日誌但顯示錯誤**
   - 查看具體錯誤訊息
   - 檢查環境變數
   - 確認簽名驗證

4. **如果處理成功但數據庫沒有資料**
   - 直接查詢 D1 數據庫
   - 檢查數據庫連接
   - 查看寫入權限

## 9. 緊急修復命令

### 重新部署後端：
```bash
npm run deploy
```

### 查看部署狀態：
```bash
wrangler deployments list
```

### 回滾到上一版本（如果需要）：
```bash
wrangler rollback
```

## 10. 聯繫支援

如果以上步驟都無法解決，請收集以下資訊：
1. `wrangler tail` 的完整日誌
2. LINE Developers Console 的 Webhook 設定截圖
3. `wrangler.toml` 的配置（隱藏敏感資訊）
4. D1 數據庫查詢結果