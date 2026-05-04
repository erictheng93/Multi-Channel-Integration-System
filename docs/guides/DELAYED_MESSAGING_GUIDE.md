# (Durable Objects )

> ****: **Durable Objects** 2025-09-30
> Queue-based 2025-10-07


 1-120 **** <100ms


- ****: <100ms 100%
- ****: ±10ms Alarm API
- ****: Durable Object Queue + KV
- ****: Prometheus
- ****: ( 3 )
- **Dead Letter Queue**:
- ****: LINE Facebook Messenger

---


```

 (Vue 3)
 DelayedMessageSender.vue
 useDelayedMessage.ts


 HTTP Request


 API Handler (Hono)
 src/handlers/delayed-message-buffer.ts

 POST /api/delayed-messages-v2/send
 DELETE /api/delayed-messages-v2/cancel/:messageId
 GET /api/delayed-messages-v2/status/:messageId
 GET /api/delayed-messages-v2/pending
 GET /api/delayed-messages-v2/metrics
 GET /api/delayed-messages-v2/dlq


 Durable Object


 DelayedMessageBuffer (Durable Object)
 src/durable-objects/DelayedMessageBuffer.ts

 conversation DO


 pendingMessages: Map<id, PendingMessage>
 nextAlarmTime: number
 metrics: { sent, failed, cancelled, ... }


 (Durable Object Storage)
 msg:{messageId} PendingMessage
 dlq:{messageId} FailedMessage


 Alarm API ()


 API
 LINE Messaging API
 Facebook Messenger API

```


#### ****

```
1. + (1-120)

2. POST /api/delayed-messages-v2/send

3. API Handler

4. DelayedMessageBuffer DO
 ( conversationId DO )

5. DO schedule() :
 Map (<10ms)
 DO Storage
 Alarm API ()

6. (<50ms )
 {
 "messageId": "uuid",
 "scheduledAt": timestamp,
 "canCancelUntil": timestamp,
 "delaySeconds": 30
 }

7.
```

#### ** (Alarm )**

```
1. Alarm API DO.alarm()

2.

3. (Promise.allSettled):

 (1s, 2s, 4s)
 10 API

4. :
 D1 messages
 conversations.lastMessageAt
 DO


5. :
 Dead Letter Queue


6. Alarm
```

#### ****

```
1.

2. DELETE /api/delayed-messages-v2/cancel/:messageId

3. API Handler

4. DO.cancel() :
 pending

 Map (<10ms)
 DO Storage
 Alarm ()

5. (<100ms )
 {
 "success": true,
 "messageId": "uuid",
 "cancelledAt": timestamp
 }

6.
```

---

## API

### 1.

****: `POST /api/delayed-messages-v2/send`

****:
```json
{
 "conversationId": "123",
 "content": "",
 "delaySeconds": 30,
 "messageType": "text",
 "platform": "line",
 "recipientPlatformId": "U1234567890abcdef"
}
```

****:
- `conversationId` (): ID
- `content` ():
- `delaySeconds` (): (1-120)
- `messageType` (): "text"
- `platform` (): ("line" | "facebook")
- `recipientPlatformId` (): ID

