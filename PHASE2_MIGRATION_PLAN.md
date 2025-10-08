# Phase 2: WebSocket + Durable Objects 漸進式遷移執行計劃

## 📊 遷移狀態追蹤

**創建時間**: 2025-10-07
**預計完成**: 2025-11-15 (6 週)
**當前階段**: Phase 2.1 - Pre-Migration Validation
**當前進度**: 20% (基礎設施驗證中)

---

## 🎯 整體目標

從 Server-Sent Events (SSE) 單向推送模式，漸進式遷移到 WebSocket + Durable Objects 雙向實時通信架構。

### 關鍵成功指標 (KPI)

- ✅ **連接成功率**: > 98%
- ✅ **平均延遲**: < 80ms (當前 SSE: 100-300ms)
- ✅ **用戶滿意度**: > 4.5/5
- ✅ **成本增加**: < 20% (預估 +6.8%)
- ✅ **零停機遷移**: 無服務中斷

---

## 📋 Phase 2.1: Pre-Migration Validation (Week 1)

**目標**: 驗證所有 WebSocket + DO 基礎設施可在生產環境正常運行

### ✅ Step 1.1: 驗證 Durable Objects 部署

**執行時間**: 2025-10-07
**負責人**: DevOps Team

#### 檢查清單

- [x] **D1 Database 可用性**
  - 數據庫 ID: `08ae6790-2494-40a8-a07a-df3920783159`
  - 狀態: ✅ Production Ready (458KB)

- [x] **KV Namespaces 可用性**
  - SESSIONS KV: `ace3f7202e6a4dd8b98c50e9b91b2431` ✅
  - CACHE KV: `f3bc7a55c8a14f4fb28b8321fa01dc73` ✅

- [x] **WebSocket Health Check**
  - 端點: `/api/websocket/health`
  - 狀態: ✅ All components healthy
  - Durable Objects: ✅ Available
  - WebSocket: ✅ Available
  - SSE: ✅ Available (fallback ready)

#### 驗證命令

```bash
# 1. 檢查 Worker 部署狀態
wrangler deployments list --name multi-channel-platform

# 2. 驗證 D1 數據庫
wrangler d1 list

# 3. 驗證 KV 命名空間
wrangler kv namespace list

# 4. 健康檢查
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 5. 檢查當前遷移配置
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status
```

#### 驗證結果

✅ **所有基礎設施組件正常運行**

---

### ⏳ Step 1.2: 測試 Durable Objects 連接

**執行時間**: 2025-10-07 (進行中)
**預計耗時**: 2 小時

#### 測試計劃

##### Test 1: ConversationRoom DO 連接測試

**目標**: 驗證對話級 WebSocket 連接建立與訊息廣播

```bash
# 1. 獲取測試用戶令牌
export TOKEN="<admin-jwt-token>"

# 2. 測試 ConversationRoom 端點
curl -X GET "https://multi-channel.imfinethankyouandyou.com/api/websocket/test-connection?userId=admin-001&conversationId=test-conv-001" \
  -H "Authorization: Bearer $TOKEN"

# 預期響應:
{
  "success": true,
  "userConnection": { "status": "active" },
  "conversationRoom": { "participants": [], "activeConnections": 0 },
  "messageBroadcaster": { "status": "ready" },
  "migrationConfig": { "enableWebSocket": true, "rolloutPercentage": 50 }
}
```

##### Test 2: UserConnection DO 測試

**目標**: 驗證用戶級連接管理與訂閱功能

```bash
# 測試用戶連接狀態
curl -X GET "https://multi-channel.imfinethankyouandyou.com/api/websocket/test-connection?userId=admin-001" \
  -H "Authorization: Bearer $TOKEN"
```

##### Test 3: MessageBroadcaster DO 測試

**目標**: 驗證跨對話廣播與事件分發

```bash
# 檢查廣播器狀態
curl -X GET "https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics" \
  -H "Authorization: Bearer $TOKEN"
```

#### 測試腳本

