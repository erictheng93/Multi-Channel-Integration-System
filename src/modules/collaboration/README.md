# Collaboration Module ()

,, SSE WebSocket


- **** - SSE () WebSocket
- **** - ,
- **Typing Indicator** -
- **Presence ** -
- **** -
- **** -
- **** -


```
src/modules/collaboration/
 types/ #
 collaboration-types.ts #
 index.ts
 adapters/ #
 sse-adapter.ts # SSE
 websocket-adapter.ts # WebSocket
 index.ts
 services/ #
 collaboration-manager.ts #
 index.ts
 handlers/ # API
 collaboration-main.ts #
 index.ts
 index.ts #
 README.md #
```


```typescript
import { Collaboration } from '@/modules/collaboration';

// Worker
await Collaboration.initialize(env, {
 defaultProtocol: 'sse',
 enableWebSocket: false,
 typingExpirationSeconds: 5,
 presenceExpirationSeconds: 300
});
```


```typescript
import { Collaboration } from '@/modules/collaboration';

// 1.
const state = await Collaboration.getConversationState(conversationId);
console.log(':', state.viewers);
console.log(':', state.typing);

// 2.
await Collaboration.joinConversation({
 conversationId: 123,
 userId: 1,
 protocol: 'sse',
 metadata: {
 username: 'alice',
 displayName: 'Alice',
 role: 'admin'
 }
});

// 3.
await Collaboration.sendTyping({
 conversationId: 123,
 userId: 1,
 status: 'start'
});

// 4.
await Collaboration.updatePresence({
 userId: 1,
 status: 'online',
 currentConversation: 123
});

// 5.
await Collaboration.broadcastEvent({
 conversationId: 123,
 event: {
 type: 'message_sent',
 conversationId: 123,
 userId: 1,
 data: { messageId: 456 },
 timestamp: new Date().toISOString()
 }
});
```

## API

### REST API


```
GET /api/collaboration/conversations/:id/state
Query: protocol=sse|websocket (optional)

Response:
{
 "success": true,
 "data": {
 "conversationId": 123,
 "viewers": [...],
 "typing": [...],
 "totalConnections": 2,
 "protocol": "sse",
 "lastActivity": "2024-01-01T00:00:00Z"
 }
}
```


```
GET /api/collaboration/conversations/:id/viewers
Query: protocol=sse|websocket (optional)

Response:
{
 "success": true,
 "data": {
 "viewers": [
 {
 "userId": 1,
 "username": "alice",
 "displayName": "Alice",
 "role": "admin",
 "joinedAt": "2024-01-01T00:00:00Z",
 "protocol": "sse",
 "isTyping": false,
 "lastActivity": "2024-01-01T00:00:00Z"
 }
 ]
 }
}
```


```
POST /api/collaboration/conversations/:id/join
Body: {
 "protocol": "sse" // optional
}

Response:
{
 "success": true,
 "message": "Joined conversation successfully"
}
```


```
POST /api/collaboration/conversations/:id/leave

Response:
{
 "success": true,
 "message": "Left conversation successfully"
}
```


```
POST /api/collaboration/typing
Body: {
 "conversationId": 123,
 "status": "start" | "stop"
}

Response:
{
 "success": true,
 "message": "Typing start sent successfully"
}
```


```
POST /api/collaboration/presence
Body: {
 "status": "online" | "away" | "busy" | "offline",
 "currentConversation": 123, // optional
 "metadata": {} // optional
}

Response:
{
 "success": true,
 "message": "Presence updated successfully"
}
```


```
GET /api/collaboration/stats
Query: protocol=sse|websocket (optional)

Response:
{
 "success": true,
 "data": {
 "totalViewers": 10,
 "totalTyping": 2,
 "totalRooms": 5,
 "connectionsByProtocol": {
 "sse": 10,
 "websocket": 0,
 "http": 0
 },
 "topActiveConversations": [...]
 }
}
```


