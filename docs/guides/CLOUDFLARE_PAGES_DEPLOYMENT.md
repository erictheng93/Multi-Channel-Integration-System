# Cloudflare Pages


 Cloudflare Pages Cloudflare Workers


1. Cloudflare
2. Worker `your-api-domain.example.com`
3.


### 1.

```bash
# frontend
cd frontend


npm install


npm run build:pages
```

### 2. Cloudflare Pages

#### A Cloudflare Dashboard

1. [Cloudflare Dashboard](https://dash.cloudflare.com)
2. "Pages"
3. "Create a project"
4. Git
5.
 - **Framework preset**: Vue
 - **Build command**: `npm run build:pages`
 - **Build output directory**: `dist`
 - **Root directory**: `frontend`

#### B Wrangler CLI

```bash
# Wrangler
npm install -g wrangler

# Cloudflare
wrangler login

# Pages
wrangler pages deploy dist --project-name=mcis-ey7
```

### 3.

 Cloudflare Pages

#### Production
```
VITE_API_BASE_URL=https://your-api-domain.example.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
```

#### Preview
```
VITE_API_BASE_URL=https://your-api-domain.example.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
```

### 4.


1. Pages "Custom domains"
2.
3. DNS


### `_redirects`
```
# SPA
/* /index.html 200

# API Worker
/api/* https://your-api-domain.example.com/api/:splat 200
```

### `functions/_middleware.ts`
 CORS

### `.pages.toml`
Cloudflare Pages


```bash
# frontend
powershell -ExecutionPolicy Bypass -File scripts/verify-deployment-simple.ps1 -Environment production
```


### 1. API
- Worker
- CORS
- API URL

### 2.
- `_redirects` `dist`
- SPA

### 3.
- Cloudflare Pages
- `VITE_`


 Cloudflare Pages Dashboard

### Functions
 Wrangler Pages Functions

```bash
wrangler pages deployment tail --project-name=mcis-ey7
```


```bash

npm run preview

# API
npm run dev
```


### GitHub Actions

```yaml
name: Deploy to Cloudflare Pages

on:
 push:
 branches: [main]
 paths: ['frontend/**']

jobs:
 deploy:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v3

 - name: Setup Node.js
 uses: actions/setup-node@v3
 with:
 node-version: '18'
 cache: 'npm'
 cache-dependency-path: frontend/package-lock.json

 - name: Install dependencies
 run: |
 cd frontend
 npm ci

 - name: Build
 run: |
 cd frontend
 npm run build:pages

 - name: Deploy to Cloudflare Pages
 uses: cloudflare/pages-action@v1
 with:
 apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
 accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
 projectName: mcis-ey7
 directory: frontend/dist
```


1. ****: Vite Gzip Brotli
2. ****: chunk splitting
3. ****: 4KB
4. **Tree Shaking**:


1. **CSP **: `_middleware.ts`
2. **CORS **:
3. ****:


1. Cloudflare Pages
2.
3. Worker 