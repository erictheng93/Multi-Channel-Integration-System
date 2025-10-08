# ConversationDetail.vue Refactoring Plan
**Phase 2.1 Step 1.4 - Unified Connection Manager Integration**
**Date**: 2025-10-07

## 📋 Current Architecture Analysis

### Current Connection Strategy (Lines 250-360)
```typescript
// 🚀 Phase 1: SSE-Primary Migration Strategy
const migration = useWebSocketMigration({
  strategy: 'sse_only',
  fallbackToSSE: true,
  rolloutPercentage: 0
})

// 🎯 Primary: SSE Messages System
const sseMessages = useSSEMessages(conversationId, {
  autoConnect: true,
  reconnectOnError: true
})

// 🔄 Fallback: WebSocket System (currently disabled)
const conversationWS = useConversationWebSocket(conversationId, {
  autoJoin: false,
  enableTypingIndicators: false
})

// 🛡️ Final Fallback: HTTP API System
const httpMessages = useMessages(conversationId.value, {
  enablePagination: true,
  pageSize: 10
})
```

### Current Message Source Logic (Lines 333-361)
使用多層條件判斷:
1. Priority 1: SSE + HTTP Hybrid
2. Priority 2: WebSocket (disabled)
3. Priority 3: HTTP API fallback

## 🎯 Target Architecture

### New Unified Connection Strategy
```typescript
import { createRealtimeConnection, type RealtimeConnection } from '@/services/realtimeConnectionManager'

// ✅ Single unified connection (automatically selects WebSocket or SSE)
const connection = ref<RealtimeConnection | null>(null)

// 🛡️ HTTP API as backup for sending messages (SSE is receive-only)
const httpMessages = useMessages(conversationId.value, {
  enablePagination: true,
  pageSize: 10
})
```

## 📝 Refactoring Steps

### Step 1: Replace Connection Initialization (Lines 250-290)
**Before**:
```typescript
const migration = useWebSocketMigration(...)
const sseMessages = useSSEMessages(...)
const conversationWS = useConversationWebSocket(...)
```

**After**:
```typescript
const connection = ref<RealtimeConnection | null>(null)
const connectionType = ref<ConnectionType>('sse')
const connectionState = ref<ConnectionState>('disconnected')
const isConnected = ref(false)
```

### Step 2: Simplify Connection State Management (Lines 295-330)
**Remove**:
- `connectionState` composable (複雜的多源狀態合併)
- `loadingState` composable (3 個數據源的加載狀態合併)

**Replace with**:
- 直接使用 `connection.value.connectionState`
- 直接使用 `connection.value.isConnected`

### Step 3: Update Message Source Logic (Lines 333-361)
**Before**:
```typescript
const messages = computed((): Message[] => {
  if (sseMessages.isConnected.value) {
    // 混合 SSE + HTTP 消息
  }
  if (migration.shouldUseWebSocket.value && conversationWS.isJoined.value) {
    return conversationWS.messages.value
  }
  return httpMessages.messages.value
})
```

**After**:
```typescript
const messages = computed((): Message[] => {
  if (connection.value && connection.value.isConnected.value) {
    // 自動處理 WebSocket 或 SSE 消息
    // 合併歷史消息（HTTP API）
    const realtimeMessages = connection.value.messages.value
    const httpHistoryMessages = httpMessages.messages.value.filter(
      m => !realtimeMessages.some(rm => rm.id === m.id)
    )
    return [...httpHistoryMessages, ...realtimeMessages].sort(...)
  }
  return httpMessages.messages.value
})
```

### Step 4: Simplify Message Sending (Lines 602-659)
**Before**:
```typescript
const handleMessageSent = async (data) => {
  // Priority 1: Send via HTTP API
  const success = await httpMessages.sendMessage(data.content)

  // Priority 2: WebSocket fallback
  if (isWebSocketEnabled.value) {
    const wsSuccess = await conversationWS.sendMessage(data.content)
  }
}
```

**After**:
```typescript
const handleMessageSent = async (data) => {
  if (connection.value) {
    // WebSocket 可以直接發送
    if (connectionType.value === 'websocket') {
      connection.value.send({
        type: 'message',
        data: { content: data.content, conversationId: conversationId.value }
      })
      return
    }

    // SSE 需要通過 HTTP API 發送（SSE 只接收）
    const success = await httpMessages.sendMessage(data.content)
    if (success) {
      // SSE 會自動接收服務器推送的新消息
      return
    }
  }
}
```

### Step 5: Update Connection Status Display (Lines 485-546)
**Before**:
```typescript
const connectionStatusText = performanceOptimizer.cachedComputed(() => {
  // Priority 1: SSE Status
  if (sseMessages.isConnected.value) { ... }
  if (sseMessages.isConnecting.value) { ... }

  // Priority 2: WebSocket Status
  if (currentProtocol.value === 'websocket') { ... }

  // Priority 3: HTTP Fallback
  if (currentProtocol.value === 'http') { ... }
})
```