```
GET /api/collaboration/health

Response:
{
 "success": true,
 "data": {
 "status": "healthy",
 "config": {
 "defaultProtocol": "sse",
 "enableWebSocket": false
 },
 "availableProtocols": ["sse"],
 "timestamp": "2024-01-01T00:00:00Z"
 }
}
```


```typescript
interface CollaborationConfig {
 //
 defaultProtocol: 'sse' | 'websocket' | 'http';

 // WebSocket
 enableWebSocket: boolean;

 // ()
 typingExpirationSeconds: number;

 // ()
 presenceExpirationSeconds: number;

 // ()
 cleanupIntervalSeconds: number;

 //
 maxViewersPerConversation: number;

 //
 persistEvents: boolean;
}
```


```typescript
{
 defaultProtocol: 'sse',
 enableWebSocket: false,
 typingExpirationSeconds: 5,
 presenceExpirationSeconds: 300,
 cleanupIntervalSeconds: 60,
 maxViewersPerConversation: 50,
 persistEvents: false
}
```


### 1:

```typescript
// A
await Collaboration.joinConversation({
 conversationId: 123,
 userId: 1,
 metadata: { username: 'alice', displayName: 'Alice', role: 'admin' }
});

// B
await Collaboration.joinConversation({
 conversationId: 123,
 userId: 2,
 metadata: { username: 'bob', displayName: 'Bob', role: 'agent' }
});

//
const state = await Collaboration.getConversationState(123);
console.log(':', state.viewers); // [Alice, Bob]
```

### 2: Typing Indicator

```typescript
//
await Collaboration.sendTyping({
 conversationId: 123,
 userId: 1,
 status: 'start'
});

//
// typing_start

// 5
await Collaboration.sendTyping({
 conversationId: 123,
 userId: 1,
 status: 'stop'
});
```

### 3: Presence

```typescript
//
await Collaboration.updatePresence({
 userId: 1,
 status: 'online',
 currentConversation: 123
});

//
await Collaboration.updatePresence({
 userId: 1,
 status: 'away'
});

//
await Collaboration.updatePresence({
 userId: 1,
 status: 'offline'
});
```


### SSE ()

```typescript
// SSE
await Collaboration.initialize(env, {
 defaultProtocol: 'sse',
 enableWebSocket: false
});

// SSE
const state = await Collaboration.getConversationState(123, 'sse');
```

### WebSocket ()

```typescript
// WebSocket
await Collaboration.initialize(env, {
 defaultProtocol: 'websocket',
 enableWebSocket: true
});

// WebSocket
const state = await Collaboration.getConversationState(123, 'websocket');
```


```typescript
// SSE,WebSocket
await Collaboration.initialize(env, {
 defaultProtocol: 'sse',
 enableWebSocket: true //
});

//
const sseState = await Collaboration.getConversationState(123, 'sse');
const wsState = await Collaboration.getConversationState(456, 'websocket');
```


```typescript
//
const stats = await Collaboration.getStats();

//
const sseStats = await Collaboration.getStats('sse');
const wsStats = await Collaboration.getStats('websocket');
```


```typescript
//
const cleanedCount = await collaboration.cleanup();
console.log(` ${cleanedCount} `);
```


```typescript
//
import { Collaboration } from '@/modules/collaboration';

describe('Collaboration Module', () => {
 beforeAll(async () => {
 await Collaboration.initialize(testEnv);
 });

 test('should join conversation', async () => {
 await Collaboration.joinConversation({
 conversationId: 1,
 userId: 1
 });

 const state = await Collaboration.getConversationState(1);
 expect(state.viewers).toHaveLength(1);
 });

 test('should send typing indicator', async () => {
 await Collaboration.sendTyping({
 conversationId: 1,
 userId: 1,
 status: 'start'
 });

 const state = await Collaboration.getConversationState(1);
 expect(state.typing).toHaveLength(1);
 });
});
```


### v1.0.0 (2024-01-01)
-
- SSE
- WebSocket
- API
- Typing Indicator
- Presence
-

---

****: Collaboration Team
****: 2024-01-01
****: 1.0.0
