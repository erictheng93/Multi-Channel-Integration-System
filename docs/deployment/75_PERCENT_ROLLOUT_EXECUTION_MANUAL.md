# 75% Rollout

****: 1.0.0
****: 2025-10-08
****: 2025-10-15 ()
****: 2-3
****: + DevOps +

---


 **50% WebSocket Rollout** **75% Rollout**


:

| | | | |
|---------|------|--------|------|
| 50% Rollout 7 | 3/7 | DevOps | Day 3 |
| 100 | | System Admin | 2025-10-08 |
| 200 | | DevOps | **** |
| | | Frontend Team | **** |
| | | DevOps | **** |
| | | DevOps | **** |
| | | Team Lead | **** |
| 7 < 2% | | DevOps | |


| | | | |
|------|--------|------|----------|
| | | | |
| | | | P95/P99 |
| Durable Objects | | | DO |
| | | | |

---


### Phase 1: (T-60)

#### 1.1

****: T-60
****:

****:
- ****: ___________ ()
- ****: ___________ ()
- ****: ___________ ()
- ****: ___________ ()

****:
- Slack #deployment-war-room
-
-

#### 1.2

****: T-55

```bash
# 1. API
curl https://multi-channel.imfinethankyouandyou.com/api/health/health

# 2. WebSocket
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 3. rollout
curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config

# 4.
curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/connections
```

****:
- API : `status: "healthy"`
- WebSocket : `status: "healthy"`
- rollout: `rolloutPercentage: 50`
- : > 10 ()

****:
- ****,
-
-

#### 1.3

****: T-50

```bash

curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/backup-config


curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/backup-config/latest
```

****:
- rolloutPercentage: 50
- enableWebSocket: true
- enableSSE: true
- migrationStrategy: "gradual"

#### 1.4 200 ()

****: T-45
****: 20

****: ,

```bash
# 200 (90 )
node scripts/websocket-load-test.cjs 200 90
```

****:
- 95%
- < 2%
- P95 < 2000ms
- P99 < 500ms

****:
- ****
-
-
-

#### 1.5

****: T-30

****:
- (Slack #general):
 ```
 WebSocket 75% Rollout 30
 : []
 : ()
 : [URL]
 ```
- (SMS/Email):
 ```
 WebSocket 75% Rollout Starting
 Time: [Time]
 Monitor: [Dashboard URL]
 Stay on standby for the next 2 hours.
 ```

#### 1.6

****: T-25

**** ():
1. : `https://multi-channel.imfinethankyouandyou.com/websocket-monitoring`
2. Analytics : `https://multi-channel.imfinethankyouandyou.com/websocket-analytics`
3. : `https://multi-channel.imfinethankyouandyou.com/api/health/health`
4. Cloudflare Analytics: `https://dash.cloudflare.com`

****:
- > 3%
- > 10%
- unhealthy

#### 1.7

****: T-20

**** (Dry Run):
```powershell
# Windows PowerShell
.\scripts\emergency-rollback.ps1 -RollbackLevel safe -WhatIf

# Bash ( WSL/Git Bash)
bash scripts/emergency-rollback.sh safe --dry-run
```

****:
-
- API
-
- Dry-run

****:
- ****,
-

#### 1.8

****: T-10

**Go/No-Go **:
-
-
-
- (200 )
-
-
-
-

****:
- **GO**: ,
- **NO-GO**: ,

---

### Phase 2: (T-0)

#### 2.1 Rollout

****: T+0
****:

** 1: API ** ()
```bash
# Token
TOKEN=$(curl -s -X POST \
 https://multi-channel.imfinethankyouandyou.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@dacit.net","password":"16011587DaC"}' \
 | grep -o '"token":"[^"]*' | sed 's/"token":"//')

# Rollout 75%
curl -X PUT \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 75,
 "enableWebSocket": true,
 "enableSSE": true,
 "migrationStrategy": "gradual",
 "updateReason": "Planned rollout increase from 50% to 75%",
 "updateTimestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
 }'
```

** 2: **
1. WebSocket Admin Dashboard
2. "Migration Config"
3. Rollout Percentage: 50 75
4. "Update Configuration"
5.

****:
```bash
curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config \
 | grep rolloutPercentage
```

****:
```json
{
 "rolloutPercentage": 75,
 "enableWebSocket": true,
 "enableSSE": true,
 "migrationStrategy": "gradual"
}
```

****:
- API ( 3 )
- ,
- API

#### 2.2 (T+1)

****:

** 30 ** ( 5 ):
```bash

curl https://multi-channel.imfinethankyouandyou.com/api/health/health | jq '.status'


curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/metrics?period=1m \
 | jq '.errorRate'


curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/connections \
 | jq '.activeConnections'
```

****:
- : `"healthy"` `"degraded"` ()
- : < 3%
- : ( 50% 75% )

****:
- > 5%:
- 3-5%: rollout,
- "unhealthy":
- :

---

### Phase 3: (T+5 ~ T+2)

#### 3.1 15 (T+5 ~ T+20)

****: 2

****:
1. ****
 ```bash
 curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/metrics?period=5m
 ```
 - : 95%
 - : < 95%
 - : < 90%

2. ****
 - : < 2%
 - : 2-3%
 - : > 3%

3. ****
 - : < 200ms
 - : 200-300ms
 - : 300-500ms
 - : > 500ms

4. **P95 **
 - : < 1500ms
 - : 1500-2000ms
 - : > 2000ms

****:
```
[T+5] : 98.5% | : 1.2% | : 150ms
[T+7] : 97.8% | : 1.5% | : 165ms
[T+9] : 98.1% | : 1.3% | : 142ms
[T+11] : 98.6% | : 0.9% | : 138ms
[T+13] : 99.2% | : 0.7% | : 145ms
[T+15] : 98.9% | : 1.1% | : 152ms
[T+17] : 98.4% | : 1.4% | : 149ms
[T+20] : 98.7% | : 1.0% | : 146ms
```

#### 3.2 (T+20 ~ T+60)

****: 5

****:
-
-
-
- P95/P99
-
- Durable Objects

**** ( `config/alert-thresholds.json`):
- **Critical**:
 - < 90% ( 5 )
 - > 5% ( 5 )
 - "unhealthy" ( 1 )

- **High**: rollout,
 - < 95% ( 3 )
 - > 3% ( 3 )
 - > 500ms ( 5 )

- **Medium**:
 - < 98% ( 2 )
 - > 2% ( 2 )
 - > 300ms ( 3 )

#### 3.3 (T+60 ~ T+120)

****: 10

****:
- 1 High Critical
- < 2%
- 95%
-

****:
-
-
-

****:
-
-
-

---

### Phase 4: ()

#### 4.1

**** ():
- "unhealthy" > 1
- > 5% > 5
- < 90% > 5
-

**** ():
- 3-5% > 10
- 90-95% > 10
- P95 > 2000ms > 10

#### 4.2

** 1: ** ()
```powershell
# Windows PowerShell
.\scripts\emergency-rollback.ps1 -RollbackLevel safe

# rollout 75% 50%
```

** 2: API **
```bash
curl -X PUT \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "rolloutPercentage": 50,
 "enableWebSocket": true,
 "enableSSE": true,
 "migrationStrategy": "gradual",
 "rollbackReason": "Emergency rollback due to [REASON]"
 }'
```

** 3: SSE** ()
```powershell
.\scripts\emergency-rollback.ps1 -RollbackLevel emergency
```

#### 4.3

**** ( 1 ):
```bash
# 1.
curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config

# 2.
curl https://multi-channel.imfinethankyouandyou.com/api/health/health

# 3.
curl -H "Authorization: Bearer $TOKEN" \
 https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/metrics?period=1m
```

**** ( 15 ):
- 2
-
-

****:
```

Rollback Level: [safe/emergency]
 75% [50%/0%]
: []
: []
: []
```

---


#### 1.
-
-
-
-

****:
```markdown
# 75% Rollout


- : YYYY-MM-DD
- : HH:MM - HH:MM
- : []


- / /
- Rollout: XX%
- : /


- : XX%
- : XX%
- : XXms
- P95 : XXms


[]


[]


[90% rollout ]
```

#### 2.
```
 75% Rollout

: []
: /
 Rollout: 75%
: /
: 7, 90% rollout

: []
```

### 7

#### 3.
-
-
-
-

#### 4. (Day 7)
- 7
- 90% rollout
-

---


#### 1:

****: 1% 5%

****:
1. Cloudflare
2. Durable Objects
3.
4.

****:
- Cloudflare : Cloudflare
- DO : DO
- : , rollout

#### 2:

****: P95 > 2500ms

****:
1. DO
2.
3.

****:
- DO :
- : CDN
- :

#### 3:

****:

****:
1. Admin Dashboard
2. Rollout Percentage
3. curl API
4.

---


| | | | Email | |
|------|------|------|-------|------|
| | ___ | +886-XXX | admin@dacit.net | |
| DevOps Lead | ___ | +886-XXX | devops@dacit.net | |
| | ___ | +886-XXX | oncall@dacit.net | 24/7 |


- ****: `WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md`
- ****: `scripts/LOAD_TESTING_GUIDE.md`
- ****: `config/alert-thresholds.json`
- ****: https://multi-channel.imfinethankyouandyou.com/websocket-monitoring

---


### (T-60)
- [ ]
- [ ]
- [ ]
- [ ] 200 ()
- [ ]
- [ ]
- [ ]
- [ ] Go/No-Go : **GO**

### (T+0)
- [ ] Rollout
- [ ]
- [ ]

### (T+5)
- [ ] (15 )
- [ ] (1 )
- [ ] (2 )
- [ ]
- [ ]

---

****: 1.0.0
****: 2025-10-08
****: Claude Code Automated Documentation
