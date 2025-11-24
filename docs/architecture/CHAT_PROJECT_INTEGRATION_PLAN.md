# 🔥 Chat Project Integration Plan
## Conversation System Reconstruction

**Branch**: `feat/chat-style-conversation`
**Rollback Point**: `pre-conversation-refactor`
**Target**: Single conversation view at `/conversations/{id}`
**Status**: ⚡ **ACTIVE IMPLEMENTATION**

---

## 📋 **Executive Summary**

We are integrating the **Chat Project's** conversation architecture into the Multi-Channel Customer Support System's conversation detail view (`/conversations/{id}`). This integration will adopt the simpler, more direct WebSocket communication pattern from the Chat Project while maintaining all existing features and other modules untouched.

### **Why This Integration?**

1. ✅ **Simpler WebSocket Architecture**: Chat Project uses 2 Durable Objects vs Current System's 7 (more direct)
2. ✅ **Direct Communication Pattern**: AuthorizationDO → ConversationDO (fewer hops, lower latency)
3. ✅ **Proven UI/UX**: Clean, responsive conversation interface that user specifically requested
4. ✅ **R2 File Upload**: Direct integration with Cloudflare R2 storage
5. ✅ **User Presence**: Built-in online/offline status tracking

---

## 📊 **Architecture Comparison**

### **Chat Project Architecture** (Reference)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CHAT PROJECT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  2 Durable Objects (Monolithic but Effective):                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. AuthorizationDurableObject                                          │  │
│  │    ├─ User Authentication (login/register)                             │  │
│  │    ├─ Session Management (30-day sessions)                             │  │
│  │    ├─ Channel CRUD operations                                          │  │
│  │    ├─ WebSocket Connection Management (Map<userId, WebSocket>)         │  │
│  │    ├─ User Presence Broadcasting (USER_CONNECTED/DISCONNECTED)         │  │
│  │    └─ notifyChannelUpdate() - Broadcasts to channel members           │  │
│  │                                                                         │  │
│  │ 2. ConversationDurableObject                                           │  │
│  │    ├─ Message Storage (DO SQL Storage)                                 │  │
│  │    ├─ Message Retrieval with Pagination                                │  │
│  │    ├─ File Upload to R2                                                │  │
│  │    └─ Message Creation (calls AuthorizationDO.notify())               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Communication Flow:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ User sends message → ConversationDO.POST /messages                     │  │
│  │                   → Store in DO SQL                                    │  │
│  │                   → AuthorizationDO.notify(channelId, message)         │  │
│  │                   → AuthorizationDO broadcasts to all channel members  │  │
│  │                   → WebSocket delivers to connected clients            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Frontend (React 19):                                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ WebSocketProvider → Manages WS connection & listeners                  │  │
│  │ ChatProvider → Manages channels, users, messages                       │  │
│  │ channel.tsx → Main conversation interface                              │  │
│  │ ChatInput.tsx → Message input with file upload                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### **Current Multi-Channel System** (Existing)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-CHANNEL CURRENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  7 Specialized Durable Objects:                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. ConversationRoom - WebSocket hub per conversation                   │  │
│  │ 2. UserConnection - User presence & subscriptions                      │  │
│  │ 3. MessageBroadcaster - Event distribution coordinator                 │  │
│  │ 4. DelayedMessageProcessor - Scheduled messages                        │  │
│  │ 5. DelayedMessageBuffer - Undo buffer                                  │  │
│  │ 6. LockCoordinator - Distributed locking                               │  │
│  │ 7. LatestMessageCacheCoordinator - Cache updates                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Communication Flow:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ User sends message → HTTP API                                          │  │
│  │                   → Store in D1 Database                               │  │
│  │                   → MessageBroadcaster.broadcast()                     │  │
│  │                   → ConversationRoom DO                                │  │
│  │                   → WebSocket delivers to clients                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Frontend (Vue 3):                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ConversationDetail.vue - Main conversation interface (200+ lines)      │  │
│  │ VirtualMessageList.vue - Virtual scrolling message list                │  │
│  │ MessageInput.vue - Complex input with many features                    │  │
│  │ websocketClient.ts - Advanced WebSocket client                         │  │
│  │ conversationSync.ts - Sync service                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Integration Strategy: Hybrid Approach**

