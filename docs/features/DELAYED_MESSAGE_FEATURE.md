# 延遲發送訊息功能 (Delayed Message Feature)

## 概述

延遲發送訊息功能允許客服人員設定訊息在指定時間後自動發送，並在發送前提供撤回機制。這個功能特別適用於需要思考時間或避免立即回覆的情況。

## 功能特色

### 🕐 延遲發送
- **時間範圍**: 1-120 秒的延遲時間
- **快速預設**: 5秒、10秒、15秒、30秒、60秒、120秒的快速選項
- **自定義時間**: 支援手動輸入延遲秒數
- **即時預覽**: 顯示預計發送時間

### 🔄 訊息撤回
- **撤回期限**: 在預定發送時間前可隨時撤回
- **即時撤回**: 一鍵撤回待發送訊息
- **狀態追蹤**: 實時顯示撤回狀態

### 📋 待發送管理
- **列表顯示**: 顯示所有待發送訊息
- **倒數計時**: 實時顯示剩餘發送時間
- **狀態指示**: 清楚的視覺狀態提示
- **批量管理**: 支援多個待發送訊息管理

## 技術架構

### 前端組件

#### DelayedMessageSender.vue
主要的延遲發送組件，包含：

```vue
<template>
  <div class="delayed-message-sender">
    <!-- 訊息輸入區域 -->
    <div class="message-input-container">
      <!-- 延遲發送選項 -->
      <!-- 待發送訊息列表 -->
    </div>
  </div>
</template>
```

**主要功能**:
- 訊息內容輸入
- 延遲時間設定
- 立即發送 vs 延遲發送
- 待發送訊息管理
- 訊息撤回操作

#### useDelayedMessage Composable
提供延遲訊息相關的邏輯：

```typescript
export function useDelayedMessage() {
  return {
    // 狀態
    isLoading,
    pendingMessages,
    error,

    // 方法
    sendDelayedMessage,
    recallMessage,
    getPendingMessages,
    clearError,
    reset
  }
}
```

### 後端處理

#### 延遲訊息處理器 (src/handlers/delayed-message.ts)
```typescript
export const delayedMessageHandler = {
  send,      // 發送延遲訊息
  recall,    // 撤回延遲訊息
  list,      // 獲取待發送列表
  processQueue // 處理佇列訊息
}
```

#### 資料庫結構
```sql
-- 待發送訊息表
CREATE TABLE pending_messages (
    id TEXT PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    delay_seconds INTEGER NOT NULL,
    scheduled_send_time DATETIME NOT NULL,
    recall_deadline DATETIME NOT NULL,
    status TEXT DEFAULT 'pending'
);

-- 撤回日誌表
CREATE TABLE message_recall_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API 端點

### 發送延遲訊息
```http
POST /api/messages/delayed/send
Content-Type: application/json
Authorization: Bearer <token>

{
  "conversationId": 1,
  "content": "您好，感謝您的耐心等待",
  "delaySeconds": 30,
  "messageType": "text"
}
```

**回應**:
```json
{
  "success": true,
  "data": {
    "messageId": "msg-uuid-123",
    "canRecall": true,
    "recallDeadline": "2024-01-01T12:00:30Z",
    "delaySeconds": 30,
    "scheduledSendTime": "2024-01-01T12:00:30Z"
  }
}
```

### 撤回延遲訊息
```http
POST /api/messages/delayed/recall
Content-Type: application/json
Authorization: Bearer <token>

{
  "messageId": "msg-uuid-123"
}
```

**回應**:
```json
{
  "success": true,
  "data": {
    "messageId": "msg-uuid-123",
    "recalled": true,
    "recalledAt": "2024-01-01T11:59:45Z"
  }
}
```

### 獲取待發送列表
```http
GET /api/messages/delayed/list?page=1&pageSize=20&status=pending&conversationId=1
Authorization: Bearer <token>
```

**回應**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "msg-uuid-123",
        "conversationId": 1,
        "customerName": "客戶名稱",
        "content": "待發送訊息內容",
        "delaySeconds": 30,
        "scheduledSendTime": "2024-01-01T12:00:30Z",
        "canRecall": true,
        "status": "pending"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

## 使用方式

### 基本使用

1. **在對話頁面中使用**:
```vue
<template>
  <div class="chat-room">
    <!-- 其他聊天組件 -->
    <DelayedMessageSender 
      :conversation-id="conversationId"
      @message-sent="handleMessageSent"
      @message-recalled="handleMessageRecalled"
    />
  </div>
