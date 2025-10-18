# API


API Multi-Channel Customer Support System v3.0 API


- **15 **: 15 API
- ****:
- ****: API


- ** (Healthy)**: < 1000ms 200
- ** (Warning)**: 1000-3000ms
- ** (Error)**: > 3000ms API


- ****:
- ****:
- ****:


1.
2. "API "
3. API


1. ****:
 - API
 - ()
 - ()
 - ()

2. ****: API
 - API
 -
 -


- ""
- 15

## API

### ()
- ****: < 1000ms
- ****: 200 OK
- ****: API

### ()
- ****: 1000-3000ms
- ****: 200
- ****: API

### ()
- ****: > 3000ms
- ****: 404, 500,
- ****: API

## API

### API
- `/api/system/health` -
- `/api/system/config` -
- `/api/auth/login` -
- `/api/auth/refresh` - Token

### API
- `/api/conversations` -
- `/api/conversations/:id/messages` -
- `/api/teams` -
- `/api/teams/:id/members` -
- `/api/customers` -

### API
- `/api/platforms/line/webhook` - LINE
- `/api/platforms/facebook/webhook` - Facebook
- `/api/qr-codes` - QR Code


- ****: D1
- ****: < 500ms
- ****: 100%


- ****:
- ****:
- **CDN **: Cloudflare CDN


1. ** API **
 -
 - Cloudflare Worker
 - Cloudflare Dashboard

2. ****
 -
 -
 - Cloudflare

3. ** API **
 - API
 -
 -


1. ****
 ```bash
 curl https://your-domain.com/api/system/health
 ```

2. ** Worker **
 ```bash
 wrangler tail
 ```

3. ****
 ```bash
 wrangler d1 execute your-db --command="SELECT 1"
 ```


- API
- API
-


- 1000ms API
- KV
-


- API
-
-


- : `frontend/src/views/ApiMonitor.vue`
- Vue 3 Composition API
- AppLayout
-

### API
- : `src/handlers/system.ts`
- : `/api/system/status`
- Hono
- API

---

****: v3.0.0
****: 2025-08-25
****: 