# Cloudflare Query Plugin

## (5 )

### Step 1: main.ts Plugin

```typescript
// frontend/src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createCloudflareQueryPlugin } from '@/stores/plugins/cloudflareQueryPlugin'
import App from './App.vue'

const app = createApp(App)

// Pinia
const pinia = createPinia()

// Cloudflare Query Plugin
pinia.use(createCloudflareQueryPlugin({
 // KV API proxy undefined
 // Workers env.CACHE_KV
 kvNamespace: undefined,
 verbose: import.meta.env.DEV //
}))

app.use(pinia)
app.mount('#app')
```

### Step 2: Store

```typescript
// frontend/src/stores/conversations.ts ()
import { defineStore } from 'pinia'

export const useConversationsStore = defineStore('conversations', () => {
 // ... state

 // action $cloudflareQuery
 async function loadConversations() {
 loading.value = true

 try {
 // : const data = await api.getConversations()
 // : $cloudflareQuery
 const data = await this.$cloudflareQuery({
 queryKey: ['conversations', 'all'],
 queryFn: () => api.getConversations(),
 staleTime: 5000, // 5
 cacheTime: 300, // KV 5
 retry: 3 // 3
 })

 conversations.value = data
 return data
 } catch (e) {
 error.value = e as Error
 throw e
 } finally {
 loading.value = false
 }
 }

 return { loadConversations }
})
```

### Step 3:

 Console:

```
[CloudflareQuery] Plugin installed on store: conversations
[KV Miss] team:1:conversations:all (12.34ms)
[Query Execute] team:1:conversations:all (attempt 1/4)
[Query Success] team:1:conversations:all (234.56ms)
[KV Write] team:1:conversations:all (TTL: 300s)
```

:

```
[KV Hit] team:1:conversations:all (5.67ms)
[Fresh Cache] team:1:conversations:all
```

 **** Cloudflare Query Plugin

---

## Workers ( KV )

### Cloudflare Workers

```typescript
// src/index.ts (Workers entry point)
import { createCloudflareQueryPlugin } from '../frontend/src/stores/plugins/cloudflareQueryPlugin'

export default {
 async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
 // Workers KV namespace
 const pinia = createPinia()

 pinia.use(createCloudflareQueryPlugin({
 kvNamespace: env.CACHE_KV, // KV namespace
 verbose: false //
 }))

 // ... rest of your handler logic
 }
}
```

### wrangler.toml

 `wrangler.toml` KV namespace :

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

---


```typescript
// Team 1
const auth = useAuthStore()
await auth.login({ teamId: 'team-1', ... })

const store = useConversationsStore()
await store.loadConversations()
// KV Key: team:team-1:conversations:all

// Team 2
await auth.switchTeam('team-2')
await store.loadConversations()
// KV Key: team:team-2:conversations:all
//
```

### Cloudflare Dashboard

1. Cloudflare Dashboard
2. Workers & Pages
3. KV Namespaces `CACHE_KV`
4. Keys:

```
team:1:conversations:all
team:1:conversations:detail:conv-123
team:1:conversations:conv-123:messages
team:2:conversations:all
team:2:conversations:detail:conv-456
```

 ** team key prefix**

---


### 1. staleTime

```typescript
// ()
await this.$cloudflareQuery({
 queryKey: ['system', 'config'],
 queryFn: () => api.getSystemConfig(),
 staleTime: 3600000, // 1
 cacheTime: 86400 // 24
})

// ()
await this.$cloudflareQuery({
 queryKey: ['messages', 'realtime'],
 queryFn: () => api.getRealtimeMessages(),
 staleTime: 1000, // 1
 cacheTime: 60 // 1
})
```

### 2. stale-while-revalidate UX

```typescript
await this.$cloudflareQuery({
 queryKey: ['conversations', 'list'],
 queryFn: () => api.getConversations(),
 staleTime: 5000,
 revalidateOnStale: true // SWR
})

// :
// 1. ()
// 2.
// 3. UI
```

### 3.

```typescript
// -
await this.$cloudflareQuery({
 queryKey: ['payment', 'process'],
 queryFn: () => api.processPayment(),
 retry: 5, // 5
 retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 60000) // exponential backoff
})

// -
await this.$cloudflareQuery({
 queryKey: ['analytics', 'stats'],
 queryFn: () => api.getAnalytics(),
 retry: 1, // 1
 retryDelay: () => 1000 // 1
})
```

