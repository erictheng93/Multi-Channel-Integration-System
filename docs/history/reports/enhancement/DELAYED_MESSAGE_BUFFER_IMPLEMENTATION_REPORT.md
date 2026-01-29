# Delayed Message Buffer Implementation Report

****: 2025-09-30
****: Phase 1
****: Durable Objects ()

---


 **Cloudflare Queues ** **Durable Objects ******


**** (Undo Buffer)
- ** (<100ms)**
- ****
- **100% **
- ****

---


### Cloudflare Queues

```

1. D1 + KV + Queue
2. Queue Consumer KV
3.


1. KV cancelled
2. Queue Consumer 3-8
3. Consumer


-
- 3-8
-
-
```

### Durable Objects

```

1. DO ()
2. Alarm API ()
3.


1. DO (<10ms)
2. Alarm ()
3. (<50ms)


-
- <100ms
- 100%
-
```

---


### 1.

#### 1.1 Durable Object
****: `src/durable-objects/DelayedMessageBuffer.ts`

****:
- `schedule()` -
- `cancel()` - <10ms
- `getStatus()` -
- `alarm()` - Alarm API
- `fetch()` - HTTP

****:
```typescript
//
this.pendingMessages.set(messageId, message);

// Alarm API
await this.state.storage.setAlarm(scheduledAt);

//
this.pendingMessages.delete(messageId);
await this.state.storage.deleteAlarm();
```

****: ~600

#### 1.2 API Handler
****: `src/handlers/delayed-message-buffer.ts`

****:
- `POST /api/delayed-messages-v2/send` -
- `DELETE /api/delayed-messages-v2/cancel/:messageId` -
- `GET /api/delayed-messages-v2/status/:messageId` -
- `GET /api/delayed-messages-v2/pending` -
- `GET /api/delayed-messages-v2/health` -

****: JWT
****: PermissionService

#### 1.3

**wrangler.toml**:
```toml
[[durable_objects.bindings]]
name = "DELAYED_MESSAGE_BUFFER"
class_name = "DelayedMessageBuffer"

[[migrations]]
tag = "v1"
new_classes = [
 "ConversationRoom",
 "UserConnection",
 "MessageBroadcaster",
 "DelayedMessageProcessor",
 "DelayedMessageBuffer", #
 "LockCoordinator"
]
```

**src/types/bindings.ts**:
```typescript
DELAYED_MESSAGE_BUFFER?: DurableObjectNamespace;
```

**src/index.ts**:
```typescript
//
app.route('/api/delayed-messages-v2', delayedMessageBufferHandler);

//
export { DelayedMessageBuffer };
```

### 2.

#### 2.1 API
****: `frontend/src/api/delayedMessages.ts`

****:
```typescript
- send(params) //
- cancel(params) //
- getStatus(id, convId) //
- listPending(convId) //
- health() //
```

**TypeScript **:

#### 2.2 UI
****: `frontend/src/components/conversation/DelayedMessagePanel.vue`

****:
-
- 100ms
-
-
- 2
-

**UI **:
```


 ... 5
 [LINE]
 [ ]

 ... 2
 [Facebook]
 [ ]


```

**CSS **:
- urgent-pulse
-
-
-

---


```
Durable Objects :
 : <10ms
 API : ~30-50ms
 :

Queues :
 KV : ~50ms
 Consumer: 3000-8000ms
 :
```


```
5 :
 : 500
 : 10%
 : <$0.01

20 :
 : 5,000
 : 15%
 : ~$0.03

:
```

---


- [ ] DO
- [ ] schedule()
- [ ] cancel()
- [ ] getStatus()
- [ ] Alarm API
- [ ]
- [ ]
- [ ]


- [ ] API
- [ ] DelayedMessagePanel
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]


- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

---


### 1.
```bash

npm run dev


cd frontend && npm run dev


curl http://localhost:8787/api/delayed-messages-v2/health
```

### 2.
```bash
# Workers Durable Objects
npm run deploy


npm run health:check:all
```

### 3.
1. `<DelayedMessagePanel>`
2. `delayedMessagesApi.send()`
3.

---


### API


