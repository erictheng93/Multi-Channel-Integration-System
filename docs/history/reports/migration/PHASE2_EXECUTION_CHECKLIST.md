# Phase 2

****: Option B ()
****: 2025-10-07
****: Phase 2.1

---

## Phase 2.1: Pre-Migration Validation (Week 1)

### Step 1.1:

- [x] **D1 Database **
 - ID: `08ae6790-2494-40a8-a07a-df3920783159`
 - : Production Ready (458KB)
 - : `wrangler d1 list`

- [x] **KV Namespaces **
 - SESSIONS KV: `ace3f7202e6a4dd8b98c50e9b91b2431`
 - CACHE KV: `f3bc7a55c8a14f4fb28b8321fa01dc73`
 - : `wrangler kv namespace list`

- [x] **Durable Objects Bindings **
 - ConversationRoom
 - UserConnection
 - MessageBroadcaster
 - DelayedMessageProcessor
 - DelayedMessageBuffer
 - : `wrangler.toml`

- [x] **WebSocket Health **
 - : `/api/websocket/health`
 - : 200 OK
 - : `curl https://your-api-domain.example.com/api/websocket/health`

- [x] ** API **
 - : `/api/websocket/migration-status`
 - rolloutPercentage: 50%
 - : `curl https://your-api-domain.example.com/api/websocket/migration-status`

### Step 1.2:

- [ ] ****
 - [ ] 1: DevTools Local Storage `auth_token`
 - [ ] 2: API
 ```bash
 curl -X POST "https://your-api-domain.example.com/api/auth/login" \
 -H "Content-Type: application/json" \
 -d '{"username":"test-admin","password":"Admin123!@#"}'
 ```
 - [ ] : `export ADMIN_TOKEN="<your-token>"`

- [ ] ****
 ```bash
 TEST_TOKEN=$ADMIN_TOKEN bash scripts/test-websocket-do.sh
 ```
 - [ ] Test 1: System Health Check ( Passed)
 - [ ] Test 2: Migration Configuration Check ( Passed)
 - [ ] Test 3: Durable Objects Connection Test ( Passed)
 - [ ] Test 4: WebSocket Metrics Endpoint ( Passed)
 - [ ] Test 5: SSE Fallback Availability ( Passed)
 - [ ] Test 6: Database Connectivity ( Passed)
 - [ ] Test 7: KV Storage Availability ( Passed)

### Step 1.3:

- [ ] ** 0% Rollout**
 ```bash
 ADMIN_TOKEN="<your-token>" bash scripts/reset-migration-config.sh
 ```
 - [ ] : rolloutPercentage = 0
 - [ ] WebSocket enabled = true
 - [ ] SSE enabled = true
 - [ ] Feature Flags = false

- [ ] ****
 ```bash
 curl https://your-api-domain.example.com/api/websocket/migration-status
 ```
 :
 ```json
 {
 "websocketEnabled": true,
 "sseEnabled": true,
 "rolloutPercentage": 0,
 "featureFlags": {
 "websocketConnections": false,
 "durableObjectMessaging": false,
 ...
 }
 }
 ```

### Step 1.4:

- [x] ** realtimeConnectionManager.ts**
 - [x] : `frontend/src/services/realtimeConnectionManager.ts`
 - [x] Feature Toggle
 - [x] (consistent hashing)
 - [x] WebSocket/SSE

- [ ] ** ConversationDetail.vue**
 - [ ] `createRealtimeConnection`
 - [ ] `useSSEMessages` `createWebSocketClient`
 - [ ]
 - [ ] : `ConversationDetail.example.vue`

- [ ] ****
 ```typescript
 //
 // import { useSSEMessages } from '@/composables/useSSEMessages'
 // const sseConnection = useSSEMessages(conversationId)

 //
 import { createRealtimeConnection } from '@/services/realtimeConnectionManager'
 const connection = await createRealtimeConnection(conversationId.value)
 ```

### Step 1.5:

- [ ] ** 0% Rollout ( SSE)**
 1. [ ]
 2. [ ]
 3. [ ] DevTools Console
 4. [ ] : " Using SSE connection (fallback)"
 5. [ ]

