# Phase B5 - Conversation WebSocket Migration (Future Scope)

**Status**: ⏳ Planned (Not Started)
**Estimated Effort**: 10-14 hours
**Priority**: Medium
**Dependencies**: Phase B4 Complete ✅

---

## Overview

Phase B5 will complete the final piece of WebSocket architecture unification by migrating `useConversationWebSocket.ts` to the global WebSocket Store. This phase was deferred from Phase B4 due to the complexity of conversation-specific features and the need for backend WebSocket room management support.

---

## Why Deferred from Phase B4

### Complexity Analysis

**useConversationWebSocket.ts Statistics**:
- **File Size**: 406 lines
- **Complexity**: High - Conversation-specific features
- **Dependencies**: Requires backend room management

**Features Requiring Special Handling**:
1. **Conversation Rooms** - Join/leave room management
2. **Typing Indicators** - Real-time typing status broadcasting
3. **Presence Management** - Online/offline/away status tracking
4. **Message Delivery Status** - Read receipts, delivery confirmation
5. **Conversation State Sync** - Participant updates, metadata changes

**Backend Requirements**:
- Durable Objects room management implementation
- WebSocket message routing for conversation-specific events
- Broadcast logic for room participants
- State synchronization across connections

**Decision**: Focus Phase B4 on removing deprecated `globalWebSocket.ts` (350+ lines) rather than complex refactoring. This achieves single WebSocket connection while deferring advanced features.

---

## Phase B5 Scope

### 1. Frontend Migration (6-8 hours)

**File to Migrate**: `frontend/src/composables/useConversationWebSocket.ts` (406 lines)

**Migration Tasks**:

#### A. Replace WebSocket Composable (2 hours)
```typescript
// BEFORE (Current):
import { useWebSocket } from './useWebSocket'
const { isConnected, send, disconnect } = useWebSocket({
  autoConnect: true,
  reconnectOnAuth: true
})

// AFTER (Phase B5):
import { useWebSocketStore } from '@/stores/websocket'
const wsStore = useWebSocketStore()
let conversationSubscriptionId: SubscriptionId | null = null
```

#### B. Implement Conversation Room Subscription (2 hours)
```typescript
// Subscribe to conversation-specific channel
function joinConversation(conversationId: string) {
  const channel = `conversation:${conversationId}`

  conversationSubscriptionId = wsStore.subscribe(channel, (message) => {
    handleConversationMessage(message)
  })

  // Send join room message to backend
  wsStore.send({
    type: 'conversation_join',
    conversationId
  })
}

function leaveConversation() {
  if (conversationSubscriptionId) {
    wsStore.unsubscribe(conversationSubscriptionId)

    wsStore.send({
      type: 'conversation_leave',
      conversationId: currentConversationId.value
    })
  }
}
```

#### C. Migrate Typing Indicator (1 hour)
```typescript
// BEFORE:
function sendTypingIndicator() {
  if (isConnected.value) {
    send({
      type: 'typing',
      conversationId: currentConversationId.value
    })
  }
}

// AFTER:
function sendTypingIndicator() {
  wsStore.send({
    type: 'typing_start',
    conversationId: currentConversationId.value,
    agentId: authStore.currentAgent?.id
  })
}

function stopTyping() {
  wsStore.send({
    type: 'typing_stop',
    conversationId: currentConversationId.value,
    agentId: authStore.currentAgent?.id
  })
}
```

#### D. Migrate Presence Management (1 hour)
```typescript
// AFTER:
function updatePresence(status: 'online' | 'away' | 'offline') {
  wsStore.send({
    type: 'presence_update',
    status,
    agentId: authStore.currentAgent?.id
  })
}

// Handle incoming presence updates
function handleConversationMessage(message: WebSocketMessage) {
  switch (message.type) {
    case 'presence_update':
      updateParticipantPresence(message.data)
      break
    case 'typing_start':
      showTypingIndicator(message.data.agentId)
      break
    case 'typing_stop':
      hideTypingIndicator(message.data.agentId)
      break
    // ... other message types
  }
}
```

