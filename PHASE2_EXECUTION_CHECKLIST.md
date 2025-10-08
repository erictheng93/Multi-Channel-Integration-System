# Phase 2 執行檢查清單

**遷移策略**: Option B (完整執行)
**當前日期**: 2025-10-07
**當前階段**: Phase 2.1

---

## ✅ Phase 2.1: Pre-Migration Validation (Week 1)

### Step 1.1: 基礎設施驗證

- [x] **D1 Database 可用性檢查**
  - 數據庫 ID: `08ae6790-2494-40a8-a07a-df3920783159`
  - 狀態: ✅ Production Ready (458KB)
  - 驗證命令: `wrangler d1 list`

- [x] **KV Namespaces 可用性檢查**
  - SESSIONS KV: `ace3f7202e6a4dd8b98c50e9b91b2431` ✅
  - CACHE KV: `f3bc7a55c8a14f4fb28b8321fa01dc73` ✅
  - 驗證命令: `wrangler kv namespace list`

- [x] **Durable Objects Bindings 配置**
  - ConversationRoom ✅
  - UserConnection ✅
  - MessageBroadcaster ✅
  - DelayedMessageProcessor ✅
  - DelayedMessageBuffer ✅
  - 驗證文件: `wrangler.toml`

- [x] **WebSocket Health 端點測試**
  - 端點: `/api/websocket/health`
  - 狀態: ✅ 返回 200 OK
  - 測試命令: `curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health`

- [x] **遷移配置 API 驗證**
  - 端點: `/api/websocket/migration-status`
  - 當前 rolloutPercentage: 50%
  - 測試命令: `curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status`

### Step 1.2: 獲取管理員令牌並測試

- [ ] **獲取管理員令牌**
  - [ ] 方法 1: 前端登入 → DevTools → Local Storage → 複製 `auth_token`
  - [ ] 方法 2: API 登入
    ```bash
    curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"username":"test-admin","password":"Admin123!@#"}'
    ```
  - [ ] 保存令牌: `export ADMIN_TOKEN="<your-token>"`

- [ ] **運行完整驗證測試**
  ```bash
  TEST_TOKEN=$ADMIN_TOKEN bash scripts/test-websocket-do.sh
  ```
  - [ ] Test 1: System Health Check (✅ Passed)
  - [ ] Test 2: Migration Configuration Check (✅ Passed)
  - [ ] Test 3: Durable Objects Connection Test (✅ Passed)
  - [ ] Test 4: WebSocket Metrics Endpoint (✅ Passed)
  - [ ] Test 5: SSE Fallback Availability (✅ Passed)
  - [ ] Test 6: Database Connectivity (✅ Passed)
  - [ ] Test 7: KV Storage Availability (✅ Passed)

### Step 1.3: 重置遷移配置

- [ ] **重置到 0% Rollout**
  ```bash
  ADMIN_TOKEN="<your-token>" bash scripts/reset-migration-config.sh
  ```
  - [ ] 確認重置成功: rolloutPercentage = 0
  - [ ] 確認 WebSocket enabled = true
  - [ ] 確認 SSE enabled = true
  - [ ] 所有 Feature Flags = false

- [ ] **驗證配置已生效**
  ```bash
  curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status
  ```
  預期響應:
  ```json
  {
    "websocketEnabled": true,
    "sseEnabled": true,
    "rolloutPercentage": 0,
    "featureFlags": {
      "websocketConnections": false,
      "durableObjectMessaging": false,
      ...
    }
  }
  ```

### Step 1.4: 前端統一連接管理器整合

- [x] **創建 realtimeConnectionManager.ts**
  - [x] 文件位置: `frontend/src/services/realtimeConnectionManager.ts`
  - [x] 實現 Feature Toggle 邏輯
  - [x] 實現用戶分桶算法 (consistent hashing)
  - [x] WebSocket/SSE 統一接口

- [ ] **修改 ConversationDetail.vue**
  - [ ] 導入 `createRealtimeConnection`
  - [ ] 移除直接使用 `useSSEMessages` 或 `createWebSocketClient`
  - [ ] 使用統一連接管理器
  - [ ] 參考示例: `ConversationDetail.example.vue`

