# WebSocket API Reference

**Module:** WebSocket Real-time Communication
**Base Path:** `/api/websocket`
**Version:** 2.0.0
**Authentication:** Required (JWT Bearer Token or Query Parameter)

---

##  Overview

The WebSocket API provides real-time, bidirectional communication for the Multi-Channel Integration System. Built on Cloudflare Durable Objects, it offers high-performance, stateful connections with automatic failover and load balancing.

### Key Features

- ** WebSocket Connections** - Full-duplex real-time communication
- ** Durable Objects** - Stateful connection management with automatic persistence
- ** Automatic Reconnection** - Client-side reconnection with exponential backoff
- ** Event Broadcasting** - Real-time message, typing, and presence events
- ** Circuit Breaker** - Automatic failure detection and fallback
- ** Connection Monitoring** - Real-time metrics and health checks
- ** Secure Authentication** - JWT-based authentication with token refresh
- ** Load Balancing** - Automatic distribution across Durable Objects
- ** Auto Cleanup** - Automatic connection cleanup on disconnect

### Architecture

```
┌──────────────────────────────────────────────────────┐
│ Client Applications │
│ (Browser, Mobile App, Desktop Client) │
└────────────────────┬─────────────────────────────────┘
                     │
            WebSocket Connection
                     │
┌────────────────────▼─────────────────────────────────┐
│ WebSocket Gateway (Workers) │
│  • Authentication & Authorization │
│  • Connection Upgrade & Routing │
│  • Load Balancing & Health Checks │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ │
┌───────▼───────┐ ┌──────────▼────────┐
│ ConversationRoom│ │  UserConnection │
│ Durable Object │ │  Durable Object │
│ │     │ │
│ • Message DO │     │ • User Session │
│ • Broadcasting │ │ • Multi-device │
│ • Persistence  │ │ • Presence │
└───────┬────────┘ └───────┬───────────┘
        │ │
┌───────▼──────────────────────▼───────────┐
│ Backend Services │
│  • D1 Database │
│  • KV Store (Session & State) │
│  • R2 Storage (Files) │
│  • Message Queue (Delayed Messages) │
└──────────────────────────────────────────┘
```

### Comparison: WebSocket vs. SSE

| Feature               | WebSocket          | SSE (Legacy)       |
|-----------------------|--------------------|--------------------|
| Bidirectional         |  Yes             |  No (One-way)    |
| Real-time Latency     |  <50ms           |  100-500ms       |
| Connection Protocol   | `ws://` `wss://`   | `http://` `https://`|
| Browser Support       |  All modern      |  All modern      |
| Scalability           |  Excellent       |  Good            |
| Durable Objects       |  Yes             |  No              |
| Auto Reconnection     |  Built-in        |  Manual          |
| Message Reliability   |  High            |  Medium          |
| Current Status        |  **Primary**     |  **Deprecated**  |

---

##  Authentication

WebSocket connections support two authentication methods:

### Method 1: Authorization Header (Recommended)

```javascript
const ws = new WebSocket(
  'wss://api.example.com/api/websocket/connect?conversationId=123',
  ['Authorization', `Bearer ${token}`]
);
```

### Method 2: Query Parameter (Fallback)

```javascript
const ws = new WebSocket(
  `wss://api.example.com/api/websocket/connect?conversationId=123&token=${token}`
);
```

### Authentication Flow

```
┌──────────┐ ┌──────────┐ ┌──────────────┐
│  Client  │ │  Gateway │ │   Durable │
│ │                │  Worker  │ │   Object │
└─────┬────┘ └─────┬────┘ └──────┬───────┘
      │ │                             │
      │ 1. WebSocket Upgrade │                             │
      │ + Authorization Header │                             │
      ├──────────────────────────>│ │
      │ │                             │
      │ │ 2. Validate JWT │
      │ │                             │
      │ │ 3. Check Connection Limits  │
      │ │                             │
      │ │ 4. Route to Durable Object  │
      │ ├────────────────────────────>│
      │ │                             │
      │ │ 5. Establish Connection │
      │ │<────────────────────────────│
      │ │                             │
      │ 6. Connection Established │ │
      │<──────────────────────────│ │
      │ │                             │
      │ 7. Send/Receive Messages  │ │
      │<──────────────────────────┼────────────────────────────>│
      │ │                             │
