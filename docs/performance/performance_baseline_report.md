# WebSocket vs SSE
## : 2025-10-08


```yaml
: Production
WebSocket : true
SSE : true
Rollout : 50%
: ~4 days ago
```


```json
{
 "durableObjects": " healthy",
 "websocket": " healthy",
 "sse": " healthy",
 "kv": " healthy",
 "database": " healthy"
}
```


#### WebSocket
- (Connection Establishment Time)
- (Average Message Latency)
- (Connection Duration)
- (Error Rate)
- (CPU/Memory per connection)
- (Concurrent Connections)

#### SSE
-
-
-
-
-
-


#### 1: Cloudflare Analytics Dashboard
```
: Cloudflare Dashboard > Workers & Pages > multi-channel-platform > Analytics
:
-
-
- CPU
- P50/P75/P99
```

#### 2: Cloudflare Logs (Logpush)
```bash
# Logpush
wrangler logpush create --service-name=multi-channel-platform

# wrangler tail
wrangler tail multi-channel-platform --format=pretty
```

#### 3:
```
:
- /api/websocket/dashboard/metrics ()
- /api/websocket/dashboard/connections
- /api/websocket/dashboard/history
```

#### 4: Performance API
```javascript
// (RUM)
performance.measure('websocket-connect', 'ws-start', 'ws-connected');
performance.measure('sse-connect', 'sse-start', 'sse-connected');
```


```
: 357 seconds (~6 minutes between checks)
: (dashboard endpoint unavailable)
:
: 0% ()
```


```
SSE :
SSE : (10)
SSE : readyState = 1 (OPEN)
: <3 seconds
:
```


1. **WebSocket **
 - 50% rollout WebSocket
 - WebSocket
 - WebSocket

2. ****
 - WebSocket vs SSE
 -
 -

3. ****
 - WebSocket
 - SSE
 -


1. ****
 - 100+
 -
 - Durable Objects

2. ****
 - (Time to First Message)
 -
 -


#### 1.
```typescript
// src/index.ts
import { jwtAuth } from './middleware/auth';

app.use('/api/websocket/dashboard/*', jwtAuth);
app.route('/api/websocket/dashboard', websocketDashboardApp);
```

#### 2. Cloudflare Analytics
```bash
# Cloudflare Dashboard
# Workers & Pages > multi-channel-platform > Settings > Analytics
```

#### 3.
```javascript
//
const trackConnectionPerformance = (type: 'websocket' | 'sse', duration: number) => {
 //
 console.log(`[Perf] ${type} connection: ${duration}ms`);
};
```


#### 1.
```bash
# k6 Artillery
# 100+ WebSocket
```

#### 2. 7
```


```

#### 3. A/B
```
 WebSocket SSE :
-
-
-
```


| | WebSocket () | SSE () | |
|------|-----------------|------------|------|
| | 100-200ms | 150-300ms | |
| | 10-50ms | 100-500ms | |
| | | | |
| | | | |
| | | | |
| | | | |


 ****


```
 50% Rollout

 7-14


 / \
 / \


75%


100%
```


```yaml
 rollout :
 - < 2%
 - WebSocket > 95%
 - > 30%
 -
 - Durable Objects
```


-
-
-
-


1.
2.
3.


** 7-14 rollout **

---
: Claude Code
: 1.0
: 7 days
