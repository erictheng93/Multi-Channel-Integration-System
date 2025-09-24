# WebSocket Integration Summary

## Overview

This document summarizes the WebSocket + Durable Objects integration that has been added to the existing conversation and message handlers. The integration provides real-time broadcasting capabilities while maintaining backward compatibility with the existing SSE/Queue system.

## Architecture

### Core Components

1. **WebSocketBroadcastService** (`src/services/websocket-broadcast-service.ts`)
   - Central service for all WebSocket broadcasting operations
   - Integrates with Durable Objects (ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor)
   - Provides fallback to existing SSE/Queue system
   - Supports progressive migration with feature flags

2. **Updated Handlers**
   - `conversation-main.ts` - Conversation assignment/transfer events
   - `message.ts` - Real-time message broadcasting and typing indicators
   - `delayed-message-main.ts` - Delayed message countdown and recall events
   - `delayed-message-drizzle.ts` - Drizzle-based delayed message processing

3. **Integration Test Handler** (`src/handlers/websocket-integration-test.ts`)
   - Comprehensive testing endpoints for all WebSocket events
   - Health monitoring and diagnostics
   - Integration test scenarios

## WebSocket Event Types

### Message Events
- `message_sent` - When a new message is successfully sent
- `message_delivered` - Message delivery confirmation
- `message_read` - Message read receipt
- `message_recall_success` - Successful message recall
- `message_recall_failed` - Failed message recall attempt

### Typing Indicators
- `typing_start` - User starts typing
- `typing_stop` - User stops typing

### Conversation Events
- `conversation_assigned` - Conversation assigned to team/agent
- `conversation_transferred` - Conversation transferred
- `conversation_status_changed` - Status update (active, resolved, etc.)
- `participant_joined` - User joins conversation
- `participant_left` - User leaves conversation

### Delayed Message Events
- `delayed_message_countdown` - Real-time countdown timer
- `delayed_message_sent` - Message successfully sent after delay
- `delayed_message_recalled` - Message recalled before sending
- `delayed_message_failed` - Delayed message processing failed

### Presence Events
- `user_online` / `user_offline` / `user_away` - User presence
- `agent_available` / `agent_busy` / `agent_offline` - Agent availability

## Integration Points

### 1. Conversation Assignment (`conversation-main.ts`)

```typescript
// After successful assignment/transfer
const broadcastService = new WebSocketBroadcastService(c.env);
await broadcastService.broadcastConversationEvent({
  type: 'conversation_assigned',
  conversationId,
  userId: user.id,
  data: {
    assignedTeamId: teamId,
    assignedUserId: userId,
    assignedBy: { id: user.id, name: user.displayName, role: user.role },
    reason,
    timestamp
  },
  priority: 'normal'
});
```

### 2. Message Broadcasting (`message.ts`)

```typescript
// After message is sent
const broadcastService = new WebSocketBroadcastService(c.env);
await broadcastService.broadcastMessageEvent({
  type: 'message_sent',
  conversationId,
  messageId,
  agentId: agent.id,
  data: {
    content,
    messageType,
    sender: { id: agent.id, name: agent.displayName, role: agent.role },
    platform: conversationWithCustomer.platform,
    deliveryStatus: 'sent',
    timestamp: new Date().toISOString()
  },
  priority: 'normal'
});
```

### 3. Delayed Message Events (`delayed-message-main.ts`)

```typescript
// When delayed message is scheduled
await broadcastService.broadcastDelayedMessageEvent({
  type: 'delayed_message_countdown',
  conversationId,
  messageId,
  agentId: user.id,
  data: {
    delaySeconds,
    scheduledSendTime,
    recallDeadline,
    countdownStarted: true,
    canRecall: true,
    scheduledBy: { id: user.id, name: user.displayName, role: user.role }
  },
  priority: 'normal'
});
```

## Feature Flags and Migration

### Migration Configuration
The system supports progressive migration through feature flags stored in Cloudflare KV:

```typescript
interface MigrationConfig {
  enableWebSocket: boolean;
  enableSSE: boolean;
  migrationStrategy: 'gradual' | 'immediate' | 'canary';
  rolloutPercentage: number;
  featureFlags: {
    websocketConnections: boolean;
    durableObjectMessaging: boolean;
    distributedLocking: boolean;
    batchMessageProcessing: boolean;
    realTimeTypingIndicators: boolean;
  };
}
```