**** (200):
```json
{
 "success": true,
 "data": {
 "messageId": "550e8400-e29b-41d4-a716-446655440000",
 "scheduledAt": 1704067830000,
 "canCancelUntil": 1704067830000,
 "delaySeconds": 30,
 "conversationId": "123"
 },
 "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**** (400/403/500):
```json
{
 "success": false,
 "error": "Delay seconds must be between 1 and 120"
}
```

---

### 2.

****: `DELETE /api/delayed-messages-v2/cancel/:messageId`

** Body**:
```json
{
 "conversationId": "123",
 "reason": ""
}
```

****:
- `:messageId` (URL ): ID
- `conversationId` (): ID
- `reason` ():

**** (200):
```json
{
 "success": true,
 "data": {
 "messageId": "550e8400-e29b-41d4-a716-446655440000",
 "cancelledAt": 1704067815000,
 "cancelledBy": "Agent Name"
 },
 "timestamp": "2024-01-01T12:00:15.000Z"
}
```

**** (400):
```json
{
 "success": false,
 "error": "Message not found or already processed"
}
```

---

### 3.

****: `GET /api/delayed-messages-v2/status/:messageId?conversationId=xxx`

****:
- `:messageId` (URL ): ID
- `conversationId` (): ID

**** (200):
```json
{
 "success": true,
 "data": {
 "exists": true,
 "status": "pending",
 "timeRemaining": 15,
 "canCancel": true,
 "scheduledAt": 1704067830000
 },
 "timestamp": "2024-01-01T12:00:15.000Z"
}
```

****:
- `pending`:
- `sent`:
- `cancelled`:
- `failed`:
- `not_found`:

---

### 4.

****: `GET /api/delayed-messages-v2/pending?conversationId=xxx`

****:
- `conversationId` (): ID

**** (200):
```json
{
 "success": true,
 "data": {
 "conversationId": "123",
 "count": 3,
 "messages": [
 {
 "id": "msg-1",
 "content": "...",
 "scheduledAt": 1704067830000,
 "timeRemaining": 15000
 },
 {
 "id": "msg-2",
 "content": "...",
 "scheduledAt": 1704067860000,
 "timeRemaining": 45000
 }
 ]
 },
 "timestamp": "2024-01-01T12:00:15.000Z"
}
```

---

### 5.

****: `GET /api/delayed-messages-v2/metrics`

****:

**** (200):
```json
{
 "counters": {
 "messages_scheduled_total": 1523,
 "messages_sent_total": 1450,
 "messages_failed_total": 23,
 "messages_cancelled_total": 50,
 "retry_attempts_total": 45,
 "dlq_writes_total": 23,
 "alarm_triggers_total": 1200
 },
 "platform_metrics": {
 "line": {
 "successes": 1200,
 "failures": 15,
 "success_rate_percent": "98.77"
 },
 "facebook": {
 "successes": 250,
 "failures": 8,
 "success_rate_percent": "96.90"
 }
 },
 "gauges": {
 "pending_messages_count": 5,
 "dlq_size": 23,
 "next_alarm_scheduled": "2024-01-01T12:05:30.000Z"
 },
 "histograms": {
 "send_duration_ms": {
 "p50": 150,
 "p95": 450,
 "p99": 850
 }
 },
 "derived": {
 "overall_success_rate_percent": "98.44",
 "total_messages_processed": 1473
 }
}
```

---

### 6. Dead Letter Queue

****: `GET /api/delayed-messages-v2/dlq`

****:

**** (200):
```json
{
 "success": true,
 "count": 23,
 "messages": [
 {
 "id": "failed-msg-1",
 "content": "...",
 "platform": "line",
 "failedAt": 1704067800000,
 "failureReason": "LINE API request timeout after 10s",
 "retryCount": 3,
 "scheduledAt": 1704067770000,
 "conversationId": "123"
 }
 ],
 "timestamp": 1704067900000
}
```

---


### 1. Composable ()

```typescript
// Vue
import { useDelayedMessage } from '@/composables/useDelayedMessage'

const {
 sendDelayedMessage,
 cancelMessage,
 getMessageStatus,
 getPendingMessages,
 isLoading,
 error
} = useDelayedMessage()

//
const sendMessage = async () => {
 const result = await sendDelayedMessage({
 conversationId: '123',
 content: '',
 delaySeconds: 15,
 platform: 'line',
 recipientPlatformId: 'U1234567890'
 })

 if (result.success) {
 console.log(':', result.data.messageId)
 }
}

//
const cancel = async (messageId: string) => {
 const result = await cancelMessage(messageId, '123', '')

 if (result.success) {
 console.log('')
 }
}

