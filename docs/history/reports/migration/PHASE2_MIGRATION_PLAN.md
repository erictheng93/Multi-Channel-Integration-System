# Phase 2: WebSocket + Durable Objects


****: 2025-10-07
****: 2025-11-15 (6 )
****: Phase 2.1 - Pre-Migration Validation
****: 20% ()

---


 Server-Sent Events (SSE) WebSocket + Durable Objects

### (KPI)

- ****: > 98%
- ****: < 80ms ( SSE: 100-300ms)
- ****: > 4.5/5
- ****: < 20% ( +6.8%)
- ****:

---

## Phase 2.1: Pre-Migration Validation (Week 1)

****: WebSocket + DO

### Step 1.1: Durable Objects

****: 2025-10-07
****: DevOps Team


- [x] **D1 Database **
 - ID: `08ae6790-2494-40a8-a07a-df3920783159`
 - : Production Ready (458KB)

- [x] **KV Namespaces **
 - SESSIONS KV: `ace3f7202e6a4dd8b98c50e9b91b2431`
 - CACHE KV: `f3bc7a55c8a14f4fb28b8321fa01dc73`

- [x] **WebSocket Health Check**
 - : `/api/websocket/health`
 - : All components healthy
 - Durable Objects: Available
 - WebSocket: Available
 - SSE: Available (fallback ready)


```bash
# 1. Worker
wrangler deployments list --name mcis-worker

# 2. D1
wrangler d1 list

# 3. KV
wrangler kv namespace list

# 4.
curl https://your-api-domain.example.com/api/websocket/health

# 5.
curl https://your-api-domain.example.com/api/websocket/migration-status
```


 ****

---

### Step 1.2: Durable Objects

****: 2025-10-07 ()
****: 2


##### Test 1: ConversationRoom DO

****: WebSocket

```bash
# 1.
export TOKEN="<admin-jwt-token>"

# 2. ConversationRoom
curl -X GET "https://your-api-domain.example.com/api/websocket/test-connection?userId=admin-001&conversationId=test-conv-001" \
 -H "Authorization: Bearer $TOKEN"

# :
{
 "success": true,
 "userConnection": { "status": "active" },
 "conversationRoom": { "participants": [], "activeConnections": 0 },
 "messageBroadcaster": { "status": "ready" },
 "migrationConfig": { "enableWebSocket": true, "rolloutPercentage": 50 }
}
```

##### Test 2: UserConnection DO

****:

```bash

curl -X GET "https://your-api-domain.example.com/api/websocket/test-connection?userId=admin-001" \
 -H "Authorization: Bearer $TOKEN"
```

##### Test 3: MessageBroadcaster DO

****:

```bash

curl -X GET "https://your-api-domain.example.com/api/websocket/metrics" \
 -H "Authorization: Bearer $TOKEN"
```


: `scripts/test-websocket-do.sh`

```bash
#!/bin/bash
# WebSocket + DO

set -e

echo " Starting WebSocket + Durable Objects Test Suite"
echo "=================================================="


API_BASE="https://your-api-domain.example.com"
TOKEN="${TEST_TOKEN:-your-test-token-here}"

# Test 1: Health Check
echo " Test 1: System Health Check"
HEALTH_RESPONSE=$(curl -s "$API_BASE/api/websocket/health")
echo "$HEALTH_RESPONSE" | python -m json.tool

HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin)['status'])")
if [ "$HEALTH_STATUS" != "healthy" ]; then
 echo " Health check failed"
 exit 1
fi
echo " Test 1 Passed"
echo ""

# Test 2: Migration Config
echo " Test 2: Migration Configuration Check"
MIGRATION_RESPONSE=$(curl -s "$API_BASE/api/websocket/migration-status")
echo "$MIGRATION_RESPONSE" | python -m json.tool
echo " Test 2 Passed"
echo ""

# Test 3: DO Connection Test
echo " Test 3: Durable Objects Connection Test"
DO_TEST_RESPONSE=$(curl -s "$API_BASE/api/websocket/test-connection?userId=test-user-001&conversationId=test-conv-001")
echo "$DO_TEST_RESPONSE" | python -m json.tool

DO_SUCCESS=$(echo "$DO_TEST_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('success', False))")
if [ "$DO_SUCCESS" != "True" ]; then
 echo " Durable Objects connection test failed"
 exit 1
fi
echo " Test 3 Passed"
echo ""

# Test 4: Metrics Endpoint
echo " Test 4: Metrics Endpoint Check"
METRICS_RESPONSE=$(curl -s "$API_BASE/api/websocket/metrics")
echo "$METRICS_RESPONSE" | python -m json.tool
echo " Test 4 Passed"
echo ""

echo "=================================================="
echo " All WebSocket + DO tests passed successfully!"
echo " System is ready for Phase 2.2"
```


