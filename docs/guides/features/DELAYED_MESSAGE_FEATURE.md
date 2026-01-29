# (Delayed Message Feature)


- ****: 1-120
- ****: 510153060120
- ****:
- ****:


- ****:
- ****:
- ****:


- ****:
- ****:
- ****:
- ****:


#### DelayedMessageSender.vue


```vue
<template>
 <div class="delayed-message-sender">
 <!-- -->
 <div class="message-input-container">
 <!-- -->
 <!-- -->
 </div>
 </div>
</template>
```

****:
-
-
- vs
-
-

#### useDelayedMessage Composable


```typescript
export function useDelayedMessage() {
 return {
 //
 isLoading,
 pendingMessages,
 error,

 //
 sendDelayedMessage,
 recallMessage,
 getPendingMessages,
 clearError,
 reset
 }
}
```


#### (src/handlers/delayed-message.ts)
```typescript
export const delayedMessageHandler = {
 send, //
 recall, //
 list, //
 processQueue //
}
```


```sql
--
CREATE TABLE pending_messages (
 id TEXT PRIMARY KEY,
 conversation_id INTEGER NOT NULL,
 sender_id INTEGER NOT NULL,
 content TEXT NOT NULL,
 delay_seconds INTEGER NOT NULL,
 scheduled_send_time DATETIME NOT NULL,
 recall_deadline DATETIME NOT NULL,
 status TEXT DEFAULT 'pending'
);

--
CREATE TABLE message_recall_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 message_id TEXT NOT NULL,
 user_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API


```http
POST /api/messages/delayed/send
Content-Type: application/json
Authorization: Bearer <token>

{
 "conversationId": 1,
 "content": "",
 "delaySeconds": 30,
 "messageType": "text"
}
```

****:
```json
{
 "success": true,
 "data": {
 "messageId": "msg-uuid-123",
 "canRecall": true,
 "recallDeadline": "2024-01-01T12:00:30Z",
 "delaySeconds": 30,
 "scheduledSendTime": "2024-01-01T12:00:30Z"
 }
}
```


```http
POST /api/messages/delayed/recall
Content-Type: application/json
Authorization: Bearer <token>

{
 "messageId": "msg-uuid-123"
}
```

****:
```json
{
 "success": true,
 "data": {
 "messageId": "msg-uuid-123",
 "recalled": true,
 "recalledAt": "2024-01-01T11:59:45Z"
 }
}
```


```http
GET /api/messages/delayed/list?page=1&pageSize=20&status=pending&conversationId=1
Authorization: Bearer <token>
```

****:
```json
{
 "success": true,
 "data": {
 "items": [
 {
 "id": "msg-uuid-123",
 "conversationId": 1,
 "customerName": "",
 "content": "",
 "delaySeconds": 30,
 "scheduledSendTime": "2024-01-01T12:00:30Z",
 "canRecall": true,
 "status": "pending"
 }
 ],
 "pagination": {
 "page": 1,
 "pageSize": 20,
 "total": 1,
 "totalPages": 1
 }
 }
}
```


1. ****:
```vue
<template>
 <div class="chat-room">
 <!-- -->
 <DelayedMessageSender
 :conversation-id="conversationId"
 @message-sent="handleMessageSent"
 @message-recalled="handleMessageRecalled"
 />
 </div>
</template>

<script setup>
import DelayedMessageSender from '@/components/DelayedMessageSender.vue'

const handleMessageSent = (message) => {
 console.log('Message sent:', message)
 //
}

const handleMessageRecalled = (messageId) => {
 console.log('Message recalled:', messageId)
 //
}
</script>
```

2. ** Composable**:
```typescript
import { useDelayedMessage } from '../composables/useDelayedMessage'

const {
 sendDelayedMessage,
 recallMessage,
 pendingMessages
} = useDelayedMessage()

//
const result = await sendDelayedMessage({
 conversationId: 1,
 content: '',
 delaySeconds: 60
})

//
if (result.success) {
 await recallMessage(result.data.messageId)
}
```


- **pending**:
- **sent**:
- **cancelled**:
- **failed**:


- **normal**: > 15 ()
- **warning**: 5-15 ()
- **urgent**: < 5 ()


1. ****: 1-120
2. ****:
3. ****:
4. ****:


```typescript
try {
 const result = await sendDelayedMessage(request)
 if (!result.success) {
 //
 showError(result.error)
 }
} catch (error) {
 //
 showError('')
}
```


- ****:
- ****: API
- ****:


- ****:
- ****:
- ****: KV


-
- JWT
-


-
-
-


- DelayedMessageSender (28 )
- useDelayedMessage Composable (15 )
- ()


- API
-
-

### E2E
-
-
-


```bash

wrangler d1 execute your-database --file=./database/delayed-messages-schema.sql
```


- `MESSAGE_QUEUE`: Cloudflare Queue ()
- `SESSIONS`: KV Namespace ()


-
-
-
-


- ****:
- ****:
- ****:
- ****:
- ****:


- **WebSocket **:
- ****: PWA
- ****:
- ****:

---


- [API ](../api/delayed-messages.md)
- [](../database/delayed-messages-schema.sql)
- [](../testing/delayed-messages-testing.md)
- [](../deployment/delayed-messages-deployment.md)

---

****: 1.0.0
****: 2025-01-08
****: 