# MCIS


### 1. Cloudflare
- [Cloudflare](https://cloudflare.com)
- Workers Paid Plan$5/
-

### 2. LINE
- [LINE Developers](https://developers.line.biz/)
- LINE Official Account
- Messaging API Channel
- Channel Access Token Channel Secret

### 3. Facebook
- [Facebook Developers](https://developers.facebook.com/)
- Facebook App
- Messenger Platform
- Page Access Token

## Cloudflare

### 1.1 Wrangler CLI
```bash
bun install -g wrangler
wrangler login
```

### 1.2 D1
```bash

wrangler d1 create omni-channel-platform

# database_id wrangler.jsonc
```

### 1.3 KV
```bash

wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview


wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# ID wrangler.jsonc
```

### 1.4 R2
```bash

wrangler r2 bucket create omni-files


wrangler r2 bucket create omni-avatars
```

### 1.5 Queues
```bash

wrangler queues create message-processing


wrangler queues create notifications


wrangler queues create delayed-messages
```


### 2.1 wrangler.jsonc
```jsonc
{
 "$schema": "node_modules/wrangler/config-schema.json",
 "name": "mcis-worker",
 "main": "src/index.ts",
 "compatibility_date": "2024-01-01",
 "observability": {
 "logs": {
 "enabled": true
 }
 },
 "routes": [
 {
 "pattern": "mcis-backend.daiwandist.com/*",
 "zone_name": "example.com"
 }
 ],
 "d1_databases": [
 {
 "binding": "DB",
 "database_name": "omni-channel-platform",
 "database_id": "YOUR_DATABASE_ID_HERE"
 }
 ],
 "kv_namespaces": [
 {
 "binding": "SESSIONS",
 "id": "YOUR_SESSIONS_KV_ID_HERE",
 "preview_id": "YOUR_SESSIONS_PREVIEW_ID_HERE"
 },
 {
 "binding": "CACHE",
 "id": "YOUR_CACHE_KV_ID_HERE",
 "preview_id": "YOUR_CACHE_PREVIEW_ID_HERE"
 }
 ],
 "r2_buckets": [
 {
 "binding": "FILES",
 "bucket_name": "omni-files"
 },
 {
 "binding": "AVATARS",
 "bucket_name": "omni-avatars"
 }
 ],
 "queues": {
 "producers": [
 {
 "binding": "MESSAGE_QUEUE",
 "queue": "message-processing"
 },
 {
 "binding": "NOTIFICATION_QUEUE",
 "queue": "notifications"
 },
 {
 "binding": "DELAYED_QUEUE",
 "queue": "delayed-messages"
 }
 ],
 "consumers": [
 {
 "queue": "message-processing",
 "max_batch_size": 10,
 "max_batch_timeout": 30
 },
 {
 "queue": "notifications",
 "max_batch_size": 5,
 "max_batch_timeout": 10
 },
 {
 "queue": "delayed-messages",
 "max_batch_size": 1,
 "max_batch_timeout": 1
 }
 ]
 },
 "crons": [
 {
 "cron": "*/5 * * * *",
 "name": "cleanup-expired-sessions"
 },
 {
 "cron": "0 */6 * * *",
 "name": "generate-statistics"
 }
 ]
}
```

### 2.2 (Secrets)
```bash
# LINE
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET

# Facebook
wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
wrangler secret put FACEBOOK_APP_SECRET

# JWT
wrangler secret put JWT_SECRET


wrangler secret put ENCRYPTION_KEY


wrangler secret put ADMIN_PASSWORD
```


### 3.1
```bash
mkdir -p migrations
```

### 3.2
```bash

wrangler d1 migrations apply omni-channel-platform --local


wrangler d1 migrations apply omni-channel-platform
```

### 3.3
```bash

wrangler d1 execute omni-channel-platform --local --file=./seed.sql
```


### 4.1
```bash

bun install


bun run cf-typegen


bun run dev
```

### 4.2 API
```bash

curl http://localhost:8787/health

# Webhook LINE Channel Secret
curl -X POST http://localhost:8787/api/webhooks/line \
 -H "Content-Type: application/json" \
 -d '{"events":[]}'
```

### 4.3
```bash

wrangler d1 execute omni-channel-platform --local --command="SELECT * FROM users LIMIT 5"
```


### 5.1 Workers
```bash
# Worker
bun run deploy


wrangler deployments list
```

### 5.2 LINE Webhook
1. LINE Developers Console
2. Messaging API Channel
3. "Webhook settings"
 - Webhook URL: `https://your-domain.com/api/webhook`
 - "Use webhook"

### 5.3 Facebook Webhook
1. Facebook Developers Console
2. Webhook URL: `https://your-domain.com/api/facebook/webhook`
3.


### 6.1
```bash
# Worker
wrangler tail

# D1
wrangler d1 info omni-channel-platform

# KV
wrangler kv:namespace list
```

### 6.2
```bash

wrangler d1 export omni-channel-platform --output=backup-$(date +%Y%m%d).sql
```


### 7.1 CORS

- CORS
-
-
- SQL

### 7.2 Rate Limiting
```typescript
// IP
```

### 7.3 SSL/TLS
Cloudflare SSL


### 8.1
- [ ] LINE Webhook
- [ ]
- [ ]
- [ ]
- [ ]

### 8.2
- [ ]
- [ ]
- [ ]
- [ ] QR Code
- [ ]


### Q1:
```bash
# ID
wrangler d1 list


wrangler d1 info omni-channel-platform
```

### Q2: Secrets
```bash
# secrets
wrangler secret list

# secret
wrangler secret put SECRET_NAME
```

### Q3:
```bash
# wrangler.jsonc
bunx jsonc-parser wrangler.jsonc

# TypeScript
bunx tsc --noEmit
```

### Q4: LINE Webhook
- Channel Secret
- Webhook URL
- Worker


1. ** MVP ** MIGRATION_PLAN.md
2. **** Cloudflare Pages
3. **** Facebook MessengerInstagram
4. ****
5. ****


 MCIS MVP 