- [ ] ConversationRoom DO
- [ ] UserConnection DO
- [ ] MessageBroadcaster DO
- [ ] DO < 200ms
- [ ]


:

1. **Wrangler.toml **
 - DO bindings
 - migrations tag

2. ****
 - JWT_SECRET
 -

3. **Cloudflare Dashboard**
 - Workers > Durable Objects
 -

---

### Step 1.3: WebSocket Client

****: 2025-10-08
****: 4


- [ ] **WebSocketClient **
 - `websocketClient.ts` (741 )
 -
 - (exponential backoff)
 -
 - (30s interval)

- [ ] ** Composables **
 - `useWebSocket.ts`
 - `useConversationWebSocket.ts`
 -

- [ ] ****
 - Chrome
 - Firefox
 - Safari
 - Edge
 - (iOS Safari, Chrome Mobile)


**Step 1: **

```bash
# 1.
cd frontend
npm run dev

# 2. WebSocket
# :
# [WebSocketClient] Performing pre-connection checks...
# [WebSocketClient] Pre-connection checks passed: Token present, Token format valid, ...
# [WebSocketClient] Connecting to WebSocket: wss://...
# [WebSocketClient] WebSocket connected successfully
```

**Step 2: WebSocket **

: `frontend/src/views/WebSocketTest.vue`

```vue
<template>
 <div class="websocket-test">
 <h1>WebSocket Connection Test</h1>

 <div class="status-panel">
 <h3>Connection Status</h3>
 <p>State: <strong>{{ connectionState }}</strong></p>
 <p>Connected: {{ isConnected ? '' : '' }}</p>
 <p>Last Error: {{ lastError?.message || 'None' }}</p>
 </div>

 <div class="controls">
 <button @click="handleConnect" :disabled="isConnected">Connect</button>
 <button @click="handleDisconnect" :disabled="!isConnected">Disconnect</button>
 <button @click="sendTestMessage" :disabled="!isConnected">Send Test Message</button>
 </div>

 <div class="message-log">
 <h3>Message Log</h3>
 <div v-for="(msg, index) in messages" :key="index">
 {{ msg.timestamp }}: {{ msg.type }} - {{ JSON.stringify(msg.data) }}
 </div>
 </div>
 </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createWebSocketClient } from '@/services/websocketClient'

const wsClient = createWebSocketClient({
 conversationId: 'test-conv-001',
 enableLogging: true,
 autoConnect: false
})

const connectionState = wsClient.connectionState
const isConnected = wsClient.isConnected
const lastError = wsClient.lastError
const messages = ref<any[]>([])

wsClient.setEventHandlers({
 onMessage: (message) => {
 messages.value.push({
 timestamp: new Date().toISOString(),
 type: message.type,
 data: message.data
 })
 },
 onConnectionChange: (state) => {
 console.log('Connection state changed:', state)
 },
 onError: (error) => {
 console.error('WebSocket error:', error)
 }
})

const handleConnect = () => wsClient.connect()
const handleDisconnect = () => wsClient.disconnect()
const sendTestMessage = () => {
 wsClient.send({
 type: 'message',
 data: {
 content: 'Test message from frontend',
 timestamp: Date.now()
 }
 })
}

onMounted(() => {
 console.log('WebSocket test page mounted')
})
</script>
```


- [ ] WebSocket > 95%
- [ ] < 3
- [ ] ()
- [ ]
- [ ]
- [ ]

---

### Step 1.4:

****: 2025-10-08
****: 4


**Scenario 1: **

1. A
2. WebSocket ConversationRoom DO
3. (`connection_established`)
4.
5. (`message_sent` )

