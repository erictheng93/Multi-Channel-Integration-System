# ConversationDetail.vue 修改指南
**Phase 2.1 Step 1.4 - 統一連接管理器集成**
**日期**: 2025-10-07
**狀態**: ⏳ 部分完成,待繼續

---

## ✅ 已完成的修改

### 1. Import 語句修改 (Lines 208-220)
**已完成**: ✅
- 移除: `useWebSocketMigration`, `useWebSocketStatus`, `useConversationWebSocket`, `useSSEMessages`, `useConnectionState`, `useLoadingState`
- 新增: `createRealtimeConnection`, `RealtimeConnection`, `ConnectionType`, `ConnectionState` from `@/services/realtimeConnectionManager`

### 2. 連接初始化修改 (Lines 265-278)
**已完成**: ✅
```typescript
// Before: 多個連接系統
const sseMessages = useSSEMessages(...)
const conversationWS = useConversationWebSocket(...)
const migration = useWebSocketMigration(...)

// After: 統一連接系統
const connection = ref<RealtimeConnection | null>(null)
const connectionType = ref<ConnectionType>('sse')
const connectionState = ref<ConnectionState>('disconnected')
const isConnected = ref(false)
```

---

## 🔄 待完成的修改

### 3. 移除舊的 migration 變量定義 (Line ~250)
**位置**: Line 250附近
**操作**: 刪除以下代碼
```typescript
const migration = useWebSocketMigration({
  strategy: 'sse_only',
  fallbackToSSE: true,
  rolloutPercentage: 0
})

// WebSocket Status Monitoring
const websocketStatus = useWebSocketStatus()
```

### 4. 更新消息源邏輯 (Lines 302-330)
**位置**: Lines 302-330
**當前代碼**:
```typescript
const messages = computed((): Message[] => {
  if (sseMessages.isConnected.value) {
    const sseMessageIds = new Set(sseMessages.messages.value.map(m => m.id))
    const httpHistoryMessages = httpMessages.messages.value.filter(
      m => !sseMessageIds.has(m.id)
    )
    const mergedMessages = [...httpHistoryMessages, ...sseMessages.messages.value].sort(...)
    return mergedMessages
  }

  if (migration.shouldUseWebSocket.value && conversationWS.isJoined.value) {
    return conversationWS.messages.value
  }

  return httpMessages.messages.value
})
```

**修改為**:
```typescript
const messages = computed((): Message[] => {
  // 如果統一連接已建立且連接中
  if (connection.value && isConnected.value) {
    const realtimeMessages = connection.value.messages.value
    const realtimeMessageIds = new Set(realtimeMessages.map(m => m.id))

    // 過濾出不在實時消息中的 HTTP 歷史消息（避免重複）
    const httpHistoryMessages = httpMessages.messages.value.filter(
      m => !realtimeMessageIds.has(m.id)
    )

    // 合併消息並按時間排序（從舊到新）
    const mergedMessages = [...httpHistoryMessages, ...realtimeMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    console.log(`🔀 [Unified] Merged: ${httpHistoryMessages.length} HTTP + ${realtimeMessages.length} ${connectionType.value.toUpperCase()} = ${mergedMessages.length} total`)

    return mergedMessages
  }

  // Fallback: 僅使用 HTTP API 消息
  return httpMessages.messages.value
})
```

### 5. 更新 loading 狀態 (Lines 332-335)
**位置**: Lines 332-335
**當前代碼**:
```typescript
const loading = computed(() => {
  if (sseMessages.isConnected.value) {return false}
  if (migration.shouldUseWebSocket.value) {return conversationWS.loading.value}
  return httpMessages.loading.value
})
```

**修改為**:
```typescript
const loading = computed(() => {
  if (connection.value && isConnected.value) {
    return false
  }
  return httpMessages.loading.value
})
```

