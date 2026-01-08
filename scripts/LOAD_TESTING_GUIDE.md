# WebSocket


`websocket-load-test.js` WebSocket


- **100+ ** -
- **** - P50/P95/P99
- **** -
- **** -
- **** -
- **** - JWT Token
- **** -


```bash
# ws
npm install ws
```


```bash
# 100 60
node scripts/websocket-load-test.js

# 200 120
node scripts/websocket-load-test.js 200 120

# 50 30
node scripts/websocket-load-test.js 50 30
```


### 1.
```bash
# 50
node scripts/websocket-load-test.js 50 60
```
****
- > 98%
- P95 < 500ms
- P95 < 200ms
- < 1%

### 2. (100 )
```bash
# 100 rollout
node scripts/websocket-load-test.js 100 90
```
****
- > 95%
- P95 < 1000ms
- P95 < 300ms
- < 2%

### 3. (200+ )
```bash
# 200
node scripts/websocket-load-test.js 200 120
```
****

### 4.
```bash
# 300
node scripts/websocket-load-test.js 300 60
```
****


```


 : 100
 : 98
 : 2
 : 98.00%

 (ms)
 : 245.32
 P50: 220
 P95: 450
 P99: 650


 : 1200
 : 1195
 : 20.00 msg/s

 (ms)
 : 85.21
 P50: 75
 P95: 180
 P99: 320

```


#### 1.
- ****: 95%
- ****: 90-95%
- ****: < 90%

#### 2. P95
- ****: < 1000ms
- ****: 1000-2000ms
- ****: > 2000ms

#### 3. P95
- ****: < 200ms
- ****: 200-500ms
- ****: > 500ms

#### 4.
- ****: < 2%
- ****: 2-5%
- ****: > 5%


#### 1.
****
- Durable Objects
-
- Token

****
```bash

curl https://your-api-domain.example.com/api/websocket/health

# Dashboard metrics
curl -H "Authorization: Bearer $TOKEN" \
 https://your-api-domain.example.com/api/websocket/dashboard/metrics
```

#### 2.
****
- Durable Objects CPU
- KV
-

****
- Durable Objects
- KV
- Cloudflare

#### 3.
****
- WebSocket
-
- Durable Objects

****
```bash

wrangler tail multi-channel-platform --format=pretty

# Durable Objects
curl -H "Authorization: Bearer $TOKEN" \
 https://your-api-domain.example.com/api/websocket/dashboard/durable-objects
```


### Week 1:
```bash
# Day 1:
node scripts/websocket-load-test.js 50 60

# Day 3:
node scripts/websocket-load-test.js 100 90

# Day 5:
node scripts/websocket-load-test.js 150 120
```

### Week 2:
```bash
# 5
node scripts/websocket-load-test.js 100 300

# 10
node scripts/websocket-load-test.js 100 600
```

### Week 3:
```bash

node scripts/websocket-load-test.js 200 120
node scripts/websocket-load-test.js 300 120
node scripts/websocket-load-test.js 500 120
```


 `WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md`

### 50% 75% Rollout
- 100+
- > 95%
- P95 < 300ms
- < 2%
-

### 75% 90% Rollout
- 200+
- > 97%
- P95 < 250ms
- < 1%

### 90% 100% Rollout
- 300+
- > 98%
- P95 < 200ms
- < 0.5%


 `scripts/websocket-load-test.js` `CONFIG`

```javascript
const CONFIG = {
 WS_URL: 'wss://your-api-domain.example.com/ws',
 CONNECTION_TIMEOUT: 10000, // (ms)
 PING_INTERVAL: 30000, // (ms)
 MESSAGE_INTERVAL: 5000, // (ms)
};
```


```markdown
## WebSocket

****: 2025-10-08
****: [Name]
****: Production (50% Rollout)


- : 100
- : 60
- WebSocket URL: wss://your-api-domain.example.com/ws


- : 98%
- P95 : 450ms
- P95 : 180ms
- : 2%


- [ / / ] Rollout
- []


- []
```


1. ****
2. **** ( > 10%)
 ```bash
 #
 ./scripts/emergency-rollback.sh 50
 ```
3. ****
 ```bash
 #
 wrangler tail multi-channel-platform

 #
 curl https://your-api-domain.example.com/api/websocket/health
 ```
4. ****
5. ****

---

****: 2025-10-08
****: Technical Team
****: WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md, ROLLOUT_STRATEGY_EVALUATION.md
