# Real-time 模組 v2.0.0

統一的即時通訊模組，支援 SSE、事件驅動和隊列處理的完整解決方案。

## 🌟 特性

- ✅ **事件驅動架構** - 基於 Cloudflare Queue 的即時事件處理
- ✅ **SSE 連接管理** - 高效的 Server-Sent Events 連接池管理
- ✅ **智能版本選擇** - 自動選擇最適合的版本 (v1/v2/modular)
- ✅ **隊列處理系統** - 可靠的消息隊列和批量處理
- ✅ **完整認證系統** - Real-time 專用的認證和驗證中間件
- ✅ **性能監控** - 實時性能指標和警報系統
- ✅ **模組化架構** - 清晰的分層和可擴展設計

## 📁 模組結構

```
src/modules/realtime/
├── handlers/                    # 處理器層
│   ├── realtime-main.ts        # 主處理器 (統一入口)
│   ├── sse-handler.ts          # SSE 專用處理器
│   ├── event-handler.ts        # 事件處理器
│   └── index.ts                # 處理器導出
├── services/                    # 服務層
│   ├── realtime-manager.ts     # 主管理服務
│   ├── sse-connection-service.ts # SSE 連接管理
│   ├── event-queue-service.ts  # 事件隊列服務
│   └── index.ts                # 服務導出
├── middleware/                  # 中間件層
│   ├── realtime-auth.ts        # Real-time 認證
│   ├── connection-validation.ts # 連接驗證
│   └── index.ts                # 中間件導出
├── types/                       # 類型定義
│   ├── realtime-types.ts       # 核心類型
│   ├── sse-types.ts            # SSE 類型
│   ├── event-types.ts          # 事件類型
│   └── index.ts                # 類型導出
├── monitoring/                  # 監控系統
│   ├── performance-monitor.ts   # 性能監控器
│   └── dashboard-handler.ts     # 儀表板處理器
├── config/                      # 配置系統
│   └── version-selector.ts     # 版本選擇器
├── index.ts                     # 模組主入口
└── README.md                    # 本文檔
```

## 🚀 快速開始

### 基本使用

```typescript
import { realtime } from '@/modules/realtime';

// 初始化模組
await realtime.initialize(env, {
  version: 'auto',
  enableEventDriven: true,
  enableQueueProcessing: true
});

// 創建事件
await realtime.createEvent(
  'message',
  { content: 'Hello World', conversationId: 123 },
  { conversationId: 123 },
  'high'
);

// 獲取服務狀態
const status = await realtime.getStatus();
```

### 處理器使用

```typescript
import { realtimeMainHandler, sseHandler, eventHandler } from '@/modules/realtime';

// SSE 連接
app.get('/api/realtime/sse', realtimeMainHandler.sse);

// 事件發送
app.post('/api/realtime/events/message', eventHandler.sendMessageEvent);

// SSE 連接 (增強版)
app.get('/api/realtime/sse/enhanced', sseHandler.connect);
```

### 中間件使用

```typescript
import { realtimeAuth, sseConnectionValidation } from '@/modules/realtime';

// 應用認證中間件
app.use('/api/realtime/*', realtimeAuth());

// SSE 專用中間件鏈
app.get('/api/realtime/sse', ...realtimeMiddleware.sse, handler);
```

## 📋 API 參考

### 主要處理器

#### `realtimeMainHandler`
統一的 Real-time 處理器，支援智能版本選擇。

- `sse(context)` - SSE 連接端點
- `sendTypingStatus(context)` - 發送打字狀態
- `broadcastToConversation(context)` - 廣播到對話
- `getConversationStatus(context)` - 獲取對話狀態
- `updateOnlineStatus(context)` - 更新在線狀態

#### `eventHandler`
專門處理各種即時事件。

- `sendMessageEvent(context)` - 發送消息事件
- `sendTypingEvent(context)` - 發送打字事件
- `sendStatusEvent(context)` - 發送狀態變更事件
- `sendAssignmentEvent(context)` - 發送分配事件
- `sendNotificationEvent(context)` - 發送通知事件
- `sendSystemEvent(context)` - 發送系統廣播

### 服務類

#### `RealtimeManager`
主要的 Real-time 管理服務。

```typescript
const manager = RealtimeManager.getInstance();

// 初始化
await manager.initialize(env, config);

// 創建事件
await manager.createEvent(eventType, data, targets, priority);

// 獲取服務健康狀態
const health = await manager.getServiceHealth();

// 批量創建事件
await manager.createBatchEvents(events);

// 維護操作
await manager.performMaintenance('cleanup');
```

