# ConversationDetail.vue
**Phase 2.1 Step 1.4 - **
****: 2025-10-07
****: ,

---


### 1. Import (Lines 208-220)
****:
- : `useWebSocketMigration`, `useWebSocketStatus`, `useConversationWebSocket`, `useSSEMessages`, `useConnectionState`, `useLoadingState`
- : `createRealtimeConnection`, `RealtimeConnection`, `ConnectionType`, `ConnectionState` from `@/services/realtimeConnectionManager`

### 2. (Lines 265-278)
****:
```typescript
// Before:
const sseMessages = useSSEMessages(...)
const conversationWS = useConversationWebSocket(...)
const migration = useWebSocketMigration(...)

// After:
const connection = ref<RealtimeConnection | null>(null)
const connectionType = ref<ConnectionType>('sse')
const connectionState = ref<ConnectionState>('disconnected')
const isConnected = ref(false)
```

---


### 3. migration (Line ~250)
****: Line 250
****:
```typescript
const migration = useWebSocketMigration({
 strategy: 'sse_only',
 fallbackToSSE: true,
 rolloutPercentage: 0
})

// WebSocket Status Monitoring
const websocketStatus = useWebSocketStatus()
```

### 4. (Lines 302-330)
****: Lines 302-330
****:
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

****:
```typescript
const messages = computed((): Message[] => {
 //
 if (connection.value && isConnected.value) {
 const realtimeMessages = connection.value.messages.value
 const realtimeMessageIds = new Set(realtimeMessages.map(m => m.id))

 // HTTP
 const httpHistoryMessages = httpMessages.messages.value.filter(
 m => !realtimeMessageIds.has(m.id)
 )

 //
 const mergedMessages = [...httpHistoryMessages, ...realtimeMessages].sort(
 (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
 )

 console.log(`[Unified] Merged: ${httpHistoryMessages.length} HTTP + ${realtimeMessages.length} ${connectionType.value.toUpperCase()} = ${mergedMessages.length} total`)

 return mergedMessages
 }

 // Fallback: HTTP API
 return httpMessages.messages.value
})
```

### 5. loading (Lines 332-335)
****: Lines 332-335
****:
```typescript
const loading = computed(() => {
 if (sseMessages.isConnected.value) {return false}
 if (migration.shouldUseWebSocket.value) {return conversationWS.loading.value}
 return httpMessages.loading.value
})
```

****:
```typescript
const loading = computed(() => {
 if (connection.value && isConnected.value) {
 return false
 }
 return httpMessages.loading.value
})
```

### 6. (Lines 341-342)
****: Lines 341-342
****:
```typescript
const hasNewMessages = computed(() => sseMessages.messageCount.value > 0 || conversationWS.hasNewMessages.value)
const newMessagesCount = computed(() => sseMessages.messageCount.value || conversationWS.newMessagesCount.value)
```

****:
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

### 7. presence typing (Lines 345-347)
****: Lines 345-347
****:
```typescript
const presence = computed(() => conversationWS.presence.value)
const typingUsers = computed(() => conversationWS.presence.value.typingUsers)
```

****:
```typescript
const presence = computed(() => ({
 activeUsers: [],
 typingUsers: [],
 isUserTyping: false
}))

const typingUsers = computed(() => presence.value.typingUsers)
```
****: WebSocket DO presence ,

### 8. isWebSocketEnabled (Line 395)
****: Line 395
****:
```typescript
const isWebSocketEnabled = computed(() => migration.shouldUseWebSocket.value)
```

****:
```typescript
const isWebSocketEnabled = computed(() => connectionType.value === 'websocket')
```

### 9. connectionState (Lines 422-427)
****: Lines 422-427
****:
```typescript
const {
 currentProtocol,
 connectionQuality
} = connectionState
```

****:
```typescript
const currentProtocol = computed(() => {
 if (!connection.value) return 'http'
 return connectionType.value
})

const connectionQuality = computed(() => {
 if (!connection.value || !isConnected.value) return 'offline'
 //
 return connectionState.value === 'connected' ? 'excellent' : 'poor'
})
```

### 10. (Lines 454-480)
****: Lines 454-480
****:
```typescript
const connectionStatusText = performanceOptimizer.cachedComputed(() => {
 // Priority 1: SSE Status
 if (sseMessages.isConnected.value) {
 return ` SSE (${sseMessages.messageCount.value} )`
 }

 if (sseMessages.isConnecting.value) {
 return ' SSE ...'
 }

 // ...
})
```