### Fallback Mechanism
When WebSocket broadcasting fails, the system automatically falls back to the existing SSE/Queue system:

```typescript
// Primary: WebSocket broadcasting
const wsSuccess = await this.broadcastToWebSocket(wsEvent);

// Fallback: SSE/Queue system
if (!wsSuccess) {
  await this.fallbackToSSE(wsEvent);
}
```

## Testing Endpoints

The integration includes comprehensive testing endpoints at `/api/websocket-test/`:

### Core Testing
- `POST /test-message-broadcast` - Test message broadcasting
- `POST /test-typing-indicator` - Test typing indicators
- `POST /test-conversation-event` - Test conversation events
- `POST /test-delayed-message-event` - Test delayed message events
- `POST /test-presence-event` - Test presence events
- `POST /test-batch-broadcast` - Test batch event broadcasting

### Health and Status
- `GET /health` - Service health status
- `GET /websocket-status` - WebSocket availability
- `POST /send-test-event` - Send test event to specific target

### Integration Tests
- `POST /run-integration-test` - Comprehensive integration test
- `GET /test-conversations` - Get test conversation data

## Example Usage

### 1. Test Message Broadcasting

```bash
curl -X POST http://localhost:8787/api/websocket-test/test-message-broadcast \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_123",
    "content": "Test message",
    "messageType": "text"
  }'
```

### 2. Test Typing Indicators

```bash
curl -X POST http://localhost:8787/api/websocket-test/test-typing-indicator \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_123",
    "action": "start"
  }'
```

### 3. Run Integration Test

```bash
curl -X POST http://localhost:8787/api/websocket-test/run-integration-test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_123"
  }'
```

## Error Handling and Monitoring

### Error Handling
- All WebSocket broadcasts are wrapped in try-catch blocks
- Failures gracefully fall back to SSE/Queue system
- Detailed error logging for troubleshooting
- Non-blocking error handling (doesn't break main functionality)

### Monitoring
- Health status endpoints for service monitoring
- Broadcasting success/failure metrics
- Connection count and performance metrics
- Migration status and feature flag monitoring

## Performance Considerations

### Efficient Broadcasting
- Uses Durable Objects for distributed event handling
- Batch processing for multiple events
- Connection pooling and reuse
- Optimized message routing based on target types

### Resource Management
- Connection limits per user and globally
- Automatic cleanup of inactive connections
- Memory-efficient event queuing
- Rate limiting for broadcast operations

## Security

### Authentication
- All WebSocket connections require JWT authentication
- Role-based access control for broadcasting
- Permission checks before sending events

### Data Protection
- Message content truncation for sensitive data
- Secure event payload handling
- Audit logging for all broadcast operations

## Next Steps

1. **Frontend Integration**: Update frontend to connect to WebSocket endpoints
2. **Monitoring Setup**: Implement comprehensive monitoring dashboards
3. **Performance Testing**: Load test the WebSocket system under high traffic
4. **Migration Planning**: Plan gradual rollout strategy
5. **Documentation**: Create frontend developer guide for WebSocket integration

## Configuration

### Environment Variables
Ensure these are set in your `wrangler.toml`:

```toml
[env.production.vars]
# WebSocket feature flags
WEBSOCKET_ENABLED = "true"
SSE_ENABLED = "true"
MIGRATION_STRATEGY = "gradual"
ROLLOUT_PERCENTAGE = "50"

# Durable Object bindings
[[env.production.durable_objects.bindings]]
name = "CONVERSATION_ROOM"
class_name = "ConversationRoom"

[[env.production.durable_objects.bindings]]
name = "USER_CONNECTION"
class_name = "UserConnection"

[[env.production.durable_objects.bindings]]
name = "MESSAGE_BROADCASTER"
class_name = "MessageBroadcaster"

[[env.production.durable_objects.bindings]]
name = "DELAYED_MESSAGE_PROCESSOR"
class_name = "DelayedMessageProcessor"
```

## Troubleshooting

### Common Issues
1. **WebSocket broadcasts not working**: Check feature flags and Durable Object bindings
2. **Fallback to SSE not working**: Verify existing SSE system is still functional
3. **Permission errors**: Ensure proper role-based access control
4. **Connection limits**: Check connection count limits and cleanup

### Debug Endpoints
- Use test endpoints to verify functionality
- Check health status for service availability
- Monitor error logs for detailed troubleshooting information

This integration provides a robust, scalable real-time messaging system while maintaining full backward compatibility with the existing architecture.