### 6. 更新消息統計 (Lines 341-342)
**位置**: Lines 341-342
**當前代碼**:
```typescript
const hasNewMessages = computed(() => sseMessages.messageCount.value > 0 || conversationWS.hasNewMessages.value)
const newMessagesCount = computed(() => sseMessages.messageCount.value || conversationWS.newMessagesCount.value)
```

**修改為**:
```typescript
const hasNewMessages = computed(() => {
  if (!connection.value) return false
  return connection.value.messageCount.value > 0
})

const newMessagesCount = computed(() => {
  if (!connection.value) return 0
  return connection.value.messageCount.value
})
```

### 7. 更新 presence 和 typing (Lines 345-347)
**位置**: Lines 345-347
**當前代碼**:
```typescript
const presence = computed(() => conversationWS.presence.value)
const typingUsers = computed(() => conversationWS.presence.value.typingUsers)
```

**修改為**:
```typescript
const presence = computed(() => ({
  activeUsers: [],
  typingUsers: [],
  isUserTyping: false
}))

const typingUsers = computed(() => presence.value.typingUsers)
```
**注意**: WebSocket DO 尚未實現完整的 presence 功能,暫時返回空值

### 8. 更新 isWebSocketEnabled (Line 395)
**位置**: Line 395
**當前代碼**:
```typescript
const isWebSocketEnabled = computed(() => migration.shouldUseWebSocket.value)
```

**修改為**:
```typescript
const isWebSocketEnabled = computed(() => connectionType.value === 'websocket')
```

### 9. 移除或更新 connectionState 相關引用 (Lines 422-427)
**位置**: Lines 422-427
**當前代碼**:
```typescript
const {
  currentProtocol,
  connectionQuality
} = connectionState
```

**修改為**:
```typescript
const currentProtocol = computed(() => {
  if (!connection.value) return 'http'
  return connectionType.value
})

const connectionQuality = computed(() => {
  if (!connection.value || !isConnected.value) return 'offline'
  // 簡化的質量判斷
  return connectionState.value === 'connected' ? 'excellent' : 'poor'
})
```

### 10. 更新連接狀態文本 (Lines 454-480)
**位置**: Lines 454-480
**當前代碼**:
```typescript
const connectionStatusText = performanceOptimizer.cachedComputed(() => {
  // Priority 1: SSE Status
  if (sseMessages.isConnected.value) {
    return `📡 SSE 已連接 (${sseMessages.messageCount.value} 條訊息)`
  }

  if (sseMessages.isConnecting.value) {
    return '📡 SSE 連接中...'
  }

  // ... 更多條件判斷
})
```

**修改為**:
```typescript
const connectionStatusText = performanceOptimizer.cachedComputed(() => {
  if (!connection.value) {
    return '⚠️ 未連接'
  }

  const typeLabel = connectionType.value === 'websocket' ? 'WebSocket' : 'SSE'
  const icon = connectionType.value === 'websocket' ? '🔌' : '📡'
  const messageCount = messages.value.length

  switch (connectionState.value) {
    case 'connected':
      return `${icon} ${typeLabel} 已連接 (${messageCount} 條訊息)`
    case 'connecting':
      return `${icon} ${typeLabel} 連接中...`
    case 'reconnecting':
      return `${icon} ${typeLabel} 重連中...`
    case 'error':
      return `❌ ${typeLabel} 連接失敗`
    case 'disconnected':
      return `⚠️ ${typeLabel} 已斷開`
    default:
      return '⚠️ 未知狀態'
  }
}, 'connection-status', { timeout: 1000 })
```

### 11. 更新連接狀態樣式 (Lines 486-515)
**位置**: Lines 486-515
**當前代碼**:
```typescript
const connectionStatusClass = computed(() => {
  // SSE Status Classes
  if (sseMessages.isConnected.value) {
    return 'status-connected status-sse'
  }
  // ... 複雜的多層判斷
})
```

