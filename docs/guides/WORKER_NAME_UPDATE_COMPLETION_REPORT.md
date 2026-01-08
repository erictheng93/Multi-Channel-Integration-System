# Worker


 worker "line-bot" "multi-channel-platform"


### 1.
- `wrangler.toml` -
- `package.json` -
- `wrangler-delayed-message.toml` -

### 2.
- `frontend/src/views/PlatformIntegration.vue` - webhook
- `frontend/_redirects` - API URL
- `frontend/.env.development` - URL
- `frontend/.env.local.example` - URL
- `frontend/src/test/api-proxy.test.ts` - URL

### 3.
- `tests/test-message-relations.ts` - PRODUCTION_URL
- `tests/test-session-management.ts` - PRODUCTION_URL
- `tests/check-recent-messages.ts` - PRODUCTION_URL
- `tests/verify-production.ts` - PRODUCTION_URL
- `tests/test-line-api.ts` - fetch URL
- `tests/monitor-line-messages.ts` - PRODUCTION_URL

### 4.
- `test-api.ps1` - worker URL
- `deploy-production.ps1` -

### 5.
- `src/utils/team.ts` - baseUrl

### 6.
- `QUICK_START.md` - webhook URL
- `CLOUDFLARE_PAGES_SETUP.md` -
- `DELAYED_MESSAGE_DEPLOYMENT_REPORT.md` - URL
- `docs/guides/DATA_PERSISTENCE_GUIDE.md` - webhook URL
- `docs/guides/LOCAL_DEVELOPMENT_SETUP.md` - curl
- `docs/guides/LOCAL_DEVELOPMENT_VALIDATION_REPORT.md` - URL
- `docs/guides/SETUP_GUIDE.md` -
- `docs/guides/API_PROXY_SETUP.md` - URL
- `docs/guides/API_PROXY_VALIDATION_REPORT.md` - URL
- `docs/guides/CLOUDFLARE_PAGES_DEPLOYMENT.md` - URL
- `docs/guides/DEPLOYMENT_GUIDE.md` - URL

### 7. Terraform
- Terraform "multi-channel-platform"
- `main.tf``variables.tf``outputs.tf` `terraform.tfvars.example`

## URL


- `https://line-bot.example.com` `https://multi-channel-platform.example.com`

### Worker
- "multi-channel-platform"
- "line-bot.example.com/*" "multi-channel-platform.example.com/*"


### URL
 URL
- `tests/verify-line-id-collection.ts` - `https://your-worker-domain.workers.dev`
- `tests/query-customers.ts` - `https://your-worker-domain.workers.dev`
- `tests/monitor-line-id.ts` - `https://your-worker-domain.workers.dev`
- `tests/monitor-customers.ts` - `https://your-worker-domain.workers.dev`
- `tests/customer-manager.ts` - `https://your-worker-domain.workers.dev`
- `tests/customer-analytics.ts` - `https://your-worker-domain.workers.dev`
- `tests/check-line-id.ts` - `https://your-worker-domain.workers.dev`
- `tests/test-customer-flow.ts` - `https://your-worker.workers.dev`
- `frontend/wrangler.toml` - `https://your-worker-domain.workers.dev`


- "omni-channel-platform"
- R2 "omni-channel-attachments-*"


1. "line-bot"
2. URL
3.
4.
5.
6.
7. Terraform


1. ****: DNS worker
2. ** LINE Webhook**: LINE Developers Console webhook URL
3. ****: Cloudflare Pages
4. ****:


- ****: URL/
- ****:
- ****: "multi-channel-platform"
- ****: worker

## 31

### 2
- wrangler.toml
- frontend/_redirects

### 1
- src/utils/team.ts

### 6
- tests/test-message-relations.ts
- tests/test-session-management.ts
- tests/check-recent-messages.ts
- tests/verify-production.ts
- tests/test-line-api.ts
- tests/monitor-line-messages.ts

### 3
- frontend/src/views/PlatformIntegration.vue
- frontend/.env.development
- frontend/.env.local.example
- frontend/src/test/api-proxy.test.ts

### 2
- test-api.ps1
- deploy-production.ps1

### 17
- QUICK_START.md
- CLOUDFLARE_PAGES_SETUP.md
- DELAYED_MESSAGE_DEPLOYMENT_REPORT.md
- docs/guides/DATA_PERSISTENCE_GUIDE.md
- docs/guides/LOCAL_DEVELOPMENT_SETUP.md
- docs/guides/LOCAL_DEVELOPMENT_VALIDATION_REPORT.md
- docs/guides/SETUP_GUIDE.md
- docs/guides/API_PROXY_SETUP.md
- docs/guides/API_PROXY_VALIDATION_REPORT.md
- docs/guides/CLOUDFLARE_PAGES_DEPLOYMENT.md
- docs/guides/DEPLOYMENT_GUIDE.md


Worker "line-bot" "multi-channel-platform"

