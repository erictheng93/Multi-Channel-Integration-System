# WebSocket


- [](#)
- [](#)
- [](#)
- [](#)
- [ Dashboard](#-dashboard)
- [](#)
- [](#)
- [](#)

---


 **Server-Sent Events (SSE)** **WebSocket + Durable Objects**


- ****: WebSocket SSE
- ****: /
- ****:
- ****: WebSocket SSE
- ****:


```

 Frontend Layer

 useRealtime Composable ()
 WebSocketAdmin ()
 WebSocketMonitoring ()


 Config Layer

 realtime.ts ()
 .env.development ()


 Backend Layer

 websocket-main.ts (WebSocket )
 websocket-broadcast-service.ts ()
 Migration Config (KV )


 Durable Objects Layer

 ConversationRoom ()
 UserConnection ()
 MessageBroadcaster ()
 DelayedMessageProcessor ()

```

---


### Phase 1:

****:
-
-
-

### Phase 2: WebSocket

****:
1. **** (`wrangler.toml`)
 - 6 Durable Objects
 - WebSocket
 -

2. **** (`.env.development`)
 ```bash
 VITE_WEBSOCKET_ENABLED=false #
 VITE_WEBSOCKET_URL=wss://... # WebSocket URL
 VITE_FALLBACK_TO_SSE=true # SSE
 VITE_WEBSOCKET_AUTO_RECONNECT=true #
 VITE_WEBSOCKET_DEBUG=true # Debug
 ```

3. **** (`frontend/src/config/realtime.ts`)
 -
 -
 -

4. **** (`frontend/src/composables/useRealtime.ts`)
 - WebSocket/SSE
 -
 -

### Phase 3:

****:
1. ** API** (`src/handlers/websocket-main.ts`)
 - `GET /api/websocket/migration-status` -
 - `POST /api/websocket/migration-config` - ( Admin )
 - KV

2. **** (`frontend/src/views/WebSocketAdmin.vue`)
 -
 -
 -
 -

### Phase 4: Dashboard

****:
1. ** API**
 - `GET /api/websocket/health` -
 - `GET /api/websocket/metrics` -
 - `GET /api/websocket/readiness` -
 - `GET /api/websocket/liveness` -

2. **** (`frontend/src/views/WebSocketMonitoring.vue`)
 -
 -
 - Durable Objects
 -
 -

### Phase 5: WebSocket

****:
1. **** (`test-websocket-migration.sh`)
 -
 -
 -
 -

2. ****:
 ```
 WebSocket Health Check - PASS
 Migration Status - PASS
 Readiness Check - PASS
 Liveness Check - PASS
 ```

---


 **Cloudflare KV** `websocket_migration_config`

```typescript
interface MigrationConfig {
 enableWebSocket: boolean // WebSocket
 enableSSE: boolean // SSE (fallback)
 migrationStrategy: string //
 rolloutPercentage: number // (0-100)
 featureFlags: {
 websocketConnections: boolean
 durableObjectMessaging: boolean
 distributedLocking: boolean
 batchMessageProcessing: boolean
 realTimeTypingIndicators: boolean
 }
}
```


#### 1: ()

1. `https://your-domain.com/admin/websocket`
2.
3.

#### 2: API

```bash

curl https://your-api-domain.example.com/api/websocket/migration-status

# ( Admin Token)
curl -X POST https://your-api-domain.example.com/api/websocket/migration-config \
 -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "enableWebSocket": true,
 "enableSSE": true,
 "rolloutPercentage": 10
 }'
```


#### 1. **Immediate** ()
- :
- :
- :

#### 2. **Gradual** ()
- :
- : `rolloutPercentage`
- :
 1. `rolloutPercentage: 5` (5% )
 2. 24
 3. 10%, 25%, 50%, 100%

#### 3. **Canary** ()
- :
- :
- :

---

## Dashboard


 Dashboard: `https://your-domain.com/monitoring/websocket`

****:
- ****: WebSocket
- ****:
- ****:
- ****:
- ****: WebSocket vs SSE
- **Durable Objects **: DO


| | | |
|---------|------|--------|
| | > 10% | Error |
| | > 1000ms | Warning |
| | status === 'degraded' | Warning |
| | status === 'unhealthy' | Error |


1. ****: Dashboard
2. ****:
3. ****:
4. ****:

---


```bash

bash test-websocket-migration.sh

# API URL
BASE_URL=https://your-domain.com bash test-websocket-migration.sh
```


#### 1.
```bash
curl https://your-api-domain.example.com/api/websocket/health
```

****:
```json
{
 "status": "healthy",
 "websocketEnabled": false,
 "sseEnabled": true,
 "activeConnections": 0,
 "totalConnections": 0,
 "averageLatency": 0,
 "errorRate": 0,
 "timestamp": 1234567890
}
```

#### 2.
```bash
curl https://your-api-domain.example.com/api/websocket/migration-status
```

****:
```json
{
 "enableWebSocket": false,
 "enableSSE": true,
 "migrationStrategy": "gradual",
 "rolloutPercentage": 0,
 "featureFlags": { ... }
}
```

#### 3.
```bash

cat frontend/.env.development | grep VITE_WEBSOCKET


ls -l frontend/src/config/realtime.ts

# composable
ls -l frontend/src/composables/useRealtime.ts
```

---


### Step-by-Step

#### 1: (Day 0)

```bash
# 1.
ls -l frontend/src/config/realtime.ts
ls -l frontend/src/composables/useRealtime.ts
ls -l frontend/src/views/WebSocketAdmin.vue
ls -l frontend/src/views/WebSocketMonitoring.vue

# 2.
bash test-websocket-migration.sh

# 3.
curl https://your-api-domain.example.com/api/websocket/health
```

#### 2: (Day 1)

```bash
# 1.
cd frontend
npm run build

# 2. Cloudflare Pages
npm run deploy:pages

# 3.
curl https://your-frontend-domain.com
```

#### 3: (Day 2-3)

```bash
# 1. 5% WebSocket
curl -X POST https://your-api-domain.example.com/api/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"enableWebSocket": true, "rolloutPercentage": 5}'

# 2. 24
# Dashboard

# 3.
curl https://your-api-domain.example.com/api/websocket/metrics
```

#### 4: (Day 4-14)

```bash
# Day 4: 10%
curl -X POST ... -d '{"rolloutPercentage": 10}'

# Day 7: 25%
curl -X POST ... -d '{"rolloutPercentage": 25}'

# Day 10: 50%
curl -X POST ... -d '{"rolloutPercentage": 50}'

# Day 14: 100%
curl -X POST ... -d '{"rolloutPercentage": 100}'
```

#### 5: SSE (Day 30+)

```bash
# WebSocket 2
curl -X POST ... -d '{"enableSSE": false, "rolloutPercentage": 100}'
```

---


#### 1. WebSocket

****: WebSocket

****:
```bash
# 1.
curl https://your-api-domain.example.com/api/websocket/health

# 2. Durable Objects
wrangler tail --format pretty

# 3.
console.log(realtimeConfig)
```

****:
- `VITE_WEBSOCKET_ENABLED=true`
- WebSocket URL
- WebSocket

#### 2.

****:

****:
```bash
# 1.
curl https://your-api-domain.example.com/api/websocket/migration-status

# 2. KV ()
wrangler kv:key delete websocket_migration_config --binding=SESSIONS

# 3.
curl -X POST ... -d '{"enableWebSocket": true}'
```

#### 3.

****: 10%

****:
```bash
# 1.
curl https://your-api-domain.example.com/api/websocket/metrics

# 2. Durable Objects
wrangler tail --format pretty

# 3.
curl -X POST ... -d '{"rolloutPercentage": 5}'
```

****:
- `rolloutPercentage`
- SSE fallback: `{"enableSSE": true}`
-

#### 4.

****: 500ms

****:
- Durable Objects
-
-

****:
```bash
# 1. Durable Objects
# ( worker )

# 2.
# ConversationRoom MessageBroadcaster

# 3. CDN
```


```bash
# 1. WebSocket
curl -X POST https://your-api-domain.example.com/api/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{
 "enableWebSocket": false,
 "enableSSE": true,
 "rolloutPercentage": 0
 }'

# 2.
curl https://your-api-domain.example.com/api/websocket/health

# 3.
```

---


- [ WebSocket ](src/handlers/websocket-main.ts)
- [](frontend/src/config/realtime.ts)
- [](frontend/src/composables/useRealtime.ts)
- [WebSocket ](frontend/src/views/WebSocketAdmin.vue)
- [ Dashboard](frontend/src/views/WebSocketMonitoring.vue)

---


1.
2. Dashboard
3. (`wrangler tail`)
4.

---

****: 2025-10-08
****: 1.0.0
****:
