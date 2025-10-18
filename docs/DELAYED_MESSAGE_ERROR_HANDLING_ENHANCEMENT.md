# DelayedMessage (Phase 1)


****: 2025-10-01
****: Phase 1 -
****:
****: 6-8 hours

---


1. **alarm() ** Dead Letter Queue
2. **sendMessage() ** (3 )
3. **storeMessageInDatabase() ** Drizzle batch
4. ****

---


### 1.

****: `src/durable-objects/DelayedMessageBuffer.ts:25-40`

```typescript
interface PendingMessage {
 // ... ...
 status: 'pending' | 'sent' | 'cancelled' | 'failed'; // 'failed'
 retryCount?: number; //
 lastRetryAt?: number; //
 failureReason?: string; //
}
```

****:
-
-
-

---

### 2. alarm()

****: `src/durable-objects/DelayedMessageBuffer.ts:372-412`


```typescript
const sendPromises = readyMessages.map(msg => this.sendMessage(msg));
await Promise.allSettled(sendPromises); //
await this.updateAlarm();
```


```typescript
const results = await Promise.allSettled(sendPromises);

let successCount = 0;
let failureCount = 0;

results.forEach((result, index) => {
 const message = readyMessages[index];

 if (result.status === 'fulfilled') {
 successCount++;
 } else {
 failureCount++;
 this.addToDeadLetterQueue(message, result.reason); // DLQ
 console.error(` Message ${message.id} failed:`, result.reason);
 }
});

console.log(` Batch send: ${successCount} success, ${failureCount} failed`);
```

****:
-
- DLQ
-

---

### 3. sendMessage()

****: `src/durable-objects/DelayedMessageBuffer.ts:505-589`


```typescript
private readonly MAX_RETRY_ATTEMPTS = 3;
private readonly RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s
```


```typescript
for (let attempt = 0; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
 try {
 // ...
 if (success) {
 return; //
 }
 } catch (error) {
 lastError = error;
 }

 //
 if (attempt < this.MAX_RETRY_ATTEMPTS) {
 const delay = this.RETRY_DELAYS[attempt] || 4000;
 await this.sleep(delay);
 message.retryCount = attempt + 1;
 }
}

// DLQ
message.status = 'failed';
await this.addToDeadLetterQueue(message, lastError);
```

****:
- ** 1 **:
- ** 2 **: 1
- ** 3 **: 2
- ** 4 **: 4
- ****: failed DLQ

---

### 4.

****: `src/durable-objects/DelayedMessageBuffer.ts:477-495`

```typescript
private async isMessageAlreadySent(messageId: string): Promise<boolean> {
 const db = drizzle(this.env.DB);
 const existingMessage = await db
 .select()
 .from(messages)
 .where(eq(messages.id, messageId))
 .limit(1);

 return existingMessage.length > 0;
}
```

** sendMessage() **:
```typescript
const alreadySent = await this.isMessageAlreadySent(message.id);
if (alreadySent) {
 console.log(` Message ${message.id} already sent (idempotency)`);
 this.pendingMessages.delete(message.id);
 return; //
}
```

****:
- Alarm
-
- Durable Object

---

### 5.

****: `src/durable-objects/DelayedMessageBuffer.ts:652-699`


```typescript
//
await db.insert(messages).values({...});
await db.update(conversations).set({...});
```


```typescript
// batch
await db.batch([
 db.insert(messages).values({...}),
 db.update(conversations).set({...})
]);
```

****:
-
-
-

---

### 6. Dead Letter Queue (DLQ)

#### DLQ
****: `src/durable-objects/DelayedMessageBuffer.ts:450-465`

```typescript
private async addToDeadLetterQueue(message: PendingMessage, reason: any): Promise<void> {
 const dlqEntry = {
 ...message,
 failedAt: Date.now(),
 failureReason: reason instanceof Error ? reason.message : String(reason),
 retryCount: message.retryCount || 0
 };

 await this.state.storage.put(`dlq:${message.id}`, dlqEntry);
}
```

