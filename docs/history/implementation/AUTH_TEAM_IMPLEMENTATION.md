

 ** (Day 4-7)** multi-channel-platform MVP


### 1. JWT


- **JWT **: HS256
- ****: SHA-256
- ****: Cloudflare KV
- **Token **: 24 JWT Token

#### API
```typescript
POST /api/auth/login //
POST /api/auth/register // admin
POST /api/auth/logout //
GET /api/auth/profile //
```


- SHA-256
- JWT
-
-

### 2.


- ** CRUD**:
- ****:
- **QR Code **: QR Code
- ****:

#### API
```typescript
GET /api/teams //
POST /api/teams // admin only
GET /api/teams/:id //
PUT /api/teams/:id // admin only
DELETE /api/teams/:id // admin only
GET /api/teams/:id/members //
GET /api/teams/:id/stats //
POST /api/teams/:id/qr-code // QR Code
GET /join?team=<qr_code> // QR Code
```


-
- admin/agent
-
- QR Code

### 3.


- **JWT **: `jwtAuth`
- ****: `sessionAuth`
- ****: `requireRole('admin'|'agent')`
- ****: `requireTeamAccess()`
- ****: `optionalAuth`
- **API Key **: `apiKeyAuth`
- ****: `rateLimit(maxRequests, windowMs)`


```typescript
//
- admin:
- agent:

//
-
- admin
-
```

### 4.

#### (users)
```sql
- id:
- username:
- email:
- password_hash:
- display_name:
- role: admin/agent
- team_id: ID
- is_active:
- created_at/updated_at:
```

#### (teams)
```sql
- id:
- name:
- description:
- qr_code: QR Code
- is_active:
- created_at/updated_at:
```

### 5.

#### (`src/utils/auth.ts`)
- `signJWT()`: JWT
- `verifyJWT()`: JWT
- `hashPassword()`:
- `verifyPassword()`:
- `createUser()`:
- `authenticateUser()`:
- `createSession()`:
- `getSession()`:

#### (`src/utils/team.ts`)
- `createTeam()`:
- `getTeamById()`:
- `updateTeam()`:
- `deleteTeam()`:
- `getTeamMembers()`:
- `generateTeamQRCode()`: QR Code
- `getTeamStats()`:


- `test-auth-team.js`:
- `quick-test.js`:


- /
- JWT Token
-
- CRUD
- QR Code
-
-


### Cloudflare
```jsonc
// wrangler.jsonc
{
 "kv_namespaces": [
 {
 "binding": "SESSIONS",
 "id": "sessions_kv_namespace"
 },
 {
 "binding": "CACHE",
 "id": "cache_kv_namespace"
 }
 ]
}
```


```bash

wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put JWT_SECRET


wrangler secret put API_KEY
```


- `setup-cloudflare-services.js`: Cloudflare


### API
- ** API**: 4
- ** API**: 8
- ****: 7
- ****: 20+


- JWT
-
-
-
-
-


- users:
- teams:
-
-


### (Day 8-12)
-
-
-
- LINE OA


- API < 200ms
-
-
-


- JWT
-
- QR Code
-


-
- JWT Token
- API
-


** multi-channel-platform MVP **


-
-
-
- QR Code
-

****