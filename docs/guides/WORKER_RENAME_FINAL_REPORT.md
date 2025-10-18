# Worker


 Cloudflare Worker "multi-channel-platform"


### 1. Worker
- ** Worker**: `multi-channel-platform`
- ** Worker**: `multi-channel-platform-delayed`
- ** Worker**: `multi-channel-platform-delayed-prod`

### 2. (31 )
- `wrangler.toml` -
- `wrangler-delayed-message.toml` -
-
-
-
-

### 3. URL
- `https://line-bot.imfinethankyouandyou.com`
- `https://multi-channel-platform.imfinethankyouandyou.com`

### 4.

#### D1
- ****: `omni-channel-platform`
- **ID**: `37537e1f-625e-4cf9-be60-a01b5c063772`
- ****: workers

#### KV
- **SESSIONS**: `ace3f7202e6a4dd8b98c50e9b91b2431`
- **CACHE**: `f3bc7a55c8a14f4fb28b8321fa01dc73`
- ****: (//)

#### R2
- ****: `omni-channel-attachments-develop`
- ****: `omni-channel-attachments-production`
- ****:

#### Queues
- ****: `message-queue`
- ****: `message-queue-prod`
- ****:

### 5. ID
 ID ID
- `your-production-sessions-kv-id` KV ID
- `your-production-cache-kv-id` KV ID
- `your-database-id` D1 ID
- `delayed-messages` `message-queue` ()


- URL
-
-


-
- ID Cloudflare ID
-


- worker
-
- API


1. ****
 ```bash
 wrangler deploy
 wrangler deploy --config wrangler-delayed-message.toml
 ```

2. ** LINE Webhook URL**
 - URL: `https://line-bot.imfinethankyouandyou.com/api/webhook`
 - URL: `https://multi-channel-platform.imfinethankyouandyou.com/api/webhook`

3. ****
 ```bash
 curl https://multi-channel-platform.imfinethankyouandyou.com/api/health
 ```


1. **** ( wrangler.toml )
2. ** Queue ** ()
3. ** Durable Objects** ()


- Worker : `multi-channel-platform`
- D1 : `omni-channel-platform`
- KV : SESSIONS + CACHE
- R2 : +
- Queues : message-queue
- Worker
- ID
-
-
-
-


### (2)
- `wrangler.toml`
- `wrangler-delayed-message.toml`

### (4)
- `frontend/src/views/PlatformIntegration.vue`
- `frontend/_redirects`
- `frontend/.env.development`
- `frontend/.env.local.example`
- `frontend/src/test/api-proxy.test.ts`

### (6)
- `tests/test-message-relations.ts`
- `tests/test-session-management.ts`
- `tests/check-recent-messages.ts`
- `tests/verify-production.ts`
- `tests/test-line-api.ts`
- `tests/monitor-line-messages.ts`

### (1)
- `src/utils/team.ts`

### (2)
- `test-api.ps1`
- `deploy-production.ps1`

### (17)
- `QUICK_START.md`
- `CLOUDFLARE_PAGES_SETUP.md`
- `DELAYED_MESSAGE_DEPLOYMENT_REPORT.md`
- `docs/guides/`

### (3)
- `verify-resource-bindings.ps1`
- `RESOURCE_BINDING_VERIFICATION_REPORT.md`
- `WORKER_RENAME_FINAL_REPORT.md`


****: ****

Cloudflare Worker worker "multi-channel-platform"

****: 34
****: 3
****: 100%
****: 100%

 ****