// ()
const checkStatus = async (messageId: string) => {
 const status = await getMessageStatus(messageId, '123')

 if (status.exists && status.canCancel) {
 console.log(`: ${status.timeRemaining} `)
 }
}
```

### 2. UI

```vue
<template>
 <div class="conversation-detail">
 <!-- -->
 <MessageList :messages="messages" />

 <!-- -->
 <DelayedMessageSender
 :conversation-id="conversationId"
 :platform="platform"
 :recipient-platform-id="recipientPlatformId"
 @message-sent="handleMessageSent"
 @message-cancelled="handleMessageCancelled"
 @error="handleError"
 />
 </div>
</template>

<script setup lang="ts">
import DelayedMessageSender from '@/components/messaging/DelayedMessageSender.vue'
import MessageList from '@/components/messaging/MessageList.vue'

const conversationId = ref('123')
const platform = ref('line')
const recipientPlatformId = ref('U1234567890')

const handleMessageSent = (data: any) => {
 console.log(':', data)
 //
}

const handleMessageCancelled = (messageId: string) => {
 console.log(':', messageId)
 // UI
}

const handleError = (error: Error) => {
 console.error(':', error)
 //
}
</script>
```

---


- Cloudflare Workers
- Wrangler CLI
- D1

### 1. wrangler.toml

 `wrangler.toml` Durable Objects

```toml
# Durable Objects
[[durable_objects.bindings]]
name = "DELAYED_MESSAGE_BUFFER"
class_name = "DelayedMessageBuffer"

# Migrations
[[migrations]]
tag = "v2"
new_classes = ["DelayedMessageBuffer"]
```

### 2.

```bash
# Worker ( Durable Objects)
bun run deploy

# Wrangler
bunx wrangler deploy
```

### 3.

```bash

curl https://your-domain.com/api/delayed-messages-v2/health

# :
{
 "success": true,
 "service": "delayed-message-buffer",
 "status": "healthy",
 "features": {
 "instantCancel": true,
 "preciseScheduling": true,
 "durableObjects": true
 }
}
```

---


### 1.

```bash

curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 https://your-domain.com/api/delayed-messages-v2/metrics

# (DLQ)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 https://your-domain.com/api/delayed-messages-v2/dlq
```

### 2. Cloudflare Dashboard

 Cloudflare Dashboard
- **Durable Objects**: DO CPU
- **Analytics**:
- **Logs**:

```bash

bunx wrangler tail
```

### 3.


| | | |
|------|--------|------|
| `overall_success_rate_percent` | < 95% | |
| `dlq_size` | > 100 | DLQ |
| `platform_failures.line` | > 10/ | LINE API |
| `alarm_triggers_total` | 0 (1) | Alarm |

---


#### 1.

****:

****:
- Alarm API
- Durable Object

****:
```bash
# 1.
curl https://your-domain.com/api/delayed-messages-v2/status/MESSAGE_ID?conversationId=CONV_ID

# 2.
curl https://your-domain.com/api/delayed-messages-v2/metrics

# 3. Cloudflare Dashboard
# - Durable Objects
# - Workers
```

****:
- Alarm DO
- `next_alarm_scheduled`
-

---

#### 2.

****:

****:
-
- conversationId

****:
```bash

curl https://your-domain.com/api/delayed-messages-v2/status/MESSAGE_ID?conversationId=CONV_ID

# :
{
 "exists": true,
 "status": "pending", # pending
 "canCancel": true # true
}
```

****:
- `canCancel` `true`
- `conversationId`
-

---

#### 3. DLQ

****: DLQ

****:
- API LINE/Facebook
-
- Token

****:
```bash
# DLQ
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
 https://your-domain.com/api/delayed-messages-v2/dlq


# failureReason
```

****:
- API LINE/Facebook Status Page
- Access Token
- `LINE_CHANNEL_ACCESS_TOKEN` `FB_PAGE_ACCESS_TOKEN`
-

---

#### 4.

****: metrics

****:
- Durable Object
-

****:
```bash
# Worker ( DO )
bunx wrangler deploy

