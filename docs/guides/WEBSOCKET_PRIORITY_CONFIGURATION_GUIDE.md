# WebSocket

> ** WebSocket Durable Objects **
> : 1.0.0 | : 2025-10-01

---


1. [](#)
2. [](#)
3. [](#)
4. [](#)
5. [](#)
6. [](#)

---


** WebSocket Durable Objects** WebSocket SSE

```


 1: ENVIRONMENT === 'production'
 2: CONVERSATION_ROOM && USER_CONNECTION


 1 AND 2 WebSocket () + SSE ()
 SSE only

:
 WebSocket
 Durable Objects
 WebSocket
```

---


```typescript
// 1:
async function initializeCollaboration(env: Bindings) {
 try {
 // WebSocket + SSE
 const config = {
 defaultProtocol: (isProduction && hasWebSocketSupport) ? 'websocket' : 'sse',
 enableWebSocket: hasWebSocketSupport
 };
 await Collaboration.initialize(env, config);
 } catch (error) {
 // SSE
 console.log(' Attempting fallback to SSE-only mode...');
 await Collaboration.initialize(env, {
 defaultProtocol: 'sse',
 enableWebSocket: false
 });
 }
}

// 2: CollaborationManager
async initialize(env: Bindings, config?: Partial<CollaborationConfig>) {
 // SSE
 const sseAdapter = new SSECollaborationAdapter();
 await sseAdapter.initialize(env);
 this.adapters.set('sse', sseAdapter);

 // WebSocket
 if (this.config.enableWebSocket) {
 try {
 const wsAdapter = new WebSocketCollaborationAdapter();
 await wsAdapter.initialize(env);
 this.adapters.set('websocket', wsAdapter);
 } catch (error) {
 console.error('Failed to initialize WebSocket adapter:', error);
 console.log('Falling back to SSE only');
 }
 }

 //
 if (!this.adapters.get(this.config.defaultProtocol)) {
 if (this.config.defaultProtocol === 'websocket') {
 this.defaultAdapter = this.adapters.get('sse');
 this.config.defaultProtocol = 'sse';
 }
 }
}

// 3:
private getAdapter(protocol?: CollaborationProtocol): CollaborationAdapter {
 if (protocol) {
 const adapter = this.adapters.get(protocol);
 if (!adapter) {
 // WebSocket SSE
 if (protocol === 'websocket') {
 console.warn('WebSocket not available, falling back to SSE');
 return this.adapters.get('sse')!;
 }
 }
 return adapter;
 }
 return this.defaultAdapter!;
}
```


```


 Durable Objects


 + Durable Objects


 YES NO

 WS SSE


 YES NO


WebSocket () SSE ()
 +
SSE ()


```

---


#### 1:

```bash

curl https://your-api-domain.example.com/api/collaboration/health

# (WebSocket ):
{
 "success": true,
 "data": {
 "status": "healthy",
 "config": {
 "defaultProtocol": "websocket",
 "enableWebSocket": true
 },
 "availableProtocols": ["sse", "websocket"],
 "timestamp": "2025-10-01T10:00:00Z"
 }
}

# ( SSE):
{
 "success": true,
 "data": {
 "status": "healthy",
 "config": {
 "defaultProtocol": "sse",
 "enableWebSocket": false
 },
 "availableProtocols": ["sse"],
 "timestamp": "2025-10-01T10:00:00Z"
 }
}
```

#### 2:

```bash
# Worker
wrangler tail

# WebSocket :
# Collaboration Module initialized successfully
# Protocol: WebSocket (primary) + SSE (fallback)
# Environment: production

# SSE :
# Attempting fallback to SSE-only mode...
# Collaboration Module initialized in SSE fallback mode
```

#### 3:

```bash

curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://your-api-domain.example.com/api/collaboration/stats

# :
{
 "success": true,
 "data": {
 "totalViewers": 15,
 "totalTyping": 2,
 "totalRooms": 8,
 "connectionsByProtocol": {
 "sse": 3,
 "websocket": 12, // WebSocket
 "http": 0
 }
 }
}
```

---


### WebSocket vs SSE

```

 WebSocket SSE

 ~50ms ~30ms SSE
 ~10ms ~50ms WebSocket
 WebSocket
 SSE
 SSE
 (1000+) WebSocket
 64KB SSE
 SSE

 WebSocket

```


#### 1: 100

```
: WebSocket Durable Objects

: 12ms
P95 : 25ms
P99 : 45ms
CPU : 15%
: 45MB
:

: SSE

: 55ms
P95 : 120ms
P99 : 250ms
CPU : 12%
: 35MB
:
```

#### 2: Typing Indicator

```
WebSocket: = 15ms
SSE: = 80ms

: WebSocket 5.3
```

---


### Cloudflare Workers

```
SSE ()

 : 100,000 /
 : $5.00/ + $0.50/
 Durable Objects
 :

WebSocket Durable Objects ()

 : $5.00/ ()
 Durable Objects: $0.15/
 + $0.20/GB
 + $12.50/ WebSocket
 :
```

### 1000

```
: 1000 10

SSE :
 Workers : 1000 ? 10 ? 30 = 300,000 /
 : $5.00 () + $0.15 ()
 : ~$5.15/

WebSocket :
 Workers : 300,000 /
 Durable Objects : 300,000 ? $0.15/
 WebSocket : 3,000,000 ? $12.50/
 : $5.00 () + $0.045 (DO) + $37.50 (WS)
 : ~$42.55/

: WebSocket 8
:
```

---


### 1: WebSocket

****:
```
 Failed to initialize WebSocket adapter
 Attempting fallback to SSE-only mode...
 Collaboration Module initialized in SSE fallback mode
```

****:
1. Durable Objects
2. wrangler.toml Durable Objects
3. Workers Durable Objects

****:

```bash
# 1. wrangler.toml
cat wrangler.toml | grep -A 3 "durable_objects.bindings"

# :
# [[durable_objects.bindings]]
# name = "CONVERSATION_ROOM"
# class_name = "ConversationRoom"

# 2. Workers
wrangler whoami

# 3. Durable Objects
wrangler deploy

# 4. Durable Objects
curl https://your-domain.com/api/collaboration/health
```

---

### 2: SSE

****:
```json
{
 "config": {
 "defaultProtocol": "sse",
 "enableWebSocket": false
 },
 "availableProtocols": ["sse"]
}
```

****:
1. `ENVIRONMENT` "production"
2. Durable Objects
3.

****:

```bash
# 1.
wrangler secret list

# 2.
wrangler tail --format pretty

# 3. Durable Objects
curl -X POST https://your-domain.com/api/test-durable-object

# 4. wrangler.toml vars
cat wrangler.toml | grep -A 5 "\[vars\]"
```

---

### 3: WebSocket SSE

****:
```json
{
 "connectionsByProtocol": {
 "sse": 5,
 "websocket": 15
 }
}
```

****: ****

****:
-
- SSE
-
- WebSocket

** WebSocket**:
```typescript
// : composables/useCollaboration.ts
const joinConversation = async () => {
 await fetch(`/api/collaboration/conversations/${id}/join`, {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${token}` },
 body: JSON.stringify({
 protocol: 'websocket' // WebSocket
 })
 });
};
```

---

### 4: WebSocket

****:
- 1-2
-

****:
1. Cloudflare
2. Durable Objects
3.

****:

```typescript
// 1. WebSocket
// src/modules/collaboration/adapters/websocket-adapter.ts

class WebSocketCollaborationAdapter {
 private setupHeartbeat(ws: WebSocket) {
 const interval = setInterval(() => {
 if (ws.readyState === WebSocket.OPEN) {
 ws.send(JSON.stringify({ type: 'ping' }));
 }
 }, 30000); // 30

 ws.addEventListener('close', () => {
 clearInterval(interval);
 });
 }
}
```

---


```typescript
//
setInterval(async () => {
 const response = await fetch('/api/collaboration/stats', {
 headers: { 'Authorization': `Bearer ${token}` }
 });

 const stats = await response.json();

 // WebSocket
 const wsRate = stats.data.connectionsByProtocol.websocket /
 (stats.data.connectionsByProtocol.websocket +
 stats.data.connectionsByProtocol.sse);

 console.log(`WebSocket : ${(wsRate * 100).toFixed(1)}%`);

 // : WebSocket
 if (wsRate < 0.8) {
 console.warn(' WebSocket ');
 }
}, 60000); //
```


```bash

wrangler tail | grep -E "fallback|falling back|downgrade"

# WebSocket
wrangler tail | grep -E "WebSocket.*initialized|WebSocket.*failed"


wrangler tail | grep "Collaboration Module"
```

---


### 1.

```
 1: A/B (1 )
 10% WebSocket


 2: (2 )
 50% WebSocket


 3: (1 )
 100% WebSocket
 SSE


 4: ()
 Durable Objects


```

### 2.

```bash
# SSE ()
# src/index.ts

const config = {
 defaultProtocol: 'sse', // 'sse'
 enableWebSocket: false, // false
 // ...
};


wrangler deploy


curl https://your-domain.com/api/collaboration/health | jq '.data.config'
```

---


 ****: WebSocket Durable Objects
 ****:
 ****: SSE
 ****:


| | | |
|---------|---------|------|
| (100+ ) | WebSocket | |
| | SSE | |
| (< 20ms) | WebSocket | |
| | SSE | |
| | WebSocket | |
| | WebSocket + SSE | + |


1. ****: `/api/collaboration/health` WebSocket
2. ****: WebSocket
3. ****: Cloudflare Workers
4. ****:
5. ****:

---

****: DevOps Team
****: 2025-10-01
****: 1.0.0