**修改為**:
```typescript
const connectionStatusClass = computed(() => {
  const typeClass = connectionType.value === 'websocket' ? 'status-websocket' : 'status-sse'

  switch (connectionState.value) {
    case 'connected':
      return `status-connected ${typeClass}`
    case 'connecting':
      return `status-connecting ${typeClass}`
    case 'reconnecting':
      return `status-reconnecting ${typeClass}`
    case 'error':
      return `status-error ${typeClass}`
    case 'disconnected':
      return `status-disconnected ${typeClass}`
    default:
      return `status-disconnected ${typeClass}`
  }
})
```

### 12. 更新消息發送處理 (Lines 569-625)
**位置**: Lines 569-625
**當前代碼**: 複雜的多層 fallback 邏輯
**修改為**:
```typescript
const handleMessageSent = async (data: { content: string; attachments: unknown[] }) => {
  console.log('📤 [Message] Sending via:', currentProtocol.value)
  trackUserActivity()
  stopTyping()

  if (!data.content?.trim()) {
    console.warn('Empty message content, skipping send')
    return
  }

  try {
    // WebSocket 可以直接發送
    if (connection.value && connectionType.value === 'websocket' && isConnected.value) {
      const success = connection.value.send({
        type: 'message',
        data: {
          content: data.content,
          conversationId: conversationId.value,
          messageType: 'text'
        }
      })

      if (success) {
        console.log('✅ [Message] Sent via WebSocket')
        scrollToNewest()
        return
      }
    }

    // SSE 或 WebSocket 失敗 → 使用 HTTP API
    const success = await httpMessages.sendMessage(data.content)
    if (success) {
      console.log('✅ [Message] Sent via HTTP API')
      scrollToNewest()
      // SSE 會自動接收服務器推送的新消息,無需手動添加
      return
    }

    errorHandler.handleError(
      '消息發送失敗',
      { operation: 'send_message', content: data.content.substring(0, 50) },
      ErrorType._NETWORK
    )

  } catch (error) {
    errorHandler.handleError(
      error as Error,
      { operation: 'send_message_exception' },
      ErrorType._CLIENT
    )
  }

  resetPollingDelay()
  scrollToNewest()
}
```

### 13. 更新消息刷新處理 (Lines 629-658)
**位置**: Lines 629-658
**當前代碼**: 多層條件判斷
**修改為**:
```typescript
const handleRefreshMessages = async () => {
  console.log('🔄 [Refresh] Manual refresh triggered via:', currentProtocol.value)
  trackUserActivity()

  try {
    // 如果連接有錯誤,嘗試重連
    if (connection.value && connectionState.value === 'error') {
      console.log('🔄 [Refresh] Reconnecting...')
      connection.value.reconnect()
    }

    // 如果未連接,使用 HTTP 刷新
    if (!connection.value || !isConnected.value) {
      console.log('🔄 [Refresh] Using HTTP API refresh...')
      await httpMessages.refreshMessages()
    }

    resetPollingDelay()
    console.log('✅ [Refresh] Manual refresh completed')

  } catch (error) {
    console.error('❌ [Refresh] Failed to refresh messages:', error)
  }
}
```

### 14. 更新 typing 處理函數 (Lines 671-735)
**位置**: Lines 671-735
**操作**: 簡化邏輯,移除 WebSocket typing 相關代碼
```typescript
const startTyping = () => {
  isTyping.value = true
  isLocalTyping.value = true

  // WebSocket typing indicators (待 DO 實現完整後啟用)
  if (connectionType.value === 'websocket' && isConnected.value) {
    // TODO: 實現 WebSocket typing 指示器
    console.debug('[Typing] WebSocket typing start (not yet implemented)')
  }

  // Auto-stop typing after delay
  debouncedStopTyping()
}

const stopTyping = () => {
  isTyping.value = false
  isLocalTyping.value = false

  if (connectionType.value === 'websocket' && isConnected.value) {
    console.debug('[Typing] WebSocket typing stop (not yet implemented)')
  }
}
```