**Scenario 2: **

1. A B #123
2. WebSocket ConversationRoom DO
3. A
4. B < 100ms
5.

**Scenario 3: **

1. A
2. `typing_start`
3. B
4. A (3 )
5. `typing_stop`
6. B

**Scenario 4: **

1. A
2. ( WiFi)
3. WebSocket
4. (exponential backoff)
5.


 E2E : `tests/e2e/websocket-realtime.test.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('WebSocket Real-time Communication', () => {
 test('should establish WebSocket connection successfully', async ({ page }) => {
 //
 await page.goto('/login')
 await page.fill('input[name="username"]', 'test-admin')
 await page.fill('input[name="password"]', 'test-password')
 await page.click('button[type="submit"]')

 //
 await page.goto('/conversations/test-conv-001')

 // WebSocket
 await page.waitForFunction(() => {
 return (window as any).__WS_STATE__?.isConnected === true
 }, { timeout: 10000 })

 //
 const wsState = await page.evaluate(() => (window as any).__WS_STATE__)
 expect(wsState.connectionState).toBe('connected')
 })

 test('should send and receive messages in real-time', async ({ page }) => {
 // ... ...

 //
 await page.fill('textarea[name="message"]', 'Test real-time message')
 await page.click('button[aria-label="Send"]')

 // < 200ms
 const messageElement = await page.waitForSelector(
 'text=Test real-time message',
 { timeout: 200 }
 )
 expect(messageElement).toBeTruthy()
 })

 test('should show typing indicators', async ({ context }) => {
 //
 const userAPage = await context.newPage()
 const userBPage = await context.newPage()

 // A B
 await userAPage.goto('/conversations/test-conv-001')
 await userBPage.goto('/conversations/test-conv-001')

 // A
 await userAPage.fill('textarea[name="message"]', 'T')

 // B
 const typingIndicator = await userBPage.waitForSelector(
 'text=User A is typing...',
 { timeout: 1000 }
 )
 expect(typingIndicator).toBeTruthy()
 })
})
```


- [ ] 100%
- [ ] < 100ms
- [ ] < 50ms
- [ ] > 98%
- [ ]
- [ ] 100%

---

## Phase 2.1

** Phase 2.2**:

- [x] Step 1.1: healthy
- [ ] Step 1.2: Durable Objects
- [ ] Step 1.3: WebSocket Client
- [ ] Step 1.4: > 95%
- [ ] Bug
- [ ] (Technical Review Meeting)

****: 20% (1/5 )

---

## Phase 2.2: Feature Flag Configuration (Week 1-2)

****:

### Step 2.1:

****:

```bash
# (WebSocket rollout 0%)
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
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
```

### Step 2.2: Feature Toggle

****: `frontend/src/services/realtimeConnectionManager.ts`

 Feature Flag WebSocket SSE:

```typescript
//
export interface RealtimeConnection {
 connect(): Promise<void>
 disconnect(): void
 send(message: any): boolean
 onMessage(handler: (message: any) => void): void
 onStateChange(handler: (state: string) => void): void
}

//
export async function createRealtimeConnection(
 conversationId: string
): Promise<RealtimeConnection> {
 //
 const config = await fetchMigrationConfig()

 // WebSocket
 const shouldUseWebSocket = config.enableWebSocket &&
 shouldUserGetWebSocket(config.rolloutPercentage)

 if (shouldUseWebSocket) {
 console.log(' Using WebSocket connection')
 return createWebSocketConnection(conversationId)
 } else {
 console.log(' Using SSE connection (fallback)')
 return createSSEConnection(conversationId)
 }
}

// ()
function shouldUserGetWebSocket(rolloutPercentage: number): boolean {
 const userId = getCurrentUserId()
 const hash = simpleHash(userId)
 return (hash % 100) < rolloutPercentage
}
```

### Step 2.3:

****: `scripts/emergency-rollback.sh`

```bash
#!/bin/bash
# SSE

echo " EMERGENCY ROLLBACK: Disabling WebSocket"

curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "enableWebSocket": false,
 "enableSSE": true,
 "rolloutPercentage": 0
 }'

echo " Rollback complete - All users reverted to SSE"
echo " Rollback completed in: $SECONDS seconds"
```