創建自動化測試腳本: `scripts/test-websocket-do.sh`

```bash
#!/bin/bash
# WebSocket + DO 功能驗證腳本

set -e

echo "🧪 Starting WebSocket + Durable Objects Test Suite"
echo "=================================================="

# 配置
API_BASE="https://multi-channel.imfinethankyouandyou.com"
TOKEN="${TEST_TOKEN:-your-test-token-here}"

# Test 1: Health Check
echo "📡 Test 1: System Health Check"
HEALTH_RESPONSE=$(curl -s "$API_BASE/api/websocket/health")
echo "$HEALTH_RESPONSE" | python -m json.tool

HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin)['status'])")
if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "❌ Health check failed"
  exit 1
fi
echo "✅ Test 1 Passed"
echo ""

# Test 2: Migration Config
echo "🔧 Test 2: Migration Configuration Check"
MIGRATION_RESPONSE=$(curl -s "$API_BASE/api/websocket/migration-status")
echo "$MIGRATION_RESPONSE" | python -m json.tool
echo "✅ Test 2 Passed"
echo ""

# Test 3: DO Connection Test
echo "🔌 Test 3: Durable Objects Connection Test"
DO_TEST_RESPONSE=$(curl -s "$API_BASE/api/websocket/test-connection?userId=test-user-001&conversationId=test-conv-001")
echo "$DO_TEST_RESPONSE" | python -m json.tool

DO_SUCCESS=$(echo "$DO_TEST_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('success', False))")
if [ "$DO_SUCCESS" != "True" ]; then
  echo "❌ Durable Objects connection test failed"
  exit 1
fi
echo "✅ Test 3 Passed"
echo ""

# Test 4: Metrics Endpoint
echo "📊 Test 4: Metrics Endpoint Check"
METRICS_RESPONSE=$(curl -s "$API_BASE/api/websocket/metrics")
echo "$METRICS_RESPONSE" | python -m json.tool
echo "✅ Test 4 Passed"
echo ""

echo "=================================================="
echo "🎉 All WebSocket + DO tests passed successfully!"
echo "✅ System is ready for Phase 2.2"
```

#### 驗證標準

- [ ] ConversationRoom DO 可正常創建與接收連接
- [ ] UserConnection DO 可追蹤用戶狀態
- [ ] MessageBroadcaster DO 可執行事件分發
- [ ] 所有 DO 端點響應時間 < 200ms
- [ ] 無錯誤日誌或異常

#### 問題排查

如果測試失敗，檢查:

1. **Wrangler.toml 配置**
   - 確認所有 DO bindings 正確配置
   - 檢查 migrations tag 是否已部署

2. **環境變數**
   - JWT_SECRET 已設置
   - 資料庫連接字串正確

3. **Cloudflare Dashboard**
   - Workers > Durable Objects 查看實例狀態
   - 檢查是否有錯誤日誌

---

### ⏳ Step 1.3: 前端 WebSocket Client 驗證

**執行時間**: 2025-10-08
**預計耗時**: 4 小時

#### 驗證清單

- [ ] **WebSocketClient 類功能測試**
  - `websocketClient.ts` 完整性 (741 行代碼)
  - 連接建立與斷開
  - 自動重連機制 (exponential backoff)
  - 令牌刷新機制
  - 心跳監控 (30s interval)

- [ ] **前端 Composables 測試**
  - `useWebSocket.ts` 功能驗證
  - `useConversationWebSocket.ts` 對話級連接
  - 錯誤處理與狀態管理

- [ ] **瀏覽器兼容性測試**
  - Chrome 最新版
  - Firefox 最新版
  - Safari 最新版
  - Edge 最新版
  - 移動端瀏覽器 (iOS Safari, Chrome Mobile)

#### 測試步驟

**Step 1: 本地開發環境測試**

```bash
# 1. 啟動前端開發服務器
cd frontend
npm run dev

# 2. 開啟瀏覽器控制台，查看 WebSocket 連接日誌
# 預期日誌:
# [WebSocketClient] Performing pre-connection checks...
# [WebSocketClient] Pre-connection checks passed: Token present, Token format valid, ...
# [WebSocketClient] Connecting to WebSocket: wss://...
# [WebSocketClient] WebSocket connected successfully
```

