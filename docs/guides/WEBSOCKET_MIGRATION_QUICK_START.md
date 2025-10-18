# WebSocket + Durable Objects

> ****: | Phase 2:
> ****: 4-6 SSE WebSocket + DO

---


1. [](#)
2. [](#-next-actions)
3. [Phase 2 ](#phase-2-)
4. [](#)
5. [](#)

---


### (Phase 2.1 - 20%)

| | | |
|------|------|------|
| D1 Database | | `08ae6790-2494-40a8-a07a-df3920783159` (458KB) |
| KV Namespaces | | SESSIONS + CACHE |
| Durable Objects Bindings | | 5 DO |
| WebSocket Handler | | `src/handlers/websocket-main.ts` (641 ) |
| WebSocket Client | | `frontend/src/services/websocketClient.ts` (741 ) |
| Feature Flag | | Migration Config API |
| | | `/api/websocket/health` 200 |

****:
```json
{
 "websocketEnabled": true,
 "sseEnabled": true,
 "rolloutPercentage": 50, // 0
 "durableObjectsAvailable": true
}
```

### (Phase 2.1 - 80%)

- [ ] ****
- [ ] ** DO ** ()
- [ ] ** WebSocket **
- [ ] ****

---

## (Next Actions)

### **Step 1: ** (5 )

```bash
# 1: API
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/auth/login" \
 -H "Content-Type: application/json" \
 -d "{\"username\":\"test-admin\",\"password\":\"Admin123!@#\"}"

# token
export ADMIN_TOKEN="<your-jwt-token-here>"
```

****:

1. https://multi-channel.imfinethankyouandyou.com
2. Application Local Storage
3. `auth_token`
4. : `export ADMIN_TOKEN="<token>"`

---

### **Step 2: ** (10 )

```bash

TEST_TOKEN=$ADMIN_TOKEN bash scripts/test-websocket-do.sh

# : 7/7
```

****:
- (JWT 24 )
-
- : `VERBOSE=true bash scripts/test-websocket-do.sh`

---

### **Step 3: ** (5 )

** **: rollout 0%

```bash
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "enableWebSocket": true,
 "enableSSE": true,
 "migrationStrategy": "gradual",
 "rolloutPercentage": 0,
 "featureFlags": {
 "websocketConnections": false,
 "durableObjectMessaging": false,
 "distributedLocking": false,
 "batchMessageProcessing": false,
 "realTimeTypingIndicators": false
 }
 }'


curl -s "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status" | python -m json.tool
```

****:
```json
{
 "status": "ok",
 "websocketEnabled": true,
 "sseEnabled": true,
 "rolloutPercentage": 0,
 "featureFlags": {
 "websocketConnections": false,
 ...
 }
}
```

---

### **Step 4: WebSocket ** (30 )

#### Option A:

1. : https://multi-channel.imfinethankyouandyou.com
2.
3. DevTools Console
4. :

```javascript
// WebSocket
const wsClient = new WebSocketClient({
 conversationId: 'test-conv-001',
 enableLogging: true,
 autoConnect: false
})

wsClient.setEventHandlers({
 onMessage: (msg) => console.log(' Received:', msg),
 onConnectionChange: (state) => console.log(' State:', state),
 onError: (err) => console.error(' Error:', err)
})

await wsClient.connect()
// : [WebSocketClient] WebSocket connected successfully

wsClient.send({ type: 'ping', timestamp: Date.now() })
// : pong
```

#### Option B: ()

 `frontend/src/views/WebSocketTest.vue` ( PHASE2_MIGRATION_PLAN.md )

---

### **Step 5: Phase 2.1 ** (15 )

:

```bash

cat <<'EOF' > /tmp/phase2.1-checklist.txt
Phase 2.1 Completion Checklist
================================

Infrastructure Validation:
[ ] D1 Database operational
[ ] KV Namespaces accessible
[ ] All DO bindings configured
[ ] WebSocket health endpoint returns 200

Functional Testing:
[ ] ConversationRoom DO accepts connections
[ ] UserConnection DO tracks user state
[ ] MessageBroadcaster DO can broadcast events
[ ] WebSocket Client connects successfully
[ ] Auto-reconnect works (test network interruption)
[ ] Token refresh mechanism works

Configuration:
[ ] Migration config set to rolloutPercentage: 0
[ ] All feature flags disabled
[ ] SSE fallback available
[ ] Monitoring endpoints accessible

Team Readiness:
[ ] Team briefed on migration plan
[ ] Emergency rollback procedure documented
[ ] On-call rotation established
[ ] Monitoring dashboard access verified

EOF

cat /tmp/phase2.1-checklist.txt
```

** Phase 2.2**

---

## Phase 2

### **Timeline Overview**

```
Week 1-2: Phase 2.1-2.3 (Preparation)

 Feature Flags


Week 3: Phase 2.4 (5% Canary)


 Go/No-Go

Week 4: Phase 2.5 (20% 50% Rollout)
 Day 1-2: 20%
 Day 3-4: 35%
 Day 5-7: 50% + A/B

Week 5: Phase 2.6 (100% Full Migration)
 Day 1: 70%
 Day 2: 85%
 Day 3-4: 100%

Week 5-6: Phase 2.7 (Optimization)

 SSE

```

---

### **Phase 2.2: Feature Flag Configuration** (Week 1-2)

****:


**Step 1: **

: `frontend/src/services/realtimeConnectionManager.ts`

```typescript
import { fetchMigrationConfig } from '@/api/websocket'
import { createWebSocketClient } from './websocketClient'
import { useSSEMessages } from '@/composables/useSSEMessages'

export async function createRealtimeConnection(conversationId: string) {
 const config = await fetchMigrationConfig()

 // rollout WebSocket SSE
 const shouldUseWebSocket = config.enableWebSocket &&
 shouldUserGetWebSocket(config.rolloutPercentage)

 if (shouldUseWebSocket) {
 console.log(' Using WebSocket connection')
 return createWebSocketClient({ conversationId })
 } else {
 console.log(' Using SSE connection (fallback)')
 return useSSEMessages(ref(conversationId))
 }
}

// :
function shouldUserGetWebSocket(rolloutPercentage: number): boolean {
 const userId = getCurrentUserId()
 const hash = simpleHash(userId) //
 return (hash % 100) < rolloutPercentage
}
```

**Step 2: **

```typescript
// frontend/src/views/ConversationDetail.vue
import { createRealtimeConnection } from '@/services/realtimeConnectionManager'

// onMounted
const connection = await createRealtimeConnection(conversationId.value)
```

**Step 3: Feature Toggle**

```bash
# 0% rollout ( SSE)
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"rolloutPercentage": 0}'

# : SSE

# 100% rollout ( WebSocket)
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 100}'

# : WebSocket
```

---

### **Phase 2.3: Monitoring & Alerting** (Week 2)

****:


**Step 1: Cloudflare Analytics**

1. Cloudflare Dashboard
2. Workers & Pages multi-channel-platform
3. Analytics:
 - Workers Analytics (Request count, CPU time)
 - Durable Objects Analytics (Active objects, Latency)

**Step 2: **

 Grafana Cloudflare Dashboard:

```bash

1. WebSocket (target: > 98%)
2. (target: < 80ms)
3. Durable Objects
4.
5. (target: < 2%)
6. (DO requests, WebSocket connections)
```

**Step 3: **

 Slack Webhook Email :

```bash
# (Critical - P0)
- < 90%
- > 500ms
- DO > 10%
 : +

# (Warning - P1)
- < 95%
- > 200ms
- 30%
 : +
```

**Step 4: Checklist**

```bash

./scripts/daily-health-check.sh


./scripts/generate-daily-report.sh --date=$(date +%Y-%m-%d)

# :
- [ ]
- [ ]
- [ ] DO
- [ ]
- [ ]
```

---

### **Phase 2.4: Internal Testing (5% Canary)** (Week 3)

****: WebSocket


**Day 1: 5% Canary**

```bash

curl -X POST "$API_BASE/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{
 "rolloutPercentage": 5,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "realTimeTypingIndicators": true
 },
 "whitelistUsers": ["admin-001", "team-001", "agent-test-001"]
 }'
```

**Day 2-7: **

```bash

./scripts/canary-daily-check.sh


# Google Form :
1. (1-5)
2. (1-5)
3.
4.
```

**Week 3 : Go/No-Go **

:
- [ ] > 98%
- [ ] < 80ms
- [ ] > 4.0/5
- [ ] Bug
- [ ] < 15%

**** Phase 2.5
****

---

### **Phase 2.5: Gradual Rollout (20% 50%)** (Week 4)

```bash
# Day 1-2: 20%
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 20}'

# Day 3-4: 35%
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 35,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "distributedLocking": true,
 "batchMessageProcessing": true,
 "realTimeTypingIndicators": true
 }}'

# Day 5-7: 50%
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 50}'
```

** 24-48 **

---

### **Phase 2.6: Full Migration (100%)** (Week 5)

```bash
# Day 1: 70%
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 70}'

# Day 2: 85%
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 85}'

# Day 3-4: 100%
curl -X POST "$API_BASE/api/websocket/migration-config" \
 -d '{"rolloutPercentage": 100, "migrationStrategy": "complete"}'
```

** ** -

---

### **Phase 2.7: Post-Migration Optimization** (Week 5-6)

-
- (30s 45s 60s )
- DO
- SSE ( 1 )

---


### ****

```bash

curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# rollout
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"rolloutPercentage": 20}'

# (< 5 )
./scripts/emergency-rollback.sh

# :
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"enableWebSocket": false, "enableSSE": true, "rolloutPercentage": 0}'
```

### ****

```bash

curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# WebSocket
curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics

# DO
curl -H "Authorization: Bearer $TOKEN" \
 "https://multi-channel.imfinethankyouandyou.com/api/websocket/test-connection?userId=test&conversationId=test"
```

### ****

```bash
# (Cloudflare Workers)
wrangler tail --format pretty

# WebSocket
wrangler tail --format pretty | grep -i "websocket\|durable"


wrangler tail --format pretty > logs/websocket-$(date +%Y%m%d).log
```

---


### ****

| | | Email | |
|------|------|-------|------|
| **Tech Lead** | [Name] | tech.lead@company.com | +xxx-xxxx-xxxx |
| **DevOps Lead** | [Name] | devops@company.com | +xxx-xxxx-xxxx |
| **On-Call Engineer** | [Name] | oncall@company.com | +xxx-xxxx-xxxx |
| **Product Manager** | [Name] | pm@company.com | +xxx-xxxx-xxxx |

### ****

| | | | |
|--------|---------|---------|------|
| **P0 - Critical** | 15 | + CTO | |
| **P1 - High** | 1 | Tech Lead + DevOps | |
| **P2 - Medium** | 4 | DevOps Team | |
| **P3 - Low** | 24 | | |

### ** SOP**

```bash
# 1.
./scripts/emergency-rollback.sh

# 2.
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status
# : rolloutPercentage: 0, enableWebSocket: false

# 3.
slack-notify "#websocket-migration" " EMERGENCY ROLLBACK EXECUTED"

# 4.
wrangler tail --format pretty > logs/emergency-$(date +%Y%m%d-%H%M%S).log

# 5.
./scripts/create-incident-report.sh
```

---


- ****: [PHASE2_MIGRATION_PLAN.md](./PHASE2_MIGRATION_PLAN.md)
- **WebSocket **: [docs/architecture/WEBSOCKET_ARCHITECTURE.md](./docs/architecture/WEBSOCKET_ARCHITECTURE.md)
- **API **: [docs/api/MESSAGING_API_REFERENCE.md](./docs/api/MESSAGING_API_REFERENCE.md)
- ****: [docs/troubleshooting/WEBSOCKET_TROUBLESHOOTING.md](./docs/troubleshooting/WEBSOCKET_TROUBLESHOOTING.md)

---

## (Action Items)

**** ():

1. [ ]
2. [ ] `TEST_TOKEN=$ADMIN_TOKEN bash scripts/test-websocket-do.sh`
3. [ ] `rolloutPercentage: 0`
4. [ ] Phase 2.1

**Week 1-2** ():

5. [ ]
6. [ ] Cloudflare Analytics
7. [ ]
8. [ ]

**Week 3** ():

9. [ ] 5% Canary
10. [ ]
11. [ ] Go/No-Go

---


**Phase 2 **:

- 100% WebSocket
- > 98%
- < 80ms (vs SSE 100-300ms)
- > 10%
-
- < 20%
- (P0/P1)

****:

- ()
-
- WebTransport

---

****: v1.0
****: 2025-10-07
****: DevOps Team
****: Ready to Execute