We will create a **simplified conversation system** inspired by Chat Project while keeping other modules intact:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HYBRID INTEGRATION ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Backend: Simplified 2-DO Pattern (Customer Conversations Only)             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ CustomerConversationDO (New - Inspired by AuthorizationDO)             │  │
│  │    ├─ WebSocket Connection Management                                  │  │
│  │    ├─ User Presence (agents only)                                      │  │
│  │    ├─ Real-time Message Broadcasting                                   │  │
│  │    └─ Map<userId, WebSocket>                                           │  │
│  │                                                                         │  │
│  │ CustomerMessageDO (New - Inspired by ConversationDO)                   │  │
│  │    ├─ Message Storage (D1 Database - NOT DO SQL)                       │  │
│  │    ├─ Message Retrieval with Pagination                                │  │
│  │    ├─ File Upload to R2                                                │  │
│  │    └─ Calls CustomerConversationDO.notify() after message creation    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Frontend: Recreate Chat UI in Vue 3                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ConversationDetail.vue (COMPLETE REWRITE)                              │  │
│  │    ├─ Simpler Structure (like channel.tsx)                             │  │
│  │    ├─ Header (customer info, status, online indicator)                 │  │
│  │    ├─ Message List (simple scroll, no virtual)                         │  │
│  │    ├─ Direct WebSocket Connection                                      │  │
│  │    └─ Simple Message Input with R2 Upload                              │  │
│  │                                                                         │  │
│  │ customerWebSocketClient.ts (New composable)                            │  │
│  │    ├─ WebSocket lifecycle (connect, disconnect, reconnect)             │  │
│  │    ├─ Message listeners (channel-specific)                             │  │
│  │    ├─ Presence tracking                                                │  │
│  │    └─ Auto-reconnect on focus                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ⚠️ IMPORTANT: Other modules remain UNTOUCHED                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ✅ Team Management                                                      │  │
│  │ ✅ Analytics & Reports                                                  │  │
│  │ ✅ QR Code Management                                                   │  │
│  │ ✅ Tag System                                                           │  │
│  │ ✅ Authentication & Authorization                                       │  │
│  │ ✅ All other backend handlers                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 **Detailed Implementation Plan**

### **Phase 1: Backend - Durable Objects** (Day 1-2)

#### **Step 1.1: Create CustomerConversationDO**
**File**: `src/durable-objects/CustomerConversationDO.ts`

**Responsibilities**:
- WebSocket connection management per conversation
- User presence broadcasting (agents in conversation)
- Message broadcasting to connected agents
- Map<userId, WebSocket> connection tracking

**Key Methods**:
```typescript
class CustomerConversationDO {
  private connections = new Map<string, WebSocket>();

  // WebSocket lifecycle
  async clientConnected(sessionId: string): Promise<Response>
  async webSocketMessage(ws: WebSocket, message: any): Promise<void>
  async webSocketClose(ws: WebSocket, ...): Promise<void>

  // Broadcasting
  async notifyNewMessage(conversationId: string, message: any): Promise<void>
  async broadcastUserPresence(userId: string, isOnline: boolean): Promise<void>

  // HTTP endpoints
  fetch(request: Request): Promise<Response>
}
```

**Adapted from**:
- Chat Project's `AuthorizationDurableObject` (lines 697-778)
- Connection management (line 729: `this.connections.set(userId, server)`)
- Presence broadcasting (line 752-778)

#### **Step 1.2: Create CustomerMessageDO**
**File**: `src/durable-objects/CustomerMessageDO.ts`

**Responsibilities**:
- Message CRUD operations (D1 database)
- File upload to R2
- Message pagination
- Notify CustomerConversationDO after message creation

**Key Methods**:
```typescript
class CustomerMessageDO {
  // HTTP endpoints
  GET /customer/messages?before=&limit=     // Pagination
  POST /customer/messages                    // Create + notify
  POST /customer/upload                      // R2 upload

  // Database operations (D1)
  private async storeMessage(message: Message): Promise<void>
  private async getMessages(conversationId: string, pagination): Promise<Message[]>
}
```

**Adapted from**:
- Chat Project's `ConversationDurableObject` (lines 38-159)
- BUT using D1 Database instead of DO SQL Storage
- R2 upload pattern (lines 112-158)

#### **Step 1.3: Update Worker Index & Routes**
**File**: `src/index.ts`

**Changes**:
1. Add new DO bindings to `wrangler.toml`:
```toml
[[durable_objects.bindings]]
name = "CUSTOMER_CONVERSATION_DO"
class_name = "CustomerConversationDO"

[[durable_objects.bindings]]
name = "CUSTOMER_MESSAGE_DO"
class_name = "CustomerMessageDO"
```

