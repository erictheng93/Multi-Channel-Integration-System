# CORS


- [](#)
- [ CORS ](#-cors-)
- [](#)
- [](#)
- [](#)
- [SSE ](#sse-)
- [](#)
- [](#)

---


** CORS ** CORS `src/config/cors.ts`

 **** - CORS
 **** - origin
 **** - credentials origin
 **** - CORS
 **** -

---

## CORS


```

 @/config/cors.ts
 CORS
 - isOriginAllowed()
 - getSSECorsHeaders()
 - applySSECorsHeaders()
 - ALLOWED_ORIGINS


 src/index.ts (Line 106)
 CORS middleware
 - origin
 - Credentials
 - OPTIONS preflight (Line 139)


 conversations analytics notifications
 handlers dashboard handlers

```


1. **** Global CORS middleware Origin header
2. ** origin** `isOriginAllowed()`
3. ** preflight** OPTIONS 204 + CORS headers
4. **** CORS headers
5. **** CORS /

---


### `src/config/cors.ts`

 CORS **** CORS

#### Origins

```typescript
export const ALLOWED_ORIGINS = [
 //
 'https://your-api-domain.example.com', // Backend API
 'https://mcis-ey7.pages.dev', // Frontend Cloudflare Pages
 'https://your-frontend-domain.example.com', // MCP Frontend Domain

 //
 'http://localhost:3000', // Vite dev server
 'https://localhost:3000', // Vite dev server (SSL)
 'http://127.0.0.1:3000', // Local IP
 'http://localhost:8787', // Wrangler dev server
] as const;
```

#### Origin

```typescript
export function isOriginAllowed(origin: string | undefined): boolean {
 if (!origin) return false;

 //
 if (ALLOWED_ORIGINS.includes(origin as any)) {
 return true;
 }

 // Cloudflare Pages preview
 // abc123.mcis-ey7.pages.dev
 if (origin.endsWith('.mcis-ey7.pages.dev')) {
 return true;
 }

 return false;
}
```

#### SSE CORS

```typescript
export function getSSECorsHeaders(
 origin: string | undefined,
 additionalHeaders?: string[]
): Record<string, string> {
 // SSE
 // origin origin + credentials
 // origin '*' ( credentials)
}
```

---


| | | |
|------|------|------|
| `GET /api/monitoring/cors/stats` | Admin | CORS |
| `GET /api/monitoring/cors/events` | Admin | CORS |
| `GET /api/monitoring/cors/rejected-origins` | Admin | origin |
| `POST /api/monitoring/cors/cleanup` | Admin | |
| `GET /api/monitoring/cors/health` | Public | |
| `GET /api/monitoring/cors/config` | Public | CORS |


```json
{
 "success": true,
 "data": {
 "total": 15234,
 "allowed": 14892,
 "rejected": 342,
 "preflightRequests": 3241,
 "sseConnections": 456,
 "credentialsUsed": 14123,
 "topOrigins": [
 { "origin": "https://your-api-domain.example.com", "count": 8234 },
 { "origin": "http://localhost:3000", "count": 5432 }
 ],
 "topRejectedOrigins": [
 { "origin": "https://suspicious-site.com", "count": 234 },
 { "origin": "http://unknown-origin.example", "count": 108 }
 ]
 }
}
```


- `allowed` -
- `rejected` -
- `preflight` - OPTIONS
- `sse_connection` - SSE
- `credentials_used` - credentials

---


### 1

 `src/config/cors.ts` `ALLOWED_ORIGINS`

```typescript
export const ALLOWED_ORIGINS = [
 // ... ...
 'https://new-domain.example.com', //
] as const;
```

### 2

 TypeScript

```bash
npm run lint:check
```

### 3

 E2E

```bash

curl -H "Origin: https://new-domain.example.com" \
 https://your-api.com/api/system/health

# headers
# Access-Control-Allow-Origin: https://new-domain.example.com
# Access-Control-Allow-Credentials: true
```

### 4

```bash
npm run deploy
```

### 5


```bash
# CORS
GET /api/monitoring/cors/stats


GET /api/monitoring/cors/events?limit=20
```

---

## SSE

### SSE

Server-Sent Events (SSE) `EventSource` API

1. ** headers** - URL token
2. ** credentials** - CORS
3. **** -

### SSE CORS

```typescript
// origin - origin + credentials
if (origin && isOriginAllowed(origin)) {
 headers['Access-Control-Allow-Origin'] = origin;
 headers['Access-Control-Allow-Credentials'] = 'true';
 console.log(` [SSE CORS] Allowed origin: ${origin}`);
}
// origin - wildcard ( credentials)
else {
 headers['Access-Control-Allow-Origin'] = '*';
 console.warn(` [SSE CORS] Unknown origin (wildcard fallback): ${origin}`);
}
```

### SSE CORS

 SSE

```typescript
import { getSSECorsHeaders } from '@/config/cors';

app.get('/api/notifications/sse', async (c) => {
 const stream = new ReadableStream({
 // ... SSE ...
 });

 // SSE CORS
 const sseCorsHeaders = getSSECorsHeaders(c.req.header('Origin'));
 return new Response(stream, { headers: sseCorsHeaders });
});
```

---


### 1CORS "Access-Control-Allow-Origin missing"

****
```
Access to fetch at 'https://api.example.com' from origin 'https://frontend.example.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

****

1. origin
2. origin
 ```bash
 GET /api/monitoring/cors/rejected-origins
 ```
3. origin `src/config/cors.ts` `ALLOWED_ORIGINS`

### 2Credentials

****
```
Access to fetch has been blocked by CORS policy:
The value of 'Access-Control-Allow-Origin' must not be the wildcard '*'
when the request's credentials mode is 'include'.
```

****

1. origin `ALLOWED_ORIGINS`
2. `credentials: 'include'`
 ```javascript
 fetch('https://api.example.com/endpoint', {
 credentials: 'include', //
 headers: {
 'Authorization': `Bearer ${token}`
 }
 })
 ```
3. CORS middleware

### 3OPTIONS preflight

****
```
Response to preflight request doesn't pass access control check
```

****

1. `src/index.ts` OPTIONS handler (Line 119-129)
2. headers
3. curl OPTIONS
 ```bash
 curl -X OPTIONS https://api.example.com/endpoint \
 -H "Origin: https://frontend.example.com" \
 -H "Access-Control-Request-Method: POST" \
 -H "Access-Control-Request-Headers: Content-Type,Authorization" \
 -v
 ```

### 4Cloudflare Pages Preview

****
Preview URL `abc123.mcis-ey7.pages.dev` CORS

****

 `isOriginAllowed()` preview

```typescript
//
if (origin.endsWith('.mcis-ey7.pages.dev')) {
 return true;
}
```

### 5SSE

****
EventSource

****

1. SSE `getSSECorsHeaders()`
2. origin
 ```bash
 # SSE
 curl -N -H "Accept: text/event-stream" \
 -H "Origin: https://frontend.example.com" \
 https://api.example.com/api/notifications/sse
 ```
3.
 ```bash
 GET /api/monitoring/cors/events?type=sse_connection
 ```

---


### 1. Wildcard '*'

 ****
```typescript
headers['Access-Control-Allow-Origin'] = '*';
headers['Access-Control-Allow-Credentials'] = 'true'; //
```

 ****
```typescript
import { isOriginAllowed } from '@/config/cors';

if (origin && isOriginAllowed(origin)) {
 headers['Access-Control-Allow-Origin'] = origin;
 headers['Access-Control-Allow-Credentials'] = 'true';
}
```

### 2. CORS

 **** CORS
```typescript
// handler-a.ts
const allowed = ['https://domain1.com', 'https://domain2.com'];
if (allowed.includes(origin)) { ... }

// handler-b.ts
const allowed = ['https://domain1.com', 'https://domain2.com']; //
if (allowed.includes(origin)) { ... }
```

 **** `@/config/cors.ts`
```typescript
import { isOriginAllowed, getSSECorsHeaders } from '@/config/cors';

// For regular endpoints
if (isOriginAllowed(origin)) { ... }

// For SSE endpoints
const headers = getSSECorsHeaders(origin);
```

### 3. CORS

 ** CORS **
```typescript
if (isOriginAllowed(origin)) {
 console.log(` [CORS] Allowed origin: ${origin}`);
} else {
 console.warn(` [CORS] Rejected origin: ${origin}`);
}
```

### 4.

 ****
```typescript
// origin
GET /api/monitoring/cors/rejected-origins

// > 5%
if (stats.rejected / stats.total > 0.05) {
 sendAlert('High CORS rejection rate detected');
}
```

### 5. Preview

 ** pattern matching **
```typescript
// Cloudflare Pages preview
if (origin.endsWith('.mcis-ey7.pages.dev')) {
 return true;
}
```

### 6.

 **E2E **
-
- localhost
- Preview
- SSE
- Credentials
- OPTIONS preflight

---


| | |
|------|------|
| `src/config/cors.ts` | CORS |
| `src/index.ts` (Line 106-142) | CORS middleware |
| `src/monitoring/cors-monitor.ts` | CORS |
| `src/handlers/cors-monitoring.ts` | API |

---


- **MDN CORS **: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **EventSource API**: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- **Cloudflare Workers CORS**: https://developers.cloudflare.com/workers/examples/cors-headers/
- **CORS Preflight **: https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request

---


### 2025-01-14 - CORS

- CORS (`src/config/cors.ts`)
- 8 CORS
- 85% (121 18 )
- CORS
-
- credentials
- SSE CORS


****
1. `src/config/cors.ts` - SSE CORS
2. `src/utils/performance.ts` - wildcard origin
3. `src/handlers/notification-optimized.ts` - SSE CORS
4. `src/handlers/notification.ts` - SSE CORS
5. `src/modules/conversations/handlers/conversation-main.ts` - 4 SSE CORS
6. `src/modules/conversations/handlers/index.ts` - CORS middleware (56 )
7. `src/modules/analytics/services/realtime-dashboard-service.ts` - SSE CORS
8. `src/modules/analytics/handlers/realtime-dashboard-main.ts` - CORS

****
1. `src/monitoring/cors-monitor.ts` - CORS
2. `src/handlers/cors-monitoring.ts` - API
3. `docs/CORS_CONFIGURATION_GUIDE.md` -

---

**** issue