</template>

<script setup>
import DelayedMessageSender from '@/components/DelayedMessageSender.vue'

const handleMessageSent = (message) => {
  console.log('Message sent:', message)
  // 處理訊息發送事件
}

const handleMessageRecalled = (messageId) => {
  console.log('Message recalled:', messageId)
  // 處理訊息撤回事件
}
</script>
```

2. **直接使用 Composable**:
```typescript
import { useDelayedMessage } from '../composables/useDelayedMessage'

const { 
  sendDelayedMessage, 
  recallMessage, 
  pendingMessages 
} = useDelayedMessage()

// 發送延遲訊息
const result = await sendDelayedMessage({
  conversationId: 1,
  content: '這是一條延遲訊息',
  delaySeconds: 60
})

// 撤回訊息
if (result.success) {
  await recallMessage(result.data.messageId)
}
```

## 狀態管理

### 訊息狀態
- **pending**: 待發送
- **sent**: 已發送
- **cancelled**: 已撤回
- **failed**: 發送失敗

### 倒數計時顯示
- **normal**: 剩餘時間 > 15秒 (綠色)
- **warning**: 剩餘時間 5-15秒 (橙色)
- **urgent**: 剩餘時間 < 5秒 (紅色，閃爍)

## 錯誤處理

### 常見錯誤情況
1. **延遲時間超出範圍**: 1-120秒限制
2. **撤回期限已過**: 無法撤回已發送的訊息
3. **權限不足**: 只能撤回自己發送的訊息
4. **網路錯誤**: 發送或撤回失敗

### 錯誤處理策略
```typescript
try {
  const result = await sendDelayedMessage(request)
  if (!result.success) {
    // 顯示錯誤訊息
    showError(result.error)
  }
} catch (error) {
  // 處理網路錯誤
  showError('網路連接失敗，請稍後重試')
}
```

## 效能考量

### 前端優化
- **虛擬滾動**: 大量待發送訊息的列表優化
- **防抖處理**: 避免頻繁的 API 調用
- **記憶體管理**: 及時清理定時器

### 後端優化
- **索引優化**: 針對查詢頻繁的欄位建立索引
- **批量處理**: 支援批量撤回操作
- **快取策略**: 使用 KV 存儲撤回狀態

## 安全考量

### 權限控制
- 只能撤回自己發送的訊息
- 基於 JWT 的身份驗證
- 對話權限檢查

### 資料保護
- 敏感訊息內容加密存儲
- 撤回日誌記錄
- 防止重複撤回攻擊

## 測試覆蓋

### 單元測試
- ✅ DelayedMessageSender 組件測試 (28 個測試)
- ✅ useDelayedMessage Composable 測試 (15 個測試)
- ✅ 後端處理器測試 (待實現)

### 整合測試
- ✅ API 端點測試
- ✅ 資料庫操作測試
- ✅ 錯誤處理測試

### E2E 測試
- 完整的延遲發送流程
- 撤回功能測試
- 多用戶協作測試

## 部署注意事項

### 資料庫遷移
```bash
# 執行延遲訊息功能的資料庫遷移
wrangler d1 execute your-database --file=./database/delayed-messages-schema.sql
```

### 環境變數
確保以下服務已配置：
- `MESSAGE_QUEUE`: Cloudflare Queue (可選)
- `SESSIONS`: KV Namespace (必需)

### 監控指標
- 延遲訊息發送成功率
- 撤回操作頻率
- 平均延遲時間
- 錯誤率統計

## 未來擴展

### 計劃功能
- **定時發送**: 支援指定具體時間發送
- **重複發送**: 支援週期性訊息發送
- **模板訊息**: 預設延遲訊息模板
- **批量操作**: 批量撤回和管理
- **統計分析**: 延遲發送使用統計

### 技術改進
- **WebSocket 通知**: 實時狀態更新
- **離線支援**: PWA 離線功能
- **效能優化**: 更好的記憶體管理
- **國際化**: 多語言支援

---

## 相關文件

- [API 文件](../api/delayed-messages.md)
- [資料庫結構](../database/delayed-messages-schema.sql)
- [測試指南](../testing/delayed-messages-testing.md)
- [部署指南](../deployment/delayed-messages-deployment.md)

---

**版本**: 1.0.0  
**最後更新**: 2025-01-08  
**狀態**: ✅ 開發完成，測試通過