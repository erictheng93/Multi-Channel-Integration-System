# QR Code
****: 2025-09-30
****: QR Code

---


1. QR Code
2. API 42
3.
4.


1. ** **: QR Code
2. ** **:
3. ** **:

---


### 2.1
```
 (src/index.ts)
 GET /api/qr-codes/health ()
 /api/qr-codes/* qrCodeRouter
 GET / ()
 POST / ()
 GET /:id ()
 PUT /:id ()
 DELETE /:id ()
 ... ( 37 )
```

### 2.2
- ****: 42
- ****: 34
- ****: 8
- ****: 12

### 2.3
```
 :
 5 HTTP
 :

```

****: 5 Hono GET/POST/PUT/DELETE

---


### 3.1
```bash
$ curl http://localhost:8787/api/qr-codes/health
{"error":"Missing or invalid authorization header"}

$ curl -H "Authorization: Bearer test123" http://localhost:8787/api/qr-codes/health
{"error":"Authentication failed"}
```

### 3.2


1. **** (`src/modules/qrcode/handlers/index.ts:19`)
 - `qrCodeRouter.get('/health', qrCodeMainHandler.health)`
 -

2. **** (`src/modules/qrcode/handlers/qrcode-main.ts:454-473`)
 - ****
 -

3. **** (`src/modules/qrcode/middleware/qrcode-auth.ts:15-36`)
 - `qrCodeAuthMiddleware` `userId`
 - 401
 - ****

4. **** (`src/index.ts:188-285`)
 - `app.use('*', ...)`
 - API
 -

5. **Hono **
 - `app.route('/api/qr-codes', qrCodeRouter)`
 -
 - `app.get('/api/qr-codes/health', ...)`
 - `/health`


****:
- QR Code `userId`
- /

### 3.3

#### A:
****: `src/index.ts:372-399`

```typescript
// QR Code
app.get('/api/qr-codes/health', async (c) => {
 try {
 const dbCheck = await c.env.DB.prepare('SELECT 1').first();
 return c.json({
 success: true,
 data: {
 status: 'healthy',
 module: 'qrcode',
 version: '2.0.0',
 timestamp: new Date().toISOString(),
 services: {
 database: dbCheck ? 'connected' : 'disconnected',
 cache: c.env.KV ? 'available' : 'unavailable',
 storage: c.env.R2_BUCKET ? 'available' : 'unavailable'
 }
 },
 message: 'QRCode module is healthy'
 }, 200);
 } catch (error) {
 return c.json({
 success: false,
 error: 'Health check failed'
 }, 503);
 }
});
```

#### B:
****: `src/modules/qrcode/handlers/index.ts:18-19`

```typescript
// src/index.ts
// qrCodeRouter.get('/health', qrCodeMainHandler.health);
```


---


### 4.1 Conversations
```bash
$ curl http://localhost:8787/api/conversations/health
{"status":"healthy","timestamp":"2025-09-30T05:14:58.059Z","module":"conversations","version":"1.0.0"}
```
****:

### 4.2 System
```bash
$ curl http://localhost:8787/api/system/health
{"status":"healthy","timestamp":"2025-09-30T05:10:15.649Z","database":"connected","version":"1.0.0"}
```
****:

### 4.3
-
- QR Code
-

---


### 5.1
****: `scripts/verify-qrcode-routes.ts`

1. 42
2.
3.
4.
5.

### 5.2
```
QR Code

 :
 5

 :


 42
 - : 34
 - : 8
 - : 12
```

### 5.3
1. ****: HTTP
2. ****: `testRoute()` `runTests()`
3. ****: `generateReport()` Markdown

---


### 6.1
1. ** **
 ```bash
 # (Ctrl+C)
 npm run dev
 ```

2. ** **
 ```bash
 curl http://localhost:8787/api/qr-codes/health
 # : {"success":true,"data":{"status":"healthy",...}}
 ```

3. ** **
 - `QRCODE_MIGRATION_TO_COMPLETE_VERSION.md`
 - API