****:
```typescript
const connectionStatusText = performanceOptimizer.cachedComputed(() => {
 if (!connection.value) {
 return ' '
 }

 const typeLabel = connectionType.value === 'websocket' ? 'WebSocket' : 'SSE'
 const icon = connectionType.value === 'websocket' ? '' : ''
 const messageCount = messages.value.length

 switch (connectionState.value) {
 case 'connected':
 return `${icon} ${typeLabel} (${messageCount} )`
 case 'connecting':
 return `${icon} ${typeLabel} ...`
 case 'reconnecting':
 return `${icon} ${typeLabel} ...`
 case 'error':
 return ` ${typeLabel} `
 case 'disconnected':
 return ` ${typeLabel} `
 default:
 return ' '
 }
}, 'connection-status', { timeout: 1000 })
```

### 11. (Lines 486-515)
****: Lines 486-515
****:
```typescript
const connectionStatusClass = computed(() => {
 // SSE Status Classes
 if (sseMessages.isConnected.value) {
 return 'status-connected status-sse'
 }
 // ...
})
```

****:
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

### 12. (Lines 569-625)
****: Lines 569-625
****: fallback
****:
```typescript
const handleMessageSent = async (data: { content: string; attachments: unknown[] }) => {
 console.log('[Message] Sending via:', currentProtocol.value)
 trackUserActivity()
 stopTyping()

 if (!data.content?.trim()) {
 console.warn('Empty message content, skipping send')
 return
 }

 try {
 // WebSocket
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
 console.log('[Message] Sent via WebSocket')
 scrollToNewest()
 return
 }
 }

 // SSE WebSocket HTTP API
 const success = await httpMessages.sendMessage(data.content)
 if (success) {
 console.log('[Message] Sent via HTTP API')
 scrollToNewest()
 // SSE ,
 return
 }

 errorHandler.handleError(
 '',
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

### 13. (Lines 629-658)
****: Lines 629-658
****:
****:
```typescript
const handleRefreshMessages = async () => {
 console.log('[Refresh] Manual refresh triggered via:', currentProtocol.value)
 trackUserActivity()

 try {
 // ,
 if (connection.value && connectionState.value === 'error') {
 console.log('[Refresh] Reconnecting...')
 connection.value.reconnect()
 }

 // , HTTP
 if (!connection.value || !isConnected.value) {
 console.log('[Refresh] Using HTTP API refresh...')
 await httpMessages.refreshMessages()
 }

 resetPollingDelay()
 console.log('[Refresh] Manual refresh completed')

 } catch (error) {
 console.error('[Refresh] Failed to refresh messages:', error)
 }
}
```

### 14. typing (Lines 671-735)
****: Lines 671-735
****: , WebSocket typing
```typescript
const startTyping = () => {
 isTyping.value = true
 isLocalTyping.value = true

 // WebSocket typing indicators ( DO )
 if (connectionType.value === 'websocket' && isConnected.value) {
 // TODO: WebSocket typing
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

### 15. WebSocket typing (Lines 722-735)
****: Lines 722-735
****:
```typescript
// const startWebSocketTyping = () => { ... }
// const stopWebSocketTyping = () => { ... }
```

### 16. isWebSocketJoined (Line 426)
****: Line 426
****:
```typescript
const isWebSocketJoined = computed(() =>
 isWebSocketEnabled.value && conversationWS.isJoined.value
)
```
****: , `isWebSocketJoined.value` `isConnected.value && connectionType.value === 'websocket'`

### 17. loadingState (Lines 382, 414-415)
****: `loadingState`
****:
```typescript
const { hasLoadedInitially, isInitialLoading, loadingHistory } = loadingState
```
****:
```typescript
const hasLoadedInitially = ref(false)
const isInitialLoading = ref(true)
const loadingHistory = ref(false)
```

:
```typescript
function setHistoryLoading(value: boolean) {
 loadingHistory.value = value
}
```

### 18. scrollToNewest (Lines 901-910)
****: Lines 901-910
****:
```typescript
const scrollToNewest = () => {
 if (virtualMessageListRef.value) {
 virtualMessageListRef.value.scrollToBottom()
 }
 showNewMessageModal.value = false
 sseMessages.clearNewMessageCount()
}
```
****:
```typescript
const scrollToNewest = () => {
 if (virtualMessageListRef.value) {
 virtualMessageListRef.value.scrollToBottom()
 }
 showNewMessageModal.value = false

 //
 if (connection.value) {
 connection.value.clearMessages?.() //
 }
}
```

### 19. ( onMounted )
****: `onMounted`
****:
```typescript
// =================== Connection Management ===================

async function initializeConnection() {
 try {
 console.log(`[ConversationDetail] Initializing unified connection for: ${conversationId.value}`)

 // WebSocket SSE
 connection.value = await createRealtimeConnection(conversationId.value)

 //
 connectionType.value = connection.value.type
 console.log(`[ConversationDetail] Using ${connectionType.value.toUpperCase()} connection`)

 //
 connection.value.onMessage(handleIncomingMessage)
 connection.value.onStateChange(handleStateChange)
 connection.value.onError(handleConnectionError)

 //
 await connection.value.connect()

 console.log(`[ConversationDetail] Connected via ${connectionType.value}`)

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
 console.log('[ConversationDetail] Connection established:', message.data)
 break

 case 'event':
 handleRealtimeEvent(message.data)
 break

 case 'message_sent':
 case 'new_messages':
 if (message.data?.messages) {
 // connection.messages
 //
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
 // TODO:
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

### 20. onMounted (Lines 1003-1059)
****: Lines 1003-1059
****: `migration`
****:
```typescript
onMounted(async () => {
 console.log(' ConversationDetail mounted with unified connection')

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
 console.log('[Cache Performance]', {
 hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
 size: cacheStats.size,
 totalOperations: cacheStats.totalHits + cacheStats.totalMisses
 })
 }

 const errorStats = errorHandler.getErrorStats()
 if (errorStats.total > 0) {
 console.log('[Error Statistics]', errorStats)
 }
 }, 10000)
 }

 // Load conversation data and initialize connection
 loadConversation().then(async () => {
 //
 await initializeConnection()

 //
 hasLoadedInitially.value = true
 isInitialLoading.value = false

 //
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

### 21. onUnmounted (Lines 1061-1085)
****: Lines 1061-1085
****:
****: `onUnmounted`
```typescript
onUnmounted(() => {
 console.log('[ConversationDetail] Unmounting, disconnecting...')

 //
 if (connection.value) {
 connection.value.disconnect()
 connection.value = null
 }

 // Clean up polling
 if (pollingInterval.value) {
 clearTimeout(pollingInterval.value)
 pollingInterval.value = null
 }

 // ...
})
```

### 22. route watcher (Lines 1087-1114)
****: Lines 1087-1114
****: ID
** watch **: `loadConversation()`
```typescript
watch(
 () => route.params.id,
 async (newId) => {
 if (!newId || typeof newId !== 'string') return

 console.log(` Loading conversation: ${newId}`)
 mark('conversation-load-start')

 //
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

 //
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

### 23. Template (Lines 153-186)
****: Lines 153-186
****:
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
 : {{ sseMessages.connectionState.value.reconnectAttempts }}/{{ sseMessages.canReconnect.value ? '5' : 'max' }}
 </span>
 <!-- ... -->
 </div>
</div>
```

****:
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
 {{ presence.typingUsers.length }}
 </span>
 <span
 v-if="connectionState === 'error'"
 class="status-item error-info"
 title=""
 >

 </span>
 </div>
</div>
```

---


,:

- [ ] **TypeScript **: `bun run type-check`
- [ ] **ESLint **: `bun run lint:check`
- [ ] ****: `bun run test`
- [ ] ****: `bun run dev`
- [ ] ****:
 - [ ] ,
 - [ ] ,
 - [ ]
 - [ ]
 - [ ]

---


- ****: 23
- ****: 2 ( 8.7%)
- ****: 21 ( 91.3%)
- ****: 60-70
- ****: Medium (,)

---


### A: ()
 Claude 21 ,

****:
- (~10 )
-
-

****:
- ,
-

### B:
,

****:
-
-
-

****:
- (~70 )
-

### C:
 `ConversationDetail.example.vue` ,

****:
-
-
-

****:
-
-

---


** C**: +

1. `ConversationDetail.new.vue`
2. example
3.
4. : `ConversationDetail.vue` `ConversationDetail.old.vue`
5. : `ConversationDetail.new.vue` `ConversationDetail.vue`

:
-
-
-

---

****: A, B, C
