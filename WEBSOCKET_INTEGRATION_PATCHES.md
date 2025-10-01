# WebSocket 模組整合修補檔案

本文件包含完善 WebSocket + Durable Objects 整合所需的所有修改。

## 修改 1: 修復 Durable Objects 導出 (src/index.ts, line 612-621)

### 原始代碼:
```typescript
// Import Durable Objects for WebSocket + Durable Objects Architecture
import { ConversationRoom } from './durable-objects/ConversationRoom';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
import { DelayedMessageBuffer } from './durable-objects/DelayedMessageBuffer';
import { LockCoordinator } from './services/distributed-lock-service';

// Export Durable Objects
export { ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor, DelayedMessageBuffer, LockCoordinator };
```

### 修改後:
```typescript
// Import Durable Objects for WebSocket + Durable Objects Architecture
// 使用簡化版 ConversationRoom 以降低複雜度 (MVP 階段推薦)
import { SimplifiedConversationRoom } from './durable-objects/ConversationRoomSimplified';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
import { DelayedMessageBuffer } from './durable-objects/DelayedMessageBuffer';
import { LockCoordinator } from './services/distributed-lock-service';

// Export Durable Objects
// 注意: SimplifiedConversationRoom 重命名為 ConversationRoom 以匹配 wrangler.toml 配置
export {
  SimplifiedConversationRoom as ConversationRoom,
  UserConnection,
  MessageBroadcaster,
  DelayedMessageProcessor,
  DelayedMessageBuffer,
  LockCoordinator
};
```

## 修改 2: 掛載 WebSocket 路由 (src/index.ts, line 437之後)

### 在此行之後添加:
```typescript
// ==================== Analytics Comparison API ====================
// Period comparison endpoints for analytics module
app.route('/api/analytics/comparison', comparisonAPI);
```

### 添加以下代碼:
```typescript
// ==================== WebSocket Real-time System ====================
// WebSocket endpoints for real-time communication via Durable Objects
app.route('/api/websocket', websocketMainHandler);
console.log('✅ [Startup] WebSocket routes mounted at /api/websocket');
```

## 測試命令

完成修改後,執行以下命令進行測試:

```bash
# 1. TypeScript 編譯檢查
npm run build

# 2. 啟動開發伺服器
npm run dev

# 3. 測試 WebSocket 連接 (在另一個終端)
# 替換 YOUR_JWT_TOKEN 為有效的 JWT token
curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  "http://localhost:8787/api/websocket/connect?userId=1&conversationId=test_123&token=YOUR_JWT_TOKEN&role=agent"

# 4. 檢查 WebSocket 健康狀態
curl http://localhost:8787/api/websocket/health

# 5. 獲取遷移配置
curl http://localhost:8787/api/websocket/migration-status
```

## 預期結果

### 1. 編譯成功
```
✅ TypeScript compilation successful
✅ No type errors
```

### 2. 啟動日誌
```
🚀 Initializing Unified Route Management System...
✅ Route system initialized successfully:
  📊 Groups: X
  📈 Modules: X/X

✅ [Startup] WebSocket routes mounted at /api/websocket
```

### 3. WebSocket 連接測試
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

### 4. 健康檢查
```json
{
  "status": "healthy",
  "websocketEnabled": true,
  "sseEnabled": true,
  "totalConnections": 0,
  "activeConnections": 0,
  "timestamp": 1234567890
}
```

## 驗證清單

- [ ] DO 導出修改完成
- [ ] WebSocket 路由掛載完成
- [ ] TypeScript 編譯無誤
- [ ] 開發伺服器啟動成功
- [ ] WebSocket 健康檢查回應正常
- [ ] 可以建立 WebSocket 連接
- [ ] 訊息可以正常廣播

## 後續步驟

完成上述修改並通過測試後,進行以下步驟:

1. **整合廣播服務**
   - 在 handlers/message.ts 中使用 SimplifiedWebSocketBroadcastService
   - 替換現有的訊息廣播邏輯

2. **完善認證整合**
   - 確保 JWT 驗證完全整合到 websocket-auth 中介軟體
   - 添加權限檢查邏輯

3. **添加監控和日誌**
   - 實作 WebSocket 連接監控
   - 添加性能指標收集

4. **編寫測試**
   - 單元測試各個 Durable Objects
   - 整合測試 WebSocket 連接流程
   - 壓力測試並發連接

## 架構示意圖

```
Client Request
    │
    ↓
/api/websocket/connect
    │
    ↓
websocket-main.ts (Handler)
    ├─→ websocketAuth (中介軟體)
    │   └─→ JWT 驗證
    │
    ├─→ 路由決策
    │   ├─→ 有 conversationId
    │   │   └─→ ConversationRoom DO
    │   │       ├─→ WebSocket 升級
    │   │       ├─→ 連接管理
    │   │       └─→ 訊息廣播
    │   │
    │   └─→ 無 conversationId
    │       └─→ UserConnection DO
    │           ├─→ 全域連接
    │           └─→ 跨對話訂閱
    │
    └─→ MessageBroadcaster DO
        └─→ 事件分發和批次處理
```

## 常見問題

### Q1: WebSocket 連接失敗,返回 404
**A:** 確認 `app.route('/api/websocket', websocketMainHandler)` 已正確添加

### Q2: DO binding not found 錯誤
**A:** 確認 wrangler.toml 中的 DO 綁定名稱與代碼中使用的名稱一致

### Q3: Type error: ConversationRoom not found
**A:** 確認已從 SimplifiedConversationRoom 重命名導出

### Q4: WebSocket upgrade fails with 401 Unauthorized
**A:** 檢查 JWT token 是否有效,確認 websocket-auth 中介軟體正常運作

## 支援資源

- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Hono Framework: https://hono.dev/

---

**檔案創建時間:** 2025-09-30
**目的:** 完善 WebSocket + Durable Objects 整合
**狀態:** 待應用