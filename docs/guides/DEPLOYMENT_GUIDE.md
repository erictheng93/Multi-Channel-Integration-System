# ()

** **:
****: [](../NEW_USER_DEPLOYMENT_GUIDE.md)


 Cloudflare Workers v3.0

### v3.0
- ****: LINE OA, Facebook Messenger
- ****: Admin, Team, Agent
- ****:
- **QR Code **:
- ****: (1-120)
- **API **: API
- ****:
- ****: Durable Objects WebSocket
- ****: /

### v3.0
- ****: Cloudflare Workers + Hono.js + Drizzle ORM
- ****: Vue 3 + Composition API + TypeScript
- ****: Cloudflare D1 (SQLite)
- ****: Cloudflare KV (Session + )
- ****: Cloudflare R2 ()
- ****: Cloudflare Queues ()
- ****: Durable Objects + WebSocket
- ****: Terraform (IaC) + PowerShell


****:
- ****: `.\scripts\user-deploy.ps1` (Terraform )
- ****: `.\scripts\developer-deploy.ps1` ()
- ****: [](../NEW_USER_DEPLOYMENT_GUIDE.md)


---

## ()

### 1.

```bash
# Wrangler CLI
npm install -g wrangler

# Cloudflare
wrangler login


git clone <your-repo>
cd multi-channel-platform


npm install
```

### 2. Cloudflare

#### 2.1 D1
```bash

wrangler d1 create omni-channel-platform

# Drizzle
npm run db:generate
npm run db:migrate:prod

# SQL
wrangler d1 execute omni-channel-platform --file=./database/schema.sql
```

#### 2.2 KV
```bash
# Sessions KV ( session )
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# Cache KV ()
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# wrangler.toml KV namespace IDs
```

#### 2.3 R2
```bash
# R2
wrangler r2 bucket create multi-channel-platform-files
```

#### 2.4 Queues
```bash

wrangler queues create message-queue
wrangler queues create delayed-message-queue
```

### 3.

 `.dev.vars` `.env.example`

```env
# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# Facebook Messenger
FACEBOOK_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_VERIFY_TOKEN=your-facebook-verify-token

# Cloudflare ( Drizzle)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_DATABASE_ID=37537e1f-625e-4cf9-be60-a01b5c063772
CLOUDFLARE_D1_TOKEN=your-cloudflare-d1-token


MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf


ENVIRONMENT=production
APP_URL=https://multi-channel-platform.workers.dev
FRONTEND_URL=https://your-frontend.pages.dev
```

### 4. wrangler.toml

 `wrangler.toml` Drizzle

```toml
name = "multi-channel-platform"
main = "src/index-drizzle.ts" # Drizzle ORM
compatibility_date = "2025-07-31"
compatibility_flags = ["nodejs_compat"]

# D1
[[d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"
database_id = "37537e1f-625e-4cf9-be60-a01b5c063772"

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-kv-id" # ID
preview_id = "your-sessions-kv-preview-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-kv-id" # ID
preview_id = "your-cache-kv-preview-id"

# R2
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "omni-channel-attachments-production"

# Queues
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue-prod"


[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"
database_id = "37537e1f-625e-4cf9-be60-a01b5c063772"
```

### 5.

 Vue.js Cloudflare Pages

#### 5.1

```bash

cd frontend


npm install

# ( Pages )
npm run build:pages
```

#### 5.2 Cloudflare Pages

```bash
# Wrangler Pages
wrangler pages deploy frontend/dist --project-name=multi-channel-platform-frontend

# PowerShell
.\deploy-frontend.ps1 production
```

### 6.

#### 6.1 (Cloudflare Workers)

```bash

wrangler dev


wrangler deploy --env production
```

#### 6.2 (Cloudflare Pages)

```bash
# ( frontend/ )
cd frontend && npm run dev


cd frontend && npm run build:pages
wrangler pages deploy dist --project-name=multi-channel-platform-frontend
```

#### 6.3

 Cloudflare Pages Dashboard

****:
```
VITE_API_BASE_URL=https://multi-channel-platform.workers.dev
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
```

****:
```
VITE_API_BASE_URL=https://multi-channel-platform.workers.dev
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

### 7. Webhook

#### 6.1 Line Bot Webhook
 Line Developers Console
- Webhook URL: `https://multi-channel-platform.workers.dev/api/webhook`
- Webhook

#### 6.2 Facebook Messenger Webhook
 Facebook Developers Console
- Webhook URL: `https://multi-channel-platform.workers.dev/api/webhook` (Facebook )
- Verify Token: `.dev.vars` `FB_VERIFY_TOKEN`
- : messages, messaging_postbacks

### 8.

#### 7.1
```bash
# Wrangler SQL
wrangler d1 execute multi-channel-platform --command="
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES ('admin', 'admin@example.com', 'hashed_password', 'admin', TRUE)
"
```

#### 7.2
```bash
wrangler d1 execute multi-channel-platform --command="
INSERT INTO teams (name, description, is_active)
VALUES ('', '', TRUE)
"
```


### 1.
 `https://multi-channel-platform.workers.dev/admin-dashboard.html`

### 2. API


- `POST /api/auth/login` -
- `POST /api/auth/logout` -
- `GET /api/auth/profile` -


- `GET /api/teams` -
- `POST /api/teams` -
- `POST /api/teams/:id/qr-code` - QR Code


- `GET /api/conversations` -
- `POST /api/conversations/:id/assign` -
- `POST /api/conversations/:id/transfer` -


- `POST /api/messages/send` -
- `POST /api/messages/:id/recall` -
- `GET /api/messages/pending` -

### 3. Webhook
- `POST /api/webhooks/line` - LINE Bot Webhook
- `POST /api/webhooks/facebook` - Facebook Messenger Webhook
- `POST /api/webhook` - ( LINE)


### 1.
```bash
# Worker
wrangler tail


wrangler tail --env production
```

### 2.
```bash

wrangler d1 execute multi-channel-platform --command="SELECT COUNT(*) FROM messages"


wrangler d1 export multi-channel-platform --output backup.sql
```

### 3.
- Cloudflare Analytics
- D1
- KV R2


### 1.
1. `src/integrations/`
2. `PlatformAdapter`
3. Worker Webhook

### 2.
1. `src/services/permission-service.ts`
2.
3.

### 3. AI
1. OpenAI AI
2.
3.


1. **Webhook **
 - Channel Secret
 - Webhook URL

2. ****
 - D1 ID
 - Worker

3. ****
 - Access Token
 - Bot

4. ****
 -
 -


1. ****
```bash

wrangler d1 execute multi-channel-platform --local --file=./schema.sql


wrangler dev --local
```

2. ****
```bash

wrangler tail --format pretty


wrangler tail --search "ERROR"
```


1. ****
 - Cloudflare Workers Secrets
 - API

2. ****
 -
 - SQL

3. ****
 -
 -

4. ****
 -
 - HTTPS


1. ****
 - KV
 -

2. ****
 -
 -

3. ****
 -
 - API


1. ****
 -
 -

2. ****
 -
 -

3. ****
 - Cloudflare
 -

---


1. [Cloudflare Workers ](https://developers.cloudflare.com/workers/)
2. [Line Bot SDK ](https://developers.line.biz/en/docs/)
3. [Facebook Messenger API ](https://developers.facebook.com/docs/messenger-platform/)

---

****: 1.0.0
****: 2025-01-08