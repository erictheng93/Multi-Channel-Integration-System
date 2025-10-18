# REALTIME_QUEUE - Phase 2

****: Phase 2 - Queue Consumer
****: Week 3
****: Phase 1.4 (24 Queue )
****: ()

---


```

 Phase 2 : Queue


 Phase 2.1: Queue Consumer
 > src/index.ts (Lines 910-959)
 > 50 lines of Queue handling code

 Phase 2.2: Queue
 > wrangler.toml (Lines 52-59)
 > Producer and Consumer bindings

 Phase 2.3:
 > src/types/index.ts
 > worker-configuration.d.ts
 > Remove QueueMessage related types

 Phase 2.4:
 > Update test files
 > Remove REALTIME_QUEUE mocks
 > Clean up unused imports


```

---

## Phase 2.1: Queue Consumer

### 2.1.1

****: `src/index.ts`
****: 910-959 ( 50 )

**Code Sections to Remove**:

```typescript
// Section 1: Import realtime-queue handler (Line ~5-10)
import {
 realtimeQueueHandler,
 sseManager
} from './handlers/realtime-queue';

// Section 2: Queue Consumer export (Line ~910-959)
export default {
 async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
 // ... existing code ...
 },

 // REMOVE THIS ENTIRE SECTION:
 async queue(batch: MessageBatch, env: Bindings): Promise<void> {
 const queueName = batch.queue;

 console.log(` [Queue Consumer] Processing batch from queue: ${queueName}`);
 console.log(` [Queue Consumer] Batch size: ${batch.messages.length}`);

 try {
 switch (queueName) {
 case 'realtime-events':
 console.log(' [Queue Consumer] Routing to realtimeQueueHandler...');
 await realtimeQueueHandler.processEvent(batch, env);
 console.log(' [Queue Consumer] realtime-events batch processed successfully');
 break;

 case 'delayed-events':
 console.log(' [Queue Consumer] Routing to delayedMessageQueueHandler...');
 await delayedMessageQueueHandler.processEvent(batch, env);
 console.log(' [Queue Consumer] delayed-events batch processed successfully');
 break;

 case 'notification-events':
 console.log(' [Queue Consumer] Routing to notificationQueueHandler...');
 // await notificationQueueHandler.processEvent(batch, env);
 console.log(' [Queue Consumer] notification-events batch processed (stub)');
 break;

 default:
 console.warn(` [Queue Consumer] Unknown queue: ${queueName}`);
 }

 console.log(` [Queue Consumer] Batch from ${queueName} completed successfully`);
 } catch (error) {
 console.error(` [Queue Consumer] Error processing batch from ${queueName}:`, error);

 // Log individual message errors
 batch.messages.forEach((msg, index) => {
 console.error(` [Queue Consumer] Message ${index}/${batch.messages.length} failed:`, {
 id: msg.id,
 timestamp: msg.timestamp,
 attempts: msg.attempts
 });
 });

 throw error;
 }
 }
};
```

### 2.1.2

**Step 1: **
```bash

cp src/index.ts src/index.ts.backup-phase2-$(date +%Y%m%d-%H%M%S)
```

**Step 2: Queue Consumer import**
```typescript
// ( Line 5-10)
import { realtimeQueueHandler, sseManager } from './handlers/realtime-queue';

// sseManager (SSE connections)
// SSE handler
import { sseManager } from './handlers/sse-main'; //
```

**Step 3: Queue Consumer **

 `async queue()` (Lines 910-959)

**Before**:
```typescript
export default {
 async fetch(...) { ... },
 async queue(batch: MessageBatch, env: Bindings): Promise<void> {
 // ... 50 lines of queue handling code
 }
};
```

**After**:
```typescript
export default {
 async fetch(...) { ... }
 // Queue consumer removed - using WebSocket/DO architecture
};
```

### 2.1.3

** 1: TypeScript **
```bash
npm run build
# Expected: No errors related to queue
```

** 2: fetch handler**
```bash
# fetch handler
grep -A 5 "async fetch" src/index.ts
```

** 3: sseManager **
```bash
# sseManager import
grep "sseManager" src/index.ts
```

---

## Phase 2.2: Queue

### 2.2.1

****: `wrangler.toml`
****: 52-59