- [ ] ** 100% Rollout ( WebSocket)**
 ```bash
 curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"rolloutPercentage": 100}'
 ```
 1. [ ] ()
 2. [ ] : " Using WebSocket connection"
 3. [ ]
 4. [ ] (typing indicators)

- [ ] ** 50% Rollout ()**
 ```bash
 curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 50}'
 ```
 1. [ ]
 2. [ ] 50% WebSocket, 50% SSE
 3. [ ]

- [ ] ** 0% Rollout**
 ```bash
 curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 0}'
 ```

### Step 1.6: E2E

- [ ] **Playwright **
 - [ ] : `tests/e2e/websocket-migration.test.ts`
 - [ ] 1: SSE
 - [ ] 2: WebSocket
 - [ ] 3: Fallback (WebSocket SSE)
 - [ ] 4: (WebSocket only)

- [ ] ****
 ```bash
 cd frontend
 npm run test:e2e
 ```
 - [ ] (100%)

### Phase 2.1

** Phase 2.2**:

- [ ] (7/7)
- [ ] Migration config 0%
- [ ]
- [ ]
- [ ] E2E > 95%
- [ ] Bug
- [ ]

****: ___% (___/30 )

---

## Phase 2.2: Feature Flag Configuration (Week 1-2)

### Step 2.1: Feature Toggle

- [ ] ** API **
 - [ ] : `frontend/src/api/websocket.ts`
 - [ ] `fetchMigrationConfig()`
 - [ ] (60s TTL)

- [ ] ** Feature Toggle**
 - [ ] rolloutPercentage
 - [ ]
 - [ ]

### Step 2.2:

- [x] ****
 - [x] : `scripts/emergency-rollback.sh`
 - [x]

- [ ] ****
 ```bash
 #
 1. rolloutPercentage: 50
 2. : ./scripts/emergency-rollback.sh
 3. 0%
 4. SSE
 5. (: < 5 )
 ```
 - [ ]
 - [ ] < 5
 - [ ]

### Step 2.3:

- [ ] ** API **
 - [ ] `/api/websocket/migration-config`
 - [ ] `/api/websocket/migration-status`
 - [ ]

- [ ] ****
 - [ ] Runbook: rollout
 - [ ] Runbook:
 - [ ] Runbook:

### Phase 2.2

- [ ] Feature Toggle
- [ ]
- [ ]
- [ ]

****: ___% (___/10 )

---

## Phase 2.3: Monitoring & Alerting Setup (Week 2)

### Step 3.1: Cloudflare Analytics

- [ ] ** Workers Analytics**
 1. [ ] Cloudflare Dashboard
 2. [ ] Workers & Pages mcis-worker
 3. [ ] Analytics Enable Workers Analytics
 4. [ ] : Request Count, CPU Time, Errors

- [ ] ** Durable Objects Analytics**
 1. [ ] Durable Objects Analytics
 2. [ ] : Active Objects, Request Latency
 3. [ ]

### Step 3.2:

- [ ] ****
 - [ ] Option A: Cloudflare Dashboard ( - )
 - [ ] Option B: Grafana ()

- [ ] ****
 - [ ] WebSocket
 - [ ] (WebSocket vs SSE)
 - [ ] Durable Objects
 - [ ]
 - [ ]
 - [ ]

### Step 3.3:

- [ ] **Slack Webhook **
 ```bash
 # Slack Incoming Webhook
 1. Slack Workspace Apps Incoming Webhooks
 2. #websocket-migration
 3. Webhook URL
 4. : curl -X POST <webhook-url> -d '{"text":"Test"}'
 ```

- [ ] ****
 - [ ] (Critical - P0)
 - < 90% +
 - > 500ms
 - DO > 10%

 - [ ] (Warning - P1)
 - < 95%
 - > 200ms
 - 30%

- [ ] ****
 - [ ]
 - [ ] Slack
 - [ ] Email

### Step 3.4:

- [x] ****
 - [x] : `scripts/daily-health-check.sh`

