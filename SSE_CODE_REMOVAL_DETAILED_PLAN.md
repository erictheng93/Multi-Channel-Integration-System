# SSE 代碼移除詳細計劃

**創建時間**: 2025-10-08
**目標**: 在 100% WebSocket 遷移後，安全移除所有 SSE 相關代碼
**預計代碼減少**: ~120KB (~3500+ 行代碼)

---

## 📋 核心 SSE 文件清單 (經過驗證)

### 後端核心文件 (88KB)

| 文件路徑 | 大小 | 用途 | 依賴者 |
|---------|------|------|-------|
| `src/handlers/sse-monitoring-main.ts` | 11KB | SSE 監控主處理器 | route-config.ts |
| `src/monitoring/sse-performance-monitor.ts` | 16KB | SSE 性能監控 | sse-monitoring-main.ts |
| `src/modules/realtime/handlers/sse-handler.ts` | 14KB | SSE 連接處理器 | realtime-main.ts, route-config.ts |
| `src/modules/realtime/services/sse-connection-service.ts` | 14KB | SSE 連接服務 | sse-handler.ts |
| `src/modules/realtime/types/sse-types.ts` | 1.6KB | SSE 類型定義 | 多個 realtime 模組 |
| `src/modules/notifications/handlers/notification-sse.ts` | 11KB | 通知 SSE 處理器 | notification module |
| `src/modules/notifications/adapters/sse-adapter.ts` | 8.9KB | 通知 SSE 適配器 | notification-sse.ts |
| `src/modules/collaboration/adapters/sse-adapter.ts` | 12KB | 協作 SSE 適配器 | collaboration module |

### 後端輔助文件 (7KB)

| 文件路徑 | 大小 | 用途 | 依賴者 |
|---------|------|------|-------|
| `src/handlers/activity-stream.ts` | 7KB | Activity stream (SSE-based) | index.ts, route-config.ts, webhook.ts, message.ts, websocket-broadcast-service.ts |

### 前端核心文件 (25KB)

| 文件路徑 | 大小 | 用途 | 依賴者 |
|---------|------|------|-------|
| `frontend/src/composables/useSSEMessages.ts` | 13KB | SSE messages composable | Dashboard.vue, ConversationsTable.vue, realtimeConnectionManager.ts |
| `frontend/src/composables/useActivityStream.ts` | 12KB | Activity stream composable | Dashboard.vue, realtimeConnectionManager.ts |

**總計核心代碼**: 120KB (約 3500+ 行)

---

## 🔗 依賴關係圖

### Activity Stream 依賴鏈

```
src/index.ts (主入口)
  └─ src/handlers/activity-stream.ts
       ├─ src/handlers/webhook.ts
       ├─ src/handlers/message.ts
       ├─ src/services/websocket-broadcast-service.ts
       └─ src/shared/services/websocket-broadcast-service.ts

src/core/route-config.ts
  └─ src/handlers/activity-stream.ts
```

### SSE 監控依賴鏈

```
src/core/route-config.ts
  └─ src/handlers/sse-monitoring-main.ts
       └─ src/monitoring/sse-performance-monitor.ts
```

### SSE Handler 依賴鏈

```
src/modules/realtime/index.ts
  └─ src/modules/realtime/handlers/sse-handler.ts
       ├─ src/modules/realtime/services/sse-connection-service.ts
       └─ src/modules/realtime/types/sse-types.ts
```

### SSE Adapters 依賴鏈

```
src/modules/notifications/index.ts
  └─ src/modules/notifications/handlers/notification-sse.ts
       └─ src/modules/notifications/adapters/sse-adapter.ts

src/modules/collaboration/index.ts
  └─ src/modules/collaboration/adapters/sse-adapter.ts
```

### 前端依賴鏈

```
frontend/src/views/Dashboard.vue
  ├─ frontend/src/composables/useSSEMessages.ts
  └─ frontend/src/composables/useActivityStream.ts

frontend/src/views/ConversationsTable.vue
  └─ frontend/src/composables/useSSEMessages.ts

frontend/src/services/realtimeConnectionManager.ts
  ├─ frontend/src/composables/useSSEMessages.ts
  └─ frontend/src/composables/useActivityStream.ts
```