- [ ] **前端代碼修改**
  ```typescript
  // 舊代碼
  // import { useSSEMessages } from '@/composables/useSSEMessages'
  // const sseConnection = useSSEMessages(conversationId)

  // 新代碼
  import { createRealtimeConnection } from '@/services/realtimeConnectionManager'
  const connection = await createRealtimeConnection(conversationId.value)
  ```

### Step 1.5: 瀏覽器功能測試

- [ ] **測試 0% Rollout (所有用戶使用 SSE)**
  1. [ ] 登入系統
  2. [ ] 打開對話頁面
  3. [ ] 開啟 DevTools Console
  4. [ ] 確認日誌顯示: "📡 Using SSE connection (fallback)"
  5. [ ] 發送測試消息確認功能正常

- [ ] **測試 100% Rollout (所有用戶使用 WebSocket)**
  ```bash
  curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"rolloutPercentage": 100}'
  ```
  1. [ ] 刷新頁面 (清除緩存)
  2. [ ] 確認日誌顯示: "🔌 Using WebSocket connection"
  3. [ ] 發送測試消息確認功能正常
  4. [ ] 測試輸入狀態指示器 (typing indicators)

- [ ] **測試 50% Rollout (隨機分桶)**
  ```bash
  curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 50}'
  ```
  1. [ ] 使用不同帳號登入
  2. [ ] 確認約 50% 使用 WebSocket, 50% 使用 SSE
  3. [ ] 驗證同一用戶始終得到相同的連接類型

- [ ] **恢復到 0% Rollout**
  ```bash
  curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 0}'
  ```

### Step 1.6: E2E 自動化測試

- [ ] **Playwright 測試腳本**
  - [ ] 創建測試文件: `tests/e2e/websocket-migration.test.ts`
  - [ ] 測試場景 1: SSE 連接與消息發送
  - [ ] 測試場景 2: WebSocket 連接與消息發送
  - [ ] 測試場景 3: 自動 Fallback (WebSocket 失敗 → SSE)
  - [ ] 測試場景 4: 輸入狀態指示器 (WebSocket only)

- [ ] **運行測試套件**
  ```bash
  cd frontend
  npm run test:e2e
  ```
  - [ ] 所有測試通過 (100%)

### ✅ Phase 2.1 完成標準

**必須滿足所有條件才能進入 Phase 2.2**:

- [ ] 所有驗證測試通過 (7/7)
- [ ] Migration config 已重置為 0%
- [ ] 前端統一連接管理器已整合
- [ ] 瀏覽器功能測試全部通過
- [ ] E2E 自動化測試通過率 > 95%
- [ ] 無阻塞性 Bug 或嚴重錯誤
- [ ] 團隊技術評審通過

**當前進度**: ___% (___/30 項目完成)

---

## ⏳ Phase 2.2: Feature Flag Configuration (Week 1-2)

### Step 2.1: 前端 Feature Toggle 完善

- [ ] **創建 API 請求模組**
  - [ ] 文件: `frontend/src/api/websocket.ts`
  - [ ] 實現 `fetchMigrationConfig()` 函數
  - [ ] 實現配置緩存機制 (60s TTL)

- [ ] **測試 Feature Toggle**
  - [ ] 手動切換 rolloutPercentage
  - [ ] 確認前端自動適應
  - [ ] 無需刷新頁面即可生效

### Step 2.2: 緊急回退機制

- [x] **創建回退腳本**
  - [x] 文件: `scripts/emergency-rollback.sh`
  - [x] 實現一鍵回退功能

- [ ] **測試緊急回退**
  ```bash
  # 測試回退流程
  1. 設置 rolloutPercentage: 50
  2. 執行回退腳本: ./scripts/emergency-rollback.sh
  3. 驗證自動回退到 0%
  4. 驗證前端自動切換到 SSE
  5. 記錄回退耗時 (目標: < 5 分鐘)
  ```
  - [ ] 回退腳本測試通過
  - [ ] 回退耗時 < 5 分鐘
  - [ ] 無需用戶刷新頁面

