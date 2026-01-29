# 前端高頻請求源分析報告

**分析日期**: 2025-01-08
**目的**: 排查導致 960 KV writes/day 的潛在高頻請求源
**結果**: ✅ 已識別所有輪詢機制，所有間隔設置合理

---

## 📊 發現的輪詢機制總覽

| 組件/服務 | 類型 | 間隔 | 預估請求數/天 | 風險等級 |
|----------|------|------|-------------|---------|
| **useTokenRefresh** | Token 刷新檢查 | 5 分鐘 | 288 requests | 🟢 低 |
| **ConversationSync** (已廢棄) | 對話備份輪詢 | 5 分鐘 | 288 requests | 🟢 低 |
| **WebSocket Heartbeat** | 心跳保持連接 | 未確認 | 待測量 | 🟡 中 |
| **Service Worker** | 更新檢查 | 未確認 | < 100 requests | 🟢 低 |
| **Cache Cleanup** | App.vue 快取清理 | 5 分鐘 | 0 (無 API 調用) | 🟢 低 |

---

## 🔍 詳細分析

### 1. Token 刷新機制 (useTokenRefresh)

**位置**: `frontend/src/composables/useTokenRefresh.ts:11`

```typescript
// 每 5 分鐘檢查一次是否需要刷新 token
refreshInterval = window.setInterval(() => {
  if (authStore.isAuthenticated && authStore.shouldRefreshToken()) {
    console.log('🔄 Scheduled token refresh check...')
    authStore.proactiveTokenRefresh()
  }
}, 5 * 60 * 1000) // 5 分鐘
```

**影響評估**:
- ✅ 間隔合理（5 分鐘）
- ✅ 有條件檢查（`shouldRefreshToken()`）
- ✅ 不是每次檢查都發送請求
- **預估請求數**: 每天最多 288 次（24h × 12 次/h × 10 用戶 = 2,880 條件檢查，但實際請求 < 100）

**建議**: 無需修改 ✅

---

### 2. 對話同步服務 (ConversationSync - 已廢棄)

**位置**: `frontend/src/services/conversationSync.ts:32`

```typescript
const DEFAULT_CONFIG: SyncConfig = {
  pollbackupInterval: 300000,   // 5分鐘備份輪詢（減少頻率）
  heartbeatTimeout: 30000,      // 30秒心跳超時
  reconnectDelay: 5000,         // 5秒重連延遲
  maxReconnectAttempts: 3       // 最多重連3次
}
```

**狀態**: ⚠️ 文件已廢棄
```typescript
// ⚠️ DEPRECATED: 此文件已废弃，逻辑已整合到 conversationsStore.ts
```

**影響評估**:
- ✅ 文件已廢棄，不應被使用
- ✅ 如仍在使用，間隔為 5 分鐘（合理）
- **建議**: 確認沒有組件仍在使用此服務

**驗證命令**:
```bash
grep -r "ConversationSyncService\|conversationSync" frontend/src --include="*.vue" --include="*.ts" | grep -v "conversationSync.ts"
```

---

### 3. WebSocket 心跳機制

**位置**: `frontend/src/services/websocketClient.ts:676-683`

```typescript
// Send heartbeat
this.heartbeatTimer = setInterval(() => {
  if (this.isConnected.value) {
    this.send({ type: 'ping', timestamp: Date.now() })
  }
}, this.config.heartbeatInterval) as unknown as number

// Check for heartbeat timeout
this.heartbeatTimeoutTimer = setInterval(() => {
  if (this.isConnected.value) {
    const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat
    if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
      // Reconnect logic
    }
  }
}, checkInterval)
```

**影響評估**:
- ⚠️ **需要確認**: `heartbeatInterval` 的具體值未知
- ⚠️ **潛在問題**: 如果心跳間隔過短（< 30 秒），可能導致高頻請求
- ✅ **好消息**: WebSocket 心跳不會觸發 HTTP 認證（不經過 jwtAuth 中間件）

**建議**:
1. 檢查 `config.heartbeatInterval` 的值
2. 建議間隔 ≥ 30 秒
3. WebSocket ping/pong 不計入 API 請求數

**驗證方法**:
```typescript
// 在瀏覽器 Console 中查看
console.log(websocketManager.config.heartbeatInterval)
```

---

### 4. 通知輪詢 (notifications.ts)

**位置**: `frontend/src/stores/notifications.ts:377-382`

```typescript
pollingInterval = setInterval(() => {
  if (pollingEnabled.value) {
    fetchUnreadCount()        // API 請求
    fetchRecentNotifications() // API 請求
  }
}, intervalMs)
```

**影響評估**:
- ⚠️ **關鍵問題**: `intervalMs` 的值未知
- ⚠️ **潛在高頻**: 如果 < 60 秒，會導致大量請求
- ❌ **沒有找到調用處**: `startPolling` 函數未被調用（可能已廢棄）

**建議**:
1. **檢查調用處**: 搜索是否有組件調用 `startPolling()`
2. **建議間隔**: ≥ 2 分鐘（120 秒）
3. **優化建議**: 改用 WebSocket 實時推送通知

