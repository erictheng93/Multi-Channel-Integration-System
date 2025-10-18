# Phase 2.1 Step 1.4
****: ConversationDetail.vue
****: 2025-10-07
****:

---


### 1.
- ConversationDetail.vue (1735 lines)
- : `CONVERSATIONDETAIL_REFACTOR_PLAN.md`
- : `CONVERSATIONDETAIL_MODIFICATION_GUIDE.md`

### 2. (2/23 )
****:
- Import : composables
- : `createRealtimeConnection`

****:
```typescript
// Before:
import { useWebSocketMigration } from '@/composables/useWebSocketMigration'
import { useWebSocketStatus } from '@/composables/useWebSocketStatus'
import { useConversationWebSocket } from '@/composables/useConversationWebSocket'
import { useSSEMessages } from '@/composables/useSSEMessages'

// After:
import { createRealtimeConnection, type RealtimeConnection, type ConnectionType, type ConnectionState } from '@/services/realtimeConnectionManager'
```

### 3.
 3 :
1. **CONVERSATIONDETAIL_REFACTOR_PLAN.md** -
2. **CONVERSATIONDETAIL_MODIFICATION_GUIDE.md** - (23 )
3. **PHASE2_STEP1.4_SUMMARY.md** -

---


### A: ()
****: Claude 21
****: ~10
****: Medium
****:

### B: ()
****:
****: ~70
****: Low
****:

### C: ()
****: example ConversationDetail.vue
****: ~20 + 20
****: Low
****:

** C**:
1. (`ConversationDetail.old.vue`)
2. example
3. ,
4.
5. ()

---


| | | |
|------|------|------|
| Phase 2.1 | 50% | |
| Step 1.4 | 2/23 (8.7%) | |
| | 100% | |
| | 0% | |

---

## C

### Phase 1: (3 )
```bash
# 1.
cd frontend/src/views
cp ConversationDetail.vue ConversationDetail.old.vue

# 2. example
ls ConversationDetail.example.vue
```

### Phase 2: (15 )
 `ConversationDetail.example.vue` `ConversationDetail.new.vue`,:

****:
1. (example )
2.
3.
4.
5.
6.
7.
8.

****:
-
- presence
-
-
-

### Phase 3: (20 )
```bash
# 1. TypeScript
npm run type-check

# 2. ESLint
npm run lint:check

# 3.
npm run dev

# 4. :
# - [ ]
# - [ ]
# - [ ] (SSE WebSocket)
# - [ ]
# - [ ]
# - [ ]
# - [ ]
# - [ ]
```

### Phase 4: (2 )
```bash
# 1.
mv ConversationDetail.vue ConversationDetail.backup.vue
mv ConversationDetail.new.vue ConversationDetail.vue

# 2.
npm run dev

# 3.
# mv ConversationDetail.backup.vue ConversationDetail.vue
```

---


### 1.
```typescript
async function initializeConnection() {
 // WebSocket SSE ( rolloutPercentage)
 connection.value = await createRealtimeConnection(conversationId.value)

 connectionType.value = connection.value.type
 connection.value.onMessage(handleIncomingMessage)
 connection.value.onStateChange(handleStateChange)
 connection.value.onError(handleConnectionError)

 await connection.value.connect()
}
```

### 2.
```typescript
const messages = computed(() => {
 if (connection.value && isConnected.value) {
 // HTTP
 const realtimeMessages = connection.value.messages.value
 const httpHistory = httpMessages.messages.value.filter(
 m => !realtimeMessages.some(rm => rm.id === m.id)
 )
 return [...httpHistory, ...realtimeMessages].sort(...)
 }
 return httpMessages.messages.value
})
```

### 3.
```typescript
async function handleMessageSent(data) {
 // WebSocket:
 if (connectionType.value === 'websocket' && isConnected.value) {
 connection.value.send({ type: 'message', data: {...} })
 return
 }

 // SSE: HTTP API ,SSE
 await httpMessages.sendMessage(data.content)
}
```

### 4. Feature Toggle
-
- `rolloutPercentage`
- (consistent hashing)

---


:

1. ****:
 -
 - WebSocket/SSE
 -
 -

2. ****:
 - TypeScript
 - ESLint
 - console

3. ****:
 - < 2s
 -
 -

4. ****:
 - 0%-100% rollout
 -
 -

---


****:

### 1: C ()
: "** C**"

### 2:
: "****"

### 3: A ()
: "** A**"

### 4: B ()
: "** B**"

---

**...**

****:
- `ConversationDetail.vue` - (2/23)
- `ConversationDetail.example.vue` -
- `CONVERSATIONDETAIL_MODIFICATION_GUIDE.md` -

****: C -