### Step 2.3: 文檔完善

- [ ] **更新 API 文檔**
  - [ ] 記錄 `/api/websocket/migration-config` 端點
  - [ ] 記錄 `/api/websocket/migration-status` 端點
  - [ ] 提供使用示例

- [ ] **創建操作手冊**
  - [ ] Runbook: 如何調整 rollout 百分比
  - [ ] Runbook: 如何執行緊急回退
  - [ ] Runbook: 如何檢查當前狀態

### ✅ Phase 2.2 完成標準

- [ ] Feature Toggle 功能完整
- [ ] 緊急回退機制測試通過
- [ ] 文檔更新完成
- [ ] 團隊培訓完成

**當前進度**: ___% (___/10 項目完成)

---

## ⏳ Phase 2.3: Monitoring & Alerting Setup (Week 2)

### Step 3.1: Cloudflare Analytics 配置

- [ ] **啟用 Workers Analytics**
  1. [ ] 登入 Cloudflare Dashboard
  2. [ ] 進入 Workers & Pages → multi-channel-platform
  3. [ ] Analytics → Enable Workers Analytics
  4. [ ] 確認指標可見: Request Count, CPU Time, Errors

- [ ] **啟用 Durable Objects Analytics**
  1. [ ] Durable Objects → Analytics
  2. [ ] 確認指標可見: Active Objects, Request Latency
  3. [ ] 設置告警閾值

### Step 3.2: 監控儀表板部署

- [ ] **選擇監控方案**
  - [ ] Option A: Cloudflare Dashboard (推薦 - 免費)
  - [ ] Option B: Grafana (高級功能)

- [ ] **配置關鍵指標面板**
  - [ ] WebSocket 連接成功率
  - [ ] 平均消息延遲 (WebSocket vs SSE)
  - [ ] Durable Objects 實例數量
  - [ ] 每分鐘消息吞吐量
  - [ ] 錯誤率趨勢圖
  - [ ] 成本追蹤圖

### Step 3.3: 告警規則配置

- [ ] **Slack Webhook 設置**
  ```bash
  # 創建 Slack Incoming Webhook
  1. Slack Workspace → Apps → Incoming Webhooks
  2. 創建 #websocket-migration 頻道
  3. 生成 Webhook URL
  4. 測試發送: curl -X POST <webhook-url> -d '{"text":"Test"}'
  ```

- [ ] **配置告警規則**
  - [ ] 嚴重告警 (Critical - P0)
    - 連接成功率 < 90% → 立即通知 + 自動回退
    - 平均延遲 > 500ms → 立即通知
    - DO 錯誤率 > 10% → 立即通知

  - [ ] 警告告警 (Warning - P1)
    - 連接成功率 < 95% → 通知團隊
    - 平均延遲 > 200ms → 通知團隊
    - 成本超出預算 30% → 通知並暫停遷移

- [ ] **測試告警通知**
  - [ ] 手動觸發測試告警
  - [ ] 確認 Slack 接收通知
  - [ ] 確認 Email 接收通知

### Step 3.4: 每日監控流程

- [x] **創建每日健康檢查腳本**
  - [x] 文件: `scripts/daily-health-check.sh`

- [ ] **設置定時任務 (Cron)**
  ```bash
  # 每天早上 9:00 AM 運行健康檢查
  0 9 * * * /path/to/scripts/daily-health-check.sh
  ```

- [ ] **創建週報生成腳本**
  - [ ] 文件: `scripts/generate-weekly-report.sh`
  - [ ] 匯總本週關鍵指標
  - [ ] 生成 Markdown 報告

### ✅ Phase 2.3 完成標準

- [ ] Cloudflare Analytics 已啟用
- [ ] 監控儀表板可正常顯示關鍵指標
- [ ] 告警規則已配置並測試通過
- [ ] 每日健康檢查自動運行
- [ ] 團隊可訪問監控系統

**當前進度**: ___% (___/15 項目完成)

---

## ⏳ Phase 2.4: Internal Testing - 5% Canary (Week 3)

### Step 4.1: 測試用戶選擇

