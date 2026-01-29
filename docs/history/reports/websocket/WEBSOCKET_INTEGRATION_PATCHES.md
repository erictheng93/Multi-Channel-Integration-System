# WebSocket

 WebSocket + Durable Objects

## 1: Durable Objects (src/index.ts, line 612-621)

### :
```typescript
// Import Durable Objects for WebSocket + Durable Objects Architecture
import { ConversationRoom } from './durable-objects/ConversationRoom';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
import { DelayedMessageBuffer } from './durable-objects/DelayedMessageBuffer';
import { LockCoordinator } from './services/distributed-lock-service';

// Export Durable Objects
export { ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor, DelayedMessageBuffer, LockCoordinator };
```

### :
```typescript
// Import Durable Objects for WebSocket + Durable Objects Architecture
// ConversationRoom (MVP )
import { SimplifiedConversationRoom } from './durable-objects/ConversationRoomSimplified';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
import { DelayedMessageBuffer } from './durable-objects/DelayedMessageBuffer';
import { LockCoordinator } from './services/distributed-lock-service';

// Export Durable Objects
// : SimplifiedConversationRoom ConversationRoom wrangler.toml
export {
 SimplifiedConversationRoom as ConversationRoom,
 UserConnection,
 MessageBroadcaster,
 DelayedMessageProcessor,
 DelayedMessageBuffer,
 LockCoordinator
};
```

## 2: WebSocket (src/index.ts, line 437)

### :
```typescript
// ==================== Analytics Comparison API ====================
// Period comparison endpoints for analytics module
app.route('/api/analytics/comparison', comparisonAPI);
```

### :
```typescript
// ==================== WebSocket Real-time System ====================
// WebSocket endpoints for real-time communication via Durable Objects
app.route('/api/websocket', websocketMainHandler);
console.log(' [Startup] WebSocket routes mounted at /api/websocket');
```


,:

```bash
# 1. TypeScript
npm run build

# 2.
npm run dev

# 3. WebSocket ()
# YOUR_JWT_TOKEN JWT token
curl -i \
 -H "Connection: Upgrade" \
 -H "Upgrade: websocket" \
 "http://localhost:8787/api/websocket/connect?userId=1&conversationId=test_123&token=YOUR_JWT_TOKEN&role=agent"

# 4. WebSocket
curl http://localhost:8787/api/websocket/health

# 5.
curl http://localhost:8787/api/websocket/migration-status
```


### 1.
```
 TypeScript compilation successful
 No type errors
```

### 2.
```
 Initializing Unified Route Management System...
 Route system initialized successfully:
 Groups: X
 Modules: X/X

 [Startup] WebSocket routes mounted at /api/websocket
```

### 3. WebSocket
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

### 4.
```json
{
 "status": "healthy",
 "websocketEnabled": true,
 "sseEnabled": true,
 "totalConnections": 0,
 "activeConnections": 0,
 "timestamp": 1234567890
}
```


- [ ] DO
- [ ] WebSocket
- [ ] TypeScript
- [ ]
- [ ] WebSocket
- [ ] WebSocket
- [ ]


,:

1. ****
 - handlers/message.ts SimplifiedWebSocketBroadcastService
 -

2. ****
 - JWT websocket-auth
 -

3. ****
 - WebSocket
 -

4. ****
 - Durable Objects
 - WebSocket
 -


```
Client Request


/api/websocket/connect


websocket-main.ts (Handler)
 websocketAuth ()
 JWT


 conversationId
 ConversationRoom DO
 WebSocket


 conversationId
 UserConnection DO


 MessageBroadcaster DO

```


### Q1: WebSocket , 404
**A:** `app.route('/api/websocket', websocketMainHandler)`

### Q2: DO binding not found
**A:** wrangler.toml DO

### Q3: Type error: ConversationRoom not found
**A:** SimplifiedConversationRoom

### Q4: WebSocket upgrade fails with 401 Unauthorized
**A:** JWT token , websocket-auth


- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Hono Framework: https://hono.dev/

---

**:** 2025-09-30
**:** WebSocket + Durable Objects
**:** 