# WebSocket + Durable Objects


 **WebSocket **
 ****: 2025-09-30
 ****: Durable Objects , WebSocket

---


### 1: Durable Objects
****: `src/index.ts` `ConversationRoom`, MVP
****: ,, MVP

****:
```typescript
// (Line 613)
import { ConversationRoom } from './durable-objects/ConversationRoom';

// (Line 184)
import { SimplifiedConversationRoom } from './durable-objects/ConversationRoomSimplified';

// (Line 621)
export { ConversationRoom, ... };

// (Lines 192-193)
export {
 SimplifiedConversationRoom as ConversationRoom, // wrangler.toml
 UserConnection,
 MessageBroadcaster,
 DelayedMessageProcessor,
 DelayedMessageBuffer,
 LockCoordinator
};
```

****:
- 40/100 90/100
- `wrangler.toml`
-

### 2: WebSocket
****: `websocketMainHandler`
****: WebSocket ,

****:
```typescript
// src/index.ts Line 438-441
// ==================== WebSocket Real-time System ====================
// WebSocket endpoints for real-time communication via Durable Objects
app.route('/api/websocket', websocketMainHandler);
console.log('[Startup] WebSocket routes mounted at /api/websocket');
```

****:
- WebSocket `/api/websocket/*`
- Durable Objects
-

---


### WebSocket + Durable Objects

```

 Client Layer
 (Vue 3 Frontend with WebSocket Client)

 WebSocket Upgrade Request
 GET /api/websocket/connect?userId=X&conversationId=Y&token=JWT


 Cloudflare Worker Entry Point
 (src/index.ts)

 app.route('/api/websocket', websocketMainHandler)


 WebSocket Handler Layer
 (handlers/websocket-main.ts)

 1. websocketAuth Middleware (JWT )
 2. userId, conversationId, role
 3.


 conversationId conversationId


 Durable Objects Layer

 ConversationRoom DO UserConnection DO
 (Simplified Version)


 WebSocket
 ()
 : 100
 ()
 5


 MessageBroadcaster DO


 DO


 Infrastructure Layer

 DelayedMessageBuffer LockCoordinator
 () ()


```


#### SimplifiedConversationRoom ()
****:
- : 90/100 ( 40/100)
- : ()
- :
- MVP : ,

****:
```

 SimplifiedVersion Full Version

 90/100 40/100

 100
 5

 MVP /

```

---


#### 1. `src/index.ts` (2 )
** 1**: Line 184
****: ConversationRoom
```typescript
import { SimplifiedConversationRoom } from './durable-objects/ConversationRoomSimplified';
```

** 2**: Lines 192-193
****: wrangler.toml
```typescript
export {
 SimplifiedConversationRoom as ConversationRoom,
 UserConnection,
 MessageBroadcaster,
 DelayedMessageProcessor,
 DelayedMessageBuffer,
 LockCoordinator
};
```

** 3**: Lines 438-441
****: WebSocket
```typescript
// ==================== WebSocket Real-time System ====================
// WebSocket endpoints for real-time communication via Durable Objects
app.route('/api/websocket', websocketMainHandler);
console.log('[Startup] WebSocket routes mounted at /api/websocket');
```


#### 1. `WEBSOCKET_INTEGRATION_PATCHES.md`
****:
****:
-
-
-
-
-

#### 2. `WEBSOCKET_INTEGRATION_COMPLETE_SUMMARY.md` ()
****:
****:

---


### TypeScript

****:
```bash
npm run build
```

****:
```
 WebSocket
 Durable Objects

```

****: `src/modules/integrations/handlers/webhook-handler.ts` , WebSocket , integrations


#### 1.
```bash

npm run dev


 Initializing Unified Route Management System...
 [Startup] WebSocket routes mounted at /api/websocket
```

#### 2. WebSocket
```bash
# JWT token ( token)
export TOKEN="YOUR_JWT_TOKEN"

# WebSocket
curl -i \
 -H "Connection: Upgrade" \
 -H "Upgrade: websocket" \
 "http://localhost:8787/api/websocket/connect?userId=1&conversationId=test_123&token=$TOKEN&role=agent"


HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

#### 3.
```bash
# WebSocket
curl http://localhost:8787/api/websocket/health


{
 "status": "healthy",
 "websocketEnabled": true,
 "sseEnabled": true,
 "totalConnections": 0,
 "activeConnections": 0,
 "timestamp": 1735574400
}
```

#### 4.
```bash
# WebSocket
curl http://localhost:8787/api/websocket/migration-status


{
 "phase": "preparation",
 "websocketEnabled": true,
 "sseEnabled": true,
 "features": {
 "durableObjects": true,
 "messageOrdering": true,
 "connectionPooling": true
 }
}
```

---


### WebSocket

| | | | |
|---------|------|------|----------|
| `/api/websocket/connect` | GET | WebSocket | JWT () |
| `/api/websocket/health` | GET | | |
| `/api/websocket/migration-status` | GET | | |
| `/api/websocket/room/:roomId` | GET | | JWT () |
| `/api/websocket/broadcast` | POST | | JWT () |


**WebSocket URL **:
```
GET /api/websocket/connect?userId={userId}&conversationId={conversationId}&token={jwt}&role={role}
```

****:
- `userId`: ID ()
- `token`: JWT
- `role`: (admin/team/agent/customer)

****:
- `conversationId`: ID ( ConversationRoom DO, UserConnection DO)

---

## Durable Objects

### wrangler.toml

```toml
# ConversationRoom -
[[durable_objects.bindings]]
name = "CONVERSATION_ROOM"
class_name = "ConversationRoom"
script_name = "multi-channel-system"

