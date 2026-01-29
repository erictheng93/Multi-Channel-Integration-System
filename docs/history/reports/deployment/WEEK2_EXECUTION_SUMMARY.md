# Week 2

****: 2025-10-08
****: WebSocket 100% + SSE
****: Token

---

## Week 2

1. ** Rollout ** 50%
2. ** 75% Rollout** Token
3. ** 100% Rollout**
4. ** SSE **
5. ** SSE **

---


### 1.

**** (2025-10-08 15:02 UTC+8):
```json
{
 "rolloutPercentage": 50,
 "websocketEnabled": true,
 "sseEnabled": true,
 "durableObjectsAvailable": true,
 "allComponentsHealthy": true
}
```

****:
- Durable Objects: healthy
- WebSocket: healthy
- SSE: healthy
- KV Storage: healthy
- Database: healthy

### 2.


#### Bash
- `scripts/migrate-to-100-percent.sh`
- : Linux / Git Bash / WSL
- : 50% 75% 100%

#### PowerShell
- `scripts/migrate-to-100-percent.ps1`
- : Windows PowerShell
- : 50% 75% 100%

### 3. Token

 Token

- `GET_ADMIN_TOKEN_GUIDE.md`
- :
 - 1: DevTools ()
 - 2: API
 - ()
 -

### 4. SSE

 SSE

- `SSE_CODE_REMOVAL_DETAILED_PLAN.md`
- :
 - (120KB, 11 )
 -
 - 6 Phase23
 -
 -
 -
 -
 - 2-3

### 5.


- `SSE_CLEANUP_PLAN.md` -

---


### : Token

#### 1: ()

1. https://your-api-domain.example.com
2.
3. F12 DevTools
4. Application Local Storage `auth_token`
5. token
6. :
 ```powershell
 $env:ADMIN_TOKEN = "token"
 ```

#### 2: API

```powershell

$response = Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/auth/login" `
 -Method Post `
 -ContentType "application/json" `
 -Body '{"email":"admin@dacit.net","password":""}'

$env:ADMIN_TOKEN = $response.token
```


 Token PowerShell

```powershell
# token
echo $env:ADMIN_TOKEN


.\scripts\migrate-to-100-percent.ps1
```

****:
1. (50%)
2. 75%
3. 30
4. 100%
5.
6.

### ()

```powershell
$TOKEN = $env:ADMIN_TOKEN

# Step 1: 75%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" `
 -H "Authorization: Bearer $TOKEN" `
 -H "Content-Type: application/json" `
 -d '{"rolloutPercentage": 75}'

# Step 2:
curl "https://your-api-domain.example.com/api/websocket/migration-status"

# Step 3: 2-4 100%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" `
 -H "Authorization: Bearer $TOKEN" `
 -H "Content-Type: application/json" `
 -d '{"rolloutPercentage": 100, "migrationStrategy": "complete"}'

# Step 4:
curl "https://your-api-domain.example.com/api/websocket/migration-status"
```

---

## 100% Rollout

### (24-48 )

 SSE 100% Rollout


```powershell

Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/websocket/health" | ConvertTo-Json
Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/websocket/migration-status" | ConvertTo-Json
```


- WebSocket > 95%
- < 100ms (P95)
- < 0.1%
-
- Durable Objects

### SSE ()

 100% Rollout 24-48

#### Phase 1: Composables (Day 1 )

```bash
# : SSE_CODE_REMOVAL_DETAILED_PLAN.md - Phase 1
# Steps 1.1 - 1.5: SSE composables
```

#### Phase 2: Adapters (Day 1 )

```bash
# : SSE_CODE_REMOVAL_DETAILED_PLAN.md - Phase 2
# Steps 2.1 - 2.3: SSE adapters
```

#### Phase 3: Realtime Module (Day 1 )

```bash
# : SSE_CODE_REMOVAL_DETAILED_PLAN.md - Phase 3
# Steps 3.1 - 3.4: realtime module SSE components
```

#### Phase 4: Activity Stream (Day 1 )

```bash
# : SSE_CODE_REMOVAL_DETAILED_PLAN.md - Phase 4
# Steps 4.1 - 4.7: activity stream
```

#### Phase 5: SSE Monitoring (Day 2 )

```bash
# : SSE_CODE_REMOVAL_DETAILED_PLAN.md - Phase 5
# Steps 5.1 - 5.2: SSE monitoring
```

#### Phase 6: (Day 2 )

```bash
# : SSE_CODE_REMOVAL_DETAILED_PLAN.md - Phase 6
# Steps 6.1 - 6.2:
```

---


- ****: 11
- ****: ~120KB (~3500+ )
- ****: 50%
- ****: 40%


- **Backend Bundle**: 4% (~100KB)
- **Frontend Bundle**: 15% (~120KB)
- ****: 17% (~200ms)
- ****: 17% (~20MB)


- **TypeScript **: 17% (~2s)
- ****: 25% (~200ms)
- ****: 11% (~5s)

---


| | | | |
|------|------|------|---------|
| Token | | | token |
| Rollout | | | 50% |
| WebSocket | | | SSE |
| | | | Git + |


 100% Rollout

```powershell
# Rollout 50%
curl -X POST "https://your-api-domain.example.com/api/websocket/migration-config" `
 -H "Authorization: Bearer $ADMIN_TOKEN" `
 -H "Content-Type: application/json" `
 -d '{"rolloutPercentage": 50}'


curl "https://your-api-domain.example.com/api/websocket/migration-status"
```


```bash
# Git
git checkout HEAD~1 -- src/handlers/sse-monitoring-main.ts
git checkout HEAD~1 -- frontend/src/composables/useSSEMessages.ts
# ...


npm run deploy
cd frontend && npm run deploy:pages
```

---


1. **GET_ADMIN_TOKEN_GUIDE.md**
 - Token
 -
 -

2. **scripts/migrate-to-100-percent.sh**
 - Bash
 - 50% 75% 100%

3. **scripts/migrate-to-100-percent.ps1**
 - PowerShell
 - Windows

4. **SSE_CODE_REMOVAL_DETAILED_PLAN.md**
 - SSE
 - 23 6 Phase
 -


5. **SSE_CLEANUP_PLAN.md**
 - SSE

6. **PHASE2_MIGRATION_PLAN.md**
 - WebSocket

7. **PHASE2_EXECUTION_CHECKLIST.md**
 -

---


- [x] Rollout (50%)
- [x] Token
- [x] (Bash + PowerShell)
- [x] SSE
- [x]
- [x]

### ( Token)

- [ ] Token
- [ ] Rollout 75%
- [ ] 75% Rollout (2-4 )
- [ ] Rollout 100%
- [ ] 100% Rollout (24-48 )
- [ ] SSE (Phase 1-6)
- [ ]
- [ ]
- [ ]

---


1. WebSocket Rollout 100%
2. WebSocket
3. 24-48
4. SSE
5. ~120KB
6. 15-20%
7.
8.

---

****: Token
****: Token
****: 3-4 ()
****: DevOps Team
****: 2025-10-08 15:30 UTC+8
