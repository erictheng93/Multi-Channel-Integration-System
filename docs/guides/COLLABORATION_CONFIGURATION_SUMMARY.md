
> **WebSocket + SSE **
> : 2025-10-01

---


```typescript
// src/index.ts -

:
 ENVIRONMENT === 'production'
 CONVERSATION_ROOM + USER_CONNECTION
 WebSocket () + SSE ()
 SSE only

:
1 : SSE-only
2 : WebSocket SSE
3 : WebSocket SSE
```

---


```
: ENVIRONMENT = "production" + Durable Objects
:

 : WebSocket
 WebSocket :
 SSE :
 : ['sse', 'websocket']
 :


:
 Collaboration Module initialized successfully
 Protocol: WebSocket (primary) + SSE (fallback)
 Environment: production
```

### /

```
: ENVIRONMENT "production" Durable Objects
:

 : SSE
 WebSocket :
 SSE :
 : ['sse']


:
 Collaboration Module initialized successfully
 Protocol: SSE only
 Environment: development
```

---


### 1: WebSocket

```
: Durable Objects

:
1. WebSocket
 []
2.

3. WebSocket

4. (websocket)

5. SSE

6. (SSE )

:
 Failed to initialize WebSocket adapter: [error]
 WebSocket not available, falling back to SSE as default
 Collaboration Module initialized in SSE fallback mode
```

### 2: WebSocket

```
: WebSocket

POST /api/collaboration/conversations/123/join
Body: { "protocol": "websocket" }

:
1. protocol = "websocket"

2. getAdapter('websocket')

3. WebSocket

4. SSE

5. ( SSE)

:
 [CollaborationManager] WebSocket not available, falling back to SSE
 Joined conversation successfully (using SSE)
```

### 3:

```
:

:
1. (WebSocket + SSE)
 []
2. (SSE only)
 []
3.

4.

:
 Failed to initialize Collaboration Module: [error]
 Attempting fallback to SSE-only mode...
 Fallback initialization also failed: [error]
 Collaboration module initialization failed (continuing anyway)
```

---


### 1: API

```bash

curl https://multi-channel.imfinethankyouandyou.com/api/collaboration/health | jq

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
 },
 "message": "Health check completed"
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
 },
 "message": "Health check completed"
}
```

### 2:

```bash

curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/collaboration/stats | jq

# :
{
 "success": true,
 "data": {
 "totalViewers": 25,
 "totalTyping": 3,
 "totalRooms": 12,
 "connectionsByProtocol": {
 "sse": 5,
 "websocket": 20, // WebSocket
 "http": 0
 },
 "topActiveConversations": [...]
 }
}
```

### 3:

```bash

wrangler tail --format pretty


wrangler tail | grep -E "Collaboration|WebSocket|fallback"

# :
# Initializing Collaboration Module...
# [CollaborationManager] Initializing with config: { defaultProtocol: 'websocket', enableWebSocket: true }
# [CollaborationManager] WebSocket adapter initialized
# [CollaborationManager] Initialization complete
# [CollaborationManager] Default protocol: websocket
# [CollaborationManager] Available protocols: [ 'sse', 'websocket' ]
# Collaboration Module initialized successfully
# Protocol: WebSocket (primary) + SSE (fallback)
# Environment: production
```

---


### WebSocket ()

```
: ~50ms
: ~10-15ms
: 1000+
:

:
 (100+)
 (< 20ms )


```

### SSE (/)

```
: ~30ms
: ~50-80ms
: 100+
:

:


```

---


### ( WebSocket )

```
: 1000 10

Cloudflare Workers :
 Workers : $5.00/
 Durable Objects : 300,000 × $0.15/ = $0.045/
 WebSocket : ~3,000,000 × $12.50/ = $37.50/
 : ~$42.55/

SSE only ():
 Workers : $5.00/
 : ~$0.15/
 : ~$5.15/

: WebSocket $37/ (8 )

:
 < 500 : SSE only
 500-2000 : WebSocket
 > 2000 : WebSocket
```

---


### (1-2 )

1. ****
 ```typescript
 //
 setInterval(async () => {
 const stats = await fetch('/api/collaboration/stats');
 const wsRate = calculateWebSocketRate(stats);
 if (wsRate < 0.8) {
 console.warn('WebSocket ');
 }
 }, 60000);
 ```

2. **A/B **
 - 10% WebSocket
 -
 -

3. ****
 - Cloudflare Dashboard
 - Durable Objects
 -

### (1-3 )

4. ****
 -
 -
 -

5. ****
 - 1000+
 -
 -

6. ****
 -
 -
 -

### (3-6 )

7. ****
 -
 -
 -

8. ****
 - WebSocket
 - SSE
 -

---


- [x] wrangler.toml Durable Objects
- [x] ENVIRONMENT "production"
- [x] Durable Objects
- [x] CollaborationManager
- [x]
- [x]
- [ ] TypeScript
- [ ]
- [ ]
- [ ] WebSocket


- [ ] `/api/collaboration/health` WebSocket
- [ ]
- [ ] (join/leave/typing)
- [ ] WebSocket
- [ ] ( WebSocket )
- [ ] Cloudflare

---


 ****: WebSocket SSE
 ****:
 ****:
 ****:
 ****:


```
: WebSocket () + SSE ()
:
:
:
:
```


1. ****: `npm run build`
2. ****:
3. ****: `wrangler deploy`
4. ****: WebSocket
5. ****:

---

****: 2025-10-01
****: DevOps Team
****: 1.0.0
