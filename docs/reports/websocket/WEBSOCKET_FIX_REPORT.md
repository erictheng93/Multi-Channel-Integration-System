# WebSocket

****: 2025-10-14
****:
****: WebSocket

---


 " SSE " " Connection error"


#### 1: WebSocket API
- ****: `frontend/src/services/websocketClient.ts:281`
- ****: `healthData.websocketEnabled`
- ****: API `healthData.configuration.websocketEnabled`
- ****: WebSocket

#### 2: CSPContent Security Policy
- ****: `frontend/_headers`
- ****: `connect-src` `https://`
- ****: WebSocket `wss://`
- ****: WebSocket

---


### A: WebSocket

****: `frontend/src/services/websocketClient.ts`

****:
```typescript
const healthData = await response.json()
if (healthData.websocketEnabled) { //
 checks.push('WebSocket service available')
} else {
 return { success: false, error: 'WebSocket service disabled on server' }
}
```

****:
```typescript
const healthData = await response.json()
//
const isWebSocketEnabled = healthData.configuration?.websocketEnabled ??
 healthData.websocketEnabled ??
 false
if (isWebSocketEnabled) {
 checks.push('WebSocket service available')
} else {
 return { success: false, error: 'WebSocket service disabled on server' }
}
```

****:
- API
-
- nullish coalescing

---

### B: CSP

****: `frontend/_headers`

****:
```
connect-src 'self' https://*.workers.dev https://cloudflareinsights.com https://your-api-domain.example.com;
```

****:
```
connect-src 'self' https://*.workers.dev https://cloudflareinsights.com https://your-api-domain.example.com wss://your-api-domain.example.com;
```

****:
- `wss://your-api-domain.example.com` `connect-src`
- WebSocket
-

---


- **URL**: https://multi-channel-platform-frontend.pages.dev
- ****: Conversation ID 3
- ****: 2025-10-14 17:35


#### 1. WebSocket
```
[WebSocketClient] Pre-connection checks passed:
 - Token present
 - Token format valid
 - Token structure valid
 - Token not expired
 - Token has sufficient time remaining
 - WebSocket service available
```

#### 2. WebSocket
```
[WebSocketClient] Connecting to WebSocket: wss://your-api-domain.example.com/...
[WebSocketClient] Connection state changed to: connecting
[WebSocketClient] WebSocket connected successfully
[WebSocketClient] Connection state changed to: connected
```

#### 3. CSP
- : `Refused to connect... violates Content Security Policy directive`
- : CSP

#### 4.
```
[Phase 2.1] Unified connection established: websocket
[Phase 2.1] Unified connection state changed: connected
```

---


- ****: < 100ms
- **WebSocket **: < 200ms
- ****: < 300ms


- ** HTTP **: 1 health check
- ****:
- **CPU **:

---


| | | |
|------|------|----------|
| POST 500 | | API 200 |
| | | |
| | | |
| | | API JSON |
| SSE | | WebSocket |

---


- **Build Version**: Latest (2025-10-14)
- **Deployment ID**: f800d3ee
- **Deployment URL**: https://f800d3ee.multi-channel-platform-frontend.pages.dev
- **Production URL**: https://multi-channel-platform-frontend.pages.dev


1. `frontend/src/services/websocketClient.ts` - WebSocket
2. `frontend/_headers` - CSP

### Git
-
- : `fix: resolve WebSocket connection issues (pre-check + CSP)`

---


- WebSocket
- CSP
-


- SSE fallback B
 -
 -
- C
 -
 -


- WebSocket
-
- Durable Objects

---


### API
```json
{
 "status": "healthy",
 "components": {
 "websocket": {"status": "healthy"},
 "sse": {"status": "healthy"}
 },
 "configuration": {
 "websocketEnabled": true,
 "sseEnabled": true,
 "rolloutPercentage": 100
 }
}
```

### CSP
```
Content-Security-Policy:
 default-src 'self';
 script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com;
 style-src 'self' 'unsafe-inline';
 img-src 'self' data: https:;
 font-src 'self' data:;
 connect-src 'self' https://*.workers.dev https://cloudflareinsights.com
 https://your-api-domain.example.com
 wss://your-api-domain.example.com;
 frame-src 'none';
 object-src 'none';
 base-uri 'self';
 form-action 'self';
```

---


- `SSE_CONNECTION_ISSUE_ANALYSIS.md` -
- `frontend/src/services/websocketClient.ts` - WebSocket
- `src/handlers/websocket-main.ts` - WebSocket
- `frontend/_headers` - Cloudflare Pages

---

****: 2025-10-14 17:40:00
****:
****:


1. **API ** - `healthData.configuration?.websocketEnabled` `healthData.websocketEnabled`
2. **CSP ** - `wss://` `connect-src`


- WebSocket 100%
- WebSocket 100%
- CSP
-
-


- ****:
- ****: WebSocket
- ****: < 300ms
