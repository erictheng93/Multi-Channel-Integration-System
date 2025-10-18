# WebSocket

> **5 WebSocket** -


- [x] Durable Objects
- [x]
- [x]
- [x] Dashboard
- [x]

---

## (3 )

### Step 1:

```bash
# 1.
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 2.
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# 3.
bash test-websocket-migration.sh
```

****: 200

---

### Step 2: (5% )

#### A: ( )

1. : `https://your-domain.com/admin/websocket`
2. WebSocket
3. `5`
4.

#### B: API

```bash
# Admin Token
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
 -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "enableWebSocket": true,
 "enableSSE": true,
 "migrationStrategy": "gradual",
 "rolloutPercentage": 5
 }'
```

****: 5% WebSocket

---

### Step 3:

```bash
# 1. Dashboard
https://your-domain.com/monitoring/websocket

# 2. (24 )
-
- (: < 1%)
- (: < 200ms)

# 3.
Day 1: 5% 24
Day 2: 10% 24
Day 4: 25% 24
Day 7: 50% 48
Day 10: 100%
```

---


| | | | | |
|-----|------|------|------|------|
| **** | < 0.1% | < 1% | < 5% | 5% |
| **** | < 100ms | < 200ms | < 500ms | 500ms |
| **** | > 99.9% | > 99% | > 95% | < 95% |

---


```bash

curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health | jq


curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status | jq


curl https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics | jq
```


```bash

export ADMIN_TOKEN="your-admin-jwt-token"
export API_URL="https://multi-channel.imfinethankyouandyou.com/api"

# WebSocket (10% )
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"enableWebSocket": true, "rolloutPercentage": 10}' | jq

# 50%
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"rolloutPercentage": 50}' | jq

# (100%)
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"rolloutPercentage": 100}' | jq
```


```bash
# WebSocket SSE
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{
 "enableWebSocket": false,
 "enableSSE": true,
 "rolloutPercentage": 0
 }' | jq
```

---


### 1:

```bash
# 1.
curl $API_URL/websocket/health | jq '.errorRate'

# 2. > 5%
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"rolloutPercentage": 5}'

# 3.
wrangler tail --format pretty
```

### 2:

```bash
# 1.
curl $API_URL/websocket/health | jq '.averageLatency'

# 2. > 500ms Durable Objects
curl $API_URL/websocket/metrics | jq

# 3.
```

### 3:

```bash
# 1. fallback
curl $API_URL/websocket/migration-status | jq '.enableSSE'

# 2. true
# 3. false
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"enableSSE": true}'
```

---

## Dashboard


```
https://your-domain.com/monitoring/websocket
```


```

 /
 1,234 456
 +15%


 45ms 0.02%


```


- 5
-


- ****: < 1%, < 200ms
- ****: 1-5%, 200-500ms
- ****: > 5%, > 500ms

---


1. ****: 5%
2. ****: 24
3. ** fallback**: SSE
4. ****: Dashboard
5. ****:


1. 100%
2. SSE fallback
3.
4.
5.

---


- [](./WEBSOCKET_MIGRATION_GUIDE.md)
- [](./test-websocket-migration.sh)
- [](https://your-domain.com/admin/websocket)
- [ Dashboard](https://your-domain.com/monitoring/websocket)

---


- [ ]
- [ ] Dashboard
- [ ] WebSocket > 95%
- [ ] < 1%
- [ ] < 200ms
- [ ] SSE fallback
- [ ]
- [ ]

---

****

```bash

bash test-websocket-migration.sh

# 5% WebSocket
curl -X POST $API_URL/websocket/migration-config \
 -H "Authorization: Bearer $ADMIN_TOKEN" \
 -d '{"enableWebSocket": true, "rolloutPercentage": 5}' | jq

# Dashboard
open https://your-domain.com/monitoring/websocket
```

---

****: 2025-10-08
****: 1.0.0
****:
