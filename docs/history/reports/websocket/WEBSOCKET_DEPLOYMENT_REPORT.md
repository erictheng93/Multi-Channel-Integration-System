# WebSocket
## WebSocket Module Deployment Report

> **HISTORICAL DOCUMENT NOTE**
>
> This deployment report references **AGENT_QUEUE** which has been **deprecated and removed** (2025-10-07).
>
> Delayed messaging is now handled by **DelayedMessageBuffer Durable Object**.
>
> See: [Migration Report](../migration/MIGRATION_TO_DURABLE_OBJECTS_COMPLETE.md)

 ****: 2025-09-30
 ****:
 ** ID**: 0d5de422-ceb3-40b3-bd2b-462737444a45
 **Worker **: 53ms

---

## (Executive Summary)


 WebSocket + Durable Objects ,,


1. ** Durable Objects ** - SimplifiedConversationRoom
2. **** -
3. **** -
4. **WebSocket ** -

---


### 1: WebSocket

****:
```bash
curl https://your-api-domain.example.com/api/websocket/health
# : {"error":"Missing or invalid authorization header"}
```

****:
- WebSocket handler `src/core/route-config.ts` `dependencies: ['auth']`
- (RouteRegistry) handler
- handler `/health` `/migration-status` ,

** (3)**:

** 1**: WebSocket auth
```typescript
// src/core/route-config.ts:262
createRouteModule({
 name: 'websocket',
 path: '/websocket',
 handler: websocketMainHandler,
 description: 'WebSocket Connection Handler',
 version: '1.0.0',
 dependencies: [], // ,auth handler
 healthCheck: '/health'
})
```

** 2**: index.ts
```typescript
// src/index.ts:439-444 ()
// : app.route('/api/websocket', websocketMainHandler);
// :
```

** 3**: ()
```typescript
// src/index.ts:118-132
// ,
app.get('/api/websocket/health', async (c) => {
 const handler = websocketMainHandler;
 const url = new URL(c.req.url);
 url.pathname = '/health';
 return handler.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});

app.get('/api/websocket/migration-status', async (c) => {
 const handler = websocketMainHandler;
 const url = new URL(c.req.url);
 url.pathname = '/migration-status';
 return handler.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});
```

** 3?**
- Hono ""
-
- :

****:
```bash
 curl https://your-api-domain.example.com/api/websocket/health
# : {"status":"healthy","websocketEnabled":true,...}

 curl https://your-api-domain.example.com/api/websocket/migration-status
# : {"enableWebSocket":true,"enableSSE":true,...}
```

---


### WebSocket

```

 Cloudflare Worker Entry Point
 (src/index.ts)


 Pre-registered Public Endpoints
 (Before Unified Route System)

 GET /api/websocket/health No Auth
 GET /api/websocket/migration-status No Auth


 Unified Route Registry System
 (src/core/route-registry.ts)

 Registers all route groups and modules
 Applies group-level middleware
 Handles dependencies and health checks


 WebSocket Handler (Unified Route System)
 (handlers/websocket-main.ts)

 GET /api/websocket/connect websocketAuth
 POST /api/websocket/disconnect websocketAuth
 GET /api/websocket/metrics Public
 GET /api/websocket/test-connection Public
 POST /api/websocket/migration-config Admin Only


 Durable Objects Layer

 ConversationRoom UserConnection
 (Simplified) (Global User State)
 100 max conn Cross-conversation
 Simple counter Presence management
 5min timeout Event multiplexing


 MessageBroadcaster DO
 Event queuing and batch processing
 Priority-based delivery
 Cross-DO coordination

```


#### ?

****: Hono
-
- `app.route()` handler
- ""

****:
```
:
1. (line 118-132)
2. (line 138-140)
3.
```

****:
-
-
-
-

---


#### 1.
```bash
curl https://your-api-domain.example.com/api/system/health
```
****:
```json
{
 "status": "healthy",
 "timestamp": "2025-09-30T13:52:21.804Z",
 "database": "connected",
 "version": "1.0.0"
}
```
****: PASS

#### 2. WebSocket
```bash
curl https://your-api-domain.example.com/api/websocket/health
```
****:
```json
{
 "status": "healthy",
 "websocketEnabled": true,
 "sseEnabled": true,
 "totalConnections": 0,
 "activeConnections": 0,
 "connectionsByType": {
 "websocket": 0,
 "sse": 0
 },
 "averageLatency": 0,
 "errorRate": 0,
 "timestamp": 1759240342336
}
```
****: PASS

#### 3. WebSocket
```bash
curl https://your-api-domain.example.com/api/websocket/migration-status
```
****:
```json
{
 "enableWebSocket": true,
 "enableSSE": true,
 "migrationStrategy": "gradual",
 "rolloutPercentage": 50,
 "featureFlags": {
 "websocketConnections": true,
 "durableObjectMessaging": true,
 "distributedLocking": true,
 "batchMessageProcessing": true,
 "realTimeTypingIndicators": true
 }
}
```
****: PASS


