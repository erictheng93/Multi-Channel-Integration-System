# API


 Worker API

## Worker API

 `wrangler.toml` Worker API

```
https://mcis-backend.daiwandist.com
```


### 1. (Development)

#### ()


```bash
# 1: Worker
wrangler dev

# 2:
cd frontend
bun run dev
```

****: `frontend/.env.development`
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

**Vite **: `frontend/vite.config.ts`
```typescript
server: {
 port: 3000,
 proxy: {
 '/api': {
 target: 'http://localhost:8787', // Worker
 changeOrigin: true,
 secure: false
 }
 }
}
```


****: `frontend/.env.local` ()
```env
VITE_API_BASE_URL=https://mcis-backend.daiwandist.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

**Vite **
```typescript
proxy: {
 '/api': {
 target: process.env.VITE_API_BASE_URL, // Worker
 changeOrigin: true,
 secure: true // HTTPS true
 }
}
```

### 2. (Production)

#### Cloudflare Pages

**** ( Cloudflare Pages Dashboard ):
```env
VITE_API_BASE_URL=https://mcis-backend.daiwandist.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
```

****: `frontend/_redirects`
```
# SPA
/* /index.html 200

# API Worker
/api/* https://mcis-backend.daiwandist.com/api/:splat 200
```

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


### 1: Worker

 `wrangler.toml`:
```toml
[[routes]]
pattern = "mcis-backend.daiwandist.com/*"
zone_name = "example.com"
```

### 2:

**** (`frontend/.env.development`):
```env
VITE_API_BASE_URL=http://localhost:8787
```

**** (`frontend/.env.production`):
```env
VITE_API_BASE_URL=https://mcis-backend.daiwandist.com
```

### 3: _redirects

`frontend/_redirects`:
```
/* /index.html 200
/api/* https://mcis-backend.daiwandist.com/api/:splat 200
```

### 4: Cloudflare Pages

1. Cloudflare Dashboard
2. Pages
3. Settings > Environment variables
4.
 ```
 VITE_API_BASE_URL = https://mcis-backend.daiwandist.com
 VITE_DEV_MODE = false
 VITE_ENABLE_DEBUG_LOGS = false
 ```

## API


```bash
# Worker
curl http://localhost:8787/api/health


curl http://localhost:3000/api/health
```


```bash
# Worker
curl https://mcis-backend.daiwandist.com/api/health

# Pages
curl https://your-pages-domain.pages.dev/api/health
```


### 1. CORS

****: CORS

****:
- Worker CORS
- `frontend/functions/_middleware.ts`

### 2.

****: Vite

****:
- Worker (`wrangler dev`)
- `VITE_API_BASE_URL`
- Vite

### 3. API 404

****: API 404

****:
- `_redirects` `dist/`
- Worker
- Cloudflare Pages

### 4.

****:

****:
- `VITE_` `VITE_API_BASE_URL` `VITE_API_URL`
-
- Cloudflare Pages Dashboard
- API


```bash
# 1.
wrangler dev

# 2. ()
cd frontend
bun run dev

# 3.
# : http://localhost:3000
# : http://localhost:8787
```

### +

```bash
# 1.
cp frontend/.env.local.example frontend/.env.local

# 2. .env.local
# VITE_API_BASE_URL=https://mcis-backend.daiwandist.com

# 3.
cd frontend
bun run dev
```


```bash
# 1.
cd frontend
bun run build:pages

# 2. Pages
wrangler pages deploy dist --project-name=your-project-name

# 3. ( Dashboard )
```


1. ****: `VITE_`
2. **HTTPS**: HTTPS
3. **CORS**: CORS
4. ****: API

---

 Worker API 