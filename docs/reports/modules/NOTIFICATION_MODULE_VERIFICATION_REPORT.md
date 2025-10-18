# (Notifications)

****: 2025-09-30
****: ****

---


### 1.
****: ****

- ****:
 - `src/modules/notifications/` -
 - handlers, services, repositories, adapters, types, utils

- ****:
 - : `/api/notifications`
 - : `notification-router.ts` (Hono app )
 - : `src/index.ts:451`
 - : `src/core/route-config.ts:152-159`

- ****:
 - Database (D1)
 - KV Namespace (CACHE)
 - NotificationChannelService
 - NotificationValidator

****:
```bash


```

---

### 2. SSE 404
****: ****

****: SSE 404

****:

#### SSE :
1. **SSE **
 - : `GET /api/notifications/sse`
 - : ()
 - : SSE

2. **SSE **
 - : `GET /api/notifications/sse/stats`
 - : ()
 - : SSE

3. **SSE **
 - : `POST /api/notifications/sse/send`
 - : ()
 - : SSE

4. **SSE **
 - : `POST /api/notifications/sse/broadcast`
 - : ()
 - :

5. **SSE **
 - : `POST /api/notifications/sse/cleanup`
 - : ()
 - :

6. **SSE **
 - : `GET /api/notifications/sse/connections/count`
 - : ()
 - :

**SSE **:
- : `src/modules/notifications/adapters/sse-adapter.ts`
- : SSE
- :
 - (Map<userId, SSEConnection[]>)
 - (30)
 -
 -
 -

**SSE **:
- : `src/modules/notifications/handlers/notification-sse.ts`
- : `NotificationSSEHandler`
- :
 - `connect()` - SSE
 - `sendMessage()` -
 - `broadcast()` -
 - `getStats()` -
 - `cleanupConnections()` -
 - `getUserConnectionCount()` -

****:
```bash
curl http://localhost:8787/api/notifications/sse
 401 Unauthorized (,)

curl http://localhost:8787/api/notifications/sse/stats
 401 Unauthorized (,)
```

---

### 3.
****: ****

****:

#### A. API (`src/utils/api-response.ts`)

:
- `successResponse()` -
- `paginatedResponse()` -
- `errorResponse()` -
- `validationErrorResponse()` -
- `unauthorizedResponse()` - (401)
- `forbiddenResponse()` - (403)
- `notFoundResponse()` - (404)
- `internalErrorResponse()` - (500)
- `badRequestResponse()` - (400)
- `handleApiError()` -

#### B.

**notification-main.ts** :
```typescript
//
try {
 //
} catch (error) {
 if (error instanceof NotificationValidationError) {
 return validationErrorResponse(c, error.errors);
 }
 return handleApiError(error, c);
}
```

****:
- `NotificationValidationError` -
 - : `src/modules/notifications/utils/notification-validator.ts`
 -

****:
-
-
-
-
-
-

#### C. (`src/core/error-handler.ts`)

****:
-
-
-
-
- (/)

****:
- `src/index.ts:167` - `app.use('*', errorHandlingMiddleware())`

****:
```typescript
//
{
 success: false,
 error: "Error message",
 timestamp: "2025-09-30T...",
 requestId: "req_..."
}

//
{
 success: false,
 error: "Validation failed",
 data: {
 code: "VALIDATION_ERROR",
 errors: [
 { field: "title", message: "Title is required" }
 ]
 }
}
```

---


### 1.

****:
```
Error: Disallowed operation called within global scope.
Asynchronous I/O (ex: fetch() or connect()), setting a timeout,
and generating random values are not allowed within global scope.
```

****:
 Cloudflare Workers ,():
- I/O (fetch, connect)
- (setTimeout, setInterval)
- (crypto.randomUUID)

****:

1. **`src/index.ts:140-158`** - (IIFE)
 ```typescript
 // :
 (async () => {
 const initResult = await globalModularSystemManager.initialize();
 // ...
 })();
 ```

2. **`src/core/modular-system-integration.ts:83`** -
 ```typescript
 // : setInterval
 automatedHealthMonitoring.start(); // setInterval
 ```

****:

#### A.

****: `src/index.ts:139-179`

```typescript
// :
let modularSystemInitialized = false;
let modularSystemInitPromise: Promise<void> | null = null;

async function initializeModularSystem() {
 if (modularSystemInitialized) return;
 if (modularSystemInitPromise) return modularSystemInitPromise;

 modularSystemInitPromise = (async () => {
 try {
 const initResult = await globalModularSystemManager.initialize();
 modularSystemInitialized = true;
 // ...
 } catch (error) {
 modularSystemInitPromise = null;
 throw error;
 }
 })();

 return modularSystemInitPromise;
}

//
app.use('*', async (c, next) => {
 if (!modularSystemInitialized) {
 await initializeModularSystem();
 }
 await next();
});
```

#### B.

****: `src/core/modular-system-integration.ts:79-89`

```typescript
// :
if (this.config.enableHealthMonitoring) {
 try {
 // , Worker fetch handler
 healthMonitoring = true;
 console.log(' Health monitoring configured (will start on first request)');
 } catch (error) {
 errors.push(`Health monitoring setup failed: ...`);
 }
}
```

****: `src/index.ts:205-210` ()

```typescript
// setTimeout
// setTimeout(() => {
// automatedHealthMonitoring.start();
// }, 3000);
```

****:
- Cloudflare Workers
-
-
-

---


### ()
| | | | |
|------|------|------|------|
| `/api/notifications/health` | GET | | |
| `/api/notifications/info` | GET | | |

****: 401,

