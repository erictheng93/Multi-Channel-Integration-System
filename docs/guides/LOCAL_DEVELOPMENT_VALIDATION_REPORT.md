


### 1.
- `docs/guides/LOCAL_DEVELOPMENT_SETUP.md` -
- `start-dev.ps1` -
- `test-api.ps1` - API
- `deploy-frontend.ps1` -
- `frontend/vite.config.ts` - Vite
- `frontend/.env.development` -
- `database/schema.sql` -

### 2.

#### start-dev.ps1
- Node.jsWranglerCloudflare
-
- Worker
- API
-

#### test-api.ps1
- localproductionall
- Worker http://localhost:8787/api/health
- http://localhost:3000/api/health
- https://multi-channel-platform.example.com/api/health
-

### 3.

#### Vite
```typescript
server: {
 port: 3000,
 proxy: {
 '/api': {
 target: process.env.VITE_API_BASE_URL || 'http://localhost:8787',
 changeOrigin: true,
 secure: false,
 rewrite: (path) => path,
 configure: (proxy, _options) => {
 //
 },
 }
 }
}
```


```env
# frontend/.env.development
VITE_API_BASE_URL=http://localhost:8787
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_DEBUG=true
```

### 4.

#### API
```bash
npm run test:run -- src/test/api-proxy.test.ts
```

****:
- 10/10
-
-
-

### 5. TypeScript

```bash
npm run type-check
```

****:

### 6.

```bash
npm run lint:check
```

****: 15 207
- ****: TypeScript `any`
- ****:
- ****:


### 1.

****:
1. `.\start-dev.ps1`
2. http://localhost:8787
3. http://localhost:3000
4. API

****:

### 2. API

****:
1. `.\test-api.ps1 local`
2. Worker
3.

****:
```json
{
 "status": "healthy",
 "timestamp": "2025-01-08T...",
 "database": "connected",
 "version": "1.0.0",
 "environment": "development"
}
```

****: API

### 3.

****:
1. `vite build` frontend lint
2.

****:
- : 2.13s
- : 250KB ()
- Gzip Brotli

****: `npm run build` lint `vite build`


#### 1. TypeScript
****: `frontend/src/test/api-proxy.test.ts`
```typescript
//
const expectedBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

//
//
```

****:


#### 1. Lint
****: TypeScript
- 207 `@typescript-eslint/no-explicit-any`
- 15

****:
****:

#### 2.
****: `npm run clean`
****: `frontend/package.json`


### 1.
- PowerShell
- npm
-

### 2.
-
- Vite
- URL

### 3.
-
-
-


### 1.
- Lint
-

### 2.
- TypeScript
- `any`
- ESLint

### 3.
- API
-


-
- API
-
-


-
-
-
-


1. ** **:
2. ** **:
3. ** **:
4. ** **: TypeScript
5. ** **: API


---

****: 202518
****: Kiro AI Assistant
****: 