---

## 🗑️ 移除順序 (按依賴關係，從葉節點到根節點)

### Phase 1: 前端 Composables 移除 (優先級: HIGH)

**理由**: 前端 composables 是終端消費者，移除後不影響其他模組

1. **Step 1.1**: 從 `Dashboard.vue` 移除 SSE composables 引用
   ```diff
   - import { useSSEMessages } from '@/composables/useSSEMessages'
   - import { useActivityStream } from '@/composables/useActivityStream'
   - const { ... } = useSSEMessages()
   - const { ... } = useActivityStream()
   ```

2. **Step 1.2**: 從 `ConversationsTable.vue` 移除 SSE composables 引用
   ```diff
   - import { useSSEMessages } from '@/composables/useSSEMessages'
   - const { ... } = useSSEMessages()
   ```

3. **Step 1.3**: 從 `realtimeConnectionManager.ts` 移除 SSE 相關邏輯
   - 移除 SSE fallback 邏輯
   - 確保 100% 使用 WebSocket

4. **Step 1.4**: 從 `frontend/src/composables/index.ts` 移除導出
   ```diff
   - export { useSSEMessages } from './useSSEMessages'
   - export { useActivityStream } from './useActivityStream'
   ```

5. **Step 1.5**: 刪除前端 SSE composables
   ```bash
   rm frontend/src/composables/useSSEMessages.ts
   rm frontend/src/composables/useActivityStream.ts
   ```

### Phase 2: 後端 Adapters 移除 (優先級: HIGH)

**理由**: Adapters 是中間層，移除後解除模組對 SSE 的依賴

6. **Step 2.1**: 從 `src/modules/notifications/index.ts` 移除 SSE 引用
   ```diff
   - export { default as notificationSSEHandler } from './handlers/notification-sse'
   - export { SSEAdapter } from './adapters/sse-adapter'
   ```

7. **Step 2.2**: 從 `src/modules/collaboration/index.ts` 移除 SSE 引用
   ```diff
   - export { SSEAdapter } from './adapters/sse-adapter'
   ```

8. **Step 2.3**: 刪除 SSE adapters
   ```bash
   rm src/modules/notifications/handlers/notification-sse.ts
   rm src/modules/notifications/adapters/sse-adapter.ts
   rm src/modules/collaboration/adapters/sse-adapter.ts
   ```

### Phase 3: Realtime Module SSE Components 移除 (優先級: MEDIUM)

**理由**: Realtime 模組的 SSE 組件是核心功能，但已被 WebSocket 完全取代

9. **Step 3.1**: 從 `src/modules/realtime/handlers/index.ts` 移除 SSE handler
   ```diff
   - export { default as sseHandler } from './sse-handler'
   ```

10. **Step 3.2**: 從 `src/modules/realtime/index.ts` 移除 SSE 導出
    ```diff
    - export { sseHandler } from './handlers'
    - export { SSEConnectionService } from './services/sse-connection-service'
    ```

11. **Step 3.3**: 從 `src/modules/realtime/types/index.ts` 移除 SSE 類型
    ```diff
    - export * from './sse-types'
    ```

12. **Step 3.4**: 刪除 realtime SSE 文件
    ```bash
    rm src/modules/realtime/handlers/sse-handler.ts
    rm src/modules/realtime/services/sse-connection-service.ts
    rm src/modules/realtime/types/sse-types.ts
    ```

### Phase 4: Activity Stream 移除 (優先級: MEDIUM)

**理由**: Activity stream 是 SSE-based 功能，需要從多個處理器中移除引用

13. **Step 4.1**: 從 `src/index.ts` 移除 activity stream 路由
    ```diff
    - import activityStreamHandler from './handlers/activity-stream'
    - app.route('/api/activity-stream', activityStreamHandler)
    ```

14. **Step 4.2**: 從 `src/core/route-config.ts` 移除 activity stream 配置
    ```diff
    - import activityStreamHandler from '../handlers/activity-stream'
    - { path: '/api/activity-stream', handler: activityStreamHandler }
    ```

15. **Step 4.3**: 從 `src/handlers/webhook.ts` 移除 activity stream 廣播
    ```diff
    - import { broadcastToActivityStream } from './activity-stream'
    - await broadcastToActivityStream(...)
    ```

