# SSE 遺留代碼清單

**生成時間**: 2025-10-08
**當前 WebSocket Rollout**: 50%
**目標**: 100% WebSocket 遷移後移除這些 SSE 代碼

---

## 📊 總覽

| 類別 | 文件數量 | 估計代碼行數 | 優先級 |
|------|---------|-------------|--------|
| **後端核心 SSE 處理器** | 9 | ~2,500 | 🔴 高 |
| **後端監控與分析** | 4 | ~1,200 | 🟡 中 |
| **前端 SSE 客戶端** | 3 | ~800 | 🔴 高 |
| **類型定義** | 2 | ~300 | 🟢 低 |
| **適配器和集成** | 3 | ~600 | 🟡 中 |
| **SSE 引用代碼** | ~170+ 文件 | 待評估 | 🟢 低 |

**總計**: ~190 個文件需要清理或修改

---

## 🎯 Phase 1: 立即可移除 (100% Rollout 後)

### 後端核心 SSE 處理器

#### 1. `src/modules/realtime/handlers/sse-handler.ts` ⭐ **關鍵文件**
- **代碼行數**: 444 行
- **功能**: 主要的 SSE 連接處理器
- **依賴**:
  - EnhancedSSEManager 類 (連接管理)
  - SSE 事件格式化
  - KV 同步邏輯
- **移除策略**: 整個文件可以刪除
- **風險**: 🔴 **高** - 核心組件,需確保 WebSocket 100% 穩定後才能移除

#### 2. `src/modules/realtime/services/sse-connection-service.ts`
- **功能**: SSE 連接服務層
- **移除策略**: 整個文件刪除
- **風險**: 🔴 高

#### 3. `src/handlers/sse-monitoring-main.ts` ⭐ **監控端點**
- **代碼行數**: 383 行
- **功能**: RESTful API endpoints for SSE performance monitoring
- **端點**:
  - GET `/metrics` - 當前 SSE 指標
  - GET `/metrics/history` - 歷史指標
  - GET `/alerts` - SSE 告警條件
  - GET `/report` - 性能報告
  - POST `/cleanup` - 清理舊監控數據
  - GET `/health` - SSE 健康狀態
  - POST `/events` - 記錄 SSE 事件
  - GET `/connections` - 連接統計
  - PUT `/settings` - 監控設置
- **移除策略**: 整個文件刪除,但可能需要保留監控邏輯到 WebSocket 監控
- **風險**: 🟡 中 - 監控數據可能需要遷移

#### 4. `src/monitoring/sse-performance-monitor.ts`
- **功能**: SSE 性能監控實現
- **移除策略**: 整個文件刪除
- **風險**: 🟡 中

### 前端 SSE 客戶端

#### 5. `frontend/src/composables/useSSEMessages.ts` ⭐ **關鍵前端文件**
- **代碼行數**: 428 行
- **功能**: Vue 3 Composable for SSE message streaming
- **特性**:
  - 連接狀態管理 (connecting, connected, reconnecting, error)
  - 自動重連機制 (最多 5 次)
  - 心跳監控 (60 秒超時)
  - 新消息追蹤
  - 消息去重
- **移除策略**: 整個文件刪除
- **風險**: 🔴 **高** - 大量前端視圖依賴此文件
- **需要同步修改的文件**: 所有使用此 composable 的 Vue 組件

#### 6. `frontend/src/services/realtimeConnectionManager.ts`
- **功能**: SSE 連接管理器
- **移除策略**: 部分刪除,保留 WebSocket 邏輯
- **風險**: 🟡 中

#### 7. `frontend/src/composables/useRealtime.ts`
- **功能**: 統一實時通訊 composable (可能包含 SSE 和 WebSocket)
- **移除策略**: 移除 SSE 相關代碼,保留 WebSocket 部分
- **風險**: 🟡 中

### SSE 適配器

#### 8. `src/modules/collaboration/adapters/sse-adapter.ts`
- **功能**: 協作模組的 SSE 適配器
- **移除策略**: 整個文件刪除
- **風險**: 🟢 低 - 已有 WebSocket 適配器替代

#### 9. `src/modules/notifications/adapters/sse-adapter.ts`
- **功能**: 通知模組的 SSE 適配器
- **移除策略**: 整個文件刪除
- **風險**: 🟢 低

#### 10. `src/modules/notifications/handlers/notification-sse.ts`
- **功能**: 通知的 SSE 處理器
- **移除策略**: 整個文件刪除
- **風險**: 🟢 低

---

## 🎯 Phase 2: 條件移除 (評估後決定)

### SSE 類型定義

#### 11. `src/modules/realtime/types/sse-types.ts`
- **內容**: SSE 相關的 TypeScript 類型定義
  - SSEConnection
  - SSEEvent
  - SSEHeaders
  - SSEConfig
  - SSEAuthPayload
  - SSEConnectionStats
- **移除策略**: 整個文件刪除
- **風險**: 🟢 低 - 類型定義,無運行時影響

### 路由配置

#### 12. `src/core/route-config.ts` (部分)
- **需要修改**: Line 289-296 (sse-monitoring 路由註冊)
- **移除內容**:
  ```typescript
  createRouteModule({
    name: 'sse-monitoring',
    path: '/sse/monitoring',
    handler: sseMonitoringHandler,
    // ...
  })
  ```
- **風險**: 🟢 低

