
## Queue Management Guide - Multi-Channel Support MVP

> **DEPRECATED WARNING / **
>
> **AGENT_QUEUE has been fully deprecated and removed** (2025-10-07)
>
> **AGENT_QUEUE ** (2025-10-07)
>
> - **Delayed messaging** is now handled by **DelayedMessageBuffer Durable Object**
> - **** **DelayedMessageBuffer Durable Object**
> - Migration completed: 2025-09-30 | : 2025-09-30
> - See: [Migration Report](./reports/migration/MIGRATION_TO_DURABLE_OBJECTS_COMPLETE.md)
> - See: [Delayed Messaging Guide](./DELAYED_MESSAGING_GUIDE.md)
>
> **This document is kept for historical reference only.**
>
> ****

---

## ****

****

| | | | | |
|------|------|----------|----------|------|
| **AGENT_QUEUE** | | | 1-120 | **DEPRECATED** |
| **REALTIME_QUEUE** | SSE | | <100ms | **ACTIVE** |

---

## **AGENT_QUEUE** **DEPRECATED**

> **This section describes deprecated functionality.**
>
> See [DelayedMessageBuffer Durable Object](./DELAYED_MESSAGING_GUIDE.md) for current implementation.

### ** **
- ****1-120
- ****
- ****LINEFacebook
- ****

### ** **
```toml
# wrangler.toml
[[queues.producers]]
binding = "AGENT_QUEUE"
queue = "agent-queue"

[[queues.consumers]]
queue = "agent-queue"
max_batch_size = 10 #
max_batch_timeout = 5 # 5
```

### ** **
```typescript
//
maxRetries: 3
baseDelay: 2000ms # API
maxDelay: 60000ms # 1
backoffMultiplier: 2 #
```

### ** **
1. ****
 ```typescript
 // 1
 await agentQueueService.createDelayedMessage({
 conversationId: "123",
 content: "",
 delaySeconds: 60
 });
 ```

2. ****
 ```typescript
 //
 await agentQueueService.recallMessage("message-123");
 ```

### ** **
- ****0.5-2 /
- ****99.8%
- ****2000ms
- ****<1%

---

## **REALTIME_QUEUE**

### ** **
- ****
- ****
- **SSE**Server-Sent Events
- ****

### ** **
```toml
# wrangler.toml
[[queues.producers]]
binding = "REALTIME_QUEUE"
queue = "realtime-events"

[[queues.consumers]]
queue = "realtime-events"
max_batch_size = 5 #
max_batch_timeout = 1 # 1
```

### ** **
```typescript
//
maxRetries: 2 #
baseDelay: 500ms #
maxDelay: 5000ms # 5
backoffMultiplier: 2
```

### ** **
1. ****
 ```typescript
 //
 await realtimeQueueService.createAndQueueEvent(
 'message_created',
 messageData,
 { conversationId: 123 },
 'high'
 );
 ```

2. ****
 ```typescript
 //
 await realtimeQueueService.createAndQueueEvent(
 'typing_started',
 typingData,
 { conversationId: 123 },
 'low'
 );
 ```

### ** **
- ****10.5-50 /
- ****99.9%
- ****80ms
- **SSE**

---

## **API**

### ****
```typescript
//
GET /api/queues/stats
{
 "summary": {
 "totalQueues": 2,
 "healthyQueues": 2,
 "totalMessages": 0,
 "overallStatus": "healthy"
 },
 "queues": {
 "agentQueue": { ... },
 "realtimeQueue": { ... }
 }
}

//
GET /api/queues/health

//
GET /api/queues/performance

//
POST /api/queues/maintenance
{
 "operation": "cleanup_stale_connections"
}
```

### ****
```typescript
//
POST /api/realtime/test-event
{
 "conversationId": "1",
 "message": ""
}
```

---

## ****

### ****
```javascript
// 15
const monitorQueues = async () => {
 const stats = await fetch('/api/queues/stats');
 //
};

//
-
-
-
- SSE
-
```

### ****
| | AGENT_QUEUE | REALTIME_QUEUE |
|------|------------------|---------------------|
| **** | > 10 | > 1 |
| **** | > 5% | > 1% |
| **** | > 10% | > 5% |
| **** | > 100 | > 50 |

---

## ****

### ****

#### **1. AGENT_QUEUE **
```bash

wrangler queues consumer list agent-queue


wrangler tail --format pretty | grep "AGENT_QUEUE"


 "LINE API rate limit" API
 "Message expired"
 "Validation error"
```

#### **2. REALTIME_QUEUE **
```bash
# SSE
curl -H "Authorization: Bearer TOKEN" \
 "https://domain.com/api/realtime/sse?conversationId=1"


POST /api/realtime/test-event


 "No active connections" SSE
 "Event push failed"
 "SSE timeout"
```

### ****

#### **AGENT_QUEUE **
- 10
- API
-
- API

#### **REALTIME_QUEUE **
- 5
- SSE
- KV
-

---

## ****

### ****
```bash
# 1.
POST /api/queues/maintenance
{"operation": "cleanup_stale_connections"}

# 2.
POST /api/queues/maintenance
{"operation": "reset_stats"}

# 3.
GET /api/queues/health

# 4.
POST /api/queues/maintenance
{"operation": "get_connection_details"}
```

### ****
```bash

wrangler queues consumer remove agent-queue --script-name worker
wrangler queues consumer add agent-queue --script-name worker


```

---

## ****

### ****
1. ****
2. ****
3. ****
4. ****

### ****
1. ****
2. ****
3. ****
4. ****

---

## ****

****
- ****
- ****
- ****
- ****

****
- ****99.8%+
- ****<100ms
- ****
- ****

**** 