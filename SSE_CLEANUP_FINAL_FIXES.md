# SSE Cleanup - Remining TypeScript Errors Final Fixes

## 剩餘需要修復的文件 (Realtime Module)

### 已完成 (5/12):
1. ✅ src/handlers/index.ts
2. ✅ src/handlers/notification-router.ts
3. ✅ src/handlers/queue-monitor.ts
4. ✅ src/modules/collaboration/services/collaboration-manager.ts
5. ✅ src/modules/notifications/services/notification-channel-service.ts

### 待修復 (7/12):
6. ⏳ src/modules/realtime/handlers/event-handler.ts
7. ⏳ src/modules/realtime/handlers/realtime-main.ts
8. ⏳ src/modules/realtime/index.ts
9. ⏳ src/modules/realtime/middleware/realtime-auth.ts
10. ⏳ src/modules/realtime/monitoring/dashboard-handler.ts
11. ⏳ src/modules/realtime/monitoring/performance-monitor.ts
12. ⏳ src/modules/realtime/services/realtime-manager.ts

## 修復策略

所有剩餘文件都在 realtime 模塊中，需要移除以下導入：
- `@modules/realtime/handlers/sse-handler` → 移除或替換為 WebSocket
- `./sse-handler` → 移除
- `SSEAuthPayload` → 從 types 中移除
- `enhancedSSEManager`, `sseHandler`, `sseConfig` → 全部移除

## 批量修復命令

```bash
# 修復 event-handler.ts
# 移除所有 sse-handler 導入和引用

# 修復 realtime-main.ts
# 移除所有 sse-handler 導入和引用

# 修復 index.ts
# 移除 sseHandler 和 SSEConnectionPool 導出

# 修復 realtime-auth.ts
# 移除 SSEAuthPayload 類型

# 修復 dashboard-handler.ts
# 移除 sse-handler 導入

# 修復 performance-monitor.ts
# 移除 sse-handler 導入

# 修復 realtime-manager.ts
# 移除 sse-handler 導入
```

## 通用修復模式

```typescript
// BEFORE:
import { enhancedSSEManager } from '@modules/realtime/handlers/sse-handler';

// AFTER:
// REMOVED: enhancedSSEManager (Phase 3 cleanup - SSE removed, WebSocket only)
```

## 進度追蹤

- 已修復文件：5/12 (42%)
- 待修復文件：7/12 (58%)
- 預計完成時間：繼續逐個修復剩餘文件