- [ ] **選擇內部測試組 (10-20 人)**
  - [ ] 技術團隊成員 (優先)
  - [ ] 活躍客服人員
  - [ ] 產品經理與設計師
  - [ ] 記錄測試用戶 ID 列表

- [ ] **通知測試用戶**
  - [ ] 發送測試通知 Email
  - [ ] 說明測試目的與時程
  - [ ] 提供反饋收集表單連結

### Step 4.2: 啟動 5% Canary

**執行日期**: Week 3 Day 1 (2025-10-21)
**執行時間**: 上午 10:00 AM

- [ ] **啟用 5% Rollout**
  ```bash
  curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "rolloutPercentage": 5,
      "featureFlags": {
        "websocketConnections": true,
        "durableObjectMessaging": true,
        "realTimeTypingIndicators": true
      }
    }'
  ```

- [ ] **驗證配置已生效**
  ```bash
  curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status
  ```

- [ ] **開始 24/7 監控**
  - [ ] 設置告警 (Slack, Email)
  - [ ] 指定 On-call 工程師
  - [ ] 準備緊急回退流程

### Step 4.3: 每日監控與數據收集 (7 天)

**Day 1-7 每日任務**:

- [ ] **每日健康檢查**
  ```bash
  bash scripts/daily-health-check.sh
  ```

- [ ] **檢查關鍵指標**
  - [ ] 連接成功率: ___% (target: > 98%)
  - [ ] 平均延遲: ___ms (target: < 80ms)
  - [ ] 錯誤率: ___% (target: < 2%)
  - [ ] DO 調用次數: ___
  - [ ] 估計成本: $___

- [ ] **收集用戶反饋**
  - [ ] 檢查反饋表單響應
  - [ ] 記錄任何問題或建議

- [ ] **更新執行日誌**
  - [ ] 記錄當日指標
  - [ ] 記錄任何異常事件

### Step 4.4: Week 3 結束 - Go/No-Go 決策

**決策日期**: 2025-10-27 (Week 3 結束)
**決策會議**: 下午 3:00 PM

**評估標準**:

- [ ] **技術指標達標**
  - [ ] 連接成功率 > 98% ✅/❌
  - [ ] 平均延遲 < 80ms ✅/❌
  - [ ] 錯誤率 < 2% ✅/❌
  - [ ] 無嚴重 Bug (P0/P1) ✅/❌

- [ ] **用戶滿意度達標**
  - [ ] 平均滿意度 > 4.0/5 ✅/❌
  - [ ] 無重大用戶投訴 ✅/❌

- [ ] **成本控制達標**
  - [ ] 成本增加 < 15% ✅/❌

- [ ] **團隊投票**
  - [ ] 團隊投票支持率 > 80% ✅/❌

**決策結果**:

- [ ] ✅ **GO** - 進入 Phase 2.5 (20% → 50% 擴展)
- [ ] ❌ **NO-GO** - 分析問題，修復後重新測試

如果 NO-GO:
- [ ] 記錄失敗原因
- [ ] 制定改進計劃
- [ ] 重新開始 Week 3 測試

### ✅ Phase 2.4 完成標準

- [ ] 5% Canary 運行 7 天無重大問題
- [ ] 所有技術指標達標
- [ ] 用戶反饋積極
- [ ] Go/No-Go 決策通過
- [ ] 準備進入 Week 4

**當前進度**: ___% (___/20 項目完成)

---

## ⏳ Phase 2.5: Gradual Rollout (Week 4)

### Day 1-2: 20% 擴展

- [ ] **提升到 20%**
  ```bash
  curl -X POST "$API_BASE/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 20}'
  ```

- [ ] **監控 48 小時**
  - [ ] Day 1 指標: 連接成功率 __%, 延遲 __ms
  - [ ] Day 2 指標: 連接成功率 __%, 延遲 __ms

### Day 3-4: 35% 擴展

- [ ] **提升到 35%**
  ```bash
  curl -X POST "$API_BASE/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 35,
         "featureFlags": {
           "websocketConnections": true,
           "durableObjectMessaging": true,
           "distributedLocking": true,
           "batchMessageProcessing": true,
           "realTimeTypingIndicators": true
         }}'
  ```