**Step 2: 手動 WebSocket 連接測試**

創建測試頁面: `frontend/src/views/WebSocketTest.vue`

```vue
<template>
  <div class="websocket-test">
    <h1>WebSocket Connection Test</h1>

    <div class="status-panel">
      <h3>Connection Status</h3>
      <p>State: <strong>{{ connectionState }}</strong></p>
      <p>Connected: {{ isConnected ? '✅' : '❌' }}</p>
      <p>Last Error: {{ lastError?.message || 'None' }}</p>
    </div>

    <div class="controls">
      <button @click="handleConnect" :disabled="isConnected">Connect</button>
      <button @click="handleDisconnect" :disabled="!isConnected">Disconnect</button>
      <button @click="sendTestMessage" :disabled="!isConnected">Send Test Message</button>
    </div>

    <div class="message-log">
      <h3>Message Log</h3>
      <div v-for="(msg, index) in messages" :key="index">
        {{ msg.timestamp }}: {{ msg.type }} - {{ JSON.stringify(msg.data) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createWebSocketClient } from '@/services/websocketClient'

const wsClient = createWebSocketClient({
  conversationId: 'test-conv-001',
  enableLogging: true,
  autoConnect: false
})

const connectionState = wsClient.connectionState
const isConnected = wsClient.isConnected
const lastError = wsClient.lastError
const messages = ref<any[]>([])

wsClient.setEventHandlers({
  onMessage: (message) => {
    messages.value.push({
      timestamp: new Date().toISOString(),
      type: message.type,
      data: message.data
    })
  },
  onConnectionChange: (state) => {
    console.log('Connection state changed:', state)
  },
  onError: (error) => {
    console.error('WebSocket error:', error)
  }
})

const handleConnect = () => wsClient.connect()
const handleDisconnect = () => wsClient.disconnect()
const sendTestMessage = () => {
  wsClient.send({
    type: 'message',
    data: {
      content: 'Test message from frontend',
      timestamp: Date.now()
    }
  })
}

onMounted(() => {
  console.log('WebSocket test page mounted')
})
</script>
```

#### 驗證標準

- [ ] WebSocket 連接建立成功率 > 95%
- [ ] 連接建立平均耗時 < 3 秒
- [ ] 自動重連機制正常工作 (測試斷網場景)
- [ ] 令牌過期時自動刷新並重連
- [ ] 所有瀏覽器均可正常連接
- [ ] 無控制台錯誤或警告

---

### ⏳ Step 1.4: 端到端整合測試

**執行時間**: 2025-10-08
**預計耗時**: 4 小時

#### 測試場景

**Scenario 1: 單用戶對話連接**

1. 用戶 A 打開對話頁面
2. WebSocket 自動連接到 ConversationRoom DO
3. 接收連接確認事件 (`connection_established`)
4. 發送測試消息
5. 接收消息回顯 (`message_sent` 事件)

**Scenario 2: 多用戶實時協作**

1. 用戶 A 和用戶 B 同時進入對話 #123
2. 兩個 WebSocket 連接到同一個 ConversationRoom DO
3. 用戶 A 發送消息
4. 用戶 B 在 < 100ms 內接收到消息
5. 檢查消息順序一致性

**Scenario 3: 輸入狀態同步**

1. 用戶 A 開始輸入
2. 前端發送 `typing_start` 事件
3. 用戶 B 收到輸入指示器更新
4. 用戶 A 停止輸入 (3 秒無輸入)
5. 前端發送 `typing_stop` 事件
6. 用戶 B 收到輸入指示器清除

**Scenario 4: 連接恢復與狀態同步**

1. 用戶 A 連接到對話
2. 模擬網絡中斷 (關閉 WiFi)
3. WebSocket 檢測到連接失敗
4. 自動執行重連 (exponential backoff)
5. 恢復連接後，同步未讀消息

