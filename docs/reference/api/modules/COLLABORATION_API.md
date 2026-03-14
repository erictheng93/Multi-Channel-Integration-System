# Collaboration API Reference

**Module:** Collaboration
**Base Path:** `/api/collaboration`
**Version:** 2.0.0
**Authentication:** Required (JWT Bearer Token)

---

##  Overview

The Collaboration API enables real-time collaboration features for customer support teams. It provides presence tracking, typing indicators, viewer management, and conversation state synchronization across multiple agents and channels.

### Key Features

- ** Viewer Tracking** - See who's viewing each conversation in real-time
- ** Typing Indicators** - Show when agents are typing responses
- ** Presence Management** - Track online/offline/away/busy status
- ** State Synchronization** - Sync conversation state across clients
- ** Collaboration Statistics** - Monitor team collaboration metrics
- ** Automatic Cleanup** - Remove expired states automatically
- ** Protocol Support** - WebSocket (primary) + SSE (fallback)
- ** High Performance** - Optimized for 1000+ concurrent users

### Use Cases

- **Multi-Agent Support** - Multiple agents handling the same conversation
- **Team Supervision** - Supervisors monitoring agent activities
- **Handoff Coordination** - Smooth conversation transfers
- **Quality Assurance** - QA team observing conversations
- **Real-time Training** - Trainers monitoring trainee interactions
- **Conflict Prevention** - Avoid multiple agents responding simultaneously

### Architecture

```
┌──────────────────────────────────────────────────┐
│ Frontend Clients (Browser) │
│ Agent A Agent B Supervisor QA Team │
└────────┬───────┬──────────┬────────────┬────────┘
         │ │          │ │
         └───────┴──────────┴────────────┘
                     │
         ┌───────────▼────────────┐
         │ Collaboration API │
         │ (REST + WebSocket) │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │  Protocol Layer │
         │  • WebSocket (Primary) │
         │  • SSE (Fallback) │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │ State Storage │
         │  • KV Store (Real-time)│
         │  • Durable Objects │
         └────────────────────────┘
```

---

##  Authentication & Authorization

All endpoints require authentication:

```http
Authorization: Bearer <jwt_token>
```

**Role Requirements:**
- All collaboration endpoints: `agent` or `admin`
- Cleanup endpoint: `admin` only

---

##  Table of Contents