****:

- [ ] Feature Flag API
- [ ]
- [ ] < 5
- [ ]

---

## Phase 2.3: Monitoring & Alerting Setup (Week 2)

****:

### Step 3.1: Cloudflare Analytics

****:

1. Workers Analytics (CPU time, Request count)
2. Durable Objects Analytics (Active objects, Request latency)
3. WebSocket Analytics (Connection count, Message throughput)

### Step 3.2:

****:

- `/api/websocket/metrics` -
- `/api/websocket/health` -
- `/api/monitoring/websocket-analytics` -
- `/api/monitoring/sse-performance` - SSE

### Step 3.3:

****:

| | | | |
|------|---------|---------|------|
| | < 95% | < 90% | |
| | > 150ms | > 300ms | rollout |
| DO | > 5% | > 10% | |
| | +30% | +50% | |

****:

- Slack #websocket-migration
- Email
- PagerDuty ()

### Step 3.4:

**Grafana Dashboard **:

```json
{
 "dashboard": {
 "title": "WebSocket Migration Dashboard",
 "panels": [
 {
 "title": "Connection Success Rate",
 "type": "graph",
 "datasource": "Cloudflare"
 },
 {
 "title": "Average Latency (WebSocket vs SSE)",
 "type": "graph",
 "datasource": "Cloudflare"
 },
 {
 "title": "Active Connections by Type",
 "type": "stat",
 "datasource": "Cloudflare"
 },
 {
 "title": "Durable Objects Health",
 "type": "table",
 "datasource": "Cloudflare"
 }
 ]
 }
}
```

****:

- [ ]
- [ ]
- [ ]
- [ ]

---

## Phase 2.4: Internal Testing - 5% Canary (Week 3)

****: WebSocket

### Step 4.1:

****:

- (10-20 )
-
-
- (Admin, Team, Agent)

****:

```bash
# 5% Canary ()
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "enableWebSocket": true,
 "enableSSE": true,
 "rolloutPercentage": 5,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "distributedLocking": false,
 "batchMessageProcessing": false,
 "realTimeTypingIndicators": true
 },
 "whitelistUsers": [
 "admin-001",
 "team-leader-001",
 "agent-test-001"
 ]
 }'
```

### Step 4.2:

**** ():

1. **** (30 )
 - [ ] WebSocket
 - [ ] 10
 - [ ]
 - [ ]
 - [ ]

2. **** (15 )
 - [ ] ()
 - [ ] WebSocket
 - [ ]

3. **** (15 )
 - [ ] (1-5 )
 - [ ] (1-5 )
 - [ ]

****:

 Google Form :

-
-
-
-
- (Yes/No)

### Step 4.3:

****: 7

****:

- [ ]
- [ ]
- [ ] (Cloudflare Workers Logs)
- [ ] DO
- [ ]

****:

```bash

./scripts/collect-canary-metrics.sh --date=$(date +%Y-%m-%d)


./scripts/generate-canary-report.sh --week=1
```

### Step 4.4: Go/No-Go

**Week 3 **:

 Phase 2.5:

- [ ] > 98%
- [ ] < 80ms
- [ ] > 4.0/5
- [ ] Bug (Severity: Critical)
- [ ] < 15%
- [ ] > 80%

****:

1. 5% rollout
2.
3. Week 3
4. 2

---

## Phase 2.5: Gradual Rollout (Week 4)

****: WebSocket 50%

### Step 5.1: (20%)

**Day 1-2**:

```bash
# 20%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 20
 }'
```

****:

- 2
- DO
-

### Step 5.2: (35%)

**Day 3-4**:

```bash
# 35%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 35,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "distributedLocking": true,
 "batchMessageProcessing": true,
 "realTimeTypingIndicators": true
 }
 }'
```

****:

- (distributedLocking)
- (batchMessageProcessing)

### Step 5.3: (50%)

**Day 5-7**:

```bash
# 50%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 50
 }'
```

**A/B **:

 WebSocket vs SSE :

-
-
-
-

### Step 5.4:

**Day 6-7 ()**:

- 50% rollout
-
- Phase 2.6

****:

