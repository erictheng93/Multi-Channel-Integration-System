# 延遲發送訊息功能指南

## 功能概述

延遲發送訊息功能允許用戶設定 1-120 秒的延遲時間，在指定時間後自動發送訊息。在延遲期間，用戶可以撤回尚未發送的訊息。

## 核心特性

- ⏰ **靈活延遲時間**: 支援 1-120 秒的延遲設定
- 🔄 **撤回機制**: 在發送前可以撤回訊息
- 📱 **多平台支援**: 支援 LINE 和 Facebook Messenger
- 🎯 **即時狀態更新**: 實時顯示倒數計時和發送狀態
- 📊 **完整記錄**: 記錄所有延遲發送和撤回操作

## 技術架構

### 後端架構
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Handler   │───▶│  Cloudflare KV   │    │ Cloudflare D1   │
│                 │    │  (撤回標記)      │    │ (訊息記錄)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Cloudflare      │───▶│  Queue Consumer  │───▶│  Platform API   │
│ Queue           │    │  (延遲處理)      │    │  (LINE/FB)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 前端架構
```
┌─────────────────┐    ┌──────────────────┐
│ DelayedMessage  │───▶│  useDelayedMsg   │
│ Sender.vue      │    │  Composable      │
└─────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   UI 元件       │    │   API Client     │
│ (輸入/倒數)     │    │  (HTTP 請求)     │
└─────────────────┘    └──────────────────┘
```

## 資料庫結構

### pending_messages 表
```sql
CREATE TABLE pending_messages (
    id TEXT PRIMARY KEY,                    -- 訊息 UUID
    conversation_id INTEGER NOT NULL,       -- 對話 ID
    sender_id INTEGER NOT NULL,             -- 發送者 ID
    content TEXT NOT NULL,                  -- 訊息內容
    message_type TEXT DEFAULT 'text',       -- 訊息類型
    recipient_platform_id TEXT NOT NULL,    -- 接收者平台 ID
    platform TEXT NOT NULL,                -- 平台 (line/facebook)
    delay_seconds INTEGER DEFAULT 0,        -- 延遲秒數
    scheduled_send_time TEXT NOT NULL,      -- 預定發送時間
    recall_deadline TEXT,                   -- 撤回截止時間
    status TEXT DEFAULT 'pending',          -- 狀態
    metadata TEXT,                          -- 額外資訊 (JSON)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT,
    cancelled_at TEXT
);
```

### message_recall_logs 表
```sql
CREATE TABLE message_recall_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,               -- 訊息 ID
    user_id INTEGER NOT NULL,               -- 操作用戶 ID
    action TEXT NOT NULL,                   -- 操作類型
    reason TEXT,                            -- 操作原因
    created_at TEXT DEFAULT (datetime('now'))
);
```

## API 端點

### 1. 發送延遲訊息
```http
POST /api/messages/delayed/send
Content-Type: application/json
Authorization: Bearer <token>

{
  "conversationId": 123,
  "content": "這是延遲發送的訊息",
  "delaySeconds": 30,
  "messageType": "text"
}
```

**回應:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid-here",
    "canRecall": true,
    "recallDeadline": "2024-01-01T12:00:30Z",
    "delaySeconds": 30,
    "scheduledSendTime": "2024-01-01T12:00:30Z"
  }
}
```

### 2. 撤回延遲訊息
```http
POST /api/messages/delayed/recall
Content-Type: application/json
Authorization: Bearer <token>

{
  "messageId": "uuid-here"
}
```

**回應:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid-here",
    "recalled": true,
    "recalledAt": "2024-01-01T12:00:15Z"
  }
}
```

### 3. 獲取待發送訊息列表
```http
GET /api/messages/delayed/list?status=pending&page=1&pageSize=20
Authorization: Bearer <token>
```

**回應:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-here",
        "conversationId": 123,
        "customerName": "客戶名稱",
        "content": "訊息內容",
        "delaySeconds": 30,
        "scheduledSendTime": "2024-01-01T12:00:30Z",
        "canRecall": true,
        "status": "pending"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

## 前端使用方式

### 1. 引入元件
```vue
<template>
  <div class="conversation-detail">
    <!-- 其他內容 -->
    
    <DelayedMessageSender
      :conversation-id="conversationId"
      @message-sent="handleMessageSent"
      @message-recalled="handleMessageRecalled"
    />
  </div>
</template>

<script setup lang="ts">
import DelayedMessageSender from '@/components/DelayedMessageSender.vue'

const handleMessageSent = (message: any) => {
  console.log('訊息已發送:', message)
  // 重新載入對話訊息
}

const handleMessageRecalled = (messageId: string) => {
  console.log('訊息已撤回:', messageId)
  // 更新 UI 狀態
}
</script>
```

