# WebSocket + Durable Objects Architecture Guide

## 🏗️ Comprehensive Durable Objects Architecture for Real-time Customer Service

This document outlines the complete architecture for migrating from SSE + polling to WebSocket + Durable Objects for real-time customer service chat system.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Durable Object Classes](#durable-object-classes)
3. [Distributed Locking System](#distributed-locking-system)
4. [WebSocket Connection Lifecycle](#websocket-connection-lifecycle)
5. [Migration Strategy](#migration-strategy)
6. [Implementation Guide](#implementation-guide)
7. [Performance Considerations](#performance-considerations)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## 🌐 Architecture Overview

### Current vs. New Architecture

**Current Architecture (SSE + Polling):**
```
Client → HTTP API → Cloudflare Queue → SSE Connection Manager → Server-Sent Events
                 ↘                  ↗
                   Cloudflare KV (backup storage)
```

**New Architecture (WebSocket + Durable Objects):**
```
Client ↔ WebSocket Handler ↔ UserConnection DO ↔ ConversationRoom DO
                           ↘                  ↗
                             MessageBroadcaster DO
                           ↗                  ↘
DelayedMessageProcessor DO ↔ DistributedLock DO ↔ Database & External APIs
```

### Key Benefits

1. **Bidirectional Communication**: Real-time messaging in both directions
2. **Strong Consistency**: Durable Objects ensure message ordering and state consistency
3. **Distributed Locking**: Prevents race conditions across all operations
4. **Batch Processing**: Efficient handling of delayed messages
5. **Progressive Migration**: Gradual rollout with feature flags
6. **Failover Support**: Automatic fallback to SSE when needed

---

## 🏛️ Durable Object Classes

### 1. ConversationRoom
**Purpose**: Manages WebSocket connections for a specific conversation

**File**: `src/durable-objects/ConversationRoom.ts`

**Key Features**:
- Per-conversation connection management
- Real-time message broadcasting
- Participant tracking and typing indicators
- Message ordering with distributed locks
- Connection lifecycle management

**API Endpoints**:
- `GET /connect` - WebSocket upgrade for conversation
- `POST /broadcast` - Broadcast event to all participants
- `GET /participants` - Get active participants
- `POST /lock` - Acquire/release conversation locks
- `GET /metrics` - Connection and performance metrics

### 2. UserConnection
**Purpose**: Manages user's global connection state across all conversations

**File**: `src/durable-objects/UserConnection.ts`

**Key Features**:
- Cross-conversation subscriptions
- User presence management
- Connection multiplexing
- User-specific preferences
- Global notification handling

**API Endpoints**:
- `GET /connect` - WebSocket upgrade for user
- `POST /subscribe` - Subscribe to conversation
- `POST /unsubscribe` - Unsubscribe from conversation
- `POST /presence` - Update presence status
- `GET /status` - Get user connection status

### 3. MessageBroadcaster
**Purpose**: Handles global event distribution and routing

**File**: `src/durable-objects/MessageBroadcaster.ts`

**Key Features**:
- Event queue management with priority
- Intelligent message routing
- Batch processing for efficiency
- Cross-room communication
- Performance monitoring

**API Endpoints**:
- `POST /broadcast` - Queue event for distribution
- `POST /register-connection` - Register DO connection
- `POST /system-broadcast` - System-wide notifications
- `GET /metrics` - Distribution statistics
- `POST /flush-queue` - Force queue processing

### 4. DelayedMessageProcessor
**Purpose**: Batch processing of scheduled/delayed messages

**File**: `src/durable-objects/DelayedMessageProcessor.ts`

**Key Features**:
- Efficient message scheduling
- Batch processing with configurable sizes
- Message cancellation and recall
- Platform integration (LINE/Facebook)
- Retry mechanisms with exponential backoff

**API Endpoints**:
- `POST /schedule` - Schedule delayed message
- `POST /cancel` - Cancel scheduled message
- `POST /reschedule` - Reschedule message
- `GET /get-scheduled` - Get scheduled messages
- `POST /process-batch` - Trigger batch processing

### 5. LockCoordinator (Distributed Locking)
**Purpose**: Provides distributed locking across all Durable Objects

**File**: `src/services/distributed-lock-service.ts`

**Key Features**:
- Deadlock prevention
- Lock timeout and cleanup
- Performance monitoring
- Emergency lock cleanup
- Lock ownership tracking

**API Endpoints**:
- `POST /acquire` - Acquire distributed lock
- `POST /try-acquire` - Try to acquire without waiting
- `POST /release` - Release lock
- `POST /extend` - Extend lock TTL
- `GET /metrics` - Lock system metrics

---

## 🔒 Distributed Locking System

### Architecture
```
Any Durable Object → DistributedLockService → LockCoordinator DO → Persistent Storage
```

### Lock Types
1. **Message Ordering**: Ensures messages are processed in order
2. **Participant Management**: Prevents race conditions when users join/leave
3. **State Updates**: Protects critical state modifications
4. **Resource Access**: Controls access to shared resources

### Usage Example
```typescript
const lockService = new DistributedLockService(env);

// Acquire lock with timeout
const lockId = await lockService.acquireLock('conversation:123', {
  ttl: 30000,      // 30 seconds
  timeout: 5000    // 5 second acquisition timeout
});

try {
  // Critical section - guaranteed exclusive access
  await performCriticalOperation();
} finally {
  // Always release lock
  await lockService.releaseLock(lockId);
}

// Or use convenience method
await lockService.withLock('user:456', async () => {
  // Critical section with automatic cleanup
  await updateUserState();
});
```

---

## 🔌 WebSocket Connection Lifecycle

### Connection Flow
```
1. Client → WebSocket Handler (authentication & upgrade)
2. WebSocket Handler → UserConnection DO (register user connection)
3. UserConnection DO → ConversationRoom DO (if specific conversation)
4. All DOs → MessageBroadcaster DO (register for global events)
```

### Connection States
- **Connecting**: WebSocket upgrade in progress
- **Connected**: Active WebSocket connection
- **Subscribing**: Joining conversation rooms
- **Active**: Fully operational with all subscriptions
- **Reconnecting**: Temporary disconnection, attempting reconnect
- **Disconnected**: Connection closed

### Heartbeat & Health Monitoring
- **Ping/Pong**: 30-second intervals for connection health
- **Activity Tracking**: Last message timestamp
- **Automatic Cleanup**: Remove inactive connections after 5 minutes
- **Health Checks**: Monitor connection quality and performance

---

## 🚀 Migration Strategy

### Progressive Rollout System

**File**: `src/services/migration-service.ts`

### Migration Phases

#### 1. Canary Phase (5% of users)
- Admin users and team leaders
- High-activity users
- Users with specific feature flags

#### 2. Gradual Phase (5% → 100%)
- Percentage-based rollout with smart criteria
- Boost factors for compatible browsers/devices
- Team-based rollout coordination

#### 3. Immediate Phase (100%)
- All users use WebSocket
- SSE maintained as fallback only

### Decision Engine
```typescript
const migrationService = new MigrationService(env);

const decision = await migrationService.shouldUseWebSocket(
  userId,
  userAgent,
  {
    role: 'admin',
    conversationId: 'conv_123',
    previousConnectionType: 'websocket',
    connectionFailures: 0
  }
);

// Returns:
// {
//   useWebSocket: true,
//   reason: 'User in rollout group (15% < 75%) with boosts: admin role, modern browser',
//   fallbackAvailable: true,
//   migrationPhase: 'gradual'
// }
```

### Feature Flags
- `websocketConnections`: Enable WebSocket connections
- `durableObjectMessaging`: Use Durable Objects for messaging
- `distributedLocking`: Enable distributed locking
- `batchMessageProcessing`: Use batch processing for delayed messages
- `realTimeTypingIndicators`: Real-time typing indicators

---

## 📖 Implementation Guide

### 1. Update wrangler.toml
Copy configuration from `wrangler-websocket.toml`:

```toml
# Add Durable Object bindings
[[durable_objects.bindings]]
name = "CONVERSATION_ROOM"
class_name = "ConversationRoom"

[[durable_objects.bindings]]
name = "USER_CONNECTION"
class_name = "UserConnection"

# ... (other DO bindings)
```

### 2. Update src/index.ts
```typescript
// Export Durable Object classes
export { ConversationRoom } from './durable-objects/ConversationRoom';
export { UserConnection } from './durable-objects/UserConnection';
export { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
export { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
export { LockCoordinator } from './services/distributed-lock-service';

// Add WebSocket routes
app.route('/api/websocket', websocketHandler);
```

### 3. Frontend Integration
```typescript
// WebSocket connection with fallback
const connectToRealtime = async () => {
  try {
    // Try WebSocket first
    const ws = new WebSocket(`wss://api.yourdomain.com/api/websocket/connect?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Subscribe to conversations
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { type: 'conversation', target: conversationId }
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleRealtimeMessage(message);
    };

    ws.onerror = () => {
      // Fallback to SSE
      connectToSSE();
    };

  } catch (error) {
    // Fallback to SSE
    connectToSSE();
  }
};
```

### 4. Database Migration
No database schema changes required - the system uses existing tables.

### 5. Environment Variables
Set these via `wrangler secret put`:
- `JWT_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- Other existing secrets

---

## ⚡ Performance Considerations

### Durable Objects Scaling
- **Automatic Scaling**: Each conversation gets its own DO instance
- **Geographic Distribution**: DOs spawn close to users
- **Memory Management**: Automatic hibernation after inactivity
- **Connection Limits**: 1,000 connections per ConversationRoom

### Message Processing
- **Batch Processing**: Delayed messages processed in batches of 50
- **Priority Queues**: High-priority messages processed faster
- **Event Deduplication**: Prevent duplicate event processing
- **Compression**: WebSocket message compression enabled

### Lock Performance
- **Lock Timeouts**: Default 30-second TTL prevents deadlocks
- **Lock Cleanup**: Automatic cleanup of expired locks
- **Contention Monitoring**: Track lock acquisition times
- **Emergency Controls**: Force release all locks if needed

### Memory Optimization
- **Message History Limits**: Max 50 messages per conversation
- **Connection Cleanup**: Remove inactive connections after 5 minutes
- **State Persistence**: Important state saved to Durable Object storage
- **Garbage Collection**: Regular cleanup of old data

---

## 📊 Monitoring & Troubleshooting

### Health Endpoints
- `GET /api/websocket/health` - Overall system health
- `GET /api/websocket/metrics` - Detailed performance metrics
- `GET /api/websocket/migration-status` - Migration progress

### Key Metrics
1. **Connection Metrics**:
   - Total WebSocket connections
   - Connection success rate
   - Average connection latency
   - Reconnection frequency

2. **Message Metrics**:
   - Messages per second throughput
   - Message delivery success rate
   - Average message latency
   - Queue depth and processing time

3. **Migration Metrics**:
   - WebSocket adoption rate
   - Fallback usage rate
   - Migration success rate
   - User satisfaction scores

### Common Issues & Solutions

#### High Memory Usage
```typescript
// Implement connection limits
const MAX_CONNECTIONS_PER_ROOM = 100;
if (this.connections.size >= MAX_CONNECTIONS_PER_ROOM) {
  return new Response('Room full', { status: 429 });
}
```

#### Message Delivery Failures
```typescript
// Retry with exponential backoff
const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
setTimeout(() => retryMessage(message), retryDelay);
```

#### Lock Contention
```typescript
// Use shorter lock TTLs and retry intervals
const lockId = await lockService.acquireLock(resource, {
  ttl: 5000,        // Shorter TTL
  retryInterval: 50  // Faster retries
});
```

#### WebSocket Connection Issues
```typescript
// Implement automatic fallback
ws.onerror = (error) => {
  console.warn('WebSocket error, falling back to SSE');
  migrationService.emergencyFallbackToSSE('WebSocket connection failed');
  connectToSSE();
};
```

### Emergency Controls
```typescript
// Emergency fallback to SSE
await migrationService.emergencyFallbackToSSE('High error rate detected');

// Pause rollout
await migrationService.emergencyPauseRollout('Performance issues');

// Force cleanup
await lockService.cleanupExpiredLocks();
```

---

## 🚀 Deployment Steps

### 1. Development Testing
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test WebSocket connections
curl -H "Upgrade: websocket" http://localhost:8787/api/websocket/connect
```

### 2. Staging Deployment
```bash
# Deploy to staging
wrangler deploy --env development

# Run integration tests
npm run test:websocket

# Monitor metrics
curl https://staging-api.yourdomain.com/api/websocket/health
```

### 3. Production Rollout
```bash
# Deploy to production with 0% rollout
wrangler deploy --env production

# Gradually increase rollout percentage
curl -X POST https://api.yourdomain.com/api/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rolloutPercentage": 10}'

# Monitor and increase gradually
# 10% → 25% → 50% → 75% → 100%
```

### 4. Monitoring Dashboard
Set up monitoring for:
- Connection success rates
- Message delivery latency
- Error rates and types
- Migration progress
- System resource usage

---

## 📝 Summary

This comprehensive WebSocket + Durable Objects architecture provides:

✅ **Real-time bidirectional communication**
✅ **Strong consistency with distributed locking**
✅ **Efficient batch processing**
✅ **Progressive migration with fallback**
✅ **Production-ready scalability**
✅ **Comprehensive monitoring**

The system is designed for gradual rollout with minimal risk, providing significant performance improvements while maintaining backward compatibility with the existing SSE system.

### Next Steps
1. Review and test the implementation
2. Update wrangler.toml with the new configuration
3. Deploy to development environment
4. Conduct thorough testing
5. Plan production rollout strategy
6. Monitor metrics and performance
7. Gradually increase WebSocket adoption
8. Eventually deprecate SSE system

For questions or issues, refer to the troubleshooting section or contact the development team.