### 15. 移除 WebSocket typing 函數 (Lines 722-735)
**位置**: Lines 722-735
**操作**: 刪除或註釋以下函數
```typescript
// const startWebSocketTyping = () => { ... }
// const stopWebSocketTyping = () => { ... }
```

### 16. 移除 isWebSocketJoined (Line 426)
**位置**: Line 426
**當前代碼**:
```typescript
const isWebSocketJoined = computed(() =>
  isWebSocketEnabled.value && conversationWS.isJoined.value
)
```
**操作**: 刪除此變量,並將所有使用 `isWebSocketJoined.value` 的地方改為 `isConnected.value && connectionType.value === 'websocket'`

### 17. 更新 loadingState 引用 (Lines 382, 414-415)
**位置**: 多處使用 `loadingState`
**當前代碼**:
```typescript
const { hasLoadedInitially, isInitialLoading, loadingHistory } = loadingState
```
**修改為**:
```typescript
const hasLoadedInitially = ref(false)
const isInitialLoading = ref(true)
const loadingHistory = ref(false)
```

並添加邏輯函數:
```typescript
function setHistoryLoading(value: boolean) {
  loadingHistory.value = value
}
```

### 18. 更新 scrollToNewest 清除計數 (Lines 901-910)
**位置**: Lines 901-910
**當前代碼**:
```typescript
const scrollToNewest = () => {
  if (virtualMessageListRef.value) {
    virtualMessageListRef.value.scrollToBottom()
  }
  showNewMessageModal.value = false
  sseMessages.clearNewMessageCount()
}
```
**修改為**:
```typescript
const scrollToNewest = () => {
  if (virtualMessageListRef.value) {
    virtualMessageListRef.value.scrollToBottom()
  }
  showNewMessageModal.value = false

  // 清除新消息計數
  if (connection.value) {
    connection.value.clearMessages?.() // 可選方法
  }
}
```

### 19. 添加連接初始化函數 (新增在 onMounted 之前)
**位置**: 在 `onMounted` 之前添加
**新增代碼**:
```typescript
// =================== Connection Management ===================

async function initializeConnection() {
  try {
    console.log(`[ConversationDetail] Initializing unified connection for: ${conversationId.value}`)

    // 創建統一連接（自動選擇 WebSocket 或 SSE）
    connection.value = await createRealtimeConnection(conversationId.value)

    // 儲存連接類型
    connectionType.value = connection.value.type
    console.log(`🔌 [ConversationDetail] Using ${connectionType.value.toUpperCase()} connection`)

    // 設置事件處理器
    connection.value.onMessage(handleIncomingMessage)
    connection.value.onStateChange(handleStateChange)
    connection.value.onError(handleConnectionError)

    // 連接
    await connection.value.connect()

    console.log(`✅ [ConversationDetail] Connected via ${connectionType.value}`)

  } catch (error) {
    console.error('[ConversationDetail] Failed to initialize connection:', error)
    connectionState.value = 'error'
  }
}

function handleStateChange(newState: ConnectionState) {
  console.log(`[ConversationDetail] Connection state changed: ${newState}`)
  connectionState.value = newState
  isConnected.value = newState === 'connected'
}

function handleIncomingMessage(message: any) {
  console.log('[ConversationDetail] Received message:', message)

  switch (message.type) {
    case 'connection_established':
      console.log('✅ [ConversationDetail] Connection established:', message.data)
      break

    case 'event':
      handleRealtimeEvent(message.data)
      break

    case 'message_sent':
    case 'new_messages':
      if (message.data?.messages) {
        // 消息已自動添加到 connection.messages
        // 觸發滾動到最新
        scrollToNewest()
      }
      break

    case 'heartbeat':
      // Heartbeat - no action needed
      break

    default:
      console.log('Unknown message type:', message.type)
  }
}

function handleRealtimeEvent(event: any) {
  console.log('[ConversationDetail] Realtime event:', event)

  switch (event.type) {
    case 'typing_start':
      console.log(`User ${event.userId} is typing...`)
      // TODO: 實現打字指示器
      break

    case 'typing_stop':
      console.log(`User ${event.userId} stopped typing`)
      break

    case 'user_joined':
      console.log(`User ${event.userId} joined the conversation`)
      break

    case 'user_left':
      console.log(`User ${event.userId} left the conversation`)
      break

    default:
      console.log('Unknown event type:', event.type)
  }
}

function handleConnectionError(error: Error) {
  console.error('[ConversationDetail] Connection error:', error)
  errorHandler.handleError(
    error,
    { operation: 'connection_error' },
    ErrorType._NETWORK
  )
}
```