#### E. Update Lifecycle Management (2 hours)
```typescript
// Automatic cleanup on component unmount
onMounted(() => {
  if (conversationId.value) {
    joinConversation(conversationId.value)
  }
})

onUnmounted(() => {
  leaveConversation()
})

// Watch for conversation changes
watch(() => conversationId.value, (newId, oldId) => {
  if (oldId) {
    leaveConversation()
  }
  if (newId) {
    joinConversation(newId)
  }
})
```

---

### 2. Backend WebSocket Room Support (4-6 hours)

**Files to Create/Update**:

#### A. Create Conversation Room Durable Object (3 hours)

**File**: `src/durable-objects/ConversationRoomDO.ts`

```typescript
export class ConversationRoomDO {
  private state: DurableObjectState
  private participants: Map<string, WebSocket> = new Map()
  private typingUsers: Set<string> = new Set()
  private conversationId: string

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.conversationId = state.id.toString()
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.handleWebSocketSession(server, request)

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  private handleWebSocketSession(ws: WebSocket, request: Request) {
    const url = new URL(request.url)
    const agentId = url.searchParams.get('agentId')

    if (!agentId) {
      ws.close(4000, 'Missing agent ID')
      return
    }

    // Add participant to room
    this.participants.set(agentId, ws)
    this.broadcastPresence(agentId, 'joined')

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string)
      this.handleRoomMessage(agentId, message)
    })

    ws.addEventListener('close', () => {
      this.participants.delete(agentId)
      this.typingUsers.delete(agentId)
      this.broadcastPresence(agentId, 'left')
    })

    ws.accept()
  }

  private handleRoomMessage(agentId: string, message: any) {
    switch (message.type) {
      case 'typing_start':
        this.typingUsers.add(agentId)
        this.broadcastToRoom({
          type: 'typing_start',
          agentId,
          conversationId: this.conversationId
        }, agentId)
        break

      case 'typing_stop':
        this.typingUsers.delete(agentId)
        this.broadcastToRoom({
          type: 'typing_stop',
          agentId,
          conversationId: this.conversationId
        }, agentId)
        break

      case 'new_message':
        this.broadcastToRoom({
          type: 'new_message',
          data: message.data,
          conversationId: this.conversationId
        })
        break
    }
  }

  private broadcastToRoom(message: any, excludeAgentId?: string) {
    const messageStr = JSON.stringify(message)
    for (const [agentId, ws] of this.participants.entries()) {
      if (agentId !== excludeAgentId) {
        try {
          ws.send(messageStr)
        } catch (err) {
          console.error(`Failed to send to ${agentId}:`, err)
        }
      }
    }
  }

  private broadcastPresence(agentId: string, action: 'joined' | 'left') {
    this.broadcastToRoom({
      type: 'presence_update',
      agentId,
      action,
      participantCount: this.participants.size
    })
  }
}
```

#### B. Update WebSocket Main Handler (1 hour)

**File**: `src/handlers/websocket-main.ts`

```typescript
// Add conversation room routing
if (url.pathname.startsWith('/api/websocket/conversation/')) {
  const conversationId = url.pathname.split('/').pop()

  // Get Durable Object for this conversation
  const id = env.CONVERSATION_ROOM.idFromName(conversationId!)
  const stub = env.CONVERSATION_ROOM.get(id)

  // Forward request to Durable Object
  return stub.fetch(request)
}
```

#### C. Update wrangler.toml Configuration (30 minutes)

```toml
[[durable_objects.bindings]]
name = "CONVERSATION_ROOM"
class_name = "ConversationRoomDO"
script_name = "multi-channel-worker"

[[migrations]]
tag = "v6"
new_classes = ["ConversationRoomDO"]
```

---

### 3. Integration Testing (2 hours)