# Cloudflare Dashboard
# - Durable Objects CPU/Memory
```

---


### 1.

 APIDurable Objects

```typescript
// :
const messages = [msg1, msg2, msg3]
const results = await Promise.allSettled(
 messages.map(msg => sendDelayedMessage(msg))
)

// : API ()
```

### 2.


```typescript
// :
const countdown = ref(delaySeconds)
const timer = setInterval(() => {
 countdown.value--
 if (countdown.value <= 0) {
 clearInterval(timer)
 }
}, 1000)

// : API
```

### 3.

Durable Objects

```typescript
// :
const result = await sendDelayedMessage(data)
if (!result.success) {
 //
}

// : ()
```

---


### Queue-based

> `AGENT_QUEUE`

#### 1: API

| | |
|--------|--------|
| `POST /api/messages/delayed/send` | `POST /api/delayed-messages-v2/send` |
| `POST /api/messages/delayed/recall` | `DELETE /api/delayed-messages-v2/cancel/:messageId` |
| `GET /api/messages/delayed/list` | `GET /api/delayed-messages-v2/pending?conversationId=xxx` |

#### 2:

 `platform` `recipientPlatformId`

```diff
{
 "conversationId": "123",
 "content": "",
 "delaySeconds": 30,
+ "platform": "line",
+ "recipientPlatformId": "U1234567890"
}
```

#### 3:

```diff
- POST /api/messages/delayed/recall
+ DELETE /api/delayed-messages-v2/cancel/:messageId

// Body
{
- "messageId": "xxx"
+ "conversationId": "123",
+ "reason": ""
}
```

#### 4:

```bash

curl -X POST https://your-domain.com/api/delayed-messages-v2/send \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "conversationId": "123",
 "content": "",
 "delaySeconds": 10,
 "platform": "line",
 "recipientPlatformId": "U1234567890"
 }'


curl -X DELETE https://your-domain.com/api/delayed-messages-v2/cancel/MESSAGE_ID \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "conversationId": "123",
 "reason": ""
 }'
```

---


### Durable Objects

 Queue-based Durable Objects

| | Queue | Durable Objects |
|------|-----------|---------------------|
| | 100-500ms | <100ms |
| | | 100% |
| | ±500ms | ±10ms |
| | (Queue+KV+DB) | ( DO) |
| | | ( metrics) |

### Alarm API

Durable Objects Alarm API
- ****:
- ****: Alarm
- ****: DO Alarm


 Durable Object
1. Storage `pendingMessages` Map
2. Alarm
3.

---


### 1.

 API JWT

```typescript
//
const hasPermission = await PermissionService.checkPermission(
 user.id,
 'message',
 'send',
 { conversationId }
)
```

### 2.

 1-120
- < 1
- > 120

### 3. DLQ

DLQ

---


### A.

#### Vue 3

```vue
<template>
 <div class="delayed-message-sender">
 <textarea
 v-model="messageContent"
 placeholder="..."
 class="message-input"
 />

 <div class="delay-selector">
 <label>:</label>
 <select v-model="delaySeconds">
 <option :value="5">5 </option>
 <option :value="10">10 </option>
 <option :value="15">15 </option>
 <option :value="30">30 </option>
 <option :value="60">60 </option>
 </select>
 </div>

 <button
 @click="handleSend"
 :disabled="isLoading || !messageContent"
 class="send-button"
 >

 </button>

 <!-- -->
 <div v-if="pendingMessages.length > 0" class="pending-messages">
 <h3></h3>
 <div
 v-for="msg in pendingMessages"
 :key="msg.id"
 class="pending-message"
 >
 <p>{{ msg.content }}</p>
 <div class="countdown">
 : {{ msg.timeRemaining }}
 </div>
 <button
 @click="handleCancel(msg.id)"
 class="cancel-button"
 >

 </button>
 </div>
 </div>

 <!-- -->
 <div v-if="error" class="error-message">
 {{ error }}
 </div>
 </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useDelayedMessage } from '@/composables/useDelayedMessage'

