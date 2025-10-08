# WebSocket 遷移完整實施指南

## 📋 目錄

- [系統概覽](#系統概覽)
- [架構設計](#架構設計)
- [已完成的實施](#已完成的實施)
- [功能開關使用](#功能開關使用)
- [監控 Dashboard](#監控-dashboard)
- [測試驗證](#測試驗證)
- [部署步驟](#部署步驟)
- [故障排除](#故障排除)

---

## 系統概覽

本遷移計劃實現了從 **Server-Sent Events (SSE)** 到 **WebSocket + Durable Objects** 的完整升級，具備以下特性：

### ✨ 核心特性

- ✅ **雙協議支援**: WebSocket 與 SSE 共存
- ✅ **功能開關系統**: 動態控制協議啟用/停用
- ✅ **即時監控**: 完整的健康檢查與指標追蹤
- ✅ **優雅降級**: WebSocket 失敗自動回退至 SSE
- ✅ **零停機切換**: 漸進式發布策略

### 📊 系統架構

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend Layer                         │
├──────────────────────────────────────────────────────────┤
│  • useRealtime Composable (動態協議選擇)                 │
│  • WebSocketAdmin (功能開關管理)                         │
│  • WebSocketMonitoring (即時監控)                        │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                    Config Layer                           │
├──────────────────────────────────────────────────────────┤
│  • realtime.ts (統一配置管理)                            │
│  • .env.development (環境變數)                           │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                    Backend Layer                          │
├──────────────────────────────────────────────────────────┤
│  • websocket-main.ts (WebSocket 處理器)                  │
│  • websocket-broadcast-service.ts (事件廣播)            │
│  • Migration Config (KV 儲存)                            │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│               Durable Objects Layer                       │
├──────────────────────────────────────────────────────────┤
│  • ConversationRoom (對話室管理)                        │
│  • UserConnection (用戶連線管理)                        │
│  • MessageBroadcaster (訊息廣播)                        │
│  • DelayedMessageProcessor (延遲訊息)                   │
└──────────────────────────────────────────────────────────┘
```

---

## 已完成的實施

### ✅ Phase 1: 視覺化規劃與架構設計

**完成項目**:
- 完整的遷移策略文檔
- 三階段實施計劃
- 風險評估與緩解措施

### ✅ Phase 2: 啟用 WebSocket 測試環境

**完成項目**:
1. **後端配置** (`wrangler.toml`)
   - ✅ 6 個 Durable Objects 綁定已配置
   - ✅ WebSocket 路由已啟用
   - ✅ 健康檢查端點已部署

2. **前端環境變數** (`.env.development`)
   ```bash
   VITE_WEBSOCKET_ENABLED=false          # 預設關閉
   VITE_WEBSOCKET_URL=wss://...          # WebSocket URL
   VITE_FALLBACK_TO_SSE=true             # 啟用 SSE 回退
   VITE_WEBSOCKET_AUTO_RECONNECT=true    # 自動重連
   VITE_WEBSOCKET_DEBUG=true             # Debug 模式
   ```

3. **前端配置模組** (`frontend/src/config/realtime.ts`)
   - ✅ 統一配置管理
   - ✅ 環境變數載入
   - ✅ 協議選擇邏輯

4. **前端動態選擇服務** (`frontend/src/composables/useRealtime.ts`)
   - ✅ WebSocket/SSE 自動切換
   - ✅ 優雅降級機制
   - ✅ 連線狀態管理

### ✅ Phase 3: 建立功能開關管理介面

**完成項目**:
1. **後端 API** (`src/handlers/websocket-main.ts`)
   - ✅ `GET /api/websocket/migration-status` - 查詢配置
   - ✅ `POST /api/websocket/migration-config` - 更新配置 (需 Admin 權限)
   - ✅ KV 儲存的動態配置

2. **前端管理界面** (`frontend/src/views/WebSocketAdmin.vue`)
   - ✅ 視覺化功能開關
   - ✅ 發布百分比控制
   - ✅ 遷移策略選擇
   - ✅ 健康狀態顯示

### ✅ Phase 4: 建立監控 Dashboard

**完成項目**:
1. **後端監控 API**
   - ✅ `GET /api/websocket/health` - 健康檢查
   - ✅ `GET /api/websocket/metrics` - 即時指標
   - ✅ `GET /api/websocket/readiness` - 就緒檢查
   - ✅ `GET /api/websocket/liveness` - 存活檢查

2. **前端監控界面** (`frontend/src/views/WebSocketMonitoring.vue`)
   - ✅ 即時指標卡片
   - ✅ 連線類型分佈圖
   - ✅ Durable Objects 狀態
   - ✅ 系統告警顯示
   - ✅ 自動刷新機制

### ✅ Phase 5: 測試 WebSocket 端點可用性

**完成項目**:
1. **測試腳本** (`test-websocket-migration.sh`)
   - ✅ 公開端點測試
   - ✅ 監控端點測試
   - ✅ 前端配置驗證
   - ✅ 自動化測試報告

2. **測試結果**:
   ```
   ✅ WebSocket Health Check - PASS
   ✅ Migration Status - PASS
   ✅ Readiness Check - PASS
   ✅ Liveness Check - PASS
   ```

---

## 功能開關使用

### 🎛️ 配置選項

所有配置儲存在 **Cloudflare KV** 中的 `websocket_migration_config` 鍵：

```typescript
interface MigrationConfig {
  enableWebSocket: boolean              // 啟用 WebSocket
  enableSSE: boolean                    // 啟用 SSE (fallback)
  migrationStrategy: string             // 遷移策略
  rolloutPercentage: number             // 發布百分比 (0-100)
  featureFlags: {
    websocketConnections: boolean
    durableObjectMessaging: boolean
    distributedLocking: boolean
    batchMessageProcessing: boolean
    realTimeTypingIndicators: boolean
  }
}
```

### 📝 配置管理

#### 方法 1: 透過管理介面 (推薦)

1. 訪問 `https://your-domain.com/admin/websocket`
2. 使用視覺化介面調整配置
3. 點擊「保存配置」

#### 方法 2: 透過 API

```bash
# 查詢當前配置
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# 更新配置 (需要 Admin Token)
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableWebSocket": true,
    "enableSSE": true,
    "rolloutPercentage": 10
  }'
```

### 🔄 遷移策略

#### 1. **Immediate** (立即切換)
- 適用於: 小規模系統或測試環境
- 特點: 一次性切換所有用戶
- 風險: 高

#### 2. **Gradual** (漸進式) ⭐ 推薦
- 適用於: 生產環境
- 特點: 逐步提升 `rolloutPercentage`
- 建議步驟:
  1. 設置 `rolloutPercentage: 5` (5% 用戶)
  2. 監控 24 小時
  3. 逐步提升至 10%, 25%, 50%, 100%

#### 3. **Canary** (金絲雀)
- 適用於: 關鍵業務系統
- 特點: 特定用戶群組測試
- 實施: 需要自定義用戶群組邏輯

---

## 監控 Dashboard

### 📊 即時指標

訪問監控 Dashboard: `https://your-domain.com/monitoring/websocket`

**可用指標**:
- 🔌 **活躍連線數**: 當前 WebSocket 連線總數
- 📨 **訊息吞吐量**: 每秒處理的訊息數
- ⏱️ **平均延遲**: 訊息傳遞平均延遲
- ⚠️ **錯誤率**: 錯誤發生率百分比
- 📈 **連線類型分佈**: WebSocket vs SSE 比例
- 🏗️ **Durable Objects 狀態**: 各 DO 實例數量

### 🔔 告警閾值

系統會在以下情況觸發告警：

| 告警類型 | 閾值 | 嚴重度 |
|---------|------|--------|
| 高錯誤率 | > 10% | 🔴 Error |
| 超高延遲 | > 1000ms | 🟡 Warning |
| 服務降級 | status === 'degraded' | 🟡 Warning |
| 服務異常 | status === 'unhealthy' | 🔴 Error |

### 📈 監控最佳實踐

1. **每日檢查**: 每天查看監控 Dashboard
2. **告警響應**: 收到告警立即調查
3. **定期分析**: 每週分析趨勢圖表
4. **容量規劃**: 根據連線數增長規劃擴容

---

## 測試驗證

### 🧪 執行自動化測試

```bash
# 執行完整測試
bash test-websocket-migration.sh

# 使用自定義 API URL
BASE_URL=https://your-domain.com bash test-websocket-migration.sh
```

### 📋 手動測試清單

#### 1. 健康檢查
```bash
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health
```

**預期結果**:
```json
{
  "status": "healthy",
  "websocketEnabled": false,
  "sseEnabled": true,
  "activeConnections": 0,
  "totalConnections": 0,
  "averageLatency": 0,
  "errorRate": 0,
  "timestamp": 1234567890
}
```

#### 2. 遷移配置
```bash
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status
```

**預期結果**:
```json
{
  "enableWebSocket": false,
  "enableSSE": true,
  "migrationStrategy": "gradual",
  "rolloutPercentage": 0,
  "featureFlags": { ... }
}
```

#### 3. 前端配置驗證
```bash
# 檢查環境變數
cat frontend/.env.development | grep VITE_WEBSOCKET

# 檢查配置模組
ls -l frontend/src/config/realtime.ts

# 檢查 composable
ls -l frontend/src/composables/useRealtime.ts
```

---

## 部署步驟

### 🚀 Step-by-Step 部署流程

#### 步驟 1: 準備階段 (Day 0)

```bash
# 1. 確認所有檔案已建立
ls -l frontend/src/config/realtime.ts
ls -l frontend/src/composables/useRealtime.ts
ls -l frontend/src/views/WebSocketAdmin.vue
ls -l frontend/src/views/WebSocketMonitoring.vue

# 2. 執行測試
bash test-websocket-migration.sh

# 3. 確認後端配置
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health
```

#### 步驟 2: 前端部署 (Day 1)

```bash
# 1. 構建前端
cd frontend
npm run build

# 2. 部署到 Cloudflare Pages
npm run deploy:pages

# 3. 驗證部署
curl https://your-frontend-domain.com
```

#### 步驟 3: 小規模試點 (Day 2-3)

```bash
# 1. 啟用 5% WebSocket
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enableWebSocket": true, "rolloutPercentage": 5}'

# 2. 監控 24 小時
# 訪問監控 Dashboard 持續觀察

# 3. 檢查錯誤率和延遲
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics
```

#### 步驟 4: 逐步擴大 (Day 4-14)

```bash
# Day 4: 提升至 10%
curl -X POST ... -d '{"rolloutPercentage": 10}'

# Day 7: 提升至 25%
curl -X POST ... -d '{"rolloutPercentage": 25}'

# Day 10: 提升至 50%
curl -X POST ... -d '{"rolloutPercentage": 50}'

# Day 14: 100% 全量
curl -X POST ... -d '{"rolloutPercentage": 100}'
```

#### 步驟 5: 關閉 SSE (Day 30+)

```bash
# 確認 WebSocket 穩定運行 2 週後
curl -X POST ... -d '{"enableSSE": false, "rolloutPercentage": 100}'
```

---

## 故障排除

### ❓ 常見問題

#### 1. WebSocket 連線失敗

**症狀**: 前端無法建立 WebSocket 連線

**檢查步驟**:
```bash
# 1. 檢查後端健康狀態
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 2. 檢查 Durable Objects 綁定
wrangler tail --format pretty

# 3. 檢查前端配置
console.log(realtimeConfig)
```

**解決方案**:
- 確認 `VITE_WEBSOCKET_ENABLED=true`
- 確認 WebSocket URL 正確
- 檢查防火牆是否阻擋 WebSocket

#### 2. 功能開關無效

**症狀**: 更新配置後沒有生效

**檢查步驟**:
```bash
# 1. 驗證配置已儲存
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# 2. 清除 KV 快取 (如果需要)
wrangler kv:key delete websocket_migration_config --binding=SESSIONS

# 3. 重新設置配置
curl -X POST ... -d '{"enableWebSocket": true}'
```

#### 3. 高錯誤率

**症狀**: 錯誤率超過 10%

**檢查步驟**:
```bash
# 1. 查看詳細指標
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics

# 2. 檢查 Durable Objects 日誌
wrangler tail --format pretty

# 3. 降低發布百分比
curl -X POST ... -d '{"rolloutPercentage": 5}'
```

**解決方案**:
- 立即降低 `rolloutPercentage`
- 啟用 SSE fallback: `{"enableSSE": true}`
- 調查錯誤日誌找出根本原因

#### 4. 高延遲

**症狀**: 平均延遲超過 500ms

**可能原因**:
- Durable Objects 冷啟動
- 網路延遲
- 訊息處理邏輯過慢

**解決方案**:
```bash
# 1. 啟用 Durable Objects 預熱
# (需要在 worker 中實現)

# 2. 優化訊息處理邏輯
# 檢查 ConversationRoom 和 MessageBroadcaster 代碼

# 3. 考慮使用 CDN 加速
```

### 🆘 緊急回退程序

如果遇到嚴重問題需要緊急回退：

```bash
# 1. 立即停用 WebSocket
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "enableWebSocket": false,
    "enableSSE": true,
    "rolloutPercentage": 0
  }'

# 2. 驗證系統恢復
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 3. 通知團隊並調查問題
```

---

## 📚 相關文檔

- [後端 WebSocket 處理器](src/handlers/websocket-main.ts)
- [前端即時通訊配置](frontend/src/config/realtime.ts)
- [前端動態選擇服務](frontend/src/composables/useRealtime.ts)
- [WebSocket 管理介面](frontend/src/views/WebSocketAdmin.vue)
- [監控 Dashboard](frontend/src/views/WebSocketMonitoring.vue)

---

## 📞 支援與聯絡

如有任何問題或需要協助，請：
1. 檢查本指南的「故障排除」章節
2. 查看監控 Dashboard 的告警資訊
3. 檢查系統日誌 (`wrangler tail`)
4. 聯絡開發團隊

---

**最後更新**: 2025-10-08
**版本**: 1.0.0
**狀態**: ✅ 生產就緒