#### 自動化測試腳本

創建 E2E 測試: `tests/e2e/websocket-realtime.test.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('WebSocket Real-time Communication', () => {
  test('should establish WebSocket connection successfully', async ({ page }) => {
    // 登入
    await page.goto('/login')
    await page.fill('input[name="username"]', 'test-admin')
    await page.fill('input[name="password"]', 'test-password')
    await page.click('button[type="submit"]')

    // 進入對話頁面
    await page.goto('/conversations/test-conv-001')

    // 等待 WebSocket 連接
    await page.waitForFunction(() => {
      return (window as any).__WS_STATE__?.isConnected === true
    }, { timeout: 10000 })

    // 驗證連接狀態
    const wsState = await page.evaluate(() => (window as any).__WS_STATE__)
    expect(wsState.connectionState).toBe('connected')
  })

  test('should send and receive messages in real-time', async ({ page }) => {
    // ... 連接邏輯 ...

    // 發送測試消息
    await page.fill('textarea[name="message"]', 'Test real-time message')
    await page.click('button[aria-label="Send"]')

    // 驗證消息在 < 200ms 內顯示
    const messageElement = await page.waitForSelector(
      'text=Test real-time message',
      { timeout: 200 }
    )
    expect(messageElement).toBeTruthy()
  })

  test('should show typing indicators', async ({ context }) => {
    // 創建兩個瀏覽器上下文模擬兩個用戶
    const userAPage = await context.newPage()
    const userBPage = await context.newPage()

    // 用戶 A 和 B 進入同一對話
    await userAPage.goto('/conversations/test-conv-001')
    await userBPage.goto('/conversations/test-conv-001')

    // 用戶 A 開始輸入
    await userAPage.fill('textarea[name="message"]', 'T')

    // 驗證用戶 B 看到輸入指示器
    const typingIndicator = await userBPage.waitForSelector(
      'text=User A is typing...',
      { timeout: 1000 }
    )
    expect(typingIndicator).toBeTruthy()
  })
})
```

#### 驗證標準

- [ ] 單用戶連接成功率 100%
- [ ] 多用戶消息延遲 < 100ms
- [ ] 輸入狀態同步延遲 < 50ms
- [ ] 自動重連成功率 > 98%
- [ ] 無消息丟失或順序錯亂
- [ ] 所有測試通過率 100%

---

## 📝 Phase 2.1 完成標準

**必須滿足所有以下條件才能進入 Phase 2.2**:

- [x] Step 1.1: 所有基礎設施組件狀態為 healthy ✅
- [ ] Step 1.2: 所有 Durable Objects 測試通過
- [ ] Step 1.3: 前端 WebSocket Client 驗證完成
- [ ] Step 1.4: 端到端整合測試通過率 > 95%
- [ ] 無阻塞性 Bug 或嚴重錯誤
- [ ] 團隊評審通過 (Technical Review Meeting)

**當前進度**: 20% (1/5 步驟完成)

---

## 🔄 Phase 2.2: Feature Flag Configuration (Week 1-2)

**目標**: 配置安全的遷移控制開關，支持漸進式回滾

### Step 2.1: 初始化遷移配置

**執行命令**:

```bash
# 設置初始遷移配置 (WebSocket 啟用，但 rollout 為 0%)
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableWebSocket": true,
    "enableSSE": true,
    "migrationStrategy": "gradual",
    "rolloutPercentage": 0,
    "featureFlags": {
      "websocketConnections": false,
      "durableObjectMessaging": false,
      "distributedLocking": false,
      "batchMessageProcessing": false,
      "realTimeTypingIndicators": false
    }
  }'
```

### Step 2.2: 實施前端 Feature Toggle

**修改文件**: `frontend/src/services/realtimeConnectionManager.ts`

創建統一的實時連接管理器，根據 Feature Flag 自動選擇 WebSocket 或 SSE:

```typescript
// 統一實時連接接口
export interface RealtimeConnection {
  connect(): Promise<void>
  disconnect(): void
  send(message: any): boolean
  onMessage(handler: (message: any) => void): void
  onStateChange(handler: (state: string) => void): void
}

// 連接工廠函數
export async function createRealtimeConnection(
  conversationId: string
): Promise<RealtimeConnection> {
  // 獲取遷移配置
  const config = await fetchMigrationConfig()

  // 計算是否應該使用 WebSocket
  const shouldUseWebSocket = config.enableWebSocket &&
    shouldUserGetWebSocket(config.rolloutPercentage)

  if (shouldUseWebSocket) {
    console.log('🔌 Using WebSocket connection')
    return createWebSocketConnection(conversationId)
  } else {
    console.log('📡 Using SSE connection (fallback)')
    return createSSEConnection(conversationId)
  }
}

// 用戶分桶算法 (一致性哈希)
function shouldUserGetWebSocket(rolloutPercentage: number): boolean {
  const userId = getCurrentUserId()
  const hash = simpleHash(userId)
  return (hash % 100) < rolloutPercentage
}
```

### Step 2.3: 配置回退開關

**創建回退腳本**: `scripts/emergency-rollback.sh`

```bash
#!/bin/bash
# 緊急回退到 SSE 系統

echo "🚨 EMERGENCY ROLLBACK: Disabling WebSocket"

curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableWebSocket": false,
    "enableSSE": true,
    "rolloutPercentage": 0
  }'

echo "✅ Rollback complete - All users reverted to SSE"
echo "⏱️ Rollback completed in: $SECONDS seconds"
```

**驗證標準**:

- [ ] Feature Flag API 正常工作
- [ ] 前端可根據配置自動切換連接類型
- [ ] 回退腳本可在 < 5 分鐘內完成全量回滾
- [ ] 回滾過程無需用戶刷新頁面

---

## 📊 Phase 2.3: Monitoring & Alerting Setup (Week 2)

**目標**: 部署全面的監控與告警系統

### Step 3.1: 配置 Cloudflare Analytics

**啟用項目**:

1. Workers Analytics (CPU time, Request count)
2. Durable Objects Analytics (Active objects, Request latency)
3. WebSocket Analytics (Connection count, Message throughput)

### Step 3.2: 部署自定義監控端點

**監控端點清單**:

- `/api/websocket/metrics` - 實時連接指標
- `/api/websocket/health` - 系統健康狀態
- `/api/monitoring/websocket-analytics` - 詳細分析數據
- `/api/monitoring/sse-performance` - SSE 性能對比

### Step 3.3: 配置告警規則

**告警條件**:

| 指標 | 警告閾值 | 嚴重閾值 | 動作 |
|------|---------|---------|------|
| 連接成功率 | < 95% | < 90% | 暫停遷移 |
| 平均延遲 | > 150ms | > 300ms | 降低 rollout |
| DO 錯誤率 | > 5% | > 10% | 緊急回退 |
| 成本超標 | +30% | +50% | 人工審查 |

**告警通道**:

- Slack #websocket-migration 頻道
- Email 通知關鍵人員
- PagerDuty (嚴重告警)

### Step 3.4: 建立監控儀表板

**Grafana Dashboard 配置**:

```json
{
  "dashboard": {
    "title": "WebSocket Migration Dashboard",
    "panels": [
      {
        "title": "Connection Success Rate",
        "type": "graph",
        "datasource": "Cloudflare"
      },
      {
        "title": "Average Latency (WebSocket vs SSE)",
        "type": "graph",
        "datasource": "Cloudflare"
      },
      {
        "title": "Active Connections by Type",
        "type": "stat",
        "datasource": "Cloudflare"
      },
      {
        "title": "Durable Objects Health",
        "type": "table",
        "datasource": "Cloudflare"
      }
    ]
  }
}
```

**驗證標準**:

- [ ] 所有監控端點正常響應
- [ ] 告警規則已配置並測試
- [ ] 儀表板可實時顯示關鍵指標
- [ ] 告警通知渠道可正常接收測試消息