```

---

##  Table of Contents

1. [WebSocket Connection](#websocket-connection)
2. [Health & Status](#health--status)
3. [Message Types](#message-types)
4. [Event Broadcasting](#event-broadcasting)
5. [Error Handling](#error-handling)
6. [Connection Lifecycle](#connection-lifecycle)
7. [Dashboard & Monitoring](#dashboard--monitoring)
8. [Client Implementation](#client-implementation)
9. [Best Practices](#best-practices)
10. [Examples](#examples)

---

##  WebSocket Connection

### GET /api/websocket/connect

Upgrade HTTP connection to WebSocket protocol.

#### Request

**Query Parameters:**

| Parameter        | Type    | Required | Description                              |
|------------------|---------|----------|------------------------------------------|
| `conversationId` | string  | No       | Subscribe to specific conversation       |
| `token`          | string  | No       | JWT token (if not in header)             |

**Headers:**

```http
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: <random_key>
Authorization: Bearer <jwt_token>
```

#### Response

**Success (HTTP 101 Switching Protocols):**

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: <accept_key>
```

**Connection Established Message:**

```json
{
  "type": "connection_established",
  "data": {
    "connectionId": "conn_abc123",
    "userId": "agent-456",
    "conversationId": "123",
    "timestamp": "2025-01-28T10:00:00Z",
    "durableObjectId": "do_xyz789",
    "reconnectionToken": "recon_token_123"
  }
}
```

**Error Responses:**

**Invalid Authentication:**
```json
{
  "type": "error",
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or missing authentication token"
  }
}
```

**Connection Limit Reached:**
```json
{
  "type": "error",
  "error": {
    "code": "CONNECTION_LIMIT_REACHED",
    "message": "Maximum connections per user exceeded",
    "retryAfter": 60,
    "currentConnections": 10,
    "maxConnections": 10
  }
}
```

**WebSocket Disabled:**
```json
{
  "type": "error",
  "error": {
    "code": "WEBSOCKET_DISABLED",
    "message": "WebSocket is currently disabled. Please use SSE fallback.",
    "fallbackUrl": "/api/conversations/stream"
  }
}
```

#### Connection Limits

| Limit Type              | Value    | Description                              |
|-------------------------|----------|------------------------------------------|
| Max Connections/User    | 10       | Maximum connections per user             |
| Max Global Connections  | 10,000   | Maximum total system connections         |
| Heartbeat Interval      | 30s      | Ping interval to keep connection alive   |
| Connection Timeout      | 5 min    | Idle connection timeout                  |
| Upgrade Timeout         | 10s      | WebSocket upgrade timeout                |

#### Example: JavaScript WebSocket Client

```javascript
class WebSocketClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    // Option 1: Authorization header (recommended)
    this.ws = new WebSocket(this.url, ['Authorization', `Bearer ${this.token}`]);

    // Option 2: Token in query parameter
    // this.ws = new WebSocket(`${this.url}?token=${this.token}`);

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
  }

  handleOpen(event) {
    console.log(' WebSocket connected');
    this.reconnectAttempts = 0;

    // Start heartbeat
    this.startHeartbeat();
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log(' Received:', message);

      switch (message.type) {
        case 'connection_established':
          this.handleConnectionEstablished(message.data);
          break;
        case 'message':
          this.handleIncomingMessage(message.data);
          break;
        case 'typing_indicator':
          this.handleTypingIndicator(message.data);
          break;
        case 'presence_update':
          this.handlePresenceUpdate(message.data);
          break;
        case 'pong':
          this.handlePong();
          break;
        case 'error':
          this.handleServerError(message.error);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  handleError(event) {
    console.error(' WebSocket error:', event);
  }

  handleClose(event) {
    console.log(' WebSocket closed:', event.code, event.reason);
    this.stopHeartbeat();

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(` Reconnecting in ${delay}ms...`);

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.error(' Max reconnection attempts reached');
      // Fallback to SSE or notify user
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 25000); // 25 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not open. Current state:', this.ws?.readyState);
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client initiated close');
      this.ws = null;
    }
  }
}

// Usage
const client = new WebSocketClient(
  'wss://api.example.com/api/websocket/connect?conversationId=123',
  'your_jwt_token'
);

client.connect();
```

