# SSE 清理計劃

**創建時間**: 2025-10-08
**目標**: 100% 遷移到 WebSocket，完全移除 SSE 相關代碼

---

## 📋 階段 1: 提升 Rollout

### Step 1: 提升到 75%
```bash
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 75
  }'
```

### Step 2: 提升到 100% (全量遷移)
```bash
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 100,
    "migrationStrategy": "complete"
  }'
```

---

## 🗑️ 階段 2: SSE 代碼清理

### 核心 SSE 文件清單（需要移除）

#### 後端核心文件
- [ ] `src/handlers/sse-monitoring-main.ts` - SSE 主處理器
- [ ] `src/monitoring/sse-performance-monitor.ts` - SSE 性能監控
- [ ] `src/modules/realtime/handlers/sse-handler.ts` - SSE handler
- [ ] `src/modules/realtime/services/sse-connection-service.ts` - SSE 連接服務
- [ ] `src/modules/realtime/types/sse-types.ts` - SSE 類型定義
- [ ] `src/modules/collaboration/adapters/sse-adapter.ts` - Collaboration SSE adapter
- [ ] `src/modules/notifications/handlers/notification-sse.ts` - Notification SSE handler
- [ ] `src/modules/notifications/adapters/sse-adapter.ts` - Notification SSE adapter
- [ ] `src/handlers/activity-stream.ts` - Activity stream (SSE-based)

#### 前端核心文件
- [ ] `frontend/src/composables/useSSEMessages.ts` - SSE messages composable
- [ ] `frontend/src/composables/useActivityStream.ts` - Activity stream composable

#### 路由配置更新
- [ ] `src/index.ts` - 移除 SSE activity stream 路由
- [ ] `src/core/route-config.ts` - 移除 SSE 相關路由配置

#### 類型定義更新
- [ ] `src/types/bindings.ts` - 移除 SSE 相關類型
- [ ] `src/types/services.ts` - 移除 SSE 服務類型

---

## 📝 階段 3: 代碼引用清理

### 需要更新的文件（移除 SSE 引用）

#### 後端文件
1. `src/index.ts`
   - 移除 SSE activity stream 預註冊
   - 移除 SSE OPTIONS handler

2. `src/modules/realtime/index.ts`
   - 移除 SSE handler 導出

3. `src/modules/realtime/handlers/index.ts`
   - 移除 SSE handler 引用

4. `src/modules/collaboration/index.ts`
   - 移除 SSE adapter 引用

5. `src/modules/notifications/index.ts`
   - 移除 SSE handler 和 adapter

#### 前端文件
1. `frontend/src/views/ConversationDetail.vue`
   - 確認只使用 realtimeConnectionManager
   - 移除 useSSEMessages 引用（如有）

2. `frontend/src/services/realtimeConnectionManager.ts`
   - 移除 SSE 相關邏輯（保留作為歷史參考）

3. `frontend/src/config/realtime.ts`
   - 移除 SSE 配置選項

---

## 🧪 階段 4: 測試驗證

### 測試清單
- [ ] 驗證 100% Rollout 生效
- [ ] 驗證所有用戶使用 WebSocket
- [ ] 驗證即時消息功能正常
- [ ] 驗證輸入指示器功能
- [ ] 驗證多客服協作功能
- [ ] 運行完整測試套件
- [ ] 檢查生產環境健康狀態

---

## 📊 預期改善

### 代碼簡化
- 移除檔案數: ~15 個核心文件
- 移除代碼行數: ~3000+ 行
- 減少維護複雜度: 50%

### 系統性能
- 移除雙重系統維護負擔
- 降低代碼複雜度
- 提升開發效率

### 用戶體驗
- 統一使用 WebSocket
- 延遲降低 75%
- 更好的即時互動體驗

---

## ⚠️ 風險管理

### 保留策略
1. **緊急回滾機制**
   - 保留 `scripts/emergency-rollback.sh`
   - 可快速切回 SSE（如需要）

2. **代碼備份**
   - 所有刪除的 SSE 代碼將備份到 `backups/sse-legacy/`
   - Git history 保留完整記錄

3. **監控告警**
   - 持續監控 WebSocket 健康狀態
   - 設置錯誤率告警

---

## 📅 執行時間表

### 今天 (2025-10-08)
- [x] 驗證當前 50% 狀態
- [ ] 提升到 75%
- [ ] 監控 2-4 小時
- [ ] 提升到 100%

### 明天 (2025-10-09)
- [ ] 驗證 100% 穩定運行
- [ ] 開始 SSE 代碼清理
- [ ] 第一批：移除後端核心文件
- [ ] 第二批：移除前端文件

### 後天 (2025-10-10)
- [ ] 完成所有代碼清理
- [ ] 更新文檔
- [ ] 執行完整測試
- [ ] 生成最終報告

---

**狀態**: 準備執行
**負責人**: DevOps Team
**最後更新**: 2025-10-08
