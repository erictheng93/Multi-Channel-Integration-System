# API


 API


### 1.
- `frontend/vite.config.ts` - Vite
- `frontend/.env.development` -
- `frontend/.env.production` -
- `frontend/_redirects` - Cloudflare Pages
- `wrangler.toml` - Worker
- `frontend/functions/_middleware.ts` - CORS

### 2.
- API
-
-


****
- `VITE_API_URL`
- `VITE_API_BASE_URL`
- `VITE_API_BASE_URL`

****
- `frontend/src/api/base.ts`
- `frontend/src/api/modern-client.ts`
- `frontend/src/types/global.d.ts`
- `frontend/.env`

****
```typescript
//
import.meta.env.VITE_API_URL

//
import.meta.env.VITE_API_BASE_URL
```


### 1. API

****: `frontend/src/api/base.ts`
```typescript
//
export const apiClient = new ApiClient(
 import.meta.env.VITE_API_URL || 'http://localhost:8787'
);

//
export const apiClient = new ApiClient(
 import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
);
```

### 2. API

****: `frontend/src/api/modern-client.ts`
```typescript
//
this.baseURL = options.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8787'

//
this.baseURL = options.baseURL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
```

### 3.

****: `frontend/src/types/global.d.ts`
```typescript
//
interface ImportMetaEnv {
 readonly VITE_API_URL: string

//
interface ImportMetaEnv {
 readonly VITE_API_BASE_URL: string
```

### 4.

****: `frontend/.env`
```env

VITE_API_URL=http://localhost:8787


VITE_API_BASE_URL=http://localhost:8787
```


### 1. Vite

```typescript
// frontend/vite.config.ts
server: {
 port: 3000,
 proxy: {
 '/api': {
 target: process.env.VITE_API_BASE_URL || 'http://localhost:8787',
 changeOrigin: true,
 secure: false, // false true
 rewrite: (path) => path, //
 configure: (proxy, _options) => {
 //
 },
 }
 }
}
```

### 2.

**** (`frontend/.env.development`):
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

**** (`frontend/.env.production`):
```env
VITE_API_BASE_URL=https://mcis-backend.daiwandist.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
```

### 3. Cloudflare Pages

```ini
# frontend/_redirects
/* /index.html 200
/api/* https://mcis-backend.daiwandist.com/api/:splat 200
```

### 4. CORS

```typescript
// frontend/functions/_middleware.ts
export async function onRequest(context: EventContext<any, any, any>): Promise<Response> {
 const { request, next } = context;

 // CORS
 if (request.method === 'OPTIONS') {
 return new Response(null, {
 status: 200,
 headers: {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
 'Access-Control-Max-Age': '86400',
 },
 });
 }
 // ...
}
```


### 1.

 API

```bash
npm run test:run -- src/test/api-proxy.test.ts
```

****
- 10/10
-
-
-

### 2.

```bash
npm run type-check
```

****

### 3. Lint

```bash
npm run lint:check
```

****
- 15
- 207 `any`
- API

## API


```
: http://localhost:3000/api/auth/login
 (Vite )
: http://localhost:8787/api/auth/login
 (Worker )
: 200 OK + JSON
```


```
: https://your-pages-domain.pages.dev/api/auth/login
 (Cloudflare Pages )
: https://mcis-backend.daiwandist.com/api/auth/login
 (Worker )
: 200 OK + JSON
```


### 1.

- `VITE_API_BASE_URL`
- `VITE_API_URL`
-

### 2.

-
-
-

### 3.

- API
-
-

### 4.

-
-
-


- [ ] `VITE_API_BASE_URL=http://localhost:8787`
- [ ] Worker`wrangler dev`
- [ ] `npm run dev`
- [ ] API `curl http://localhost:3000/api/health`


- [ ] Worker `https://mcis-backend.daiwandist.com`
- [ ] Cloudflare Pages `VITE_API_BASE_URL`
- [ ] `_redirects`
- [ ] API `curl https://your-pages-domain.pages.dev/api/health`


API

1. ** **
2. ** **
3. ** **
4. ** **

 API

---

****202518
****Kiro AI Assistant
**** 