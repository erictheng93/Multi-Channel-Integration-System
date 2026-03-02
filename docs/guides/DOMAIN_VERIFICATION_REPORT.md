

 URL `https://your-api-domain.example.com`


### 1. API
- ****: `GET /api/health` - 200
 - : `{"status":"healthy","timestamp":"2025-08-13T06:46:39.933Z","database":"connected","version":"1.0.0"}`

- ****: `GET /api/system/status` - 200
 - : (D1)
 - KV: (SESSIONS, CACHE)
 - R2: (mcis-files)
 - : (MESSAGE_QUEUE)
 - : development

- ****: `GET /` - 200
 - Worker

- ** API**: `GET /api/stats` - 200
 - : `{"success":true,"data":{"totalMessages":0,"totalCustomers":0,"totalConversations":2,"recentMessages":[]}}`

- **Webhook API**: `POST /api/webhook` - 200
 -

### 2.
- ** API**: `GET /api/conversations` - 401 ()
 - 401


### 1.
- ****: `GET /admin-dashboard.html` - 200
 - Worker
 - 8,244 HTML
 -

### 2. TypeScript
- TypeScript Node.js
- TypeScript `tsx` JavaScript


### 1.
- `docs/guides/CUSTOMER_COLLECTION_GUIDE.md`
- `WORKER_URL` `'https://your-actual-worker.workers.dev'` `'https://your-api-domain.example.com'`

### 2.
- :
 - `tests/monitor-customers.ts`
 - `tests/customer-manager.ts`
 - `tests/monitor-line-id.ts`
 - `tests/query-customers.ts`
 - `tests/verify-line-id-collection.ts`
 - `tests/check-line-id.ts`
 - `tests/customer-analytics.ts`


### 1.
1. ****:
 - Worker
 -

2. ** TypeScript **:
 - `tsx` TypeScript
 - `package.json` TypeScript

### 2.
1. ****:
 ```bash
 curl https://your-api-domain.example.com/admin-dashboard.html
 ```

2. ****:
 ```bash
 npx tsx tests/query-customers.ts
 npx tsx tests/customer-manager.ts
 ```

3. ** API **:
 ```bash
 npx tsx tests/api-endpoints-test.ts https://your-api-domain.example.com
 ```


- Worker
- API
- (D1)
- KV
- R2
-
- ( 401)
- Webhook


- ()
- ()
-


1. **** -
2. ** TypeScript ** ( - )
3. ** R2 **
4. ** LINE webhook **
5. ****


****

 Worker `https://your-api-domain.example.com`

 ****:
- API
- API
- API
-
-
- Webhook
-

 ****:
- (D1)
- KV
- R2
-
-


** **


### :
- **API **: https://your-api-domain.example.com/api/health
- ****: https://your-api-domain.example.com/admin-dashboard.html
- ****: https://your-api-domain.example.com/api/system/status
- ****: https://your-api-domain.example.com/api/stats

---
*: 2025-08-13*
*: https://your-api-domain.example.com*
*: **** - *