### 20. 更新 onMounted 邏輯 (Lines 1003-1059)
**位置**: Lines 1003-1059
**當前代碼**: 包含 `migration` 和多個連接系統的初始化
**修改為**:
```typescript
onMounted(async () => {
  console.log('🔧 ConversationDetail mounted with unified connection')

  // Start performance monitoring
  mark('component-mount-start')
  startMonitoring()

  // Setup event listeners
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('mousemove', trackUserActivity)
  document.addEventListener('click', trackUserActivity)

  // Log performance summary in development
  if (import.meta.env.DEV) {
    performanceReportInterval = setInterval(() => {
      logPerformanceSummary()

      const cacheStats = performanceOptimizer.getCacheStats()
      if (cacheStats.totalHits + cacheStats.totalMisses > 0) {
        console.log('🧠 [Cache Performance]', {
          hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
          size: cacheStats.size,
          totalOperations: cacheStats.totalHits + cacheStats.totalMisses
        })
      }

      const errorStats = errorHandler.getErrorStats()
      if (errorStats.total > 0) {
        console.log('🚨 [Error Statistics]', errorStats)
      }
    }, 10000)
  }

  // Load conversation data and initialize connection
  loadConversation().then(async () => {
    // 初始化統一連接
    await initializeConnection()

    // 標記初始加載完成
    hasLoadedInitially.value = true
    isInitialLoading.value = false

    // 智能預加載相鄰對話
    if (conversationId.value) {
      conversationsStore.preloadAdjacentConversationMessages(conversationId.value)
    }

    measure('component-mount', 'component-mount-start')
  }).catch(error => {
    console.error('Failed to initialize ConversationDetail component:', error)
    isInitialLoading.value = false
    router.push('/conversations')
  })
})
```

### 21. 更新 onUnmounted 邏輯 (Lines 1061-1085)
**位置**: Lines 1061-1085
**當前代碼**: 無連接清理邏輯
**修改為**: 在 `onUnmounted` 頂部添加
```typescript
onUnmounted(() => {
  console.log('[ConversationDetail] Unmounting, disconnecting...')

  // 斷開統一連接
  if (connection.value) {
    connection.value.disconnect()
    connection.value = null
  }

  // Clean up polling
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }

  // ... 其他清理邏輯保持不變
})
```

### 22. 更新 route watcher (Lines 1087-1114)
**位置**: Lines 1087-1114
**操作**: 在對話 ID 變更時重新初始化連接
**修改 watch 邏輯**: 在 `loadConversation()` 之後添加
```typescript
watch(
  () => route.params.id,
  async (newId) => {
    if (!newId || typeof newId !== 'string') return

    console.log(`🔄 Loading conversation: ${newId}`)
    mark('conversation-load-start')

    // 斷開舊連接
    if (connection.value) {
      connection.value.disconnect()
      connection.value = null
    }

    // Reset states
    hasLoadedInitially.value = false
    isInitialLoading.value = true
    currentPollingIndex.value = 0

    try {
      // Load conversation
      await loadConversation()

      // 重新初始化連接
      await initializeConnection()

      measure('conversation-load', 'conversation-load-start')

    } catch (error) {
      console.error(`Failed to load conversation ${newId}:`, error)
      measure('conversation-load-error', 'conversation-load-start')
    }
  },
  { immediate: true, flush: 'post' }
)
```