#### DLQ
****: `src/durable-objects/DelayedMessageBuffer.ts:368-408`

**GET /dlq** -

```json
{
 "success": true,
 "count": 2,
 "messages": [
 {
 "id": "msg-123",
 "content": "Failed message...",
 "platform": "line",
 "failedAt": 1696118400000,
 "failureReason": "LINE API timeout",
 "retryCount": 3,
 "conversationId": "conv-456"
 }
 ],
 "timestamp": 1696118500000
}
```

****:
-
-
-

---


****: `tests/unit/durable-objects/DelayedMessageBuffer-ErrorHandling.test.ts`


| | | |
|---------|---------|------|
| **** | | |
| | DLQ | |
| **** | | |
| **** | / | |
| **** | db.batch | |
| **DLQ** | | |
| | | |
| **** | | |

****: 8+

---


- [x]
- [x]
- [x]
- [ ]
- [ ]
- [ ] Staging
- [ ] (Phase 2)
- [ ] Production


#### 1.
```bash
# LINE API
curl -X POST https://do/schedule \
 -H "Content-Type: application/json" \
 -d '{
 "messageId": "test-retry",
 "conversationId": "123",
 "agentId": "agent-1",
 "content": "Test retry",
 "platform": "line",
 "recipientPlatformId": "user-123",
 "delaySeconds": 5
 }'


# Attempt 1/4 for message test-retry
# Attempt 2/4 for message test-retry
# Message test-retry sent successfully on attempt 3
```

#### 2. DLQ
```bash

curl https://do/dlq


{
 "success": true,
 "count": 1,
 "messages": [
 {
 "id": "msg-failed-123",
 "failureReason": "LINE API timeout",
 "retryCount": 3
 }
 ]
}
```

#### 3.
```bash
# alarm
curl -X POST https://do/alarm
curl -X POST https://do/alarm


```

---


### vs

| | | | |
|-----|-------|-------|------|
| **alarm() ** | ~50ms | ~80ms | +60% |
| **** | ~100ms | ~120ms | +20% |
| **** | N/A | ~7s (1+2+4s) | |
| **** | ~5KB/msg | ~6KB/msg | +20% |
| **** | ~2KB/msg | ~3KB/msg | +50% |

****:
-
-
- ROI

---


| | | | | |
|-----|-----|------|---------|------|
| | | | | |
| DO | | | | |
| DLQ | | | Phase 2 | |
| | | | | |

---

## (Phase 2)

### ( 1-2 )

1. **DLQ **
 - DLQ (: 10 )
 -
 -

2. ****
 -
 -
 -

3. ****
 - alarm()
 -
 -

### Phase 3: UI/UX ()

1. ****
 -
 -
 -

2. ****
 -
 -
 -

---


- [DelayedMessageBuffer ](../src/durable-objects/DelayedMessageBuffer.ts)
- [](../tests/unit/durable-objects/DelayedMessageBuffer-ErrorHandling.test.ts)
- [API ](./api/DELAYED_MESSAGE_API.md)
- [](./architecture/DURABLE_OBJECTS.md)

---


### Phase 1

- [x] alarm()
- [x] sendMessage()
- [x] storeMessageInDatabase()
- [x]
- [x] Dead Letter Queue
- [x] DLQ
- [x] (8+ )
- [ ]
- [ ]
- [ ] Production

---


### v1.0.0 - Phase 1 (2025-10-01)

****:
- ( 3 )
- Dead Letter Queue
-
-
-
- DLQ API

****:
- alarm()
- sendMessage()
-

****:
- PendingMessage retryCount, lastRetryAt, failureReason
- status 'failed'

---


- ****: Claude Code Assistant
- ****: []
- ****: []
- ****: []

---

****: 2025-10-01
****: Phase 2
