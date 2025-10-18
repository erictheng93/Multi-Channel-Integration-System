# SSE

****: 2025-10-08
****: 100% WebSocket SSE
****: ~120KB (~3500+ )

---

## SSE ()

### (88KB)

| | | | |
|---------|------|------|-------|
| `src/handlers/sse-monitoring-main.ts` | 11KB | SSE | route-config.ts |
| `src/monitoring/sse-performance-monitor.ts` | 16KB | SSE | sse-monitoring-main.ts |
| `src/modules/realtime/handlers/sse-handler.ts` | 14KB | SSE | realtime-main.ts, route-config.ts |
| `src/modules/realtime/services/sse-connection-service.ts` | 14KB | SSE | sse-handler.ts |
| `src/modules/realtime/types/sse-types.ts` | 1.6KB | SSE | realtime |
| `src/modules/notifications/handlers/notification-sse.ts` | 11KB | SSE | notification module |
| `src/modules/notifications/adapters/sse-adapter.ts` | 8.9KB | SSE | notification-sse.ts |
| `src/modules/collaboration/adapters/sse-adapter.ts` | 12KB | SSE | collaboration module |

### (7KB)

| | | | |
|---------|------|------|-------|
| `src/handlers/activity-stream.ts` | 7KB | Activity stream (SSE-based) | index.ts, route-config.ts, webhook.ts, message.ts, websocket-broadcast-service.ts |

### (25KB)

| | | | |
|---------|------|------|-------|
| `frontend/src/composables/useSSEMessages.ts` | 13KB | SSE messages composable | Dashboard.vue, ConversationsTable.vue, realtimeConnectionManager.ts |
| `frontend/src/composables/useActivityStream.ts` | 12KB | Activity stream composable | Dashboard.vue, realtimeConnectionManager.ts |

****: 120KB ( 3500+ )

---


### Activity Stream

```
src/index.ts ()
 src/handlers/activity-stream.ts
 src/handlers/webhook.ts
 src/handlers/message.ts
 src/services/websocket-broadcast-service.ts
 src/shared/services/websocket-broadcast-service.ts

src/core/route-config.ts
 src/handlers/activity-stream.ts
```

### SSE

```
src/core/route-config.ts
 src/handlers/sse-monitoring-main.ts
 src/monitoring/sse-performance-monitor.ts
```

### SSE Handler

```
src/modules/realtime/index.ts
 src/modules/realtime/handlers/sse-handler.ts
 src/modules/realtime/services/sse-connection-service.ts
 src/modules/realtime/types/sse-types.ts
```

### SSE Adapters

```
src/modules/notifications/index.ts
 src/modules/notifications/handlers/notification-sse.ts
 src/modules/notifications/adapters/sse-adapter.ts

src/modules/collaboration/index.ts
 src/modules/collaboration/adapters/sse-adapter.ts
```


```
frontend/src/views/Dashboard.vue
 frontend/src/composables/useSSEMessages.ts
 frontend/src/composables/useActivityStream.ts

frontend/src/views/ConversationsTable.vue
 frontend/src/composables/useSSEMessages.ts

frontend/src/services/realtimeConnectionManager.ts
 frontend/src/composables/useSSEMessages.ts
 frontend/src/composables/useActivityStream.ts
```

---

## ()

### Phase 1: Composables (: HIGH)

****: composables

1. **Step 1.1**: `Dashboard.vue` SSE composables
 ```diff
 - import { useSSEMessages } from '@/composables/useSSEMessages'
 - import { useActivityStream } from '@/composables/useActivityStream'
 - const { ... } = useSSEMessages()
 - const { ... } = useActivityStream()
 ```

2. **Step 1.2**: `ConversationsTable.vue` SSE composables
 ```diff
 - import { useSSEMessages } from '@/composables/useSSEMessages'
 - const { ... } = useSSEMessages()
 ```

3. **Step 1.3**: `realtimeConnectionManager.ts` SSE
 - SSE fallback
 - 100% WebSocket

4. **Step 1.4**: `frontend/src/composables/index.ts`
 ```diff
 - export { useSSEMessages } from './useSSEMessages'
 - export { useActivityStream } from './useActivityStream'
 ```

5. **Step 1.5**: SSE composables
 ```bash
 rm frontend/src/composables/useSSEMessages.ts
 rm frontend/src/composables/useActivityStream.ts
 ```

### Phase 2: Adapters (: HIGH)

****: Adapters SSE

6. **Step 2.1**: `src/modules/notifications/index.ts` SSE
 ```diff
 - export { default as notificationSSEHandler } from './handlers/notification-sse'
 - export { SSEAdapter } from './adapters/sse-adapter'
 ```

7. **Step 2.2**: `src/modules/collaboration/index.ts` SSE
 ```diff
 - export { SSEAdapter } from './adapters/sse-adapter'
 ```

8. **Step 2.3**: SSE adapters
 ```bash
 rm src/modules/notifications/handlers/notification-sse.ts
 rm src/modules/notifications/adapters/sse-adapter.ts
 rm src/modules/collaboration/adapters/sse-adapter.ts
 ```

### Phase 3: Realtime Module SSE Components (: MEDIUM)

****: Realtime SSE WebSocket

9. **Step 3.1**: `src/modules/realtime/handlers/index.ts` SSE handler
 ```diff
 - export { default as sseHandler } from './sse-handler'
 ```

10. **Step 3.2**: `src/modules/realtime/index.ts` SSE
 ```diff
 - export { sseHandler } from './handlers'
 - export { SSEConnectionService } from './services/sse-connection-service'
 ```

11. **Step 3.3**: `src/modules/realtime/types/index.ts` SSE
 ```diff
 - export * from './sse-types'
 ```