- [ ] 50% WebSocket
- [ ] A/B WebSocket SSE
- [ ] (< 10%)
- [ ]

---

## Phase 2.6: Full Migration (Week 5)

****: WebSocket SSE deprecated

### Step 6.1: (100%)

**Day 1**:

```bash
# 70% ( 24 )
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 70
 }'
```

**Day 2**:

 Day 1 :

```bash
# 85%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 85
 }'
```

**Day 3-4**:

```bash
# 100%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 100,
 "migrationStrategy": "complete"
 }'
```

### Step 6.2: SSE Deprecated

** API **:

```typescript
// src/handlers/sse-monitoring-main.ts
app.get('/api/conversations/:id/messages/stream', (c) => {
 c.header('X-Deprecated', 'true')
 c.header('X-Deprecation-Message', 'SSE endpoint deprecated. Use WebSocket at /api/websocket/connect')
 c.header('X-Sunset-Date', '2025-12-31')

 // ( fallback)
 return handleSSEStream(c)
})
```

### Step 6.3:

****:

- [ ]
- [ ] API
- [ ]
- [ ]

---

## Phase 2.7: Post-Migration Optimization (Week 5-6)

****: SSE

### Step 7.1:

** 7 **:

-
-
- DO
-

### Step 7.2:

****:

1. **DO **
 - 30s, 45s, 60s
 - ( vs )

2. ****
 -
 - DO

3. ****
 - DO
 - DO

### Step 7.3: SSE

**Week 6**:

1. SSE 1
2. SSE fallback
3. SSE < 1%

**** ( 2000+ ):

- [ ] `src/handlers/sse-monitoring-main.ts`
- [ ] `src/monitoring/sse-performance-monitor.ts`
- [ ] `src/modules/realtime/handlers/sse-handler.ts`
- [ ] `src/modules/realtime/services/sse-connection-service.ts`
- [ ] `frontend/src/composables/useSSEMessages.ts`

### Step 7.4:

- [ ] API
- [ ]
- [ ]
- [ ]

---


**Week 6 **:

```markdown
# WebSocket + DO


- ****: 2025-10-07
- ****: 2025-11-15
- ****: 6
- ****: 5,000
- ****:


| | SSE () | WebSocket () | |
|------|-------------|-------------------|---------|
| | 180ms | 45ms | 75% |
| | 96% | 99.2% | 3.2% |
| | 4.1/5 | 4.7/5 | 14.6% |
| | $66 | $70.5 | 6.8% |


-
-
-
-
-


1. (100% )
2.
3.
4. (< 5 )


1. A/B
2.
3.


1. Redis DO
2. (gzip)
3. DO
4. WebTransport


WebSocket + Durable Objects

****:
****:
```

---


- ****: [Name] - [Email] - [Phone]
- **DevOps Lead**: [Name] - [Email] - [Phone]
- ****: [Name] - [Email] - [Phone]


| | | |
|---------|---------|---------|
| P0 - | 15 | + CTO |
| P1 - | 1 | Tech Lead + DevOps |
| P2 - | 4 | DevOps Team |
| P3 - | 24 | |


```bash
# 1. (< 5 )
./scripts/emergency-rollback.sh

# 2.
slack-notify "#websocket-migration" " EMERGENCY ROLLBACK EXECUTED"

# 3.
wrangler tail --format pretty > logs/emergency-$(date +%Y%m%d-%H%M%S).log

# 4.
./scripts/create-incident-report.sh
```

---


### A.

- [WebSocket ](docs/architecture/WEBSOCKET_ARCHITECTURE.md)
- [Durable Objects ](docs/development/DURABLE_OBJECTS_GUIDE.md)
- [API ](docs/api/MESSAGING_API_REFERENCE.md)
- [](docs/troubleshooting/WEBSOCKET_TROUBLESHOOTING.md)

### B.

- `scripts/test-websocket-do.sh` - DO
- `scripts/emergency-rollback.sh` -
- `scripts/collect-canary-metrics.sh` - Canary
- `scripts/generate-migration-report.sh` -

### C.

- `wrangler.toml` - Worker
- `frontend/vite.config.ts` -
- `.env.production` -

---

****: v1.0
****: 2025-10-07
****: DevOps Team
