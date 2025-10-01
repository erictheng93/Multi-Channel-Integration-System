# Collaboration Module (協作模組)

統一的多客服協作模組,提供即時協作功能,支援 SSE 和 WebSocket 多種協議。

## 🌟 核心特性

- ✅ **多協議支援** - SSE (預設) 和 WebSocket 可選
- ✅ **適配器模式** - 統一接口,底層可切換
- ✅ **Typing Indicator** - 即時輸入狀態指示
- ✅ **Presence 追蹤** - 用戶在線狀態管理
- ✅ **房間管理** - 對話房間的查看者追蹤
- ✅ **事件廣播** - 即時事件推送到對話參與者
- ✅ **統計分析** - 完整的協作數據統計

## 📁 模組結構

```
src/modules/collaboration/
├── types/                      # 類型定義
│   ├── collaboration-types.ts  # 核心類型
│   └── index.ts
├── adapters/                   # 協議適配器
│   ├── sse-adapter.ts          # SSE 適配器
│   ├── websocket-adapter.ts    # WebSocket 適配器
│   └── index.ts
├── services/                   # 業務服務
│   ├── collaboration-manager.ts # 統一管理器
│   └── index.ts
├── handlers/                   # API 處理器
│   ├── collaboration-main.ts   # 主處理器
│   └── index.ts
├── index.ts                    # 模組主入口
└── README.md                   # 本文檔
```

## 🚀 快速開始

### 初始化

```typescript
import { Collaboration } from '@/modules/collaboration';

// 在 Worker 啟動時初始化
await Collaboration.initialize(env, {
  defaultProtocol: 'sse',
  enableWebSocket: false,
  typingExpirationSeconds: 5,
  presenceExpirationSeconds: 300
});
```

### 基本使用

```typescript
import { Collaboration } from '@/modules/collaboration';

// 1. 獲取對話協作狀態
const state = await Collaboration.getConversationState(conversationId);
console.log('查看者:', state.viewers);
console.log('正在輸入:', state.typing);

// 2. 用戶加入對話
await Collaboration.joinConversation({
  conversationId: 123,
  userId: 1,
  protocol: 'sse',
  metadata: {
    username: 'alice',
    displayName: 'Alice',
    role: 'admin'
  }
});

// 3. 發送輸入狀態
await Collaboration.sendTyping({
  conversationId: 123,
  userId: 1,
  status: 'start'
});

// 4. 更新在線狀態
await Collaboration.updatePresence({
  userId: 1,
  status: 'online',
  currentConversation: 123
});

// 5. 廣播自定義事件
await Collaboration.broadcastEvent({
  conversationId: 123,
  event: {
    type: 'message_sent',
    conversationId: 123,
    userId: 1,
    data: { messageId: 456 },
    timestamp: new Date().toISOString()
  }
});
```

## 📋 API 參考

### REST API 端點

#### 獲取對話狀態
```
GET /api/collaboration/conversations/:id/state
Query: protocol=sse|websocket (optional)

Response:
{
  "success": true,
  "data": {
    "conversationId": 123,
    "viewers": [...],
    "typing": [...],
    "totalConnections": 2,
    "protocol": "sse",
    "lastActivity": "2024-01-01T00:00:00Z"
  }
}
```

#### 獲取查看者列表
```
GET /api/collaboration/conversations/:id/viewers
Query: protocol=sse|websocket (optional)

Response:
{
  "success": true,
  "data": {
    "viewers": [
      {
        "userId": 1,
        "username": "alice",
        "displayName": "Alice",
        "role": "admin",
        "joinedAt": "2024-01-01T00:00:00Z",
        "protocol": "sse",
        "isTyping": false,
        "lastActivity": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### 加入對話
```
POST /api/collaboration/conversations/:id/join
Body: {
  "protocol": "sse" // optional
}

Response:
{
  "success": true,
  "message": "Joined conversation successfully"
}
```

#### 離開對話
```
POST /api/collaboration/conversations/:id/leave

Response:
{
  "success": true,
  "message": "Left conversation successfully"
}
```

#### 發送輸入狀態
```
POST /api/collaboration/typing
Body: {
  "conversationId": 123,
  "status": "start" | "stop"
}

Response:
{
  "success": true,
  "message": "Typing start sent successfully"
}
```

#### 更新在線狀態
```
POST /api/collaboration/presence
Body: {
  "status": "online" | "away" | "busy" | "offline",
  "currentConversation": 123, // optional
  "metadata": {} // optional
}

Response:
{
  "success": true,
  "message": "Presence updated successfully"
}
```

#### 獲取統計信息
```
GET /api/collaboration/stats
Query: protocol=sse|websocket (optional)

Response:
{
  "success": true,
  "data": {
    "totalViewers": 10,
    "totalTyping": 2,
    "totalRooms": 5,
    "connectionsByProtocol": {
      "sse": 10,
      "websocket": 0,
      "http": 0
    },
    "topActiveConversations": [...]
  }
}
```

#### 健康檢查
```
GET /api/collaboration/health