2. Add routes (DO NOT conflict with existing routes):
```typescript
// NEW ROUTES - Customer Conversation System
app.get('/api/customer-ws', async (c) => {
  // WebSocket upgrade for customer conversations
  const conversationId = c.req.query('conversationId');
  const sessionId = c.req.query('sessionId');

  const id = env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
  const stub = env.CUSTOMER_CONVERSATION_DO.get(id);
  return stub.clientConnected(sessionId);
});

app.all('/api/customer-conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id');
  const id = env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
  const stub = env.CUSTOMER_MESSAGE_DO.get(id);
  return stub.fetch(c.req.raw);
});
```

3. Deploy migration:
```bash
npx wrangler deploy
```

---

### **Phase 2: Frontend - Vue 3 Recreation** (Day 3-5)

#### **Step 2.1: Create WebSocket Composable**
**File**: `frontend/src/composables/useCustomerWebSocket.ts`

**Purpose**: Vue 3 equivalent of Chat Project's `WebSocketProvider.tsx`

```typescript
// Composable for customer conversation WebSocket
export function useCustomerWebSocket(conversationId: string) {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const messageListeners = new Map<string, (message: any) => void>();

  // Connect to WebSocket
  const connect = () => {
    const sessionId = localStorage.getItem('session');
    ws.value = new WebSocket(
      `ws://localhost:8787/api/customer-ws?conversationId=${conversationId}&sessionId=${sessionId}`
    );

    ws.value.onopen = () => {
      isConnected.value = true;
    };

    ws.value.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'NEW_MESSAGE') {
        // Notify listeners
        messageListeners.forEach(callback => callback(data.message));
      }

      if (data.type === 'USER_CONNECTED' || data.type === 'USER_DISCONNECTED') {
        // Update presence
        // ...
      }
    };

    ws.value.onclose = () => {
      isConnected.value = false;
    };
  };

  // Add message listener
  const addMessageListener = (callback: (message: any) => void) => {
    const id = crypto.randomUUID();
    messageListeners.set(id, callback);
    return () => messageListeners.delete(id);
  };

  // Auto-reconnect on window focus
  const handleFocus = () => {
    if (!isConnected.value) {
      connect();
    }
  };

  onMounted(() => {
    connect();
    window.addEventListener('focus', handleFocus);
  });

  onUnmounted(() => {
    ws.value?.close();
    window.removeEventListener('focus', handleFocus);
  });

  return {
    isConnected,
    addMessageListener,
    reconnect: connect
  };
}
```

**Adapted from**:
- Chat Project's `WebSocketProvider.tsx` (lines 24-106)
- Vue 3 Composition API instead of React Context

#### **Step 2.2: Recreate ConversationDetail.vue**
**File**: `frontend/src/views/ConversationDetail.vue`

**Complete Rewrite** - New structure inspired by Chat Project's `channel.tsx`:

```vue
<template>
  <div class="conversation-detail-chat-style">
    <!-- Header: Customer Info & Status -->
    <div class="chat-header">
      <div class="customer-info">
        <div class="avatar">{{ customerInitials }}</div>
        <div class="details">
          <h1>{{ customer.name }}</h1>
          <p>{{ customer.platform }}</p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Online indicator for agents -->
        <div class="agents-online">
          <div v-for="agent in onlineAgents" :key="agent.id" class="agent-avatar">
            {{ agent.initials }}
            <div class="online-dot"></div>
          </div>
        </div>
        <!-- Close/Back buttons -->
        <button @click="goBack">返回</button>
      </div>
    </div>

    <!-- Message List: Simple Scroll (NO Virtual) -->
    <div class="messages-container" ref="messagesContainer" @scroll="handleScroll">
      <!-- Loading spinner -->
      <div v-if="isLoadingMessages" class="loading-spinner"></div>

      <!-- Messages -->
      <div class="message-list">
        <div v-for="message in messages" :key="message.id" class="message-item">
          <!-- Avatar -->
          <div class="message-avatar">{{ getInitials(message.user_id) }}</div>

          <!-- Content -->
          <div class="message-content">
            <div class="message-header">
              <span class="sender-name">{{ getSenderName(message.user_id) }}</span>
              <span class="timestamp">{{ formatTime(message.created_at) }}</span>
            </div>
            <p>{{ message.content }}</p>

            <!-- Attachments -->
            <div v-if="message.assets && message.assets.length > 0" class="attachments">
              <img v-for="(url, index) in message.assets" :key="index" :src="url" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll to bottom button -->
    <button v-if="showScrollButton" @click="scrollToBottom" class="scroll-to-bottom">
      ↓ 滾動到最新
    </button>

    <!-- Message Input: Simple with R2 Upload -->
    <div class="message-input-container">
      <textarea
        v-model="messageText"
        @keydown.enter.prevent="sendMessage"
        placeholder="輸入訊息..."
      ></textarea>

      <!-- File upload button -->
      <button @click="triggerFileUpload">📎</button>
      <input
        type="file"
        ref="fileInput"
        multiple
        @change="handleFileSelect"
        style="display: none"
      />

      <!-- Pending uploads -->
      <div v-if="pendingUploads.length > 0" class="pending-uploads">
        <div v-for="upload in pendingUploads" :key="upload.url" class="upload-chip">
          {{ upload.filename }}
          <button @click="removeUpload(upload)">×</button>
        </div>
      </div>

      <!-- Send button -->
      <button @click="sendMessage" :disabled="isSending">
        {{ isSending ? '發送中...' : '發送' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCustomerWebSocket } from '@/composables/useCustomerWebSocket';

const route = useRoute();
const router = useRouter();
const conversationId = route.params.id as string;

// WebSocket connection
const { isConnected, addMessageListener } = useCustomerWebSocket(conversationId);

// State
const messages = ref<any[]>([]);
const messageText = ref('');
const isSending = ref(false);
const isLoadingMessages = ref(true);
const pendingUploads = ref<any[]>([]);
const messagesContainer = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const showScrollButton = ref(false);

// Fetch initial messages
const fetchMessages = async () => {
  isLoadingMessages.value = true;
  try {
    const response = await fetch(
      `/api/customer-conversations/${conversationId}/messages`,
      {
        headers: {
          'X-Session-Id': localStorage.getItem('session') || ''
        }
      }
    );
    const data = await response.json();
    if (data.success) {
      messages.value = data.messages.reverse(); // Oldest first
      await nextTick();
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  } finally {
    isLoadingMessages.value = false;
  }
};

// Listen for real-time messages
onMounted(() => {
  fetchMessages();

  const unsubscribe = addMessageListener((message) => {
    messages.value.push(message);

    // Auto-scroll if near bottom
    if (isNearBottom()) {
      nextTick(() => scrollToBottom());
    }
  });

  // Cleanup on unmount
  onUnmounted(unsubscribe);
});

// Send message
const sendMessage = async () => {
  if (!messageText.value.trim() || isSending.value) return;

  isSending.value = true;
  try {
    const response = await fetch(
      `/api/customer-conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': localStorage.getItem('session') || ''
        },
        body: JSON.stringify({
          content: messageText.value,
          assets: pendingUploads.value.map(u => u.url)
        })
      }
    );

    if (response.ok) {
      messageText.value = '';
      pendingUploads.value = [];
    }
  } catch (error) {
    console.error('Error sending message:', error);
  } finally {
    isSending.value = false;
  }
};

// File upload to R2
const handleFileSelect = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (!files) return;

  for (const file of Array.from(files)) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(
        `/api/customer-conversations/${conversationId}/upload`,
        {
          method: 'POST',
          headers: {
            'X-Session-Id': localStorage.getItem('session') || ''
          },
          body: formData
        }
      );

      const data = await response.json();
      if (data.success) {
        pendingUploads.value.push({
          url: data.url,
          filename: file.name
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  }
};

// Scroll handling
const isNearBottom = () => {
  const container = messagesContainer.value;
  if (!container) return false;
  const threshold = 100;
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
};

const scrollToBottom = () => {
  messagesContainer.value?.scrollTo({
    top: messagesContainer.value.scrollHeight,
    behavior: 'smooth'
  });
};

const handleScroll = () => {
  showScrollButton.value = !isNearBottom();
};

// Utility functions
const getInitials = (userId: string) => {
  // Get user initials from store
  return 'AB';
};

const getSenderName = (userId: string) => {
  // Get user name from store
  return 'Agent Name';
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

const goBack = () => {
  router.push('/conversations');
};
</script>

<style scoped lang="scss">
.conversation-detail-chat-style {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.message-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-center;
  font-size: 0.875rem;
  font-weight: 500;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.sender-name {
  font-weight: 600;
  color: #111827;
}

.timestamp {
  font-size: 0.75rem;
  color: #6b7280;
}

.attachments {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.attachments img {
  max-width: 300px;
  max-height: 300px;
  border-radius: 0.5rem;
}

.scroll-to-bottom {
  position: absolute;
  bottom: 6rem;
  left: 50%;
  transform: translateX(-50%);
  background: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  cursor: pointer;
}

.message-input-container {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  resize: none;
  height: 80px;
}

.pending-uploads {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.upload-chip {
  background: #e5e7eb;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

**Adapted from**:
- Chat Project's `channel.tsx` (lines 11-506)
- Simplified structure (NO virtual scrolling, NO complex features)
- Direct WebSocket connection
- Simple message list with basic scroll handling
- R2 file upload pattern

---

### **Phase 3: Database & Data Flow** (Day 6)

#### **Step 3.1: Database Schema**
**No changes needed** - Use existing D1 `messages` table:

```sql
-- Existing table in D1
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  assets TEXT DEFAULT '[]',  -- JSON array of R2 URLs
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

#### **Step 3.2: Data Flow Verification**

**Message Send Flow**:
```
1. User types message in ConversationDetail.vue
2. Click Send → POST /api/customer-conversations/{id}/messages
3. CustomerMessageDO receives request
4. Store message in D1 database
5. Call CustomerConversationDO.notifyNewMessage()
6. CustomerConversationDO broadcasts to all connected agents
7. WebSocket delivers to frontend
8. Message appears in real-time
```

**File Upload Flow**:
```
1. User selects file
2. Upload to POST /api/customer-conversations/{id}/upload
3. CustomerMessageDO uploads to R2
4. Returns public R2 URL
5. Add URL to pendingUploads array
6. When message sent, include assets array
7. Store message with assets in D1
8. Broadcast message with asset URLs
9. Frontend displays images
```

---

### **Phase 4: Testing & Validation** (Day 7)

#### **Test Checklist**

**Backend Tests**:
- [ ] CustomerConversationDO - WebSocket connection
- [ ] CustomerConversationDO - Message broadcasting
- [ ] CustomerConversationDO - Presence tracking
- [ ] CustomerMessageDO - Message CRUD
- [ ] CustomerMessageDO - R2 file upload
- [ ] CustomerMessageDO - Pagination

**Frontend Tests**:
- [ ] WebSocket connection establishment
- [ ] WebSocket auto-reconnect
- [ ] Real-time message delivery
- [ ] Message sending
- [ ] File upload to R2
- [ ] Message list scrolling
- [ ] Scroll to bottom button
- [ ] Presence indicators

**Integration Tests**:
- [ ] End-to-end message flow
- [ ] Multi-user conversation
- [ ] File attachment delivery
- [ ] Connection loss recovery
- [ ] Browser tab focus/blur

**Other Modules Verification**:
- [ ] Team Management still works
- [ ] Analytics still works
- [ ] QR Code Management still works
- [ ] Tag System still works
- [ ] Authentication still works

---

## 🎨 **UI/UX Adaptation: React → Vue 3**

### **Chat Project UI Elements to Recreate**

#### **1. Channel Header** (channel.tsx:322-388)
- Customer/Channel name with icon
- Description text
- Member avatars with online dots
- Dropdown menu (Invite, Leave)

#### **2. Message List** (channel.tsx:390-454)
- Simple scroll container
- Message bubbles with avatars
- Sender name + timestamp
- Image attachments display
- Loading spinner for initial load

#### **3. Scroll to Bottom Button** (channel.tsx:457-465)
- Appears when not at bottom
- "Scroll to latest" text with arrow icon
- Smooth scroll animation

#### **4. Message Input** (ChatInput.tsx:76-152)
- Textarea with auto-grow
- File upload button
- Pending uploads chips
- Send button with loading state
- Drag & drop support
- Paste image support

#### **5. Color Scheme**
```scss
// From Chat Project
$primary-blue: #3b82f6;
$gray-50: #f9fafb;
$gray-100: #f3f4f6;
$gray-200: #e5e7eb;
$gray-500: #6b7280;
$gray-700: #374151;
$gray-900: #111827;

// Dark mode
$dark-bg: #1f2937;
$dark-border: #374151;
```

---

## ⚠️ **Critical Considerations**

### **1. Database Architecture**
- ❗ Chat Project uses **DO SQL Storage** (SQLite per DO)
- ❗ Multi-Channel uses **D1 Database** (centralized SQLite)
- ✅ **Solution**: Use D1 in CustomerMessageDO, NOT DO SQL Storage

### **2. Authentication**
- ❗ Chat Project uses custom session system
- ✅ **Solution**: Use existing JWT + KV session system

### **3. Channel vs Conversation**
- ❗ Chat Project: "channels" (group chat)
- ❗ Multi-Channel: "conversations" (1-to-1 customer support)
- ✅ **Solution**: Map conversation_id → channel_id in DO naming

### **4. User Model**
- ❗ Chat Project: `{ id, email, first_name, last_name, avatar }`
- ❗ Multi-Channel: Different user structure
- ✅ **Solution**: Adapter layer in frontend to map user data

### **5. R2 Upload URLs**
- ❗ Chat Project: Hardcoded public URL
- ✅ **Solution**: Use existing R2_PUBLIC_URL environment variable

---

## 🚀 **Deployment Strategy**

### **Step 1: Feature Branch Development**
```bash
# Already on feat/chat-style-conversation branch
git branch
# * feat/chat-style-conversation
#   main
#   pre-conversation-refactor
```

### **Step 2: Incremental Commits**
- Commit after each phase completion
- Test thoroughly before next phase
- Keep commits atomic and descriptive

### **Step 3: Testing Environment**
- Use localhost:8787 for backend
- Use localhost:3000 for frontend
- Test with multiple browser tabs (agents)

### **Step 4: Rollback Plan**
If integration fails:
```bash
git checkout pre-conversation-refactor
git branch -D feat/chat-style-conversation
```

### **Step 5: Merge to Main**
After successful testing:
```bash
git checkout main
git merge feat/chat-style-conversation
git push origin main
```

---

## 📚 **Reference Files**

### **Chat Project (Reference)**
Backend:
- `TechStack/chat/Backend/src/durable-objects/authorization.ts`
- `TechStack/chat/Backend/src/durable-objects/conversation.ts`
- `TechStack/chat/Backend/src/index.ts`

Frontend:
- `TechStack/chat/Frontend/app/routes/channel.tsx`
- `TechStack/chat/Frontend/app/components/ChatInput.tsx`
- `TechStack/chat/Frontend/app/providers/WebSocketProvider.tsx`
- `TechStack/chat/Frontend/app/providers/ChatProvider.tsx`

### **Multi-Channel System (Current)**
Backend:
- `src/durable-objects/ConversationRoom.ts` (to be simplified/replaced)
- `src/handlers/conversation-main.ts` (keep for other features)
- `src/services/websocket-broadcast-service.ts` (keep for other modules)

Frontend:
- `frontend/src/views/ConversationDetail.vue` (COMPLETE REWRITE)
- `frontend/src/components/conversation/VirtualMessageList.vue` (not used)
- `frontend/src/components/conversation/MessageInput.vue` (simplified version)

---

## ✅ **Success Criteria**

1. ✅ Single conversation view works with Chat Project UI/UX
2. ✅ Real-time messaging via simplified WebSocket architecture
3. ✅ File upload to R2 works seamlessly
4. ✅ Agent presence indicators show online/offline status
5. ✅ Other modules (Team, Analytics, etc.) remain untouched and functional
6. ✅ No breaking changes to existing API contracts
7. ✅ Performance: Message delivery < 100ms latency
8. ✅ Reliability: Auto-reconnect works on connection loss

---

## 📊 **Progress Tracking**

- [ ] Phase 1: Backend - Durable Objects
  - [ ] CustomerConversationDO implemented
  - [ ] CustomerMessageDO implemented
  - [ ] Routes added to index.ts
  - [ ] Durable Objects deployed
- [ ] Phase 2: Frontend - Vue 3 Recreation
  - [ ] useCustomerWebSocket composable
  - [ ] ConversationDetail.vue rewrite
  - [ ] Styling matches Chat Project
- [ ] Phase 3: Database & Data Flow
  - [ ] D1 schema verified
  - [ ] Message flow tested
  - [ ] File upload tested
- [ ] Phase 4: Testing & Validation
  - [ ] Backend tests pass
  - [ ] Frontend tests pass
  - [ ] Integration tests pass
  - [ ] Other modules verification

---

## 🎯 **Next Steps**

1. **Review this plan** - Confirm approach is correct
2. **Start Phase 1** - Implement CustomerConversationDO
3. **Iterative development** - Test after each component
4. **Continuous validation** - Ensure other modules work

---

**Created**: 2025-01-XX
**Last Updated**: 2025-01-XX
**Status**: 🔥 ACTIVE IMPLEMENTATION
