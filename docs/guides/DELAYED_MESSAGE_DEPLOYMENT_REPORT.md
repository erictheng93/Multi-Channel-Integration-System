

 Cloudflare Workers


### 1. Cloudflare Queues
- ** Queue**: `message-queue`
- ** Queue**: `message-queue-prod`
- **Consumer **: 10 5

```bash
 Created queue 'message-queue'
 Created queue 'message-queue-prod'
```

### 2. KV
- **SESSIONS KV**: `ace3f7202e6a4dd8b98c50e9b91b2431`
- **SESSIONS Preview**: `fbb5c300d2e845b08b2cebef3e9d9c22`
- **CACHE KV**: `f3bc7a55c8a14f4fb28b8321fa01dc73`
- **CACHE Preview**: `1e78b2edf95446c38a76799cb8cf85f4`

### 3.
- ****: 12 SQL
- ****: 12 19 16


- `pending_messages` -
- `message_recall_logs` -
-

### 4. Worker
- ****: `multi-channel-platform`
- ****: 374.50 KiB / gzip: 76.03 KiB
- ****: 22 ms
- ****: 2025-08-12T08:36:45.898Z

### 5.
Worker
- KV Namespace: SESSIONS
- KV Namespace: CACHE
- Queue: MESSAGE_QUEUE
- D1 Database: DB
- R2 Bucket: R2_BUCKET


- ****: `GET /health` - 200 OK
- **API **: `GET /api` - 200 OK
- ****:

### API

- `POST /api/delayed-messages/send` -
- `POST /api/delayed-messages/recall/:messageId` -
- `GET /api/delayed-messages/pending` -
- `POST /api/delayed-messages/process` - Queue


1. **Cloudflare Queues** -
2. **Cloudflare KV** -
3. **Cloudflare D1** -


- ****: KV
- ****: Queues
- ****: Durable Objects
- ****:


### wrangler.toml
```toml
# Queues -
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue"

[[queues.consumers]]
queue = "message-queue"
max_batch_size = 10
max_batch_timeout = 5

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS"
id = "ace3f7202e6a4dd8b98c50e9b91b2431"
preview_id = "fbb5c300d2e845b08b2cebef3e9d9c22"

[[kv_namespaces]]
binding = "CACHE"
id = "f3bc7a55c8a14f4fb28b8321fa01dc73"
preview_id = "1e78b2edf95446c38a76799cb8cf85f4"
```


### MessageRecallService
- ****: D1 KV Queue
- ****: KV D1
- ** Queue**: KV

### Queue Consumer
- ****:
- ****:
- ****:


- **URL**: https://multi-channel-platform.example.com
- ****:
- ****:


- **Queue**: `message-queue-prod`
- ****:
- ****: `wrangler deploy --env production`


- ****: Cloudflare Workers
- ****: `wrangler tail`
- ****: `wrangler analytics`


- ****: SQL
- ****:
- ****:


1. ****: JWT token
2. ****: KV/Queue/D1
3. ****:

### (1-2 )
1. ****: JWT
2. ****:
3. ****:

### (1 )
1. ****:
2. ****:
3. ****:


- ****: 100%
- ****: 100%
- ****: 100%
- **API **: 100%


- ****:
- ****:
- ****:
- ****:


- ****: 100% TypeScript
- ****:
- ****:
- ****:


 **Cloudflare Queues + KV + D1**

1. **** - KV
2. **** - Queues
3. **** - D1
4. **** -


---

****: 2025812 16:39 UTC
****: v1.0.0 -
****:
****: 24 