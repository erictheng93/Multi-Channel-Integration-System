

### ()

```powershell

.\start-dev.ps1
```


-
-
- Worker (http://localhost:8787)
- (http://localhost:3000)
- API
-


```powershell
# 1: Worker
wrangler dev --port 8787

# 2:
cd frontend
npm run dev
```

## API

### ()

```powershell

.\test-api.ps1


.\test-api.ps1 local


.\test-api.ps1 production
```


#### 1. Worker
```bash
curl http://localhost:8787/api/health
```

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

#### 2.
```bash
curl http://localhost:3000/api/health
```

****: ( Vite )

#### 3.
```bash
curl https://mcis-backend.daiwandist.com/api/health
```


**** ( `.dev.vars`):
```env
JWT_SECRET=your_jwt_secret_key
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
```

**** (`frontend/.env.development`):
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_DEBUG=true
```

### Vite

`frontend/vite.config.ts`
```typescript
server: {
 port: 3000,
 proxy: {
 '/api': {
 target: 'http://localhost:8787',
 changeOrigin: true,
 secure: false
 }
 }
}
```


- ****: http://localhost:3000
- ** API**: http://localhost:8787
- ****:
 - http://localhost:8787/health
 - http://localhost:8787/api/health
 - http://localhost:3000/api/health ()


1. http://localhost:3000
2. F12
3. Network API
4. Console

### Wrangler

```bash
# Worker
wrangler tail


wrangler tail --env production
```


### 1.

****: `Error: Could not resolve "..."`

****:
```bash

npm install


npm run clean
```

### 2.

****: `[vite] http proxy error: ECONNREFUSED`

****:
- Worker
- 8787
-

### 3.

****: `D1_ERROR: no such table`

****:
```bash

wrangler d1 execute omni-channel-platform --local --file=database/schema.sql
```

### 4.

****:
- `.dev.vars`
- Worker: `wrangler dev`
-


1. ****:
 ```bash
 .\start-dev.ps1
 ```

2. ** API **:
 ```bash
 .\test-api.ps1 local
 ```

3. ****:
 -
 - Worker

4. ****:
 -
 - Postman curl API


```bash

cd frontend
npm run type-check

# Lint ( TypeScript )
npm run lint:check

# ( lint )
vite build

# ( lint )
npm run build

# API
.\test-api.ps1 local
```

****: Lint TypeScript `any` `vite build` prebuild


- ****: Vue
- ****: TypeScript Worker


1. ****:
 - Vue DevTools
 - `console.log()`
 -

2. ****:
 - Worker `console.log()`
 - `wrangler tail`
 - Wrangler


- `npm run build:analyze`
- API
-


1. ****:
 ```bash
 .\test-api.ps1 production
 ```

2. ****:
 ```bash
 cd frontend
 npm run build:pages
 ```

3. ****:
 ```bash
 wrangler deploy --env production
 ```

4. ****:
 ```bash
 .\deploy-frontend.ps1 production
 ```

---


1. [](#-)
2. `.\test-api.ps1`
3. [API ](API_PROXY_SETUP.md)
4. Wrangler 