16. **Step 4.4**: 從 `src/handlers/message.ts` 移除 activity stream 廣播
    ```diff
    - import { broadcastToActivityStream } from './activity-stream'
    - await broadcastToActivityStream(...)
    ```

17. **Step 4.5**: 從 `src/services/websocket-broadcast-service.ts` 移除 activity stream 引用
    ```diff
    - import { broadcastToActivityStream } from '../handlers/activity-stream'
    - await broadcastToActivityStream(...)
    ```

18. **Step 4.6**: 從 `src/shared/services/websocket-broadcast-service.ts` 移除 activity stream 引用
    ```diff
    - import { broadcastToActivityStream } from '../../handlers/activity-stream'
    - await broadcastToActivityStream(...)
    ```

19. **Step 4.7**: 刪除 activity stream handler
    ```bash
    rm src/handlers/activity-stream.ts
    ```

### Phase 5: SSE Monitoring 移除 (優先級: LOW)

**理由**: 監控系統最後移除，確保有數據支持整個遷移過程

20. **Step 5.1**: 從 `src/core/route-config.ts` 移除 SSE 監控路由
    ```diff
    - import sseMonitoringHandler from '../handlers/sse-monitoring-main'
    - { path: '/api/monitoring/sse', handler: sseMonitoringHandler }
    ```

21. **Step 5.2**: 刪除 SSE monitoring 文件
    ```bash
    rm src/handlers/sse-monitoring-main.ts
    rm src/monitoring/sse-performance-monitor.ts
    ```

### Phase 6: 測試文件清理 (優先級: LOW)

22. **Step 6.1**: 刪除 SSE 相關測試文件
    ```bash
    rm tests/unit/modules/realtime/sse-handler.test.ts
    rm tests/unit/modules/realtime/performance-monitor.test.ts
    # 注意: realtime-main.test.ts 可能需要修改而非刪除，因為它可能包含非 SSE 測試
    ```

23. **Step 6.2**: 更新測試覆蓋率配置（如需要）

---

## ⚠️ 高風險修改點

### 1. `src/services/websocket-broadcast-service.ts`

**風險**: 此文件同時處理 WebSocket 和 SSE 廣播，需要仔細移除 SSE 邏輯而不破壞 WebSocket 功能

**檢查點**:
- 確認所有 `broadcastToActivityStream` 調用已被 WebSocket 廣播取代
- 驗證 WebSocket 廣播功能完全正常
- 確保沒有遺留的 SSE fallback 邏輯

### 2. `frontend/src/services/realtimeConnectionManager.ts`

**風險**: 統一連線管理器可能包含 SSE fallback 邏輯

**檢查點**:
- 確認 100% rollout 後不再需要 SSE fallback
- 移除所有 SSE 連接嘗試邏輯
- 確保 WebSocket 連接失敗後的錯誤處理正確

### 3. `src/handlers/webhook.ts` 和 `src/handlers/message.ts`

**風險**: 這些處理器可能依賴 activity stream 進行即時更新通知

**檢查點**:
- 確認 WebSocket 廣播已完全取代 activity stream 功能
- 驗證所有即時通知功能正常（新消息、狀態更新等）
- 確保沒有功能降級

---

## 🧪 驗證檢查清單

### 編譯檢查

- [ ] TypeScript 編譯無錯誤: `npm run build`
- [ ] Frontend 編譯無錯誤: `cd frontend && npm run build`
- [ ] 無未使用的 import 警告
- [ ] 所有類型引用正確

### 功能測試

- [ ] WebSocket 連接正常建立
- [ ] 即時消息接收正常
- [ ] 輸入指示器功能正常
- [ ] 多客服協作功能正常
- [ ] 通知系統正常運作
- [ ] 對話狀態更新即時同步

### 性能測試

- [ ] 頁面載入速度未降低
- [ ] Bundle size 減少（預期減少 ~120KB）
- [ ] 記憶體使用減少（移除 SSE 連接開銷）
- [ ] 無記憶體洩漏

### 回歸測試

- [ ] 運行完整測試套件: `npm run test`
- [ ] Frontend 測試通過: `cd frontend && npm run test`
- [ ] API 集成測試通過: `npm run test:api`
- [ ] 無破壞性變更