---

##  Health & Status

### GET /api/websocket/health

Check WebSocket service health status.

**No Authentication Required**

#### Response

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "module": "websocket",
    "timestamp": "2025-01-28T10:00:00Z",
    "version": "2.0.0",
    "services": {
      "websocket": "healthy",
      "durableObjects": "healthy",
      "database": "healthy",
      "kv": "healthy"
    },
    "metrics": {
      "activeConnections": 850,
      "totalConnections": 15000,
      "averageLatency": 45,
      "errorRate": 0.02
    },
    "config": {
      "maxConnectionsPerUser": 10,
      "maxGlobalConnections": 10000,
      "heartbeatInterval": 30000,
      "fallbackEnabled": true
    }
  }
}
```

### GET /api/websocket/migration-status

Get WebSocket migration and feature flag status.

#### Response

```json
{
  "success": true,
  "data": {
    "enableWebSocket": true,
    "fallbackToSSE": true,
    "migrationPhase": "production",
    "rolloutPercentage": 100,
    "durableObjectsAvailable": true,
    "features": {
      "messageDelivery": true,
      "typingIndicators": true,
      "presenceTracking": true,
      "fileUploads": true
    }
  }
}
```

---

##  Message Types

### Client → Server Messages

#### 1. Subscribe to Conversation

```json
{
  "type": "subscribe",
  "data": {
    "conversationId": "123"
  }
}
```

#### 2. Unsubscribe from Conversation

```json
{
  "type": "unsubscribe",
  "data": {
    "conversationId": "123"
  }
}
```

#### 3. Send Message

```json
{
  "type": "send_message",
  "data": {
    "conversationId": "123",
    "content": "Hello, how can I help you?",
    "messageType": "text",
    "metadata": {
      "priority": "normal"
    }
  }
}
```

#### 4. Typing Indicator

```json
{
  "type": "typing",
  "data": {
    "conversationId": "123",
    "status": "start"
  }
}
```

#### 5. Mark as Read

```json
{
  "type": "mark_read",
  "data": {
    "conversationId": "123",
    "messageId": "msg_456"
  }
}
```

#### 6. Heartbeat (Ping)

```json
{
  "type": "ping",
  "timestamp": 1706432400
}
```

---

### Server → Client Messages

#### 1. Connection Established

```json
{
  "type": "connection_established",
  "data": {
    "connectionId": "conn_abc123",
    "userId": "agent-456",
    "timestamp": "2025-01-28T10:00:00Z"
  }
}
```

#### 2. New Message

```json
{
  "type": "message",
  "data": {
    "id": "msg_789",
    "conversationId": "123",
    "content": "I need help with my order",
    "senderType": "customer",
    "senderId": "customer-123",
    "messageType": "text",
    "sentAt": "2025-01-28T10:05:00Z",
    "metadata": {}
  }
}
```

#### 3. Message Delivered

```json
{
  "type": "message_delivered",
  "data": {
    "messageId": "msg_789",
    "conversationId": "123",
    "deliveredAt": "2025-01-28T10:05:01Z"
  }
}
```

#### 4. Message Read

```json
{
  "type": "message_read",
  "data": {
    "messageId": "msg_789",
    "conversationId": "123",
    "readBy": "agent-456",
    "readAt": "2025-01-28T10:05:30Z"
  }
}
```

#### 5. Typing Indicator

```json
{
  "type": "typing_indicator",
  "data": {
    "conversationId": "123",
    "userId": "agent-456",
    "displayName": "John Doe",
    "status": "start",
    "timestamp": "2025-01-28T10:05:30Z"
  }
}
```

#### 6. Presence Update

```json
{
  "type": "presence_update",
  "data": {
    "userId": "agent-456",
    "displayName": "John Doe",
    "status": "online",
    "currentConversation": "123",
    "timestamp": "2025-01-28T10:00:00Z"
  }
}
```

#### 7. Conversation Updated

```json
{
  "type": "conversation_updated",
  "data": {
    "conversationId": "123",
    "updates": {
      "status": "assigned",
      "assignedTo": "agent-456",
      "priority": "high"
    },
    "updatedAt": "2025-01-28T10:10:00Z"
  }
}
```

#### 8. Viewer Joined

```json
{
  "type": "viewer_joined",
  "data": {
    "conversationId": "123",
    "viewer": {
      "userId": "supervisor-789",
      "displayName": "Sarah Manager",
      "role": "admin"
    },
    "totalViewers": 2
  }
}
```

#### 9. Viewer Left

```json
{
  "type": "viewer_left",
  "data": {
    "conversationId": "123",
    "userId": "supervisor-789",
    "totalViewers": 1
  }
}
```

#### 10. Heartbeat Response (Pong)

```json
{
  "type": "pong",
  "timestamp": 1706432401,
  "latency": 45
}
```

#### 11. Error Message

```json
{
  "type": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid message format",
    "details": {
      "field": "conversationId",
      "issue": "required"
    }
  }
}
```

---

##  Event Broadcasting

### Broadcast Scopes

WebSocket events are broadcast based on scope:

```
┌───────────────────────────────────────────┐
│ Global Broadcast │
│  • System announcements │
│  • Maintenance notifications │
│  • All connected users │
└───────────────┬───────────────────────────┘
                │