| | | | |
|---------|------|---------|------|
| System Health | PASS | ~150ms | |
| WebSocket Health | PASS | ~200ms | |
| Migration Status | PASS | ~180ms | 50% rollout, |
| Public Endpoints | PASS | - | , |
| Durable Objects Bindings | PASS | - | 6 DO |
| KV Namespaces | PASS | - | SESSIONS, CACHE |
| D1 Database | PASS | - | mcis-db |
| R2 Bucket | PASS | - | attachments |
| Queues | PASS | - | agent-queue, realtime-events |

---


### Cloudflare Worker

#### Durable Objects (6)
```
 CONVERSATION_ROOM ConversationRoom
 USER_CONNECTION UserConnection
 MESSAGE_BROADCASTER MessageBroadcaster
 DELAYED_MESSAGE_PROCESSOR DelayedMessageProcessor
 DELAYED_MESSAGE_BUFFER DelayedMessageBuffer
 DISTRIBUTED_LOCK LockCoordinator
```

#### KV Namespaces (2)
```
 SESSIONS (ace3f7202e6a4dd8b98c50e9b91b2431)
 CACHE (f3bc7a55c8a14f4fb28b8321fa01dc73)
```

#### Queues (2)
```
 AGENT_QUEUE agent-queue (DEPRECATED - removed 2025-10-07)
 REALTIME_QUEUE realtime-events
```

#### D1 Database
```
 DB mcis-db
```

#### R2 Bucket
```
 R2_BUCKET mcis-files
 R2_PUBLIC_URL https://your-storage-domain.example.com
```

#### Environment Variables
```
 ENVIRONMENT production
```

### Worker

| | | |
|------|-------|------|
| Bundle Size (Original) | 1462.24 KiB | |
| Bundle Size (Gzip) | 356.96 KiB | |
| Worker Startup Time | 53ms | |
| Deployment Time | 24.16s | |

---


#### 1. `src/core/route-config.ts` (Line 256-264)
****: WebSocket auth
```typescript
// Before:
dependencies: ['auth'],

// After:
dependencies: [], // Auth handled per-endpoint by websocketAuth middleware
```

#### 2. `src/index.ts` (Line 115-132)
****: WebSocket
```typescript
// :
app.get('/api/websocket/health', async (c) => {
 const handler = websocketMainHandler;
 const url = new URL(c.req.url);
 url.pathname = '/health';
 return handler.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});

app.get('/api/websocket/migration-status', async (c) => {
 const handler = websocketMainHandler;
 const url = new URL(c.req.url);
 url.pathname = '/migration-status';
 return handler.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});
```

#### 3. `src/index.ts` (Line 439-444)
****: WebSocket
```typescript
// Before:
app.route('/api/websocket', websocketMainHandler);
console.log(' [Startup] WebSocket routes mounted at /api/websocket');

// After:
// WebSocket routes are now managed by the Unified Route Registry
// (,)
```


1. **WEBSOCKET_INTEGRATION_PATCHES.md** -
2. **WEBSOCKET_INTEGRATION_COMPLETE_SUMMARY.md** -
3. **WEBSOCKET_DEPLOYMENT_REPORT.md** - ()

---

## WebSocket


| | | |
|---------|------|------|
| Durable Objects | | 6 DO |
| WebSocket | | `/connect` |
| | | `/health` |
| | | 50% rollout, |
| | | |
| | | |
| | | websocketAuth |

### (Feature Flags)

| | | |
|------|---------|------|
| websocketConnections | true | WebSocket |
| durableObjectMessaging | true | Durable Objects |
| distributedLocking | true | |
| batchMessageProcessing | true | |
| realTimeTypingIndicators | true | |


****:
- ****: gradual ()
- **WebSocket **: true
- **SSE **: true ()
- **Rollout **: 50%

****:
- 50% WebSocket
- 50% SSE ()
- `/api/websocket/migration-config` ( admin )

---


#### 1. WebSocket
```bash
# JWT token
TOKEN=$(curl -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"admin","password":"yourpass"}' | jq -r '.token')

# WebSocket ( WebSocket )
wscat -c "wss://your-api-domain.example.com/api/websocket/connect?userId=1&conversationId=test_123&token=$TOKEN&role=admin"
```

#### 2.
```bash
# WebSocket
watch -n 5 "curl -s https://your-api-domain.example.com/api/websocket/health | jq"
```

#### 3. Rollout ()
```bash
# 75% WebSocket
curl -X POST https://your-api-domain.example.com/api/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"rolloutPercentage": 75}'
```