### 6.2
1. ****
 -
 -

2. ****
 -
 -
 -

3. ****
 -
 -
 - CI/CD

### 6.3
1. ****
 -
 -
 -

2. ****
 -
 -
 -

---


### 7.1 Hono
- `app.get('/path', handler)`
- `app.route('/prefix', subRouter)`
- ****:
- ****: ****

### 7.2
**QR Code Auth Middleware** (`src/modules/qrcode/middleware/qrcode-auth.ts:15-36`)

```typescript
export async function qrCodeAuthMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
 const userId = (c as any).get('userId');
 if (!userId) {
 return errorResponse(c, 'Authentication required', 401);
 }
 await next();
}
```

- `userId`
- 401
- **** `qrCodeRouter.use(qrCodeAuthMiddleware)`

### 7.3
| | | | |
|---------|---------|------|---------|
| "Missing or invalid authorization header" | `src/middleware/auth.ts` | 73 | JWT Authorization header |
| "Authentication required" | `src/modules/qrcode/middleware/qrcode-auth.ts` | 23 | QR Code userId |
| "Authentication failed" | `src/modules/qrcode/middleware/qrcode-auth.ts` | 34 | QR Code |

****: "Missing or invalid authorization header"
****: `src/middleware/auth.ts` JWT

****:
1. JWT `/api/*`
2. QR Code JWT
3. Hono

****:

---


### 8.1

| | | | | | |
|------|------|-----------|-------------|-------------|------|
| System | `/api/system/health` | 200 OK | N/A | N/A | |
| Conversations | `/api/conversations/health` | 200 OK | N/A | N/A | |
| Customers | `/api/customers/health` | | | | |
| QR Code () | `/api/qr-codes/health` | 401 Unauthorized | 401 Unauthorized | 401 Unauthorized | |
| QR Code () | `/api/qr-codes/health` | | | | |

### 8.2

| | | | | | |
|---------|---------|-----------|-------------|-------------|---------|
| | `POST /api/qr-codes/:id/scan` | | | | 200 OK / 200 OK / 200 OK |
| | `GET /api/qr-codes/:id` | | | | 401 / 200 OK / 401 |
| | `POST /api/qr-codes` | | | | 401 / 201 Created / 401 |
| | `PUT /api/qr-codes/:id` | | | | 401 / 200 OK / 401 |
| | `POST /api/qr-codes/admin/cleanup` | | | | 401 / 200 OK (admin) / 403 (non-admin) |

---


### 9.1
1. ****: QR Code
2. ****: `/health`
3. ****:

### 9.2
- src/index.ts:372-399
- src/modules/qrcode/handlers/index.ts:19
-

### 9.3
- [ ]
- [ ] `curl http://localhost:8787/api/qr-codes/health`: 200 OK
- [ ] `/scan/:id`
- [ ] `GET /:id`
- [ ]
- [ ]

### 9.4
| | | | |
|------|-------|------|---------|
| | | | |
| | | | |
| | | | |
| | | | |

---


### A.
1. `src/index.ts:372-402` - QR Code
2. `src/modules/qrcode/handlers/index.ts` - QR Code
3. `src/modules/qrcode/handlers/qrcode-main.ts:454-473` -
4. `src/modules/qrcode/middleware/qrcode-auth.ts` - QR Code
5. `src/middleware/auth.ts` - JWT
6. `scripts/verify-qrcode-routes.ts` -
7. `docs/reports/QRCODE_MIGRATION_TO_COMPLETE_VERSION.md` - QR Code

### B.
```bash

curl http://localhost:8787/api/qr-codes/health


curl http://localhost:8787/api/system/health


curl http://localhost:8787/api/conversations/health


curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8787/api/qr-codes/


npx tsx scripts/verify-qrcode-routes.ts
```

### C.
- [Hono ](https://hono.dev/api/routing)
- [Hono ](https://hono.dev/guides/middleware)
- CLAUDE.md - QR Code

---

****: Claude Code
****:
****: 