const props = defineProps<{
 conversationId: string
 platform: 'line' | 'facebook'
 recipientPlatformId: string
}>()

const emit = defineEmits<{
 (e: 'message-sent', data: any): void
 (e: 'message-cancelled', messageId: string): void
}>()

const {
 sendDelayedMessage,
 cancelMessage,
 getPendingMessages,
 isLoading,
 error
} = useDelayedMessage()

const messageContent = ref('')
const delaySeconds = ref(15)
const pendingMessages = ref<any[]>([])
let countdownTimer: NodeJS.Timeout | null = null

const handleSend = async () => {
 if (!messageContent.value) return

 const result = await sendDelayedMessage({
 conversationId: props.conversationId,
 content: messageContent.value,
 delaySeconds: delaySeconds.value,
 platform: props.platform,
 recipientPlatformId: props.recipientPlatformId
 })

 if (result.success) {
 messageContent.value = ''
 emit('message-sent', result.data)
 await refreshPendingMessages()
 }
}

const handleCancel = async (messageId: string) => {
 const result = await cancelMessage(
 messageId,
 props.conversationId,
 ''
 )

 if (result.success) {
 emit('message-cancelled', messageId)
 await refreshPendingMessages()
 }
}

const refreshPendingMessages = async () => {
 const result = await getPendingMessages(props.conversationId)
 if (result.success) {
 pendingMessages.value = result.data.messages
 }
}

//
const startCountdown = () => {
 countdownTimer = setInterval(() => {
 pendingMessages.value = pendingMessages.value.map(msg => ({
 ...msg,
 timeRemaining: Math.max(0, Math.ceil((msg.scheduledAt - Date.now()) / 1000))
 })).filter(msg => msg.timeRemaining > 0)
 }, 1000)
}

onMounted(() => {
 refreshPendingMessages()
 startCountdown()
})

onUnmounted(() => {
 if (countdownTimer) {
 clearInterval(countdownTimer)
 }
})
</script>

<style scoped>
.delayed-message-sender {
 padding: 1rem;
 border: 1px solid #e0e0e0;
 border-radius: 8px;
}

.message-input {
 width: 100%;
 min-height: 80px;
 padding: 0.5rem;
 border: 1px solid #ccc;
 border-radius: 4px;
 resize: vertical;
}

.delay-selector {
 margin: 1rem 0;
 display: flex;
 align-items: center;
 gap: 0.5rem;
}

.send-button {
 padding: 0.5rem 1rem;
 background: #4CAF50;
 color: white;
 border: none;
 border-radius: 4px;
 cursor: pointer;
}

.send-button:disabled {
 background: #ccc;
 cursor: not-allowed;
}

.pending-messages {
 margin-top: 1rem;
 padding-top: 1rem;
 border-top: 1px solid #e0e0e0;
}

.pending-message {
 padding: 0.5rem;
 margin-bottom: 0.5rem;
 background: #f5f5f5;
 border-radius: 4px;
 display: flex;
 justify-content: space-between;
 align-items: center;
}

.countdown {
 font-weight: bold;
 color: #ff5722;
}

.cancel-button {
 padding: 0.25rem 0.5rem;
 background: #f44336;
 color: white;
 border: none;
 border-radius: 4px;
 cursor: pointer;
}

.error-message {
 margin-top: 1rem;
 padding: 0.5rem;
 background: #ffebee;
 color: #c62828;
 border-radius: 4px;
}
</style>
```

### B.

```
Queue-Based ()
 (Queue + KV + DB + Consumer)

 (±500ms)


Durable Objects ()
 DO
 100% (<100ms)
 (±10ms)
 DLQ
 +
```

---


- [Cloudflare Durable Objects ](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Alarms API ](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [LINE Messaging API ](https://developers.line.biz/en/docs/messaging-api/)
- [Facebook Messenger API ](https://developers.facebook.com/docs/messenger-platform)

---

****: v2.0 ( Durable Objects)
****: 2025-10-15
****: 2025-09-30
****: 2025-10-07