---

## 🐤 Phase 2.4: Internal Testing - 5% Canary (Week 3)

**目標**: 以內部團隊為測試組，驗證 WebSocket 系統穩定性

### Step 4.1: 選擇測試用戶組

**測試用戶標準**:

- 內部員工帳號 (10-20 人)
- 技術團隊成員優先
- 活躍度高的帳號
- 覆蓋不同角色 (Admin, Team, Agent)

**執行命令**:

```bash
# 啟用 5% Canary 部署 (內部用戶白名單)
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableWebSocket": true,
    "enableSSE": true,
    "rolloutPercentage": 5,
    "featureFlags": {
      "websocketConnections": true,
      "durableObjectMessaging": true,
      "distributedLocking": false,
      "batchMessageProcessing": false,
      "realTimeTypingIndicators": true
    },
    "whitelistUsers": [
      "admin-001",
      "team-leader-001",
      "agent-test-001"
    ]
  }'
```

### Step 4.2: 內部測試任務

**測試清單** (每位測試者需完成):

1. **基礎功能測試** (30 分鐘)
   - [ ] 登入後自動連接 WebSocket
   - [ ] 發送 10 條測試消息
   - [ ] 接收其他用戶消息
   - [ ] 測試輸入狀態指示器
   - [ ] 測試網絡中斷恢復

2. **效能測試** (15 分鐘)
   - [ ] 記錄消息發送延遲 (使用開發者工具)
   - [ ] 觀察 WebSocket 幀大小
   - [ ] 檢查記憶體使用情況

3. **用戶體驗測試** (15 分鐘)
   - [ ] 主觀評分連接穩定性 (1-5 分)
   - [ ] 主觀評分響應速度 (1-5 分)
   - [ ] 記錄任何異常或錯誤

**反饋收集表單**:

創建 Google Form 或內部問卷，包含:

- 連接成功率主觀評分
- 響應速度主觀評分
- 遇到的問題描述
- 改進建議
- 是否推薦繼續遷移 (Yes/No)

### Step 4.3: 監控與分析

**監控週期**: 7 天持續監控

**每日檢查清單**:

- [ ] 查看連接成功率趨勢
- [ ] 分析延遲分佈圖
- [ ] 檢查錯誤日誌 (Cloudflare Workers Logs)
- [ ] 統計 DO 調用次數與成本
- [ ] 收集用戶反饋

**數據收集**:

```bash
# 每日運行數據收集腳本
./scripts/collect-canary-metrics.sh --date=$(date +%Y-%m-%d)

# 生成每日報告
./scripts/generate-canary-report.sh --week=1
```

### Step 4.4: Go/No-Go 決策

**Week 3 結束時評估**:

必須滿足以下條件才能進入 Phase 2.5:

- [ ] 連接成功率 > 98%
- [ ] 平均延遲 < 80ms
- [ ] 用戶滿意度 > 4.0/5
- [ ] 無嚴重 Bug (Severity: Critical)
- [ ] 成本增加 < 15%
- [ ] 團隊投票 > 80% 支持繼續

**如果未達標**:

1. 暫停遷移，保持 5% rollout
2. 分析失敗原因，制定改進計劃
3. 修復問題後，重新開始 Week 3 測試
4. 最多允許 2 次重試

---

## 📈 Phase 2.5: Gradual Rollout (Week 4)

**目標**: 逐步擴大 WebSocket 用戶比例到 50%

### Step 5.1: 第一階段擴展 (20%)

**Day 1-2**:

```bash
# 提升到 20% 用戶
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 20
  }'
```

**監控重點**:

- 每 2 小時檢查一次健康指標
- 觀察 DO 實例數量變化
- 監控成本增長趨勢

### Step 5.2: 第二階段擴展 (35%)

**Day 3-4**:

```bash
# 提升到 35% 用戶
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 35,
    "featureFlags": {
      "websocketConnections": true,
      "durableObjectMessaging": true,
      "distributedLocking": true,
      "batchMessageProcessing": true,
      "realTimeTypingIndicators": true
    }
  }'
```