#### 13. `src/index.ts` (部分)
- **需要檢查**: SSE 路由註冊
- **移除策略**: 搜索 "sse" 相關路由註冊並移除
- **風險**: 🟡 中

---

## 🎯 Phase 3: 清理引用 (全局搜索替換)

### 需要檢查和清理的文件類別

1. **處理器文件** (~40 文件)
   - 移除 SSE 相關 import
   - 移除 SSE fallback 邏輯
   - 保留 WebSocket 邏輯

2. **服務文件** (~30 文件)
   - 清理 SSE 事件發送代碼
   - 保留 WebSocket 廣播代碼

3. **類型定義文件** (~20 文件)
   - 移除 SSE 相關類型引用
   - 更新聯合類型 (例如 `'websocket' | 'sse'` → `'websocket'`)

4. **文檔文件** (~10 文件)
   - README.md 文件中提及 SSE
   - 移除 SSE 相關說明

---

## ⚠️ 特別注意: 保留的遷移代碼

### **不應移除**的文件:

#### `src/services/migration-service.ts` ✅ **保留**
- **原因**: 這不是遺留代碼!這是管理 SSE → WebSocket 遷移的服務
- **功能**:
  - 漸進式 Rollout 決策引擎
  - Feature Flag 管理
  - A/B 測試框架
  - Fallback 機制
  - 性能監控和回滾能力
- **移除時機**: 100% Rollout 穩定運行 30 天後
- **當前狀態**: ✅ **活躍使用中**

#### `src/services/emergency-rollback-service.ts` ✅ **保留**
- **原因**: 緊急回滾機制,安全網
- **移除時機**: 100% Rollout 穩定運行 30 天後

#### `src/services/deployment-feature-flags.ts` ✅ **保留**
- **原因**: Feature flags 系統,用於控制 rollout
- **移除時機**: 所有 feature flags 固定為 100% 後

---

## 📋 移除執行計劃

### Stage 1: 75% Rollout 時 (當前階段準備)
**行動**: ⚠️ **暫不移除任何代碼**
- 原因: SSE 仍為 25% 用戶提供服務
- 監控: 確保 WebSocket 75% 用戶穩定

### Stage 2: 90% Rollout 時
**行動**: ⚠️ **標記為 deprecated**
- 在所有 SSE 文件頂部添加 `@deprecated` 註釋
- 記錄日誌警告使用 SSE 的連接
- 準備移除腳本

### Stage 3: 100% Rollout 穩定後 (Day 1-14)
**行動**: ⚠️ **保持現狀,密切監控**
- 雖然 rollout 100%,但保留 SSE 代碼作為應急 fallback
- 每日檢查 WebSocket 穩定性

### Stage 4: 100% Rollout 穩定 (Day 15-30)
**行動**: 🟡 **開始移除後端 SSE 端點**
- 移除 `/api/sse/monitoring` 相關端點
- 保留前端 SSE 客戶端代碼(防禦性)

### Stage 5: 100% Rollout 穩定 (Day 31+)
**行動**: 🟢 **全面移除 SSE 代碼**
- 執行完整的 SSE 代碼移除
- 清理所有引用
- 更新文檔

---

## 🔧 自動化移除腳本規劃

### `scripts/remove-sse-backend.sh`
```bash
# 移除後端 SSE 核心文件
rm -f src/modules/realtime/handlers/sse-handler.ts
rm -f src/modules/realtime/services/sse-connection-service.ts
rm -f src/handlers/sse-monitoring-main.ts
rm -f src/monitoring/sse-performance-monitor.ts
rm -f src/modules/realtime/types/sse-types.ts
# ... 更多文件
```

### `scripts/remove-sse-frontend.sh`
```bash
# 移除前端 SSE 客戶端
rm -f frontend/src/composables/useSSEMessages.ts
# ... 更多文件
```

### `scripts/cleanup-sse-references.sh`
```bash
# 全局搜索並清理 SSE 引用
# 使用 sed/awk 自動替換
```

---

## 📊 預估工作量

| 階段 | 工作量 (人時) | 風險等級 | 優先級 |
|------|-------------|---------|--------|
| **標記 deprecated** | 2 小時 | 🟢 低 | 低 |
| **移除後端核心** | 8 小時 | 🔴 高 | 高 |
| **移除前端客戶端** | 12 小時 | 🔴 高 | 高 |
| **清理引用** | 16 小時 | 🟡 中 | 中 |
| **測試驗證** | 8 小時 | 🟡 中 | 高 |
| **文檔更新** | 4 小時 | 🟢 低 | 中 |

**總計**: ~50 小時工作量

---

## ✅ 驗收標準

### 移除完成標準:
1. ✅ 全域搜索 "SSE" 無結果 (除了註釋和文檔)
2. ✅ 全域搜索 "text/event-stream" 無結果
3. ✅ 全域搜索 "EventSource" 無結果
4. ✅ TypeScript 編譯成功,無類型錯誤
5. ✅ 所有測試通過
6. ✅ 生產環境部署成功,無 SSE 相關錯誤日誌
7. ✅ WebSocket 連接率保持 100%

---

## 📝 相關文檔

- `WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md` - 完整部署計劃
- `WEBSOCKET_LOAD_TEST_REPORT_2025-10-08.md` - 最新負載測試報告
- `scripts/LOAD_TESTING_GUIDE.md` - 負載測試指南

---

**生成工具**: Claude Code Automated Analysis
**下次更新**: 75% Rollout 部署前
