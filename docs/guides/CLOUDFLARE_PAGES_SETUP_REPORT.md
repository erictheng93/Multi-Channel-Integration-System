# Cloudflare Pages


 ** Cloudflare Pages**
 ** Worker **
 ** URL `multi-channel.imfinethankyouandyou.com`**


### 1.
- `frontend/.env.production` -
- `frontend/.env.development` -
- `https://multi-channel.imfinethankyouandyou.com`

### 2. Cloudflare Pages
- `frontend/_redirects` - SPA API
- `frontend/functions/_middleware.ts` - CORS
- `frontend/.pages.toml` - Pages

### 3.
- `frontend/vite.config.ts` -
- `frontend/package.json` -
-

### 4.
- `frontend/scripts/copy-pages-config.ps1` -
- `frontend/scripts/verify-deployment-simple.ps1` -
- `frontend/scripts/deploy-to-pages.ps1` -

## API

```
 : https://multi-channel.imfinethankyouandyou.com/api/health
 : connected
 API : 1.0.0
 CORS :
```


```bash
cd frontend
npm run deploy:pages
```


```bash
cd frontend
npm run deploy:pages-quick
```


```bash
cd frontend
npm run verify:deployment
```


```
frontend/
 dist/ #
 _redirects # Pages
 functions/
 _middleware.ts # Pages Functions
 .pages.toml # Pages
 functions/
 _middleware.ts #
 scripts/
 copy-pages-config.ps1 #
 deploy-to-pages.ps1 #
 verify-deployment-simple.ps1 #
 .env.production #
 .env.development #
 _redirects # Pages
 .pages.toml # Pages
 CLOUDFLARE_PAGES_DEPLOYMENT.md #
```


1. `npm run dev` -
2. `npm run verify:deployment` -


1. `npm run build:pages` -
2. `npm run deploy:pages` - Cloudflare Pages
3. Cloudflare Dashboard

## Cloudflare Pages


- **Framework preset**: Vue
- **Build command**: `npm run build:pages`
- **Build output directory**: `dist`
- **Root directory**: `frontend`

### Dashboard
```
# Production
VITE_API_BASE_URL=https://multi-channel.imfinethankyouandyou.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true

# Preview
VITE_API_BASE_URL=https://multi-channel.imfinethankyouandyou.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
```


1. **URL **: `line-bot.imfinethankyouandyou.com` `multi-channel.imfinethankyouandyou.com`
2. **TypeScript **: auth store ConversationList
3. ****: Vite Cloudflare Pages
4. **CORS **: CORS
5. ****: dist


1. ** Cloudflare Pages**:
 ```bash
 cd frontend
 npm run deploy:pages
 ```

2. ** Cloudflare Dashboard **

3. ****

4. ** GitHub Actions ** `CLOUDFLARE_PAGES_DEPLOYMENT.md`


- [x] API
- [x]
- [x]
- [x] URL
- [x] CORS
- [x]


1. `frontend/CLOUDFLARE_PAGES_DEPLOYMENT.md` -
2. Cloudflare Pages
3.
4. Worker

---

****:
****: 2025-08-14
****: v1.0.0