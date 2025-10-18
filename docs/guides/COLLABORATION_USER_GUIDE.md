
> ****
> : 1.0.0 | : 2025-10-01

---


1. [](#)
2. [](#)
3. [](#)
4. [](#)
5. [API ](#api-)
6. [](#)
7. [](#)
8. [](#)

---


- ****
- ****Typing Indicator
- ****//
- ****


```


```

---


```
 REST API Collaboration SSE/WebSocket


```


```typescript
// 1
// : POST /api/collaboration/conversations/:id/join

// 2
// : { success: true, message: "Joined conversation successfully" }

// 3
// : POST /api/collaboration/typing
// : { conversationId: 123, status: "start" }

// 4 "XXX ..."
// SSE : { type: "typing_start", userId: 1, ... }

// 5
// : POST /api/collaboration/conversations/:id/leave
```


```typescript
// composables/useCollaboration.ts
import { ref, onMounted, onUnmounted } from 'vue';

export function useCollaboration(conversationId: number) {
 const viewers = ref([]);
 const typingUsers = ref([]);

 //
 const joinConversation = async () => {
 const response = await fetch(
 `/api/collaboration/conversations/${conversationId}/join`,
 {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 }
 }
 );

 if (response.ok) {
 console.log(' ');
 }
 };

 //
 const leaveConversation = async () => {
 await fetch(
 `/api/collaboration/conversations/${conversationId}/leave`,
 { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
 );
 };

 //
 const sendTyping = async (isTyping: boolean) => {
 await fetch('/api/collaboration/typing', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 conversationId,
 status: isTyping ? 'start' : 'stop'
 })
 });
 };

 onMounted(() => {
 joinConversation();
 });

 onUnmounted(() => {
 leaveConversation();
 });

 return { viewers, typingUsers, sendTyping };
}
```

---


### 1. Viewer Management


** 1: **
```typescript
//
const response = await fetch(
 `/api/collaboration/conversations/123/viewers`,
 { headers: { 'Authorization': `Bearer ${token}` } }
);

const data = await response.json();
console.log(data);
// :
// {
// "success": true,
// "data": {
// "viewers": [
// {
// "userId": 1,
// "username": "alice",
// "displayName": "Alice ",
// "role": "agent",
// "joinedAt": "2025-10-01T10:30:00Z",
// "protocol": "sse",
// "isTyping": false,
// "lastActivity": "2025-10-01T10:35:00Z"
// },
// {
// "userId": 2,
// "username": "bob",
// "displayName": "Bob ",
// "role": "admin",
// "joinedAt": "2025-10-01T10:32:00Z",
// "protocol": "sse",
// "isTyping": true,
// "lastActivity": "2025-10-01T10:35:30Z"
// }
// ]
// }
// }
```

** 2: **
```vue
<template>
 <div class="conversation-viewers">
 <span class="label"></span>
 <div class="avatar-group">
 <div
 v-for="viewer in viewers"
 :key="viewer.userId"
 class="avatar"
 :title="viewer.displayName"
 >
 <img :src="viewer.avatarUrl" :alt="viewer.displayName" />
 <span v-if="viewer.isTyping" class="typing-indicator"></span>
 </div>
 </div>
 <span class="count"> {{ viewers.length }} </span>
 </div>
</template>
```


- /5
-
- 60

---

### 2. Typing Indicator


 "XXX ..."


** 1: **
```typescript
import { ref, watch } from 'vue';
import { debounce } from 'lodash-es';

const messageInput = ref('');
let typingTimeout: NodeJS.Timeout;

// typing start
const sendTypingStart = debounce(() => {
 fetch('/api/collaboration/typing', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 conversationId: currentConversationId.value,
 status: 'start'
 })
 });
}, 300);

//
watch(messageInput, (newValue, oldValue) => {
 if (newValue && !oldValue) {
 //
 sendTypingStart();
 }

 // timeout
 clearTimeout(typingTimeout);

 // 5 stop
 typingTimeout = setTimeout(() => {
 fetch('/api/collaboration/typing', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 conversationId: currentConversationId.value,
 status: 'stop'
 })
 });
 }, 5000);
});
```

** 2: **
```typescript
const sendMessage = async (content: string) => {
 // 1.
 await fetch('/api/collaboration/typing', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 conversationId: currentConversationId.value,
 status: 'stop'
 })
 });

 // 2.
 await fetch('/api/messages', {
 method: 'POST',
 body: JSON.stringify({ conversationId, content })
 });

 // 3.
 messageInput.value = '';
};
```


```vue
<template>
 <div class="typing-indicator" v-if="typingUsers.length > 0">
 <span class="dots"></span>
 <span class="text">
 {{ formatTypingText(typingUsers) }}
 </span>
 </div>
</template>

<script setup>
const formatTypingText = (users) => {
 if (users.length === 1) {
 return `${users[0].displayName} ...`;
 } else if (users.length === 2) {
 return `${users[0].displayName} ${users[1].displayName} ...`;
 } else {
 return `${users[0].displayName} ${users.length - 1} ...`;
 }
};
</script>
```

---

### 3. Presence Tracking


///


```typescript
type PresenceStatus =
 | 'online' //
 | 'away' //
 | 'busy' //
 | 'offline'; //
```


```typescript
// 1.
const setOnline = async () => {
 await fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 status: 'online'
 })
 });
};

// 2.
const updateCurrentConversation = async (conversationId: number) => {
 await fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 status: 'online',
 currentConversation: conversationId
 })
 });
};

// 3. 5
const setAway = async () => {
 await fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 status: 'away'
 })
 });
};

// 4.
const setBusy = async () => {
 await fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 status: 'busy',
 metadata: {
 reason: ''
 }
 })
 });
};

// 5.
const setOffline = async () => {
 await fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 status: 'offline'
 })
 });
};
```


```typescript
// composables/useAutoAway.ts
import { onMounted, onUnmounted } from 'vue';

export function useAutoAway() {
 let idleTimer: NodeJS.Timeout;
 const IDLE_TIMEOUT = 5 * 60 * 1000; // 5

 const resetIdleTimer = () => {
 clearTimeout(idleTimer);

 //
 fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ status: 'online' })
 });

 // 5
 idleTimer = setTimeout(() => {
 fetch('/api/collaboration/presence', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ status: 'away' })
 });
 }, IDLE_TIMEOUT);
 };

 onMounted(() => {
 //
 window.addEventListener('mousemove', resetIdleTimer);
 window.addEventListener('keydown', resetIdleTimer);
 window.addEventListener('click', resetIdleTimer);

 resetIdleTimer();
 });

 onUnmounted(() => {
 clearTimeout(idleTimer);
 window.removeEventListener('mousemove', resetIdleTimer);
 window.removeEventListener('keydown', resetIdleTimer);
 window.removeEventListener('click', resetIdleTimer);
 });
}
```

---

### 4. Conversation State


#### API

```typescript
const getConversationState = async (conversationId: number) => {
 const response = await fetch(
 `/api/collaboration/conversations/${conversationId}/state`,
 { headers: { 'Authorization': `Bearer ${token}` } }
 );

 const data = await response.json();
 return data;
};

// :
// {
// "success": true,
// "data": {
// "conversationId": 123,
// "viewers": [
// { userId: 1, username: "alice", displayName: "Alice", ... },
// { userId: 2, username: "bob", displayName: "Bob", ... }
// ],
// "typing": [
// { userId: 2, username: "bob", startedAt: "2025-10-01T10:35:00Z" }
// ],
// "totalConnections": 2,
// "protocol": "sse",
// "lastActivity": "2025-10-01T10:35:30Z"
// }
// }
```


```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const conversationState = ref(null);
let refreshInterval;

//
onMounted(async () => {
 conversationState.value = await getConversationState(conversationId);

 // 5 SSE
 refreshInterval = setInterval(async () => {
 conversationState.value = await getConversationState(conversationId);
 }, 5000);
});

onUnmounted(() => {
 clearInterval(refreshInterval);
});
</script>

<template>
 <div class="conversation-header" v-if="conversationState">
 <!-- -->
 <div class="viewers">
 <span v-for="viewer in conversationState.viewers" :key="viewer.userId">
 {{ viewer.displayName }}
 </span>
 </div>

 <!-- -->
 <div v-if="conversationState.typing.length > 0" class="typing-indicator">
 {{ conversationState.typing[0].displayName }} ...
 </div>

 <!-- -->
 <div class="connection-status">
 <span class="dot" :class="{ online: conversationState.totalConnections > 0 }"></span>
 {{ conversationState.totalConnections }}
 </div>
 </div>
</template>
```

---


### Vue 3

```typescript
// composables/useCollaboration.ts
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { debounce } from 'lodash-es';

export interface CollaborationOptions {
 conversationId: number;
 autoJoin?: boolean;
 autoLeave?: boolean;
 enableTyping?: boolean;
 enablePresence?: boolean;
}

export function useCollaboration(options: CollaborationOptions) {
 const authStore = useAuthStore();
 const token = computed(() => authStore.token);

 //
 const viewers = ref<Viewer[]>([]);
 const typingUsers = ref<TypingUser[]>([]);
 const isJoined = ref(false);
 const isTyping = ref(false);

 // API URL
 const API_BASE = '/api/collaboration';

 // ==================== ====================

 /**
 *
 */
 const joinConversation = async () => {
 if (isJoined.value) return;

 try {
 const response = await fetch(
 `${API_BASE}/conversations/${options.conversationId}/join`,
 {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token.value}`,
 'Content-Type': 'application/json'
 }
 }
 );

 if (response.ok) {
 isJoined.value = true;
 console.log(' ');

 //
 await refreshState();
 }
 } catch (error) {
 console.error(' :', error);
 }
 };

 /**
 *
 */
 const leaveConversation = async () => {
 if (!isJoined.value) return;

 try {
 await fetch(
 `${API_BASE}/conversations/${options.conversationId}/leave`,
 {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token.value}`
 }
 }
 );

 isJoined.value = false;
 console.log(' ');
 } catch (error) {
 console.error(' :', error);
 }
 };

 /**
 *
 */
 const sendTypingStatus = async (status: 'start' | 'stop') => {
 if (!options.enableTyping) return;

 try {
 await fetch(`${API_BASE}/typing`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token.value}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 conversationId: options.conversationId,
 status
 })
 });

 isTyping.value = status === 'start';
 } catch (error) {
 console.error(' :', error);
 }
 };

 /**
 *
 */
 const startTyping = debounce(() => {
 sendTypingStatus('start');
 }, 300);

 /**
 *
 */
 const stopTyping = () => {
 sendTypingStatus('stop');
 };

 /**
 *
 */
 const updatePresence = async (status: 'online' | 'away' | 'busy' | 'offline') => {
 if (!options.enablePresence) return;

 try {
 await fetch(`${API_BASE}/presence`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token.value}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 status,
 currentConversation: status !== 'offline' ? options.conversationId : undefined
 })
 });
 } catch (error) {
 console.error(' :', error);
 }
 };

 /**
 *
 */
 const refreshState = async () => {
 try {
 const response = await fetch(
 `${API_BASE}/conversations/${options.conversationId}/state`,
 {
 headers: {
 'Authorization': `Bearer ${token.value}`
 }
 }
 );

 if (response.ok) {
 const data = await response.json();
 viewers.value = data.data.viewers;
 typingUsers.value = data.data.typing.map((t: any) => ({
 userId: t.userId,
 displayName: viewers.value.find(v => v.userId === t.userId)?.displayName || 'Unknown'
 }));
 }
 } catch (error) {
 console.error(' :', error);
 }
 };

 // ==================== ====================

 /**
 *
 */
 const otherViewers = computed(() => {
 const currentUserId = authStore.user?.userId;
 return viewers.value.filter(v => v.userId !== currentUserId);
 });

 /**
 *
 */
 const typingText = computed(() => {
 const count = typingUsers.value.length;
 if (count === 0) return '';
 if (count === 1) return `${typingUsers.value[0].displayName} ...`;
 if (count === 2) {
 return `${typingUsers.value[0].displayName} ${typingUsers.value[1].displayName} ...`;
 }
 return `${typingUsers.value[0].displayName} ${count - 1} ...`;
 });

 // ==================== ====================

 let refreshInterval: NodeJS.Timeout;

 onMounted(async () => {
 //
 if (options.autoJoin !== false) {
 await joinConversation();
 }

 //
 if (options.enablePresence !== false) {
 await updatePresence('online');
 }

 // 5
 refreshInterval = setInterval(() => {
 if (isJoined.value) {
 refreshState();
 }
 }, 5000);
 });

 onUnmounted(async () => {
 clearInterval(refreshInterval);

 //
 if (isTyping.value) {
 await stopTyping();
 }

 //
 if (options.autoLeave !== false) {
 await leaveConversation();
 }
 });

 // ==================== ====================

 return {
 //
 viewers,
 typingUsers,
 isJoined,
 isTyping,

 //
 otherViewers,
 typingText,

 //
 joinConversation,
 leaveConversation,
 startTyping,
 stopTyping,
 updatePresence,
 refreshState
 };
}
```


```vue
<!-- views/ConversationDetail.vue -->
<template>
 <div class="conversation-detail">
 <!-- -->
 <div class="collaboration-bar">
 <!-- -->
 <div class="viewers" v-if="otherViewers.length > 0">
 <span class="label"></span>
 <div class="avatar-list">
 <div
 v-for="viewer in otherViewers"
 :key="viewer.userId"
 class="avatar"
 :title="viewer.displayName"
 >
 {{ viewer.displayName.charAt(0) }}
 </div>
 </div>
 </div>

 <!-- -->
 <div class="typing-indicator" v-if="typingText">
 <span class="dots"></span>
 <span class="text">{{ typingText }}</span>
 </div>
 </div>

 <!-- -->
 <div class="message-list">
 <!-- ... ... -->
 </div>

 <!-- -->
 <div class="input-area">
 <textarea
 v-model="messageInput"
 @input="handleInput"
 @blur="handleBlur"
 placeholder="..."
 />
 <button @click="sendMessage"></button>
 </div>
 </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCollaboration } from '@/composables/useCollaboration';

const route = useRoute();
const conversationId = Number(route.params.id);

//
const {
 otherViewers,
 typingText,
 startTyping,
 stopTyping,
 updatePresence
} = useCollaboration({
 conversationId,
 autoJoin: true,
 autoLeave: true,
 enableTyping: true,
 enablePresence: true
});

//
const messageInput = ref('');
let typingTimeout: NodeJS.Timeout;

const handleInput = () => {
 //
 startTyping();

 // 5
 clearTimeout(typingTimeout);
 typingTimeout = setTimeout(() => {
 stopTyping();
 }, 5000);
};

const handleBlur = () => {
 //
 stopTyping();
};

const sendMessage = async () => {
 //
 stopTyping();

 //
 // ... ...

 //
 messageInput.value = '';
};
</script>

<style scoped>
.collaboration-bar {
 display: flex;
 align-items: center;
 gap: 1rem;
 padding: 0.5rem 1rem;
 background: #f5f5f5;
 border-bottom: 1px solid #e0e0e0;
}

.viewers {
 display: flex;
 align-items: center;
 gap: 0.5rem;
}

.avatar-list {
 display: flex;
 gap: 0.25rem;
}

.avatar {
 width: 32px;
 height: 32px;
 border-radius: 50%;
 background: #3b82f6;
 color: white;
 display: flex;
 align-items: center;
 justify-content: center;
 font-size: 14px;
 font-weight: bold;
}

.typing-indicator {
 display: flex;
 align-items: center;
 gap: 0.5rem;
 color: #6b7280;
 font-size: 14px;
}

.dots {
 animation: blink 1.4s infinite;
}

@keyframes blink {
 0%, 100% { opacity: 0.2; }
 50% { opacity: 1; }
}
</style>
```

---

## API


- **Base URL**: `/api/collaboration`
- ****: JWT Token `/health`
- **Content-Type**: `application/json`
- **Authorization Header**: `Bearer <token>`

---

### 1.

****: `POST /api/collaboration/conversations/:id/join`

****:

****:
```http
POST /api/collaboration/conversations/123/join
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
 "protocol": "sse" // "sse"
}
```

****:
```json
{
 "success": true,
 "message": "Joined conversation successfully"
}
```

****:
```json
{
 "success": false,
 "error": "Invalid conversation ID",
 "statusCode": 400
}
```

---

### 2.

****: `POST /api/collaboration/conversations/:id/leave`

****:

****:
```http
POST /api/collaboration/conversations/123/leave
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

****:
```json
{
 "success": true,
 "message": "Left conversation successfully"
}
```

---

### 3.

****: `GET /api/collaboration/conversations/:id/state`

****:

****:
```http
GET /api/collaboration/conversations/123/state?protocol=sse
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

****:
- `protocol` (): `sse` | `websocket`

****:
```json
{
 "success": true,
 "data": {
 "conversationId": 123,
 "viewers": [
 {
 "userId": 1,
 "username": "alice",
 "displayName": "Alice ",
 "role": "agent",
 "joinedAt": "2025-10-01T10:30:00Z",
 "protocol": "sse",
 "isTyping": false,
 "lastActivity": "2025-10-01T10:35:00Z"
 }
 ],
 "typing": [
 {
 "userId": 2,
 "username": "bob",
 "startedAt": "2025-10-01T10:35:00Z",
 "expiresAt": "2025-10-01T10:35:05Z"
 }
 ],
 "totalConnections": 2,
 "protocol": "sse",
 "lastActivity": "2025-10-01T10:35:30Z"
 }
}
```

---

### 4.

****: `GET /api/collaboration/conversations/:id/viewers`

****:

****:
```http
GET /api/collaboration/conversations/123/viewers
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

****:
```json
{
 "success": true,
 "data": {
 "viewers": [
 {
 "userId": 1,
 "username": "alice",
 "displayName": "Alice ",
 "role": "agent",
 "joinedAt": "2025-10-01T10:30:00Z",
 "protocol": "sse",
 "isTyping": false,
 "lastActivity": "2025-10-01T10:35:00Z"
 }
 ]
 }
}
```

---

### 5.

****: `POST /api/collaboration/typing`

****:

****:
```http
POST /api/collaboration/typing
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
 "conversationId": 123,
 "status": "start" // "start" "stop"
}
```

****:
- `conversationId` (): ID
- `status` (): `"start"` , `"stop"`

****:
```json
{
 "success": true,
 "message": "Typing start sent successfully"
}
```

****:
- 5
- `stop`

---

### 6.

****: `POST /api/collaboration/presence`

****:

****:
```http
POST /api/collaboration/presence
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
 "status": "online",
 "currentConversation": 123,
 "metadata": {
 "customField": "value"
 }
}
```

****:
- `status` (): `"online"` | `"away"` | `"busy"` | `"offline"`
- `currentConversation` (): ID
- `metadata` ():

****:
```json
{
 "success": true,
 "message": "Presence updated successfully"
}
```

---

### 7.

****: `GET /api/collaboration/stats`

****:

****:
```http
GET /api/collaboration/stats?protocol=sse
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

****:
- `protocol` ():

****:
```json
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
 "topActiveConversations": [
 {
 "conversationId": 123,
 "viewerCount": 3,
 "typingCount": 1
 },
 {
 "conversationId": 456,
 "viewerCount": 2,
 "typingCount": 0
 }
 ]
 }
}
```

---

### 8.

****: `POST /api/collaboration/cleanup`

****:

****:
```http
POST /api/collaboration/cleanup
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

****: `admin`

****:
```json
{
 "success": true,
 "data": {
 "cleanedCount": 5
 },
 "message": "Cleanup completed successfully"
}
```

---

### 9.

****: `GET /api/collaboration/health`

****:

****:
```http
GET /api/collaboration/health
```

****:
```json
{
 "success": true,
 "data": {
 "status": "healthy",
 "config": {
 "defaultProtocol": "sse",
 "enableWebSocket": false
 },
 "availableProtocols": ["sse"],
 "timestamp": "2025-10-01T10:35:00Z"
 },
 "message": "Health check completed"
}
```

---


 `src/index.ts`

```typescript
await Collaboration.initialize(env, {
 //
 defaultProtocol: 'sse',

 // WebSocket
 enableWebSocket: false,

 //
 typingExpirationSeconds: 5,

 //
 presenceExpirationSeconds: 300,

 //
 cleanupIntervalSeconds: 60,

 //
 maxViewersPerConversation: 50,

 //
 persistEvents: false
});
```


| | | | |
|--------|------|--------|------|
| `defaultProtocol` | `'sse' \| 'websocket' \| 'http'` | `'sse'` | |
| `enableWebSocket` | `boolean` | `false` | WebSocket |
| `typingExpirationSeconds` | `number` | `5` | |
| `presenceExpirationSeconds` | `number` | `300` | |
| `cleanupIntervalSeconds` | `number` | `60` | |
| `maxViewersPerConversation` | `number` | `50` | |
| `persistEvents` | `boolean` | `false` | |

### WebSocket

 WebSocket Durable Objects

```typescript
// src/index.ts
await Collaboration.initialize(env, {
 defaultProtocol: 'websocket', // WebSocket
 enableWebSocket: true, // WebSocket
 // ...
});
```

****:
- WebSocket Cloudflare Workers
- `wrangler.toml` Durable Objects
- WebSocket

---


### Q1:

****:
1. `POST /api/collaboration/typing` API
2. 5
3.
4. SSE

****:
```typescript
//
const handleInput = () => {
 startTyping(); // API

 // 5
 clearTimeout(typingTimeout);
 typingTimeout = setTimeout(stopTyping, 5000);
};
```

---

### Q2:

** 1: **
```typescript
const response = await fetch(
 `/api/collaboration/conversations/${conversationId}/viewers`,
 { headers: { 'Authorization': `Bearer ${token}` } }
);
const data = await response.json();
const viewerCount = data.data.viewers.length;
```

** 2: **
```typescript
const response = await fetch(
 `/api/collaboration/conversations/${conversationId}/state`,
 { headers: { 'Authorization': `Bearer ${token}` } }
);
const data = await response.json();
const viewerCount = data.data.totalConnections;
```

---

### Q3:

****:
- ****: `/leave`
- ****: 5 300
- ****:

****:
```typescript
// beforeunload
window.addEventListener('beforeunload', () => {
 navigator.sendBeacon(
 `/api/collaboration/conversations/${conversationId}/leave`,
 JSON.stringify({})
 );
});
```

---

### Q4: SSE WebSocket

| | SSE | WebSocket |
|------|-----|-----------|
| **** | HTTP | |
| **** | | |
| **** | | |
| **** | | |
| **** | | |
| **** | | |

****:
- **SSE**
- **WebSocket**

---

### Q5:

```typescript
// composables/useAutoAway.ts
export function useAutoAway() {
 const IDLE_TIMEOUT = 5 * 60 * 1000; // 5
 let idleTimer: NodeJS.Timeout;

 const resetTimer = () => {
 clearTimeout(idleTimer);

 //
 updatePresence('online');

 // 5
 idleTimer = setTimeout(() => {
 updatePresence('away');
 }, IDLE_TIMEOUT);
 };

 //
 onMounted(() => {
 ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
 window.addEventListener(event, resetTimer);
 });
 resetTimer();
 });

 onUnmounted(() => {
 clearTimeout(idleTimer);
 ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
 window.removeEventListener(event, resetTimer);
 });
 });
}
```

---

### Q6:

****:
```typescript
// src/index.ts
await Collaboration.initialize(env, {
 maxViewersPerConversation: 50 // 50
});
```

****:
```typescript
const joinConversation = async () => {
 try {
 const response = await fetch(`/api/collaboration/conversations/${id}/join`, {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${token}` }
 });

 if (!response.ok) {
 const error = await response.json();
 if (error.error === 'Room is full') {
 alert('');
 }
 }
 } catch (error) {
 console.error(error);
 }
};
```

---


### 1.

#### API

```typescript
// API
const handleInput = () => {
 fetch('/api/collaboration/typing', { ... });
};

//
const handleInput = debounce(() => {
 fetch('/api/collaboration/typing', { ... });
}, 300);
```

#### SSE

```typescript
//
setInterval(() => {
 fetchViewers();
}, 1000);

// SSE
const eventSource = new EventSource('/api/realtime/sse');
eventSource.onmessage = (event) => {
 const data = JSON.parse(event.data);
 if (data.type === 'viewer_joined') {
 //
 }
};
```

---

### 2.


```typescript
//
if (otherViewers.length === 1) {
 return `${otherViewers[0].displayName} `;
} else if (otherViewers.length > 1) {
 return `${otherViewers[0].displayName} ${otherViewers.length - 1} `;
}
```


```typescript
//
window.addEventListener('beforeunload', (e) => {
 if (typingUsers.length > 0) {
 e.preventDefault();
 e.returnValue = '';
 }
});
```

---

### 3.


```typescript
const joinConversation = async () => {
 try {
 await fetch('/api/collaboration/conversations/123/join', { ... });
 } catch (error) {
 //
 console.warn('');
 //
 }
};
```


```typescript
const joinWithRetry = async (maxRetries = 3) => {
 for (let i = 0; i < maxRetries; i++) {
 try {
 await joinConversation();
 return;
 } catch (error) {
 if (i === maxRetries - 1) throw error;
 await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
 }
 }
};
```

---

### 4.


```typescript
//
app.post('/conversations/:id/join', async (c) => {
 const conversationId = parseInt(c.req.param('id'));
 const userId = c.get('jwtPayload').userId;

 //
 const hasAccess = await checkConversationAccess(userId, conversationId);
 if (!hasAccess) {
 return errorResponse(c, 'Forbidden', 403);
 }

 // ...
});
```


```typescript
//
const sendTyping = rateLimiter(async (status) => {
 await fetch('/api/collaboration/typing', { ... });
}, 1000); // 1
```

---

### 5.


```typescript
const joinConversation = async () => {
 console.log('[Collaboration] Joining conversation', conversationId);

 try {
 await fetch('/api/collaboration/conversations/123/join', { ... });
 console.log('[Collaboration] Successfully joined');
 } catch (error) {
 console.error('[Collaboration] Failed to join', error);
 }
};
```


```typescript
//
setInterval(async () => {
 const stats = await fetch('/api/collaboration/stats').then(r => r.json());
 console.log('[Collaboration Stats]', stats.data);
}, 60000); //
```

---


### A.

```typescript
// types/collaboration.ts

export interface Viewer {
 userId: number;
 username: string;
 displayName: string;
 role: string;
 joinedAt: string;
 protocol: 'sse' | 'websocket' | 'http';
 isTyping: boolean;
 lastActivity: string;
}

export interface TypingUser {
 userId: number;
 username: string;
 displayName: string;
 startedAt: string;
 expiresAt: string;
}

export interface ConversationState {
 conversationId: number;
 viewers: Viewer[];
 typing: TypingUser[];
 totalConnections: number;
 protocol: string;
 lastActivity: string;
}

export interface CollaborationStats {
 totalViewers: number;
 totalTyping: number;
 totalRooms: number;
 connectionsByProtocol: {
 sse: number;
 websocket: number;
 http: number;
 };
 topActiveConversations: Array<{
 conversationId: number;
 viewerCount: number;
 typingCount: number;
 }>;
}
```

---

### B.

```typescript
// tests/collaboration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCollaboration } from '@/composables/useCollaboration';

describe('useCollaboration', () => {
 let collaboration: ReturnType<typeof useCollaboration>;

 beforeEach(() => {
 collaboration = useCollaboration({
 conversationId: 123,
 autoJoin: false,
 autoLeave: false
 });
 });

 it('should join conversation successfully', async () => {
 await collaboration.joinConversation();
 expect(collaboration.isJoined.value).toBe(true);
 });

 it('should update typing status', async () => {
 await collaboration.startTyping();
 expect(collaboration.isTyping.value).toBe(true);

 await collaboration.stopTyping();
 expect(collaboration.isTyping.value).toBe(false);
 });

 it('should refresh state and get viewers', async () => {
 await collaboration.refreshState();
 expect(collaboration.viewers.value).toBeInstanceOf(Array);
 });
});
```

---


 API


- [API ](../src/modules/collaboration/README.md)
- [](https://github.com/your-repo/issues)
- [](https://github.com/your-repo/discussions)

---

****:
- v1.0.0 (2025-10-01):

****: Collaboration Team
****: 2025-10-01
