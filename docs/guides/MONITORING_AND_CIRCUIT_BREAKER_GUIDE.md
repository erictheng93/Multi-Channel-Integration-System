> **STALE WARNING (2026-05-04)**: 本檔案內容受文件重組過程中的中文字符剝除腳本影響，部分原有說明已遺失；且仍提及 v3 的 SSE 為現行架構。**v4 已完全移除 SSE，改用 WebSocket + Durable Objects**。建議改參考 [`docs/CURRENT_STATUS.md`](../CURRENT_STATUS.md)、相關模組手冊（`docs/modules/`），或 [`docs/architecture/websocket/WEBSOCKET_FINAL_ARCHITECTURE.md`](../architecture/websocket/WEBSOCKET_FINAL_ARCHITECTURE.md)。

---

# 監控、告警與熔斷器使用指南

**版本**: v1.0
**更新日期**: 2025-01-08
**適用範圍**: WebSocket 實時系統、Durable Objects 監控、Circuit Breaker 降級機制

---

##  目錄

1. [總覽](#總覽)
2. [結構化日誌系統](#結構化日誌系統)
3. [DO 實例監控](#do-實例監控)
4. [Circuit Breaker 熔斷器](#circuit-breaker-熔斷器)
5. [監控 API 端點](#監控-api-端點)
6. [實戰示例](#實戰示例)
7. [故障排除](#故障排除)

---

## 總覽

本系統提供了三層監控和容錯機制：

```
┌─────────────────────────────────────────────────────────────┐
│ 監控與容錯架構 │
├─────────────────────────────────────────────────────────────┤
│ │
│  Layer 1: 結構化日誌 (logger-service.ts) │
│  • DEBUG, INFO, WARN, ERROR, CRITICAL 5 個級別 │
│  • JSON 格式輸出，方便機器解析 │
│  • 自動上下文管理和性能追蹤 │
│ │
│  Layer 2: DO 實例監控 (durable-objects-monitor.ts) │
│  • 監控所有 Durable Objects 實例健康狀態 │
│  • 自動檢測異常（高錯誤率、高延遲、內存洩漏） │
│  • 實時告警機制 │
│ │
│  Layer 3: Circuit Breaker (websocket-circuit-breaker.ts) │
│  • 自動故障隔離（CLOSED → OPEN → HALF_OPEN） │
│  • 智能降級策略（Polling, SSE, Queue, Fail Fast） │
│  • 自動恢復機制 │
│ │
└─────────────────────────────────────────────────────────────┘
```

### 關鍵優勢

 **主動式監控**: 自動檢測問題，無需人工介入
 **智能降級**: Circuit Breaker 自動切換到備用方案
 **可觀測性**: 結構化日誌便於分析和追蹤
 **生產就緒**: 完整的告警和恢復機制

---

## 結構化日誌系統

### 基本使用

```typescript
import { createLogger, LogLevel } from '@/services/logger-service';

// 創建 Logger 實例
const logger = createLogger({ service: 'MyService' });

// 不同級別的日誌
logger.debug('調試信息', { userId: '123' });
logger.info('操作成功', { messageId: 'msg-001' });
logger.warn('警告：延遲較高', { latency: 1500 });
logger.error('操作失敗', error, { conversationId: 'conv-001' });
logger.critical('嚴重錯誤：系統崩潰', error);
```

### 日誌輸出格式

```json
{
  "timestamp": "2025-01-08T10:30:45.123Z",
  "level": "ERROR",
  "message": "WebSocket broadcast failed",
  "context": {
    "userId": "user-123",
    "conversationId": "conv-456",
    "eventId": "evt-789",
    "service": "WebSocket-Broadcast",
    "environment": "production"
  },
  "error": {
    "name": "TimeoutError",
    "message": "Request timeout after 5000ms",
    "stack": "...",
    "code": "ETIMEDOUT"
  },
  "metadata": {
    "retryCount": 3,
    "targetType": "ConversationRoom"
  }
}
```

### 性能追蹤

```typescript
import { PerformanceTimer } from '@/services/logger-service';

async function processMessage(messageId: string) {
  const timer = new PerformanceTimer(logger, 'process_message', {
    messageId
  });

  // ... 處理邏輯 ...

  timer.checkpoint('validation_complete'); // 記錄中間點

  // ... 更多處理 ...

  const duration = timer.end(); // 結束計時並記錄
  // 輸出: [Performance] process_message: 234ms
}
```

### 子 Logger（繼承上下文）

```typescript
// 父 Logger
const parentLogger = createLogger({ service: 'WebSocket' });

// 子 Logger 繼承父 Logger 的上下文
const childLogger = parentLogger.child({
  conversationId: 'conv-123',
  userId: 'user-456'
});

// 子 Logger 的日誌會自動包含父 Logger 的上下文
childLogger.info('Message sent');
// 上下文: { service: 'WebSocket', conversationId: 'conv-123', userId: 'user-456' }
```

---

## DO 實例監控

### 監控指標

每個 Durable Objects 實例會追蹤以下指標：

| 指標 | 說明 | 告警閾值 |
|------|------|----------|
| **activeConnections** | 當前活躍連接數 | > 80% connectionLimit |
| **errorRate** | 錯誤率（0-1） | > 0.10 (10%) |
| **averageLatency** | 平均延遲（ms） | > 1000ms |
| **memoryUsageMB** | 內存使用（MB） | > 100MB |
| **uptime** | 運行時間（ms） | - |
| **healthStatus** | 健康狀態 | DEGRADED or UNHEALTHY |

### 告警類型

```typescript
export enum DOAlertType {
  HIGH_ERROR_RATE = 'high_error_rate', // 錯誤率過高
  HIGH_LATENCY = 'high_latency', // 延遲過高
  HIGH_MEMORY = 'high_memory', // 內存使用過高
  CONNECTION_LIMIT = 'connection_limit', // 接近連接上限
  INSTANCE_UNRESPONSIVE = 'instance_unresponsive', // 實例無響應
  INSTANCE_CRASHED = 'instance_crashed' // 實例崩潰
}
```

### 編程使用

```typescript
import { createDOMonitor } from '@/services/durable-objects-monitor';

// 創建監控實例
const monitor = createDOMonitor(env, {
  healthCheckInterval: 30000, // 30 秒檢查一次
  thresholds: {
    errorRate: 0.1, // 10% 錯誤率告警
    latency: 1000, // 1 秒延遲告警
    memoryUsage: 100, // 100MB 內存告警
    connectionUtilization: 0.8 // 80% 連接使用率告警
  }
});

// 執行健康檢查
const stats = await monitor.performHealthCheck();
console.log('總實例數:', stats.totalInstances);
console.log('健康實例:', stats.healthyInstances);
console.log('活躍告警:', stats.activeAlerts);

// 獲取特定類型的實例指標
const userConnections = monitor.getInstanceMetricsByType('UserConnection');

// 獲取活躍告警
const alerts = monitor.getActiveAlerts();
alerts.forEach(alert => {
  console.log(`[${alert.severity}] ${alert.message}`);
});
```

---

## Circuit Breaker 熔斷器

### 工作原理

Circuit Breaker 有三種狀態：

```
        連續失敗 ≥ 5 次
CLOSED ──────────────────► OPEN
  ▲ │
  │ │ 60 秒後自動嘗試
  │ │
  │ 2 次成功 │
  └───────── HALF_OPEN ◄───┘
             測試恢復
```

### 配置選項

```typescript
import { getCircuitBreaker, FallbackStrategy } from '@/services/websocket-circuit-breaker';

const circuitBreaker = getCircuitBreaker({
  failureThreshold: 5, // 連續失敗 5 次後開啟
  successThreshold: 2, // 成功 2 次後關閉
  timeout: 60000, // 開啟後 60 秒嘗試恢復
  halfOpenMaxCalls: 3, // 半開狀態最多測試 3 次

  // 降級策略
  fallbackStrategy: FallbackStrategy.QUEUE, // 隊列延遲處理
  enableAutoRecovery: true, // 啟用自動恢復

  // 高級監控
  errorRateThreshold: 0.25, // 25% 錯誤率觸發
  latencyThreshold: 3000, // 3 秒延遲觸發
  volumeThreshold: 10 // 最少 10 個請求才判斷
});

circuitBreaker.setEnv(env);
```

### 使用示例

```typescript
// 使用 Circuit Breaker 保護操作
const result = await circuitBreaker.execute(
  // 主要操作
  async () => {
    return await sendWebSocketMessage(event);
  },

  // 降級方案（可選）
  async () => {
    console.log('WebSocket 失敗，使用隊列延遲處理');
    await queueMessage(event);
    return true;
  },

  // 上下文信息（可選）
  { eventId: event.id, userId: event.userId }
);
```

### 降級策略

```typescript
export enum FallbackStrategy {
  POLLING = 'polling', // 降級到輪詢
  SSE = 'sse', // 降級到 Server-Sent Events
  QUEUE = 'queue', // 隊列延遲處理（推薦）
  FAIL_FAST = 'fail_fast',  // 快速失敗（不降級）
  RETRY_LATER = 'retry_later' // 延遲重試
}
```

### 手動控制

```typescript
// 獲取當前狀態
const state = circuitBreaker.getState(); // 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// 獲取統計信息
const stats = circuitBreaker.getStats();
console.log('總調用次數:', stats.totalCalls);
console.log('失敗次數:', stats.failedCalls);
console.log('成功率:', (stats.successfulCalls / stats.totalCalls * 100).toFixed(2) + '%');

// 手動重置（恢復正常）
circuitBreaker.reset();

// 手動開啟（緊急停止）
circuitBreaker.open();
```

---

## 監控 API 端點

### 公開端點

#### 1. 系統健康檢查

```bash
curl https://your-domain.com/api/monitoring/health
```

**響應示例**:
```json
{
  "status": "healthy",
  "timestamp": 1704709845123,
  "components": {
    "durableObjects": {
      "status": "healthy",
      "totalInstances": 150,
      "healthyInstances": 148,
      "degradedInstances": 2,
      "unhealthyInstances": 0
    },
    "circuitBreaker": {
      "status": "CLOSED",
      "stats": {
        "state": "CLOSED",
        "totalCalls": 1250,
        "successfulCalls": 1245,
        "failedCalls": 5
      }
    },
    "alerts": {
      "active": 2,
      "total": 15
    }
  }
}
```

### 需要認證的端點

#### 2. 詳細監控指標

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/api/monitoring/metrics
```

#### 3. 獲取活躍告警

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/monitoring/alerts
```

**響應示例**:
```json
{
  "count": 2,
  "alerts": [
    {
      "type": "high_latency",
      "severity": "warning",
      "message": "High latency detected: 1250ms",
      "timestamp": 1704709800000,
      "age": 45123,
      "metadata": {
        "latency": 1250,
        "threshold": 1000
      }
    },
    {
      "type": "connection_limit",
      "severity": "critical",
      "message": "High connection utilization: 92.5%",
      "timestamp": 1704709820000,
      "age": 25123,
      "metadata": {
        "utilization": 0.925,
        "activeConnections": 185,
        "limit": 200
      }
    }
  ]
}
```

#### 4. Circuit Breaker 狀態

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/monitoring/circuit-breaker/status
```

#### 5. 手動重置 Circuit Breaker

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/api/monitoring/circuit-breaker/reset
```

#### 6. 緊急停止（開啟 Circuit Breaker）

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/api/monitoring/circuit-breaker/open
```

#### 7. 獲取特定類型的 DO 實例

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://your-domain.com/api/monitoring/instances/ConversationRoom"
```

#### 8. 手動觸發健康檢查

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/api/monitoring/health-check
```

---

## 實戰示例

### 場景 1: 集成到現有服務

```typescript
// services/my-service.ts
import { createLogger, PerformanceTimer } from '@/services/logger-service';
import { getCircuitBreaker } from '@/services/websocket-circuit-breaker';

export class MyService {
  private logger = createLogger({ service: 'MyService' });
  private circuitBreaker = getCircuitBreaker();

  async processData(data: any) {
    const timer = new PerformanceTimer(this.logger, 'process_data', {
      dataId: data.id
    });

    try {
      // 使用 Circuit Breaker 保護外部 API 調用
      const result = await this.circuitBreaker.execute(
        async () => {
          return await this.callExternalAPI(data);
        },
        async () => {
          // 降級方案：使用緩存數據
          this.logger.warn('External API failed, using cache', {
            dataId: data.id
          });
          return await this.getCachedData(data.id);
        },
        { dataId: data.id }
      );

      const duration = timer.end();
      this.logger.info('Data processed successfully', {
        dataId: data.id,
        duration,
        source: result.fromCache ? 'cache' : 'api'
      });

      return result;

    } catch (error) {
      timer.end();
      this.logger.error('Failed to process data', error, {
        dataId: data.id
      });
      throw error;
    }
  }

  private async callExternalAPI(data: any) {
    // 實際 API 調用...
  }

  private async getCachedData(id: string) {
    // 從緩存獲取數據...
  }
}
```

### 場景 2: 自動告警處理

```typescript
// services/alert-handler.ts
import { createDOMonitor, DOAlertType } from '@/services/durable-objects-monitor';
import { createLogger } from '@/services/logger-service';

export async function checkAndHandleAlerts(env: Bindings) {
  const logger = createLogger({ service: 'AlertHandler' });
  const monitor = createDOMonitor(env);

  // 執行健康檢查
  await monitor.performHealthCheck();

  // 獲取活躍告警
  const alerts = monitor.getActiveAlerts();

  for (const alert of alerts) {
    // 根據告警類型採取不同行動
    switch (alert.type) {
      case DOAlertType.HIGH_ERROR_RATE:
        logger.critical('High error rate detected', undefined, undefined, {
          alert
        });
        // 可以在這裡發送 Slack 通知、郵件等
        await sendSlackAlert(alert);
        break;

      case DOAlertType.CONNECTION_LIMIT:
        logger.warn('Approaching connection limit', undefined, {
          alert
        });
        // 觸發自動擴展或限流
        await enableRateLimiting();
        break;

      case DOAlertType.HIGH_MEMORY:
        logger.warn('High memory usage', undefined, {
          alert
        });
        // 觸發內存清理
        await cleanupOldData();
        break;
    }
  }

  return {
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical').length
  };
}
```

### 場景 3: 定時監控任務

```typescript
// cron-jobs/health-monitor.ts
export async function scheduledHealthCheck(env: Bindings) {
  const logger = createLogger({ service: 'HealthMonitor' });
  const monitor = createDOMonitor(env);

  try {
    const stats = await monitor.performHealthCheck();

    // 記錄統計
    logger.info('Health check completed', undefined, {
      totalInstances: stats.totalInstances,
      healthyInstances: stats.healthyInstances,
      degradedInstances: stats.degradedInstances,
      unhealthyInstances: stats.unhealthyInstances,
      activeAlerts: stats.activeAlerts
    });

    // 如果有不健康的實例，發送告警
    if (stats.unhealthyInstances > 0) {
      logger.critical('Unhealthy instances detected', undefined, undefined, {
        count: stats.unhealthyInstances,
        instancesByType: stats.instancesByType
      });

      // 觸發自動恢復流程
      await attemptAutoRecovery(env, monitor);
    }

    return stats;

  } catch (error) {
    logger.error('Health check failed', error);
    throw error;
  }
}
```

---

## 故障排除

### 問題 1: Circuit Breaker 頻繁開啟

**症狀**: Circuit Breaker 不斷在 OPEN 和 HALF_OPEN 之間切換

**原因**:
- 錯誤閾值設置過低
- 實際服務確實不穩定
- 網絡延遲過高

**解決方案**:
```typescript
// 調整閾值
const circuitBreaker = getCircuitBreaker({
  failureThreshold: 10, // 增加到 10 次
  errorRateThreshold: 0.3, // 增加到 30%
  volumeThreshold: 20, // 增加最小請求量
  timeout: 120000 // 增加恢復等待時間到 2 分鐘
});
```

### 問題 2: 告警過多

**症狀**: 收到大量重複告警

**原因**:
- 告警冷卻期設置過短
- 閾值設置過於敏感

**解決方案**:
```typescript
const monitor = createDOMonitor(env, {
  alerts: {
    enabled: true,
    cooldownPeriod: 600000, // 增加冷卻期到 10 分鐘
    maxAlertsPerHour: 5 // 每小時最多 5 個告警
  },
  thresholds: {
    errorRate: 0.15, // 增加到 15%
    latency: 1500, // 增加到 1.5 秒
    connectionUtilization: 0.9 // 增加到 90%
  }
});
```

### 問題 3: 日誌過多導致性能問題

**症狀**: 系統變慢，日誌輸出過多

**解決方案**:
```typescript
// 調整日誌級別
const logger = createLogger({ service: 'MyService' }, {
  minLevel: LogLevel.INFO, // 在生產環境只記錄 INFO 以上
  enableConsole: false, // 禁用控制台輸出（只用結構化日誌）
  maxContextSize: 5000 // 限制上下文大小
});
```

### 問題 4: DO 實例監控失敗

**症狀**: `performHealthCheck()` 超時或失敗

**原因**:
- DO 實例數量過多
- 健康檢查超時設置過短

**解決方案**:
```typescript
// 檢查 durable-objects-monitor.ts 中的超時設置
private async callWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  // 增加超時時間
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 秒
  });

  return Promise.race([promise, timeoutPromise]);
}
```

---

## 最佳實踐

###  DO

1. **在關鍵路徑使用 Circuit Breaker**
   - 所有外部 API 調用
   - Durable Objects 調用
   - 數據庫操作

2. **設置合理的閾值**
   - 基於實際業務負載調整
   - 定期回顧和優化

3. **提供降級方案**
   - 優先級：Cache > Queue > Fail Fast
   - 確保降級方案本身也有容錯

4. **結構化日誌最佳實踐**
   - 使用有意義的上下文
   - 避免記錄敏感信息
   - 生產環境使用 INFO 以上級別

5. **告警處理**
   - 設置告警冷卻期避免轟炸
   - 分級告警（Warning vs Critical）
   - 自動化告警處理流程

###  DON'T

1.  不要在循環中創建新的 Logger 實例
2.  不要過度依賴 Circuit Breaker（修復根本問題更重要）
3.  不要忽略 DEGRADED 狀態的告警
4.  不要在日誌中記錄密碼、Token 等敏感信息
5.  不要禁用告警（即使很煩）

---

## 更多資源

- **源代碼**:
  - `src/services/logger-service.ts`
  - `src/services/durable-objects-monitor.ts`
  - `src/services/websocket-circuit-breaker.ts`
  - `src/handlers/monitoring-main.ts`

- **測試**:
  - `tests/unit/logger-service.test.ts`
  - `tests/integration/circuit-breaker.test.ts`

- **相關文檔**:
  - `docs/HARDCODING_BEST_PRACTICES.md`
  - `docs/claude/WEBSOCKET_ARCHITECTURE.md`

---

**問題反饋**: 如有任何問題，請提交 GitHub Issue 或聯繫技術團隊。
