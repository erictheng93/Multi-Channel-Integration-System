# ConversationDetail.vue Refactoring Plan
**Phase 2.1 Step 1.4 - Unified Connection Manager Integration**
**Date**: 2025-10-07

## Current Architecture Analysis

### Current Connection Strategy (Lines 250-360)
```typescript
// Phase 1: SSE-Primary Migration Strategy
const migration = useWebSocketMigration({
 strategy: 'sse_only',
 fallbackToSSE: true,
 rolloutPercentage: 0
})

// Primary: SSE Messages System
const sseMessages = useSSEMessages(conversationId, {
 autoConnect: true,
 reconnectOnError: true
})

// Fallback: WebSocket System (currently disabled)
const conversationWS = useConversationWebSocket(conversationId, {
 autoJoin: false,
 enableTypingIndicators: false
})

// Final Fallback: HTTP API System
const httpMessages = useMessages(conversationId.value, {
 enablePagination: true,
 pageSize: 10
})
```

### Current Message Source Logic (Lines 333-361)
:
1. Priority 1: SSE + HTTP Hybrid
2. Priority 2: WebSocket (disabled)
3. Priority 3: HTTP API fallback

## Target Architecture

### New Unified Connection Strategy
```typescript
import { createRealtimeConnection, type RealtimeConnection } from '@/services/realtimeConnectionManager'

// Single unified connection (automatically selects WebSocket or SSE)
const connection = ref<RealtimeConnection | null>(null)

// HTTP API as backup for sending messages (SSE is receive-only)
const httpMessages = useMessages(conversationId.value, {
 enablePagination: true,
 pageSize: 10
})
```

## Refactoring Steps

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
- `connectionState` composable ()
- `loadingState` composable (3 )

**Replace with**:
- `connection.value.connectionState`
- `connection.value.isConnected`

### Step 3: Update Message Source Logic (Lines 333-361)
**Before**:
```typescript
const messages = computed((): Message[] => {
 if (sseMessages.isConnected.value) {
 // SSE + HTTP
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
 // WebSocket SSE
 // HTTP API
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
 // WebSocket
 if (connectionType.value === 'websocket') {
 connection.value.send({
 type: 'message',
 data: { content: data.content, conversationId: conversationId.value }
 })
 return
 }

 // SSE HTTP API SSE
 const success = await httpMessages.sendMessage(data.content)
 if (success) {
 // SSE
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
 if (!connection.value) { return ' ' }

 const type = connectionType.value === 'websocket' ? 'WebSocket' : 'SSE'
 const state = connectionState.value

 switch (state) {
 case 'connected':
 return ` ${type} (${messages.value.length} )`
 case 'connecting':
 return ` ${type} ...`
 case 'reconnecting':
 return ` ${type} ...`
 case 'error':
 return ` ${type} `
 default:
 return ' '
 }
})
```

### Step 6: Initialize Connection (onMounted)
**Add**:
```typescript
async function initializeConnection() {
 try {
 console.log('[ConversationDetail] Initializing unified connection')

 // WebSocket SSE
 connection.value = await createRealtimeConnection(conversationId.value)

 //
 connectionType.value = connection.value.type

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
 connectionState.value = newState
 isConnected.value = newState === 'connected'
}

function handleIncomingMessage(message: any) {
 console.log('[ConversationDetail] Received message:', message)
 //
 switch (message.type) {
 case 'event':
 handleRealtimeEvent(message.data)
 break
 case 'message_sent':
 case 'new_messages':
 // connection.messages
 scrollToNewest()
 break
 }
}

function handleConnectionError(error: Error) {
 console.error('[ConversationDetail] Connection error:', error)
}
```

## Code Removal List

### Lines to Remove/Replace
1. **Lines 250-256**: `useWebSocketMigration` -
2. **Lines 258-259**: `useWebSocketStatus` -
3. **Lines 274-279**: `useSSEMessages` -
4. **Lines 282-286**: `useConversationWebSocket` -
5. **Lines 295-303**: `useConnectionState` -
6. **Lines 305-311**: `useLoadingState` -
7. **Lines 333-361**: -
8. **Lines 428-429**: `isWebSocketEnabled` - `connectionType.value === 'websocket'`
9. **Lines 485-546**: -

### Lines to Keep
- **Lines 289-292**: `httpMessages` - SSE
- **Lines 382-391**: `useSmoothLoading` -
- **Lines 262-268**: Performance monitoring -
- **Lines 322-329**: Error handling -

## Benefits

### 1. Code Simplification
- **Before**: 3 + (~200 lines)
- **After**: 1 + (~80 lines)
- ****: ~60%

### 2. Maintenance Improvement
- Single Source of Truth
-
-

### 3. Performance Optimization
-
-
-

### 4. Migration Readiness
- Feature Toggle
-
- 0% 100%

## Implementation Timeline

- **Step 1-2**: 10 minutes ()
- **Step 3**: 15 minutes ()
- **Step 4**: 10 minutes ()
- **Step 5**: 10 minutes ()
- **Step 6**: 15 minutes ()
- **Testing**: 20 minutes ()

**Total**: ~80 minutes

## Risk Assessment

### Low Risk
- SSE SSE
- rolloutPercentage
-

### Mitigation Strategy
- `httpMessages`
-
- Git commit

## Testing Checklist

- [ ] SSE rolloutPercentage: 0%
- [ ] WebSocket rolloutPercentage: 100%
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

---

**Status**: Ready for implementation
**Approved by**: WebSocket Migration Team
**Implementation Date**: 2025-10-07