#### `SSEConnectionPool`
SSE 連接池管理器。

```typescript
const pool = new SSEConnectionPool(config);

// 創建連接
const connectionId = await pool.createConnection(authPayload, conversationId, controller);

// 發送到用戶
pool.sendToUser(userId, event);

// 發送到對話
pool.sendToConversation(conversationId, event);

// 廣播
pool.broadcast(event, filter);

// 清理過期連接
pool.cleanupStaleConnections();
```

### 監控系統

#### `RealtimePerformanceMonitor`
性能監控器，提供實時性能指標和警報。

```typescript
const monitor = RealtimePerformanceMonitor.getInstance();

// 初始化監控
monitor.initialize(env);

// 開始監控
monitor.startMonitoring(30); // 30秒間隔

// 獲取最新指標
const metrics = monitor.getLatestMetrics();

// 獲取活躍警報
const alerts = monitor.getActiveAlerts();

// 獲取性能摘要
const summary = monitor.getPerformanceSummary();
```

#### `dashboardHandler`
監控儀表板 API 處理器。

- `getOverview(context)` - 獲取總覽資訊
- `getMetrics(context)` - 獲取詳細指標
- `getAlerts(context)` - 獲取警報信息
- `getConnections(context)` - 獲取連接詳情
- `getHealth(context)` - 獲取系統健康狀態
- `performMaintenance(context)` - 執行維護操作

## 🔧 配置選項

### RealtimeConfig

```typescript
interface RealtimeConfig {
  version: 'v1' | 'v2' | 'auto';        // 版本選擇
  enableEventDriven: boolean;           // 啟用事件驅動
  enableQueueProcessing: boolean;       // 啟用隊列處理
  heartbeatInterval: number;            // 心跳間隔 (ms)
  connectionTimeout: number;            // 連接超時 (ms)
  maxRetries: number;                   // 最大重試次數
  eventStorageTtl: number;              // 事件存儲 TTL (秒)
}
```

### SSEConfig

```typescript
interface SSEConfig {
  heartbeatInterval: number;            // 心跳間隔
  connectionTimeout: number;            // 連接超時
  maxConnectionsPerUser: number;        // 每用戶最大連接數
  enableCompression: boolean;           // 啟用壓縮
  retryInterval: number;                // 重試間隔
  maxRetryAttempts: number;             // 最大重試次數
}
```

## 🎯 版本選擇

模組支援三個版本，可以自動或手動選擇：

### v1 (Legacy)
- 傳統的定時查詢機制
- 最佳相容性
- 適用於簡單場景

### v2 (Event-Driven)
- 事件驅動架構
- Cloudflare Queue 整合
- 較好的性能

### Modular (Advanced)
- 完整的模組化架構
- 所有進階功能
- 最佳性能和可擴展性

### 智能選擇

```typescript
import { RealtimeVersionSelector } from '@/modules/realtime';

const selector = RealtimeVersionSelector.getInstance();

// 自動選擇最佳版本
const selection = await selector.selectBestVersion(env, context);

// 手動設置版本
selector.setVersion('v2');

// 檢查相容性
const compatibility = selector.validateVersionCompatibility('modular', capabilities);
```

## 📊 監控和分析

### 性能指標

監控系統收集以下指標：

- **連接指標**: 總連接數、平均連接時長、連接失敗率
- **事件指標**: 事件處理時間、處理速率、失敗率
- **SSE 指標**: 數據傳輸量、響應時間、心跳成功率
- **隊列指標**: 隊列深度、等待時間、吞吐量
- **資源指標**: 記憶體使用、KV 操作次數

### 警報系統

自動監控並在指標超過閾值時生成警報：

- 連接失敗率 > 5%
- 事件處理時間 > 1秒
- 事件失敗率 > 2%
- 隊列深度 > 1000
- 心跳成功率 < 95%

### 儀表板 API

提供完整的 REST API 用於監控儀表板：

```bash
# 獲取總覽
GET /api/realtime/dashboard/overview

# 獲取指標歷史
GET /api/realtime/dashboard/metrics?limit=50

# 獲取警報
GET /api/realtime/dashboard/alerts?active=true

# 獲取連接詳情
GET /api/realtime/dashboard/connections

# 獲取健康狀態
GET /api/realtime/dashboard/health

# 執行維護操作
POST /api/realtime/dashboard/maintenance
{
  "operation": "cleanup",
  "target": "sse"
}
```

## 🔐 安全性

### 認證和授權