1. [Get Conversation State](#get-conversation-state)
2. [Get Conversation Viewers](#get-conversation-viewers)
3. [Join Conversation](#join-conversation)
4. [Leave Conversation](#leave-conversation)
5. [Send Typing Indicator](#send-typing-indicator)
6. [Update Presence](#update-presence)
7. [Get Collaboration Statistics](#get-collaboration-statistics)
8. [Cleanup Expired States](#cleanup-expired-states)
9. [Health Check](#health-check)
10. [Event Types](#event-types)
11. [Best Practices](#best-practices)
12. [Examples](#examples)

---

##  Get Conversation State

### GET /api/collaboration/conversations/:id/state

Retrieve the current collaboration state for a conversation, including all active viewers and their status.

#### Request

**Path Parameters:**
- `id` (integer, required) - Conversation ID

**Query Parameters:**

| Parameter  | Type   | Required | Default | Description                              |
|------------|--------|----------|---------|------------------------------------------|
| `protocol` | string | No       | -       | Protocol preference: `websocket`, `sse`  |

#### Response

```json
{
  "success": true,
  "data": {
    "conversationId": 123,
    "viewers": [
      {
        "userId": "agent-456",
        "username": "john.doe",
        "displayName": "John Doe",
        "role": "agent",
        "joinedAt": "2025-01-28T10:00:00Z",
        "lastActivity": "2025-01-28T10:05:30Z",
        "isTyping": false,
        "protocol": "websocket"
      },
      {
        "userId": "agent-789",
        "username": "jane.smith",
        "displayName": "Jane Smith",
        "role": "admin",
        "joinedAt": "2025-01-28T10:02:15Z",
        "lastActivity": "2025-01-28T10:05:45Z",
        "isTyping": true,
        "protocol": "websocket"
      }
    ],
    "viewerCount": 2,
    "lastUpdate": "2025-01-28T10:05:45Z",
    "protocol": {
      "available": ["websocket", "sse"],
      "active": "websocket"
    }
  },
  "message": "Conversation state retrieved successfully"
}
```

#### Error Responses

**Invalid Conversation ID:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid conversation ID"
  }
}
```

#### Example Request

```bash
curl -X GET "https://api.example.com/api/collaboration/conversations/123/state?protocol=websocket" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Get Conversation Viewers

### GET /api/collaboration/conversations/:id/viewers

Get a list of all users currently viewing a specific conversation.

#### Request

**Path Parameters:**
- `id` (integer, required) - Conversation ID

**Query Parameters:**

| Parameter  | Type   | Required | Default | Description                              |
|------------|--------|----------|---------|------------------------------------------|
| `protocol` | string | No       | -       | Filter by protocol: `websocket`, `sse`   |

#### Response

```json
{
  "success": true,
  "data": {
    "viewers": [
      {
        "userId": "agent-456",
        "displayName": "John Doe",
        "role": "agent",
        "status": "online",
        "joinedAt": "2025-01-28T10:00:00Z",
        "isTyping": false
      },
      {
        "userId": "supervisor-123",
        "displayName": "Sarah Manager",
        "role": "admin",
        "status": "online",
        "joinedAt": "2025-01-28T10:01:30Z",
        "isTyping": false
      }
    ],
    "totalViewers": 2,
    "conversationId": 123
  },
  "message": "Viewers retrieved successfully"
}
```

#### Example Request

```bash
curl -X GET "https://api.example.com/api/collaboration/conversations/123/viewers" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Join Conversation

### POST /api/collaboration/conversations/:id/join

Join a conversation to receive real-time updates and indicate presence to other viewers.

#### Request

**Path Parameters:**
- `id` (integer, required) - Conversation ID

**Body Parameters:**

```json
{
  "protocol": "websocket",
  "metadata": {
    "clientType": "web",
    "userAgent": "Mozilla/5.0...",
    "timezone": "Asia/Taipei"
  }
}
```

| Parameter  | Type   | Required | Description                              |
|------------|--------|----------|------------------------------------------|
| `protocol` | string | No       | Preferred protocol: `websocket`, `sse`   |
| `metadata` | object | No       | Additional client metadata               |

#### Response

```json
{
  "success": true,
  "data": {
    "conversationId": 123,
    "userId": "agent-456",
    "joinedAt": "2025-01-28T10:00:00Z",
    "protocol": "websocket",
    "sessionId": "sess_abc123",
    "viewers": [
      {
        "userId": "agent-456",
        "displayName": "John Doe"
      },
      {
        "userId": "supervisor-123",
        "displayName": "Sarah Manager"
      }
    ]
  },
  "message": "Joined conversation successfully"
}
```

#### Real-time Events

After joining, the client will receive:

**Join Event Broadcast (to other viewers):**
```json
{
  "type": "viewer_joined",
  "conversationId": 123,
  "viewer": {
    "userId": "agent-456",
    "displayName": "John Doe",
    "role": "agent",
    "joinedAt": "2025-01-28T10:00:00Z"
  },
  "totalViewers": 2
}
```

#### Example Request

```bash
curl -X POST "https://api.example.com/api/collaboration/conversations/123/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "websocket",
    "metadata": {
      "clientType": "web"
    }
  }'
```

---

##  Leave Conversation

### POST /api/collaboration/conversations/:id/leave

Leave a conversation and stop receiving real-time updates.

#### Request

**Path Parameters:**
- `id` (integer, required) - Conversation ID

**Body Parameters:** None required

#### Response

```json
{
  "success": true,
  "data": {
    "conversationId": 123,
    "userId": "agent-456",
    "leftAt": "2025-01-28T10:30:00Z",
    "duration": 1800
  },
  "message": "Left conversation successfully"
}
```

#### Real-time Events

**Leave Event Broadcast (to remaining viewers):**
```json
{
  "type": "viewer_left",
  "conversationId": 123,
  "userId": "agent-456",
  "displayName": "John Doe",
  "leftAt": "2025-01-28T10:30:00Z",
  "totalViewers": 1
}
```

#### Example Request

```bash
curl -X POST "https://api.example.com/api/collaboration/conversations/123/leave" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Send Typing Indicator

### POST /api/collaboration/typing

Broadcast typing status to other viewers of a conversation.

#### Request

**Body Parameters:**

```json
{
  "conversationId": 123,
  "status": "start"
}
```

| Parameter        | Type    | Required | Description                              |
|------------------|---------|----------|------------------------------------------|
| `conversationId` | integer | Yes      | Conversation ID                          |
| `status`         | string  | Yes      | Typing status: `start`, `stop`           |

#### Response

```json
{
  "success": true,
  "data": null,
  "message": "Typing start sent successfully"
}
```

#### Real-time Events

**Typing Event Broadcast (to other viewers):**
```json
{
  "type": "typing_indicator",
  "conversationId": 123,
  "userId": "agent-456",
  "displayName": "John Doe",
  "status": "start",
  "timestamp": "2025-01-28T10:05:30Z"
}
```

**Auto-expiration:**
- Typing status automatically expires after 5 seconds
- Client should send `"status": "stop"` when user stops typing
- Client should send periodic `"status": "start"` every 3 seconds while typing

#### Validation

**Invalid Status:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status. Must be 'start' or 'stop'"
  }
}
```

#### Example Request

**Start Typing:**
```bash
curl -X POST "https://api.example.com/api/collaboration/typing" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": 123,
    "status": "start"
  }'
```

**Stop Typing:**
```bash
curl -X POST "https://api.example.com/api/collaboration/typing" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": 123,
    "status": "stop"
  }'
```

---

##  Update Presence

### POST /api/collaboration/presence

Update user's online status and current activity.

#### Request

**Body Parameters:**

```json
{
  "status": "online",
  "currentConversation": 123,
  "metadata": {
    "device": "desktop",
    "timezone": "Asia/Taipei",
    "availableForChat": true
  }
}
```

| Parameter             | Type    | Required | Description                              |
|-----------------------|---------|----------|------------------------------------------|
| `status`              | string  | Yes      | Status: `online`, `away`, `busy`, `offline` |
| `currentConversation` | integer | No       | Current conversation ID                  |
| `metadata`            | object  | No       | Additional status metadata               |

#### Response

```json
{
  "success": true,
  "data": {
    "userId": "agent-456",
    "status": "online",
    "currentConversation": 123,
    "updatedAt": "2025-01-28T10:00:00Z",
    "expiresAt": "2025-01-28T10:05:00Z"
  },
  "message": "Presence updated successfully"
}
```

#### Status Types

| Status    | Description                              | Color  |
|-----------|------------------------------------------|--------|
| `online`  | Available and active                     |  Green |
| `away`    | Idle or temporarily unavailable          |  Yellow |
| `busy`    | Do not disturb                           |  Red   |
| `offline` | Not available                            |  Gray  |

#### Auto-expiration

- Presence automatically expires after 5 minutes of inactivity
- Clients should update presence every 2-3 minutes
- Status changes to `away` automatically after 10 minutes of no activity
- Status changes to `offline` automatically after 30 minutes

#### Real-time Events

**Presence Update Broadcast:**
```json
{
  "type": "presence_update",
  "userId": "agent-456",
  "displayName": "John Doe",
  "status": "busy",
  "currentConversation": 123,
  "timestamp": "2025-01-28T10:00:00Z"
}
```

#### Validation

**Invalid Status:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status. Must be one of: online, away, busy, offline"
  }
}
```

#### Example Request

```bash
curl -X POST "https://api.example.com/api/collaboration/presence" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "online",
    "currentConversation": 123,
    "metadata": {
      "device": "desktop",
      "availableForChat": true
    }
  }'
```

---

##  Get Collaboration Statistics

### GET /api/collaboration/stats

Retrieve collaboration metrics and statistics across the system.

#### Request

**Query Parameters:**

| Parameter  | Type   | Required | Default | Description                              |
|------------|--------|----------|---------|------------------------------------------|
| `protocol` | string | No       | -       | Filter by protocol: `websocket`, `sse`   |

#### Response

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalActiveViewers": 25,
      "activeConversations": 15,
      "totalTypingUsers": 3,
      "onlineUsers": 30
    },
    "byProtocol": {
      "websocket": {
        "connections": 20,
        "viewers": 18
      },
      "sse": {
        "connections": 5,
        "viewers": 7
      }
    },
    "presence": {
      "online": 30,
      "away": 5,
      "busy": 3,
      "offline": 12
    },
    "topConversations": [
      {
        "conversationId": 123,
        "viewerCount": 4,
        "typingCount": 1
      },
      {
        "conversationId": 456,
        "viewerCount": 3,
        "typingCount": 0
      }
    ],
    "performance": {
      "avgJoinTime": 45,
      "avgLeaveTime": 12,
      "cacheHitRate": 0.95
    }
  },
  "message": "Statistics retrieved successfully",
  "timestamp": "2025-01-28T10:00:00Z"
}
```

#### Example Request

```bash
curl -X GET "https://api.example.com/api/collaboration/stats?protocol=websocket" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Cleanup Expired States

### POST /api/collaboration/cleanup

Manually trigger cleanup of expired collaboration states.

** Admin Only Endpoint**

#### Request

**Body Parameters:** None required

#### Response

```json
{
  "success": true,
  "data": {
    "cleanedCount": 15,
    "breakdown": {
      "expiredViewers": 8,
      "expiredTyping": 5,
      "expiredPresence": 2
    },
    "executionTime": 125
  },
  "message": "Cleanup completed successfully"
}
```

#### Cleanup Rules

**Automatic Cleanup:**
- Runs every 60 seconds (default)
- Removes viewers inactive for 30+ minutes
- Removes typing indicators older than 10 seconds
- Removes presence states older than 5 minutes

**Manual Cleanup:**
- Triggered via this endpoint
- More aggressive cleanup
- Useful for testing or maintenance

#### Example Request

```bash
curl -X POST "https://api.example.com/api/collaboration/cleanup" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Health Check

### GET /api/collaboration/health

Check collaboration service health and configuration.

**No Authentication Required**

#### Response

**Healthy:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "config": {
      "defaultProtocol": "websocket",
      "enableWebSocket": true
    },
    "availableProtocols": ["websocket", "sse"],
    "timestamp": "2025-01-28T10:00:00Z",
    "version": "2.0.0"
  },
  "message": "Health check completed"
}
```

**Not Initialized:**
```json
{
  "success": true,
  "data": {
    "status": "not_initialized",
    "config": {
      "defaultProtocol": "sse",
      "enableWebSocket": false
    },
    "availableProtocols": ["sse"],
    "timestamp": "2025-01-28T10:00:00Z",
    "note": "Module will initialize on first business request. Try accessing any conversation endpoint or refresh this page after a few seconds."
  },
  "message": "Health check completed"
}
```

**Degraded (Fallback Mode):**
```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "config": {
      "defaultProtocol": "sse",
      "enableWebSocket": false
    },
    "availableProtocols": ["sse"],
    "reason": "WebSocket service unavailable, using SSE fallback",
    "timestamp": "2025-01-28T10:00:00Z"
  },
  "message": "Health check completed"
}
```

#### Example Request

```bash
curl -X GET "https://api.example.com/api/collaboration/health"
```

---

##  Event Types

### Real-time Event Messages

Clients connected via WebSocket or SSE receive these event types:

#### Viewer Events

**viewer_joined:**
```json
{
  "type": "viewer_joined",
  "conversationId": 123,
  "viewer": {
    "userId": "agent-456",
    "displayName": "John Doe",
    "role": "agent",
    "joinedAt": "2025-01-28T10:00:00Z"
  },
  "totalViewers": 2
}
```

**viewer_left:**
```json
{
  "type": "viewer_left",
  "conversationId": 123,
  "userId": "agent-456",
  "displayName": "John Doe",
  "leftAt": "2025-01-28T10:30:00Z",
  "totalViewers": 1
}
```

#### Typing Events

**typing_indicator:**
```json
{
  "type": "typing_indicator",
  "conversationId": 123,
  "userId": "agent-456",
  "displayName": "John Doe",
  "status": "start",
  "timestamp": "2025-01-28T10:05:30Z"
}
```

#### Presence Events

**presence_update:**
```json
{
  "type": "presence_update",
  "userId": "agent-456",
  "displayName": "John Doe",
  "status": "busy",
  "currentConversation": 123,
  "timestamp": "2025-01-28T10:00:00Z"
}
```

**user_status_changed:**
```json
{
  "type": "user_status_changed",
  "userId": "agent-456",
  "displayName": "John Doe",
  "oldStatus": "online",
  "newStatus": "away",
  "reason": "inactivity_timeout",
  "timestamp": "2025-01-28T10:15:00Z"
}
```

---

##  Best Practices

### 1. Join/Leave Management

```javascript
// Good: Always join when viewing a conversation
useEffect(() => {
  if (conversationId) {
    joinConversation(conversationId);

    return () => {
      leaveConversation(conversationId);
    };
  }
}, [conversationId]);
```

### 2. Typing Indicators

```javascript
// Good: Throttle typing events
let typingTimeout;
function handleTyping() {
  sendTypingStart();

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    sendTypingStop();
  }, 3000);
}

// Send periodic updates while typing
setInterval(() => {
  if (isTyping) {
    sendTypingStart();
  }
}, 2500);
```

### 3. Presence Updates

```javascript
// Good: Regular presence heartbeat
setInterval(() => {
  updatePresence({
    status: 'online',
    currentConversation: activeConversationId
  });
}, 120000); // Every 2 minutes
```

### 4. Error Handling

```javascript
// Good: Handle connection failures
try {
  await joinConversation(conversationId);
} catch (error) {
  if (error.code === 'WEBSOCKET_UNAVAILABLE') {
    // Fallback to SSE
    await joinConversation(conversationId, { protocol: 'sse' });
  }
}
```

### 5. Protocol Selection

```javascript
// Good: Use WebSocket when available
const protocol = hasWebSocketSupport() ? 'websocket' : 'sse';
await joinConversation(conversationId, { protocol });
```

### 6. Memory Management

```javascript
// Good: Clean up event listeners
useEffect(() => {
  const unsubscribe = collaborationService.on('viewer_joined', handleViewerJoined);

  return () => {
    unsubscribe();
  };
}, []);
```

---

##  Examples

### Example 1: Basic Conversation Viewing

```javascript
// Join conversation and show viewers
async function viewConversation(conversationId) {
  try {
    // Join the conversation
    const joinResult = await fetch(`/api/collaboration/conversations/${conversationId}/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ protocol: 'websocket' })
    });

    const { data } = await joinResult.json();
    console.log('Joined conversation:', data);
    console.log('Other viewers:', data.viewers);

    // Get current state
    const stateResult = await fetch(`/api/collaboration/conversations/${conversationId}/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const state = await stateResult.json();
    displayViewers(state.data.viewers);

  } catch (error) {
    console.error('Failed to join conversation:', error);
  }
}

// Leave when done
async function closeConversation(conversationId) {
  await fetch(`/api/collaboration/conversations/${conversationId}/leave`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}
```

### Example 2: Typing Indicators with React

```javascript
import { useState, useEffect, useRef } from 'react';

function ConversationInput({ conversationId }) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const sendTyping = async (status) => {
    await fetch('/api/collaboration/typing', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId,
        status
      })
    });
  };

  const handleChange = (e) => {
    setMessage(e.target.value);

    // Start typing indicator
    if (!isTypingRef.current && e.target.value.length > 0) {
      isTypingRef.current = true;
      sendTyping('start');
    }

    // Reset timeout
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping('stop');
      }
    }, 3000);
  };

  const handleSubmit = () => {
    // Stop typing immediately when sending
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping('stop');
    }

    // Send message...
    setMessage('');
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current) {
        sendTyping('stop');
      }
    };
  }, []);

  return (
    <input
      value={message}
      onChange={handleChange}
      onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
    />
  );
}
```

### Example 3: Presence Management

```javascript
class PresenceManager {
  constructor(token) {
    this.token = token;
    this.currentStatus = 'online';
    this.heartbeatInterval = null;
    this.inactivityTimeout = null;
  }

  async start() {
    // Initial presence
    await this.updatePresence('online');

    // Regular heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.updatePresence(this.currentStatus);
    }, 120000); // 2 minutes

    // Monitor user activity
    this.setupInactivityDetection();
  }

  async updatePresence(status, conversationId = null) {
    this.currentStatus = status;

    await fetch('/api/collaboration/presence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status,
        currentConversation: conversationId,
        metadata: {
          device: 'desktop',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      })
    });
  }

  setupInactivityDetection() {
    const resetInactivity = () => {
      clearTimeout(this.inactivityTimeout);

      // Return to online if currently away
      if (this.currentStatus === 'away') {
        this.updatePresence('online');
      }

      // Set away after 10 minutes of inactivity
      this.inactivityTimeout = setTimeout(() => {
        this.updatePresence('away');
      }, 600000);
    };

    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetInactivity);
    });

    resetInactivity();
  }

  stop() {
    clearInterval(this.heartbeatInterval);
    clearTimeout(this.inactivityTimeout);
    this.updatePresence('offline');
  }
}

// Usage
const presenceManager = new PresenceManager(token);
presenceManager.start();

// When viewing a conversation
presenceManager.updatePresence('online', conversationId);

// Clean up on logout
window.addEventListener('beforeunload', () => {
  presenceManager.stop();
});
```

### Example 4: Real-time Viewer List

```javascript
function ViewersList({ conversationId }) {
  const [viewers, setViewers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    // Initial load
    loadViewers();

    // Subscribe to real-time events
    const events = collaborationService.subscribe(conversationId);

    events.on('viewer_joined', (data) => {
      setViewers(prev => [...prev, data.viewer]);
    });

    events.on('viewer_left', (data) => {
      setViewers(prev => prev.filter(v => v.userId !== data.userId));
    });

    events.on('typing_indicator', (data) => {
      if (data.status === 'start') {
        setTypingUsers(prev => new Set(prev).add(data.userId));
      } else {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }
    });

    return () => {
      events.unsubscribe();
    };
  }, [conversationId]);

  async function loadViewers() {
    const response = await fetch(
      `/api/collaboration/conversations/${conversationId}/viewers`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const { data } = await response.json();
    setViewers(data.viewers);
  }

  return (
    <div className="viewers-list">
      <h3>Viewers ({viewers.length})</h3>
      {viewers.map(viewer => (
        <div key={viewer.userId} className="viewer">
          <span className={`status-${viewer.status}`}>●</span>
          <span>{viewer.displayName}</span>
          {typingUsers.has(viewer.userId) && (
            <span className="typing-indicator">typing...</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

##  Error Codes

| Code                       | HTTP Status | Description                              |
|----------------------------|-------------|------------------------------------------|
| `VALIDATION_ERROR`         | 400         | Invalid request parameters               |
| `AUTHENTICATION_ERROR`     | 401         | Missing or invalid token                 |
| `AUTHORIZATION_ERROR`      | 403         | Insufficient permissions                 |
| `NOT_FOUND_ERROR`          | 404         | Conversation not found                   |
| `COLLABORATION_ERROR`      | 500         | Collaboration operation failed           |
| `WEBSOCKET_UNAVAILABLE`    | 503         | WebSocket service unavailable            |

---

##  Related Resources

- [Main API Reference](../API_REFERENCE.md)
- [WebSocket API Documentation](./WEBSOCKET_API.md)
- [Real-time Integration Guide](../../guides/REALTIME_INTEGRATION.md)
- [Collaboration Best Practices](../../guides/COLLABORATION_BEST_PRACTICES.md)

---

**Last Updated:** 2025-01-28
**Version:** 2.0.0