12. **Step 3.4**: realtime SSE
 ```bash
 rm src/modules/realtime/handlers/sse-handler.ts
 rm src/modules/realtime/services/sse-connection-service.ts
 rm src/modules/realtime/types/sse-types.ts
 ```

### Phase 4: Activity Stream (: MEDIUM)

****: Activity stream SSE-based

13. **Step 4.1**: `src/index.ts` activity stream
 ```diff
 - import activityStreamHandler from './handlers/activity-stream'
 - app.route('/api/activity-stream', activityStreamHandler)
 ```

14. **Step 4.2**: `src/core/route-config.ts` activity stream
 ```diff
 - import activityStreamHandler from '../handlers/activity-stream'
 - { path: '/api/activity-stream', handler: activityStreamHandler }
 ```

15. **Step 4.3**: `src/handlers/webhook.ts` activity stream
 ```diff
 - import { broadcastToActivityStream } from './activity-stream'
 - await broadcastToActivityStream(...)
 ```

16. **Step 4.4**: `src/handlers/message.ts` activity stream
 ```diff
 - import { broadcastToActivityStream } from './activity-stream'
 - await broadcastToActivityStream(...)
 ```

17. **Step 4.5**: `src/services/websocket-broadcast-service.ts` activity stream
 ```diff
 - import { broadcastToActivityStream } from '../handlers/activity-stream'
 - await broadcastToActivityStream(...)
 ```

18. **Step 4.6**: `src/shared/services/websocket-broadcast-service.ts` activity stream
 ```diff
 - import { broadcastToActivityStream } from '../../handlers/activity-stream'
 - await broadcastToActivityStream(...)
 ```

19. **Step 4.7**: activity stream handler
 ```bash
 rm src/handlers/activity-stream.ts
 ```

### Phase 5: SSE Monitoring (: LOW)

****:

20. **Step 5.1**: `src/core/route-config.ts` SSE
 ```diff
 - import sseMonitoringHandler from '../handlers/sse-monitoring-main'
 - { path: '/api/monitoring/sse', handler: sseMonitoringHandler }
 ```

21. **Step 5.2**: SSE monitoring
 ```bash
 rm src/handlers/sse-monitoring-main.ts
 rm src/monitoring/sse-performance-monitor.ts
 ```

### Phase 6: (: LOW)

22. **Step 6.1**: SSE
 ```bash
 rm tests/unit/modules/realtime/sse-handler.test.ts
 rm tests/unit/modules/realtime/performance-monitor.test.ts
 # : realtime-main.test.ts SSE
 ```

23. **Step 6.2**:

---


### 1. `src/services/websocket-broadcast-service.ts`

****: WebSocket SSE SSE WebSocket

****:
- `broadcastToActivityStream` WebSocket
- WebSocket
- SSE fallback

### 2. `frontend/src/services/realtimeConnectionManager.ts`

****: SSE fallback

****:
- 100% rollout SSE fallback
- SSE
- WebSocket

### 3. `src/handlers/webhook.ts` `src/handlers/message.ts`

****: activity stream

****:
- WebSocket activity stream
-
-

---


- [ ] TypeScript : `npm run build`
- [ ] Frontend : `cd frontend && npm run build`
- [ ] import
- [ ]


- [ ] WebSocket
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]


- [ ]
- [ ] Bundle size ~120KB
- [ ] SSE
- [ ]


- [ ] : `npm run test`
- [ ] Frontend : `cd frontend && npm run test`
- [ ] API : `npm run test:api`
- [ ]

---


| | | | |
|-----|------|--------|------|
| | ~50,000 | ~46,500 | 7% |
| | ~450 | ~440 | 10 |
| | () | () | 50% |
| | | | 40% |


| | | | |
|-----|------|--------|------|
| Backend Bundle | ~2.5MB | ~2.4MB | 4% |
| Frontend Bundle | ~800KB | ~680KB | 15% |
| | ~1.2s | ~1.0s | 17% |
| | ~120MB | ~100MB | 17% |


| | | | |
|-----|------|--------|------|
| TypeScript | ~12s | ~10s | 17% |
| | ~800ms | ~600ms | 25% |
| | ~45s | ~40s | 11% |

---


1. WebSocket < 95%
2. > 500ms (P95)
3. > 1%
4.


1. ** Git SSE **
 ```bash
 git checkout HEAD~1 -- src/handlers/sse-monitoring-main.ts
 git checkout HEAD~1 -- src/modules/realtime/handlers/sse-handler.ts
 git checkout HEAD~1 -- frontend/src/composables/useSSEMessages.ts
 # ...
 ```

2. ** Rollout **
 ```bash
 # token
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"rolloutPercentage": 50}'
 ```

3. ****
 ```bash
 npm run deploy
 cd frontend && npm run deploy:pages
 ```

4. ****
 ```bash
 curl "$API_BASE/api/websocket/health"
 ```

---


- [x] WebSocket 100% rollout
- [ ] 100% rollout 24-48
- [ ] WebSocket
- [ ]

### ( 2-3 )

**Day 1 **: Phase 1 + Phase 2
- composables
- adapters
-

**Day 1 **: Phase 3 + Phase 4
- realtime module SSE components
- activity stream
-

**Day 2 **: Phase 5 + Phase 6
- SSE monitoring
-
-

**Day 2 **:
-
- 4-6
-

**Day 3**:
-
-
-

---


- [ ] WebSocket rollout = 100%
- [ ] (Git tag)
- [ ]
- [ ]


- [ ] Phase 1-6
- [ ] Phase
- [ ]
- [ ] commit messages


- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

---

****: 100% Rollout
****: DevOps Team
****: 2025-10-08
****: 2025-10-08