┌───────────────▼───────────────────────────┐
│ Team Broadcast │
│  • Team-specific notifications │
│  • Members of specific team │
└───────────────┬───────────────────────────┘
                │
┌───────────────▼───────────────────────────┐
│ Conversation Broadcast │
│  • Messages, typing, viewers │
│  • Subscribers to conversation │
└───────────────┬───────────────────────────┘
                │
┌───────────────▼───────────────────────────┐
│ User Broadcast │
│  • Personal notifications │
│  • User's own connections │
└───────────────────────────────────────────┘
```

### Broadcasting Architecture

```
┌──────────────────────────────────────────────────┐
│ Event Source (e.g., New Message) │
└─────────────────────┬────────────────────────────┘
                      │
          ┌───────────▼───────────┐
          │  Message Broadcaster  │
          │ Durable Object │
          └───────────┬───────────┘
                      │
          ┌───────────▼────────────┐
          │ Routing & Filtering  │
          └───────────┬────────────┘
                      │
        ┌─────────────┴─────────────┐
        │ │
┌───────▼────────┐ ┌────────▼────────┐
│ ConversationRoom│ │  UserConnection │
│ Durable Object │ │  Durable Object │
└───────┬────────┘ └────────┬─────────┘
        │ │
        │ │
┌───────▼──────────────────────────▼──────┐
│ Connected WebSocket Clients │
│ Agent A  │  Agent B  │  Supervisor C  │
└──────────────────────────────────────────┘
```

---

##  Error Handling

### Error Codes

| Code                       | Description                              | Recovery Action                    |
|----------------------------|------------------------------------------|------------------------------------|
| `AUTHENTICATION_ERROR`     | Invalid or expired token                 | Re-authenticate                    |
| `CONNECTION_LIMIT_REACHED` | Too many connections                     | Close unused connections           |
| `CONVERSATION_NOT_FOUND`   | Invalid conversation ID                  | Verify conversation exists         |
| `WEBSOCKET_DISABLED`       | WebSocket temporarily disabled           | Fallback to SSE                    |
| `RATE_LIMIT_EXCEEDED`      | Too many messages                        | Throttle send rate                 |
| `MESSAGE_TOO_LARGE`        | Message exceeds size limit               | Split or reduce message size       |
| `DURABLE_OBJECT_ERROR`     | Durable Object unavailable               | Retry with exponential backoff     |
| `VALIDATION_ERROR`         | Invalid message format                   | Fix message structure              |

### Error Response Format

```json
{
  "type": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {
      "field": "fieldName",
      "issue": "specific problem"
    },
    "timestamp": "2025-01-28T10:00:00Z",
    "recoverable": true,
    "retryAfter": 5000
  }
}
```

### Client Error Handling Example

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'error') {
    const { code, message: errorMsg, recoverable, retryAfter } = message.error;

    switch (code) {
      case 'AUTHENTICATION_ERROR':
        // Re-authenticate
        await refreshToken();
        reconnect();
        break;

      case 'CONNECTION_LIMIT_REACHED':
        // Close other connections or retry later
        console.error('Too many connections');
        setTimeout(() => reconnect(), retryAfter || 60000);
        break;

      case 'WEBSOCKET_DISABLED':
        // Fallback to SSE
        console.warn('WebSocket disabled, switching to SSE');
        switchToSSE();
        break;

      case 'RATE_LIMIT_EXCEEDED':
        // Throttle send rate
        enableRateLimiting();
        break;

      default:
        if (recoverable) {
          setTimeout(() => retryLastAction(), retryAfter || 5000);
        } else {
          showErrorToUser(errorMsg);
        }
    }
  }
};
```