---


### 1:

```typescript
// 1. ( KV)
await store.loadConversations()

// 2. ( DevTools Network tab Offline)

// 3.
await store.loadConversations()
// KV

// Console :
// [KV Hit] team:1:conversations:all (3.45ms)
// [Fresh Cache] team:1:conversations:all
//
```

### 2: API

```typescript
// 1. ( KV stale cache)
await store.loadConversations()

// 2. 10 ( staleTime)

// 3. API ( 500 )

// 4.
await store.loadConversations()

// Console :
// [KV Hit] team:1:conversations:all (3.45ms)
// [Stale Cache] team:1:conversations:all, revalidating in background
// [Query Execute] team:1:conversations:all (attempt 1/4)
// [Query Error] team:1:conversations:all, retrying in 1000ms
// [Query Execute] team:1:conversations:all (attempt 2/4)
// [Query Error] team:1:conversations:all, retrying in 2000ms
// ... ( 3 )
// [Query Failed] team:1:conversations:all, attempting degradation
// [Degraded Mode] Using stale cache for team:1:conversations:all
// +
```

### 3:

```typescript
// 1. Team 1
await auth.login({ teamId: 'team-1', ... })
await store.loadConversations()
// Team 1

// 2. Team 2
await auth.login({ teamId: 'team-2', ... })
await store.loadConversations()
// Team 2

// 3. Team 2 Team 1
const team2Conversations = store.conversations
expect(team2Conversations).not.toContainAnyFrom(team1Conversations)
//
```

---


```typescript
// Console
const store = useConversationsStore()
const metrics = store.getQueryMetrics()

console.table(metrics)
```

:

```

 Key Hits Misses Errors Revalidations Avg Latency (ms)

 team:1:conversations:all 15 3 0 2 45.3
 team:1:conversations:detail:conv-1 8 1 0 1 32.1

```


- **High Hit Rate (>80%)**:
- **High Miss Rate (>50%)**: staleTime
- **Errors > 0**: API
- **High Avg Latency**: API

---


### SSE/WebSocket

```typescript
// SSE
sseClient.on('conversation-updated', (conversationId) => {
 // 1: ()
 store.loadConversation(conversationId)

 // 2: ()
 const conversation = store.conversations.find(c => c.id === conversationId)
 if (conversation) {
 Object.assign(conversation, newData)
 }
})
```

### Durable Objects

```typescript
// Durable Object key pattern
class ConversationRoom {
 async fetch(request: Request): Promise<Response> {
 const teamId = new URL(request.url).searchParams.get('teamId')
 const cacheKey = `team:${teamId}:conversations:all`

 // KV
 await this.env.CACHE_KV.put(cacheKey, JSON.stringify(updatedData))

 // WebSocket
 this.broadcast({ type: 'conversation-updated', data: updatedData })

 return new Response('OK')
 }
}
```

---


### 1: "No active team context"

****: authStore currentTeam

****:
```typescript
// auth
import { useAuthStore } from '@/stores/auth'

onBeforeMount(() => {
 const auth = useAuthStore()
 if (!auth.currentTeam) {
 router.push('/login')
 }
})
```

### 2: KV

****:
1. `staleTime`
2. `queryKey`

****:
```typescript
// verbose
pinia.use(createCloudflareQueryPlugin({ verbose: true }))

// Console
// [KV Miss] team:1:conversations:all
// [KV Hit] team:1:conversations:all
```

### 3: Workers KV

** wrangler.toml**:
```toml
[[kv_namespaces]]
binding = "CACHE_KV" #
id = "..."
```

** TypeScript **:
```typescript
// src/types/bindings.ts
export interface Env {
 CACHE_KV: KVNamespace //
}
```

---


### 1: (1 )

- 1-2 store
-
-

### 2: (2-3 )

- $cloudflareQuery
-
- (10% )

### 3: (4-6 )

- 100%
-
-
-

---


1. ****: team prefix
2. ****: KV + stale-while-revalidate
3. ****: +
4. **Edge **: Cloudflare Workers
5. ****: Pinia
6. ****: API 80%+


- ****: ~200ms (API )
- ****: ~5ms (KV )
- ****: >85%
- **API **: 80-90%
- ****:


1. : `MULTI_TENANT_ARCHITECTURE_EVALUATION.md`
2. : `frontend/src/stores/examples/conversations-with-cloudflare-query.ts`
3. store
4.

---

** Cloudflare Query **