**Configuration to Remove**:
```toml
# REMOVE: REALTIME_QUEUE Configuration
[[queues.producers]]
binding = "REALTIME_QUEUE"
queue = "realtime-events"

[[queues.consumers]]
queue = "realtime-events"
max_batch_size = 5
max_batch_timeout = 1
```

### 2.2.2

**Step 1: **
```bash
cp wrangler.toml wrangler.toml.backup-phase2-$(date +%Y%m%d-%H%M%S)
```

**Step 2: wrangler.toml**

 Lines 52-59 Queue

**Before**:
```toml
# ... other config ...

# Cloudflare Queues Configuration
[[queues.producers]]
binding = "REALTIME_QUEUE"
queue = "realtime-events"

[[queues.consumers]]
queue = "realtime-events"
max_batch_size = 5
max_batch_timeout = 1

# ... rest of config ...
```

**After**:
```toml
# ... other config ...

# Queue configuration removed - using WebSocket/DO architecture
# See REALTIME_QUEUE_MIGRATION_PHASE1_COMPLETE.md for details

# ... rest of config ...
```

### 2.2.3

** 1: **
```bash
npx wrangler deploy --dry-run
# Expected: No queue-related errors
```

** 2: Queue**
```bash
# delayed-events queue
grep -A 3 "delayed-events" wrangler.toml
# Expected: delayed-events configuration should still exist
```

** 3: Durable Objects **
```bash
# CONVERSATION_ROOM, MESSAGE_BROADCASTER, USER_CONNECTION bindings
grep "durable_objects.bindings" wrangler.toml -A 20
```

---

## Phase 2.3:

### 2.3.1

****:
1. `src/types/index.ts` - `QueueMessage`
2. `worker-configuration.d.ts` - `REALTIME_QUEUE` binding

### 2.3.2 `src/types/index.ts`

**/**:

```typescript
// ( REALTIME_QUEUE)
export interface QueueMessage {
 event: RealtimeEvent;
 targets: {
 conversationId?: number;
 userIds?: number[];
 broadcast?: boolean;
 };
 priority: 'urgent' | 'high' | 'normal' | 'low';
 retryCount: number;
 maxRetries: number;
}

// ()
export interface RealtimeEvent {
 id: string;
 type: EventType;
 timestamp: string;
 source: EventSource;
 data: any;
}

// ( REALTIME_QUEUE)
export interface SSEPushData {
 type: RealtimeEvent['type'];
 data: RealtimeEvent['data'];
 timestamp: string;
 conversationId: number;
 targetUsers: number[];
}
```

****:

**Step 1: **
```bash
# QueueMessage
grep -r "QueueMessage" src/ tests/

# SSEPushData
grep -r "SSEPushData" src/ tests/
```

**Step 2: **


- Queue
-

**Option A: ()**
```typescript
// QueueMessage SSEPushData
```

**Option B: ()**
```typescript
/**
 * @deprecated Replaced by WebSocket/DO architecture
 * TODO: Remove after test migration complete
 */
export interface QueueMessage { ... }
```

### 2.3.3 `worker-configuration.d.ts`

**Before**:
```typescript
interface CloudflareBindings {
 // ... other bindings ...

 REALTIME_QUEUE: Queue<QueueMessage>; // Remove this

 // ... rest of bindings ...
}
```

**After**:
```typescript
interface CloudflareBindings {
 // ... other bindings ...

 // REALTIME_QUEUE removed - using WebSocket/DO architecture
 // See REALTIME_QUEUE_MIGRATION_PHASE1_COMPLETE.md

 // ... rest of bindings ...
}
```

### 2.3.4

** 1: TypeScript **
```bash
npm run type-check
# Expected: No errors related to missing QueueMessage or REALTIME_QUEUE
```

** 2: **
```bash
npm run build
# Expected: Clean build with no Queue-related warnings
```

---

## Phase 2.4:

### 2.4.1

****:

```bash
# REALTIME_QUEUE
grep -r "REALTIME_QUEUE" tests/
```

****:
1. `tests/unit/handlers/realtime-queue.test.ts` -
2. `tests/integration/queue-integration.test.ts` - mock
3. Handler REALTIME_QUEUE mock

****:

**Option A: Queue **
```bash
# Queue
rm tests/unit/handlers/realtime-queue.test.ts
```

**Option B: WebSocket/DO **
```typescript
// Before
const mockEnv = {
 REALTIME_QUEUE: {
 send: vi.fn()
 }
};

