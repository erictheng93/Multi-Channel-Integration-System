# 🚀 WebSocket + Durable Objects 遷移快速啟動指南

> **當前狀態**: ✅ 基礎設施就緒 | 準備進入 Phase 2: 漸進式遷移
> **目標**: 4-6 週完成從 SSE 到 WebSocket + DO 的零停機遷移

---

## 📋 快速目錄

1. [當前狀態概覽](#當前狀態概覽)
2. [立即執行步驟](#立即執行步驟-next-actions)
3. [Phase 2 完整路線圖](#phase-2-完整路線圖)
4. [關鍵指令速查](#關鍵指令速查)
5. [緊急聯絡資訊](#緊急聯絡資訊)

---

## 🎯 當前狀態概覽

### ✅ 已完成 (Phase 2.1 - 20%)

| 項目 | 狀態 | 備註 |
|------|------|------|
| D1 Database | ✅ 正常 | `08ae6790-2494-40a8-a07a-df3920783159` (458KB) |
| KV Namespaces | ✅ 正常 | SESSIONS + CACHE 已配置 |
| Durable Objects Bindings | ✅ 已配置 | 5 個 DO 類已註冊 |
| WebSocket Handler | ✅ 已部署 | `src/handlers/websocket-main.ts` (641 行) |
| 前端 WebSocket Client | ✅ 已實現 | `frontend/src/services/websocketClient.ts` (741 行) |
| Feature Flag 系統 | ✅ 已實現 | Migration Config API 可用 |
| 健康檢查端點 | ✅ 正常 | `/api/websocket/health` 返回 200 |

**當前配置**:
```json
{
  "websocketEnabled": true,
  "sseEnabled": true,
  "rolloutPercentage": 50,  // ⚠️ 需要重置為 0
  "durableObjectsAvailable": true
}
```

### ⏳ 待完成 (Phase 2.1 - 80%)

- [ ] **獲取管理員令牌**進行認證測試
- [ ] **執行 DO 功能測試** (需要認證)
- [ ] **前端 WebSocket 連接測試**
- [ ] **端到端整合測試**

---

## 🎬 立即執行步驟 (Next Actions)

### **Step 1: 獲取管理員令牌** (5 分鐘)

```bash
# 方法 1: 通過 API 登入
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"test-admin\",\"password\":\"Admin123!@#\"}"

# 保存返回的 token
export ADMIN_TOKEN="<your-jwt-token-here>"
```

**或者**使用前端獲取:

1. 登入 https://multi-channel.imfinethankyouandyou.com
2. 打開瀏覽器開發者工具 → Application → Local Storage
3. 複製 `auth_token` 的值
4. 執行: `export ADMIN_TOKEN="<token>"`

---

### **Step 2: 執行完整驗證測試** (10 分鐘)

```bash
# 使用管理員令牌運行測試
TEST_TOKEN=$ADMIN_TOKEN bash scripts/test-websocket-do.sh

# 預期結果: 7/7 測試通過
```

**如果測試失敗**:
- 檢查令牌是否過期 (JWT 有效期 24 小時)
- 驗證網絡連接到生產環境
- 查看詳細日誌: `VERBOSE=true bash scripts/test-websocket-do.sh`

---

### **Step 3: 重置遷移配置** (5 分鐘)

**⚠️ 重要**: 將 rollout 重置為 0%，確保安全開始

```bash
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

# 驗證配置已更新
curl -s "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status" | python -m json.tool
```

**預期響應**:
```json
{
  "status": "ok",
  "websocketEnabled": true,
  "sseEnabled": true,
  "rolloutPercentage": 0,
  "featureFlags": {
    "websocketConnections": false,
    ...
  }
}
```

---

### **Step 4: 前端 WebSocket 測試** (30 分鐘)

#### Option A: 使用瀏覽器開發者工具

1. 登入系統: https://multi-channel.imfinethankyouandyou.com
2. 打開對話頁面
3. 打開 DevTools → Console
4. 執行測試腳本:

```javascript
// 測試 WebSocket 連接
const wsClient = new WebSocketClient({
  conversationId: 'test-conv-001',
  enableLogging: true,
  autoConnect: false
})

wsClient.setEventHandlers({
  onMessage: (msg) => console.log('📨 Received:', msg),
  onConnectionChange: (state) => console.log('🔌 State:', state),
  onError: (err) => console.error('❌ Error:', err)
})

await wsClient.connect()
// 預期: [WebSocketClient] WebSocket connected successfully

wsClient.send({ type: 'ping', timestamp: Date.now() })
// 預期: 收到 pong 響應
```

#### Option B: 創建測試頁面 (推薦)

創建 `frontend/src/views/WebSocketTest.vue` (已在 PHASE2_MIGRATION_PLAN.md 提供完整代碼)

---

### **Step 5: 完成 Phase 2.1 檢查清單** (15 分鐘)

使用以下檢查清單確認準備就緒:

```bash
# 運行完整檢查清單
cat <<'EOF' > /tmp/phase2.1-checklist.txt
Phase 2.1 Completion Checklist
================================

Infrastructure Validation:
[ ] D1 Database operational
[ ] KV Namespaces accessible
[ ] All DO bindings configured
[ ] WebSocket health endpoint returns 200

Functional Testing:
[ ] ConversationRoom DO accepts connections
[ ] UserConnection DO tracks user state
[ ] MessageBroadcaster DO can broadcast events
[ ] WebSocket Client connects successfully
[ ] Auto-reconnect works (test network interruption)
[ ] Token refresh mechanism works

Configuration:
[ ] Migration config set to rolloutPercentage: 0
[ ] All feature flags disabled
[ ] SSE fallback available
[ ] Monitoring endpoints accessible

Team Readiness:
[ ] Team briefed on migration plan
[ ] Emergency rollback procedure documented
[ ] On-call rotation established
[ ] Monitoring dashboard access verified

EOF

cat /tmp/phase2.1-checklist.txt
```

**當所有項目打勾後，您可以進入 Phase 2.2** ✅

---

## 🗺️ Phase 2 完整路線圖

### **Timeline Overview**

```
Week 1-2: Phase 2.1-2.3 (Preparation)
├─ 驗證基礎設施
├─ 配置 Feature Flags
└─ 部署監控系統

Week 3: Phase 2.4 (5% Canary)
├─ 內部團隊測試
├─ 收集反饋
└─ Go/No-Go 決策

Week 4: Phase 2.5 (20% → 50% Rollout)
├─ Day 1-2: 20% 用戶
├─ Day 3-4: 35% 用戶
└─ Day 5-7: 50% 用戶 + A/B 測試

Week 5: Phase 2.6 (100% Full Migration)
├─ Day 1: 70% 觀察
├─ Day 2: 85% 驗證
└─ Day 3-4: 100% 全量

Week 5-6: Phase 2.7 (Optimization)
├─ 性能優化
├─ SSE 代碼清理
└─ 文檔更新
```

---

### **Phase 2.2: Feature Flag Configuration** (Week 1-2)

**目標**: 配置漸進式遷移控制開關

#### 步驟詳解

**Step 1: 前端統一連接管理器**

創建文件: `frontend/src/services/realtimeConnectionManager.ts`

```typescript
import { fetchMigrationConfig } from '@/api/websocket'
import { createWebSocketClient } from './websocketClient'
import { useSSEMessages } from '@/composables/useSSEMessages'

export async function createRealtimeConnection(conversationId: string) {
  const config = await fetchMigrationConfig()

  // 根據 rollout 百分比決定使用 WebSocket 還是 SSE
  const shouldUseWebSocket = config.enableWebSocket &&
    shouldUserGetWebSocket(config.rolloutPercentage)

  if (shouldUseWebSocket) {
    console.log('🔌 Using WebSocket connection')
    return createWebSocketClient({ conversationId })
  } else {
    console.log('📡 Using SSE connection (fallback)')
    return useSSEMessages(ref(conversationId))
  }
}

// 一致性哈希: 同一用戶始終得到相同的結果
function shouldUserGetWebSocket(rolloutPercentage: number): boolean {
  const userId = getCurrentUserId()
  const hash = simpleHash(userId) // 簡單哈希函數
  return (hash % 100) < rolloutPercentage
}
```

**Step 2: 修改對話頁面**

```typescript
// frontend/src/views/ConversationDetail.vue
import { createRealtimeConnection } from '@/services/realtimeConnectionManager'

// 在 onMounted 中
const connection = await createRealtimeConnection(conversationId.value)
```

**Step 3: 測試 Feature Toggle**

```bash
# 測試 0% rollout (所有用戶使用 SSE)
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rolloutPercentage": 0}'

# 驗證: 前端應自動使用 SSE

# 測試 100% rollout (所有用戶使用 WebSocket)
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 100}'

# 驗證: 前端應自動使用 WebSocket
```

---

### **Phase 2.3: Monitoring & Alerting** (Week 2)

**目標**: 部署全面監控與告警

#### 步驟詳解

**Step 1: 配置 Cloudflare Analytics**

1. 登入 Cloudflare Dashboard
2. 進入 Workers & Pages → multi-channel-platform
3. 啟用 Analytics:
   - ✅ Workers Analytics (Request count, CPU time)
   - ✅ Durable Objects Analytics (Active objects, Latency)

**Step 2: 創建監控儀表板**

安裝 Grafana 或使用 Cloudflare Dashboard:

```bash
# 關鍵監控指標
1. WebSocket 連接成功率 (target: > 98%)
2. 平均消息延遲 (target: < 80ms)
3. Durable Objects 實例數量
4. 每分鐘消息吞吐量
5. 錯誤率 (target: < 2%)
6. 成本追蹤 (DO requests, WebSocket connections)
```

**Step 3: 配置告警規則**

創建 Slack Webhook 或 Email 告警:

```bash
# 嚴重告警 (Critical - P0)
- 連接成功率 < 90%
- 平均延遲 > 500ms
- DO 錯誤率 > 10%
→ 動作: 立即通知 + 自動回退

# 警告告警 (Warning - P1)
- 連接成功率 < 95%
- 平均延遲 > 200ms
- 成本超出預算 30%
→ 動作: 通知團隊 + 暫停遷移
```

**Step 4: 每日監控 Checklist**

```bash
# 每日運行健康檢查
./scripts/daily-health-check.sh

# 生成每日報告
./scripts/generate-daily-report.sh --date=$(date +%Y-%m-%d)

# 檢查項目:
- [ ] 連接成功率趨勢
- [ ] 延遲分佈圖
- [ ] DO 實例數量
- [ ] 成本累計
- [ ] 用戶反饋
```

---

### **Phase 2.4: Internal Testing (5% Canary)** (Week 3)

**目標**: 內部團隊驗證 WebSocket 穩定性

#### 執行步驟

**Day 1: 啟用 5% Canary**

```bash
# 選擇內部用戶作為測試組
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "rolloutPercentage": 5,
    "featureFlags": {
      "websocketConnections": true,
      "durableObjectMessaging": true,
      "realTimeTypingIndicators": true
    },
    "whitelistUsers": ["admin-001", "team-001", "agent-test-001"]
  }'
```

**Day 2-7: 持續監控**

```bash
# 每日檢查
./scripts/canary-daily-check.sh

# 收集反饋
# 創建 Google Form 或內部問卷，包含:
1. 連接穩定性評分 (1-5)
2. 響應速度評分 (1-5)
3. 遇到的問題描述
4. 改進建議
```

**Week 3 結束: Go/No-Go 決策**

必須滿足以下條件:
- [ ] 連接成功率 > 98%
- [ ] 平均延遲 < 80ms
- [ ] 用戶滿意度 > 4.0/5
- [ ] 無嚴重 Bug
- [ ] 成本增加 < 15%

**如果通過** → 進入 Phase 2.5
**如果未通過** → 分析問題，修復後重新測試

---

### **Phase 2.5: Gradual Rollout (20% → 50%)** (Week 4)

```bash
# Day 1-2: 提升到 20%
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 20}'

# Day 3-4: 提升到 35%
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 35,
       "featureFlags": {
         "websocketConnections": true,
         "durableObjectMessaging": true,
         "distributedLocking": true,
         "batchMessageProcessing": true,
         "realTimeTypingIndicators": true
       }}'

# Day 5-7: 提升到 50%
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 50}'
```

**每次提升後監控 24-48 小時**

---

### **Phase 2.6: Full Migration (100%)** (Week 5)

```bash
# Day 1: 70%
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 70}'

# Day 2: 85%
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 85}'

# Day 3-4: 100% 全量
curl -X POST "$API_BASE/api/websocket/migration-config" \
  -d '{"rolloutPercentage": 100, "migrationStrategy": "complete"}'
```

**慶祝 🎉** - 遷移完成！

---

### **Phase 2.7: Post-Migration Optimization** (Week 5-6)

- 性能基線建立
- 心跳間隔優化 (30s → 45s → 60s 測試)
- DO 預熱機制實施
- SSE 代碼移除計劃 (保留 1 個月作為安全網)

---

## 🔧 關鍵指令速查

### **遷移控制**

```bash
# 查看當前配置
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# 更新 rollout 百分比
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rolloutPercentage": 20}'

# 緊急回退 (< 5 分鐘)
./scripts/emergency-rollback.sh

# 或手動:
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enableWebSocket": false, "enableSSE": true, "rolloutPercentage": 0}'
```

### **健康檢查**

```bash
# 系統健康
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# WebSocket 指標
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics

# DO 連接測試
curl -H "Authorization: Bearer $TOKEN" \
  "https://multi-channel.imfinethankyouandyou.com/api/websocket/test-connection?userId=test&conversationId=test"
```

### **日誌查看**

```bash
# 實時日誌 (Cloudflare Workers)
wrangler tail --format pretty

# 過濾 WebSocket 相關日誌
wrangler tail --format pretty | grep -i "websocket\|durable"

# 保存日誌到文件
wrangler tail --format pretty > logs/websocket-$(date +%Y%m%d).log
```

---

## 🚨 緊急聯絡資訊

### **關鍵人員**

| 角色 | 姓名 | Email | 電話 |
|------|------|-------|------|
| **Tech Lead** | [Name] | tech.lead@company.com | +xxx-xxxx-xxxx |
| **DevOps Lead** | [Name] | devops@company.com | +xxx-xxxx-xxxx |
| **On-Call Engineer** | [Name] | oncall@company.com | +xxx-xxxx-xxxx |
| **Product Manager** | [Name] | pm@company.com | +xxx-xxxx-xxxx |

### **升級流程**

| 嚴重度 | 響應時間 | 升級對象 | 動作 |
|--------|---------|---------|------|
| **P0 - Critical** | 15 分鐘 | 全員 + CTO | 立即回退 |
| **P1 - High** | 1 小時 | Tech Lead + DevOps | 暫停遷移 |
| **P2 - Medium** | 4 小時 | DevOps Team | 監控調查 |
| **P3 - Low** | 24 小時 | 負責工程師 | 記錄追蹤 |

### **緊急回退 SOP**

```bash
# 1. 執行自動回退腳本
./scripts/emergency-rollback.sh

# 2. 驗證回退成功
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status
# 預期: rolloutPercentage: 0, enableWebSocket: false

# 3. 通知團隊
slack-notify "#websocket-migration" "🚨 EMERGENCY ROLLBACK EXECUTED"

# 4. 收集錯誤日誌
wrangler tail --format pretty > logs/emergency-$(date +%Y%m%d-%H%M%S).log

# 5. 創建事故報告
./scripts/create-incident-report.sh
```

---

## 📚 相關文檔

- **完整遷移計劃**: [PHASE2_MIGRATION_PLAN.md](./PHASE2_MIGRATION_PLAN.md)
- **WebSocket 架構**: [docs/architecture/WEBSOCKET_ARCHITECTURE.md](./docs/architecture/WEBSOCKET_ARCHITECTURE.md)
- **API 參考**: [docs/api/MESSAGING_API_REFERENCE.md](./docs/api/MESSAGING_API_REFERENCE.md)
- **故障排查**: [docs/troubleshooting/WEBSOCKET_TROUBLESHOOTING.md](./docs/troubleshooting/WEBSOCKET_TROUBLESHOOTING.md)

---

## ✅ 當前行動項 (Action Items)

**立即執行** (今天):

1. [ ] 獲取管理員令牌
2. [ ] 運行 `TEST_TOKEN=$ADMIN_TOKEN bash scripts/test-websocket-do.sh`
3. [ ] 重置遷移配置到 `rolloutPercentage: 0`
4. [ ] 完成 Phase 2.1 檢查清單

**Week 1-2** (本週):

5. [ ] 實施前端統一連接管理器
6. [ ] 配置 Cloudflare Analytics
7. [ ] 建立監控儀表板
8. [ ] 配置告警規則

**Week 3** (下週):

9. [ ] 啟用 5% Canary 部署
10. [ ] 收集內部用戶反饋
11. [ ] Go/No-Go 決策會議

---

## 🎯 成功標準

**Phase 2 遷移成功的標準**:

- ✅ 100% 用戶遷移到 WebSocket
- ✅ 連接成功率 > 98%
- ✅ 平均延遲 < 80ms (vs SSE 100-300ms)
- ✅ 用戶滿意度提升 > 10%
- ✅ 零停機時間
- ✅ 成本增加 < 20%
- ✅ 無重大事故 (P0/P1)

**達成後的下一步**:

- 🚀 實施高級功能 (群組通話、屏幕共享)
- 📊 性能持續優化
- 🔮 探索 WebTransport 協議

---

**文檔版本**: v1.0
**創建日期**: 2025-10-07
**維護者**: DevOps Team
**狀態**: ✅ Ready to Execute