### (1-2 )


- ****: > 98%
- ****: < 100ms
- ****: < 1%
- ****:
- **Durable Objects **:


```typescript
{
 errorRate: 0.05, // 5%
 averageLatency: 200, // 200ms
 maxConnections: 8000, // 80%
 unhealthyDuration: 300 // 5
}
```

### (1-3 )

#### Phase 1:
- [ ] (Durable Objects Storage API)
- [ ]
- [ ]
- [ ]

#### Phase 2:
- [ ] ConversationRoom ( DO )
- [ ] ()
- [ ]
- [ ]

#### Phase 3:
- [ ]
- [ ]
- [ ]
- [ ] WebSocket

---


#### 1. SimplifiedConversationRoom
****: , DO

****:
-
-

****:
- MVP
-
- ConversationRoom ( LockCoordinator)

****: (95% )

#### 2.
****: SimplifiedConversationRoom 100

****:
- (>100 )
-

****:
-
- ConversationRoom ()
-

****: ()

#### 3.
****: Durable Objects

****:
- DO
- D1 source of truth

****:
- D1
-
- DO Storage API

****: ()


| | | | |
|------|--------|---------|------|
| WebSocket | | SSE | |
| DO | | + | |
| | | websocketAuth | |
| | | D1 | |
| | | + | |

---


| | | |
|------|------|------|
| WEBSOCKET_INTEGRATION_PATCHES.md | | |
| WEBSOCKET_INTEGRATION_COMPLETE_SUMMARY.md | | |
| WEBSOCKET_DEPLOYMENT_REPORT.md | - | |
| CLAUDE.md | | |
| src/handlers/websocket-main.ts | WebSocket | |
| src/durable-objects/ | Durable Objects | |


| | | |
|------|------|---------|
| Backend Developer | WebSocket | handler, DO , |
| DevOps Engineer | | , , |
| Frontend Developer | WebSocket | , , UI |
| QA Engineer | | , , |
| Product Manager | | Rollout , , |


- [Cloudflare Durable Objects ](https://developers.cloudflare.com/durable-objects/)
- [Hono Framework ](https://hono.dev/)
- [WebSocket API ](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Cloudflare Workers ](https://developers.cloudflare.com/workers/platform/best-practices/)

---


```
2025-09-30

09:00 -
 WebSocket DO
 wrangler.toml
 ConversationRoomSimplified

10:30 -
 DO (SimplifiedConversationRoom as ConversationRoom)
 WebSocket
 TypeScript

13:00 -

 :
 route-config.ts auth ()
 (Hono )
 ( !)
 : 0d5de422-ceb3-40b3-bd2b-462737444a45

13:52 -
 System Health Check
 WebSocket Health Check
 Migration Status Check
 Public Endpoints Accessible

14:00 -
 WEBSOCKET_DEPLOYMENT_REPORT.md ()
```

****: ~5
****: 3
****: 7
****: ,

---


1. **** -
2. **** - Hono
3. **** - 3
4. **** - ,
5. **** - SSE ,


| | | |
|--------|------|------|
| | WebSocket | |
| | Durable Objects | |
| | rollout | |
| | | |
| | SimplifiedVersion | |


** (1-2 )**:
- WebSocket
-
-

** (1-3 )**:
- (, )
-
-

** (3-12 )**:
- (, )
-
-

---

## A:


```bash

curl https://your-api-domain.example.com/api/system/health

# WebSocket
curl https://your-api-domain.example.com/api/websocket/health


curl https://your-api-domain.example.com/api/websocket/migration-status
```


```bash

npm run deploy


wrangler deploy --env production


wrangler tail
```


```bash
# TypeScript
npm run build


npm run test


npm run perf:baseline:sse
```

---

## B:

### : WebSocket 401

****: `/api/websocket/connect` 401 Unauthorized

****:
1. JWT token ? `/api/auth/verify`
2. Token ? `exp`
3. Token URL ? `?token=YOUR_JWT_TOKEN`
4. websocketAuth ?

****:
```bash
# token
TOKEN=$(curl -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"your_user","password":"your_pass"}' | jq -r '.token')

# token
wscat -c "wss://your-api-domain.example.com/api/websocket/connect?userId=1&token=$TOKEN&role=agent"
```

### : Durable Objects binding not found

****: `Error: No such binding: CONVERSATION_ROOM`

****:
1. wrangler.toml ?
2. index.ts DO ?
3. DO ?
4. ?

****:
```bash

grep -A 3 "CONVERSATION_ROOM" wrangler.toml


grep "export {" src/index.ts | grep ConversationRoom


npm run deploy
```

---

****: 1.0.0
****: 2025-09-30 14:00 UTC
****: WebSocket
****: AI Assistant (Claude Code)
****:

---

****: WebSocket + Durable Objects ,