- [ ] **監控 48 小時**
  - [ ] Day 3 指標: 連接成功率 __%, 延遲 __ms
  - [ ] Day 4 指標: 連接成功率 __%, 延遲 __ms

### Day 5-7: 50% 擴展 + A/B 測試

- [ ] **提升到 50%**
  ```bash
  curl -X POST "$API_BASE/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 50}'
  ```

- [ ] **A/B 測試分析**
  - [ ] WebSocket 組平均延遲: __ms
  - [ ] SSE 組平均延遲: __ms
  - [ ] WebSocket 組連接成功率: __%
  - [ ] SSE 組連接成功率: __%
  - [ ] WebSocket 組用戶活躍度: __
  - [ ] SSE 組用戶活躍度: __

- [ ] **週末高峰流量測試**
  - [ ] 觀察週末流量表現
  - [ ] 記錄峰值指標

### ✅ Phase 2.5 完成標準

- [ ] 50% 用戶運行 WebSocket 無重大問題
- [ ] A/B 測試顯示 WebSocket 組優於 SSE 組
- [ ] 成本增長在預期範圍內 (< 10%)
- [ ] 準備進入全量遷移

**當前進度**: ___% (___/10 項目完成)

---

## ⏳ Phase 2.6: Full Migration (Week 5)

### Day 1: 70% 部署

- [ ] **提升到 70%**
  ```bash
  curl -X POST "$API_BASE/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 70}'
  ```

- [ ] **觀察 24 小時**
  - [ ] 指標監控
  - [ ] 無重大問題

### Day 2: 85% 部署

- [ ] **提升到 85%**
  ```bash
  curl -X POST "$API_BASE/api/websocket/migration-config" \
    -d '{"rolloutPercentage": 85}'
  ```

- [ ] **驗證穩定性**
  - [ ] 指標持續監控
  - [ ] 準備全量遷移

### Day 3-4: 100% 全量遷移 🎉

**執行日期**: Week 5 Day 3 (2025-11-06)
**執行時間**: 上午 10:00 AM

- [ ] **提升到 100%**
  ```bash
  curl -X POST "$API_BASE/api/websocket/migration-config" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "rolloutPercentage": 100,
      "migrationStrategy": "complete"
    }'
  ```

- [ ] **監控 48 小時**
  - [ ] 所有指標持續達標
  - [ ] 無重大問題

- [ ] **慶祝遷移完成** 🎉
  - [ ] 團隊內部公告
  - [ ] 更新系統狀態頁面
  - [ ] 發布技術博客文章

### Day 5-7: SSE 端點 Deprecated 標記

- [ ] **標記 SSE 端點為 Deprecated**
  ```typescript
  // src/handlers/sse-monitoring-main.ts
  app.get('/api/conversations/:id/messages/stream', (c) => {
    c.header('X-Deprecated', 'true')
    c.header('X-Deprecation-Message', 'Use WebSocket at /api/websocket/connect')
    c.header('X-Sunset-Date', '2025-12-31')
    // ... 仍保持功能正常
  })
  ```

- [ ] **更新 API 文檔**
  - [ ] 標註 SSE 端點將於 2025-12-31 下線
  - [ ] 推薦使用 WebSocket 端點

### ✅ Phase 2.6 完成標準

- [ ] 100% 用戶已遷移到 WebSocket
- [ ] 所有關鍵指標達標
- [ ] SSE 端點已標記為 deprecated
- [ ] 文檔已更新

**當前進度**: ___% (___/10 項目完成)

---

## ⏳ Phase 2.7: Post-Migration Optimization (Week 5-6)

### 性能優化

- [ ] **建立 7 天性能基線**
  - [ ] 收集連接成功率數據
  - [ ] 收集延遲分佈數據
  - [ ] 收集 DO 實例數據
  - [ ] 收集成本數據

- [ ] **心跳間隔優化**
  - [ ] 測試 30s 間隔: 延遲 __ms, 成本 $__
  - [ ] 測試 45s 間隔: 延遲 __ms, 成本 $__
  - [ ] 測試 60s 間隔: 延遲 __ms, 成本 $__
  - [ ] 選擇最優間隔: __s

- [ ] **DO 預熱機制**
  - [ ] 實施熱門對話 DO 保持策略
  - [ ] 減少冷啟動延遲

- [ ] **批次處理優化**
  - [ ] 實施訊息批次發送
  - [ ] 減少 DO 調用次數

### SSE 代碼清理

- [ ] **監控 SSE fallback 使用率**
  - [ ] Week 1 使用率: __%
  - [ ] Week 2 使用率: __%
  - [ ] Week 3 使用率: __%
  - [ ] Week 4 使用率: __%

- [ ] **計劃 SSE 下線** (如果使用率 < 1%)
  - [ ] 創建下線計劃
  - [ ] 設定下線日期: 2025-12-31
  - [ ] 通知用戶

- [ ] **移除 SSE 代碼** (預估 2000+ 行)
  - [ ] `src/handlers/sse-monitoring-main.ts`
  - [ ] `src/monitoring/sse-performance-monitor.ts`
  - [ ] `src/modules/realtime/handlers/sse-handler.ts`
  - [ ] `frontend/src/composables/useSSEMessages.ts`

### 文檔更新

- [ ] **API 參考文檔**
  - [ ] 更新 WebSocket 端點文檔
  - [ ] 移除或標註 SSE 端點

- [ ] **架構圖更新**
  - [ ] 繪製新的 WebSocket + DO 架構圖
  - [ ] 移除 SSE 相關部分

- [ ] **部署指南**
  - [ ] 更新部署流程
  - [ ] 記錄 DO 配置步驟

- [ ] **故障排查手冊**
  - [ ] WebSocket 連接問題
  - [ ] DO 性能問題
  - [ ] 常見錯誤碼

### 最終報告

- [ ] **生成遷移總結報告**
  - [ ] 執行摘要
  - [ ] 關鍵指標對比 (SSE vs WebSocket)
  - [ ] 成本分析
  - [ ] 經驗教訓
  - [ ] 未來優化方向

- [ ] **團隊分享會**
  - [ ] 準備簡報
  - [ ] 分享成功經驗
  - [ ] 討論改進建議

### ✅ Phase 2.7 完成標準

- [ ] 性能優化完成，指標提升
- [ ] SSE 下線計劃已制定
- [ ] 所有文檔已更新
- [ ] 最終報告已完成
- [ ] 團隊分享會已完成

**當前進度**: ___% (___/20 項目完成)

---

## 📊 總體進度追蹤

| Phase | 開始日期 | 結束日期 | 狀態 | 完成度 |
|-------|---------|---------|------|-------|
| Phase 2.1 | 2025-10-07 | 2025-10-10 | 🔄 進行中 | __% |
| Phase 2.2 | 2025-10-09 | 2025-10-13 | ⏳ 待開始 | 0% |
| Phase 2.3 | 2025-10-14 | 2025-10-20 | ⏳ 待開始 | 0% |
| Phase 2.4 | 2025-10-21 | 2025-10-27 | ⏳ 待開始 | 0% |
| Phase 2.5 | 2025-10-28 | 2025-11-03 | ⏳ 待開始 | 0% |
| Phase 2.6 | 2025-11-04 | 2025-11-10 | ⏳ 待開始 | 0% |
| Phase 2.7 | 2025-11-08 | 2025-11-15 | ⏳ 待開始 | 0% |

**總體進度**: __% (__/145 項目完成)

**預計完成日期**: 2025-11-15

---

## 🎯 當前待辦 (Top Priority)

### 今天 (2025-10-07)

1. [ ] **獲取管理員令牌** (5 分鐘)
2. [ ] **執行驗證測試** (10 分鐘)
3. [ ] **重置 Migration Config** (5 分鐘)

### 本週 (Week 1)

4. [ ] 修改 ConversationDetail.vue
5. [ ] 瀏覽器功能測試
6. [ ] E2E 自動化測試
7. [ ] 完成 Phase 2.1

---

**文檔版本**: v1.0
**創建日期**: 2025-10-07
**最後更新**: 2025-10-07
**維護者**: DevOps Team