- [ ] ** (Cron)**
 ```bash
 # 9:00 AM
 0 9 * * * /path/to/scripts/daily-health-check.sh
 ```

- [ ] ****
 - [ ] : `scripts/generate-weekly-report.sh`
 - [ ]
 - [ ] Markdown

### Phase 2.3

- [ ] Cloudflare Analytics
- [ ]
- [ ]
- [ ]
- [ ]

****: ___% (___/15 )

---

## Phase 2.4: Internal Testing - 5% Canary (Week 3)

### Step 4.1:

- [ ] ** (10-20 )**
 - [ ] ()
 - [ ]
 - [ ]
 - [ ] ID

- [ ] ****
 - [ ] Email
 - [ ]
 - [ ]

### Step 4.2: 5% Canary

****: Week 3 Day 1 (2025-10-21)
****: 10:00 AM

- [ ] ** 5% Rollout**
 ```bash
 curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 5,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "realTimeTypingIndicators": true
 }
 }'
 ```

- [ ] ****
 ```bash
 curl https://your-api-domain.example.com/api/websocket/migration-status
 ```

- [ ] ** 24/7 **
 - [ ] (Slack, Email)
 - [ ] On-call
 - [ ]

### Step 4.3: (7 )

**Day 1-7 **:

- [ ] ****
 ```bash
 bash scripts/daily-health-check.sh
 ```

- [ ] ****
 - [ ] : ___% (target: > 98%)
 - [ ] : ___ms (target: < 80ms)
 - [ ] : ___% (target: < 2%)
 - [ ] DO : ___
 - [ ] : $___

- [ ] ****
 - [ ]
 - [ ]

- [ ] ****
 - [ ]
 - [ ]

### Step 4.4: Week 3 - Go/No-Go

****: 2025-10-27 (Week 3 )
****: 3:00 PM

****:

- [ ] ****
 - [ ] > 98% /
 - [ ] < 80ms /
 - [ ] < 2% /
 - [ ] Bug (P0/P1) /

- [ ] ****
 - [ ] > 4.0/5 /
 - [ ] /

- [ ] ****
 - [ ] < 15% /

- [ ] ****
 - [ ] > 80% /

****:

- [ ] **GO** - Phase 2.5 (20% 50% )
- [ ] **NO-GO** -

 NO-GO:
- [ ]
- [ ]
- [ ] Week 3

### Phase 2.4

- [ ] 5% Canary 7
- [ ]
- [ ]
- [ ] Go/No-Go
- [ ] Week 4

****: ___% (___/20 )

---

## Phase 2.5: Gradual Rollout (Week 4)

### Day 1-2: 20%

- [ ] ** 20%**
 ```bash
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 20}'
 ```

- [ ] ** 48 **
 - [ ] Day 1 : __%, __ms
 - [ ] Day 2 : __%, __ms

### Day 3-4: 35%

- [ ] ** 35%**
 ```bash
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 35,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "distributedLocking": true,
 "batchMessageProcessing": true,
 "realTimeTypingIndicators": true
 }}'
 ```

- [ ] ** 48 **
 - [ ] Day 3 : __%, __ms
 - [ ] Day 4 : __%, __ms

### Day 5-7: 50% + A/B

- [ ] ** 50%**
 ```bash
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 50}'
 ```

- [ ] **A/B **
 - [ ] WebSocket : __ms
 - [ ] SSE : __ms
 - [ ] WebSocket : __%
 - [ ] SSE : __%
 - [ ] WebSocket : __
 - [ ] SSE : __

- [ ] ****
 - [ ]
 - [ ]

### Phase 2.5

- [ ] 50% WebSocket
- [ ] A/B WebSocket SSE
- [ ] (< 10%)
- [ ]

****: ___% (___/10 )

---

## Phase 2.6: Full Migration (Week 5)

### Day 1: 70%

- [ ] ** 70%**
 ```bash
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 70}'
 ```

- [ ] ** 24 **
 - [ ]
 - [ ]

### Day 2: 85%

- [ ] ** 85%**
 ```bash
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 85}'
 ```

- [ ] ****
 - [ ]
 - [ ]