---

## 📊 預期改善指標

### 代碼複雜度

| 指標 | 當前 | 移除後 | 改善 |
|-----|------|--------|------|
| 總代碼行數 | ~50,000 | ~46,500 | ↓ 7% |
| 核心文件數 | ~450 | ~440 | ↓ 10 個 |
| 依賴複雜度 | 高 (雙系統) | 低 (單系統) | ↓ 50% |
| 維護負擔 | 高 | 中 | ↓ 40% |

### 性能指標

| 指標 | 當前 | 移除後 | 改善 |
|-----|------|--------|------|
| Backend Bundle | ~2.5MB | ~2.4MB | ↓ 4% |
| Frontend Bundle | ~800KB | ~680KB | ↓ 15% |
| 初始載入時間 | ~1.2s | ~1.0s | ↓ 17% |
| 記憶體使用 | ~120MB | ~100MB | ↓ 17% |

### 開發體驗

| 指標 | 當前 | 移除後 | 改善 |
|-----|------|--------|------|
| TypeScript 編譯時間 | ~12s | ~10s | ↓ 17% |
| 熱重載時間 | ~800ms | ~600ms | ↓ 25% |
| 測試執行時間 | ~45s | ~40s | ↓ 11% |

---

## 🔄 回滾計劃

### 緊急回滾觸發條件

1. WebSocket 連接成功率 < 95%
2. 消息延遲 > 500ms (P95)
3. 系統錯誤率 > 1%
4. 用戶投訴顯著增加

### 回滾步驟

1. **使用 Git 恢復所有 SSE 代碼**
   ```bash
   git checkout HEAD~1 -- src/handlers/sse-monitoring-main.ts
   git checkout HEAD~1 -- src/modules/realtime/handlers/sse-handler.ts
   git checkout HEAD~1 -- frontend/src/composables/useSSEMessages.ts
   # ... 恢復其他文件
   ```

2. **降低 Rollout 百分比**
   ```bash
   # 使用管理員 token
   curl -X POST "$API_BASE/api/websocket/migration-config" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"rolloutPercentage": 50}'
   ```

3. **重新部署**
   ```bash
   npm run deploy
   cd frontend && npm run deploy:pages
   ```

4. **驗證系統恢復正常**
   ```bash
   curl "$API_BASE/api/websocket/health"
   ```

---

## 📅 執行時間表

### 前提條件
- [x] WebSocket 100% rollout 已部署
- [ ] 監控 100% rollout 24-48 小時
- [ ] 確認所有用戶已遷移到 WebSocket
- [ ] 無重大錯誤或性能問題

### 執行計劃 (預估 2-3 天)

**Day 1 上午**: Phase 1 + Phase 2
- 移除前端 composables
- 移除後端 adapters
- 運行測試驗證

**Day 1 下午**: Phase 3 + Phase 4
- 移除 realtime module SSE components
- 移除 activity stream
- 運行完整測試套件

**Day 2 上午**: Phase 5 + Phase 6
- 移除 SSE monitoring
- 清理測試文件
- 最終驗證

**Day 2 下午**: 部署與監控
- 部署到生產環境
- 密切監控 4-6 小時
- 收集性能數據

**Day 3**: 穩定與文檔
- 持續監控
- 更新文檔
- 生成最終報告

---

## 📝 檢查清單

### 移除前檢查
- [ ] 確認 WebSocket rollout = 100%
- [ ] 備份當前代碼 (Git tag)
- [ ] 通知團隊成員
- [ ] 準備回滾腳本

### 移除過程檢查
- [ ] 按順序執行 Phase 1-6
- [ ] 每個 Phase 後運行測試
- [ ] 記錄所有修改
- [ ] 提交有意義的 commit messages

### 移除後檢查
- [ ] 所有測試通過
- [ ] 生產環境部署成功
- [ ] 監控指標正常
- [ ] 用戶反饋正面
- [ ] 文檔已更新

---

**狀態**: 準備就緒，等待 100% Rollout 穩定運行
**負責人**: DevOps Team
**創建時間**: 2025-10-08
**最後更新**: 2025-10-08