**Test Files to Create**:

#### A. Frontend Unit Tests
```typescript
// tests/unit/composables/useConversationWebSocket.test.ts
describe('useConversationWebSocket (Phase B5)', () => {
  test('should join conversation room on mount', () => {
    // Test room joining
  })

  test('should send typing indicators', () => {
    // Test typing indicator broadcast
  })

  test('should handle presence updates', () => {
    // Test presence management
  })

  test('should leave room on unmount', () => {
    // Test cleanup
  })
})
```

#### B. Backend Durable Object Tests
```typescript
// tests/integration/durable-objects/conversation-room.test.ts
describe('ConversationRoomDO', () => {
  test('should accept WebSocket connections', () => {
    // Test connection acceptance
  })

  test('should broadcast typing indicators to room participants', () => {
    // Test typing broadcast
  })

  test('should handle participant join/leave', () => {
    // Test participant management
  })

  test('should not broadcast to sender', () => {
    // Test exclusion logic
  })
})
```

#### C. End-to-End Tests
```typescript
// tests/e2e/conversation-websocket.test.ts
describe('Conversation WebSocket E2E', () => {
  test('should show typing indicator when participant types', () => {
    // Simulate 2 agents in same conversation
    // Agent 1 types, Agent 2 sees indicator
  })

  test('should update presence when agent goes online/offline', () => {
    // Test presence synchronization
  })

  test('should deliver messages to all participants', () => {
    // Test message broadcast
  })
})
```

---

## Migration Checklist

### Pre-Migration Tasks
- [ ] Review current `useConversationWebSocket.ts` implementation
- [ ] Document all conversation-specific features
- [ ] Identify edge cases and error scenarios
- [ ] Create test plan for all features

### Frontend Migration
- [ ] Replace `useWebSocket()` with `useWebSocketStore`
- [ ] Implement conversation room subscription pattern
- [ ] Migrate typing indicator logic
- [ ] Migrate presence management
- [ ] Update lifecycle management (mount/unmount/watch)
- [ ] Add proper TypeScript typing
- [ ] Update component imports

### Backend Implementation
- [ ] Create `ConversationRoomDO.ts` Durable Object
- [ ] Implement room join/leave logic
- [ ] Implement typing indicator broadcasting
- [ ] Implement presence management
- [ ] Add message routing to room participants
- [ ] Update `websocket-main.ts` routing
- [ ] Update `wrangler.toml` configuration
- [ ] Deploy Durable Object migration

### Testing
- [ ] Write frontend unit tests
- [ ] Write backend Durable Object tests
- [ ] Write integration tests
- [ ] Write end-to-end tests
- [ ] Manual testing with multiple agents
- [ ] Load testing with multiple rooms

### Documentation
- [ ] Update `CLAUDE.md` with Phase B5 completion
- [ ] Create Phase B5 completion report
- [ ] Update WebSocket architecture diagrams
- [ ] Document conversation room API

---

## Expected Outcomes

### Architecture Benefits

**Before Phase B5**:
```
┌──────────────────────────────────────────┐
│  ConversationDetail View                  │
├──────────────────────────────────────────┤
│  useConversationWebSocket.ts             │
│  (Old pattern - separate connection)     │
├──────────────────────────────────────────┤
│  Separate WebSocket Connection           │  ← Additional connection
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Other Modules (Conversations, etc.)      │
├──────────────────────────────────────────┤
│  Global WebSocket Store                  │
├──────────────────────────────────────────┤
│  Single WebSocket Connection             │  ← Main connection
└──────────────────────────────────────────┘
```