### 23. 更新 Template 中的連接狀態條 (Lines 153-186)
**位置**: Lines 153-186
**當前代碼**:
```vue
<div
  v-if="sseMessages.isConnected.value || sseMessages.hasError.value || isWebSocketEnabled"
  class="connection-status-bar"
>
  <div class="status-items">
    <span class="status-item">
      <span
        class="status-dot"
        :class="connectionStatusClass"
      />
      {{ connectionStatusText }}
    </span>
    <span
      v-if="sseMessages.connectionState.value.reconnectAttempts > 0"
      class="status-item reconnect-info"
    >
      重連嘗試: {{ sseMessages.connectionState.value.reconnectAttempts }}/{{ sseMessages.canReconnect.value ? '5' : 'max' }}
    </span>
    <!-- ... -->
  </div>
</div>
```

**修改為**:
```vue
<div
  v-if="connection || connectionState === 'error'"
  class="connection-status-bar"
>
  <div class="status-items">
    <span class="status-item">
      <span
        class="status-dot"
        :class="connectionStatusClass"
      />
      {{ connectionStatusText }}
    </span>
    <span
      v-if="presence.typingUsers.length > 0"
      class="status-item"
    >
      {{ presence.typingUsers.length }} 人正在輸入
    </span>
    <span
      v-if="connectionState === 'error'"
      class="status-item error-info"
      title="連接錯誤"
    >
      ⚠️ 連接錯誤
    </span>
  </div>
</div>
```

---

## 🧪 測試檢查清單

完成所有修改後,必須執行以下測試:

- [ ] **TypeScript 編譯**: `npm run type-check`
- [ ] **ESLint 檢查**: `npm run lint:check`
- [ ] **單元測試**: `npm run test`
- [ ] **開發服務器啟動**: `npm run dev`
- [ ] **瀏覽器手動測試**:
  - [ ] 打開對話頁面,檢查控制台輸出連接類型
  - [ ] 發送消息,驗證發送和接收
  - [ ] 檢查連接狀態指示器顯示正確
  - [ ] 測試頁面刷新後重連
  - [ ] 測試切換到不同對話

---

## 📊 修改統計

- **總計修改點**: 23 處
- **已完成**: 2 處 (✅ 8.7%)
- **待完成**: 21 處 (⏳ 91.3%)
- **估計時間**: 剩餘 60-70 分鐘
- **風險等級**: 🟡 Medium (大量修改,需仔細測試)

---

## 🚀 下一步行動

### 選項 A: 自動化執行 (推薦)
讓 Claude 繼續自動化執行剩餘的 21 處修改,一次性完成所有更改。

**優點**:
- 快速完成 (~10 分鐘)
- 一致性高
- 立即可測試

**缺點**:
- 修改量大,可能需要調試
- 需要完整的回歸測試

### 選項 B: 分步驟執行
按照上述順序,逐個功能模塊修改並測試。

**優點**:
- 更容易發現問題
- 可以逐步驗證
- 更安全

**缺點**:
- 耗時較長 (~70 分鐘)
- 需要多次測試

### 選項 C: 創建新文件
基於 `ConversationDetail.example.vue` 創建完全重構的新版本,替換舊文件。

**優點**:
- 最乾淨的方案
- 可以保留舊文件作為備份
- 易於對比差異

**缺點**:
- 需要手動遷移樣式和細節調整
- 可能遺漏某些邊緣功能

---

## 💡 建議

**推薦選項 C**: 創建新文件 + 保留舊文件備份

1. 創建 `ConversationDetail.new.vue`
2. 基於 example 文件和當前邏輯重寫
3. 測試新文件功能完整性
4. 替換: `ConversationDetail.vue` → `ConversationDetail.old.vue`
5. 重命名: `ConversationDetail.new.vue` → `ConversationDetail.vue`

這樣可以確保:
- 有完整的回滾路徑
- 可以對比差異
- 更容易發現遺漏的功能

---

**等待用戶決策**: 請選擇 A, B, 或 C 方案繼續執行