### Day 3-4: 100%

****: Week 5 Day 3 (2025-11-06)
****: 10:00 AM

- [ ] ** 100%**
 ```bash
 curl -X POST "$API_BASE/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{
 "rolloutPercentage": 100,
 "migrationStrategy": "complete"
 }'
 ```

- [ ] ** 48 **
 - [ ]
 - [ ]

- [ ] ****
 - [ ]
 - [ ]
 - [ ]

### Day 5-7: SSE Deprecated

- [ ] ** SSE Deprecated**
 ```typescript
 // src/handlers/sse-monitoring-main.ts
 app.get('/api/conversations/:id/messages/stream', (c) => {
 c.header('X-Deprecated', 'true')
 c.header('X-Deprecation-Message', 'Use WebSocket at /api/websocket/connect')
 c.header('X-Sunset-Date', '2025-12-31')
 // ...
 })
 ```

- [ ] ** API **
 - [ ] SSE 2025-12-31
 - [ ] WebSocket

### Phase 2.6

- [ ] 100% WebSocket
- [ ]
- [ ] SSE deprecated
- [ ]

****: ___% (___/10 )

---

## Phase 2.7: Post-Migration Optimization (Week 5-6)


- [ ] ** 7 **
 - [ ]
 - [ ]
 - [ ] DO
 - [ ]

- [ ] ****
 - [ ] 30s : __ms, $__
 - [ ] 45s : __ms, $__
 - [ ] 60s : __ms, $__
 - [ ] : __s

- [ ] **DO **
 - [ ] DO
 - [ ]

- [ ] ****
 - [ ]
 - [ ] DO

### SSE

- [ ] ** SSE fallback **
 - [ ] Week 1 : __%
 - [ ] Week 2 : __%
 - [ ] Week 3 : __%
 - [ ] Week 4 : __%

- [ ] ** SSE ** ( < 1%)
 - [ ]
 - [ ] : 2025-12-31
 - [ ]

- [ ] ** SSE ** ( 2000+ )
 - [ ] `src/handlers/sse-monitoring-main.ts`
 - [ ] `src/monitoring/sse-performance-monitor.ts`
 - [ ] `src/modules/realtime/handlers/sse-handler.ts`
 - [ ] `frontend/src/composables/useSSEMessages.ts`


- [ ] **API **
 - [ ] WebSocket
 - [ ] SSE

- [ ] ****
 - [ ] WebSocket + DO
 - [ ] SSE

- [ ] ****
 - [ ]
 - [ ] DO

- [ ] ****
 - [ ] WebSocket
 - [ ] DO
 - [ ]


- [ ] ****
 - [ ]
 - [ ] (SSE vs WebSocket)
 - [ ]
 - [ ]
 - [ ]

- [ ] ****
 - [ ]
 - [ ]
 - [ ]

### Phase 2.7

- [ ]
- [ ] SSE
- [ ]
- [ ]
- [ ]

****: ___% (___/20 )

---


| Phase | | | | |
|-------|---------|---------|------|-------|
| Phase 2.1 | 2025-10-07 | 2025-10-10 | | __% |
| Phase 2.2 | 2025-10-09 | 2025-10-13 | | 0% |
| Phase 2.3 | 2025-10-14 | 2025-10-20 | | 0% |
| Phase 2.4 | 2025-10-21 | 2025-10-27 | | 0% |
| Phase 2.5 | 2025-10-28 | 2025-11-03 | | 0% |
| Phase 2.6 | 2025-11-04 | 2025-11-10 | | 0% |
| Phase 2.7 | 2025-11-08 | 2025-11-15 | | 0% |

****: __% (__/145 )

****: 2025-11-15

---

## (Top Priority)

### (2025-10-07)

1. [ ] **** (5 )
2. [ ] **** (10 )
3. [ ] ** Migration Config** (5 )

### (Week 1)

4. [ ] ConversationDetail.vue
5. [ ]
6. [ ] E2E
7. [ ] Phase 2.1

---

****: v1.0
****: 2025-10-07
****: 2025-10-07
****: DevOps Team
