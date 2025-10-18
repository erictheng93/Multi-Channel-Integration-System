# Cloudflare


 worker "multi-channel-platform" Cloudflare


### Worker: `multi-channel-platform`

#### D1
- ****: `omni-channel-platform`
- ** ID**: `37537e1f-625e-4cf9-be60-a01b5c063772`
- ****:
- ****: 0 ()
- ****: 188,416 bytes

#### KV
1. **SESSIONS**
 - ** ID**: `ace3f7202e6a4dd8b98c50e9b91b2431`
 - ** ID**: `fbb5c300d2e845b08b2cebef3e9d9c22`
 - ** ID**: `ace3f7202e6a4dd8b98c50e9b91b2431`
 - ****:

2. **CACHE**
 - ** ID**: `f3bc7a55c8a14f4fb28b8321fa01dc73`
 - ** ID**: `1e78b2edf95446c38a76799cb8cf85f4`
 - ** ID**: `f3bc7a55c8a14f4fb28b8321fa01dc73`
 - ****:

#### R2
1. ****
 - ****: `omni-channel-attachments-develop`
 - ****: 2025-08-07T03:35:51.356Z
 - ****:

2. ****
 - ****: `omni-channel-attachments-production`
 - ****: 2025-08-07T03:36:02.943Z
 - ****:

#### Queues
1. ****
 - **Queue **: `message-queue`
 - **Queue ID**: `d028b2e466b34a889781bf63ff16a511`
 - ****:
 - ****: 0
 - ****: 0

2. ****
 - **Queue **: `message-queue-prod`
 - **Queue ID**: `beb050c0c746412baa8d0cc64d8f6cb7`
 - ****:
 - ****: 0
 - ****: 0

### Worker: `multi-channel-platform-delayed`


- **Worker **: `multi-channel-platform-delayed`
- ****: `multi-channel-platform-delayed-prod`
- **D1 **: `omni-channel-platform`
- **KV **: SESSIONS CACHE
- **Queues**: message-queue


### ID
1. **wrangler.toml**
 - `your-production-sessions-kv-id` `ace3f7202e6a4dd8b98c50e9b91b2431`
 - `your-production-cache-kv-id` `f3bc7a55c8a14f4fb28b8321fa01dc73`

2. **wrangler-delayed-message.toml**
 - `your-database-id` `37537e1f-625e-4cf9-be60-a01b5c063772`
 - `your-kv-namespace-id` `f3bc7a55c8a14f4fb28b8321fa01dc73` (CACHE)
 - `your-sessions-kv-id` `ace3f7202e6a4dd8b98c50e9b91b2431` (SESSIONS)
 - `your-preview-kv-namespace-id` `1e78b2edf95446c38a76799cb8cf85f4`
 - `your-preview-sessions-kv-id` `fbb5c300d2e845b08b2cebef3e9d9c22`
 - `your-prod-database-id` `37537e1f-625e-4cf9-be60-a01b5c063772`
 - `delayed-messages` `message-queue` ( queue )
 - `delayed-messages-prod` `message-queue-prod` ( queue )


- Queue `[[queues]]` `[[queues.producers]]`
- `omni-channel-platform`
- Queue `message-queue`


- ****: 2025-08-01T13:47:54.651Z
- ** ID**: 947e65ae-857b-4fb2-b05e-333949806fd7
- ****: minimaro93@gmail.com
- ****:


- 10
- : 2025-07-31T07:32:31.003Z
-


1. **D1 **: 1 (omni-channel-platform)
2. **KV **: 4 (SESSIONS + CACHE preview)
3. **R2 **: 3 ( my-omni-channel)
4. **Queues**: 2 ()


- R2 `my-omni-channel` ()
- Queue


1. ****
 ```bash
 wrangler deploy
 wrangler deploy --config wrangler-delayed-message.toml
 ```

2. **** ()
 ```bash
 npm run db:migrate
 npm run db:migrate:prod
 ```

3. ****
 ```bash
 curl https://multi-channel-platform.imfinethankyouandyou.com/api/health
 ```


1. ** Queue ** ()
2. ** Durable Objects** ()
3. ****


- Worker : `multi-channel-platform`
- D1
- KV ()
- R2
- Queues
- Worker
- ID ID
-
-


 Cloudflare worker "multi-channel-platform" ID ID

****: - 