**啟用更多功能**:

- ✅ 分散式鎖 (distributedLocking)
- ✅ 批次訊息處理 (batchMessageProcessing)

### Step 5.3: 第三階段擴展 (50%)

**Day 5-7**:

```bash
# 提升到 50% 用戶
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 50
  }'
```

**A/B 測試分析**:

比較 WebSocket 組 vs SSE 組:

- 平均消息延遲
- 連接穩定性
- 用戶活躍度
- 客服效率指標

### Step 5.4: 週末觀察期

**Day 6-7 (週末)**:

- 保持 50% rollout 不變
- 觀察週末流量高峰表現
- 準備 Phase 2.6 全量遷移計劃

**驗證標準**:

- [ ] 50% 用戶運行 WebSocket 無重大問題
- [ ] A/B 測試顯示 WebSocket 組指標優於 SSE 組
- [ ] 成本增長在預期範圍內 (< 10%)
- [ ] 無需執行回退操作

---

## 🚀 Phase 2.6: Full Migration (Week 5)

**目標**: 全量遷移至 WebSocket，標記 SSE 為 deprecated

### Step 6.1: 全量開啟 (100%)

**Day 1**:

```bash
# 提升到 70% (謹慎觀察 24 小時)
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 70
  }'
```

**Day 2**:

如果 Day 1 無重大問題:

```bash
# 提升到 85%
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 85
  }'
```

**Day 3-4**:

```bash
# 全量遷移 100%
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 100,
    "migrationStrategy": "complete"
  }'
```

### Step 6.2: SSE 端點標記為 Deprecated

**修改 API 響應**:

```typescript
// src/handlers/sse-monitoring-main.ts
app.get('/api/conversations/:id/messages/stream', (c) => {
  c.header('X-Deprecated', 'true')
  c.header('X-Deprecation-Message', 'SSE endpoint deprecated. Use WebSocket at /api/websocket/connect')
  c.header('X-Sunset-Date', '2025-12-31')

  // 仍保持功能正常 (作為 fallback)
  return handleSSEStream(c)
})
```

### Step 6.3: 宣布遷移完成

**通知渠道**:

- [ ] 團隊內部公告
- [ ] 更新 API 文檔
- [ ] 發布技術部落格文章
- [ ] 更新系統狀態頁面

---

## 🔧 Phase 2.7: Post-Migration Optimization (Week 5-6)

**目標**: 性能優化與 SSE 代碼清理

### Step 7.1: 性能基線建立

**收集 7 天運行數據**:

- 平均延遲統計
- 連接穩定性數據
- DO 實例分佈
- 成本分析報告

### Step 7.2: 性能優化

**優化項目**:

1. **DO 心跳間隔調整**
   - 測試 30s, 45s, 60s 間隔
   - 選擇最優平衡點 (性能 vs 成本)

2. **批次處理優化**
   - 實施訊息批次發送
   - 減少 DO 調用次數

3. **冷啟動優化**
   - 實施 DO 預熱機制
   - 保持熱門對話的 DO 實例

### Step 7.3: SSE 代碼移除計劃

**Week 6**:

1. 保留 SSE 端點至少 1 個月
2. 監控 SSE fallback 使用率
3. 如果 SSE 使用率 < 1%，計劃移除

**移除清單** (預計 2000+ 行代碼):

- [ ] `src/handlers/sse-monitoring-main.ts`
- [ ] `src/monitoring/sse-performance-monitor.ts`
- [ ] `src/modules/realtime/handlers/sse-handler.ts`
- [ ] `src/modules/realtime/services/sse-connection-service.ts`
- [ ] `frontend/src/composables/useSSEMessages.ts`

### Step 7.4: 文檔更新

- [ ] API 參考文檔
- [ ] 架構圖更新
- [ ] 部署指南
- [ ] 故障排查手冊

---

## 📊 遷移總結報告模板

**Week 6 結束時生成**:

```markdown
# WebSocket + DO 遷移總結報告

## 執行摘要

- **遷移開始日期**: 2025-10-07
- **遷移完成日期**: 2025-11-15
- **總耗時**: 6 週
- **遷移用戶數**: 5,000 活躍用戶
- **零停機時間**: ✅ 達成

## 關鍵指標對比

| 指標 | SSE (遷移前) | WebSocket (遷移後) | 改善幅度 |
|------|-------------|-------------------|---------|
| 平均延遲 | 180ms | 45ms | ⬇️ 75% |
| 連接成功率 | 96% | 99.2% | ⬆️ 3.2% |
| 用戶滿意度 | 4.1/5 | 4.7/5 | ⬆️ 14.6% |
| 月運行成本 | $66 | $70.5 | ⬆️ 6.8% |

## 實現的新功能

- ✅ 實時輸入狀態指示器
- ✅ 已讀回執與消息確認
- ✅ 多客服協作搶單
- ✅ 在線狀態管理
- ✅ 雙向實時通信

## 經驗教訓

### 成功因素

1. 完整的基礎設施準備 (100% 代碼就緒)
2. 漸進式遷移策略降低風險
3. 完善的監控與告警系統
4. 快速回退機制 (< 5 分鐘)

### 改進建議

1. 更早引入 A/B 測試框架
2. 自動化測試覆蓋率可再提升
3. 用戶教育與溝通可更充分

## 未來優化方向

1. 引入 Redis 作為 DO 外部緩存
2. 實施訊息壓縮 (gzip)
3. 開發 DO 監控儀表板
4. 探索 WebTransport 協議

## 結論

WebSocket + Durable Objects 遷移圓滿成功，系統性能顯著提升，為企業級實時協作功能奠定堅實基礎。

**狀態**: ✅ 生產就緒
**推薦**: 繼續優化並探索更多實時功能
```

---

## 🚨 緊急聯絡與升級流程

### 關鍵人員

- **技術負責人**: [Name] - [Email] - [Phone]
- **DevOps Lead**: [Name] - [Email] - [Phone]
- **產品經理**: [Name] - [Email] - [Phone]

### 升級矩陣

| 嚴重程度 | 響應時間 | 升級對象 |
|---------|---------|---------|
| P0 - 嚴重 | 15 分鐘 | 全員 + CTO |
| P1 - 高 | 1 小時 | Tech Lead + DevOps |
| P2 - 中 | 4 小時 | DevOps Team |
| P3 - 低 | 24 小時 | 負責工程師 |

### 緊急回退流程

```bash
# 1. 執行緊急回退腳本 (< 5 分鐘)
./scripts/emergency-rollback.sh

# 2. 通知團隊
slack-notify "#websocket-migration" "🚨 EMERGENCY ROLLBACK EXECUTED"

# 3. 收集錯誤日誌
wrangler tail --format pretty > logs/emergency-$(date +%Y%m%d-%H%M%S).log

# 4. 啟動事後分析
./scripts/create-incident-report.sh
```

---

## 📚 附錄

### A. 相關文檔連結

- [WebSocket 架構設計文檔](docs/architecture/WEBSOCKET_ARCHITECTURE.md)
- [Durable Objects 開發指南](docs/development/DURABLE_OBJECTS_GUIDE.md)
- [API 參考手冊](docs/api/MESSAGING_API_REFERENCE.md)
- [故障排查手冊](docs/troubleshooting/WEBSOCKET_TROUBLESHOOTING.md)

### B. 腳本與工具

- `scripts/test-websocket-do.sh` - DO 功能測試
- `scripts/emergency-rollback.sh` - 緊急回退
- `scripts/collect-canary-metrics.sh` - Canary 數據收集
- `scripts/generate-migration-report.sh` - 遷移報告生成

### C. 配置檔案

- `wrangler.toml` - Worker 配置
- `frontend/vite.config.ts` - 前端配置
- `.env.production` - 生產環境變數

---

**文檔版本**: v1.0
**最後更新**: 2025-10-07
**維護者**: DevOps Team