// After
const mockEnv = {
 MESSAGE_BROADCASTER: {
 idFromName: vi.fn(() => ({ toString: () => 'global' })),
 get: vi.fn(() => ({
 fetch: vi.fn(() => Promise.resolve(new Response('{"success":true}')))
 }))
 }
};
```

### 2.4.2 imports

** imports**:

```bash
# ESLint imports
npm run lint


grep -n "import.*QueueMessage" src/**/*.ts
```

### 2.4.3

****:
1. `README.md` - Queue
2. `docs/ARCHITECTURE.md` -
3. `docs/API.md` - Queue API

---

## Phase 2


- [ ] Phase 1.4 (24 Queue )
- [ ] Phase 1.4 "PASS"
- [ ] Phase 1
- [ ] Git

### Phase 2.1: Queue Consumer

- [ ] `src/index.ts`
- [ ] `realtimeQueueHandler` import
- [ ] `async queue()` (Lines 910-959)
- [ ] TypeScript
- [ ] `fetch` handler
- [ ] Git commit: "chore(phase2.1): remove REALTIME_QUEUE consumer"

### Phase 2.2: Queue

- [ ] `wrangler.toml`
- [ ] `[[queues.producers]]` (REALTIME_QUEUE)
- [ ] `[[queues.consumers]]` (realtime-events)
- [ ] wrangler dry-run
- [ ] Queue (delayed-events)
- [ ] Git commit: "chore(phase2.2): remove REALTIME_QUEUE configuration"

### Phase 2.3:

- [ ] `QueueMessage`
- [ ] deprecated
- [ ] `src/types/index.ts`
- [ ] `worker-configuration.d.ts`
- [ ] TypeScript
- [ ] Git commit: "chore(phase2.3): update type definitions"

### Phase 2.4:

- [ ] Queue
- [ ] imports
- [ ]
- [ ]
- [ ] Git commit: "chore(phase2.4): cleanup and update tests"


- [ ] : `npm run test`
- [ ] TypeScript : `npm run type-check`
- [ ] staging: `wrangler deploy --env staging`
- [ ] staging
- [ ] staging 30
- [ ] production: `wrangler deploy`
- [ ] production
- [ ] production 2

---


- > 1%
- WebSocket < 90%
- > 0.1%
-


**Step 1: ( Git)**
```bash
# Phase 2 commit
git revert HEAD~4..HEAD # 4 Phase 2 commits

# reset ( push)
git reset --hard <phase1-commit-hash>
```

**Step 2: **
```bash
wrangler deploy
```

**Step 3: **
```bash
# Queue
wrangler queues list

# Queue consumer
curl https://your-domain.com/api/system/health
```


1.
2.
3.
4. Phase 2

---


### Phase 2

```
[] Queue Consumer
[] wrangler.toml Queue
[]
[] /
[] TypeScript
[]
[]
[]
[]
[] WebSocket
```


| Metric | Target | Pass Criteria |
|--------|--------|---------------|
| TypeScript | 0 errors | Pass if 0 errors |
| | 95% | Pass if 95% |
| | 100% | Pass if deployed |
| | < 0.5% | Pass if < 0.5% |
| WebSocket | 95% | Pass if 95% |
| | < 100ms p95 | Pass if < 100ms |

---


```
Week 3 Schedule:

Day 1 (Monday):
 Phase 2.1: Queue Consumer (2 hours)
 (1 hour)

Day 2 (Tuesday):
 Phase 2.2: Queue (1 hour)
 Phase 2.3: (2 hours)

Day 3 (Wednesday):
 Phase 2.4: (3 hours)
 (1 hour)

Day 4 (Thursday):
 Code review (2 hours)
 Staging (2 hours)

Day 5 (Friday):
 Production (1 hour)
 (2 hours)
 Phase 2 (1 hour)
```

---


### Phase 3

Phase 2 Phase 3

```
Phase 3: (Week 4)
 3.1: realtime-queue.ts
 3.2: Queue
 3.3:
 3.4:
 3.5:
```

---

****: 1.0
****: 2025-10-17
****: Claude Code Assistant
****:

**END OF PHASE 2 PLAN**
