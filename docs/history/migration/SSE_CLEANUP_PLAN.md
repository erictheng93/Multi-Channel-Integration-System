# SSE

****: 2025-10-08
****: 100% WebSocket SSE

---

## 1: Rollout

### Step 1: 75%
```bash
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 75
 }'
```

### Step 2: 100% ()
```bash
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 100,
 "migrationStrategy": "complete"
 }'
```

---

## 2: SSE

### SSE


- [ ] `src/handlers/sse-monitoring-main.ts` - SSE
- [ ] `src/monitoring/sse-performance-monitor.ts` - SSE
- [ ] `src/modules/realtime/handlers/sse-handler.ts` - SSE handler
- [ ] `src/modules/realtime/services/sse-connection-service.ts` - SSE
- [ ] `src/modules/realtime/types/sse-types.ts` - SSE
- [ ] `src/modules/collaboration/adapters/sse-adapter.ts` - Collaboration SSE adapter
- [ ] `src/modules/notifications/handlers/notification-sse.ts` - Notification SSE handler
- [ ] `src/modules/notifications/adapters/sse-adapter.ts` - Notification SSE adapter
- [ ] `src/handlers/activity-stream.ts` - Activity stream (SSE-based)


- [ ] `frontend/src/composables/useSSEMessages.ts` - SSE messages composable
- [ ] `frontend/src/composables/useActivityStream.ts` - Activity stream composable


- [ ] `src/index.ts` - SSE activity stream
- [ ] `src/core/route-config.ts` - SSE


- [ ] `src/types/bindings.ts` - SSE
- [ ] `src/types/services.ts` - SSE

---

## 3:

### SSE


1. `src/index.ts`
 - SSE activity stream
 - SSE OPTIONS handler

2. `src/modules/realtime/index.ts`
 - SSE handler

3. `src/modules/realtime/handlers/index.ts`
 - SSE handler

4. `src/modules/collaboration/index.ts`
 - SSE adapter

5. `src/modules/notifications/index.ts`
 - SSE handler adapter


1. `frontend/src/views/ConversationDetail.vue`
 - realtimeConnectionManager
 - useSSEMessages

2. `frontend/src/services/realtimeConnectionManager.ts`
 - SSE

3. `frontend/src/config/realtime.ts`
 - SSE

---

## 4:


- [ ] 100% Rollout
- [ ] WebSocket
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

---


- : ~15
- : ~3000+
- : 50%


-
-
-


- WebSocket
- 75%
-

---


1. ****
 - `scripts/emergency-rollback.sh`
 - SSE

2. ****
 - SSE `backups/sse-legacy/`
 - Git history

3. ****
 - WebSocket
 -

---


### (2025-10-08)
- [x] 50%
- [ ] 75%
- [ ] 2-4
- [ ] 100%

### (2025-10-09)
- [ ] 100%
- [ ] SSE
- [ ]
- [ ]

### (2025-10-10)
- [ ]
- [ ]
- [ ]
- [ ]

---

****:
****: DevOps Team
****: 2025-10-08