# UserConnection -
[[durable_objects.bindings]]
name = "USER_CONNECTION"
class_name = "UserConnection"
script_name = "multi-channel-system"

# MessageBroadcaster -
[[durable_objects.bindings]]
name = "MESSAGE_BROADCASTER"
class_name = "MessageBroadcaster"
script_name = "multi-channel-system"

# DelayedMessageProcessor -
[[durable_objects.bindings]]
name = "DELAYED_MESSAGE_PROCESSOR"
class_name = "DelayedMessageProcessor"
script_name = "multi-channel-system"

# DelayedMessageBuffer -
[[durable_objects.bindings]]
name = "DELAYED_MESSAGE_BUFFER"
class_name = "DelayedMessageBuffer"
script_name = "multi-channel-system"

# LockCoordinator -
[[durable_objects.bindings]]
name = "LOCK_COORDINATOR"
class_name = "LockCoordinator"
script_name = "multi-channel-system"
```


```toml
[[migrations]]
tag = "v1"
new_classes = [
 "ConversationRoom",
 "UserConnection",
 "MessageBroadcaster",
 "DelayedMessageProcessor",
 "LockCoordinator"
]
```

---


#### 1.
- **SimplifiedConversationRoom**: 100
- ****: 5
- ****:

#### 2.
```
Simple Counter (SimplifiedConversationRoom)

 counter++ Message ID: counter


 DO


Distributed Lock (Full ConversationRoom)

 LockCoordinator Sequence Number
 DO


```

#### 3.
- **ConversationRoom**:
- **MessageBroadcaster**:
- ****:


| | SimplifiedConversationRoom | |
|------|---------------------------|--------|
| | 100 | |
| | < 10ms | |
| | | |
| | | DO |

---


### ()

1. ****
 ```bash
 # staging
 npm run deploy

 #
 npm run health:check:all
 ```

2. ****
 - 100
 -
 - CPU

3. ****
 - Cloudflare Workers
 - ()
 -

### ()

#### Phase 2: (3-6 )
- [ ] ** ConversationRoom** ( DO )
- [ ] **** (Durable Objects Storage API)
- [ ] **** ()
- [ ] **** (real-time typing indicators)

#### Phase 3: (6-12 )
- [ ] **** ()
- [ ] **** (WebSocket )
- [ ] **** ( DO )
- [ ] **** ()


****:
1. SimplifiedConversationRoom DO
 - ****:
 - ****: MVP ,

2. 100
 - ****:
 - ****:

3.
 - ****: DO
 - ****: D1 source of truth

---


#### 1: WebSocket 404
****: `curl /api/websocket/connect` 404 Not Found

****:
```bash
# 1.
grep "app.route('/api/websocket'" src/index.ts
# : app.route('/api/websocket', websocketMainHandler);

# 2.
npm run dev | grep "WebSocket routes mounted"
# : [Startup] WebSocket routes mounted at /api/websocket
```

****: ( WEBSOCKET_INTEGRATION_PATCHES.md)

#### 2: Durable Objects binding not found
****: `Error: No such binding: CONVERSATION_ROOM`

****:
```bash
# 1. wrangler.toml
grep -A 3 "CONVERSATION_ROOM" wrangler.toml

# 2. index.ts
grep "export {" src/index.ts | grep ConversationRoom
```

****: SimplifiedConversationRoom ConversationRoom

#### 3: TypeScript
****: `Cannot find module './durable-objects/ConversationRoom'`

****:
```bash

grep "from './durable-objects/Conversation" src/index.ts
# : ConversationRoomSimplified ( ConversationRoom)
```

****: `ConversationRoomSimplified`

#### 4: WebSocket 401
****: `HTTP 401 Unauthorized`

****:
```bash
# 1. JWT token
curl http://localhost:8787/api/auth/verify \
 -H "Authorization: Bearer YOUR_TOKEN"

# 2. token
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d
```

****: `/api/auth/login` token

---


### A.

| | |
|---------|------|
| `WEBSOCKET_INTEGRATION_PATCHES.md` | |
| `src/durable-objects/ConversationRoomSimplified.ts` | DO |
| `src/handlers/websocket-main.ts` | WebSocket HTTP |
| `wrangler.toml` | Cloudflare Workers |
| `src/index.ts` | Worker |

### B.

- [Cloudflare Durable Objects ](https://developers.cloudflare.com/durable-objects/)
- [WebSocket API ](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Hono Framework ](https://hono.dev/)

### C.

| | | | |
|------|------|---------|------|
| 2025-09-30 | 1.0.0 | WebSocket + Durable Objects | Claude Code |

---


 ****:
 ****:
 ****:
 ****:


1. **Durable Objects **
 - 5 DO
 - SimplifiedConversationRoom
 - wrangler.toml

2. **WebSocket **
 - `/api/websocket`
 - DO
 -

3. ****
 - TypeScript
 -
 -


****:
```bash
# 1.
npm run dev

# 2. WebSocket
# ()

# 3. , staging
npm run deploy
```

****: ,

---

****: 1.0.0
****: 2025-09-30
****: ,