```bash
curl -X POST https://your-domain.com/api/delayed-messages-v2/send \
 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "conversationId": "conv_123",
 "content": "",
 "platform": "line",
 "recipientPlatformId": "U1234567890",
 "delaySeconds": 5
 }'
```

****:
```json
{
 "success": true,
 "data": {
 "messageId": "msg_abc123",
 "scheduledAt": 1727654400000,
 "canCancelUntil": 1727654400000,
 "delaySeconds": 5,
 "conversationId": "conv_123"
 },
 "timestamp": "2025-09-30T10:00:00.000Z"
}
```


```bash
curl -X DELETE https://your-domain.com/api/delayed-messages-v2/cancel/msg_abc123 \
 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "conversationId": "conv_123",
 "reason": "User cancelled"
 }'
```

****:
```json
{
 "success": true,
 "data": {
 "messageId": "msg_abc123",
 "cancelledAt": 1727654395000,
 "cancelledBy": "agent_user"
 },
 "timestamp": "2025-09-30T09:59:55.000Z"
}
```


```vue
<template>
 <div class="conversation-view">
 <!-- -->
 <DelayedMessagePanel
 ref="delayedPanel"
 :conversation-id="currentConversation.id"
 />

 <!-- -->
 <MessageInput @send="handleSendMessage" />
 </div>
</template>

<script setup>
import { ref } from 'vue';
import DelayedMessagePanel from '@/components/conversation/DelayedMessagePanel.vue';
import delayedMessagesApi from '@/api/delayedMessages';

const delayedPanel = ref(null);
const currentConversation = ref({ id: 'conv_123' });

const handleSendMessage = async (content) => {
 try {
 //
 const result = await delayedMessagesApi.send({
 conversationId: currentConversation.value.id,
 content,
 platform: 'line',
 recipientPlatformId: 'U1234567890',
 delaySeconds: 5
 });

 //
 delayedPanel.value.addPendingMessage(result);

 } catch (error) {
 console.error('Failed to send delayed message:', error);
 }
};
</script>
```

---


**Phase 1** ():
- DO (`/api/delayed-messages-v2`)
- Queues (`/api/delayed-messages`)
-

**Phase 2** ():
- A/B 10% DO
-
- DO

**Phase 3** ():
- 100% DO
- Queues
- `/api/delayed-messages`


 DO Queues
```typescript
const USE_DURABLE_OBJECTS = false; // false
```

---


1. **** (: <100ms)
2. **** (: >99.9%)
3. **Alarm ** (: ±100ms)
4. **DO ** (: >99.9%)


```bash

GET /api/delayed-messages-v2/health


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


### 1. Alarm API
```typescript
// Cloudflare alarm()
async alarm() {
 //
 const readyMessages = this.getReadyMessages();
 await Promise.allSettled(readyMessages.map(msg => this.sendMessage(msg)));
}
```

### 2. +
```typescript
//
this.pendingMessages.set(id, message);

//
await this.state.storage.put(`msg:${id}`, message);

// Alarm Cloudflare
await this.state.storage.setAlarm(scheduledAt);
```

### 3.
```typescript
//
this.pendingMessages.delete(messageId);
await this.state.storage.delete(`msg:${messageId}`);
await this.state.storage.deleteAlarm(); // Alarm
```

---


1. ****: 3-8 <100ms
2. ****:
3. ****: 100%
4. ****: <$1
5. ****: TypeScript


```
:
 Cloudflare Workers
 Durable Objects + Alarm API
 Hono Framework
 TypeScript

:
 Vue 3 Composition API
 TypeScript
 Tailwind CSS (SCSS)


:


```

---


- [Cloudflare Durable Objects ](https://developers.cloudflare.com/durable-objects/)
- [Alarm API ](https://developers.cloudflare.com/durable-objects/api/alarms/)
- CLAUDE.md:

---


- ****: Claude (Anthropic)
- ****: Claude Code
- ****:

---


### Phase 2 ()
- [ ] 5/10/15
- [ ]
- [ ]
- [ ]

### Phase 3 ()
- [ ] WebSocket
- [ ]
- [ ]
- [ ]

---

****: 2025-09-30
****: 1.0.0
****: Phase 1 