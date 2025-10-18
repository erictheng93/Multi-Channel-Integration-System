# Phase 2.1 Step 1.4
****: ConversationDetail.vue
****: 2025-10-07
****: -

---


### vs.

| | | | |
|------|---------|---------|------|
| **** | | **1768 lines** | , |
| **** | | **** (132+ tests, ) | |
| **** | 40 | ** 3-4 ** | |
| **** | Low | **Medium-High** | |


1. **ConversationDetail.vue** :
 - 10+ composables
 - 8+
 -
 -

2. **ConversationDetail.example.vue** :
 - 504 lines (30% )
 - (VirtualMessageList, MessageInput, etc.)
 -
 -

3. ****:
 -
 -
 -
 -

---


### D: ()

****: ,

****:
-
-
-
- (Git)
-

****:

#### Step 1: ( )
```bash
 ConversationDetail.old.vue -
 ConversationDetail.new.vue - ()
```

#### Step 2: - ()

** 1**: Import (Lines 208-225)
```typescript
// import
import { createRealtimeConnection, type RealtimeConnection, type ConnectionType, type ConnectionState } from '@/services/realtimeConnectionManager'

// imports ()
```

** 2**: (Lines ~250-310)
```typescript
// Phase 2.1:
const unifiedConnection = ref<RealtimeConnection | null>(null)
const unifiedConnectionType = ref<ConnectionType>('sse')
const unifiedConnectionState = ref<ConnectionState>('disconnected')
const unifiedIsConnected = ref(false)

// (SSE, WebSocket, HTTP)
// fallback
```

** 3**: ()
```typescript
// =================== Unified Connection Management ===================

async function initializeUnifiedConnection() {
 try {
 console.log('[Phase 2.1] Initializing unified connection...')

 unifiedConnection.value = await createRealtimeConnection(conversationId.value)
 unifiedConnectionType.value = unifiedConnection.value.type

 unifiedConnection.value.onMessage(handleUnifiedMessage)
 unifiedConnection.value.onStateChange(handleUnifiedStateChange)
 unifiedConnection.value.onError(handleUnifiedError)

 await unifiedConnection.value.connect()

 console.log(` [Phase 2.1] Unified connection established: ${unifiedConnectionType.value}`)
 } catch (error) {
 console.error('[Phase 2.1] Failed to initialize unified connection:', error)
 unifiedConnectionState.value = 'error'
 }
}

function handleUnifiedStateChange(newState: ConnectionState) {
 unifiedConnectionState.value = newState
 unifiedIsConnected.value = newState === 'connected'
}

function handleUnifiedMessage(message: any) {
 console.log('[Phase 2.1] Unified connection received:', message)
 // ,
}

function handleUnifiedError(error: Error) {
 console.error('[Phase 2.1] Unified connection error:', error)
}
```

** 4**: onMounted (Line ~1034)
```typescript
onMounted(async () => {
 console.log(' ConversationDetail mounted')

 // ... ...

 // Phase 2.1: ()
 initializeUnifiedConnection().catch(err => {
 console.error('[Phase 2.1] Unified connection initialization failed:', err)
 })

 // ... ...
})
```

** 5**: ()
```typescript
// Phase 2.1: Connection Comparison Monitoring
if (import.meta.env.DEV) {
 watch([
 () => unifiedIsConnected.value,
 () => sseMessages.isConnected.value
 ], ([unified, sse]) => {
 console.log('[Phase 2.1 Monitor]', {
 unified: { connected: unified, type: unifiedConnectionType.value },
 sse: { connected: sse }
 })
 })
}
```

#### Step 3:

```bash
# 1. TypeScript
npm run type-check

# 2.
npm run dev

# 3.
# -
# -
# - :
# SSE ()
# (,)

# 4.
# -
# -
# -
```

---


### Phase 2.1: ()
****: ,

- [x]
- [x] realtimeConnectionManager.ts
- [ ] ConversationDetail.vue
- [ ]
- [ ]

****:
- 100%
-
-
-

### Phase 2.2: ()
****: rolloutPercentage

- [ ] ,
- [ ] SSE/HTTP fallback
- [ ] 0%, 10%, 50%, 100%
- [ ] A/B

### Phase 2.3: ()
****: ,

- [ ] `useSSEMessages`
- [ ] `useConversationWebSocket`
- [ ] `useWebSocketMigration`
- [ ]

---


### 1. Git Commit Strategy
```bash

git add frontend/src/views/ConversationDetail.vue
git commit -m "feat(phase2.1): add unified connection parallel testing"


git revert HEAD
```

### 2. Feature Flag Control
```javascript
//
const ENABLE_UNIFIED_CONNECTION = import.meta.env.VITE_ENABLE_UNIFIED_CONNECTION !== 'false'

if (ENABLE_UNIFIED_CONNECTION) {
 await initializeUnifiedConnection()
}
```

### 3. Error Boundary
```typescript
try {
 await initializeUnifiedConnection()
} catch (error) {
 //
 console.error('[Phase 2.1] Unified connection failed, falling back to existing system')
}
```

---


### (5 )

1. ** ConversationDetail.vue** - :
 ```bash
 # 4 :
 # 1. Import (1 )
 # 2. (4 )
 # 3. (30 )
 # 4. onMounted (3 )
 #
 # Total: ~38
 ```

2. ****:
 ```bash
 npm run type-check
 npm run dev
 # 5
 ```

3. ** Git**:
 ```bash
 git add frontend/src/views/ConversationDetail.vue
 git commit -m "feat(phase2.1): add unified connection manager parallel testing

 - Add createRealtimeConnection import
 - Initialize unified connection in parallel with existing system
 - Log connection type and state for monitoring
 - No impact on existing functionality (parallel testing only)"
 ```

### (Phase 2.2+)

4. ,
5.
6.

---


```

 ConversationDetail.vue (Phase 2.1)


 Existing Unified
 System Connection
 (Active) (Monitoring)

 SSE Auto
 WebSocket Select
 HTTP Log Only


 [Used for [Monitoring &
 all features] Testing Only]


```


| | | |
|------|------|---------|
| | < 50 lines | ~38 lines |
| | 0% | 0% |
| | Low | Low |
| | < 10 min | 5-8 min |
| | < 1 min | < 1 min (git revert) |

---


** C **:
-
-
- ,

** D **:
- (~38 lines)
- ()
- (5-8 )
-
-

****: D , Phase 2.1

---

****: D ? (Yes/No)