### CRUD ()
| | | | |
|------|------|------|------|
| `/api/notifications` | GET | | () |
| `/api/notifications` | POST | | |
| `/api/notifications/bulk` | POST | | |
| `/api/notifications/:id` | GET | | |
| `/api/notifications/:id/read` | PUT | | |
| `/api/notifications/mark-all-read` | PUT | | |
| `/api/notifications/:id` | DELETE | | |
| `/api/notifications/stats` | GET | | |
| `/api/notifications/unread-count` | GET | | |
| `/api/notifications/recent` | GET | | (50) |

### SSE ()
| | | | |
|------|------|------|------|
| `/api/notifications/sse` | GET | | SSE |
| `/api/notifications/sse/send` | POST | | SSE |
| `/api/notifications/sse/broadcast` | POST | | SSE |
| `/api/notifications/sse/stats` | GET | | SSE |
| `/api/notifications/sse/cleanup` | POST | | SSE |
| `/api/notifications/sse/connections/count` | GET | | |

### ()
| | | | |
|------|------|------|------|
| `/api/notifications/cleanup` | DELETE | | |
| `/api/notifications/channels/stats` | GET | | |
| `/api/notifications/channels/:channelType/test` | POST | | |

### ()
| | | | |
|------|------|------|------|
| `/api/notifications/new-message` | POST | | |
| `/api/notifications/conversation-assigned` | POST | | |
| `/api/notifications/system` | POST | | () |

---


```
 wrangler 4.38.0


 Route configuration validated successfully

 Initializing Unified Route Management System...

 Registering route group: Core API
 Registered: auth -> /api/auth
 Registered: system -> /api/system
 Registered: health -> /api/health

 Registering route group: Business Logic
 Registered: conversations -> /api/conversations
 Registered: messages -> /api/messages
 Registered: delayed-messages -> /api/delayed-messages
 Registered: customers -> /api/customers

 Registering route group: Team Collaboration
 Registered: teams -> /api/teams
 Registered: agents -> /api
 Registered: sessions -> /api/sessions

 Registering route group: Platform Integration
 Registered: notifications -> /api/notifications
 Registered: qr-codes -> /api/qr-codes

 Registering route group: Monitoring & Analytics

 Route system initialized successfully:
 Groups: 5
 Modules: 12/12
 Enabled: 12
 Disabled: 0
 Registration Rate: 100%

 Initializing Modular Architecture System...
 Initializing Automated Health Monitoring...

[wrangler:info] Ready on http://127.0.0.1:8787
```


-
- 100%
- `/api/notifications`
-
- Worker http://127.0.0.1:8787

---


```bash
npx tsx test-notification-endpoints.ts
```


```
================================================================================

================================================================================

 PASS (3):
 GET /api/notifications/health [401] 37ms
 GET /api/notifications/info [401] 6ms
 GET /api/notifications/sse [401] 2ms

 FAIL (1):
 GET /api/notifications/sse/stats [401] 3ms

================================================================================
: 4 | 3 | 1 | 0
================================================================================
```


**401 **:
- 401 ****
- 401 ****
- ****,

****:
1. ()
2. HTTP
3. : `{"error":"Missing or invalid authorization header"}`
4. (2-37ms)
5. : `application/json`

** - **:
```bash
curl http://localhost:8787/api/system/health
 {"status":"healthy","timestamp":"2025-09-30T04:50:54.927Z",...}
```
,

---


### 1.

```
src/modules/notifications/
 adapters/
 sse-adapter.ts
 websocket-adapter.ts
 email-adapter.ts
 push-adapter.ts
 handlers/ HTTP
 notification-main.ts
 notification-sse.ts
 services/
 notification-service.ts
 notification-channel-service.ts
 repositories/
 notification-repository.ts
 notification-cache.ts
 types/
 index.ts
 notification-types.ts
 channel-types.ts
 utils/
 notification-validator.ts
 notification-factory.ts
 index.ts
```

### 2.

```typescript
//
NotificationHandler
 > NotificationService
 > D1Database
 > KVNamespace
 > NotificationChannelService
 > NotificationRepository
 > NotificationCache
 > NotificationValidator
 > NotificationFactory
```

### 3.

```typescript
src/index.ts
 > app.route('/api/notifications', notificationMainHandler)
 > src/handlers/notification-router.ts
 > Hono App Instance
 > GET /health ()
 > GET /info ()
 > GET / () -> NotificationHandler.list
 > POST / () -> NotificationHandler.create
 > GET /sse () -> NotificationSSEHandler.connect
 > ... ()
```

### 4.

```typescript
Request

Middleware ()

Handler ()

Service ()

Repository ()


Response
```

---


### ():

1. **health info **
 - : 401
 - :
 - : ()

2. **SSE **
 - : 30
 - :
 - : ()

3. ****
 - :
 - : ( Cron Triggers)
 - : ()

4. ****
 - : Email Push
 - : Email Push
 - : ()

---


| | | | |
|------|--------|----------|----------|
| | | | |
| SSE 404 | | | (401) |
| | | | + |
| | | | |


- ****: ,
- ****: 100% (12/12)
- ****:
- ****: ,
- ****:
- ****: TypeScript
- ****:
- ****:


 (Notifications) **** :

-
-
-
- SSE
-
- API
-
-
- Cloudflare Workers

---


### :
1.
2.
3. SSE
4.

### (1-2):
1.
2.
3. SSE
4.

### (1-3):
1. Email
2. Push
3.
4.

---

****: 2025-09-30T04:51:00Z
****: Claude Code
****: v1.0.0
****: **,**