---

##  Connection Lifecycle

### Connection States

```
┌──────────────────────────────────────────────────────┐
│ Connection States │
├──────────────────────────────────────────────────────┤
│ │
│  CONNECTING ──────> OPEN ──────> CLOSING ──> CLOSED │
│ │              │ │           │ │
│ │              │ │           │ │
│ │              └──> ERROR ───┘ │     │
│ │                    │ │     │
│ └────────────────────┴───────────────────┘ │
│ RECONNECTING │
│ │
└──────────────────────────────────────────────────────┘
```

### State Descriptions

| State        | Value | Description                              |
|--------------|-------|------------------------------------------|
| CONNECTING   | 0     | Connection is being established          |
| OPEN         | 1     | Connection is active and ready           |
| CLOSING      | 2     | Connection is closing                    |
| CLOSED       | 3     | Connection is closed                     |

### Connection Flow

```
┌─────────────┐
│ Client │
└──────┬──────┘
       │
       │ 1. Initiate Connection
       ▼
┌─────────────────────┐
│  WebSocket Gateway  │
└──────┬──────────────┘
       │
       │ 2. Authenticate
       │ 3. Check Limits
       │ 4. Route to DO
       ▼
┌──────────────────────┐
│ Durable Object │
│  (ConversationRoom)  │
└──────┬───────────────┘
       │
       │ 5. Register Connection
       │ 6. Send Confirmation
       │ 7. Start Heartbeat
       ▼
┌─────────────────────┐
│ Active Session │
│  • Send Messages │
│  • Receive Events │
│  • Heartbeat Pings  │
└──────┬──────────────┘
       │
       │ 8. Close/Disconnect
       ▼
┌─────────────────────┐
│ Cleanup Process │
│  • Remove from Room │
│  • Broadcast Leave  │
│  • Free Resources │
└─────────────────────┘
```

---

##  Dashboard & Monitoring

### GET /api/websocket/dashboard/metrics

Get real-time WebSocket metrics.

**Authentication:** Admin or Team role required

#### Response

```json
{
  "success": true,
  "data": {
    "connections": {
      "active": 850,
      "total": 15000,
      "perUser": 1.2,
      "byProtocol": {
        "websocket": 820,
        "sse": 30
      }
    },
    "performance": {
      "averageLatency": 45,
      "p50Latency": 35,
      "p95Latency": 85,
      "p99Latency": 150,
      "messageRate": 125.5,
      "errorRate": 0.02
    },
    "durableObjects": {
      "conversationRooms": 150,
      "userConnections": 850,
      "messageBroadcasters": 5
    },
    "timestamp": "2025-01-28T10:00:00Z"
  }
}
```

### GET /api/websocket/dashboard/connections

Get list of active connections.

#### Query Parameters

| Parameter | Type    | Description                              |
|-----------|---------|------------------------------------------|
| `page`    | integer | Page number (default: 1)                 |
| `limit`   | integer | Results per page (default: 20, max: 100) |
| `userId`  | string  | Filter by user ID                        |
| `teamId`  | integer | Filter by team ID                        |

#### Response

```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "connectionId": "conn_abc123",
        "userId": "agent-456",
        "displayName": "John Doe",
        "conversationId": "123",
        "connectedAt": "2025-01-28T09:30:00Z",
        "lastActivity": "2025-01-28T10:00:00Z",
        "durableObjectId": "do_xyz789",
        "protocol": "websocket",
        "latency": 42,
        "messagesReceived": 15,
        "messagesSent": 20
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 850,
      "totalPages": 43
    }
  }
}
```

---

##  Client Implementation

### Vue 3 Composable Example