**After**:
```typescript
const connectionStatusText = computed(() => {
  if (!connection.value) { return '⚠️ 未連接' }

  const type = connectionType.value === 'websocket' ? 'WebSocket' : 'SSE'
  const state = connectionState.value

  switch (state) {
    case 'connected':
      return `🔌 ${type} 已連接 (${messages.value.length} 條訊息)`
    case 'connecting':
      return `🔌 ${type} 連接中...`
    case 'reconnecting':
      return `🔌 ${type} 重連中...`
    case 'error':
      return `❌ ${type} 連接失敗`
    default:
      return '⚠️ 未連接'
  }
})
```

### Step 6: Initialize Connection (onMounted)
**Add**:
```typescript
async function initializeConnection() {
  try {
    console.log('[ConversationDetail] Initializing unified connection')

    // 創建統一連接（自動選擇 WebSocket 或 SSE）
    connection.value = await createRealtimeConnection(conversationId.value)

    // 儲存連接類型
    connectionType.value = connection.value.type

    // 設置事件處理器
    connection.value.onMessage(handleIncomingMessage)
    connection.value.onStateChange(handleStateChange)
    connection.value.onError(handleConnectionError)

    // 連接
    await connection.value.connect()

    console.log(`[ConversationDetail] Connected via ${connectionType.value}`)
  } catch (error) {
    console.error('[ConversationDetail] Failed to initialize connection:', error)
    connectionState.value = 'error'
  }
}

function handleStateChange(newState: ConnectionState) {
  connectionState.value = newState
  isConnected.value = newState === 'connected'
}

function handleIncomingMessage(message: any) {
  console.log('[ConversationDetail] Received message:', message)
  // 統一的消息處理邏輯
  switch (message.type) {
    case 'event':
      handleRealtimeEvent(message.data)
      break
    case 'message_sent':
    case 'new_messages':
      // 消息已自動添加到 connection.messages
      scrollToNewest()
      break
  }
}

function handleConnectionError(error: Error) {
  console.error('[ConversationDetail] Connection error:', error)
}
```

## 🔧 Code Removal List

### Lines to Remove/Replace
1. **Lines 250-256**: `useWebSocketMigration` - 不再需要
2. **Lines 258-259**: `useWebSocketStatus` - 不再需要（保留用於監控）
3. **Lines 274-279**: `useSSEMessages` - 替換為統一連接
4. **Lines 282-286**: `useConversationWebSocket` - 替換為統一連接
5. **Lines 295-303**: `useConnectionState` - 簡化為直接狀態
6. **Lines 305-311**: `useLoadingState` - 簡化為直接狀態
7. **Lines 333-361**: 複雜的消息源邏輯 - 簡化為統一接口
8. **Lines 428-429**: `isWebSocketEnabled` - 替換為 `connectionType.value === 'websocket'`
9. **Lines 485-546**: 複雜的狀態文本生成 - 簡化為統一邏輯

### Lines to Keep
- **Lines 289-292**: `httpMessages` - 保留用於歷史消息和 SSE 發送
- **Lines 382-391**: `useSmoothLoading` - 保留動畫效果
- **Lines 262-268**: Performance monitoring - 保留
- **Lines 322-329**: Error handling - 保留

## ✅ Benefits

### 1. Code Simplification
- **Before**: 3 種連接類型 + 多層條件判斷 (~200 lines)
- **After**: 1 個統一接口 + 簡單條件 (~80 lines)
- **減少**: ~60% 代碼行數

### 2. Maintenance Improvement
- 單一真相來源（Single Source of Truth）
- 清晰的狀態管理
- 更容易測試和調試

### 3. Performance Optimization
- 減少計算開銷（無需多源狀態合併）
- 更少的響應式依賴
- 更快的狀態更新

### 4. Migration Readiness
- Feature Toggle 自動工作
- 無需修改組件即可切換連接類型
- 支持 0% → 100% 漸進式遷移

## 🚀 Implementation Timeline

- **Step 1-2**: 10 minutes (狀態初始化)
- **Step 3**: 15 minutes (消息源邏輯)
- **Step 4**: 10 minutes (消息發送)
- **Step 5**: 10 minutes (狀態顯示)
- **Step 6**: 15 minutes (連接初始化)
- **Testing**: 20 minutes (瀏覽器測試)

**Total**: ~80 minutes

## 📊 Risk Assessment

### Low Risk
- 不影響現有 SSE 功能（SSE 仍可用）
- 漸進式切換（通過 rolloutPercentage）
- 完整的錯誤處理和回退機制

### Mitigation Strategy
- 保留 `httpMessages` 作為最終回退
- 詳細的日誌記錄便於調試
- 可快速回滾到舊版本（Git commit）

## 🔍 Testing Checklist

- [ ] SSE 連接正常（rolloutPercentage: 0%）
- [ ] WebSocket 連接正常（rolloutPercentage: 100%）
- [ ] 消息發送和接收
- [ ] 連接狀態顯示正確
- [ ] 錯誤處理和重連
- [ ] 性能無退化
- [ ] 舊功能無破壞（打字指示器、已讀狀態等）

---

**Status**: ✅ Ready for implementation
**Approved by**: WebSocket Migration Team
**Implementation Date**: 2025-10-07
