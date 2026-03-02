# WebSocket

****: 2025-10-08
****: Claude Code (Automated)
****: Production (50% Rollout)
****: 100+ WebSocket , 75% rollout

---


- ****: 100
- ****: 60 ( 80.65 )
- **WebSocket **: `wss://your-api-domain.example.com/api/websocket/connect`
- ****: JWT Token ()
- ****: Node.js + ws (v8.18.3)


- **Cloudflare Workers**:
- **Durable Objects**: CONVERSATION_ROOM, USER_CONNECTION, MESSAGE_BROADCASTER
- ****: websocketAuth (query token)
- **Rollout **: 50%

---


### (100% )

| | | | |
|------|--------|--------|------|
| **** | 95% | **100.00%** | **** |
| **** | < 2% | **0.00%** | **** |
| **P95 ** | < 2000ms | **1795ms** | **** |
| **P99 ** | < 2000ms | **1933ms** | **** |
| **** | < 1500ms | **1409.88ms** | **** |

---


```
: 100
: 100
: 0
: 0
: 100.00%
```

****: 100,

### (ms)

| | (ms) | |
|------|-----------|------|
| | 1409.88 | |
| P50 () | 1403 | |
| P95 | 1795 | |
| P99 | 1933 | |
| | 958 | |
| | 1979 | |

****:
- 50% 1.4 ()
- 95% 1.8 ()
- 1.98 ,


```
: 1100
: 6050
: 13.64 msg/s
: 80.65
```

****: 13.64 ,(6050 vs 1100),


```
: 0
: 0.00%
```

****: ,

---


#### 1.
- ****: (-1757.49ms )
- ****: ,
- ****:

#### 2. P99
- ****: P99 1933ms, 2000ms
- ****: ,
- ****:
 - Durable Objects
 -
 - WebSocket


1. **100% **: ,
2. **0% **:
3. ****: 1.4
4. ****: 13.64 msg/s

---


 `LOAD_TESTING_GUIDE.md` **50% 75% Rollout **:

| | | | |
|------|------|----------|------|
| 100+ | | 100 | **** |
| | > 95% | 100.00% | **** |
| P95 | < 300ms | | **** |
| P95 | < 2000ms | 1795ms | **** |
| | < 2% | 0.00% | **** |
| | | | **** |

### : **A ()**

****:
-
-
- ()
- ** 75% Rollout **

---


### ()

1. ** 75% Rollout**
 -
 -

### ()

2. ****
 -
 -

3. ** P99 **
 - Durable Objects
 -

4. ****
 -
 -

### ()

5. ** 200+ **
 - 75% 90% rollout
 -

6. ****
 - CI/CD pipeline
 -

---


### 1: WebSocket ()
****: WebSocket 401
****: `/api/websocket` `websocketHealthApp` , `websocketMainHandler` `/connect`
****:
- `src/index.ts` `websocketMainHandler`
-
- `websocket-analytics` `websocket`

****:
- `src/index.ts`: Line 130-133 ()
- `src/core/route-config.ts`: Line 250-259 ( websocket )
- `src/core/route-config.ts`: Line 266 ()

****: 100%

---


- **Worker Version**: 64c94ba3-93d6-4f9c-bb4c-87c6270260b5
- ****: 2025-10-08 06:10:09 UTC
- **Node.js**: v18+
- **ws **: 8.18.3

### Cloudflare
- **Durable Objects**: 6 bindings
- **KV Namespaces**: SESSIONS, CACHE
- **D1 Database**: mcis-db
- **R2 Bucket**: mcis-files
- **Queue**: realtime-events

---


 WebSocket 100 ****,:

1. **100% ** -
2. **0% ** -
3. **** - P95
4. **** - 13.64 msg/s

 **75% Rollout **

---

****: 2025-10-08 14:13 (UTC+8)
****: Claude Code Automated Testing
****:
- `scripts/LOAD_TESTING_GUIDE.md`
- `WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md`