```javascript
// composables/useWebSocket.js
import { ref, onMounted, onUnmounted, computed } from 'vue';

export function useWebSocket(url, token) {
  const ws = ref(null);
  const connected = ref(false);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;
  const messages = ref([]);

  const connectionState = computed(() => {
    if (!ws.value) return 'disconnected';
    switch (ws.value.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  });

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    ws.value = new WebSocket(url, ['Authorization', `Bearer ${token}`]);

    ws.value.addEventListener('open', handleOpen);
    ws.value.addEventListener('message', handleMessage);
    ws.value.addEventListener('error', handleError);
    ws.value.addEventListener('close', handleClose);
  }

  function handleOpen(event) {
    console.log(' WebSocket connected');
    connected.value = true;
    reconnectAttempts.value = 0;
    startHeartbeat();
  }

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      messages.value.push(message);

      // Emit event for specific message types
      if (message.type === 'message') {
        // Handle new message
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  function handleError(event) {
    console.error(' WebSocket error:', event);
  }

  function handleClose(event) {
    console.log(' WebSocket closed:', event.code, event.reason);
    connected.value = false;
    stopHeartbeat();

    // Attempt reconnection
    if (reconnectAttempts.value < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000);
      console.log(` Reconnecting in ${delay}ms...`);

      setTimeout(() => {
        reconnectAttempts.value++;
        connect();
      }, delay);
    }
  }

  let heartbeatInterval;

  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        send({ type: 'ping', timestamp: Date.now() });
      }
    }, 25000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  function send(data) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not ready');
    }
  }

  function disconnect() {
    stopHeartbeat();
    if (ws.value) {
      ws.value.close(1000, 'Client disconnect');
      ws.value = null;
    }
  }

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    connectionState,
    messages,
    send,
    disconnect,
    reconnect: connect
  };
}
```

### React Hook Example

```javascript
// hooks/useWebSocket.js
import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSocket(url, token) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [connectionState, setConnectionState] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(url, ['Authorization', `Bearer ${token}`]);

    ws.onopen = () => {
      console.log(' Connected');
      setConnected(true);
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setMessages(prev => [...prev, message]);
      } catch (error) {
        console.error('Parse error:', error);
      }
    };

    ws.onerror = (event) => {
      console.error(' Error:', event);
    };

    ws.onclose = (event) => {
      console.log(' Closed:', event.code);
      setConnected(false);
      setConnectionState('disconnected');

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Reconnect logic
      if (reconnectAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [url, token]);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected,
    connectionState,
    messages,
    send,
    disconnect,
    reconnect: connect
  };
}
```

---

##  Best Practices

### 1. Connection Management

 **Do:**
- Always implement reconnection logic with exponential backoff
- Close connections when component unmounts
- Limit concurrent connections per user
- Use heartbeat to detect dead connections

 **Don't:**
- Open multiple connections to the same conversation
- Forget to close connections on navigation
- Reconnect immediately after failure
- Ignore connection state changes

### 2. Message Handling

 **Do:**
- Validate message format before sending
- Handle all message types gracefully
- Implement message queueing for offline scenarios
- Use message IDs for deduplication

 **Don't:**
- Send very large messages (>10MB)
- Ignore message delivery confirmations
- Process messages synchronously
- Forget error handling

### 3. Performance Optimization

 **Do:**
- Batch multiple updates when possible
- Use message throttling for high-frequency events
- Implement client-side caching
- Monitor connection latency

 **Don't:**
- Send typing indicators on every keystroke
- Subscribe to unnecessary conversations
- Create memory leaks with event listeners
- Ignore performance metrics

### 4. Security

 **Do:**
- Always use WSS (secure WebSocket) in production
- Validate JWT tokens on every connection
- Implement rate limiting
- Log security events

 **Don't:**
- Send sensitive data without encryption
- Store tokens in localStorage (use sessionStorage)
- Trust client-side data without validation
- Expose internal error details

---

##  Related Resources

- [Main API Reference](../API_REFERENCE.md)
- [Collaboration API](./COLLABORATION_API.md)
- [Messaging API](./MESSAGING_API.md)
- [WebSocket Integration Guide](../../guides/WEBSOCKET_INTEGRATION.md)
- [Real-time Best Practices](../../guides/REALTIME_BEST_PRACTICES.md)

---

**Last Updated:** 2025-01-28
**Version:** 2.0.0