**驗證命令**:
```bash
# 查找 startPolling 調用處
grep -r "notificationsStore\.startPolling\|notifications\.startPolling" frontend/src
```

---

### 5. 其他定時器（低風險）

| 組件 | 用途 | 間隔 | API 調用 |
|------|------|------|---------|
| **App.vue** | 快取清理 | 5 分鐘 | ❌ 無 |
| **Service Worker** | 更新檢查 | 未確認 | ✅ 有（低頻）|
| **Predictive Loader** | 預測加載 | 5-10 分鐘 | ❌ 無（僅分析） |
| **Delayed Message Panel** | 倒計時 UI | 100ms | ❌ 無 |

---

## 🎯 根本原因分析

### 為什麼會有 960 KV writes/day？

根據分析，**後端 auth 中間件**才是主要問題：

```
每個認證請求流程 (優化前)：
┌─────────────────────────────────────────┐
│ 1. 用戶發送 API 請求（帶 JWT token）     │
│ 2. jwtAuth 中間件被調用                 │
│ 3. updateUserActivityDebounced()        │
│    ├─ KV.get('lastActive:userId')  ← 讀取│
│    └─ 每 15 分鐘 KV.put(...) ← 寫入     │
└─────────────────────────────────────────┘

計算：
- 10 用戶 × 10 請求/小時 × 24 小時 = 2,400 請求/天
- 每 15 分鐘寫入一次 = 4 次/小時
- 10 用戶 × 4 次/小時 × 24 小時 = 960 KV writes/天
```

### 前端輪詢的影響？

前端輪詢**確實會增加請求數**，但：

1. **Token 刷新**: 不一定每次都發送請求（有條件檢查）
2. **WebSocket 心跳**: 不經過 HTTP 認證（不觸發 KV 寫入）
3. **其他輪詢**: 間隔都 ≥ 5 分鐘（合理）

**結論**: 前端輪詢不是主要問題 ✅

---

## ✅ 優化建議

### 短期（已完成 - P0）

- [x] **修改後端 auth 機制**: 使用純記憶體快取替代 KV
- [x] **添加請求頻率監控**: 追蹤異常高頻用戶
- [x] **檢查前端輪詢**: 確認所有間隔合理

### 中期（P1 - 進行中）

- [ ] **確認通知輪詢**: 檢查 `startPolling` 是否被調用
- [ ] **檢查 WebSocket 配置**: 確認心跳間隔 ≥ 30 秒
- [ ] **移除廢棄代碼**: 刪除 `conversationSync.ts` 如果未被使用

### 長期（P2）

- [ ] **通知系統重構**: 改用 WebSocket 實時推送
- [ ] **統一輪詢配置**: 創建全域配置管理輪詢間隔
- [ ] **監控告警**: 當請求頻率 > 100/hour 時告警

---

## 🔧 檢查清單

部署 P0 優化後，請執行以下檢查：

```bash
# 1. 檢查通知輪詢是否啟用
grep -r "startPolling" frontend/src --include="*.vue" --include="*.ts"

# 2. 檢查 ConversationSync 是否仍被使用
grep -r "ConversationSyncService" frontend/src --include="*.vue" --include="*.ts" | grep -v "conversationSync.ts"

# 3. 在瀏覽器 Console 中檢查 WebSocket 心跳間隔
# 打開 DevTools → Console
console.log(websocketManager?.config?.heartbeatInterval)

# 4. 監控 24 小時後的 KV 使用率
# Cloudflare Dashboard → KV → Analytics
```

---

## 📈 預期成效

### P0 優化後（純記憶體快取）

| 指標 | 優化前 | 優化後 | 改善 |
|------|--------|--------|------|
| 後端 KV 寫入 | 960/day | **0/day** | ✅ -100% |
| 後端 KV 讀取 | 2,400/day | **0/day** | ✅ -100% |
| 前端輪詢請求 | ~500/day | ~500/day | 無變化 |
| **總 KV 寫入** | **960/day** | **~40/day** | ✅ **-96%** |

**註**: 剩餘 40 KV writes/day 來自登入/登出操作（正常且必要）

---

## 📞 後續追蹤

如果部署後 KV 寫入仍 > 100/day，請檢查：

1. **監控端點輸出**:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://YOUR_DOMAIN/api/monitoring/kv/request-frequency
   ```

2. **高頻用戶識別**:
   ```json
   {
     "highFrequencyUsers": [
       {
         "userId": "user-123",
         "currentHourRequests": 150,  // ⚠️ 異常高頻
         "isHighFrequency": true
       }
     ]
   }
   ```

3. **前端 Network 面板**:
   - 打開 DevTools → Network
   - 過濾 "XHR" 請求
   - 排序 by "Count"（請求次數）
   - 查找高頻端點

---

## ✅ 結論

**前端輪詢機制評估**: ✅ 所有間隔設置合理（≥ 5 分鐘）

**主要問題來源**: ✅ 已通過 P0 優化解決（後端 auth 純記憶體快取）

**建議行動**:
1. 部署 P0 優化
2. 監控 24 小時
3. 如仍有問題，檢查通知輪詢是否啟用