### 2. 使用組合式函數
```typescript
import { useDelayedMessage } from '../composables/useDelayedMessage'

const {
  sendDelayedMessage,
  recallMessage,
  getPendingMessages,
  pendingMessages,
  isLoading
} = useDelayedMessage()

// 發送延遲訊息
const sendMessage = async () => {
  const result = await sendDelayedMessage({
    conversationId: 123,
    content: '測試訊息',
    delaySeconds: 15
  })
  
  if (result.success) {
    console.log('延遲訊息已排程')
  }
}

// 撤回訊息
const recall = async (messageId: string) => {
  const result = await recallMessage(messageId)
  
  if (result.success) {
    console.log('訊息已撤回')
  }
}
```

## 部署設置

### 1. 執行設置腳本
```powershell
# 執行自動設置腳本
.\scripts\setup-delayed-messaging.ps1
```

### 2. 手動設置步驟

#### 資料庫遷移
```bash
npx wrangler d1 execute multi-channel-platform --file=database/migrations/001_add_delayed_messages.sql
```

#### 創建 KV 命名空間
```bash
npx wrangler kv:namespace create "multi-channel-platform-kv"
npx wrangler kv:namespace create "multi-channel-platform-kv" --preview
```

#### 創建 Queue
```bash
npx wrangler queues create delayed-messages
```

#### 部署 Worker
```bash
npx wrangler deploy --config wrangler-delayed-message.toml
```

### 3. 更新 wrangler.toml
```toml
[[kv_namespaces]]
binding = "KV"
id = "your-actual-kv-id"
preview_id = "your-actual-preview-kv-id"

[[queues]]
binding = "MESSAGE_QUEUE"
queue = "delayed-messages"
```

## 測試方式

### 1. 單元測試
```typescript
// 測試延遲發送
describe('Delayed Message', () => {
  test('should schedule delayed message', async () => {
    const result = await sendDelayedMessage({
      conversationId: 1,
      content: 'Test message',
      delaySeconds: 10
    })
    
    expect(result.success).toBe(true)
    expect(result.data?.canRecall).toBe(true)
  })
  
  test('should recall pending message', async () => {
    const result = await recallMessage('test-message-id')
    
    expect(result.success).toBe(true)
    expect(result.data?.recalled).toBe(true)
  })
})
```

### 2. 整合測試
```javascript
// 測試完整流程
const testDelayedFlow = async () => {
  // 1. 發送延遲訊息
  const sendResult = await fetch('/api/messages/delayed/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      conversationId: 1,
      content: '測試延遲訊息',
      delaySeconds: 5
    })
  })
  
  const sendData = await sendResult.json()
  console.log('發送結果:', sendData)
  
  // 2. 等待 2 秒後撤回
  setTimeout(async () => {
    const recallResult = await fetch('/api/messages/delayed/recall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        messageId: sendData.data.messageId
      })
    })
    
    const recallData = await recallResult.json()
    console.log('撤回結果:', recallData)
  }, 2000)
}
```

## 監控和日誌

### 1. Cloudflare Dashboard
- 監控 Queue 處理狀態
- 查看 KV 存儲使用量
- 檢查 Worker 執行日誌

### 2. 資料庫查詢
```sql
-- 查看待發送訊息統計
SELECT status, COUNT(*) as count 
FROM pending_messages 
GROUP BY status;

-- 查看撤回操作記錄
SELECT action, COUNT(*) as count 
FROM message_recall_logs 
WHERE created_at >= datetime('now', '-1 day')
GROUP BY action;
```

### 3. 錯誤處理
- Queue 重試機制：最多 3 次重試
- 失敗訊息記錄到 dead letter queue
- 詳細錯誤日誌記錄到資料庫

## 最佳實踐

### 1. 效能優化
- 使用批次處理減少 API 調用
- 適當設置 Queue 批次大小
- 定期清理過期的 KV 記錄

### 2. 安全考量
- 驗證用戶權限
- 限制延遲時間範圍
- 記錄所有操作日誌

### 3. 用戶體驗
- 提供即時倒數計時
- 清楚的狀態指示
- 友好的錯誤提示

## 故障排除

### 常見問題

1. **訊息未按時發送**
   - 檢查 Queue Consumer 是否正常運行
   - 確認 KV 中沒有撤回標記
   - 查看 Worker 執行日誌

2. **撤回功能無效**
   - 確認在撤回期限內
   - 檢查 KV 寫入權限
   - 驗證訊息狀態

3. **前端倒數計時不準確**
   - 檢查系統時間同步
   - 確認定時器正常運行
   - 驗證 API 回應時間格式

### 調試工具
```bash
# 查看 Queue 狀態
npx wrangler queues list

# 檢查 KV 內容
npx wrangler kv:key list --binding=KV

# 查看 Worker 日誌
npx wrangler tail
```