Response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "config": {
      "defaultProtocol": "sse",
      "enableWebSocket": false
    },
    "availableProtocols": ["sse"],
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## 🔧 配置選項

```typescript
interface CollaborationConfig {
  // 預設使用的協議
  defaultProtocol: 'sse' | 'websocket' | 'http';

  // 是否啟用 WebSocket
  enableWebSocket: boolean;

  // 輸入狀態過期時間 (秒)
  typingExpirationSeconds: number;

  // 在線狀態過期時間 (秒)
  presenceExpirationSeconds: number;

  // 清理任務執行間隔 (秒)
  cleanupIntervalSeconds: number;

  // 每個對話最大查看者數
  maxViewersPerConversation: number;

  // 是否記錄協作事件到資料庫
  persistEvents: boolean;
}
```

### 預設配置

```typescript
{
  defaultProtocol: 'sse',
  enableWebSocket: false,
  typingExpirationSeconds: 5,
  presenceExpirationSeconds: 300,
  cleanupIntervalSeconds: 60,
  maxViewersPerConversation: 50,
  persistEvents: false
}
```

## 🎯 使用場景

### 場景 1: 多客服同時查看對話

```typescript
// 客服 A 進入對話
await Collaboration.joinConversation({
  conversationId: 123,
  userId: 1,
  metadata: { username: 'alice', displayName: 'Alice', role: 'admin' }
});

// 客服 B 進入對話
await Collaboration.joinConversation({
  conversationId: 123,
  userId: 2,
  metadata: { username: 'bob', displayName: 'Bob', role: 'agent' }
});

// 獲取當前查看者
const state = await Collaboration.getConversationState(123);
console.log('當前查看者:', state.viewers); // [Alice, Bob]
```

### 場景 2: Typing Indicator

```typescript
// 客服開始輸入
await Collaboration.sendTyping({
  conversationId: 123,
  userId: 1,
  status: 'start'
});

// 系統自動廣播給其他查看者
// 其他客服會收到 typing_start 事件

// 5 秒後自動過期或手動停止
await Collaboration.sendTyping({
  conversationId: 123,
  userId: 1,
  status: 'stop'
});
```

### 場景 3: Presence 狀態管理

```typescript
// 客服上線
await Collaboration.updatePresence({
  userId: 1,
  status: 'online',
  currentConversation: 123
});

// 客服暫離
await Collaboration.updatePresence({
  userId: 1,
  status: 'away'
});

// 客服下線
await Collaboration.updatePresence({
  userId: 1,
  status: 'offline'
});
```

## 🔀 協議切換

### SSE (預設)

```typescript
// 使用 SSE 協議
await Collaboration.initialize(env, {
  defaultProtocol: 'sse',
  enableWebSocket: false
});

// 特定請求使用 SSE
const state = await Collaboration.getConversationState(123, 'sse');
```

### WebSocket (選用)

```typescript
// 啟用 WebSocket
await Collaboration.initialize(env, {
  defaultProtocol: 'websocket',
  enableWebSocket: true
});

// 特定請求使用 WebSocket
const state = await Collaboration.getConversationState(123, 'websocket');
```

### 混合模式

```typescript
// 預設 SSE,WebSocket 可選
await Collaboration.initialize(env, {
  defaultProtocol: 'sse',
  enableWebSocket: true // 同時啟用兩種協議
});

// 根據需要選擇協議
const sseState = await Collaboration.getConversationState(123, 'sse');
const wsState = await Collaboration.getConversationState(456, 'websocket');
```

## 📊 監控與維護

### 獲取統計信息

```typescript
// 獲取所有協議的統計
const stats = await Collaboration.getStats();

// 獲取特定協議的統計
const sseStats = await Collaboration.getStats('sse');
const wsStats = await Collaboration.getStats('websocket');
```

### 定期清理

```typescript
// 手動觸發清理
const cleanedCount = await collaboration.cleanup();
console.log(`清理了 ${cleanedCount} 個過期項目`);
```

## 🧪 測試

```typescript
// 測試協作功能
import { Collaboration } from '@/modules/collaboration';

describe('Collaboration Module', () => {
  beforeAll(async () => {
    await Collaboration.initialize(testEnv);
  });

  test('should join conversation', async () => {
    await Collaboration.joinConversation({
      conversationId: 1,
      userId: 1
    });

    const state = await Collaboration.getConversationState(1);
    expect(state.viewers).toHaveLength(1);
  });

  test('should send typing indicator', async () => {
    await Collaboration.sendTyping({
      conversationId: 1,
      userId: 1,
      status: 'start'
    });

    const state = await Collaboration.getConversationState(1);
    expect(state.typing).toHaveLength(1);
  });
});
```

## 📝 更新日誌

### v1.0.0 (2024-01-01)
- ✨ 初始版本發布
- ✨ SSE 適配器完整實現
- ✨ WebSocket 適配器準備就緒
- ✨ 統一的協作 API
- ✨ Typing Indicator 支援
- ✨ Presence 狀態追蹤
- ✨ 完整的文檔和測試

---

**模組維護者**: Collaboration Team
**最後更新**: 2024-01-01
**版本**: 1.0.0