- **多層認證**: Header token 和 Query token 支援
- **角色驗證**: Admin, Team, Agent 角色權限控制
- **對話訪問權限**: 自動檢查用戶對特定對話的訪問權限
- **JWT 整合**: 完整的 JWT token 驗證和刷新

### 連接驗證

- **速率限制**: 可配置的請求速率限制
- **連接數限制**: 每用戶最大連接數控制
- **Origin 驗證**: 允許的來源域名檢查
- **User-Agent 驗證**: 防止機器人和爬蟲

## 🧪 測試

### 單元測試

```bash
# 執行所有 Real-time 模組測試
npm run test -- src/modules/realtime

# 執行特定組件測試
npm run test -- src/modules/realtime/handlers
npm run test -- src/modules/realtime/services
```

### 整合測試

```bash
# SSE 連接測試
npm run test -- tests/integration/realtime-sse.test.ts

# 事件處理測試
npm run test -- tests/integration/realtime-events.test.ts

# 性能測試
npm run test -- tests/performance/realtime-load.test.ts
```

## 🚧 故障排除

### 常見問題

1. **SSE 連接失敗**
   - 檢查認證 token 是否有效
   - 確認用戶有對話訪問權限
   - 檢查網路連接和防火牆設置

2. **事件處理延遲**
   - 檢查 Cloudflare Queue 配置
   - 監控隊列深度和處理時間
   - 考慮調整批量處理設置

3. **高記憶體使用**
   - 清理過期連接: `pool.cleanupStaleConnections()`
   - 重置統計數據: `eventStats.reset()`
   - 檢查指標歷史大小限制

### 診斷工具

```typescript
// 獲取診斷信息
const diagnostics = {
  service: await manager.getServiceHealth(),
  connections: await enhancedSSEManager.getStats(),
  performance: monitor.getPerformanceSummary(),
  version: selector.getCurrentCapabilities()
};

console.log('診斷信息:', diagnostics);
```

## 📈 性能優化

### 最佳實踐

1. **連接管理**
   - 定期清理過期連接
   - 設置合理的連接超時
   - 監控連接數限制

2. **事件處理**
   - 使用適當的事件優先級
   - 批量處理非即時事件
   - 避免過度的事件生成

3. **監控設置**
   - 合理設置監控間隔
   - 定期清理歷史數據
   - 設置適當的警報閾值

### 配置調優

```typescript
// 高性能配置
const highPerformanceConfig = {
  version: 'modular',
  enableEventDriven: true,
  enableQueueProcessing: true,
  heartbeatInterval: 5000,      // 更頻繁的心跳
  connectionTimeout: 180000,    // 較短的超時
  maxRetries: 2,                // 較少的重試
  eventStorageTtl: 180         // 較短的存儲時間
};

// 高可靠性配置
const highReliabilityConfig = {
  version: 'v2',
  enableEventDriven: true,
  enableQueueProcessing: true,
  heartbeatInterval: 10000,     // 較長的心跳間隔
  connectionTimeout: 600000,    // 較長的超時
  maxRetries: 5,                // 更多重試
  eventStorageTtl: 600         // 較長的存儲時間
};
```

## 🔄 升級指南

### 從舊版本升級

1. **從 realtime.ts 升級**:
   ```typescript
   // 舊版本
   import { realtimeHandler } from '@/handlers/realtime';

   // 新版本
   import { realtimeMainHandler } from '@/modules/realtime';
   ```

2. **從 realtime-v2.ts 升級**:
   ```typescript
   // 舊版本
   import { realtimeHandlerV2 } from '@/handlers/realtime-v2';

   // 新版本
   import { realtime } from '@/modules/realtime';
   // 自動選擇最佳版本
   ```

3. **配置遷移**:
   ```typescript
   // 使用新的配置系統
   await realtime.initialize(env, {
     version: 'auto',  // 自動選擇版本
     enableEventDriven: true,
     enableQueueProcessing: true
   });
   ```

## 📝 更新日誌

### v2.0.0 (當前版本)
- ✨ 完整的模組化架構重構
- ✨ 智能版本選擇系統
- ✨ 性能監控和警報系統
- ✨ 增強的 SSE 連接管理
- ✨ 完整的認證和驗證中間件
- ✨ 監控儀表板 API
- 🐛 修復多個連接穩定性問題
- 🔧 重構所有類型定義

### v1.x (舊版本)
- 基本的 SSE 功能
- 簡單的事件處理
- 基礎認證機制

---

## 📞 支援

如有問題或建議，請聯繫開發團隊或創建 issue。

**模組負責人**: Real-time Module Team
**最後更新**: 2024-12-26
**版本**: 2.0.0