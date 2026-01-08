

 SSE Cloudflare Queue


### 1. **Cloudflare Queue **
- `wrangler.toml` `REALTIME_QUEUE`
- batch_size=5, batch_timeout=1s
- ****: `wrangler deploy`

### 2. ****
- `src/types/events.ts` -
- `src/handlers/realtime-queue.ts` -
- `src/handlers/realtime-v2.ts` - SSE
- `test-event-driven-push.js` -

### 3. ****
- `src/types/index.ts` - REALTIME_QUEUE
- `src/handlers/conversation.ts` -
- `src/handlers/webhook.ts` - LINE
- `src/index.ts` -

### 4. ****

```bash
# 1. TypeScript
npm run build

# 2.
npm run test

# 3. Lint
npm run lint:check

# 4.
npm run deploy
```


### ** ()**
```
 SSE 3
: 0-3 +
```

### ** ()**
```
 + SSE
: <100ms
```


| | | | |
|------|--------|--------|------|
| | 0-3 | <100ms | **95%** |
| | 3 | | **90%** |
| | | | **80%** |
| | | | **** |


### 1. ****
```bash

npm run test

# SSE
npm run test -- --grep "SSE|message|realtime"
```

### 2. ****
1.
2. : `test-event-driven-push.js`
3. JWT token ID
4.

### 3. ****
```bash

wrangler tail --env production

# SSE
curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://your-api-domain.example.com/api/realtime/conversation/1/status
```


### ****
1. ****: Cloudflare Queue
2. ****: SSE
3. ****:

### ****
- < 1
- SSE < 1000
- < 0.1%

### ****


```bash
# 1. realtime handler
# src/index.ts:
# import { realtimeHandler } from './handlers/realtime';
# app.get('/api/realtime/sse', realtimeHandler.sse);

# 2.
wrangler deploy
```


### ****

- `JWT_SECRET`
- `DB` (D1 Database)
- `SESSIONS` (KV Namespace)
- `REALTIME_QUEUE` ( Queue )

### ****


```toml
# wrangler.toml
[[queues.consumers]]
queue = "realtime-events"
max_batch_size = 5 # 1-100
max_batch_timeout = 1 # 1-30
```


### ****
- ` [Message] Event queued for message X` -
- ` [SSE Manager] Connection registered` - SSE
- ` [Queue Handler] Event X pushed to Y connections` -

### ****
```bash

wrangler queues list


wrangler tail --env production --format pretty
```


1. ****
 - [ ] SSE
 - [ ] <1
 - [ ]
 - [ ]

2. ****
 - [ ] < 500ms
 - [ ] SSE
 - [ ]

3. ****
 - [ ]
 - [ ]
 - [ ]


- ****: LINE
- ****:
- ****:
- ****:

