


1. **Cloudflare Queues** -
2. **Cloudflare KV** - TTL
3. **Cloudflare D1** -


- ****: KV
- ****: Queues
- ****: Durable Objects
- ****:


### 1. Cloudflare Queues

#### 1.1 wrangler.toml
```toml
# Queues -
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue"

# Queues
[[env.production.queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue-prod"
```

#### 1.2 Queue
```bash

wrangler queues create message-queue


wrangler queues create message-queue-prod
```

### 2.

#### 2.1
```bash

wrangler d1 execute DB --local --file=database/delayed-messages-schema.sql


wrangler d1 execute DB --file=database/delayed-messages-schema.sql
```

#### 2.2
```bash

wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%message%';"
```

### 3. Worker

#### 3.1 Worker
```bash

wrangler deploy


wrangler deploy --env production
```

#### 3.2 Queue Consumer
```bash
# Queue Consumer
wrangler deploy --config wrangler-delayed-message.toml
```

### 4.


```bash
# LINE
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret

# Facebook
FB_PAGE_ACCESS_TOKEN=your_fb_token
FB_VERIFY_TOKEN=your_fb_verify_token


ENVIRONMENT=production
```

### 5.

#### 5.1 API
```bash

curl -X POST https://your-api-domain.example.com/api/delayed-messages/send \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 -d '{
 "conversationId": 1,
 "content": "",
 "delaySeconds": 10
 }'


curl -X POST https://your-api-domain.example.com/api/delayed-messages/recall \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 -d '{
 "messageId": "your-message-id"
 }'
```

#### 5.2 Queue
```bash
# Queue
wrangler queues list

# Queue
wrangler queues consumer list message-queue
```


### 1.

#### 1.1 Worker
```bash

wrangler tail


wrangler tail --since 1h
```

#### 1.2 Queue
```bash
# Queue
wrangler queues consumer list message-queue


wrangler queues consumer show message-queue
```

### 2.

#### 2.1 KV
- KV
- TTL
-

#### 2.2 D1
-
-
-

### 3.

#### 3.1
```sql
-- 7
DELETE FROM pending_messages
WHERE status IN ('sent', 'cancelled', 'failed')
AND updated_at < datetime('now', '-7 days');

-- 30
DELETE FROM message_recall_logs
WHERE created_at < datetime('now', '-30 days');
```

#### 3.2
 Cron Trigger

```toml
# wrangler.toml
[[triggers.crons]]
cron = "0 2 * * *" # 2
```


### 1.

#### 1.1 Queue
- Queue Consumer
- Queue
- Worker

#### 1.2
- KV
- TTL
-

#### 1.3
- API
-
- API

### 2.

#### 2.1
```bash
# Worker
wrangler dev

# Queue
wrangler queues consumer add message-queue --script-name=your-worker
```

#### 2.2
```bash

wrangler tail --env production


wrangler analytics
```


### 1. KV
- TTL
- API
-

### 2. Queue
-
-
- Queue

### 3. D1
-
-
-


### 1.
-
- JWT
-

### 2.
-
-
-

### 3. API
-
-
- HTTPS


### 1. Cloudflare
- **Workers**:
- **KV**:
- **D1**:
- **Queues**:

### 2.
- TTL KV
- D1
- API

 Cloudflare 