**After Phase B5**:
```
┌──────────────────────────────────────────┐
│  All Application Modules                  │
│  (Conversations, Notifications, Activity, │
│   ConversationDetail)                     │
├──────────────────────────────────────────┤
│  Global WebSocket Store                  │
│  ┌────────────────────────────────────┐  │
│  │ Subscription Manager                │  │
│  │  - conversations: [sub1]            │  │
│  │  - notifications: [sub2]            │  │
│  │  - activity: [sub3]                 │  │
│  │  - conversation:{id}: [sub4]        │  │  ← NEW
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  Single WebSocket Connection             │
│  ┌────────────────────────────────────┐  │
│  │ Durable Objects Backend             │  │
│  │  - ConversationRoom (per conv)      │  │  ← NEW
│  │  - MessageBroadcaster (global)      │  │
│  │  - UserConnection (per user)        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Performance Improvements

**Connection Count**:
- Before: 1 global + 1 per conversation = 2+ connections
- After: 1 global connection (shared by all features)
- **Improvement**: 50%+ reduction in connections

**Memory Usage**:
- Before: ~200KB (global) + ~150KB (per conversation)
- After: ~200KB total
- **Improvement**: ~150KB savings per active conversation

**Network Efficiency**:
- Multiplexed messaging over single connection
- Reduced connection establishment overhead
- Better resource utilization

### Feature Enhancements

1. **Unified Typing Indicators**: Consistent across all views
2. **Better Presence Management**: Real-time status updates
3. **Room-based Broadcasting**: Efficient message delivery
4. **Scalable Architecture**: Durable Objects handle state

---

## Risks & Mitigation

### Risk 1: Breaking Existing Conversation Features

**Mitigation**:
- Comprehensive testing before deployment
- Feature flag to toggle between old/new implementation
- Gradual rollout with monitoring

### Risk 2: Backend Room Management Complexity

**Mitigation**:
- Start with simple room implementation
- Add features incrementally
- Test with multiple participants

### Risk 3: Durable Objects Migration Downtime

**Mitigation**:
- Deploy during low-traffic window
- Use Cloudflare's migration system
- Have rollback plan ready

---

## Success Criteria

Phase B5 will be considered complete when:

- ✅ `useConversationWebSocket.ts` migrated to global WebSocket Store
- ✅ Conversation room Durable Object implemented and deployed
- ✅ Typing indicators work in real-time across participants
- ✅ Presence management updates correctly
- ✅ All tests passing (unit, integration, E2E)
- ✅ No regression in existing conversation features
- ✅ Single WebSocket connection for entire application
- ✅ Documentation updated with new architecture

---

## Timeline Estimate

**Total Effort**: 10-14 hours

**Breakdown**:
- Frontend Migration: 6-8 hours
- Backend Implementation: 4-6 hours
- Testing: 2 hours
- Documentation: 1 hour

**Suggested Schedule** (if working full-time):
- Day 1 (4 hours): Frontend migration
- Day 2 (4 hours): Backend Durable Object implementation
- Day 3 (3 hours): Testing and bug fixes
- Day 4 (2 hours): Documentation and deployment

**Suggested Schedule** (if working part-time, 2 hours/day):
- Week 1 (10 hours): Complete migration
- Week 2 (4 hours): Testing, documentation, deployment

---

## Notes for Future Developer

### Important Considerations

1. **Don't Rush**: Conversation features are critical - take time to test thoroughly
2. **Test with Multiple Agents**: Typing indicators and presence need multi-user testing
3. **Monitor Durable Objects**: Watch for connection limits and memory usage
4. **Have Rollback Plan**: Keep old implementation until confident in new one

### Helpful Resources

- Cloudflare Durable Objects Docs: https://developers.cloudflare.com/durable-objects/
- WebSocket API Reference: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Vue Composition API: https://vuejs.org/api/composition-api.html
- Pinia Store Documentation: https://pinia.vuejs.org/

### Questions to Answer During Migration

- How many participants per conversation on average?
- What's the max conversation room size?
- Should typing indicators timeout after X seconds?
- How to handle presence when user has multiple tabs?
- Should we persist room state in Durable Object storage?

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Author:** Claude Code Assistant
**Status:** Planning Document for Future Work
